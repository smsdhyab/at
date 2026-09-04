/**
 * معالج بناء عرض السعر خطوة بخطوة.
 *
 * الموسم: الفنادق تحمل سعرين حقيقيين (عادي ومرتفع) من عقد المورّد، لذلك يختار
 * البوت السعر المناسب من الصف ويمرّر `season: 'normal'` للمحرك — وإلا حُسب
 * الموسم مرتين. معامل الموسم في المحرك مخصص للحالات التي لا تتوفر فيها أسعار
 * موسمية حقيقية (لوحة التحكم واستخدام يدوي).
 */
import { InlineKeyboard, InputFile, type Context } from 'grammy';
import {
  threeTiers,
  TIER_LABEL,
  type QuoteInput,
  type Tier,
  type TierOffer,
  type TierRates,
} from '../pricing.ts';
import * as db from '../db.ts';
import { expectText, newDraft, getDraft, dropDraft, type Draft } from '../state.ts';
import { fmt, keyboard, tiersSummary, internalBreakdown, customerOffer, CURRENCY } from '../ui.ts';
import { toOfferDoc, toCardDoc } from '../offerdoc.ts';
import { offerHtml } from '../templates/offer.ts';
import { cardHtml, CARD_DIMENSIONS, type CardSize } from '../templates/card.ts';
import { renderPdf, renderPng } from '../render.ts';

/** إعدادات ثابتة — تنتقل للوحة التحكم في المرحلة الرابعة. */
const FEES_BP = 250;
const DEPOSIT_PCT = 30;
const ROUND_TO = 1_000; // 10 دولارات

const uid = (ctx: Context) => ctx.from?.id ?? 0;

/* ------------------------------ الخطوة 1 ------------------------------ */

