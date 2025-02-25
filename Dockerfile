FROM node:18-alpine3.20

ENV NODE_ENV=production
ENV EVENTLOG_BASEURL=http://0.0.0.0:3006
ENV POSTGRES_PORT=5432
ENV POSTGRES_PASSWORD=postgres
ENV POSTGRES_USER=postgres

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3006

CMD ./bin/event_admin.js init --drop ; ./bin/event_admin.js import import/demo.json ; npx mellon-server --host 0.0.0.0 --port 3006 --registry config/registry.json5