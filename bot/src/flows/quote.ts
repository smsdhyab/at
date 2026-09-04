/**
 * معالج بناء عرض السعر خطوة بخطوة.
 *
 * الحالة كلها في قاعدة البيانات لا في الذاكرة، والخطوة المنتظرة نص مثل
 * `q.dates` يوزّعه `handleQuoteStep`. السبب في `state.ts`.
 *
 * الموسم: الفنادق تحمل سعرين حقيقيين (عادي ومرتفع) من عقد المورّد، لذلك يختار
 * البوت السعر المناسب من الصف ويمرّر `season: 'normal'` للمحرك — وإلا حُسب
 * الموسم مرتين. معامل الموسم في المحرك مخصص للحالات التي لا تتوفر فيها أسعار
 * موسمية حقيقية.
 */
import { InlineKeyboard, InputFile, type Context } from 'grammy';
import {
  threeTiers,
  planRooms,
  toCents,
  type QuoteInput,
  type Tier,
  type TierOffer,
  type TierRates,
} from '../pricing.ts';
import * as db from '../db.ts';
import {
  getSession, save, expectStep, clearStep, resetDraft, dropSession, hasDraft,
  type Session,
} from '../state.ts';
import { fmt, keyboard, tiersSummary, internalBreakdown, customerOffer, CURRENCY } from '../ui.ts';
import { toOfferDoc, toCardDoc } from '../offerdoc.ts';
import { offerHtml } from '../templates/offer.ts';
import { cardHtml, CARD_DIMENSIONS, type CardSize } from '../templates/card.ts';
import { renderPdf, renderPng } from '../render.ts';
import {
  buildDays, splitNights, parseRoute, parsePractical,
  type Day, type RouteNight, type Practical,
} from '../itinerary.ts';

/** إعدادات ثابتة — تنتقل للوحة التحكم لاحقاً. */
const FEES_BP = 250;
const DEPOSIT_PCT = 30;
const ROUND_TO = 1_000; // 10 دولارات

const uid = (ctx: Context) => ctx.from?.id ?? 0;

const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

/** يستخرج تاريخين ويحسب الليالي بينهما. */
function parseDates(text: string): { depart: string; ret: string; nights: number } | null {
  const found = text.match(/\d{4}-\d{1,2}-\d{1,2}/g);
  if (!found || found.length < 2) return null;
  const toDate = (v: string) => {
    const [y, m, d] = v.split('-').map(Number);
    return Date.UTC(y!, m! - 1, d!);
  };
  const a = toDate(found[0]!);
  const b = toDate(found[1]!);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  const nights = Math.round((b - a) / 86_400_000);
  if (nights < 1 || nights > 60) return null;
  return { depart: found[0]!, ret: found[1]!, nights };
}

/** الموسم يُشتقّ من شهر المغادرة بدل أن يُسأل عنه — سؤال أقل على الموظف. */
function seasonOf(depart: string): 'normal' | 'high' {
  const month = Number(depart.split('-')[1]);
  return month >= 6 && month <= 9 ? 'high' : 'normal';
}

function monthLabel(depart: string): string {
  const [y, m] = depart.split('-');
  return `${AR_MONTHS[Number(m) - 1] ?? m} ${y}`;
}

/* ------------------------------ الخطوات ------------------------------ */

export async function startQuote(ctx: Context): Promise<void> {
  await resetDraft(uid(ctx));
  const destinations = await db.listDestinations();
  if (!destinations.length) {
    await ctx.reply('لا توجد وجهات بعد. شغّل «npm run migrate» أولاً.');
    return;
  }
  await ctx.reply('<b>عرض سعر جديد</b>\n\nاختر الوجهة:', {
    parse_mode: 'HTML',
    reply_markup: keyboard(destinations, (d) => d.name, (d) => `q:dest:${d.slug}`, 1),
  });
}

async function askDates(ctx: Context, s: Session): Promise<void> {
  await expectStep(s, 'q.dates');
  await ctx.reply(
    `الوجهة: <b>${s.draft.destinationName}</b>\n\n` +
      'اكتب تاريخ المغادرة وتاريخ العودة:\n' +
      '<code>2026-07-10 2026-07-16</code>\n\n' +
      'أحسب الأيام والليالي والموسم منهما.',
    { parse_mode: 'HTML' },
  );
}

