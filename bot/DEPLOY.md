# النشر — تشغيل 24 ساعة من السحابة

الحاوية تحمل البوت ومتصفح Chromium لتوليد PDF والصور. **قاعدة البيانات في
Supabase** — الحاوية بلا حالة تماماً: تُعاد بناؤها بلا خسارة، ولا قرص ثابت مطلوب.

## القاعدة الوحيدة التي لا تُخالف

**نسخة واحدة تعمل بالتوكن في أي لحظة.** البوت يستطلع تليغرام، وتليغرام يعطي
الاستطلاع لنسخة واحدة ويرفض الثانية بخطأ 409. **أوقف البوت على جهازك قبل
النشر**، ولا تشغّله محلياً بعدها إلا بعد إيقاف السحابي.

## Railway — عشر دقائق

1. **railway.com** ← سجّل بحساب GitHub (`smsdhyab`) ← **New Project** ← **Deploy from GitHub repo** ← اختر `smsdhyab/at`.
2. **Settings ← Source ← Root Directory:** اكتب `bot`
   (المستودع فيه أكثر من مجلد، وهذا يخبره أين المشروع. ملف `railway.json` يتكفّل بالباقي.)
3. **Variables ← Raw Editor** ← الصق:

   ```
   TELEGRAM_TOKEN=
   DATABASE_URL=
   WHATSAPP_NUMBER=966534436932
   BRAND_LEGAL_NAME=
   BRAND_LICENSE=
   BRAND_ADDRESS=
   BRAND_EMAIL=
   WP_URL=https://alarabtravelers.com
   WP_USER=
   WP_APP_PASSWORD=
   ```

   القيم من ملف `bot/.env` على جهازك — انسخها بنفسك، لا ترسلها في أي محادثة.
   `DATABASE_URL` هو رابط **pooler** لا `db.<ref>`، بكلمة المرور مشفَّرة (`#` ← `%23`).
   `WP_*` اختيارية: بدونها تُحفظ سياسة الربح في القاعدة فقط.
   **لا تضع `ALLOWED_IDS`** إن أردت الوصول مفتوحاً.

4. **Deploy**. راقب السجل (Deployments ← View Logs) حتى يظهر:

   ```
   البوت يعمل: @arabtravelbot
   المستخدمون: N · الوصول: مفتوح للجميع
   ```

   الجداول تُطبَّق تلقائياً عند الإقلاع — القاعدة موجودة أصلاً فلن يظهر شيء جديد.

5. جرّب من تليغرام: `/start` ← عرض سعر جديد ← حتى PDF. إن خرج المستند بخط ثمانية فالخطوط وصلت.

**بعدها**: كل `git push` إلى `main` يعيد النشر تلقائياً خلال دقيقتين.

## التحكم من السحابة

| ماذا | أين |
|---|---|
| الأسعار والفنادق والجولات والخدمات | البوت ← الأسعار (أو لوحة ووردبرس ← حاسبة الأسعار للعرض) |
| سياسة الربح لليوم | البوت ← الأسعار ← سياسة الربح · أو ووردبرس ← الإعدادات |
| إيقاف / تشغيل / سجل | Railway ← الخدمة ← Deployments |
| تغيير التوكن أو الهوية | Railway ← Variables (يعيد التشغيل تلقائياً) |
| فتح الوصول أو إغلاقه | متغيّر `ALLOWED_IDS` |

## سيرفر خاص (Hetzner وغيره)

```bash
git clone https://github.com/smsdhyab/at.git && cd at/bot
cp .env.example .env      # املأ التوكن ورابط القاعدة والهوية
docker build -t aat-bot .
docker run -d --name aat-bot --env-file .env --restart unless-stopped aat-bot
```

التحديث: `git pull && docker build -t aat-bot . && docker restart aat-bot`.

## النسخ الاحتياطي

القاعدة في Supabase — لوحة المشروع ← Database ← Backups (يومي على الباقة المجانية).
الحاوية نفسها لا تحمل شيئاً يستحق النسخ.

## متصفح بعيد بدل Chromium داخل الحاوية

إن أردت حاوية أخف أو استضافة بلا متصفح (Supabase Edge Functions)، اضبط
`BROWSER_WS_ENDPOINT` بعنوان Browserless — عندها يُتجاهل Chromium المحلي.
