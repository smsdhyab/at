/**
 * تعديل الأسعار: الفنادق والسيارات والجولات وخدمات الوجهة.
 * الخطوات المنتظرة بأسماء محفوظة في القاعدة — انظر `state.ts`.
 */
import { InlineKeyboard, type Context } from 'grammy';
import { toCents } from '../pricing.ts';
import * as db from '../db.ts';
import { getSession, expectStep, clearStep, type Session } from '../state.ts';
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
  const destinations = db.listDestinations();
  await ctx.reply('<b>الأسعار</b>\n\nاختر الوجهة:', {
    parse_mode: 'HTML',
    reply_markup: keyboard(destinations, (d) => d.name, (d) => `r:d:${d.slug}`, 1),
  });
}

async function showCategories(ctx: Context, slug: string, edit: boolean): Promise<void> {
  const dest = db.getDestination(slug);
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
  const kb = new InlineKeyboard();
  for (const h of db.listHotels(slug)) {
    kb.text(
      `${CLASS_LABEL[h.class] ?? h.class} · ${h.name} — ${fmt(h.rate_normal)} / ${fmt(h.rate_high)}`,
      `r:eh:${h.id}`,
    ).row();
  }
  kb.text('➕ أضف فندقاً', `r:ah:${slug}`).row().text('◀️ رجوع', `r:d:${slug}`);
  await ctx.editMessageText(
    '<b>الفنادق</b>\nالسعر معروض هكذا: <code>عادي / مرتفع</code> للغرفة في الليلة.\n' +
      'اضغط على فندق لتعديل سعره.',
    { parse_mode: 'HTML', reply_markup: kb },
  );
}

async function showCars(ctx: Context, slug: string): Promise<void> {
  const kb = new InlineKeyboard();
  for (const c of db.listCars(slug)) kb.text(`${c.name} — ${fmt(c.rate_day)} / يوم`, `r:ec:${c.id}`).row();
  kb.text('◀️ رجوع', `r:d:${slug}`);
  await ctx.editMessageText('<b>السيارات</b>\nالسعر لليوم الواحد شاملاً السائق.', {
    parse_mode: 'HTML',
    reply_markup: kb,
  });
}

async function showTours(ctx: Context, slug: string): Promise<void> {
  const kb = new InlineKeyboard();
  for (const t of db.listTours(slug)) kb.text(`${t.name} — ${fmt(t.price)}`, `r:et:${t.id}`).row();
  kb.text('➕ أضف جولة', `r:at:${slug}`).row().text('◀️ رجوع', `r:d:${slug}`);
  await ctx.editMessageText('<b>الجولات</b>\nالسعر للمجموعة كاملة لا للشخص.', {
    parse_mode: 'HTML',
    reply_markup: kb,
  });
}

async function showServices(ctx: Context, slug: string): Promise<void> {
  const dest = db.getDestination(slug);
  if (!dest) return;
  const kb = new InlineKeyboard()
    .text(`نقلة المطار — ${fmt(dest.transfer_rate)}`, `r:es:${slug}:transfer_rate`).row()
    .text(`تذكرة الدخول للشخص — ${fmt(dest.ticket_pp)}`, `r:es:${slug}:ticket_pp`).row()
    .text(`يوم المرشد — ${fmt(dest.guide_rate)}`, `r:es:${slug}:guide_rate`).row()
    .text('◀️ رجوع', `r:d:${slug}`);
  await ctx.editMessageText('<b>الخدمات الثابتة</b>', { parse_mode: 'HTML', reply_markup: kb });
}

/** يفصل «جولة أوزنجول 90» إلى اسم وسعر. */
function splitNameAndPrice(text: string): [string, number] {
  const m = text.trim().match(/^(.*?)[\s|]+([\d.,]+)\s*$/);
  if (!m) return ['', 0];
  return [m[1]!.trim(), toCents(m[2]!)];
}

