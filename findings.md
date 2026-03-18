# 🔍 Findings — NotetakingApp

## Discovery Phase
- **North Star:** An app where users can upload transcripts, hand-typed notes, and textbook text, and have professional-level notes generated (similar to NotebookLM).
- **Integrations:** Next.js App Router, Supabase (for DB/Auth). AI provider TBD (leaning towards Gemini).
- **Source of Truth:** Supabase PostgreSQL Database.
- **Delivery Payload:** Web App.
- **Behavioral Rules:** Requires user accounts, auto-saving notes, and other suggested best practices for a modern web app.

## Research
- **AI Providers:** Both OpenAI and Gemini use standard Pay-As-You-Go API token billing. It does not use the ChatGPT Plus or Gemini Advanced monthly subscription.
- **Recommendation:** Gemini 1.5 Flash/Pro is recommended due to its enormous context window (up to 2M tokens), which is ideal for uploading entire "textbooks" and "transcripts" at once without complex vector chunking.