async function askAdults(ctx: Context, s: Session): Promise<void> {
  await expectStep(s, 'q.adults');
  const d = s.draft;
  await ctx.reply(
    `<b>${d.nights} ليالٍ / ${d.nights! + 1} أيام</b> · ` +
      `${d.season === 'high' ? 'موسم مرتفع' : 'موسم عادي'}\n\nكم عدد البالغين؟`,
    { parse_mode: 'HTML' },
  );
}

async function askKids(ctx: Context, s: Session): Promise<void> {
  await expectStep(s, 'q.kids');
  await ctx.reply(
    'كم عدد الأطفال؟ اكتب رقمين:\n' +
      '<code>أقل_من_6   6_فأكثر</code>\n\n' +
      'مثال: <code>1 2</code> — طفل دون السادسة وطفلان فوقها.\n' +
      'اكتب <code>0 0</code> إن لم يكن معكم أطفال.\n\n' +
      '• دون السادسة: <b>مجاناً</b> — بلا سرير ولا تذكرة\n' +
      '• من ست فأكثر: سرير إضافي يحوّل الغرفة إلى ثلاثية',
    { parse_mode: 'HTML' },
  );
}

async function askTours(ctx: Context, s: Session, edit = false): Promise<void> {
  const tours = await db.listTours(s.draft.destination!);
  if (!tours.length) {
    await ctx.reply('لا توجد جولات لهذه الوجهة. أضفها من 💰 الأسعار ثم أعد المحاولة.');
    return;
  }
  const chosen = new Set(s.draft.tourIds);
  const kb = new InlineKeyboard();
  for (const t of tours) {
    kb.text(`${chosen.has(t.id) ? '✅' : '▫️'} ${t.name} — ${fmt(t.price)}`, `q:tour:${t.id}`).row();
  }
  kb.text('◀️ احسب السعر', 'q:calc');

  const text =
    '<b>اختر الجولات</b>\nاضغط على الجولة لإضافتها أو إزالتها.\n\n' +
    `المختار: ${chosen.size} جولة`;
  if (edit) await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  else await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
}

/**
 * يعالج الرسالة النصية المنتظرة. يعيد true إن كانت الخطوة تخصّه.
 * هذا بديل الدوال المغلقة التي كانت تعيش في الذاكرة.
 */
