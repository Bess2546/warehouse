#Back-End
# ====== Stage 1: Build ======
FROM node:22-alpine AS builder

WORKDIR /app

# copy package files
COPY package*.json ./
RUN npm install

# copy source code
COPY . .

# build NestJS -> dist
RUN npm run build

# ====== Stage 2: Production ======
FROM node:22-alpine AS runner

WORKDIR /app

# copy package file & install only production deps
COPY package*.json ./
RUN npm install --only=production

# copy built app
COPY --from=builder /app/dist ./dist

# expose backend port
EXPOSE 3001

# start app
CMD ["node", "dist/main.js"]
