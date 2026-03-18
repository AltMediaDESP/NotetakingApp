# Architecture SOP - Link Phase

## Objective
Verify all external API connections (Supabase, OpenAI, Gemini) to ensure valid keys are provided.

## Known Edge Cases & Resolutions
### Gemini API Verification
- **Issue:** Using `generateContent` for simple ping fails or throws 404s depending on exact model naming versions.
- **Resolution:** Use the `/v1beta/models` GET endpoint to verify API key validity before doing completion requests. It's safer and avoids generation-specific 404s.
