/**
 * بوت المسافرون العرب — أداة تشغيل تعمل بالأزرار.
 *
 * ponytail: يعمل بالاستطلاع الطويل (long polling) لا بالـ webhook. هذا يلغي
 * الحاجة لعنوان عام و TLS واستثناء في Cloudflare و ngrok للتجربة المحلية —
 * والبوت داخلي بنسخة واحدة فلا فائدة من الـ webhook.
 *
 * الوصول: في «وضع الفتح» يُسجَّل تلقائياً كل من يراسل البوت كمشرف. هذا اختيار
 * صريح من المالك ويُغلق بزر واحد من ⚙️ الإعدادات. ما دام مفتوحاً فمن يعرف اسم
 * البوت يرى التكاليف والأرباح ويعدّل الأسعار.
 */
import { Bot, InlineKeyboard, Keyboard, type Context } from 'grammy';
import * as db from './db.ts';
import { startQuote, handleQuoteCallback } from './flows/quote.ts';
import { startRates, handleRatesCallback } from './flows/rates.ts';
import { takeText, clearText, dropDraft } from './state.ts';
import { fmt } from './ui.ts';

const token = process.env.TELEGRAM_TOKEN;
if (!token) {
  console.error('TELEGRAM_TOKEN غير موجود. انسخ .env.example إلى .env وضع التوكن فيه.');
  process.exit(1);
}

/** معرّفات مسموحة من البيئة — تُضاف لقاعدة البيانات عند الإقلاع. */
const seedIds = (process.env.ALLOWED_IDS ?? '')
  .split(/[,\s]+/)
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n) && n > 0);
for (const id of seedIds) db.addUser(id, null, null);

const bot = new Bot(token);

/* ------------------------------ الأزرار ------------------------------ */

const BTN = {
  quote: '🧾 عرض سعر جديد',
  rates: '💰 الأسعار',
  recent: '📋 آخر العروض',
  stats: '📊 الأرقام',
  settings: '⚙️ الإعدادات',
} as const;

const menu = new Keyboard()
  .text(BTN.quote).text(BTN.rates).row()
  .text(BTN.recent).text(BTN.stats).row()
  .text(BTN.settings)
  .resized()
  .persistent();

const WELCOME = [
  '<b>المسافرون العرب — أداة التشغيل</b>',
  '',
  'كل شيء بالأزرار في الأسفل. اختر ما تريد:',
  '',
  `${BTN.quote} — يبني العرض خطوة بخطوة ويخرج PDF وصورة`,
  `${BTN.rates} — الفنادق والسيارات والجولات`,
  `${BTN.recent} — آخر عشرة عروض أنشأتها`,
  `${BTN.stats} — أرقام آخر 30 يوماً`,
].join('\n');

const showMenu = (ctx: Context, text = WELCOME) =>
  ctx.reply(text, { parse_mode: 'HTML', reply_markup: menu });

/* ------------------------------ الوصول ------------------------------ */

bot.use(async (ctx, next) => {
  const from = ctx.from;
  if (!from) return;

  const existing = db.getUser(from.id);

  if (existing?.role === 'blocked') return;

  if (!existing) {
    if (!db.isOpenAccess()) {
      console.warn(`محاولة وصول مرفوضة من ${from.id} (${from.username ?? 'بلا معرّف'})`);
      return;
    }
    const name = [from.first_name, from.last_name].filter(Boolean).join(' ') || null;
    db.addUser(from.id, name, from.username ?? null);
    console.log(`مستخدم جديد: ${from.id} — ${name ?? 'بلا اسم'} (@${from.username ?? '—'})`);

    // إشعار بقية المشرفين — الوصول مفتوح، فيجب أن يعرفوا من دخل
    for (const u of db.listUsers()) {
      if (u.telegram_id === from.id || u.role !== 'admin') continue;
      await bot.api
        .sendMessage(
          u.telegram_id,
          `👤 انضم مستخدم جديد للبوت:\n<b>${name ?? 'بلا اسم'}</b>` +
            `${from.username ? ` (@${from.username})` : ''}\nالمعرّف: <code>${from.id}</code>` +
            `\n\nالوصول مفتوح للجميع. أغلقه من ⚙️ الإعدادات إن لم تكن تعرفه.`,
          { parse_mode: 'HTML' },
        )
        .catch(() => {});
    }
  }

  await next();
});

/* ------------------------------ الشاشات ------------------------------ */

async function showRecent(ctx: Context) {
  const rows = db.listRecentQuotes(ctx.from!.id, 10);
  if (!rows.length) {
    await ctx.reply(`لا توجد عروض بعد. اضغط «${BTN.quote}» للبدء.`, { reply_markup: menu });
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
  await ctx.reply(['<b>آخر عروضك</b>', '', ...lines].join('\n'), {
    parse_mode: 'HTML',
    reply_markup: menu,
  });
}

async function showStats(ctx: Context) {
  const s = db.stats(30);
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
    { parse_mode: 'HTML', reply_markup: menu },
  );
}