export async function startQuote(ctx: Context): Promise<void> {
  newDraft(uid(ctx));
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

/* ------------------------------ الخطوة 2 ------------------------------ */

async function askNights(ctx: Context, draft: Draft): Promise<void> {
  await ctx.reply(`الوجهة: <b>${draft.destinationName}</b>\n\nكم عدد الليالي؟`, { parse_mode: 'HTML' });
  expectText(uid(ctx), async (c, text) => {
    const n = parseInt(text.replace(/\D/g, ''), 10);
    if (!n || n < 1 || n > 30) {
      await c.reply('اكتب رقماً بين 1 و30.');
      expectText(uid(c), async (c2, t2) => askNightsRetry(c2, draft, t2));
      return;
    }
    draft.nights = n;
    await askPax(c, draft);
  });
}

async function askNightsRetry(ctx: Context, draft: Draft, text: string): Promise<void> {
  const n = parseInt(text.replace(/\D/g, ''), 10);
  if (!n || n < 1 || n > 30) {
    await ctx.reply('ما زال غير صالح. اكتب رقماً بين 1 و30.');
    expectText(uid(ctx), async (c, t) => askNightsRetry(c, draft, t));
    return;
  }
  draft.nights = n;
  await askPax(ctx, draft);
}

/* ------------------------------ الخطوة 3 ------------------------------ */

async function askPax(ctx: Context, draft: Draft): Promise<void> {
  await ctx.reply(
    'كم عدد المسافرين؟\n\nاكتبهم بهذا الترتيب مفصولين بمسافة:\n<code>الكبار الأطفال الرضّع</code>\n\nمثال: <code>2 2 0</code>\nأو اكتب <code>2</code> لبالغين فقط.',
    { parse_mode: 'HTML' },
  );
  expectText(uid(ctx), async (c, text) => {
    const parts = text.trim().split(/[\s،,]+/).map((p) => parseInt(p.replace(/\D/g, ''), 10));
    const adults = parts[0];
    if (!adults || adults < 1 || adults > 30) {
      await c.reply('لم أفهم. اكتب مثلاً: 2 2 0');
      await askPax(c, draft);
      return;
    }
    draft.adults = adults;
    draft.children = Number.isFinite(parts[1]) ? parts[1]! : 0;
    draft.infants = Number.isFinite(parts[2]) ? parts[2]! : 0;
    draft.rooms = Math.max(1, Math.ceil(adults / 2));
    await askSeason(c, draft);
  });
}

/* ------------------------------ الخطوة 4 ------------------------------ */

async function askSeason(ctx: Context, draft: Draft): Promise<void> {
  await ctx.reply(
    `${draft.adults} بالغ · ${draft.children} طفل · ${draft.rooms} غرفة\n\nما الموسم؟`,
    {
      reply_markup: new InlineKeyboard()
        .text('عادي', 'q:season:normal')
        .text('مرتفع — صيف وأعياد', 'q:season:high'),
    },
  );
}

/* ------------------------------ الخطوة 5 ------------------------------ */

async function askTours(ctx: Context, draft: Draft, edit = false): Promise<void> {
  const tours = await db.listTours(draft.destination!);
  if (!tours.length) {
    await ctx.reply('لا توجد جولات لهذه الوجهة. أضفها من /rates ثم أعد المحاولة.');
    return;
  }
  const kb = new InlineKeyboard();
  for (const t of tours) {
    const on = draft.tourIds.has(t.id);
    kb.text(`${on ? '✅' : '▫️'} ${t.name} — ${fmt(t.price)}`, `q:tour:${t.id}`).row();
  }
  kb.text('◀️ احسب السعر', 'q:calc');

  const text = `<b>اختر الجولات</b>\nاضغط على الجولة لإضافتها أو إزالتها.\n\nالمختار: ${draft.tourIds.size} جولة`;
  if (edit) {
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  } else {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}

/* ------------------------------ الحساب ------------------------------ */

/** يبني مدخلات المحرك من المسودة وبيانات قاعدة الأسعار. */
interface Built {
  offers: TierOffer[];
  tourNames: string[];
  input: QuoteInput;
  hotelClasses: Partial<Record<Tier, string>>;
  heroImage: string;
  gallery: string[];
}

async function buildOffers(draft: Draft): Promise<Built | null> {
  const dest = await db.getDestination(draft.destination!);
  if (!dest) return null;

  const { three, four, five, cabin, all } = await db.hotelsByClass(dest.slug);
  const fallback = all[0];
  if (!fallback) return null;

  const high = draft.season === 'high';
  const rateOf = (h: db.Hotel | undefined) => {
    const row = h ?? fallback;
    return high ? row.rate_high : row.rate_normal;
  };

  const [sedan, van, vip] = await Promise.all([
    db.carByKind(dest.slug, 'sedan'),
    db.carByKind(dest.slug, 'van'),
    db.carByKind(dest.slug, 'vip'),
  ]);

  const tours = (await db.listTours(dest.slug)).filter((t) => draft.tourIds.has(t.id));
  const carDays = Math.max(0, draft.nights! - 1);

  const input: QuoteInput = {
    nights: draft.nights!,
    adults: draft.adults!,
    children: draft.children ?? 0,
    infants: draft.infants ?? 0,
    rooms: draft.rooms ?? 1,
    // الموسم مطبّق في سعر الفندق المختار أعلاه — لا يُطبّق مرتين
    season: 'normal',
    hotelRate: rateOf(four),
    hotelNights: draft.nights!,
    carRate: van?.rate_day ?? 0,
    carDays,
    transfers: 2,
    transferRate: dest.transfer_rate,
    tours: tours.map((t) => ({ name: t.name, price: t.price })),
    ticketPerPerson: dest.ticket_pp,
    guideDays: draft.guideDays ?? 0,
    guideRate: dest.guide_rate,
    simPerPerson: 0,
    dinnerPerPerson: 0,
    miscTotal: 0,
    marginPct: 22,
    feesBp: FEES_BP,
    depositPct: DEPOSIT_PCT,
    roundTo: ROUND_TO,
    childFreeInRoom: false,
  };

  const rates: Record<Tier, TierRates> = {
    economy: {
      hotelRate: rateOf(three),
      carRate: sedan?.rate_day ?? 0,
      guideIncluded: false,
      hotelName: (three ?? fallback).name,
    },
    premium: {
      hotelRate: rateOf(four),
      carRate: van?.rate_day ?? 0,
      guideIncluded: false,
      hotelName: (four ?? fallback).name,
    },
    vip: {
      hotelRate: rateOf(five ?? cabin),
      carRate: vip?.rate_day ?? 0,
      guideIncluded: true,
      hotelName: (five ?? cabin ?? fallback).name,
    },
  };

  return {
    offers: threeTiers(input, rates),
    tourNames: tours.map((t) => t.name),
    input,
    heroImage: dest.hero_image,
    gallery: db.galleryOf(dest),
    hotelClasses: {
      economy: (three ?? fallback).class,
      premium: (four ?? fallback).class,
      vip: (five ?? cabin ?? fallback).class,
    },
  };
}

async function showResult(ctx: Context, draft: Draft): Promise<void> {
  const built = await buildOffers(draft);
  if (!built) {
    await ctx.reply('تعذّر الحساب — لا توجد فنادق مسجّلة لهذه الوجهة. أضفها من /rates.');
    return;
  }
  const { offers } = built;

  const kb = new InlineKeyboard()
    .text('📄 ملف PDF', 'q:pdf')
    .text('🖼️ صورة', 'q:img').row()
    .text('💬 نص للواتساب', 'q:text').row()
    .text('🔍 تفصيل داخلي', 'q:detail').row()
    .text('💾 احفظ العرض', 'q:save')
    .text('✖️ إلغاء', 'q:cancel');

  await ctx.reply(
    tiersSummary(offers, draft.nights!, draft.adults!, draft.children ?? 0) +
      `\n\n<i>${draft.destinationName} · ${draft.season === 'high' ? 'موسم مرتفع' : 'موسم عادي'}</i>`,
    { parse_mode: 'HTML', reply_markup: kb },
  );
}

/* ------------------------------ التوجيه ------------------------------ */

/** يعالج كل أزرار `q:*`. يعيد true إن كان الزر يخصّه. */
export async function handleQuoteCallback(ctx: Context, parts: string[]): Promise<boolean> {
  const draft = getDraft(uid(ctx));
  const [, action, value] = parts;

  if (action === 'dest') {
    if (!draft) return answer(ctx, 'انتهت الجلسة. ابدأ من /quote');
    const dest = await db.getDestination(value!);
    if (!dest) return answer(ctx, 'وجهة غير معروفة');
    draft.destination = dest.slug;
    draft.destinationName = dest.name;
    await ctx.answerCallbackQuery();
    await askNights(ctx, draft);
    return true;
  }

  if (action === 'season') {
    if (!draft) return answer(ctx, 'انتهت الجلسة. ابدأ من /quote');
    draft.season = value === 'high' ? 'high' : 'normal';
    await ctx.answerCallbackQuery();
    await askTours(ctx, draft);
    return true;
  }

  if (action === 'tour') {
    if (!draft) return answer(ctx, 'انتهت الجلسة. ابدأ من /quote');
    const id = Number(value);
    if (draft.tourIds.has(id)) draft.tourIds.delete(id);
    else draft.tourIds.add(id);
    await ctx.answerCallbackQuery();
    await askTours(ctx, draft, true);
    return true;
  }

  if (action === 'calc') {
    if (!draft) return answer(ctx, 'انتهت الجلسة. ابدأ من /quote');
    await ctx.answerCallbackQuery();
    await showResult(ctx, draft);
    return true;
  }

  if (action === 'detail') {
    if (!draft) return answer(ctx, 'انتهت الجلسة. ابدأ من /quote');
    const built = await buildOffers(draft);
    if (!built) return answer(ctx, 'تعذّر الحساب');
    await ctx.answerCallbackQuery();
    for (const offer of built.offers) {
      await ctx.reply(internalBreakdown(offer), { parse_mode: 'HTML' });
    }
    return true;
  }

  if (action === 'text') {
    if (!draft) return answer(ctx, 'انتهت الجلسة. ابدأ من /quote');
    const built = await buildOffers(draft);
    if (!built) return answer(ctx, 'تعذّر الحساب');
    await ctx.answerCallbackQuery();
    const text = customerOffer({
      destinationName: draft.destinationName!,
      nights: draft.nights!,
      adults: draft.adults!,
      children: draft.children ?? 0,
      infants: draft.infants ?? 0,
      rooms: draft.rooms ?? 1,
      tourNames: built.tourNames,
      offers: built.offers,
      depositPct: DEPOSIT_PCT,
      hasGuide: false,
      hasTickets: built.input.ticketPerPerson > 0,
    });
    // بلا parse_mode حتى ينسخه المستخدم كما هو إلى واتساب
    await ctx.reply(text);
    await ctx.reply('انسخ الرسالة أعلاه وأرسلها للزبون.');
    return true;
  }

  if (action === 'save') {
    if (!draft) return answer(ctx, 'انتهت الجلسة. ابدأ من /quote');
    await ctx.answerCallbackQuery();
    await ctx.reply('اسم الزبون ورقمه (أو اكتب <code>-</code> للتخطي):', { parse_mode: 'HTML' });
    expectText(uid(ctx), async (c, text) => {
      const clean = text.trim();
      const skip = clean === '-' || clean === '';
      const phoneMatch = clean.match(/[+\d][\d\s-]{6,}/);
      await persist(c, draft, {
        name: skip ? null : clean.replace(phoneMatch?.[0] ?? '', '').trim() || null,
        phone: skip ? null : phoneMatch?.[0]?.replace(/\s|-/g, '') ?? null,
      });
    });
    return true;
  }

  if (action === 'pdf' || action === 'img') {
    if (!draft) return answer(ctx, 'انتهت الجلسة. ابدأ من /quote');
    const built = await buildOffers(draft);
    if (!built) return answer(ctx, 'تعذّر الحساب');
    await ctx.answerCallbackQuery();
    const wait = await ctx.reply('جارٍ التوليد…');
    try {
      const doc = buildDoc(draft, built);
      if (action === 'pdf') {
        const pdf = await renderPdf(offerHtml(doc));
        await ctx.replyWithDocument(new InputFile(pdf, `${doc.serial}.pdf`), {
          caption: `عرض ${doc.destinationName} — ${doc.days} أيام`,
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
      await ctx.reply(
        `تعذّر توليد الملف.\n${e instanceof Error ? e.message : 'خطأ غير معروف'}`,
      );
    } finally {
      await ctx.api.deleteMessage(wait.chat.id, wait.message_id).catch(() => {});
    }
    return true;
  }

  if (action === 'cancel') {
    dropDraft(uid(ctx));
    await ctx.answerCallbackQuery('أُلغي');
    await ctx.reply('أُلغي العرض. ابدأ من جديد بـ /quote');
    return true;
  }

  return false;
}

async function persist(ctx: Context, draft: Draft, customer: { name: string | null; phone: string | null }) {
  const built = await buildOffers(draft);
  if (!built) {
    await ctx.reply('تعذّر الحفظ — أعد الحساب.');
    return;
  }
  const chosen = built.offers.find((o) => o.tier === 'premium') ?? built.offers[0]!;
  const serial = await db.nextSerial();
  const row = await db.saveQuote({
    serial,
    createdBy: uid(ctx),
    destination: draft.destination!,
    season: draft.season ?? 'normal',
    travelMonth: draft.travelMonth ?? null,
    customerName: customer.name,
    customerPhone: customer.phone,
    input: built.input,
    tiers: built.offers,
    chosenTier: 'premium',
    cost: chosen.cost,
    sell: chosen.sell,
  });
  draft.savedId = row.id;
  await ctx.reply(
    `✅ حُفظ العرض <b>${serial}</b>\n\n` +
      `${draft.destinationName} · ${fmt(chosen.sell)} · ربح ${fmt(chosen.profit)}\n` +
      `${customer.name ? `الزبون: ${customer.name}\n` : ''}` +
      `\nاعرض عروضك بـ /recent`,
    { parse_mode: 'HTML' },
  );
  dropDraft(uid(ctx));
}

/** يحوّل المسودة والعروض إلى مستند زبون — بلا تكلفة ولا ربح. */
function buildDoc(draft: Draft, built: Built) {
  return toOfferDoc({
    serial: draft.savedId ? `AT-${new Date().getFullYear()}-${String(draft.savedId).padStart(4, '0')}` : 'مسودة',
    destinationName: draft.destinationName!,
    nights: draft.nights!,
    travelers: {
      adults: draft.adults!,
      children: draft.children ?? 0,
      infants: draft.infants ?? 0,
      rooms: draft.rooms ?? 1,
    },
    offers: built.offers,
    hotelClasses: built.hotelClasses,
    tourNames: built.tourNames,
    depositPct: DEPOSIT_PCT,
    currency: CURRENCY,
    travelMonth: draft.travelMonth,
    customerName: draft.customerName,
    hasTickets: built.input.ticketPerPerson > 0,
    heroImage: built.heroImage,
    gallery: built.gallery,
  });
}

async function answer(ctx: Context, text: string): Promise<boolean> {
  await ctx.answerCallbackQuery({ text, show_alert: true });
  return true;
}

export { TIER_LABEL };
