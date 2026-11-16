# The storefront (public site). Build from this folder: docker build -t storefront .
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV STOREFRONT_HOST=0.0.0.0 STOREFRONT_PORT=8080
EXPOSE 8080
# Orders are written to /app/storefront: mount a disk there or they are lost on restart.
CMD ["npx", "tsx", "src/storefront/main.ts"]
