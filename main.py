import os
import json
import uuid
import shelve
import requests
import re
from openai import OpenAI
from fastapi import FastAPI, Body, Depends, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from email.message import EmailMessage
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.date import DateTrigger
from dotenv import load_dotenv

# Note: Ensure utils/openai_handler.py is updated to use OpenRouter as discussed previously
from utils.openai_handler import (
    generate_excuse,
    generate_apology,
)

# ============ Environment & Files =============
load_dotenv()

# Updated for OpenRouter
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
HCTI_API_USER    = os.getenv("HCTI_API_USER")
HCTI_API_KEY     = os.getenv("HCTI_API_KEY")
EMAIL_USERNAME   = os.getenv("EMAIL_USERNAME")
EMAIL_PASSWORD   = os.getenv("EMAIL_PASSWORD")
EMAIL_RECIPIENTS = os.getenv("EMAIL_RECIPIENTS")
RESEND_API_KEY   = os.getenv("RESEND_API_KEY")

required = ["OPENROUTER_API_KEY", "HCTI_API_USER", "HCTI_API_KEY"]
if not OPENROUTER_API_KEY:
    print("⚠️ Missing OPENROUTER_API_KEY")

# ============ File Setup =============
EXCUSE_SCORE_FILE = "smart_scores.json"
EXCUSE_CAL_FILE = "excuse_calendar.json"
APOLOGY_SCORE_FILE = "apology_scores.json"
APOLOGY_CAL_FILE = "apology_calendar.json"

for fname in [EXCUSE_SCORE_FILE, APOLOGY_SCORE_FILE]:
    if not os.path.exists(fname):
        with open(fname, "w", encoding="utf-8") as f:
            json.dump({}, f)
for fname in [EXCUSE_CAL_FILE, APOLOGY_CAL_FILE]:
    if not os.path.exists(fname):
        with open(fname, "w", encoding="utf-8") as f:
            json.dump([], f)

# ============ State =============
excuse_history = []
favorite_excuses = []
apology_history = []
favorite_apologies = []
latest_text = ""
latest_label = ""
latest_excuse = None
latest_apology = None

# ========== OpenRouter Client =========
# Handling moved to utils.openai_handler.py
MODEL_NAME = "nvidia/nemotron-nano-12b-v2-vl:free"

# ============ FastAPI & CORS ============
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start scheduler only after Uvicorn forks the main process
    scheduler.start()
    yield
    scheduler.shutdown()

app = FastAPI(lifespan=lifespan)
scheduler = BackgroundScheduler()

# --- CRITICAL: CORS FOR GITHUB PAGES ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "https://aarushch.github.io",  # YOUR GITHUB PAGES URL
        "https://aarushch-intelligent-excuse-generator.hf.space",
        "https://auc6-intelligent-excuse-generator.hf.space"  # YOUR HUGGING FACE URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ Pydantic Models ============
class ExcuseInput(BaseModel):
    scenario: str
    urgency: str
    language: str
    style: str

class ApologyInput(BaseModel):
    context: str
    tone: str
    type: str
    style: str
    language: str = "en"

class DeleteFavoritePayload(BaseModel):
    text: str

class EmergencyInput(BaseModel):
    email: Optional[str] = None

class ScheduleInput(BaseModel):
    date: str
    time: str
    email: Optional[str] = None

class ToneAdjustInput(BaseModel):
    text: str
    tone: str
    language: Optional[str] = "en"

class CompleteApologyInput(BaseModel):
    start: str
    tone: str = "formal"
    language: str = "en"

class SaveApologyText(BaseModel):
    text: str
    time: str

class AutoCompleteInput(BaseModel):
    prompt: str

