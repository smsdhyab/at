/**
 * تعديل الأسعار: الفنادق والسيارات والجولات وخدمات الوجهة.
 * الخطوات المنتظرة بأسماء محفوظة في القاعدة — انظر `state.ts`.
 */
import { InlineKeyboard, type Context } from 'grammy';
import { toCents } from '../pricing.ts';
import * as db from '../db.ts';
import { getSession, expectStep, clearStep, type Session } from '../state.ts';
import { fmt, keyboard } from '../ui.ts';
import { marginPerDay, setMarginPerDay, wpConfigured } from '../policy.ts';

const uid = (ctx: Context) => ctx.from?.id ?? 0;

const CLASS_LABEL: Record<string, string> = {
  '3': '3 نجوم',
  '4': '4 نجوم',
  '5': '5 نجوم',
  cabin: 'كوخ / شاليه',
};

/** أنواع السيارات — مغلقة لأن محرك التسعير يبحث عنها بهذه المفاتيح. */
const CAR_KINDS: Record<string, string> = {
  sedan: 'سيدان',
  van: 'فان',
  vip: 'فان VIP',
};

const SERVICE_LABEL: Record<string, string> = {
  transfer_rate: 'نقلة المطار',
  ticket_pp: 'تذكرة الدخول للشخص',
  guide_rate: 'يوم المرشد',
};