export async function handleQuoteStep(ctx: Context, s: Session, text: string): Promise<boolean> {
  switch (s.step) {
    case 'q.dates': {
      const parsed = parseDates(text);
      if (!parsed) {
        await ctx.reply('لم أفهم التاريخين. اكتبهما هكذا:\n<code>2026-07-10 2026-07-16</code>', {
          parse_mode: 'HTML',
        });
        return true; // الخطوة باقية — ننتظر إجابة صحيحة
      }
      s.draft.departDate = parsed.depart;
      s.draft.returnDate = parsed.ret;
      s.draft.nights = parsed.nights;
      s.draft.season = seasonOf(parsed.depart);
      s.draft.travelMonth = monthLabel(parsed.depart);
      await save(s);
      await askAdults(ctx, s);
      return true;
    }

    case 'q.adults': {
      const n = parseInt(text.replace(/\D/g, ''), 10);
      if (!n || n < 1 || n > 30) {
        await ctx.reply('اكتب رقماً بين 1 و30.');
        return true;
      }
      s.draft.adults = n;
      await save(s);
      await askKids(ctx, s);
      return true;
    }

    case 'q.kids': {
      const nums = text.trim().split(/[\s،,]+/).map((p) => parseInt(p.replace(/\D/g, ''), 10));
      const free = nums[0];
      const bed = Number.isFinite(nums[1]) ? nums[1]! : 0;
      if (!Number.isFinite(free) || free! < 0 || bed < 0 || free! > 20 || bed > 20) {
        await ctx.reply('اكتب رقمين: <code>1 2</code> — أو <code>0 0</code>', {
          parse_mode: 'HTML',
        });
        return true;
      }
      s.draft.childrenFree = free!;
      s.draft.childrenBed = bed;
      await clearStep(s);

      const plan = planRooms(s.draft.adults!, bed);
      await ctx.reply(
        '<b>توزيع الغرف</b>\n' +
          `${plan.rooms} ${plan.rooms === 1 ? 'غرفة' : 'غرف'}` +
          (plan.triples ? ` · منها ${plan.triples} ثلاثية بسرير إضافي` : '') +
          (free ? `\n${free} طفل دون السادسة — مجاناً` : '') +
          '\n\nالآن اختر الجولات:',
        { parse_mode: 'HTML' },
      );
      await askTours(ctx, s);
      return true;
    }

    case 'q.guide': {
      const n = parseInt(text.replace(/\D/g, ''), 10);
      if (!Number.isFinite(n) || n < 0 || n > 30) {
        await ctx.reply('اكتب رقماً بين 0 و30.');
        return true;
      }
      s.draft.guideDays = n;
      await clearStep(s);
      await ctx.reply(n ? `✅ مرشد ${n} يوم` : '✅ بلا مرشد');
      await showResult(ctx, s);
      return true;
    }

    case 'q.transfers': {
      const n = parseInt(text.replace(/\D/g, ''), 10);
      if (!Number.isFinite(n) || n < 0 || n > 10) {
        await ctx.reply('اكتب رقماً بين 0 و10.');
        return true;
      }
      s.draft.transfers = n;
      await clearStep(s);
      await ctx.reply(`✅ ${n} نقلة مطار`);
      await showResult(ctx, s);
      return true;
    }

    case 'q.extras': {
      const nums = text.trim().split(/[\s،,]+/).map((x) => toCents(x));
      if (nums.length < 1) {
        await ctx.reply('اكتب ثلاثة أرقام: <code>5 25 0</code>', { parse_mode: 'HTML' });
        return true;
      }
      s.draft.simPerPerson = nums[0] ?? 0;
      s.draft.dinnerPerPerson = nums[1] ?? 0;
      s.draft.miscTotal = nums[2] ?? 0;
      await clearStep(s);
      await ctx.reply(
        `✅ شريحة ${fmt(s.draft.simPerPerson)} · عشاء ${fmt(s.draft.dinnerPerPerson)} · ` +
          `متفرقات ${fmt(s.draft.miscTotal)}`,
      );
      await showResult(ctx, s);
      return true;
    }

    case 'q.margin': {
      const n = parseInt(text.replace(/\D/g, ''), 10);
      if (!Number.isFinite(n) || n < 0 || n > 80) {
        await ctx.reply('اكتب نسبة بين 0 و80.');
        return true;
      }
      s.draft.marginPct = n > 0 ? n : undefined;
      await clearStep(s);
      await ctx.reply(n ? `✅ هامش موحّد ${n}٪` : '✅ عاد لهوامش الفئات');
      await showResult(ctx, s);
      return true;
    }

    case 'q.customer': {
      const clean = text.trim();
      const skip = clean === '-' || clean === '';
      const phone = clean.match(/[+\d][\d\s-]{6,}/)?.[0];
      s.draft.customerPhone = skip ? undefined : phone?.replace(/[\s-]/g, '');
      s.draft.customerName = skip ? undefined : clean.replace(phone ?? '', '').trim() || undefined;
      await clearStep(s);
      await persist(ctx, s);
      return true;
    }

    default:
      return false;
  }
}

/* ------------------------------ الحساب ------------------------------ */

interface Built {
  offers: TierOffer[];
  tourNames: string[];
  input: QuoteInput;
  hotelClasses: Partial<Record<Tier, string>>;
  heroImage: string;
  gallery: string[];
  imageCredits: string;
  itinerary: Day[];
  route: RouteNight[];
  practical: Practical;
}

