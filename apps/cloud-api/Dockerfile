FROM node:22-alpine
WORKDIR /app
COPY apps/cloud-api/package*.json ./
RUN npm install
COPY apps/cloud-api/tsconfig.json ./
COPY apps/cloud-api/src ./src
RUN npm run build
CMD ["npm","start"]
