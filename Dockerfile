FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install -g npm@12.0.1 --no-audit --no-fund \
  && npm config set registry https://registry.npmjs.org/ \
  && npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-timeout 600000 \
  && NODE_OPTIONS=--dns-result-order=ipv4first npm ci --ignore-scripts --no-audit --no-fund --no-update-notifier

COPY . .

RUN npx prisma generate
ARG DATABASE_URL
RUN test -n "$DATABASE_URL" || (echo "DATABASE_URL build argument is required" >&2; exit 1)
RUN DATABASE_URL="$DATABASE_URL" npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app ./

EXPOSE 3000
CMD ["npm", "start"]