# ============ HCTI Screenshot Utility ============
def generate_screenshot(type="excuse"):
    content = latest_excuse if type == "excuse" else latest_apology or "No data"
    html = f"""
    <html>
      <body style="font-family: Inter; padding: 2em; background: #fff;">
        <h1>{type.title()}</h1>
        <p>{content}</p>
      </body>
    </html>
    """
    try:
        res = requests.post("https://hcti.io/v1/image", auth=(HCTI_API_USER, HCTI_API_KEY), data={"html": html})
        data = res.json()
        return {"url": data.get("url")}
    except Exception as e:
        print("❌ Screenshot error:", e)
        return {"error": str(e)}

def render_screenshot_html(main_text, label, theme):
    logo_url = "https://aarushch.github.io/Intelligent-Excuse-Generator/static/images/logo.png"
    
    bg_gradient = {
        "light": "linear-gradient(135deg, #fefcea 0%, #f1da36 100%)",
        "dark": "linear-gradient(135deg, #1b263b 0%, #415a77 100%)"
    }.get(theme, "linear-gradient(135deg, #fefcea 0%, #f1da36 100%)")
    text_color = "#fff" if theme == "dark" else "#222"

    html = f"""
    <div style='
        width: 600px; padding: 48px 36px; border-radius: 0; font-family: Inter, Rajdhani, Arial, sans-serif;
        background: {bg_gradient}; box-shadow: 0 10px 40px rgba(0,0,0,0.15); color: {text_color}; position: relative;
    '>
        <div style='font-size: 14px; font-weight: bold; color: {text_color}; margin-bottom: 8px; opacity: 0.8;'>{label} – Intelligent Excuse Generator</div>
        <div style='font-size: 24px; font-weight: 700; line-height: 1.4;'>{main_text}</div>
        <img src="{logo_url}" style="position:absolute;bottom:20px;left:20px;width:50px;opacity:0.85;" />
        <div style='position: absolute; bottom: 18px; right: 24px; font-size: 12px; opacity: 0.6;'>Generated on {datetime.now().strftime('%Y-%m-%d')}</div>
    </div>
    """
    return html

# ============ Main Routes ============

@app.get("/")
def api_root():
    return {
        "status": "online", 
        "message": "Backend is running.", 
        "frontend_url": "https://aarushch.github.io/Intelligent-Excuse-Generator/"
    }

@app.post("/api/excuse")
def generate_excuse_from_openai(payload: ExcuseInput):
    global latest_text, latest_label, latest_excuse
    english, translated = generate_excuse(
        payload.scenario, payload.urgency, payload.language, payload.style
    )
    latest_text = english
    latest_label = "Excuse"
    time_now = datetime.now().strftime("%Y-%m-%d %H:%M")
    excuse_history.append({"text": english, "time": time_now})
    with open("latest_excuse.txt", "w", encoding="utf-8") as f:
        f.write(english)
    
    # Ranking Logic
    with open(EXCUSE_SCORE_FILE, "r+", encoding="utf-8") as f:
        try:
            scores = json.load(f)
        except Exception:
            scores = {}
        entry = scores.get(english, {"count": 0, "urgency_score": 0, "favorited": False})
        entry["count"] += 1
        if payload.urgency == "high": entry["urgency_score"] += 2
        elif payload.urgency == "critical": entry["urgency_score"] += 4
        elif payload.urgency == "medium": entry["urgency_score"] += 1
        scores[english] = entry
        f.seek(0); f.truncate(); json.dump(scores, f, indent=2, ensure_ascii=False)
    
    # Calendar Logic
    now = datetime.now()
    entry = {"text": english, "date": now.strftime("%Y-%m-%d"), "time": now.strftime("%I:%M:%S %p")}
    with open(EXCUSE_CAL_FILE, "r+", encoding="utf-8") as f:
        try:
            data = json.load(f)
            if not isinstance(data, list): data = []
        except Exception:
            data = []
        data.append(entry)
        f.seek(0); f.truncate(); json.dump(data, f, indent=2)
    latest_excuse = english
    return {"label": "Excuse", "english": english, "translated": translated}

