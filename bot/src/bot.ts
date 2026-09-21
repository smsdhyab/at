/**
 * بوت المسافرون العرب — أداة تشغيل تعمل بالأزرار.
 *
 * ponytail: يعمل بالاستطلاع الطويل (long polling) لا بالـ webhook. هذا يلغي
 * الحاجة لعنوان عام و TLS واستثناء في Cloudflare و ngrok للتجربة المحلية —
 * والبوت داخلي بنسخة واحدة فلا فائدة من الـ webhook.
 *
 * الوصول مغلق دائماً: لا يدخل إلا من أُضيف بمعرّفه — من الإعدادات ← المستخدمون،
 * أو من ALLOWED_IDS عند الإقلاع (للدخول الأول على قاعدة جديدة). لا يوجد وضع
 * «مفتوح للجميع»: من يعرف اسم البوت لا يرى شيئاً حتى يُضاف. قرار المالك
 * بعد أن كان مفتوحاً في البداية ودخل غريب.
 */
import { Bot, InlineKeyboard, Keyboard, type Context } from 'grammy';
import * as db from './db.ts';
import { runMigrations } from './migrate.ts';
import { startQuote, handleQuoteCallback, handleQuoteStep } from './flows/quote.ts';
import { startRates, handleRatesCallback, handleRatesStep } from './flows/rates.ts';
import { getSession, dropSession, expectStep, clearStep, type Session } from './state.ts';
import { fmt } from './ui.ts';

const token = process.env.TELEGRAM_TOKEN;
if (!token) {
  console.error('TELEGRAM_TOKEN غير موجود. انسخ .env.example إلى .env وضع التوكن فيه.');
  process.exit(1);
}

// الجداول تُنشأ عند الإقلاع: على قرص جديد لا توجد جداول، ونسيان الخطوة
// يعني بوتاً يسقط عند أول ضغطة زر. آمن للتكرار.
const fresh = await runMigrations();
if (fresh) console.log(`جهّزت قاعدة البيانات — ${fresh} ملف جديد.`);

/** معرّفات مسموحة من البيئة — تُضاف لقاعدة البيانات عند الإقلاع. */
const seedIds = (process.env.ALLOWED_IDS ?? '')
  .split(/[,\s]+/)
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n) && n > 0);
for (const id of seedIds) await db.addUser(id, null, null);

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

  const existing = await db.getUser(from.id);

  if (existing?.role === 'blocked') return;

  if (!existing) {
    console.warn(`محاولة وصول مرفوضة من ${from.id} (${from.username ?? 'بلا معرّف'})`);
    return;
  }
  // تحديث الاسم والمعرّف عند كل رسالة — المضاف بالمعرّف وحده يدخل بلا اسم
  if (!existing.name || existing.username !== (from.username ?? null)) {
    const name = [from.first_name, from.last_name].filter(Boolean).join(' ') || null;
    await db.addUser(from.id, name, from.username ?? null);
  }

  await next();
});

/* ------------------------------ الشاشات ------------------------------ */

async function showRecent(ctx: Context) {
  const rows = await db.listRecentQuotes(ctx.from!.id, 10);
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
    { parse_mode: 'HTML', reply_markup: menu },
  );
}

async function showSettings(ctx: Context, edit = false) {
  const users = await db.listUsers();
  const admins = users.filter((u) => u.role === 'admin').length;
  const kb = new InlineKeyboard().text(`👥 المستخدمون (${admins})`, 's:users');

  const text = [
    '<b>الإعدادات</b>',
    '',
    '🔒 <b>الوصول مغلق.</b> لا يدخل أحد إلا من تضيفه بالمعرّف من «المستخدمون».',
    '',
    `المشرفون الحاليون: <b>${admins}</b>`,
  ].join('\n');

  if (edit) await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  else await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
}

/**
 * إدارة المستخدمين: دعوة بالمعرّف قبل أن يراسل الشخص البوت، وحظر، وحذف.
 * الحظر والحذف كلاهما يمنع الدخول (لا وضع مفتوح). الفرق: المحظور يبقى في
 * القائمة بعلامة كي تتذكّر من أبعدت، والمحذوف يختفي.
 */
async function showUsers(ctx: Context, edit = false) {
  const me = ctx.from!.id;
  const users = await db.listUsers();
  const kb = new InlineKeyboard();
  for (const u of users) {
    const label = `${u.role === 'blocked' ? '🚫 ' : ''}${u.name ?? u.username ?? u.telegram_id}`;
    kb.text(label, `s:u:${u.telegram_id}`);
    if (u.telegram_id === me) kb.text('أنت', 's:noop');
    else if (u.role === 'blocked') kb.text('✅ فكّ الحظر', `s:unblock:${u.telegram_id}`).text('🗑', `s:del:${u.telegram_id}`);
    else kb.text('🚫 حظر', `s:block:${u.telegram_id}`).text('🗑', `s:del:${u.telegram_id}`);
    kb.row();
  }
  kb.text('➕ أضف مستخدماً', 's:add').text('◀️ الإعدادات', 's:back');
  const admins = users.filter((u) => u.role === 'admin').length;
  const text = [
    '<b>المستخدمون</b>',
    '',
    `${admins} مشرف · ${users.length - admins} محظور`,
    'اضغط على اسم لعرض معرّفه. المضاف بالمعرّف يدخل مباشرة حتى لو كان الوصول مغلقاً.',
  ].join('\n');
  if (edit) await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  else await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
}

