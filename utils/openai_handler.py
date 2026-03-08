import os
import re
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# Configure OpenRouter Client
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY", "dummy-key-for-local-testing"),
)

# Define the model variable
MODEL_NAME = "nvidia/nemotron-nano-12b-v2-vl:free"

def strip_reasoning(text: str) -> str:
    """Strips <think> or <thought> blocks from the model's output."""
    if not text:
        return text
    # Remove XML blocks entirely
    cleaned = re.sub(r'<(think|thought)>.*?</\1>', '', text, flags=re.DOTALL)
    # Remove any stray unclosed tags if present
    cleaned = re.sub(r'<(think|thought)>.*', '', cleaned, flags=re.DOTALL)
    return cleaned.strip()

def generate_excuse(scenario, urgency, language="en", style="professional"):
    # 1. Preserve original Prompt Branching
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
        # 2. Update to OpenRouter + Nemotron + Reasoning
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            extra_body={"reasoning": {"enabled": True}}
        )
        base_text = strip_reasoning(response.choices[0].message.content)
    except Exception as e:
        print("❌ Error generating excuse:", e)
        base_text = "Something went wrong while generating your excuse."

    # 3. Preserve Translation Logic
    if language != "en":
        try:
            translation_prompt = f"Translate this to {language}:\n{base_text}"
            trans_response = client.chat.completions.create(
                model=MODEL_NAME,
                messages=[{"role": "user", "content": translation_prompt}],
                temperature=0.7,
                extra_body={"reasoning": {"enabled": True}}
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
            model=MODEL_NAME,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            extra_body={"reasoning": {"enabled": True}}
        )
        base_message = strip_reasoning(response.choices[0].message.content)
    except Exception as e:
        print("❌ OpenAI error during apology:", e)
        base_message = "Sorry, something went wrong generating the apology."

    # Preserve Translation Logic here as well
    if language != "en":
        try:
            translation_prompt = f"Translate this to {language}:\n{base_message}"
            trans_response = client.chat.completions.create(
                model=MODEL_NAME,
                messages=[{"role": "user", "content": translation_prompt}],
                temperature=0.7,
                extra_body={"reasoning": {"enabled": True}}
            )
            translated = strip_reasoning(trans_response.choices[0].message.content)
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
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": "You are a professional tone adjuster."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            extra_body={"reasoning": {"enabled": True}}
        )
        return strip_reasoning(response.choices[0].message.content)
    except Exception as e:
        print("❌ Tone Adjust Error:", e)
        return "Failed to adjust tone."


def autocomplete_text(prompt):
    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "user", "content": f"Continue this excuse:\n{prompt}"}
            ],
            temperature=0.7,
            extra_body={"reasoning": {"enabled": True}}
        )
        return strip_reasoning(response.choices[0].message.content)
    except Exception as e:
        print("❌ AutoComplete Error:", e)
        return "Failed to complete text."