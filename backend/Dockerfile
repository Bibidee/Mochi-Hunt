# Minimal image for the Mochi Hunt API. Fly.io builds this remotely
# (`fly deploy --remote-only`), so no local Docker is required.
FROM node:20-alpine

WORKDIR /app

# Install production deps only (vitest/eslint/supertest are devDependencies).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# App source.
COPY . .

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "server.js"]