async function buildOffers(s: Session): Promise<Built | null> {
  const d = s.draft;
  const dest = d.destination ? await db.getDestination(d.destination) : undefined;
  if (!dest || !d.nights || !d.adults) return null;

  const { three, four, five, cabin, all } = await db.hotelsByClass(dest.slug);
  const fallback = all[0];
  if (!fallback) return null;

  const high = d.season === 'high';
  const rateOf = (h: db.Hotel | undefined) => {
    const row = h ?? fallback;
    return high ? row.rate_high : row.rate_normal;
  };
  const tripleOf = (h: db.Hotel | undefined) => (h ?? fallback).rate_triple;

  // الفندق المختار يدوياً يتقدّم على الاختيار التلقائي بالفئة
  const auto: Record<Tier, db.Hotel | undefined> = {
    economy: three, premium: four, vip: five ?? cabin,
  };
  const hotelFor = (t: Tier): db.Hotel => {
    const id = d.hotelIds?.[t];
    return (id ? all.find((h) => h.id === id) : undefined) ?? auto[t] ?? fallback;
  };

  const [sedan, van, vip] = await Promise.all([
    db.carByKind(dest.slug, 'sedan'),
    db.carByKind(dest.slug, 'van'),
    db.carByKind(dest.slug, 'vip'),
  ]);

  const chosen = new Set(d.tourIds);
  const tours = (await db.listTours(dest.slug)).filter((t) => chosen.has(t.id));
  const route = parseRoute(dest.route);

  const input: QuoteInput = {
    nights: d.nights,
    adults: d.adults,
    childrenFree: d.childrenFree ?? 0,
    childrenBed: d.childrenBed ?? 0,
    // الموسم مطبّق في سعر الفندق المختار أعلاه — لا يُطبّق مرتين
    season: 'normal',
    hotelRate: rateOf(hotelFor('premium')),
    tripleExtra: tripleOf(hotelFor('premium')),
    hotelNights: d.nights,
    carRate: van?.rate_day ?? 0,
    carDays: Math.max(0, d.nights - 1),
    transfers: d.transfers ?? 2,
    transferRate: dest.transfer_rate,
    tours: tours.map((t) => ({ name: t.name, price: t.price })),
    ticketPerPerson: dest.ticket_pp,
    guideDays: d.guideDays ?? 0,
    guideRate: dest.guide_rate,
    simPerPerson: d.simPerPerson ?? 0,
    dinnerPerPerson: d.dinnerPerPerson ?? 0,
    miscTotal: d.miscTotal ?? 0,
    marginPct: d.marginPct ?? 22,
    feesBp: FEES_BP,
    depositPct: DEPOSIT_PCT,
    roundTo: ROUND_TO,
  };

  const rates: Record<Tier, TierRates> = {
    economy: {
      hotelRate: rateOf(hotelFor('economy')), tripleExtra: tripleOf(hotelFor('economy')),
      carRate: sedan?.rate_day ?? 0, guideIncluded: false,
      hotelName: hotelFor('economy').name, marginPct: d.marginPct,
    },
    premium: {
      hotelRate: rateOf(hotelFor('premium')), tripleExtra: tripleOf(hotelFor('premium')),
      carRate: van?.rate_day ?? 0, guideIncluded: false,
      hotelName: hotelFor('premium').name, marginPct: d.marginPct,
    },
    vip: {
      hotelRate: rateOf(hotelFor('vip')), tripleExtra: tripleOf(hotelFor('vip')),
      carRate: vip?.rate_day ?? 0, guideIncluded: true,
      hotelName: hotelFor('vip').name, marginPct: d.marginPct,
    },
  };

  return {
    offers: threeTiers(input, rates),
    tourNames: tours.map((t) => t.name),
    input,
    heroImage: dest.hero_image,
    gallery: db.galleryOf(dest),
    imageCredits: dest.image_credits,
    itinerary: buildDays(d.nights, tours, route),
    route: splitNights(route, d.nights),
    practical: parsePractical(dest.practical),
    hotelClasses: {
      economy: hotelFor('economy').class,
      premium: hotelFor('premium').class,
      vip: hotelFor('vip').class,
    },
  };
}