export async function startRates(ctx: Context): Promise<void> {
  const destinations = await db.listDestinations();
  const kb = keyboard(destinations, (d) => d.name, (d) => `r:d:${d.slug}`, 1);
  kb.row().text(`💰 سياسة الربح — ${fmt(await marginPerDay())} لليوم`, 'r:pol');
  await ctx.reply('<b>الأسعار</b>\n\nاختر الوجهة:', { parse_mode: 'HTML', reply_markup: kb });
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
  const kb = new InlineKeyboard();
  for (const h of await db.listHotels(slug)) {
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
  for (const c of await db.listCars(slug)) kb.text(`${c.name} — ${fmt(c.rate_day)} / يوم`, `r:ec:${c.id}`).row();
  kb.text('➕ أضف سيارة', `r:ac:${slug}`).row().text('◀️ رجوع', `r:d:${slug}`);
  await ctx.editMessageText('<b>السيارات</b>\nالسعر لليوم الواحد شاملاً السائق.', {
    parse_mode: 'HTML',
    reply_markup: kb,
  });
}

async function showTours(ctx: Context, slug: string): Promise<void> {
  const kb = new InlineKeyboard();
  for (const t of await db.listTours(slug)) kb.text(`${t.name} — ${fmt(t.price)}`, `r:et:${t.id}`).row();
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
    .text(`يوم المرشد — ${fmt(dest.guide_rate)}`, `r:es:${slug}:guide_rate`).row();
  for (const x of await db.listServices(slug)) {
    kb.text(`${x.name} — ${fmt(x.price)} ${db.SERVICE_UNITS[x.unit] ?? ''}`, `r:ex:${x.id}`).row();
  }
  kb.text('➕ أضف خدمة', `r:as:${slug}`).row().text('◀️ رجوع', `r:d:${slug}`);
  await ctx.editMessageText(
    '<b>الخدمات</b>\nالثلاث الأولى ثابتة لكل وجهة ويستعملها المحرّك تلقائياً.' +
      '\nما تحتها خدمات إضافية تُضاف إلى العرض عند الحاجة.',
    { parse_mode: 'HTML', reply_markup: kb },
  );
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
      await db.setHotelRates(Number(arg), normal, high);
      await clearStep(s);
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
        await db.setCarRate(Number(arg), cents);
        await ctx.reply(`✅ تم — ${fmt(cents)} لليوم`);
      } else if (s.step === 'r.tour') {
        await db.setTourPrice(Number(arg), cents);
        await ctx.reply(`✅ تم — ${fmt(cents)} للجولة`);
      } else {
        const [slug, field] = arg.split('|');
        await db.setDestinationRate(slug!, field as db.DestRateField, cents);
        await ctx.reply(`✅ تم — ${SERVICE_LABEL[field!]} = ${fmt(cents)}`);
      }
      await clearStep(s);
      return true;
    }

    case 'r.policy': {
      const cents = toCents(text);
      if (cents < 0 || !Number.isFinite(cents)) {
        await ctx.reply('اكتب رقماً بالدولار لليوم الواحد، مثل: <code>40</code>', { parse_mode: 'HTML' });
        return true;
      }
      const { wp } = await setMarginPerDay(cents);
      await clearStep(s);
      await ctx.reply(
        `✅ سياسة الربح: ${fmt(cents)} لليوم الواحد` +
          (wp === true ? '\nوصلت إلى الموقع أيضاً.' : wp === false ? '\n⚠️ لم تصل إلى الموقع — تحقق من WP_APP_PASSWORD.' : ''),
      );
      return true;
    }

    case 'r.extraService': {
      const cents = toCents(text);
      if (cents <= 0) {
        await ctx.reply('اكتب رقماً بالدولار، مثل: <code>45</code>', { parse_mode: 'HTML' });
        return true;
      }
      await db.setServicePrice(Number(arg), cents);
      await clearStep(s);
      await ctx.reply(`✅ تم — ${fmt(cents)}`);
      return true;
    }

    case 'r.addService': {
      // الصيغة: الاسم | السعر | الوحدة
      const parts = text.split('|').map((x) => x.trim());
      const name = parts[0];
      const price = toCents(parts[1] ?? '0');
      const unit = (parts[2] ?? 'per_trip').toLowerCase();
      if (!name || price <= 0 || !db.SERVICE_UNITS[unit]) {
        await ctx.reply(
          'الصيغة: <code>الاسم | السعر | الوحدة</code>\n' +
            'الوحدة واحدة من: per_trip · per_night · per_person · once\n\n' +
            'مثال:\n<code>نقلة مطار صبيحة | 45 | per_trip</code>',
          { parse_mode: 'HTML' },
        );
        return true;
      }
      await db.addService(arg, name, price, unit);
      await clearStep(s);
      await ctx.reply(`✅ أُضيفت «${name}» — ${fmt(price)} ${db.SERVICE_UNITS[unit]}`);
      return true;
    }

    case 'r.addTour': {
      const [name, price] = splitNameAndPrice(text);
      if (!name || price <= 0) {
        await ctx.reply('اكتب هكذا: <code>جولة أوزنجول 90</code>', { parse_mode: 'HTML' });
        return true;
      }
      await db.addTour(arg, name, price);
      await clearStep(s);
      await ctx.reply(`✅ أُضيفت «${name}» بسعر ${fmt(price)}`);
      return true;
    }

    case 'r.addCar': {
      // الصيغة: النوع | الاسم | السعر
      const parts = text.split('|').map((x) => x.trim());
      const kind = (parts[0] ?? '').toLowerCase();
      const name = parts[1];
      const rate = toCents(parts[2] ?? '0');
      if (!CAR_KINDS[kind] || !name || rate <= 0) {
        await ctx.reply(
          'الصيغة: <code>النوع | الاسم | السعر</code>\n' +
            'النوع واحد من: sedan · van · vip\n\n' +
            'مثال:\n<code>van | فان مرسيدس مع سائق | 110</code>',
          { parse_mode: 'HTML' },
        );
        return true;
      }
      await db.addCar(arg, kind, name, rate);
      await clearStep(s);
      await ctx.reply(`✅ أُضيفت «${name}» — ${fmt(rate)} لليوم`);
      return true;
    }

    case 'r.addHotel': {
      // الصيغة: الاسم | الفئة | العادي | المرتفع
      const parts = text.split('|').map((p) => p.trim());
      const name = parts[0];
      const cls = parts[1] ?? '4';
      const normal = toCents(parts[2] ?? '0');
      const high = toCents(parts[3] ?? '0') || normal;
      // فرق السرير الثالث اختياري: 35٪ من سعر الغرفة تقدير معقول حتى يُعدَّل
      const triple = toCents(parts[4] ?? '0') || Math.round((normal * 35) / 100 / 100) * 100;
      if (!name || normal <= 0 || !CLASS_LABEL[cls]) {
        await ctx.reply(
          'الصيغة: <code>الاسم | الفئة | العادي | المرتفع | السرير_الثالث</code>\n' +
            'الفئة واحدة من: 3 · 4 · 5 · cabin\n\n' +
            'مثال:\n<code>كوخ كيانا | cabin | 120 | 138 | 45</code>',
          { parse_mode: 'HTML' },
        );
        return true;
      }
      // النجوم تساوي الخانة عند الإضافة من البوت؛ تُعدَّل من القاعدة إن اختلفتا
      await db.addHotel({
        destination: arg, name, class: cls, stars: cls,
        rate_normal: normal, rate_high: high, rate_triple: triple,
      });
      await clearStep(s);
      await ctx.reply(
        `✅ أُضيف «${name}» — ${fmt(normal)} / ${fmt(high)} · سرير ثالث ${fmt(triple)}`,
      );
      return true;
    }

    default:
      return false;
  }
}

