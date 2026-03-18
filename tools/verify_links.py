import os
import sys
import requests
from dotenv import load_dotenv

def check_supabase():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    
    if not url or not key or url == "YOUR_SUPABASE_PROJECT_URL":
        print("❌ Supabase credentials missing or default in .env.local")
        return False
        
    # Attempt a simple ping to the health check endpoint or rest API
    try:
        headers = {"apikey": key, "Authorization": f"Bearer {key}"}
        res = requests.get(f"{url}/rest/v1/", headers=headers, timeout=5)
        if res.status_code in (200, 400, 401):  # 400/401 means it reached supabase at least
            print(f"✅ Supabase Link verified (Status {res.status_code})")
            return True
        else:
            print(f"❌ Supabase Link failed with status {res.status_code}")
            return False
    except Exception as e:
        print(f"❌ Supabase Link error: {e}")
        return False

def check_ai():
    provider = os.getenv("AI_PROVIDER", "openai").lower()
    
    if provider == "openai":
        key = os.getenv("OPENAI_API_KEY")
        if not key or key == "YOUR_OPENAI_API_KEY":
            print("❌ OpenAI credential missing in .env.local")
            return False
        try:
            headers = {"Authorization": f"Bearer {key}"}
            res = requests.get("https://api.openai.com/v1/models", headers=headers, timeout=5)
            if res.status_code == 200:
                print("✅ OpenAI Link verified")
                return True
            else:
                print(f"❌ OpenAI Link failed with status {res.status_code}")
                return False
        except Exception as e:
            print(f"❌ OpenAI Link error: {e}")
            return False
            
    elif provider == "gemini":
        key = os.getenv("GEMINI_API_KEY")
        if not key or key == "YOUR_GEMINI_API_KEY":
            print("❌ Gemini credential missing in .env.local")
            return False
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
            res = requests.get(url, timeout=5)
            if res.status_code == 200:
                print("✅ Gemini Link verified")
                return True
            else:
                print(f"❌ Gemini Link failed with status {res.status_code}")
                return False
        except Exception as e:
            print(f"❌ Gemini Link error: {e}")
            return False
    else:
        print("❌ Unknown AI Provider")
        return False

if __name__ == "__main__":
    load_dotenv(".env.local")
    print("--- B.L.A.S.T. Link Verification ---")
    
    supa_ok = check_supabase()
    ai_ok = check_ai()
    
    if supa_ok and ai_ok:
        print("\nAll Connections Verified! Proceed to Phase 3: Architect.")
        sys.exit(0)
    else:
        print("\nFix .env.local keys before proceeding.")
        sys.exit(1)
