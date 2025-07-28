import imgkit

def generate_screenshot():
    path = "static/screenshot.png"
    options = {
        "format": "png",
        "width": 1200,
        "height": 800,
    }

    try:
        imgkit.from_url("http://127.0.0.1:8000/proof", path, options=options)
        print("✅ Screenshot saved to:", path)
        return path
    except Exception as e:
        print("❌ Screenshot error:", str(e))
        return None