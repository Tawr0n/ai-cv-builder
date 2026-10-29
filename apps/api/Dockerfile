# Built from the repository root: docker build -f apps/api/Dockerfile .
FROM node:24-bookworm-slim AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# Prisma's schema engine (`migrate deploy`) needs OpenSSL, which the slim image lacks.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable

FROM base AS build
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile \
 && pnpm --filter @ai-cv-builder/api build \
 && pnpm --filter @ai-cv-builder/api deploy --prod --legacy /out

FROM base AS runtime
ENV NODE_ENV=production
# One shared, readable place for the browser, so the non-root user finds it.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app
COPY --from=build --chown=node:node /out ./
# `pnpm deploy` packs files like npm does, and npm never packs a directory named
# `CVS` (any case), so it drops dist/cvs. Copy the build output over it as is.
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist
# Chromium's headless shell only (no full browser, Firefox or WebKit) plus the
# system libraries and fonts it needs; the PDF endpoint prints with it.
RUN ./node_modules/.bin/playwright install --with-deps --only-shell chromium \
 && rm -rf /var/lib/apt/lists/*
USER node
EXPOSE 3001
# Migrations run here, before the app starts (one api replica, no separate job).
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node dist/main.js"]
