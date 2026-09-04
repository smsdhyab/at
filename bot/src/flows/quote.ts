/**
 * معالج بناء عرض السعر خطوة بخطوة.
 *
 * الحالة كلها في قاعدة البيانات لا في الذاكرة، والخطوة المنتظرة نص مثل
 * `q.nights` يوزّعه `handleQuoteStep`. السبب في `state.ts`.
 *
 * الموسم: الفنادق تحمل سعرين حقيقيين (عادي ومرتفع) من عقد المورّد، لذلك يختار
 * البوت السعر المناسب من الصف ويمرّر `season: 'normal'` للمحرك — وإلا حُسب
 * الموسم مرتين. معامل الموسم في المحرك مخصص للحالات التي لا تتوفر فيها أسعار
 * موسمية حقيقية (لوحة التحكم واستخدام يدوي).
 */
import { InlineKeyboard, InputFile, type Context } from 'grammy';
import {
  threeTiers,
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

/** إعدادات ثابتة — تنتقل للوحة التحكم في المرحلة الرابعة. */
const FEES_BP = 250;
const DEPOSIT_PCT = 30;
const ROUND_TO = 1_000; // 10 دولارات

const uid = (ctx: Context) => ctx.from?.id ?? 0;

/* ------------------------------ الخطوة 1 ------------------------------ */

export async function startQuote(ctx: Context): Promise<void> {
  resetDraft(uid(ctx));
  const destinations = db.listDestinations();
  if (!destinations.length) {
    await ctx.reply('لا توجد وجهات بعد. شغّل «npm run migrate» أولاً.');
    return;
  }
  await ctx.reply('<b>عرض سعر جديد</b>\n\nاختر الوجهة:', {
    parse_mode: 'HTML',
    reply_markup: keyboard(destinations, (d) => d.name, (d) => `q:dest:${d.slug}`, 1),
  });
}

/* ------------------------------ الخطوات ------------------------------ */

async function askNights(ctx: Context, s: Session): Promise<void> {
  expectStep(s, 'q.nights');
  await ctx.reply(`الوجهة: <b>${s.draft.destinationName}</b>\n\nكم عدد الليالي؟`, {
    parse_mode: 'HTML',
  });
}

async function askPax(ctx: Context, s: Session): Promise<void> {
  expectStep(s, 'q.pax');
  await ctx.reply(
    'كم عدد المسافرين؟\n\nاكتبهم بهذا الترتيب مفصولين بمسافة:\n' +
      '<code>الكبار الأطفال الرضّع</code>\n\nمثال: <code>2 2 0</code>\n' +
      'أو اكتب <code>2</code> لبالغين فقط.',
    { parse_mode: 'HTML' },
  );
}

async function askSeason(ctx: Context, s: Session): Promise<void> {
  clearStep(s);
  await ctx.reply(
    `${s.draft.adults} بالغ · ${s.draft.children} طفل · ${s.draft.rooms} غرفة\n\nما الموسم؟`,
    {
      reply_markup: new InlineKeyboard()
        .text('عادي', 'q:season:normal')
        .text('مرتفع — صيف وأعياد', 'q:season:high'),
    },
  );
}

async function askTours(ctx: Context, s: Session, edit = false): Promise<void> {
  const tours = db.listTours(s.draft.destination!);
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
    `<b>اختر الجولات</b>\nاضغط على الجولة لإضافتها أو إزالتها.\n\n` +
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
    case 'q.nights': {
      const n = parseInt(text.replace(/\D/g, ''), 10);
      if (!n || n < 1 || n > 30) {
        await ctx.reply('اكتب رقماً بين 1 و30.');
        return true; // الخطوة باقية — ننتظر إجابة صحيحة
      }
      s.draft.nights = n;
      save(s);
      await askPax(ctx, s);
      return true;
    }

    case 'q.pax': {
      const parts = text.trim().split(/[\s،,]+/).map((p) => parseInt(p.replace(/\D/g, ''), 10));
      const adults = parts[0];
      if (!adults || adults < 1 || adults > 30) {
        await ctx.reply('لم أفهم. اكتب مثلاً: <code>2 2 0</code>', { parse_mode: 'HTML' });
        return true;
      }
      s.draft.adults = adults;
      s.draft.children = Number.isFinite(parts[1]) ? parts[1]! : 0;
      s.draft.infants = Number.isFinite(parts[2]) ? parts[2]! : 0;
      s.draft.rooms = Math.max(1, Math.ceil(adults / 2));
      save(s);
      await askSeason(ctx, s);
      return true;
    }

    case 'q.customer': {
      const clean = text.trim();
      const skip = clean === '-' || clean === '';
      const phone = clean.match(/[+\d][\d\s-]{6,}/)?.[0];
      s.draft.customerPhone = skip ? undefined : phone?.replace(/[\s-]/g, '');
      s.draft.customerName = skip ? undefined : clean.replace(phone ?? '', '').trim() || undefined;
      clearStep(s);
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
}

function buildOffers(s: Session): Built | null {
  const d = s.draft;
  const dest = d.destination ? db.getDestination(d.destination) : undefined;
  if (!dest || !d.nights || !d.adults) return null;

  const { three, four, five, cabin, all } = db.hotelsByClass(dest.slug);
  const fallback = all[0];
  if (!fallback) return null;

  const high = d.season === 'high';
  const rateOf = (h: db.Hotel | undefined) => {
    const row = h ?? fallback;
    return high ? row.rate_high : row.rate_normal;
  };

  const sedan = db.carByKind(dest.slug, 'sedan');
  const van = db.carByKind(dest.slug, 'van');
  const vip = db.carByKind(dest.slug, 'vip');

  const chosen = new Set(d.tourIds);
  const tours = db.listTours(dest.slug).filter((t) => chosen.has(t.id));

  const input: QuoteInput = {
    nights: d.nights,
    adults: d.adults,
    children: d.children ?? 0,
    infants: d.infants ?? 0,
    rooms: d.rooms ?? 1,
    // الموسم مطبّق في سعر الفندق المختار أعلاه — لا يُطبّق مرتين
    season: 'normal',
    hotelRate: rateOf(four),
    hotelNights: d.nights,
    carRate: van?.rate_day ?? 0,
    carDays: Math.max(0, d.nights - 1),
    transfers: 2,
    transferRate: dest.transfer_rate,
    tours: tours.map((t) => ({ name: t.name, price: t.price })),
    ticketPerPerson: dest.ticket_pp,
    guideDays: d.guideDays ?? 0,
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
    economy: { hotelRate: rateOf(three), carRate: sedan?.rate_day ?? 0, guideIncluded: false, hotelName: (three ?? fallback).name },
    premium: { hotelRate: rateOf(four), carRate: van?.rate_day ?? 0, guideIncluded: false, hotelName: (four ?? fallback).name },
    vip: { hotelRate: rateOf(five ?? cabin), carRate: vip?.rate_day ?? 0, guideIncluded: true, hotelName: (five ?? cabin ?? fallback).name },
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

/** يحوّل المسودة والعروض إلى مستند زبون — بلا تكلفة ولا ربح. */
function buildDoc(s: Session, built: Built) {
  const d = s.draft;
  return toOfferDoc({
    serial: d.savedSerial ?? 'مسودة',
    destinationName: d.destinationName!,
    nights: d.nights!,
    travelers: {
      adults: d.adults!,
      children: d.children ?? 0,
      infants: d.infants ?? 0,
      rooms: d.rooms ?? 1,
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
  });
}

async function showResult(ctx: Context, s: Session): Promise<void> {
  const built = buildOffers(s);
  if (!built) {
    await ctx.reply('تعذّر الحساب — لا توجد فنادق مسجّلة لهذه الوجهة. أضفها من 💰 الأسعار.');
    return;
  }
  const kb = new InlineKeyboard()
    .text('📄 ملف PDF', 'q:pdf')
    .text('🖼️ صورة', 'q:img').row()
    .text('💬 نص للواتساب', 'q:text').row()
    .text('🔍 تفصيل داخلي', 'q:detail').row()
    .text('💾 احفظ العرض', 'q:save')
    .text('✖️ إلغاء', 'q:cancel');

  await ctx.reply(
    tiersSummary(built.offers, s.draft.nights!, s.draft.adults!, s.draft.children ?? 0) +
      `\n\n<i>${s.draft.destinationName} · ${s.draft.season === 'high' ? 'موسم مرتفع' : 'موسم عادي'}</i>`,
    { parse_mode: 'HTML', reply_markup: kb },
  );
}

async function persist(ctx: Context, s: Session): Promise<void> {
  const built = buildOffers(s);
  if (!built) {
    await ctx.reply('تعذّر الحفظ — أعد الحساب.');
    return;
  }
  const chosen = built.offers.find((o) => o.tier === 'premium') ?? built.offers[0]!;
  const serial = db.nextSerial();
  const row = db.saveQuote({
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
  save(s);

  await ctx.reply(
    `✅ حُفظ العرض <b>${serial}</b>\n\n` +
      `${s.draft.destinationName} · ${fmt(chosen.sell)} · ربح ${fmt(chosen.profit)}\n` +
      `${s.draft.customerName ? `الزبون: ${s.draft.customerName}\n` : ''}` +
      `\nاضغط 📄 أو 🖼️ لإرسال المستند للزبون.`,
    { parse_mode: 'HTML' },
  );
}

/* ------------------------------ التوجيه ------------------------------ */

/** يعالج كل أزرار `q:*`. يعيد true إن كان الزر يخصّه. */
export async function handleQuoteCallback(ctx: Context, parts: string[]): Promise<boolean> {
  const s = getSession(uid(ctx));
  const [, action, value] = parts;

  const needDraft = async (): Promise<boolean> => {
    if (hasDraft(s)) return true;
    await ctx.answerCallbackQuery({ text: 'انتهت الجلسة. ابدأ عرضاً جديداً.', show_alert: true });
    return false;
  };

  switch (action) {
    case 'dest': {
      const dest = db.getDestination(value ?? '');
      if (!dest) return answer(ctx, 'وجهة غير معروفة');
      s.draft.destination = dest.slug;
      s.draft.destinationName = dest.name;
      save(s);
      await ctx.answerCallbackQuery();
      await askNights(ctx, s);
      return true;
    }

    case 'season': {
      if (!(await needDraft())) return true;
      s.draft.season = value === 'high' ? 'high' : 'normal';
      save(s);
      await ctx.answerCallbackQuery();
      await askTours(ctx, s);
      return true;
    }

    case 'tour': {
      if (!(await needDraft())) return true;
      const id = Number(value);
      const set = new Set(s.draft.tourIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      s.draft.tourIds = [...set];
      save(s);
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
      const built = buildOffers(s);
      if (!built) return answer(ctx, 'تعذّر الحساب');
      await ctx.answerCallbackQuery();
      for (const offer of built.offers) {
        await ctx.reply(internalBreakdown(offer), { parse_mode: 'HTML' });
      }
      return true;
    }

    case 'text': {
      if (!(await needDraft())) return true;
      const built = buildOffers(s);
      if (!built) return answer(ctx, 'تعذّر الحساب');
      await ctx.answerCallbackQuery();
      // بلا parse_mode حتى ينسخه المستخدم كما هو إلى واتساب
      await ctx.reply(
        customerOffer({
          destinationName: s.draft.destinationName!,
          nights: s.draft.nights!,
          adults: s.draft.adults!,
          children: s.draft.children ?? 0,
          infants: s.draft.infants ?? 0,
          rooms: s.draft.rooms ?? 1,
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
      const built = buildOffers(s);
      if (!built) return answer(ctx, 'تعذّر الحساب');
      await ctx.answerCallbackQuery();
      const wait = await ctx.reply('جارٍ التوليد…');
      try {
        const doc = buildDoc(s, built);
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
        await ctx.reply(`تعذّر توليد الملف.\n${e instanceof Error ? e.message : 'خطأ غير معروف'}`);
      } finally {
        await ctx.api.deleteMessage(wait.chat.id, wait.message_id).catch(() => {});
      }
      return true;
    }

    case 'save': {
      if (!(await needDraft())) return true;
      await ctx.answerCallbackQuery();
      expectStep(s, 'q.customer');
      await ctx.reply('اسم الزبون ورقمه (أو اكتب <code>-</code> للتخطي):', { parse_mode: 'HTML' });
      return true;
    }

    case 'cancel': {
      dropSession(uid(ctx));
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
