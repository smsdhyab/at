# Node 24 يشغّل TypeScript مباشرة — لا خطوة بناء ولا مجلد dist.
# صورة slim لا alpine: Chromium على alpine يحتاج ترقيعاً، وعلى debian يعمل من apt مباشرة.
FROM node:24-slim

# Chromium لتوليد PDF والصور، وخطوط نوتو كخط احتياطي للعربية
# إن تعذّر تحميل خطوط جوجل وقت التوليد.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-noto-core \
      fonts-noto-color-emoji \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

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