async function showSettings(ctx: Context, edit = false) {
  const open = db.isOpenAccess();
  const users = db.listUsers();
  const kb = new InlineKeyboard()
    .text(open ? '🔓 الوصول مفتوح — اضغط للإغلاق' : '🔒 الوصول مغلق — اضغط للفتح', 's:toggle').row()
    .text(`👥 المستخدمون (${users.length})`, 's:users');

  const text = [
    '<b>الإعدادات</b>',
    '',
    open
      ? '🔓 <b>الوصول مفتوح.</b> أي شخص يراسل البوت يصبح مشرفاً ويرى تكاليفك وأرباحك ويعدّل أسعارك.'
      : '🔒 <b>الوصول مغلق.</b> لا يدخل أحد جديد.',
    '',
    `عدد المستخدمين الحاليين: <b>${users.length}</b>`,
  ].join('\n');

  if (edit) await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  else await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
}

/* ------------------------------ الأوامر ------------------------------ */

bot.command(['start', 'help'], (ctx) => showMenu(ctx));
bot.command('cancel', async (ctx) => {
  dropDraft(ctx.from!.id);
  await showMenu(ctx, 'أُلغي.');
});
bot.command('quote', startQuote);
bot.command('rates', startRates);
bot.command('recent', showRecent);
bot.command('stats', showStats);
bot.command('settings', (ctx) => showSettings(ctx));

/* ------------------------------ الأزرار ------------------------------ */

bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const parts = data.split(':');

  if (parts[0] === 's') {
    if (parts[1] === 'toggle') {
      const now = !db.isOpenAccess();
      db.setSetting('open_access', now ? '1' : '0');
      await ctx.answerCallbackQuery(now ? 'فُتح الوصول' : 'أُغلق الوصول');
      await showSettings(ctx, true);
      return;
    }
    if (parts[1] === 'users') {
      const list = db
        .listUsers()
        .map((u) => `• ${u.name ?? 'بلا اسم'}${u.username ? ` (@${u.username})` : ''} — <code>${u.telegram_id}</code>`)
        .join('\n');
      await ctx.answerCallbackQuery();
      await ctx.reply(`<b>المستخدمون</b>\n\n${list}`, { parse_mode: 'HTML' });
      return;
    }
  }

  const handled =
    parts[0] === 'q' ? await handleQuoteCallback(ctx, parts)
    : parts[0] === 'r' ? await handleRatesCallback(ctx, parts)
    : false;
  if (!handled) await ctx.answerCallbackQuery({ text: 'زر قديم — ابدأ من جديد', show_alert: true });
});

/* --------------------------- الرسائل النصية --------------------------- */

bot.on('message:text', async (ctx) => {
  const text = ctx.message.text.trim();

  // زر القائمة يقطع أي خطوة جارية — الضغط عليه يعني تبديل المسار
  switch (text) {
    case BTN.quote:    clearText(ctx.from.id); return void (await startQuote(ctx));
    case BTN.rates:    clearText(ctx.from.id); return void (await startRates(ctx));
    case BTN.recent:   clearText(ctx.from.id); return void (await showRecent(ctx));
    case BTN.stats:    clearText(ctx.from.id); return void (await showStats(ctx));
    case BTN.settings: clearText(ctx.from.id); return void (await showSettings(ctx));
  }

  const handler = takeText(ctx.from.id);
  if (handler) {
    await handler(ctx, text);
    return;
  }
  await showMenu(ctx, 'اختر من الأزرار في الأسفل:');
});

/* ---------------------------- كل شيء آخر ---------------------------- */

bot.on('message', (ctx) => showMenu(ctx, 'اختر من الأزرار في الأسفل:'));

bot.catch((err) => {
  console.error('خطأ في البوت:', err.error);
  void (err.ctx as Context).reply?.('حدث خطأ. اضغط زراً من القائمة للمتابعة.').catch(() => {});
});

/* ------------------------------ التشغيل ------------------------------ */

await bot.api.setMyCommands([
  { command: 'start', description: 'القائمة الرئيسية' },
  { command: 'quote', description: 'عرض سعر جديد' },
  { command: 'rates', description: 'تعديل الأسعار' },
  { command: 'recent', description: 'آخر عروضك' },
  { command: 'stats', description: 'أرقام آخر 30 يوماً' },
  { command: 'settings', description: 'الإعدادات' },
  { command: 'cancel', description: 'إلغاء' },
]);

const me = await bot.api.getMe();
console.log(
  `البوت يعمل: @${me.username}\n` +
    `المستخدمون: ${db.listUsers().length} · الوصول: ${db.isOpenAccess() ? 'مفتوح للجميع' : 'مغلق'}`,
);

const stop = async () => {
  console.log('\nإيقاف…');
  await bot.stop();
  db.close();
  process.exit(0);
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

await bot.start();
