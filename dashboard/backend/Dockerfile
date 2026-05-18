FROM python:3.12-slim

WORKDIR /app

COPY dashboard/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY dashboard/backend/ .

ENV WORKFORCEGUARD_ROOT=/data
ENV PORT=8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')"

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
