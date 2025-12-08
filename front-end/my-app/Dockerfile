# ====== Stage 1: Build ======
FROM node:22-alpine AS builder

WORKDIR /app

# ติดตั้ง dependencies
COPY package*.json ./
RUN npm install

# copy โค้ดทั้งหมดเข้าไป
COPY . .
COPY .env.local .env.local

# build Next.js เป็น production
RUN npm run build

# ====== Stage 2: Run (Production) ======
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# ติดตั้งเฉพาะ production deps
COPY package*.json ./
RUN npm install --only=production

# เอาของที่ build แล้วมาใช้รัน
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# (ไม่จำเป็นต้อง copy src ทั้งหมดก็ได้ แต่ถ้าอยาก copy เผื่อไว้ก็ได้)
# COPY --from=builder /app/src ./src

ENV PORT=3000
EXPOSE 3000

# ใช้ script start ของ Next.js (ใน package.json น่าจะเป็น "next start")
CMD ["npm", "start"]
