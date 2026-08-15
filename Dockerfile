FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
 && python -c "import PIL; print('Pillow', PIL.__version__)"

COPY bot ./bot

# Optional health endpoint for hosts that require an open port.
ENV PORT=8080
EXPOSE 8080

CMD ["python", "-m", "bot.main"]
