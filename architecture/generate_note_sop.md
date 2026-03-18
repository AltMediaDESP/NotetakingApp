# Architecture SOP - NotetakingApp Note Generation

## 1. Layers Overview
- **Layer 1: Architecture (`architecture/`)**
  - All processes and data transformations for Note Generation must adhere to this document.
- **Layer 2: Navigation (Next.js `src/app/api/`)**
  - Receives the request with the specific document IDs or raw text to generate notes from.
  - Formats data and writes inputs to the `.tmp/` directory.
  - Spawns the deterministic Python script in `tools/`.
  - Captures output, reads from `.tmp/`, and delivers the final payload to the client/database.
- **Layer 3: Tools (`tools/generate_note.py`)**
  - The single source of truth for the AI generation prompt and logic.
  - Reads input strictly from a `.tmp/input.json` file.
  - Outputs result strictly to a `.tmp/output.json` file.

## 2. Note Generation Execution Flow
1. Client POSTs to `/api/generate` with `[{title: string, content: string}]`.
2. Navigation Layer creates a UUID for the task.
3. Navigation Layer writes the input JSON to `.tmp/<uuid>_input.json`.
4. Navigation Layer calls `python3 tools/generate_note.py .tmp/<uuid>_input.json .tmp/<uuid>_output.json`.
5. Tool Layer parses the input, executes the API call to Gemini/OpenAI, and formats the response as a markdown note.
6. Tool Layer saves the response to `.tmp/<uuid>_output.json`.
7. Navigation Layer reads the output JSON, deletes both `.tmp/` files (Self-cleaning), and returns the generated note to the frontend.

## 3. Formatting Rules
- The generated Note must be extremely well structured, using Markdown.
- Headings, bold text, bulleted lists, and clear summaries should emulate NotebookLM's professional study guide style.
- No hallucinations: If the context text does not contain the answer, the note must state that.