@app.post("/api/apology")
def create_apology(payload: ApologyInput):
    global latest_text, latest_label, latest_apology
    english, translated = generate_apology(payload.context, payload.tone, payload.type, payload.style, payload.language)
    latest_text = english
    latest_label = "Apology"
    latest_apology = english
    with open("latest_apology.txt", "w", encoding="utf-8") as f:
        f.write(english)
    apology_history.append({"text": english, "time": datetime.now().strftime("%Y-%m-%d %H:%M")})
    
    # Scoring Logic
    with open(APOLOGY_SCORE_FILE, "r+", encoding="utf-8") as f:
        try:
            scores = json.load(f)
        except Exception:
            scores = {}
        entry = scores.get(english, {"count": 0})
        entry["count"] += 1
        scores[english] = entry
        f.seek(0); f.truncate(); json.dump(scores, f, indent=2, ensure_ascii=False)
    
    # Calendar Logic
    now = datetime.now()
    cal_entry = {"text": english, "date": now.strftime("%Y-%m-%d"), "time": now.strftime("%I:%M %p")}
    with open(APOLOGY_CAL_FILE, "r+", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except:
            data = []
        data.append(cal_entry)
        f.seek(0); f.truncate(); json.dump(data, f, indent=2)
    return {"message": english, "translated": translated}

@app.get("/api/history")
def api_excuse_history():
    return {"history": excuse_history}

@app.get("/api/calendar")
def api_excuse_calendar():
    try:
        with open(EXCUSE_CAL_FILE, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return []

@app.get("/api/screenshot", response_class=FileResponse)
def download_screenshot():
    # Note: On Render, this file is ephemeral (will disappear on redeploy)
    # But it is fine for temporary downloads immediately after generation
    file_path = "static/screenshot.png"
    if not os.path.exists("static"):
        os.makedirs("static")
    return FileResponse(path=file_path, media_type="image/png", filename="excuse.png", headers={"Access-Control-Allow-Origin": "*"})

@app.get("/api/favorites")
def api_excuse_favorites():
    return {"favorites": favorite_excuses}

@app.post("/api/favorite")
def api_add_excuse_fav():
    global latest_text, latest_label
    if not latest_text or latest_label != "Excuse": return {"action": "error", "message": "⚠️ No excuse to save."}
    
    if latest_text in favorite_excuses:
        favorite_excuses.remove(latest_text)
        try:
            with open(EXCUSE_SCORE_FILE, "r+", encoding="utf-8") as fh:
                scores = json.load(fh)
                if latest_text in scores:
                    scores[latest_text]["favorited"] = False
                fh.seek(0); fh.truncate(); json.dump(scores, fh, indent=2)
        except Exception: pass
        return {"action": "removed", "message": "🗑️ Unfavorited!"}
        
    favorite_excuses.append(latest_text)
    try:
        with open(EXCUSE_SCORE_FILE, "r+", encoding="utf-8") as fh:
            try: scores = json.load(fh)
            except: scores = {}
            scores.setdefault(latest_text, {"count": 0, "urgency_score": 0})
            scores[latest_text]["favorited"] = True
            fh.seek(0); fh.truncate(); json.dump(scores, fh, indent=2)
    except Exception:
        pass
    return {"action": "added", "message": "✅ Saved!"}

@app.delete("/api/favorite")
def api_remove_excuse_fav(payload: DeleteFavoritePayload):
    text = payload.text
    if text in favorite_excuses:
        favorite_excuses.remove(text)
        try:
            with open(EXCUSE_SCORE_FILE, "r+", encoding="utf-8") as fh:
                scores = json.load(fh)
                if text in scores:
                    scores[text]["favorited"] = False
                fh.seek(0); fh.truncate(); json.dump(scores, fh, indent=2)
        except Exception:
            pass
        return {"message": "🗑️ Removed from favorites"}
    return {"message": "Item not found in favorites."}

@app.post("/api/clear-favorites")
def api_clear_favorites():
    favorite_excuses.clear()
    try:
        with open(EXCUSE_SCORE_FILE, "r+", encoding="utf-8") as fh:
            scores = json.load(fh)
            for k in scores: scores[k]["favorited"] = False
            fh.seek(0); fh.truncate(); json.dump(scores, fh, indent=2)
    except Exception: pass
    return {"status": "cleared"}

def trigger_emergency_internal(recipient_override: dict | None = None):
    excuse  = open("latest_excuse.txt", "r", encoding="utf-8").read().strip() if os.path.exists("latest_excuse.txt") else "No excuse."
    apology = open("latest_apology.txt", "r", encoding="utf-8").read().strip() if os.path.exists("latest_apology.txt") else "No apology."
    EMAIL_SENDER     = os.getenv("EMAIL_USERNAME")
    EMAIL_PASSWORD   = os.getenv("EMAIL_PASSWORD")
    default_list = [r.strip() for r in os.getenv("EMAIL_RECIPIENTS", "").split(",") if r.strip()]
    input_list = []
    if recipient_override and recipient_override.get("email"):
        input_str = recipient_override["email"]
        input_list = [r.strip() for r in input_str.split(",") if r.strip()]
    recipients = input_list if input_list else default_list
    if not recipients: recipients = [EMAIL_SENDER]
    
    def send_email():
        uid   = uuid.uuid4().hex[:8]
        stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        msg = EmailMessage()
        msg["Subject"] = f"🚨 Emergency Alert [{stamp}] – ID:{uid}"
        msg["From"] = EMAIL_SENDER
        msg["To"] = ", ".join(recipients)
        msg.set_content(f"📝 Excuse:\n{excuse}\n\n🙏 Apology:\n{apology}")
        # Note: Local file attachment might fail if screenshot wasn't generated recently on this specific server instance
        # We skip attachment logic if file missing to prevent crash
        shot = "static/screenshot.png"
        if os.path.exists(shot):
            with open(shot, "rb") as fh:
                msg.add_attachment(fh.read(), maintype="image", subtype="png", filename="proof.png")
        try:
            # Bypass SMTP firewalls on HF using an HTTP REST API provider if Key exists
            if RESEND_API_KEY:
                import base64
                import requests
                headers = {"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"}
                payload = {
                    "from": "Emergency Alerts <onboarding@resend.dev>",
                    "to": recipients,
                    "subject": msg["Subject"],
                    "text": f"📝 Excuse:\n{excuse}\n\n🙏 Apology:\n{apology}"
                }
                if os.path.exists(shot):
                    with open(shot, "rb") as fh:
                        b64_img = base64.b64encode(fh.read()).decode("utf-8")
                        payload["attachments"] = [{"filename": "proof.png", "content": b64_img}]
                        
                rsp = requests.post("https://api.resend.com/emails", headers=headers, json=payload, timeout=10)
                if rsp.status_code >= 400:
                    print(f"❌ Resend API Error ({rsp.status_code}):", rsp.text)
                else:
                    print("✅ Email sent successfully via Resend API!")
                return
                
            # If no API key, fallback to standard SMTP
            import smtplib
            try:
                with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=5) as smtp:
                    smtp.login(EMAIL_SENDER, EMAIL_PASSWORD)
                    smtp.send_message(msg)
            except OSError:
                with smtplib.SMTP("smtp.gmail.com", 587, timeout=5) as smtp:
                    smtp.starttls()
                    smtp.login(EMAIL_SENDER, EMAIL_PASSWORD)
                    smtp.send_message(msg)
                    
        except Exception as e:
            err = str(e)
            if "Network is unreachable" in err or "101" in err:
                print("⚠️ Email skipped: Network blocks standard SMTP outgoing ports on this host.")
            else:
                print("❌ Email error:", e)
            
    def play_siren():
        import platform
        if platform.system() == "Linux" or os.environ.get('DISABLE_AUDIO'):
            print("⚠️ Audio disabled on Linux server to prevent libgthread warnings.")
            return

        try:
            import pygame
            # Suppress prompt output by capturing it
            pygame.mixer.init()
            # Path must be relative or absolute. static/alert.mp3 needs to exist in repo
            if os.path.exists("static/alert.mp3"):
                pygame.mixer.music.load("static/alert.mp3")
                pygame.mixer.music.set_volume(1.0)
                pygame.mixer.music.play()
        except ImportError:
            print("⚠️ pygame not installed. Siren disabled.")
        except Exception as e:
            print("❌ Sound error:", e)
            
    def log_event():
        entry = {"timestamp": str(datetime.now()), "excuse": excuse, "apology": apology, "recipients": recipients}
        try:
            logf = "emergency_log.json"
            data = json.load(open(logf, "r", encoding="utf-8")) if os.path.exists(logf) else []
            data.append(entry)
            json.dump(data, open(logf, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
        except Exception as e:
            print("❌ Logging error:", e)
            
    import threading
    threading.Thread(target=send_email).start()
    threading.Thread(target=play_siren).start()
    threading.Thread(target=log_event).start()

@app.post("/api/emergency")
def api_trigger_emergency(payload: EmergencyInput):
    trigger_emergency_internal(payload.model_dump())
    return {"status": "ok"}

@app.get("/api/apology-history")
def api_apology_history():
    return {"history": apology_history}

@app.post("/api/save-apology-history")
def save_apology_history(payload: SaveApologyText):
    global latest_text, latest_label
    latest_text = payload.text
    latest_label = "Apology"
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    if not any(i["text"] == payload.text for i in apology_history):
        apology_history.append({"text": payload.text, "time": now})
    cal_entry = {"text": payload.text, "date": datetime.now().strftime("%Y-%m-%d"), "time": datetime.now().strftime("%I:%M %p")}
    with open(APOLOGY_CAL_FILE, "r+", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except:
            data = []
        data.append(cal_entry)
        f.seek(0); f.truncate(); json.dump(data, f, indent=2)
    return {"message": "✅ Apology saved to history and calendar."}

@app.get("/api/apology-calendar")
def api_apology_calendar():
    try:
        with open(APOLOGY_CAL_FILE, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return []

@app.post("/api/apology-favorite")
def api_save_apology_fav():
    global latest_text, latest_label
    if not latest_text or latest_label != "Apology": return {"action": "error", "message": "⚠️ No apology to save."}
    
    if latest_text in favorite_apologies:
        favorite_apologies.remove(latest_text)
        try:
            with open(APOLOGY_SCORE_FILE, "r+", encoding="utf-8") as fh:
                scores = json.load(fh)
                if latest_text in scores: scores[latest_text]["favorited"] = False
                fh.seek(0); fh.truncate(); json.dump(scores, fh, indent=2)
        except Exception: pass
        return {"action": "removed", "message": "🗑️ Unfavorited!"}
        
    favorite_apologies.append(latest_text)
    try:
        with open(APOLOGY_SCORE_FILE, "r+", encoding="utf-8") as fh:
            try: scores = json.load(fh)
            except: scores = {}
            scores.setdefault(latest_text, {"count": 0, "favorited": False})
            scores[latest_text]["favorited"] = True
            fh.seek(0); fh.truncate(); json.dump(scores, fh, indent=2)
    except Exception as e:
        pass
    return {"action": "added", "message": "✅ Saved!"}

@app.delete("/api/apology-favorite")
def api_remove_apology_fav(payload: DeleteFavoritePayload):
    text = payload.text
    if text in favorite_apologies:
        favorite_apologies.remove(text)
        try:
            with open(APOLOGY_SCORE_FILE, "r+", encoding="utf-8") as fh:
                scores = json.load(fh)
                if text in scores:
                    scores[text]["favorited"] = False
                fh.seek(0); fh.truncate(); json.dump(scores, fh, indent=2)
        except Exception:
            pass
        return {"message": "🗑️ Removed from favorites"}
    return {"message": "Item not found in favorites."}

@app.post("/api/clear-apology-favorites")
def api_clear_apology_favorites():
    favorite_apologies.clear()
    try:
        with open(APOLOGY_SCORE_FILE, "r+", encoding="utf-8") as fh:
            scores = json.load(fh)
            for k in scores: scores[k]["favorited"] = False
            fh.seek(0); fh.truncate(); json.dump(scores, fh, indent=2)
    except Exception: pass
    return {"status": "cleared"}

@app.get("/api/apology-favorites")
def api_get_apology_favorites():
    return {"favorites": favorite_apologies}

@app.get("/api/top-apologies")
def api_top_apologies():
    try:
        data = json.load(open(APOLOGY_SCORE_FILE, encoding="utf-8"))
    except Exception:
        data = {}
    ranked = []
    for txt, meta in data.items():
        usage_count = meta.get("count", 0)
        tone_bonus = 0
        text_lower = txt.lower()
        if any(word in text_lower for word in ["deeply", "sincerely", "truly", "heartfelt"]): tone_bonus += 2
        if any(word in text_lower for word in ["sorry", "apologize", "regret", "mistake"]): tone_bonus += 1
        length_bonus = min(len(txt) // 100, 3)
        favorite_bonus = 2 if meta.get("favorited", False) else 0
        recency_bonus = 1 if usage_count > 0 else 0
        final_score = usage_count + tone_bonus + length_bonus + favorite_bonus + recency_bonus
        ranked.append({
            "text": txt, "score": final_score, "count": usage_count,
            "favorited": meta.get("favorited", False),
            "breakdown": {"usage": usage_count, "tone": tone_bonus, "length": length_bonus, "favorite": favorite_bonus, "recency": recency_bonus}
        })
    ranked.sort(key=lambda x: (x["score"], x["count"]), reverse=True)
    return ranked

@app.post("/api/clear-apology-rankings")
def api_clear_apology_rankings():
    json.dump({}, open(APOLOGY_SCORE_FILE, "w", encoding="utf-8"))
    return {"message": "Top apologies cleared."}

@app.get("/api/rankings")
def api_excuse_rankings():
    try:
        data = json.load(open(EXCUSE_SCORE_FILE, encoding="utf-8"))
    except Exception:
        return []
    ranked = [
        {"text": txt, "score": info.get("count", 0) + info.get("urgency_score", 0) + (3 if info.get("favorited") else 0), "count": info.get("count", 0)}
        for txt, info in data.items()
    ]
    ranked.sort(key=lambda x: x["score"], reverse=True)
    return ranked

@app.post("/api/clear-rankings")
def api_clear_excuse_rankings():
    json.dump({}, open(EXCUSE_SCORE_FILE, "w", encoding="utf-8"))
    return {"message": "Smart rankings cleared."}

@app.post("/api/screenshot-excuse")
def screenshot_excuse(payload: dict = Body(None)):
    try:
        if not latest_excuse: return {"error": "No excuse available to screenshot."}
        theme = payload.get("theme", "light") if payload else "light"
        html = render_screenshot_html(latest_excuse, "Excuse", theme)
        res = requests.post("https://hcti.io/v1/image", data={'html': html, 'css': '', 'google_fonts': 'Inter:700;Rajdhani:700'}, auth=(HCTI_API_USER, HCTI_API_KEY))
        link = res.json().get("url", "")
        return {"url": link}
    except Exception as e:
        print("❌ Screenshot Excuse Error:", e)
        return {"error": str(e)}

@app.post("/api/screenshot-apology")
def screenshot_apology(payload: dict = Body(None)):
    try:
        if not latest_apology: return {"error": "No apology available to screenshot."}
        theme = payload.get("theme", "light") if payload else "light"
        html = render_screenshot_html(latest_apology, "Apology", theme)
        res = requests.post("https://hcti.io/v1/image", data={'html': html, 'css': '', 'google_fonts': 'Inter:700;Rajdhani:700'}, auth=(HCTI_API_USER, HCTI_API_KEY))
        link = res.json().get("url", "")
        return {"url": link}
    except Exception as e:
        print("❌ Screenshot Apology Error:", e)
        return {"error": str(e)}

# ============ UPDATED OPENROUTER ENDPOINTS ============

@app.post("/api/adjust-tone")
def adjust_tone(payload: dict = Body(...)):
    sentence = payload.get("sentence", "")
    tone = payload.get("tone", "formal")
    if not sentence: return {"error": "No sentence provided"}
    
    prompt = f"Rephrase the following text in a {tone.lower()} tone:\n\n{sentence}\n\nDo not add any extra commentary, timestamps, or headings."
    
    try:
        # Import the secure client
        import utils.openai_handler as openai_handler
        client = openai_handler.client
        MODEL_NAME = openai_handler.MODEL_NAME
        
        # Using OpenRouter + Nemotron with Reasoning
        res = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            extra_body={"reasoning": {"enabled": True}}
        )
        return {
            "adjusted": res.choices[0].message.content.strip(),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    except Exception as e:
        return {"error": str(e)}
    
@app.post("/api/complete-apology")
def complete_apology(payload: dict = Body(...)):
    import re
    start = payload.get("start", "").strip()
    tone = payload.get("tone", "formal").strip()
    if not start: return {"error": "No start provided"}
    
    prompt = f"Complete this sentence in a {tone.lower()} apology tone:\n\n{start}\n\nCRITICAL: Return ONLY the completion text itself. Do not include quotes, conversational filler, or explanations of why it works."
    
    try:
        # Import the secure client
        import utils.openai_handler as openai_handler
        client = openai_handler.client
        MODEL_NAME = openai_handler.MODEL_NAME
        
        # Using OpenRouter + Nemotron with Reasoning
        res = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            extra_body={"reasoning": {"enabled": True}}
        )
        # 1) Import strip_reasoning and clean_llm_text to clean the output BEFORE treating it as logic
        strip_reasoning = openai_handler.strip_reasoning
        clean_llm_text = openai_handler.clean_llm_text
        continuation = clean_llm_text(strip_reasoning(res.choices[0].message.content))
        
        # Helper to avoid doubling up words
        def normalize(text): return re.sub(r'[^\w\s]', '', text).lower().strip()
        norm_start = normalize(start)
        norm_cont = normalize(continuation)
        
        if norm_cont.startswith(norm_start):
            lower_cont = continuation.lower()
            lower_start = start.lower()
            if lower_cont.startswith(lower_start):
                trimmed = continuation[len(start):].lstrip(" ,.:;\n")
                full_apology = f"{start} {trimmed}"
            else:
                full_apology = continuation
        else:
            full_apology = f"{continuation}"
            
        return {"completed": full_apology}
    except Exception as e:
        return {"error": str(e)}

guilt_cache = {}

@app.post("/api/guilt-score")
def api_guilt_score(payload: dict = Body(...)):
    text = payload.get("text", "")
    if text in guilt_cache:
        return {"feedback": guilt_cache[text]}
        
    rubric = (
        "Calibrate on this rubric:\n"
        "  1‑20  : clearly insincere / no guilt\n"
        "  21‑40 : weak apology / low guilt\n"
        "  41‑60 : neutral / average guilt\n"
        "  61‑80 : sincere but not extreme\n"
        "  81‑100: very strong guilt / deeply sorry\n\n"
    )
    prompt = (
        f"{rubric}"
        "You must answer in **exactly** this JSON format:\n"
        '{ "score": <number>, "reason": "<≤25‑word explanation>" }\n\n'
        "Apology text:\n"
        f"{text}\n"
        "----\nNow respond:"
    )
    try:
        # Import the secure client
        import utils.openai_handler as openai_handler
        client = openai_handler.client
        MODEL_NAME = openai_handler.MODEL_NAME
        
        # Using OpenRouter + Nemotron with Reasoning
        res = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": prompt}],
            temperature=1.0,
            top_p=0.95,
            extra_body={"reasoning": {"enabled": True}}
        )
        # Import strip_reasoning to strip <think> tokens before doing regex or JSON parsing
        strip_reasoning = openai_handler.strip_reasoning
        raw = strip_reasoning(res.choices[0].message.content)
        
        import re
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            # Fallback regex if reasoning text bleeds into content
            m = re.search(r'"score"\s*:\s*(\d+).*"reason"\s*:\s*"([^"]+)', raw, re.S)
            if not m: return {"error": "Bad format from model", "raw": raw}
            data = {"score": int(m.group(1)), "reason": m.group(2)}
            
        feedback = f'{data["score"]}/100 – {data["reason"]}'
        guilt_cache[text] = feedback
        return {"feedback": feedback}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/memory")
def api_memory_lookup(q: str):
    q = q.strip().lower()
    hits = []
    try:
        with shelve.open("memory.db") as memory_db:
            for kw, excuses in memory_db.items():
                if q in kw: hits.extend(excuses)
    except Exception as e:
        return {"error": f"Memory DB access failed: {str(e)}"}
    return {"matches": list(dict.fromkeys(hits))[:5]}

@app.post("/api/schedule")
def schedule_emergency(input: ScheduleInput):
    try:
        dt = datetime.strptime(f"{input.date} {input.time}", "%Y-%m-%d %H:%M")
        if dt <= datetime.now(): raise ValueError("Scheduled time must be in the future")
        job_id = uuid.uuid4().hex[:8]
        scheduler.add_job(
            func=trigger_emergency_internal,
            trigger=DateTrigger(run_date=dt),
            args=[{"email": input.email}] if input.email else [],
            id=job_id,
            replace_existing=True
        )
        return {"message": f"📅 Emergency scheduled for {dt.strftime('%Y-%m-%d %H:%M')}!"}
    except Exception as e:
        return {"error": f"❌ Scheduling failed: {str(e)}"}

def fallback_calendar_sync():
    global latest_text, latest_label
    if not latest_text: return
    target = EXCUSE_CAL_FILE if latest_label == "Excuse" else APOLOGY_CAL_FILE
    now = datetime.now()
    entry = {"text": latest_text, "date": now.strftime("%Y-%m-%d"), "time": now.strftime("%I:%M %p")}
    if not os.path.exists(target):
        json.dump([entry], open(target, "w", encoding="utf-8"), indent=2)
        return
    data = json.load(open(target, encoding="utf-8"))
    if all(e["text"] != latest_text for e in data):
        data.append(entry)
        json.dump(data, open(target, "w", encoding="utf-8"), indent=2)

scheduler.add_job(fallback_calendar_sync, "interval", minutes=30, id="fallback", replace_existing=True)

security = HTTPBasic()
def verify_admin(credentials: HTTPBasicCredentials = Depends(security)):
    if credentials.username != "admin" or credentials.password != "yourpassword":
        raise HTTPException(status_code=401, detail="Unauthorized")
    return credentials.username

@app.get("/admin", response_class=JSONResponse)
def admin_panel(request: Request):
    logs = json.load(open("emergency_log.json", encoding="utf-8")) if os.path.exists("emergency_log.json") else []
    return {"logs": logs}

@app.post("/api/update-latest-apology")
def update_latest_apology(payload: dict = Body(...)):
    global latest_text, latest_label
    apology_text = payload.get("text", "")
    if apology_text:
        latest_text = apology_text
        latest_label = "Apology"
        now = datetime.now()
        cal_entry = {"text": apology_text, "date": now.strftime("%Y-%m-%d"), "time": now.strftime("%I:%M %p")}
        try:
            with open(APOLOGY_CAL_FILE, "r+", encoding="utf-8") as f:
                data = json.load(f)
                data.append(cal_entry)
                f.seek(0); f.truncate(); json.dump(data, f, indent=2)
        except Exception:
            with open(APOLOGY_CAL_FILE, "w", encoding="utf-8") as f:
                json.dump([cal_entry], f, indent=2)
    return {"message": "Latest apology updated successfully"}

@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"👉 {request.method} {request.url.path}")
    return await call_next(request)

"""
MIT License

Copyright (c) 2025 Ch Aarush Udbhav

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies
or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
"""