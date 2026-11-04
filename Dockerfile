# syntax=docker/dockerfile:1

# ---- Build stage -----------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm test && npm run build

# ---- Runtime stage ---------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

LABEL org.opencontainers.image.title="GridCalc — Crypto & Forex Grid Strategy Calculator" \
      org.opencontainers.image.description="Grid trading calculator: levels, lot sizing, TP, drawdown, margin and stop-out analysis." \
      org.opencontainers.image.source="https://github.com/thisizlefthanded/Crypto-Forex-Grid-Strategy-Calculator" \
      org.opencontainers.image.licenses="MIT"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
