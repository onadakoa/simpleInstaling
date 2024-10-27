FROM ghcr.io/puppeteer/puppeteer AS base

WORKDIR /app

COPY ./package.json ./package.json 
RUN npm install
COPY . .

ENV OS="docker"

CMD [ "npm", "run", "start" ]