/** يحوّل المسودة والعروض إلى مستند زبون — بلا تكلفة ولا ربح. */
function buildDoc(s: Session, built: Built) {
  const d = s.draft;
  return toOfferDoc({
    serial: d.savedSerial ?? 'مسودة',
    destinationName: d.destinationName!,
    nights: d.nights!,
    travelers: {
      adults: d.adults!,
      childrenFree: d.childrenFree ?? 0,
      childrenBed: d.childrenBed ?? 0,
      rooms: planRooms(d.adults!, d.childrenBed ?? 0).rooms,
    },
    offers: built.offers,
    hotelClasses: built.hotelClasses,
    tourNames: built.tourNames,
    depositPct: DEPOSIT_PCT,
    currency: CURRENCY,
    travelMonth: d.travelMonth,
    customerName: d.customerName,
    hasTickets: built.input.ticketPerPerson > 0,
    heroImage: built.heroImage,
    gallery: built.gallery,
    imageCredits: built.imageCredits,
    itinerary: built.itinerary,
    route: built.route,
    practical: built.practical,
  });
}

async function showResult(ctx: Context, s: Session): Promise<void> {
  const built = await buildOffers(s);
  if (!built) {
    await ctx.reply('تعذّر الحساب — لا توجد فنادق مسجّلة لهذه الوجهة. أضفها من 💰 الأسعار.');
    return;
  }
  const kb = new InlineKeyboard()
    .text('📄 ملف PDF', 'q:pdf')
    .text('🖼️ صورة', 'q:img').row()
    .text('✏️ عدّل العرض', 'q:edit').row()
    .text('📝 البرنامج كتابياً', 'q:prog').row()
    .text('💬 نص مختصر للواتساب', 'q:text').row()
    .text('🔍 تفصيل داخلي', 'q:detail').row()
    .text('💾 احفظ العرض', 'q:save')
    .text('✖️ إلغاء', 'q:cancel');

  const plan = planRooms(s.draft.adults!, s.draft.childrenBed ?? 0);
  await ctx.reply(
    tiersSummary(built.offers, s.draft.nights!, s.draft.adults!, s.draft.childrenBed ?? 0) +
      `\n\n<i>${s.draft.destinationName} · ${s.draft.travelMonth ?? ''} · ` +
      `${plan.rooms} ${plan.rooms === 1 ? 'غرفة' : 'غرف'}` +
      (plan.triples ? ` (${plan.triples} ثلاثية)` : '') +
      '</i>',
    { parse_mode: 'HTML', reply_markup: kb },
  );
}

async function persist(ctx: Context, s: Session): Promise<void> {
  const built = await buildOffers(s);
  if (!built) {
    await ctx.reply('تعذّر الحفظ — أعد الحساب.');
    return;
  }
  const chosen = built.offers.find((o) => o.tier === 'premium') ?? built.offers[0]!;
  const serial = await db.nextSerial();
  const row = await db.saveQuote({
    serial,
    createdBy: uid(ctx),
    destination: s.draft.destination!,
    season: s.draft.season ?? 'normal',
    travelMonth: s.draft.travelMonth ?? null,
    customerName: s.draft.customerName ?? null,
    customerPhone: s.draft.customerPhone ?? null,
    input: built.input,
    tiers: built.offers,
    chosenTier: 'premium',
    cost: chosen.cost,
    sell: chosen.sell,
  });
  s.draft.savedId = row.id;
  s.draft.savedSerial = serial;
  await save(s);

  await ctx.reply(
    `✅ حُفظ العرض <b>${serial}</b>\n\n` +
      `${s.draft.destinationName} · ${fmt(chosen.sell)} · ربح ${fmt(chosen.profit)}\n` +
      `${s.draft.customerName ? `الزبون: ${s.draft.customerName}\n` : ''}` +
      '\nاضغط 📄 أو 🖼️ لإرسال المستند للزبون.',
    { parse_mode: 'HTML' },
  );
}

