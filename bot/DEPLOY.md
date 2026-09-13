# النشر — تشغيل 24 ساعة

الحاوية تحمل كل شيء: البوت، وقاعدة البيانات، ومتصفح Chromium لتوليد PDF والصور.
لا خدمة ثانية ولا رابط اتصال.

## ⚠️ القاعدة الوحيدة التي لا تُخالف

**اربط قرصاً ثابتاً على المسار `/data`.**

قاعدة البيانات ملف واحد داخل الحاوية. بلا قرص ثابت، كل عروضك وأسعارك وفنادقك
**تُمحى عند أول إعادة نشر** — الحاوية تُبنى من الصفر والملف معها.

## Railway — عشر دقائق

1. **railway.app** ← New Project ← Deploy from GitHub repo ← اختر `newaa1/at`
2. **Settings ← Root Directory:** اكتب `bot`
   (المستودع فيه مجلدان، وهذا يخبره أين المشروع)
3. **Settings ← Volumes ← New Volume:** المسار `/data`
4. **Variables** ← أضف:

   | المتغيّر | القيمة |
   |---|---|
   | `TELEGRAM_TOKEN` | توكن البوت من @BotFather |
   | `DB_FILE` | `/data/aat.db` |
   | `WHATSAPP_NUMBER` | `966534436932` |
   | `BRAND_LEGAL_NAME` | الاسم القانوني الكامل |
   | `BRAND_LICENSE` | رقم رخصة الوكالة |
   | `BRAND_ADDRESS` | العنوان |
   | `BRAND_EMAIL` | البريد الرسمي |

   **لا تضع `ALLOWED_IDS`** إن أردت الوصول مفتوحاً، أو ضع معرّفاتكم لإغلاقه من البداية.

5. Deploy. راقب السجل حتى يظهر:

   ```
   جهّزت قاعدة البيانات — 4 ملف جديد.
   البوت يعمل: @arabtravelbot
   ```

**أوقف البوت على جهازك قبل النشر.** نسختان بنفس التوكن تتنازعان وتفشلان
بخطأ 409 من تليغرام.

## سيرفر خاص (Hetzner وغيره)

```bash
git clone https://github.com/newaa1/at.git && cd at/bot
cp .env.example .env      # املأ التوكن والهوية
docker build -t aat-bot .
docker run -d --name aat-bot --env-file .env \
  -v aat-data:/data --restart unless-stopped aat-bot
```

## النسخ الاحتياطي

ملف واحد. انسخه وانتهى الأمر:

```bash
docker run --rm -v aat-data:/data -v "$PWD:/out" alpine cp /data/aat.db /out/backup.db
```

على Railway: Volume ← Backups.

## الانتقال إلى Supabase لاحقاً

ثلاثة تغييرات مطلوبة، أحدها جاهز:

| التغيير | الحالة |
|---|---|
| متصفح بعيد للـ PDF | ✅ **جاهز** — اضبط `BROWSER_WS_ENDPOINT` بعنوان Browserless |
| webhook بدل الاستطلاع الطويل | يحتاج عملاً |
| Postgres بدل ملف SQLite | يحتاج عملاً |

سبب المتصفح البعيد: توثيق Supabase نفسه يذكر أن Puppeteer لا يعمل داخل
Edge Functions بسبب حدود الحجم، ويوصي بمتصفح خارجي عبر WebSocket.