export async function handleRatesCallback(ctx: Context, parts: string[]): Promise<boolean> {
  const s = await getSession(uid(ctx));
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
      await expectStep(s, 'r.hotel', a!);
      await ctx.reply(
        'اكتب السعر الجديد للغرفة في الليلة:\n<code>العادي المرتفع</code>\n\n' +
          'مثال: <code>85 98</code>\nأو رقم واحد لتساوي الموسمين.',
        { parse_mode: 'HTML' },
      );
      return true;

    case 'ec':
      await ctx.answerCallbackQuery();
      await expectStep(s, 'r.car', a!);
      await ctx.reply('سعر اليوم الجديد للسيارة بالدولار:');
      return true;

    case 'et':
      await ctx.answerCallbackQuery();
      await expectStep(s, 'r.tour', a!);
      await ctx.reply('سعر الجولة الجديد للمجموعة بالدولار:');
      return true;

    case 'es':
      await ctx.answerCallbackQuery();
      await expectStep(s, 'r.service', `${a}|${b}`);
      await ctx.reply(`السعر الجديد لـ «${SERVICE_LABEL[b ?? '']}» بالدولار:`);
      return true;

    case 'pol':
      await ctx.answerCallbackQuery();
      await expectStep(s, 'r.policy');
      await ctx.reply(
        'ربح الشركة لكل يوم من أيام البرنامج، بالدولار (يُضرب في الليالي + 1).' +
          '\nسياسة داخلية لا تظهر للزبون. <code>0</code> يعيد نسب الفئات.' +
          (wpConfigured() ? '' : '\n\nملاحظة: الموقع غير مربوط بعد (WP_URL) — تُحفظ في القاعدة فقط.'),
        { parse_mode: 'HTML' },
      );
      return true;

    case 'ex':
      await ctx.answerCallbackQuery();
      await expectStep(s, 'r.extraService', a!);
      await ctx.reply('السعر الجديد بالدولار:');
      return true;

    case 'as':
      await ctx.answerCallbackQuery();
      await expectStep(s, 'r.addService', a!);
      await ctx.reply(
        'اكتب بيانات الخدمة:\n<code>الاسم | السعر | الوحدة</code>\n\n' +
          'الوحدة: per_trip أو per_night أو per_person أو once\n\n' +
          'مثال:\n<code>نقلة مطار صبيحة | 45 | per_trip</code>',
        { parse_mode: 'HTML' },
      );
      return true;

    case 'at':
      await ctx.answerCallbackQuery();
      await expectStep(s, 'r.addTour', a!);
      await ctx.reply('اكتب اسم الجولة ثم سعرها للمجموعة:\n<code>جولة أوزنجول 90</code>', {
        parse_mode: 'HTML',
      });
      return true;

    case 'ac':
      await ctx.answerCallbackQuery();
      await expectStep(s, 'r.addCar', a!);
      await ctx.reply(
        'اكتب بيانات السيارة:\n<code>النوع | الاسم | السعر لليوم</code>\n\n' +
          'النوع: sedan أو van أو vip\n\n' +
          'مثال:\n<code>van | فان مرسيدس مع سائق | 110</code>',
        { parse_mode: 'HTML' },
      );
      return true;

    case 'ah':
      await ctx.answerCallbackQuery();
      await expectStep(s, 'r.addHotel', a!);
      await ctx.reply(
        'اكتب بيانات الفندق:\n' +
          '<code>الاسم | الفئة | العادي | المرتفع | السرير_الثالث</code>\n\n' +
          'الفئة: 3 أو 4 أو 5 أو cabin\n' +
          'السرير الثالث اختياري — يُقدَّر بـ 35٪ من سعر الغرفة إن تُرك\n\n' +
          'مثال:\n<code>كوخ كيانا | cabin | 120 | 138 | 45</code>',
        { parse_mode: 'HTML' },
      );
      return true;

    default:
      return false;
  }
}
