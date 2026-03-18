# Review Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all Critical and Important issues found in the post-Antigravity code review, in priority order.

**Architecture:** All fixes are isolated and non-breaking. No new dependencies required. Python changes are internal refactors only. TypeScript changes are confined to `route.ts` and `page.tsx`.

**Tech Stack:** Next.js 16 App Router, TypeScript 5, Python 3, Tailwind CSS v4

---

> ⚠️ **MANUAL STEP REQUIRED BEFORE STARTING**
>
> The `.env.local` file contains live Supabase and Gemini credentials. Rotate these now:
> 1. Go to your Supabase project → Settings → API → regenerate the service role key
> 2. Go to Google AI Studio → regenerate the Gemini API key
> 3. Update `.env.local` with the new values
>
> This cannot be done in code — it requires your action first.

---

### Task 1: Restore `layout.tsx` (Build Blocker)

**Why first:** The app cannot build for production without this file. Next.js App Router requires a root layout.

**Files:**
- Create: `src/app/layout.tsx`

**Step 1: Create the layout file**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NotetakingApp",
  description: "AI-powered study guide synthesis",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

**Step 2: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors. No "Missing required root layout" or "html/body tags missing" errors.

**Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "fix: restore root layout.tsx required by Next.js App Router"
```

---

### Task 2: Add `.tmp/` to `.gitignore`

**Why second:** `.tmp/` contains user-submitted text written to disk during generation. It must never be committed.

**Files:**
- Modify: `.gitignore`

**Step 1: Add the entry**

Add `/.tmp/` on a new line after the `# misc` section in `.gitignore`:

```
# runtime temp files
/.tmp/
```

**Step 2: Verify it's ignored**

Run: `touch .tmp/test.json && git status`
Expected: `.tmp/test.json` does NOT appear in untracked files.

Run: `rm .tmp/test.json`

**Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: add .tmp/ to .gitignore to prevent committing user data"
```

---

### Task 3: Add Request Size Limit to API Route

**Why third:** The endpoint is unauthenticated. Without a size cap, any client can POST gigabytes of text, causing disk exhaustion and unbounded LLM token costs.

**Files:**
- Modify: `src/app/api/generate/route.ts`

**Step 1: Add size check before `req.json()`**

Add this block at the top of the `POST` handler, before `const body = await req.json()`:

```typescript
const MAX_BODY_BYTES = 500_000; // 500 KB
const contentLength = req.headers.get('content-length');
if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
  return NextResponse.json({ error: 'Request body too large (max 500KB)' }, { status: 413 });
}
```

**Step 2: Verify manually**

Start dev server: `npm run dev`

Test with a large payload:
```bash
# Generate a ~600KB JSON payload and POST it
python3 -c "
import json, requests
payload = {'sources': [{'title': 'x', 'content': 'a' * 600000}]}
r = requests.post('http://localhost:3000/api/generate', json=payload)
print(r.status_code, r.json())
"
```
Expected: `413 {'error': 'Request body too large (max 500KB)'}`

**Step 3: Commit**

```bash
git add src/app/api/generate/route.ts
git commit -m "fix: add 500KB request size limit to /api/generate"
```

---

### Task 4: Add Subprocess Timeout + Surface Stderr

**Why:** Without a timeout, a hung LLM API call runs forever. Without stderr in the error response, Python crashes produce useless "Unknown tool failure" messages.

**Files:**
- Modify: `src/app/api/generate/route.ts`

**Step 1: Accumulate stderr buffer**

In the `spawn` block, add a `stderrBuffer` variable and append to it on `stderr.on('data')`:

Replace:
```typescript
toolProcess.stderr.on('data', (data) => {
    console.error(`Tool Stderr: ${data}`);
});
```

With:
```typescript
let stderrBuffer = '';
toolProcess.stderr.on('data', (data) => {
  stderrBuffer += data.toString();
  console.error(`Tool Stderr: ${data}`);
});
```

**Step 2: Add 60-second kill timeout**

After `const toolProcess = spawn(...)`, add:

```typescript
const TIMEOUT_MS = 60_000;
const killTimer = setTimeout(() => {
  toolProcess.kill('SIGTERM');
}, TIMEOUT_MS);
```

**Step 3: Clear the timer and use stderrBuffer in close handler**

In the `toolProcess.on('close', ...)` handler, add `clearTimeout(killTimer)` at the top, and update the failure branch to include stderr:

Replace:
```typescript
toolProcess.on('close', async (code) => {
  try {
    let outputData = { error: 'Unknown tool failure' };
    let statusCode = 500;

    if (code === 0) {
```

With:
```typescript
toolProcess.on('close', async (code) => {
  clearTimeout(killTimer);
  try {
    let outputData: { error: string } | Record<string, unknown> = {
      error: code === null ? 'Tool process timed out' : `Tool process failed (exit ${code})${stderrBuffer ? ': ' + stderrBuffer.slice(0, 500) : ''}`
    };
    let statusCode = 500;

    if (code === 0) {
```

**Step 4: Commit**

```bash
git add src/app/api/generate/route.ts
git commit -m "fix: add 60s subprocess timeout and surface stderr in error response"
```

---

### Task 5: Extract Shared Prompt Constant in Python Tool

**Why:** The 12-line prompt is duplicated verbatim in both `generate_with_gemini` and `generate_with_openai`. Any prompt edit must be made twice, guaranteed to drift.

**Files:**
- Modify: `tools/generate_note.py`

**Step 1: Add module-level prompt builder before `generate_with_gemini`**

Insert this function above `def generate_with_gemini`:

```python
def build_prompt(context_text):
    return f"""
    You are a professional academic assistant, similar to NotebookLM.
    Your task is to take the provided raw transcripts, handwritten OCR notes, and textbook excerpts, and synthesize them into a highly organized, professional markdown study guide.

    RULES:
    - Use clear headings (H1, H2, H3), bullet points, and bold text for emphasis.
    - Create a "Summary" section at the top.
    - Create a "Key Concepts" section next.
    - Organize the rest logically based on topics.
    - If the context mentions definitions, emphasize them.
    - DO NOT hallucinate external facts. Base the notes strictly on the provided context.

    CONTEXT RESOURCES TO SYNTHESIZE:
    {context_text}
    """
```

**Step 2: Replace the duplicated prompt in `generate_with_gemini`**

Replace the `prompt = f"""..."""` block in `generate_with_gemini` (lines 10–24) with:

```python
    prompt = build_prompt(context_text)
```

**Step 3: Replace the duplicated prompt in `generate_with_openai`**

Replace the `prompt = f"""..."""` block in `generate_with_openai` (lines 53–67) with:

```python
    prompt = build_prompt(context_text)
```

**Step 4: Verify the tool still works**

```bash
# From repo root with venv active
echo '{"sources":[{"title":"Test","content":"The mitochondria is the powerhouse of the cell."}]}' > .tmp/test_in.json
.venv/bin/python tools/generate_note.py .tmp/test_in.json .tmp/test_out.json
cat .tmp/test_out.json
rm .tmp/test_in.json .tmp/test_out.json
```
Expected: JSON with `"status": "success"` and non-empty `"markdown"`.

**Step 5: Commit**

```bash
git add tools/generate_note.py
git commit -m "refactor: extract build_prompt() to eliminate duplicated prompt in generate_note.py"
```

---

### Task 6: Fix Gemini HTTP Error Handling

**Why:** `response.raise_for_status()` throws a generic `HTTPError`. The actual Gemini error message (e.g. "API key invalid", "quota exceeded") lives in `response.text` and is currently silently discarded.

**Files:**
- Modify: `tools/generate_note.py`

**Step 1: Import `requests.exceptions`**

No new import needed — `requests` is already imported. `requests.exceptions.HTTPError` is accessible as `requests.exceptions.HTTPError`.

**Step 2: Replace `response.raise_for_status()` in `generate_with_gemini`**

Replace:
```python
    response = requests.post(url, json=payload)
    response.raise_for_status()
```

With:
```python
    response = requests.post(url, json=payload)
    if not response.ok:
        raise Exception(f"Gemini API error {response.status_code}: {response.text[:500]}")
```

**Step 3: Do the same in `generate_with_openai`**

Replace:
```python
    response = requests.post(url, headers=headers, json=payload)
    response.raise_for_status()
```

With:
```python
    response = requests.post(url, headers=headers, json=payload)
    if not response.ok:
        raise Exception(f"OpenAI API error {response.status_code}: {response.text[:500]}")
```

**Step 4: Commit**

```bash
git add tools/generate_note.py
git commit -m "fix: surface Gemini/OpenAI API error body in exception message"
```

---

### Task 7: Fix TypeScript `catch (e: any)`

**Why:** `any` disables TypeScript's type system in catch blocks. Use `unknown` with a type guard instead.

**Files:**
- Modify: `src/app/page.tsx` (line 54)
- Modify: `src/app/api/generate/route.ts` (lines 48, 62)

**Step 1: Fix `page.tsx`**

Replace:
```typescript
    } catch (e: any) {
      setError(e.message);
```

With:
```typescript
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
```

**Step 2: Fix `route.ts` inner catch (line ~48)**

Replace:
```typescript
        } catch (e: any) {
          resolve(NextResponse.json({ error: `Failed to read tool output: ${e.message}` }, { status: 500 }));
```

With:
```typescript
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          resolve(NextResponse.json({ error: `Failed to read tool output: ${msg}` }, { status: 500 }));
```

**Step 3: Fix `route.ts` outer catch (line ~62)**

Replace:
```typescript
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
```

With:
```typescript
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 5: Commit**

```bash
git add src/app/page.tsx src/app/api/generate/route.ts
git commit -m "fix: replace catch(e: any) with unknown + type guard in page.tsx and route.ts"
```

---

### Task 8: Cosmetic Fixes (CSS Layer, Package Name, Source Deletion)

**Why:** These are low-risk, high-polish improvements. Group them in one commit since they're all cosmetic.

**Files:**
- Modify: `src/app/globals.css`
- Modify: `package.json`
- Modify: `src/app/page.tsx`

**Step 1: Fix CSS layer in `globals.css`**

Replace:
```css
@layer utilities {
  body {
    font-family: Arial, Helvetica, sans-serif;
  }
}
```

With:
```css
@layer base {
  body {
    font-family: Arial, Helvetica, sans-serif;
  }
}
```

**Step 2: Fix package name in `package.json`**

Replace:
```json
"name": "temp_app",
```

With:
```json
"name": "notetakingapp",
```

**Step 3: Add source deletion to `page.tsx`**

Add a `handleRemoveSource` function after `updateSource`:

```typescript
  const handleRemoveSource = (index: number) => {
    setSources(sources.filter((_, i) => i !== index));
  };
```

In the source card JSX, add a remove button in the top-right corner. Replace the opening `<div key={index} className="flex flex-col...">` block with:

```tsx
            <div key={index} className="flex flex-col gap-3 p-4 bg-neutral-900 rounded-xl border border-neutral-800 shadow-sm focus-within:border-blue-500/50 transition-colors">
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  placeholder={`Source ${index + 1} Title`}
                  value={source.title}
                  onChange={(e) => updateSource(index, "title", e.target.value)}
                  className="bg-transparent border-b border-neutral-800 pb-2 text-sm font-medium focus:outline-none focus:border-blue-500 transition-colors placeholder:text-neutral-600 flex-1"
                />
                {sources.length > 1 && (
                  <button
                    onClick={() => handleRemoveSource(index)}
                    className="ml-3 text-neutral-600 hover:text-red-400 transition-colors text-xs"
                    aria-label="Remove source"
                  >
                    ✕
                  </button>
                )}
              </div>
```

And remove the old standalone `<input>` for the title (it's now inside the flex row above).

**Step 4: Verify UI renders without errors**

Run: `npm run dev`
Open browser to `http://localhost:3000`. Confirm:
- Sources render correctly
- Remove button appears when >1 source exists
- Removing a source works
- Single source has no remove button

**Step 5: Commit**

```bash
git add src/app/globals.css package.json src/app/page.tsx
git commit -m "fix: CSS layer base, package name, add source deletion button"
```

---

## What's Not Covered Here (Separate Effort)

These require architectural decisions beyond quick fixes:

- **Authentication:** Adding Supabase auth to protect `/api/generate` is a full feature. Needs login UI, session management, and middleware. Worth doing before any public deployment.
- **Note persistence:** Saving notes to Supabase requires implementing the `Note` schema from `gemini.md`, plus a save/load UI.
- **Tests:** The app has zero tests. Adding pytest for `generate_note.py` and Jest/Playwright for the frontend is a separate initiative.
