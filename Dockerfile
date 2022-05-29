FROM node:16-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package*.json ./
COPY sd-card-copy-server/package.json ./sd-card-copy-server/package.json
COPY dist dist

RUN npm ci
RUN npm prune --production

EXPOSE 3000

WORKDIR sd-card-copy-server

CMD ["node", "../dist/server/main"]