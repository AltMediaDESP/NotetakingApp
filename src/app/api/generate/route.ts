import { NextRequest, NextResponse } from 'next/server';

const MAX_BODY_BYTES = 500_000;

function buildPrompt(contextText: string): string {
  return `You are a professional academic assistant, similar to NotebookLM.
Your task is to take the provided raw transcripts, handwritten OCR notes, and textbook excerpts, and synthesize them into a highly organized, professional markdown study guide.

RULES:
- Use clear headings (H1, H2, H3), bullet points, and bold text for emphasis.
- Create a "Summary" section at the top.
- Create a "Key Concepts" section next.
- Organize the rest logically based on topics.
- If the context mentions definitions, emphasize them.
- DO NOT hallucinate external facts. Base the notes strictly on the provided context.

CONTEXT RESOURCES TO SYNTHESIZE:
${contextText}`;
}

export async function POST(req: NextRequest) {
  try {
    const contentLength = req.headers.get('content-length');
    const length = parseInt(contentLength ?? '', 10);
    if (!isNaN(length) && length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request body too large (max 500KB)' }, { status: 413 });
    }

    const body = await req.json();
    if (Buffer.byteLength(JSON.stringify(body)) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request body too large (max 500KB)' }, { status: 413 });
    }

    const sources = body.sources;
    if (!Array.isArray(sources) || sources.length === 0) {
      return NextResponse.json({ error: 'Valid sources array required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
    }

    const contextText = sources
      .map((s: { title?: string; content?: string }) =>
        `TITLE: ${s.title ?? 'Untitled'}\nCONTENT:\n${s.content ?? ''}`
      )
      .join('\n\n--- DOCUMENT BOUNDARY ---\n\n');

    const prompt = buildPrompt(contextText);

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: {
            parts: [{ text: 'You are an expert Note-taking AI assistant adhering strictly to provided source material.' }],
          },
          generationConfig: { temperature: 0.2 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return NextResponse.json(
        { error: `Gemini API error ${geminiRes.status}: ${errText.slice(0, 500)}` },
        { status: 500 }
      );
    }

    const data = await geminiRes.json();
    const markdown: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!markdown) {
      return NextResponse.json({ error: 'No content returned from Gemini' }, { status: 500 });
    }

    return NextResponse.json({ markdown });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
