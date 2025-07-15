import os
import smtplib
from dotenv import load_dotenv

load_dotenv()

try:
    server = smtplib.SMTP_SSL("smtp.gmail.com", 465)
    server.login(os.getenv("EMAIL_USERNAME"), os.getenv("EMAIL_PASSWORD"))
    print("✅ Gmail login succeeded.")
except Exception as e:
    print("❌ Login failed:", e)