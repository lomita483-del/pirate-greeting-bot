FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# DejaVu fonts — python:3.12-slim ships with NO fonts at all, so without
# this, Pillow silently falls back to its tiny built-in bitmap font for
# every card (/profile, welcome banners), ignoring every font-size we ask
# for. This installs it at the exact path card_service.py already checks.
RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
 && python -c "import PIL; print('Pillow', PIL.__version__)"

COPY bot ./bot

# Optional health endpoint for hosts that require an open port.
ENV PORT=8080
EXPOSE 8080

CMD ["python", "-m", "bot.main"]
