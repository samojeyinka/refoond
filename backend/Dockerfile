FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

EXPOSE 5050

# Seed DB if needed and start the dev server
CMD ["sh", "-c", "npm run seed && npm run dev"]