/** البرنامج كتابياً — نص كامل يُنسخ ويُعدَّل قبل الإرسال. */
function programText(s: Session, built: Built): string {
  const d = s.draft;
  const chosen = built.offers.find((o) => o.tier === 'premium') ?? built.offers[0]!;
  const plan = planRooms(d.adults!, d.childrenBed ?? 0);
  const lines: (string | null)[] = [
    `🌿 ${d.destinationName} — ${d.nights! + 1} أيام / ${d.nights} ليالٍ`,
    d.departDate ? `التواريخ: ${d.departDate} إلى ${d.returnDate}` : null,
    `المسافرون: ${d.adults} بالغ` +
      (d.childrenBed ? ` · ${d.childrenBed} طفل (6 فأكثر)` : '') +
      (d.childrenFree ? ` · ${d.childrenFree} طفل دون السادسة مجاناً` : ''),
    `الغرف: ${plan.rooms}` + (plan.triples ? ` — منها ${plan.triples} ثلاثية` : ''),
    '',
    '— البرنامج يوماً بيوم —',
  ];
  for (const day of built.itinerary) {
    lines.push('');
    lines.push(`اليوم ${day.n}: ${day.title}`);
    lines.push(day.body);
    if (day.sleep) lines.push(`المبيت في ${day.sleep}`);
  }
  lines.push('');
  lines.push('— الأسعار —');
  for (const o of built.offers) lines.push(`${o.label}: ${fmt(o.sell)} — ${o.hotelName ?? ''}`);
  lines.push('');
  lines.push(`العربون ${DEPOSIT_PCT}٪ = ${fmt(chosen.deposit)}`);
  lines.push('المسافرون العرب — بضيافة عربية');
  return lines.filter((l) => l !== null).join('\n');
}


/* ------------------------------ التعديل ------------------------------ */

const TIER_AR: Record<Tier, string> = { economy: 'اقتصادي', premium: 'مميز', vip: 'VIP' };

/** قائمة التعديل — كل ما يمكن تغييره قبل إصدار العرض. */
async function editMenu(ctx: Context, s: Session, edit = false): Promise<void> {
  const d = s.draft;
  const kb = new InlineKeyboard()
    .text('📅 التواريخ', 'q:ed:dates')
    .text('👥 المسافرون', 'q:ed:pax').row()
    .text('🗺️ الجولات', 'q:ed:tours')
    .text('🏨 الفنادق', 'q:ed:hotels').row()
    .text('🧭 المرشد', 'q:ed:guide')
    .text('🚕 نقلات المطار', 'q:ed:transfers').row()
    .text('➕ خدمات إضافية', 'q:ed:extras')
    .text('💰 الهامش', 'q:ed:margin').row()
    .text('◀️ عُد للأسعار', 'q:calc');

  const rows = [
    '<b>تعديل العرض</b>',
    '',
    `📅 ${d.departDate ?? '—'} إلى ${d.returnDate ?? '—'} · ${d.nights} ليالٍ`,
    `👥 ${d.adults} بالغ · ${d.childrenBed ?? 0} طفل (6+) · ${d.childrenFree ?? 0} دون السادسة`,
    `🗺️ ${d.tourIds.length} جولة`,
    `🧭 مرشد: ${d.guideDays ?? 0} يوم`,
    `🚕 نقلات المطار: ${d.transfers ?? 2}`,
    `➕ خدمات: ${fmt(d.simPerPerson ?? 0)} شريحة · ${fmt(d.dinnerPerPerson ?? 0)} عشاء · ${fmt(d.miscTotal ?? 0)} متفرقات`,
    `💰 الهامش: ${d.marginPct ? `${d.marginPct}٪ موحّد` : 'حسب الفئة (18 · 22 · 28)'}`,
  ];
  const text = rows.join('\n');
  if (edit) await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  else await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
}

/** اختيار الفئة التي يُبدَّل فندقها. */
async function hotelTierMenu(ctx: Context, s: Session): Promise<void> {
  const kb = new InlineKeyboard();
  for (const t of ['economy', 'premium', 'vip'] as Tier[]) {
    kb.text(TIER_AR[t], `q:ht:${t}`);
  }
  kb.row().text('◀️ رجوع', 'q:edit');
  await ctx.editMessageText('أي فئة تريد تبديل فندقها؟', { reply_markup: kb });
}

