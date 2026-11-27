# The storefront (public site). Build from this folder: docker build -t storefront .
FROM node:22-slim
WORKDIR /app
# Making a video on the server: Python for the local voice (Kokoro), the full ffmpeg (the copy that
# ships with Remotion has no limiter filter for the loudness step), and the system libraries the
# render browser (Chrome Headless Shell) needs.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-venv ca-certificates ffmpeg \
      libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 libxkbcommon-dev libxfixes3 \
      libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The engine's one-time setup, done in the image: the voice model (~650 MB) and the render browser.
RUN npx tsx src/cli/main.ts setup
# No graphics card on the server: draw with the software renderer.
ENV STOREFRONT_HOST=0.0.0.0 STOREFRONT_PORT=8080 REMOTION_GL=swangle
EXPOSE 8080
# Orders are written to /app/storefront: mount a disk there or they are lost on restart.
CMD ["npx", "tsx", "src/storefront/main.ts"]
