FROM python:3.11-slim

WORKDIR /app

COPY run.py .

RUN pip install --no-cache-dir websockets

CMD ["python", "run.py"]
