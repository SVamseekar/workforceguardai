FROM python:3.12-slim

WORKDIR /app

COPY dashboard/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY dashboard/backend/ .
COPY data/ /app/data/

ENV WORKFORCEGUARD_ROOT=/app

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
