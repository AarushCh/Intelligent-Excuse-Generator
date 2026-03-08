# Use the official Python slim image
FROM python:3.11-slim

# Create a non-root user with UID 1000 as required by Hugging Face Spaces
RUN useradd -m -u 1000 user
USER user

# Set strictly required environment variables for HF
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1

WORKDIR $HOME/app

# Copy the dependency list and install them as the user
COPY --chown=user:user requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Copy all the project files into the image and set ownership
COPY --chown=user:user . .

# Hugging Face Spaces mandates binding to 7860
EXPOSE 7860

# Command to boot the FastAPI application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
