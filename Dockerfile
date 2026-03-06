FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY apps/frontend/package*.json ./apps/frontend/

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3005

CMD ["npm", "start"]
