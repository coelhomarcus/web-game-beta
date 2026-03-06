FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY apps/frontend/package*.json ./apps/frontend/

RUN npm install

COPY . .

RUN npm run build

ENV PORT=5788
EXPOSE 5788

CMD ["npm", "start"]
