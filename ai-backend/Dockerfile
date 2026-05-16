FROM python:3.10-slim

WORKDIR /app

# Install system dependencies required by OpenCV and PySceneDetect
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --default-timeout=1000 --retries 10 -r requirements.txt

# Copy the rest of the application
COPY . .

# Expose the FastAPI port
EXPOSE 8000

# Start the server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
