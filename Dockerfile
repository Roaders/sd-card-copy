FROM node:24-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production

# used by the Insta360 power cycle afterCopy action
RUN apk add --no-cache uhubctl

COPY package*.json ./
COPY sd-card-copy-server/package.json ./sd-card-copy-server/package.json
COPY dist dist

RUN npm ci --omit=dev

EXPOSE 3000 3001

WORKDIR sd-card-copy-server

CMD ["node", "../dist/server/main"]