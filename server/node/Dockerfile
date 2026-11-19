FROM node:24-alpine
RUN apk add --no-cache curl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
EXPOSE 8080
CMD ["node", "src/main.ts"]