/** يعالج الرسالة النصية المنتظرة. يعيد true إن كانت الخطوة تخصّه. */
export async function handleRatesStep(ctx: Context, s: Session, text: string): Promise<boolean> {
  const arg = s.arg ?? '';

  switch (s.step) {
    case 'r.hotel': {
      const nums = text.trim().split(/[\s/،,]+/).map(toCents).filter((n) => n > 0);
      if (!nums.length) {
        await ctx.reply('اكتب السعرين هكذا: <code>85 98</code>', { parse_mode: 'HTML' });
        return true;
      }
      const normal = nums[0]!;
      const high = nums[1] ?? normal;
      db.setHotelRates(Number(arg), normal, high);
      clearStep(s);
      await ctx.reply(`✅ تم — عادي ${fmt(normal)} · مرتفع ${fmt(high)}`);
      return true;
    }

    case 'r.car':
    case 'r.tour':
    case 'r.service': {
      const cents = toCents(text);
      if (cents <= 0) {
        await ctx.reply('اكتب رقماً بالدولار، مثل: <code>85</code>', { parse_mode: 'HTML' });
        return true;
      }
      if (s.step === 'r.car') {
        db.setCarRate(Number(arg), cents);
        await ctx.reply(`✅ تم — ${fmt(cents)} لليوم`);
      } else if (s.step === 'r.tour') {
        db.setTourPrice(Number(arg), cents);
        await ctx.reply(`✅ تم — ${fmt(cents)} للجولة`);
      } else {
        const [slug, field] = arg.split('|');
        db.setDestinationRate(slug!, field as db.DestRateField, cents);
        await ctx.reply(`✅ تم — ${SERVICE_LABEL[field!]} = ${fmt(cents)}`);
      }
      clearStep(s);
      return true;
    }

    case 'r.addTour': {
      const [name, price] = splitNameAndPrice(text);
      if (!name || price <= 0) {
        await ctx.reply('اكتب هكذا: <code>جولة أوزنجول 90</code>', { parse_mode: 'HTML' });
        return true;
      }
      db.addTour(arg, name, price);
      clearStep(s);
      await ctx.reply(`✅ أُضيفت «${name}» بسعر ${fmt(price)}`);
      return true;
    }

    case 'r.addHotel': {
      // الصيغة: الاسم | الفئة | العادي | المرتفع
      const parts = text.split('|').map((p) => p.trim());
      const name = parts[0];
      const cls = parts[1] ?? '4';
      const normal = toCents(parts[2] ?? '0');
      const high = toCents(parts[3] ?? '0') || normal;
      if (!name || normal <= 0 || !CLASS_LABEL[cls]) {
        await ctx.reply(
          'الصيغة: <code>الاسم | الفئة | العادي | المرتفع</code>\n' +
            'الفئة واحدة من: 3 · 4 · 5 · cabin\n\n' +
            'مثال:\n<code>كوخ كيانا | cabin | 120 | 138</code>',
          { parse_mode: 'HTML' },
        );
        return true;
      }
      db.addHotel({ destination: arg, name, class: cls, rate_normal: normal, rate_high: high });
      clearStep(s);
      await ctx.reply(`✅ أُضيف «${name}» — ${fmt(normal)} / ${fmt(high)}`);
      return true;
    }

    default:
      return false;
  }
}

export async function handleRatesCallback(ctx: Context, parts: string[]): Promise<boolean> {
  const s = getSession(uid(ctx));
  const [, action, a, b] = parts;

  switch (action) {
    case 'back':
      await ctx.answerCallbackQuery();
      await startRates(ctx);
      return true;

    case 'd':
      await ctx.answerCallbackQuery();
      await showCategories(ctx, a!, true);
      return true;

    case 'c':
      await ctx.answerCallbackQuery();
      if (a === 'h') await showHotels(ctx, b!);
      else if (a === 'c') await showCars(ctx, b!);
      else if (a === 't') await showTours(ctx, b!);
      else await showServices(ctx, b!);
      return true;

    case 'eh':
      await ctx.answerCallbackQuery();
      expectStep(s, 'r.hotel', a!);
      await ctx.reply(
        'اكتب السعر الجديد للغرفة في الليلة:\n<code>العادي المرتفع</code>\n\n' +
          'مثال: <code>85 98</code>\nأو رقم واحد لتساوي الموسمين.',
        { parse_mode: 'HTML' },
      );
      return true;

    case 'ec':
      await ctx.answerCallbackQuery();
      expectStep(s, 'r.car', a!);
      await ctx.reply('سعر اليوم الجديد للسيارة بالدولار:');
      return true;

    case 'et':
      await ctx.answerCallbackQuery();
      expectStep(s, 'r.tour', a!);
      await ctx.reply('سعر الجولة الجديد للمجموعة بالدولار:');
      return true;

    case 'es':
      await ctx.answerCallbackQuery();
      expectStep(s, 'r.service', `${a}|${b}`);
      await ctx.reply(`السعر الجديد لـ «${SERVICE_LABEL[b ?? '']}» بالدولار:`);
      return true;

    case 'at':
      await ctx.answerCallbackQuery();
      expectStep(s, 'r.addTour', a!);
      await ctx.reply('اكتب اسم الجولة ثم سعرها للمجموعة:\n<code>جولة أوزنجول 90</code>', {
        parse_mode: 'HTML',
      });
      return true;

    case 'ah':
      await ctx.answerCallbackQuery();
      expectStep(s, 'r.addHotel', a!);
      await ctx.reply(
        'اكتب بيانات الفندق:\n<code>الاسم | الفئة | العادي | المرتفع</code>\n\n' +
          'الفئة: 3 أو 4 أو 5 أو cabin\n\nمثال:\n<code>كوخ كيانا | cabin | 120 | 138</code>',
        { parse_mode: 'HTML' },
      );
      return true;

    default:
      return false;
  }
}
