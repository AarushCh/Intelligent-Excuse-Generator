from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def generate_excuse(scenario, urgency, language="en", style="professional"):
    if style == "professional":
        prompt = f"""
You are a professional excuse generator. Generate a realistic and responsible excuse.

Scenario: {scenario}
Urgency: {urgency}

Rules:
- Be practical and believable.
- Avoid anything imaginary or exaggerated.
- Keep it short and polite.
- One or two sentences only.
"""
    else:
        prompt = f"""
You are a creative excuse generator. Generate a fun, clever, or imaginative excuse.

Scenario: {scenario}
Urgency: {urgency}

Rules:
- Be witty, dramatic or unusual, but still make some sense.
- Can include exaggeration or humor.
- One or two sentences only.
"""

    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=250
        )
        base_text = response.choices[0].message.content.strip()
    except Exception as e:
        print("❌ Error generating excuse:", e)
        base_text = "Something went wrong while generating your excuse."

    if language != "en":
        try:
            translation_prompt = f"Translate this to {language}:\n{base_text}"
            trans_response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": translation_prompt}],
                temperature=0.7,
                max_tokens=250
            )
            translated = trans_response.choices[0].message.content.strip()
        except Exception as e:
            print("❌ Translation error:", e)
            translated = "Translation failed."
    else:
        translated = base_text

    return base_text, translated


def generate_apology(context, tone, type, style, language="en"):
    prompt = f"Write a {type.lower()} apology in a {tone.lower()} tone and {style.lower()} style. Context: {context}"

    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=250
        )
        base_message = response.choices[0].message.content.strip()
    except Exception as e:
        print("❌ OpenAI error during apology:", e)
        base_message = "Sorry, something went wrong generating the apology."

    if language != "en":
        try:
            translation_prompt = f"Translate this to {language}:\n{base_message}"
            trans_response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": translation_prompt}],
                temperature=0.7,
                max_tokens=250
            )
            translated = trans_response.choices[0].message.content.strip()
        except Exception as e:
            print("❌ Translation error:", e)
            translated = "Translation failed."
    else:
        translated = base_message

    return base_message, translated


def adjust_tone(text, tone):
    prompt = f"Change the tone of the following excuse to {tone}:\n\n{text}"

    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a professional tone adjuster."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=250
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print("❌ Tone Adjust Error:", e)
        return "Failed to adjust tone."


def autocomplete_text(prompt):
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "user", "content": f"Continue this excuse:\n{prompt}"}
            ],
            temperature=0.7,
            max_tokens=150
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print("❌ AutoComplete Error:", e)
        return "Failed to complete text."