# **🧠 Intelligent Excuse Generator & Emergency Alert System**

An AI-powered excuse and apology generator using FastAPI + OpenAI GPT-4o, with 
screenshot proof, dark mode, favorites, rankings, and emergency alert system via email.

## **🚀 Features**

- 🎭 Scenario-based Excuse Generation

- 🙏 Tone-aware Apology Generation (Regular & Guilt-Tripping)

- 🏆 Smart Ranking System

- ⭐ Favorites & History Tracker

- 📅 Auto-scheduling Emergency Emails

- 📸 Screenshot Generator with watermark

- 🔊 Offline Voice Playback

- 🌙 Dark Mode Toggle

- 📜 Admin Panel for Logs

- 🧠 Guilt Meter & Tone Adjustment (GPT-4o)

- 💌 Email Alerts with Screenshot Proof

## 🛠️ Setup

1. **Clone the repo**  
   ```bash
   git clone https://github.com/AarushCh/Intelligent-Excuse-Generator
   cd excuse-generator


## Install dependencies

**pip install -r requirements.txt**

## Set environment variables in .env

**EMAIL_USERNAME=your.email@gmail.com**
**EMAIL_PASSWORD=your_app_password**
**EMAIL_RECIPIENTS=a@b.com, c@d.com**

## Run the app

**uvicorn main:app --reload**

## Access in browser

**http://127.0.0.1:8000**

-----------------------------------------------------------------

## **📁 Folder Structure**

.

├── main.py

├── .env

├── requirements.txt

├── templates/

│   └── index.html

├── static/

│   ├── style.css

│   ├── alert.mp3

│   ├── click.mp3

│   ├── logo.png

│   └── favicon.png

├── utils/

│   ├── openai_handler.py

│   └── screenshot.py

├── apology_scores.json

├── excuse_calendar.json

└── emergency_log.json

## **🤖 All AI Features (Using OpenAI GPT Models)**

## ✅ 1. Excuse Generator
API: generate_excuse() in openai_handler.py
Model Used: GPT-4o or GPT-3.5 (based on your API key)
Inputs: scenario, urgency, style, language
Output: Realistic excuse + translation (if needed)

## ✅ 2. Apology Generator
API: generate_apology() in openai_handler.py
Model Used: GPT-4o or GPT-3.5
Inputs: context, tone, type (short/long), style (regular/guilt-tripping), language
Output: Human-like personalized apology

## ✅ 3. Guilt Meter (Guilt/Sincerity Scorer)
Endpoint: /api/guilt-score
Prompt: "Rate the guilt/sincerity of this apology from 1‑100 and explain in ≤30 words."
Model Used: GPT-4o
Output: Numeric guilt score + short analysis

## ✅ 4. Tone Adjuster

Endpoint: /api/adjust-tone
Prompt: "Rewrite the apology below in a more {tone} tone."
Model Used: GPT-4o
Tones Supported: Empathetic, Firm, Formal, Casual
Output: Reworded apology in the requested tone

## ✅ 5. Auto-Complete for Apology

Endpoint: /api/complete-apology
Prompt: "Complete this sentence in a {tone} apology tone:\n\n{start}"
Model Used: GPT-4o
Output: Finished apology sentence continuation

## **⚙️ Underlying AI Model**
GPT-4o (OpenAI's GPT-4 Omni)

Multimodal (but you're using text-only)

High performance in generation, tone understanding, translation

Used across all AI features listed above

## **📦 AI-Backed Features Summary (by Section)**
-----------------------------------------------------------------------------------------------
| Feature                 | API Endpoint            | Model  | Description                    |
| ----------------------- | ----------------------- | ------ | ------------------------------ |
| Excuse Generator        | `/api/excuse`           | GPT-4o | Scenario-based excuse          |
| Apology Generator       | `/api/apology`          | GPT-4o | Context-based apology          |
| Guilt Score Analyzer    | `/api/guilt-score`      | GPT-4o | Ranks sincerity level          |
| Tone Modifier           | `/api/adjust-tone`      | GPT-4o | Rewrites apology               |
| Apology Auto-Completion | `/api/complete-apology` | GPT-4o | Autocomplete starting sentence |
-----------------------------------------------------------------------------------------------

## **MIT License**

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


## 🙏 Credits

**Made by Ch Aarush Udbhav**
