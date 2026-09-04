# Node 24 يشغّل TypeScript مباشرة — لا خطوة بناء ولا مجلد dist.
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY migrations ./migrations
COPY src ./src

# قاعدة البيانات ملف واحد — لا بد من قرص ثابت وإلا ضاعت عند إعادة النشر.
ENV DB_FILE=/data/aat.db
VOLUME /data

# البوت يعمل بالاستطلاع الطويل: لا منفذ مفتوح ولا عنوان عام مطلوب.
CMD ["node", "src/bot.ts"]
