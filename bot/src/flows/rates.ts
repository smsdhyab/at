/** تعديل الأسعار: الفنادق والسيارات والجولات وخدمات الوجهة. */
import { InlineKeyboard, type Context } from 'grammy';
import { toCents } from '../pricing.ts';
import * as db from '../db.ts';
import { expectText } from '../state.ts';
import { fmt, keyboard } from '../ui.ts';

const uid = (ctx: Context) => ctx.from?.id ?? 0;

const CLASS_LABEL: Record<string, string> = {
  '3': '3 نجوم',
  '4': '4 نجوم',
  '5': '5 نجوم',
  cabin: 'كوخ / شاليه',
};

const SERVICE_LABEL: Record<string, string> = {
  transfer_rate: 'نقلة المطار',
  ticket_pp: 'تذكرة الدخول للشخص',
  guide_rate: 'يوم المرشد',
};

export async function startRates(ctx: Context): Promise<void> {
  const destinations = await db.listDestinations();
  await ctx.reply('<b>الأسعار</b>\n\nاختر الوجهة:', {
    parse_mode: 'HTML',
    reply_markup: keyboard(destinations, (d) => d.name, (d) => `r:d:${d.slug}`, 1),
  });
}

async function showCategories(ctx: Context, slug: string, edit: boolean): Promise<void> {
  const dest = await db.getDestination(slug);
  if (!dest) return;
  const kb = new InlineKeyboard()
    .text('🏨 الفنادق', `r:c:h:${slug}`)
    .text('🚐 السيارات', `r:c:c:${slug}`).row()
    .text('🗺️ الجولات', `r:c:t:${slug}`)
    .text('🎫 الخدمات', `r:c:s:${slug}`).row()
    .text('◀️ وجهة أخرى', 'r:back');
  const text = `<b>${dest.name}</b>\n\nماذا تريد أن تعدّل؟`;
  if (edit) await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  else await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
}

async function showHotels(ctx: Context, slug: string): Promise<void> {
  const hotels = await db.listHotels(slug);
  const kb = new InlineKeyboard();
  for (const h of hotels) {
    kb.text(
      `${CLASS_LABEL[h.class] ?? h.class} · ${h.name} — ${fmt(h.rate_normal)} / ${fmt(h.rate_high)}`,
      `r:eh:${h.id}`,
    ).row();
  }
  kb.text('➕ أضف فندقاً', `r:ah:${slug}`).row().text('◀️ رجوع', `r:d:${slug}`);
  await ctx.editMessageText(
    '<b>الفنادق</b>\nالسعر معروض هكذا: <code>عادي / مرتفع</code> للغرفة في الليلة.\nاضغط على فندق لتعديل سعره.',
    { parse_mode: 'HTML', reply_markup: kb },
  );
}

async function showCars(ctx: Context, slug: string): Promise<void> {
  const cars = await db.listCars(slug);
  const kb = new InlineKeyboard();
  for (const c of cars) kb.text(`${c.name} — ${fmt(c.rate_day)} / يوم`, `r:ec:${c.id}`).row();
  kb.text('◀️ رجوع', `r:d:${slug}`);
  await ctx.editMessageText('<b>السيارات</b>\nالسعر لليوم الواحد شاملاً السائق.', {
    parse_mode: 'HTML',
    reply_markup: kb,
  });
}

async function showTours(ctx: Context, slug: string): Promise<void> {
  const tours = await db.listTours(slug);
  const kb = new InlineKeyboard();
  for (const t of tours) kb.text(`${t.name} — ${fmt(t.price)}`, `r:et:${t.id}`).row();
  kb.text('➕ أضف جولة', `r:at:${slug}`).row().text('◀️ رجوع', `r:d:${slug}`);
  await ctx.editMessageText('<b>الجولات</b>\nالسعر للمجموعة كاملة لا للشخص.', {
    parse_mode: 'HTML',
    reply_markup: kb,
  });
}

async function showServices(ctx: Context, slug: string): Promise<void> {
  const dest = await db.getDestination(slug);
  if (!dest) return;
  const kb = new InlineKeyboard()
    .text(`نقلة المطار — ${fmt(dest.transfer_rate)}`, `r:es:${slug}:transfer_rate`).row()
    .text(`تذكرة الدخول للشخص — ${fmt(dest.ticket_pp)}`, `r:es:${slug}:ticket_pp`).row()
    .text(`يوم المرشد — ${fmt(dest.guide_rate)}`, `r:es:${slug}:guide_rate`).row()
    .text('◀️ رجوع', `r:d:${slug}`);
  await ctx.editMessageText('<b>الخدمات الثابتة</b>', { parse_mode: 'HTML', reply_markup: kb });
}

/** يطلب رقماً من المستخدم ويمرّره بعد التحقق. */
function askPrice(ctx: Context, prompt: string, onValue: (cents: number) => Promise<void>): void {
  expectText(uid(ctx), async (c, text) => {
    const cents = toCents(text);
    if (cents <= 0) {
      await c.reply('اكتب رقماً بالدولار، مثل: 85');
      askPrice(c, prompt, onValue);
      return;
    }
    await onValue(cents);
  });
  void ctx.reply(prompt, { parse_mode: 'HTML' });
}