/** خطوة إدخال معرّف المستخدم الجديد: رقم، أو رسالة محوَّلة منه. */
async function handleSettingsStep(ctx: Context, s: Session, text: string): Promise<boolean> {
  if (s.step !== 's.addUser') return false;
  const origin = ctx.message?.forward_origin;
  const forwarded = origin?.type === 'user' ? origin.sender_user.id : undefined;
  const typed = /^\d{5,15}$/.test(text) ? Number(text) : undefined;
  const id = forwarded ?? typed;
  if (!id) {
    await ctx.reply(
      origin?.type === 'hidden_user'
        ? 'هذا الشخص يخفي حسابه في الرسائل المحوَّلة. اطلب منه معرّفه الرقمي من @userinfobot وأرسله هنا.'
        : 'أرسل المعرّف الرقمي (من @userinfobot) أو حوّل رسالة من الشخص نفسه.',
    );
    return true;
  }
  await db.inviteUser(id);
  if (forwarded && origin?.type === 'user') {
    const u = origin.sender_user;
    await db.addUser(id, [u.first_name, u.last_name].filter(Boolean).join(' ') || null, u.username ?? null);
  }
  await clearStep(s);
  await ctx.reply(`✅ أُضيف <code>${id}</code> مشرفاً. يدخل بمجرد أن يرسل /start للبوت.`, { parse_mode: 'HTML' });
  await showUsers(ctx);
  return true;
}

/* ------------------------------ الأوامر ------------------------------ */

bot.command(['start', 'help'], (ctx) => showMenu(ctx));
bot.command('cancel', async (ctx) => {
  await dropSession(ctx.from!.id);
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
    if (parts[1] === 'users') { await ctx.answerCallbackQuery(); await showUsers(ctx, true); return; }
    if (parts[1] === 'back') { await ctx.answerCallbackQuery(); await showSettings(ctx, true); return; }
    if (parts[1] === 'noop') { await ctx.answerCallbackQuery('هذا حسابك'); return; }
    if (parts[1] === 'add') {
      await ctx.answerCallbackQuery();
      await expectStep(await getSession(ctx.from.id), 's.addUser');
      await ctx.reply(
        'أرسل <b>المعرّف الرقمي</b> للشخص (يحصل عليه من @userinfobot)،\n' +
          'أو <b>حوّل إليّ أي رسالة</b> منه.',
        { parse_mode: 'HTML' },
      );
      return;
    }
    const target = Number(parts[2]);
    if (parts[1] === 'u' && target) {
      const u = await db.getUser(target);
      await ctx.answerCallbackQuery({
        text: u ? `${u.name ?? 'بلا اسم'}${u.username ? ` @${u.username}` : ''}\nالمعرّف: ${u.telegram_id}\n${u.role === 'blocked' ? 'محظور' : 'مشرف'}` : 'غير موجود',
        show_alert: true,
      });
      return;
    }
    if ((parts[1] === 'block' || parts[1] === 'del') && target === ctx.from.id) {
      await ctx.answerCallbackQuery({ text: 'لا تستطيع حظر نفسك أو حذفها.', show_alert: true });
      return;
    }
    if (parts[1] === 'block' && target) {
      await db.setUserRole(target, 'blocked');
      await dropSession(target);
      await ctx.answerCallbackQuery('حُظر');
      await showUsers(ctx, true);
      return;
    }
    if (parts[1] === 'unblock' && target) {
      await db.setUserRole(target, 'admin');
      await ctx.answerCallbackQuery('عاد مشرفاً');
      await showUsers(ctx, true);
      return;
    }
    if (parts[1] === 'del' && target) {
      await db.deleteUser(target);
      await dropSession(target);
      await ctx.answerCallbackQuery('حُذف');
      await showUsers(ctx, true);
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
    case BTN.quote:    await dropSession(ctx.from.id); return void (await startQuote(ctx));
    case BTN.rates:    await dropSession(ctx.from.id); return void (await startRates(ctx));
    case BTN.recent:   return void (await showRecent(ctx));
    case BTN.stats:    return void (await showStats(ctx));
    case BTN.settings: return void (await showSettings(ctx));
  }

  // خطوة منتظرة؟ توزَّع على معالجها حسب بادئة اسمها
  const session = await getSession(ctx.from.id);
  if (session.step) {
    const handled = session.step.startsWith('q.')
      ? await handleQuoteStep(ctx, session, text)
      : session.step.startsWith('r.')
        ? await handleRatesStep(ctx, session, text)
        : session.step.startsWith('s.')
          ? await handleSettingsStep(ctx, session, text)
          : false;
    if (handled) return;
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
    `المستخدمون: ${(await db.listUsers()).length} · ` +
    'الوصول: مغلق — الدخول بالإضافة فقط',
);

const stop = async () => {
  console.log('\nإيقاف…');
  await bot.stop();
  await db.close();
  process.exit(0);
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

await bot.start();
