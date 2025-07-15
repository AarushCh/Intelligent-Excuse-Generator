import datetime
import pygame
import threading
import smtplib
import os
import json
import uuid
import shelve
import atexit
import openai
from openai import OpenAI
from collections import defaultdict
from email.message import EmailMessage
from datetime import datetime
from utils.openai_handler import generate_excuse, generate_apology
from fastapi import Body
from utils.screenshot import generate_screenshot
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.date import DateTrigger
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(r"/unused/.env")
load_dotenv(dotenv_path=env_path)

apology_history: list[dict] = []
favorite_apologies: list[str] = []

openai.api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI()

APOLOGY_SCORE_FILE = "apology_scores.json"
if not os.path.exists(APOLOGY_SCORE_FILE):
    with open(APOLOGY_SCORE_FILE, "w", encoding="utf-8") as f:
        json.dump({}, f)


scheduler = BackgroundScheduler()
scheduler.start()

app = FastAPI()

memory_db = shelve.open("memory.db", writeback=True)

excuse_ranking = defaultdict(int)

latest_text = ""
latest_label = ""
excuse_history = []
favorite_excuses = []
favorite_apologies = []
apology_history      = []
apology_favorites    = []

APOL_CAL_FILE        = "apology_calendar.json"
APOL_SCORE_FILE      = "apology_scores.json"
if not os.path.exists(APOL_SCORE_FILE):
    with open(APOL_SCORE_FILE, "w", encoding="utf-8") as f:
        json.dump({}, f)

# Static + Templates Setup
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MODELS
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
    language: str

class EmergencyInput(BaseModel):
    email: str | None = None

class ScheduleInput(BaseModel):
    date: str
    time: str
    email: str | None = None

class SaveApologyText(BaseModel):
    text: str
    time: str

