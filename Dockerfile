# Use the official Python slim image to keep the image size small
FROM python:3.11-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the dependency list and install them
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create a non-root user with UID 1000 as required by Hugging Face Spaces
RUN useradd -m -u 1000 user

# Copy all the project files into the image and set ownership
COPY --chown=user:user . .
USER user

# Hugging Face Spaces mandates exposing port 7860
EXPOSE 7860

# Command to boot the FastAPI application, binding to ALL interfaces so HF can route traffic natively
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
