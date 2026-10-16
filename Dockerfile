# Playwright's image pins Chromium and its system libraries to the same version as the npm package.
FROM mcr.microsoft.com/playwright:v1.64.1-noble

WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY tsconfig.json ./
COPY apps ./apps
COPY packages ./packages
COPY db ./db

RUN mkdir -p /data/evidence && chown -R pwuser:pwuser /data
USER pwuser
EXPOSE 8790
CMD ["node", "--import", "tsx", "apps/api/src/main.ts"]
