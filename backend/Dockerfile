FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

ENV DATABASE_URL="postgresql://postgres:postgres@postgres:5432/job_match"

RUN npx prisma generate

EXPOSE 5000

CMD ["npm", "run", "dev"]