/**
 * بوت المسافرون العرب — أداة تشغيل داخلية.
 *
 * ponytail: يعمل بالاستطلاع الطويل (long polling) لا بالـ webhook. هذا يلغي
 * الحاجة لعنوان عام و TLS واستثناء في Cloudflare و ngrok للتجربة المحلية —
 * والبوت داخلي بنسخة واحدة فلا فائدة من الـ webhook. لو احتجت يوماً عدة نسخ
 * أو تشغيلاً بلا خادم دائم، حوّله إلى webhook عبر grammY/webhooks.
 */
import { Bot, type Context } from 'grammy';
import * as db from './db.ts';
import { startQuote, handleQuoteCallback } from './flows/quote.ts';
import { startRates, handleRatesCallback } from './flows/rates.ts';
import { takeText, dropDraft } from './state.ts';
import { fmt } from './ui.ts';

const token = process.env.TELEGRAM_TOKEN;
if (!token) {
  console.error('TELEGRAM_TOKEN غير موجود. انسخ .env.example إلى .env وضع التوكن فيه.');
  process.exit(1);
}

const allowed = new Set(
  (process.env.ALLOWED_IDS ?? '')
    .split(/[,\s]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0),
);
if (allowed.size === 0) {
  console.error('ALLOWED_IDS فارغ — لن يستطيع أحد استخدام البوت. ضع معرّفك الرقمي من @userinfobot.');
  process.exit(1);
}

const bot = new Bot(token);

/* ------------------------- القائمة البيضاء ------------------------- */

bot.use(async (ctx, next) => {
  const id = ctx.from?.id;
  if (!id || !allowed.has(id)) {
    // تجاهل تام: لا رد، ولا تسريب لوجود البوت. المعرّف يُسجَّل ليضيفه المالك إن أراد.
    if (id) console.warn(`محاولة وصول مرفوضة من ${id} (${ctx.from?.username ?? 'بلا معرّف'})`);
    return;
  }
  await next();
});

/* ---------------------------- الأوامر ---------------------------- */

const MENU = [
  '<b>المسافرون العرب — أداة التشغيل</b>',
  '',
  '/quote — عرض سعر جديد',
  '/rates — تعديل الأسعار',
  '/recent — آخر عروضك',
  '/stats — أرقام آخر 30 يوماً',
  '/cancel — إلغاء ما أنت فيه',
].join('\n');

bot.command('start', (ctx) => ctx.reply(MENU, { parse_mode: 'HTML' }));
bot.command('help', (ctx) => ctx.reply(MENU, { parse_mode: 'HTML' }));
bot.command('quote', startQuote);
bot.command('rates', startRates);

bot.command('cancel', async (ctx) => {
  dropDraft(ctx.from!.id);
  await ctx.reply('أُلغي. /quote لعرض جديد.');
});

bot.command('recent', async (ctx) => {
  const rows = await db.listRecentQuotes(ctx.from!.id, 10);
  if (!rows.length) {
    await ctx.reply('لا توجد عروض بعد. ابدأ بـ /quote');
    return;
  }
  const STATUS: Record<string, string> = {
    draft: 'مسودة', sent: 'أُرسل', won: '✅ نجح', lost: '✖️ خسر',
  };
  const lines = rows.map(
    (q) =>
      `<b>${q.serial}</b> · ${q.destination} · ${q.nights} ليالٍ\n` +
      `   ${fmt(q.sell)} · ربح ${fmt(q.sell - q.cost)} · ${STATUS[q.status] ?? q.status}`,
  );
  await ctx.reply(['<b>آخر عروضك</b>', '', ...lines].join('\n'), { parse_mode: 'HTML' });
});

bot.command('stats', async (ctx) => {
  const s = await db.stats(30);
  const rate = s.count ? Math.round((s.won / s.count) * 100) : 0;
  await ctx.reply(
    [
      '<b>آخر 30 يوماً</b>',
      '',
      `عدد العروض: <b>${s.count}</b>`,
      `إجمالي قيمتها: <b>${fmt(s.sell)}</b>`,
      `إجمالي الربح فيها: <b>${fmt(s.profit)}</b>`,
      `عروض ناجحة: <b>${s.won}</b> (${rate}٪)`,
    ].join('\n'),
    { parse_mode: 'HTML' },
  );
});

/* --------------------------- الأزرار --------------------------- */

bot.on('callback_query:data', async (ctx) => {
  const parts = ctx.callbackQuery.data.split(':');
  const handled =
    parts[0] === 'q' ? await handleQuoteCallback(ctx, parts)
    : parts[0] === 'r' ? await handleRatesCallback(ctx, parts)
    : false;
  if (!handled) await ctx.answerCallbackQuery({ text: 'زر قديم — ابدأ من جديد', show_alert: true });
});

/* ------------------------ الرسائل النصية ------------------------ */

bot.on('message:text', async (ctx) => {
  const handler = takeText(ctx.from.id);
  if (handler) {
    await handler(ctx, ctx.message.text);
    return;
  }
  await ctx.reply('لم أفهم. استخدم /quote أو /rates أو /help');
});

/* --------------------------- التشغيل --------------------------- */

bot.catch((err) => {
  console.error('خطأ في البوت:', err.error);
  void (err.ctx as Context).reply?.('حدث خطأ. أعد المحاولة أو ابدأ بـ /cancel').catch(() => {});
});

await bot.api.setMyCommands([
  { command: 'quote', description: 'عرض سعر جديد' },
  { command: 'rates', description: 'تعديل الأسعار' },
  { command: 'recent', description: 'آخر عروضك' },
  { command: 'stats', description: 'أرقام آخر 30 يوماً' },
  { command: 'cancel', description: 'إلغاء' },
]);

const me = await bot.api.getMe();
console.log(`البوت يعمل: @${me.username} — ${allowed.size} مستخدم مصرّح له`);

const stop = async () => {
  console.log('\nإيقاف…');
  await bot.stop();
  db.close();
  process.exit(0);
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

await bot.start();