# ROUTES
@app.get("/", response_class=HTMLResponse)
def serve_ui(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/api/excuse")
def get_excuse(request: ExcuseInput):
    global latest_text, latest_label
    english, translated = generate_excuse(request.scenario, request.urgency, request.language)
    latest_text = english
    latest_label = "Excuse"
    excuse_history.append({
        "text": english,
        "time": datetime.now().strftime("%Y-%m-%d %H:%M")
    })

    with open("latest_excuse.txt", "w", encoding="utf-8") as f:
        f.write(english)

    ranking_file = "smart_scores.json"
    if not os.path.exists(ranking_file):
        with open(ranking_file, "w", encoding="utf-8") as f:
            json.dump({}, f)


    with open("smart_scores.json", "r+", encoding="utf-8") as f:
        try:
            scores = json.load(f)
        except:
            scores = {}

        entry = scores.get(english, {
            "count": 0,
            "urgency_score": 0,
            "favorited": False
        })

        entry["count"] += 1

        if request.urgency == "high":
            entry["urgency_score"] += 2
        elif request.urgency == "critical":
            entry["urgency_score"] += 4
        elif request.urgency == "medium":
            entry["urgency_score"] += 1

        scores[english] = entry

        f.seek(0)
        f.truncate()
        json.dump(scores, f, indent=2, ensure_ascii=False)

    # Save to calendar
    now = datetime.now()
    entry = {
        "text": english,
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%I:%M:%S %p")
    }
    calendar_file = "excuse_calendar.json"
    if not os.path.exists(calendar_file):
        with open(calendar_file, "w", encoding="utf-8") as f:
            json.dump([], f)

    with open(calendar_file, "r+", encoding="utf-8") as f:
        try:
            data = json.load(f)
            if not isinstance(data, list):
                data = []
        except:
            data = []

        data.append(entry)
        f.seek(0)
        f.truncate()
        json.dump(data, f, indent=2)


    return {"english": english, "translated": translated}

# ───── APOLOGY ENDPOINT ────────────────────────────────────────────────────
@app.post("/api/apology")
def create_apology(payload: ApologyInput):
    """
    • Accepts a JSON body that matches `ApologyInput`
    • Calls generate_apology()
    • Logs history and smart-score to disk
    • Returns {"message": ..., "translated": ...}
    """

    # ---------- 1. Generate Apology Text --------------------------------------
    english, translated = generate_apology(
        payload.context,
        payload.tone,
        payload.type,       # frontend sends `type`
        payload.style,
        payload.language
    )

    # ---------- 2. Update Globals + History -----------------------------------
    global latest_text, latest_label
    latest_text  = english
    with open("latest_apology.txt", "w", encoding="utf-8") as f:
        f.write(english)

    latest_label = "Apology"

    # Append to in-memory history list (make sure it's defined at top of file)
    apology_history.append({
        "text": english,
        "time": datetime.now().strftime("%Y-%m-%d %H:%M")
    })

    # ---------- 3. Smart‑Ranking Counter --------------------------------------
    APOL_SCORE_FILE = "apology_scores.json"
    dirpath = os.path.dirname(APOL_SCORE_FILE)
    if dirpath:
        os.makedirs(dirpath, exist_ok=True)

    if not os.path.exists(APOL_SCORE_FILE):
        with open(APOL_SCORE_FILE, "w", encoding="utf-8") as f:
            json.dump({}, f)

    with open(APOL_SCORE_FILE, "r+", encoding="utf-8") as f:
        try:
            scores = json.load(f)
        except json.JSONDecodeError:
            scores = {}

        entry = scores.get(english, {"count": 0})
        entry["count"] += 1
        scores[english] = entry

        f.seek(0)
        f.truncate()
        json.dump(scores, f, indent=2, ensure_ascii=False)

    now = datetime.now()
    cal_entry = {"text": english,
                "date": now.strftime("%Y-%m-%d"),
                "time": now.strftime("%I:%M %p")}
    if not os.path.exists(APOL_CAL_FILE):
        with open(APOL_CAL_FILE, "w",  encoding="utf-8") as f:
            json.dump([], f)

    with open(APOL_CAL_FILE, "r+", encoding="utf-8") as f:
        data = json.load(f)
        data.append(cal_entry)
        f.seek(0); f.truncate(); json.dump(data, f, indent=2)
    # ---------- 4. Return JSON Response ---------------------------------------
    return {"message": english, "translated": translated}
# ──────────────────────────────────────────────────────────────────────────────


# ── CALENDAR SAVE ─────────────────────────────────
    

# ── IN‑MEMORY HISTORY ─────────────────────────────
    

# ────────────────────────── PROOF & SCREENSHOT ───────────────────────────────
@app.get("/proof", response_class=HTMLResponse)
def show_proof(request: Request):
    """Mini‑page that shows the last excuse / apology for the ‘proof’ link."""
    return templates.TemplateResponse(
        "proof.html",
        {"request": request, "message": latest_text, "label": latest_label}
    )

@app.post("/api/screenshot")
def api_screenshot():
    path = generate_screenshot()
    if path and os.path.exists(path):
        return FileResponse(path, media_type="image/png", filename="proof.png")
    return {"url": "null"}

# ──────────────────────────── EXCUSE DATA ROUTES ─────────────────────────────
@app.get("/api/history")
def api_excuse_history():
    return {"history": excuse_history}

@app.get("/api/calendar")
def api_excuse_calendar():
    try:
        with open("excuse_calendar.json", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return []

@app.get("/api/favorites")
def api_excuse_favorites():
    return {"favorites": favorite_excuses}

@app.post("/api/favorite")
def api_add_excuse_fav():
    """Save the last excuse to favourites + mark in smart_scores."""
    if not latest_text or latest_label != "Excuse":
        return {"message": "⚠️ Already in favourites or nothing to add."}

    if latest_text in favorite_excuses:
        return {"message": "⚠️ Already in favourites or nothing to add."}

    favorite_excuses.append(latest_text)

    try:
        with open("smart_scores.json", "r+", encoding="utf-8") as fh:
            scores = json.load(fh)
            scores.setdefault(latest_text, {}).update({"favorited": True})
            fh.seek(0); fh.truncate(); json.dump(scores, fh, indent=2)
    except Exception:
        pass

    return {"message": "✅ Excuse added to favourites!"}

# ─────────────────────────── EMERGENCY DISPATCHER ────────────────────────────
def trigger_emergency_internal(recipient_override: dict | None = None):
    """
    • Reads latest excuse + apology
    • Sends alert e‑mail
    • Plays siren + logs
    """
    excuse  = open("latest_excuse.txt", "r", encoding="utf-8").read().strip()  \
                 if os.path.exists("latest_excuse.txt")  else "No excuse."
    apology = open("latest_apology.txt", "r", encoding="utf-8").read().strip() \
                 if os.path.exists("latest_apology.txt") else "No apology."

    EMAIL_SENDER      = os.getenv("EMAIL_USERNAME")
    EMAIL_PASSWORD    = os.getenv("EMAIL_PASSWORD")
    DEFAULT_RECIPS    = [r.strip() for r in os.getenv("EMAIL_RECIPIENTS", "").split(",") if r.strip()]
    recipients        = [recipient_override["email"]] if (isinstance(recipient_override, dict)
                                                          and recipient_override.get("email")) else DEFAULT_RECIPS
    if not recipients:
        recipients = [EMAIL_SENDER]

    # ---------- e‑mail --------------------------------------------------------
    def send_email():
        uid   = uuid.uuid4().hex[:8]
        stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        msg             = EmailMessage()
        msg["Subject"]  = f"🚨 Emergency Alert [{stamp}] – ID:{uid}"
        msg["From"]     = EMAIL_SENDER
        msg["To"]       = ", ".join(recipients)
        msg.set_content(f"📝 Excuse:\n{excuse}\n\n🙏 Apology:\n{apology}")

        shot = "static/screenshot.png"
        if os.path.exists(shot):
            with open(shot, "rb") as fh:
                msg.add_attachment(fh.read(), maintype="image", subtype="png", filename="proof.png")

        try:
            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
                smtp.login(EMAIL_SENDER, EMAIL_PASSWORD)
                smtp.send_message(msg)
            print("✅ Emergency email sent.")
        except Exception as e:
            print("❌ Email error:", e)

    # ---------- siren ---------------------------------------------------------
    def play_siren():
        try:
            pygame.mixer.init()
            pygame.mixer.music.load("static/alert.mp3")
            pygame.mixer.music.set_volume(1.0)
            pygame.mixer.music.play()
        except Exception as e:
            print("❌ Sound error:", e)

    # ---------- log -----------------------------------------------------------
    def log_event():
        entry = {
            "timestamp": str(datetime.now()),
            "excuse": excuse,
            "apology": apology,
            "recipients": recipients
        }
        try:
            logf = "emergency_log.json"
            data = json.load(open(logf, "r", encoding="utf-8")) if os.path.exists(logf) else []
            data.append(entry)
            json.dump(data, open(logf, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
        except Exception as e:
            print("❌ Logging error:", e)

    threading.Thread(target=send_email).start()
    threading.Thread(target=play_siren).start()
    threading.Thread(target=log_event).start()

@app.post("/api/emergency")
def api_trigger_emergency(payload: EmergencyInput):
    trigger_emergency_internal(payload.model_dump())
    return {"status": "ok"}

# ─────────────────────── APOLOGY HISTORY / CALENDAR / FAVS ───────────────────
@app.get("/api/apology-history")
def api_apology_history():
    return {"history": apology_history}

@app.post("/api/save-apology-history")
def save_apology_history(payload: SaveApologyText):
    apology_history.append({
        "text": payload.text,
        "time": payload.time
    })
    return {"message": "Saved"}


@app.get("/api/apology-calendar")
def api_apology_calendar():
    try:
        with open(APOL_CAL_FILE, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return []

# (Apology favourites handled below together with ranking logic.)

# ────────────────────────────── AI POWER‑UPS  (GPT‑4o) ───────────────────────
class TonePayload(BaseModel):
    text: str

@app.post("/api/adjust-tone")
def api_adjust_tone(payload: dict = Body(...)):
    tone = payload.get("tone", "").strip()
    text = payload.get("text", "").strip()
    if not tone or not text:
        return {"error": "Missing tone or text"}

    prompt = f"Rewrite the apology below in a more {tone} tone:\n\n{text}"
    try:
        from openai import OpenAI
        client = OpenAI()
        res = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
        )
        return {"adjusted": res.choices[0].message.content.strip()}
    except Exception as e:
        return {"error": str(e)}

class CompletePayload(BaseModel):
    start: str
    tone: str | None = "formal"

@app.post("/api/complete-apology")
def api_complete_apology(payload: dict = Body(...)):
    start = payload.get("start", "").strip()
    tone = payload.get("tone", "formal").strip()

    if not start:
        return {"error": "No start provided"}

    prompt = f"Complete this sentence in a {tone} apology tone:\n\n{start}"

    try:
        from openai import OpenAI
        client = OpenAI()
        res = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )
        return {"completed": res.choices[0].message.content.strip()}
    except Exception as e:
        return {"error": str(e)}

class GuiltPayload(BaseModel):
    text: str

@app.post("/api/guilt-score")
def api_guilt_score(payload: GuiltPayload):
    """
    Return a 1‑100 guilt / sincerity score **with more variance**.
    Strategy:
      • Give the model a calibrated rubric
      • Ask it to choose a BUCKET first, then a number inside the bucket
      • Higher temperature (1.0) for randomness
    """
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
        f"{payload.text}\n"
        "----\nNow respond:"
    )

    try:
        res = openai.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=1.0,  # 🔺 more variance
            top_p=0.95,
        )
        raw = res.choices[0].message.content.strip()

        # quick safety – parse the JSON
        import json, re
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            # fall back if model didn’t give perfect JSON
            m = re.search(r'"score"\s*:\s*(\d+).*"reason"\s*:\s*"([^"]+)', raw, re.S)
            if not m:
                return {"error": "Bad format from model", "raw": raw}
            data = {"score": int(m.group(1)), "reason": m.group(2)}
        return {"feedback": f'{data["score"]}/100 – {data["reason"]}'}
    except Exception as e:
        return {"error": str(e)}

# ───────────────────────── APOLOGY FAVES & SMART‑RANKING ─────────────────────
# --- PATCH C1: save apology to favourites safely ------------------------
@app.post("/api/apology-favorite")
def api_save_apology_fav():
    global latest_text, latest_label
    if not latest_text or latest_label != "Apology":
        return {"message": "⚠️ No apology to save."}

    # Avoid duplicate in favorites
    if latest_text in apology_favorites:
        return {"message": "⚠️ Already in favourites."}

    # Save to favorites
    apology_favorites.append(latest_text)

    # Save smart ranking
    try:
        with open(APOL_SCORE_FILE, "r+", encoding="utf-8") as fh:
            try:
                scores = json.load(fh)
            except:
                scores = {}

            scores.setdefault(latest_text, {"count": 0, "favorited": False})
            scores[latest_text]["favorited"] = True

            fh.seek(0)
            fh.truncate()
            json.dump(scores, fh, indent=2)
    except Exception as e:
        print("⚠️ Failed to update score:", e)

    return {"message": "✅ Apology added to favourites!"}

# -----------------------------------------------------------------------
# --- PATCH C2: expose favourites list -----------------------------------
@app.get("/api/apology-favorites")
def api_get_apology_favorites():
    return {"favorites": apology_favorites}

@app.get("/api/top-apologies")
def api_top_apologies():
    try:
        data = json.load(open(APOL_SCORE_FILE, encoding="utf-8"))
    except Exception:
        data = {}

    ranked = [
        {
            "text": txt,
            "score": meta.get("count", 0) + (3 if meta.get("favorited") else 0),
            "count": meta.get("count", 0),
            "favorited": meta.get("favorited", False)
        }
        for txt, meta in data.items()
    ]
    ranked.sort(key=lambda x: x["score"], reverse=True)
    return ranked
# -----------------------------------------------------------------------


@app.post("/api/save-apology-history")
def save_apology_history(payload: SaveApologyText):
    global latest_text, latest_label
    latest_text = payload.text
    latest_label = "Apology"
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    if not any(i["text"] == payload.text for i in apology_history):
        apology_history.append({
            "text": payload.text,
            "time": now
        })

    cal_entry = {
        "text": payload.text,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "time": datetime.now().strftime("%I:%M %p")
    }

    if os.path.exists(APOL_CAL_FILE):
        with open(APOL_CAL_FILE, "r+", encoding="utf-8") as f:
            data = json.load(f)
            data.append(cal_entry)
            f.seek(0); f.truncate(); json.dump(data, f, indent=2)
    else:
        json.dump([cal_entry], open(APOL_CAL_FILE, "w", encoding="utf-8"), indent=2)

    return {"message": "✅ Apology saved to history and calendar."}

@app.post("/api/clear-apology-rankings")
def api_clear_apology_rankings():
    json.dump({}, open(APOL_SCORE_FILE, "w", encoding="utf-8"))
    return {"message": "Top apologies cleared."}

# ───────────────────── EXCUSE SMART‑RANKINGS (unchanged) ─────────────────────
@app.get("/api/rankings")
def api_excuse_rankings():
    try:
        data = json.load(open("smart_scores.json", encoding="utf-8"))
    except Exception:
        return []

    ranked = [
        {
            "text": txt,
            "score": info.get("count", 0) + info.get("urgency_score", 0)
                     + (3 if info.get("favorited") else 0),
            "count": info.get("count", 0)
        }
        for txt, info in data.items()
    ]
    ranked.sort(key=lambda x: x["score"], reverse=True)
    return ranked

@app.post("/api/clear-rankings")
def api_clear_excuse_rankings():
    json.dump({}, open("smart_scores.json", "w", encoding="utf-8"))
    return {"message": "Smart rankings cleared."}

# ───────────────────────────── MEMORY LOOK‑UP API ────────────────────────────
@app.get("/api/memory")
def api_memory_lookup(q: str):
    """Return up to 5 stored excuses containing the query keyword(s)."""
    q = q.strip().lower()
    hits = []
    for kw, excuses in memory_db.items():
        if q in kw:
            hits.extend(excuses)
    return {"matches": list(dict.fromkeys(hits))[:5]}

# ──────────────────────── SCHEDULER / FALLBACK JOBS ──────────────────────────
@app.post("/api/schedule")
def api_schedule_emergency(payload: ScheduleInput):
    """Schedule an emergency e‑mail at the chosen date‑time."""
    try:
        when = datetime.strptime(f"{payload.date} {payload.time}", "%Y-%m-%d %H:%M")
        scheduler.add_job(
            trigger_emergency_internal,
            trigger=DateTrigger(run_date=when),
            args=[payload.model_dump()],
            id=f"em_{when.isoformat()}_{uuid.uuid4().hex[:6]}",
        )
        return {"message": f"🚨 Emergency scheduled for {when}"}
    except Exception as e:
        return {"message": f"❌ Scheduling failed: {e}"}

def fallback_calendar_sync():
    """
    Every 30 min ensure the most recent excuse / apology is present
    in its calendar JSON (avoids rare loss on crash).
    """
    if not latest_text:
        return

    target = "excuse_calendar.json" if latest_label == "Excuse" else "apology_calendar.json"
    now    = datetime.now()
    entry  = {"text": latest_text, "date": now.strftime("%Y-%m-%d"), "time": now.strftime("%I:%M %p")}

    if not os.path.exists(target):
        json.dump([entry], open(target, "w", encoding="utf-8"), indent=2)
        return

    data = json.load(open(target, encoding="utf-8"))
    if all(e["text"] != latest_text for e in data):
        data.append(entry)
        json.dump(data, open(target, "w", encoding="utf-8"), indent=2)
        print(f"📅 Synced last {latest_label.lower()} to calendar.")

# replace_existing=True makes sure we don’t duplicate the job if the file is reloaded
scheduler.add_job(fallback_calendar_sync, "interval", minutes=30, id="fallback", replace_existing=True)

# ───────────────────────────────── MISC / ADMIN ──────────────────────────────
@app.get("/admin", response_class=HTMLResponse)
def admin_panel(request: Request):
    logs = json.load(open("email_log.json", encoding="utf-8")) if os.path.exists("email_log.json") else []
    return templates.TemplateResponse("admin.html", {"request": request, "logs": logs})

# ensure shelve DB closes cleanly
atexit.register(memory_db.close)

"""
MIT License

Copyright (c) 2025 Ch Aarush Udbhav

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the “Software”), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies
or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
"""