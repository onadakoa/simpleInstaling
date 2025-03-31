FROM ghcr.io/puppeteer/puppeteer AS base

WORKDIR /app

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-khmeros \
    fonts-kacst fonts-freefont-ttf dbus dbus-x11

USER pptruser

COPY ./package.json ./package.json 
RUN npm install
COPY . .

ENV OS="docker"

CMD [ "npm", "run", "start" ]