/** قائمة فنادق الوجهة لاختيار واحد لهذه الفئة. */
async function hotelPicker(ctx: Context, s: Session, tier: Tier): Promise<void> {
  const hotels = await db.listHotels(s.draft.destination!);
  const current = s.draft.hotelIds?.[tier];
  const kb = new InlineKeyboard();
  for (const h of hotels) {
    const mark = h.id === current ? '✅ ' : '';
    kb.text(`${mark}${h.name} — ${fmt(h.rate_normal)}`, `q:hs:${tier}:${h.id}`).row();
  }
  kb.text('↩️ عُد للاختيار التلقائي', `q:hs:${tier}:0`).row().text('◀️ رجوع', 'q:ed:hotels');
  await ctx.editMessageText(`فندق فئة <b>${TIER_AR[tier]}</b>:`, {
    parse_mode: 'HTML',
    reply_markup: kb,
  });
}

/* ------------------------------ التوجيه ------------------------------ */

/** يعالج كل أزرار `q:*`. يعيد true إن كان الزر يخصّه. */
export async function handleQuoteCallback(ctx: Context, parts: string[]): Promise<boolean> {
  const s = await getSession(uid(ctx));
  const [, action, value] = parts;

  const needDraft = async (): Promise<boolean> => {
    if (hasDraft(s)) return true;
    await ctx.answerCallbackQuery({ text: 'انتهت الجلسة. ابدأ عرضاً جديداً.', show_alert: true });
    return false;
  };

  switch (action) {
    case 'edit': {
      if (!(await needDraft())) return true;
      await ctx.answerCallbackQuery();
      await editMenu(ctx, s);
      return true;
    }

    case 'ed': {
      if (!(await needDraft())) return true;
      await ctx.answerCallbackQuery();
      switch (value) {
        case 'dates':   await askDates(ctx, s); return true;
        case 'pax':     await askAdults(ctx, s); return true;
        case 'tours':   await askTours(ctx, s); return true;
        case 'hotels':  await hotelTierMenu(ctx, s); return true;
        case 'guide':
          await expectStep(s, 'q.guide');
          await ctx.reply('كم يوماً للمرشد العربي؟ اكتب <code>0</code> لإلغائه.', {
            parse_mode: 'HTML',
          });
          return true;
        case 'transfers':
          await expectStep(s, 'q.transfers');
          await ctx.reply('كم نقلة مطار؟ (استقبال + توديع = 2)');
          return true;
        case 'extras':
          await expectStep(s, 'q.extras');
          await ctx.reply(
            'اكتب ثلاثة أرقام بالدولار:\n' +
              '<code>الشريحة  العشاء  المتفرقات</code>\n\n' +
              'الشريحة والعشاء للشخص الواحد، والمتفرقات إجمالية.\n' +
              'مثال: <code>5 25 0</code> — أو <code>0 0 0</code> لإلغائها.',
            { parse_mode: 'HTML' },
          );
          return true;
        case 'margin':
          await expectStep(s, 'q.margin');
          await ctx.reply(
            'هامش موحّد لكل الفئات بالنسبة المئوية.\n' +
              'اكتب <code>0</code> للعودة لهوامش الفئات (18 · 22 · 28).',
            { parse_mode: 'HTML' },
          );
          return true;
        default:
          return true;
      }
    }

    case 'ht': {
      if (!(await needDraft())) return true;
      await ctx.answerCallbackQuery();
      await hotelPicker(ctx, s, value as Tier);
      return true;
    }

    case 'hs': {
      if (!(await needDraft())) return true;
      const tier = value as Tier;
      const id = Number(parts[3]);
      s.draft.hotelIds = { ...s.draft.hotelIds, [tier]: id > 0 ? id : undefined };
      await save(s);
      await ctx.answerCallbackQuery(id > 0 ? 'تم التبديل' : 'عاد للاختيار التلقائي');
      await showResult(ctx, s);
      return true;
    }

    case 'dest': {
      const dest = await db.getDestination(value ?? '');
      if (!dest) return answer(ctx, 'وجهة غير معروفة');
      s.draft.destination = dest.slug;
      s.draft.destinationName = dest.name;
      await save(s);
      await ctx.answerCallbackQuery();
      await askDates(ctx, s);
      return true;
    }

    case 'tour': {
      if (!(await needDraft())) return true;
      const id = Number(value);
      const set = new Set(s.draft.tourIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      s.draft.tourIds = [...set];
      await save(s);
      await ctx.answerCallbackQuery();
      await askTours(ctx, s, true);
      return true;
    }

    case 'calc': {
      if (!(await needDraft())) return true;
      await ctx.answerCallbackQuery();
      await showResult(ctx, s);
      return true;
    }

    case 'detail': {
      if (!(await needDraft())) return true;
      const built = await buildOffers(s);
      if (!built) return answer(ctx, 'تعذّر الحساب');
      await ctx.answerCallbackQuery();
      for (const offer of built.offers) {
        await ctx.reply(internalBreakdown(offer), { parse_mode: 'HTML' });
      }
      return true;
    }

    case 'prog': {
      if (!(await needDraft())) return true;
      const built = await buildOffers(s);
      if (!built) return answer(ctx, 'تعذّر الحساب');
      await ctx.answerCallbackQuery();
      // بلا parse_mode حتى يُنسخ كما هو ويُعدَّل قبل الإرسال
      await ctx.reply(programText(s, built));
      await ctx.reply('انسخ البرنامج وعدّله كما تشاء قبل إرساله.');
      return true;
    }

    case 'text': {
      if (!(await needDraft())) return true;
      const built = await buildOffers(s);
      if (!built) return answer(ctx, 'تعذّر الحساب');
      await ctx.answerCallbackQuery();
      await ctx.reply(
        customerOffer({
          destinationName: s.draft.destinationName!,
          nights: s.draft.nights!,
          adults: s.draft.adults!,
          childrenFree: s.draft.childrenFree ?? 0,
          childrenBed: s.draft.childrenBed ?? 0,
          rooms: planRooms(s.draft.adults!, s.draft.childrenBed ?? 0).rooms,
          tourNames: built.tourNames,
          offers: built.offers,
          depositPct: DEPOSIT_PCT,
          hasGuide: false,
          hasTickets: built.input.ticketPerPerson > 0,
          serial: s.draft.savedSerial,
        }),
      );
      await ctx.reply('انسخ الرسالة أعلاه وأرسلها للزبون.');
      return true;
    }

    case 'pdf':
    case 'img': {
      if (!(await needDraft())) return true;
      const built = await buildOffers(s);
      if (!built) return answer(ctx, 'تعذّر الحساب');
      await ctx.answerCallbackQuery();
      const wait = await ctx.reply('جارٍ التوليد…');
      try {
        const doc = buildDoc(s, built);
        if (action === 'pdf') {
          const pdf = await renderPdf(offerHtml(doc));
          await ctx.replyWithDocument(new InputFile(pdf, `${doc.serial}.pdf`), {
            caption: `${doc.destinationName} — ${doc.days} أيام`,
          });
        } else {
          const size: CardSize = 'square';
          const png = await renderPng(cardHtml(toCardDoc(doc), size), CARD_DIMENSIONS[size]);
          await ctx.replyWithPhoto(new InputFile(png, 'offer.png'), {
            caption: `${doc.destinationName} — تبدأ من ${fmt(Math.min(...doc.tiers.map((t) => t.price)))}`,
          });
        }
      } catch (e) {
        console.error('فشل التوليد:', e);
        await ctx.reply(`تعذّر توليد الملف.\n${e instanceof Error ? e.message : 'خطأ غير معروف'}`);
      } finally {
        await ctx.api.deleteMessage(wait.chat.id, wait.message_id).catch(() => {});
      }
      return true;
    }

    case 'save': {
      if (!(await needDraft())) return true;
      await ctx.answerCallbackQuery();
      await expectStep(s, 'q.customer');
      await ctx.reply('اسم الزبون ورقمه (أو اكتب <code>-</code> للتخطي):', { parse_mode: 'HTML' });
      return true;
    }

    case 'cancel': {
      await dropSession(uid(ctx));
      await ctx.answerCallbackQuery('أُلغي');
      await ctx.reply('أُلغي العرض.');
      return true;
    }

    default:
      return false;
  }
}

async function answer(ctx: Context, text: string): Promise<boolean> {
  await ctx.answerCallbackQuery({ text, show_alert: true });
  return true;
}
