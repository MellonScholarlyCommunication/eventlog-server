FROM node:18-alpine3.20

ENV NODE_ENV=production
ENV EVENTLOG_BASEURL=http://host.docker.internal:3003
ENV POSTGRES_PORT=5432
ENV POSTGRES_HOST=host.docker.internal
ENV POSTGRES_PASSWORD=postgres
ENV POSTGRES_USER=postgres

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3003

CMD ./bin/event_admin.js init --drop ; npx mellon-server --host 0.0.0.0 --port 3003 --registry config/registry.json5
