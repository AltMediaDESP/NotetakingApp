import sys
import json
import os
import requests
from dotenv import load_dotenv

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

def generate_with_gemini(api_key, context_text):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    
    prompt = build_prompt(context_text)

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "systemInstruction": {
            "parts": [{"text": "You are an expert Note-taking AI assistant adhering strictly to provided source material."}]
        },
        "generationConfig": {
            "temperature": 0.2
        }
    }
    
    response = requests.post(url, json=payload)
    if not response.ok:
        raise Exception(f"Gemini API error {response.status_code}: {response.text[:500]}")
    data = response.json()

    # Extract text from Gemini response structure
    try:
        return data['candidates'][0]['content']['parts'][0]['text']
    except (KeyError, IndexError):
        return "Error tracking the generated response payload."

def generate_with_openai(api_key, context_text):
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    prompt = build_prompt(context_text)

    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": "You are an expert Note-taking AI assistant adhering strictly to provided source material."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2
    }
    
    response = requests.post(url, headers=headers, json=payload)
    if not response.ok:
        raise Exception(f"OpenAI API error {response.status_code}: {response.text[:500]}")
    data = response.json()
    
    try:
        return data['choices'][0]['message']['content']
    except (KeyError, IndexError):
        return "Error tracking the generated response payload."

def main():
    if len(sys.argv) != 3:
        print("Usage: python generate_note.py <input_json_path> <output_json_path>")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    # Load B.L.A.S.T env vars
    load_dotenv(".env.local")
    provider = os.getenv("AI_PROVIDER", "openai").lower()
    
    # Read input payload
    try:
        with open(input_path, 'r') as f:
            input_data = json.load(f)
            
        sources = input_data.get("sources", [])
        if not sources:
            raise ValueError("No 'sources' array found in input payload.")
            
        # Combine all source texts into a massive context block
        context_text = "\n\n--- DOCUMENT BOUNDARY ---\n\n".join(
            [f"TITLE: {s.get('title', 'Untitled')}\nCONTENT:\n{s.get('content', '')}" for s in sources]
        )
            
    except Exception as e:
         with open(output_path, 'w') as f:
             json.dump({"error": str(e)}, f)
         sys.exit(1)

    # Generate Note
    try:
        if provider == "gemini":
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key: raise Exception("GEMINI_API_KEY missing in .env.local")
            result_markdown = generate_with_gemini(api_key, context_text)
        elif provider == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key: raise Exception("OPENAI_API_KEY missing in .env.local")
            result_markdown = generate_with_openai(api_key, context_text)
        else:
            raise Exception(f"Unknown AI_PROVIDER: {provider}")
            
        # Write Output payload
        output_data = {
            "status": "success",
            "provider": provider,
            "markdown": result_markdown
        }
        with open(output_path, 'w') as f:
            json.dump(output_data, f)
            
    except Exception as e:
        with open(output_path, 'w') as f:
            json.dump({"error": str(e)}, f)
        sys.exit(1)

if __name__ == "__main__":
    main()