export async function handleRatesCallback(ctx: Context, parts: string[]): Promise<boolean> {
  const [, action, a, b] = parts;

  if (action === 'back') {
    await ctx.answerCallbackQuery();
    await startRates(ctx);
    return true;
  }

  if (action === 'd') {
    await ctx.answerCallbackQuery();
    await showCategories(ctx, a!, true);
    return true;
  }

  if (action === 'c') {
    await ctx.answerCallbackQuery();
    if (a === 'h') await showHotels(ctx, b!);
    else if (a === 'c') await showCars(ctx, b!);
    else if (a === 't') await showTours(ctx, b!);
    else await showServices(ctx, b!);
    return true;
  }

  /* ---- تعديل فندق: سعران في سطر واحد ---- */
  if (action === 'eh') {
    await ctx.answerCallbackQuery();
    const id = Number(a);
    expectText(uid(ctx), async (c, text) => {
      const nums = text.trim().split(/[\s/،,]+/).map(toCents).filter((n) => n > 0);
      if (!nums.length) {
        await c.reply('اكتب السعرين هكذا: <code>85 98</code>', { parse_mode: 'HTML' });
        return;
      }
      const normal = nums[0]!;
      const high = nums[1] ?? normal;
      await db.setHotelRates(id, normal, high);
      await c.reply(`✅ تم — عادي ${fmt(normal)} · مرتفع ${fmt(high)}`);
    });
    await ctx.reply(
      'اكتب السعر الجديد للغرفة في الليلة:\n<code>العادي المرتفع</code>\n\nمثال: <code>85 98</code>\nأو رقم واحد لتساوي الموسمين.',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (action === 'ec') {
    await ctx.answerCallbackQuery();
    const id = Number(a);
    askPrice(ctx, 'سعر اليوم الجديد للسيارة بالدولار:', async (cents) => {
      await db.setCarRate(id, cents);
      await ctx.reply(`✅ تم — ${fmt(cents)} لليوم`);
    });
    return true;
  }

  if (action === 'et') {
    await ctx.answerCallbackQuery();
    const id = Number(a);
    askPrice(ctx, 'سعر الجولة الجديد للمجموعة بالدولار:', async (cents) => {
      await db.setTourPrice(id, cents);
      await ctx.reply(`✅ تم — ${fmt(cents)} للجولة`);
    });
    return true;
  }

  if (action === 'es') {
    await ctx.answerCallbackQuery();
    const slug = a!;
    const field = b as 'transfer_rate' | 'ticket_pp' | 'guide_rate';
    askPrice(ctx, `السعر الجديد لـ «${SERVICE_LABEL[field]}» بالدولار:`, async (cents) => {
      await db.setDestinationRate(slug, field, cents);
      await ctx.reply(`✅ تم — ${SERVICE_LABEL[field]} = ${fmt(cents)}`);
    });
    return true;
  }

  /* ---- إضافة ---- */
  if (action === 'at') {
    await ctx.answerCallbackQuery();
    const slug = a!;
    expectText(uid(ctx), async (c, text) => {
      const [name, price] = splitNameAndPrice(text);
      if (!name || price <= 0) {
        await c.reply('اكتب هكذا: <code>جولة أوزنجول 90</code>', { parse_mode: 'HTML' });
        return;
      }
      await db.addTour(slug, name, price);
      await c.reply(`✅ أُضيفت «${name}» بسعر ${fmt(price)}`);
    });
    await ctx.reply('اكتب اسم الجولة ثم سعرها للمجموعة:\n<code>جولة أوزنجول 90</code>', {
      parse_mode: 'HTML',
    });
    return true;
  }

  if (action === 'ah') {
    await ctx.answerCallbackQuery();
    const slug = a!;
    expectText(uid(ctx), async (c, text) => {
      // الصيغة: الاسم | الفئة | العادي | المرتفع
      const parts2 = text.split('|').map((p) => p.trim());
      const name = parts2[0];
      const cls = parts2[1] ?? '4';
      const normal = toCents(parts2[2] ?? '0');
      const high = toCents(parts2[3] ?? '0') || normal;
      if (!name || normal <= 0 || !CLASS_LABEL[cls]) {
        await c.reply(
          'الصيغة: <code>الاسم | الفئة | العادي | المرتفع</code>\nالفئة واحدة من: 3 · 4 · 5 · cabin\n\nمثال:\n<code>كوخ كيانا | cabin | 120 | 138</code>',
          { parse_mode: 'HTML' },
        );
        return;
      }
      await db.addHotel({ destination: slug, name, class: cls, rate_normal: normal, rate_high: high });
      await c.reply(`✅ أُضيف «${name}» — ${fmt(normal)} / ${fmt(high)}`);
    });
    await ctx.reply(
      'اكتب بيانات الفندق:\n<code>الاسم | الفئة | العادي | المرتفع</code>\n\nالفئة: 3 أو 4 أو 5 أو cabin\n\nمثال:\n<code>كوخ كيانا | cabin | 120 | 138</code>',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  return false;
}

/** يفصل «جولة أوزنجول 90» إلى اسم وسعر. */
function splitNameAndPrice(text: string): [string, number] {
  const m = text.trim().match(/^(.*?)[\s|]+([\d.,]+)\s*$/);
  if (!m) return ['', 0];
  return [m[1]!.trim(), toCents(m[2]!)];
}
