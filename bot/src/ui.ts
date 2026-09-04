/** أدوات مشتركة للعرض والأزرار. كل النصوص عربية. */
import { InlineKeyboard } from 'grammy';
import { money, TIER_LABEL, type TierOffer } from './pricing.ts';

export const CURRENCY = process.env.BASE_CURRENCY ?? 'USD';

export const fmt = (cents: number) => money(cents, CURRENCY);

/** يبني لوحة أزرار من عناصر، بعمودين افتراضياً. */
export function keyboard<T>(
  items: readonly T[],
  label: (item: T) => string,
  data: (item: T) => string,
  columns = 2,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  items.forEach((item, i) => {
    kb.text(label(item), data(item));
    if ((i + 1) % columns === 0) kb.row();
  });
  return kb;
}

/** جدول تفصيل التكلفة — للنسخة الداخلية فقط، لا يُرسل للزبون أبداً. */
export function internalBreakdown(offer: TierOffer): string {
  const rows = offer.lines.map((l) => `${l.label} — ${fmt(l.amount)}\n   ${l.detail}`);
  const marginPct = Math.round((offer.profit / offer.sell) * 100);
  return [
    `<b>تفصيل داخلي — ${offer.label}</b>`,
    '',
    ...rows,
    '',
    `التكلفة: <b>${fmt(offer.cost)}</b>`,
    `سعر البيع: <b>${fmt(offer.sell)}</b>`,
    `الربح: <b>${fmt(offer.profit)}</b> (${marginPct}٪)`,
    `العربون: ${fmt(offer.deposit)}`,
  ].join('\n');
}

/** ملخص الأسعار الثلاثة. */
export function tiersSummary(offers: TierOffer[], nights: number, adults: number, children: number): string {
  const pax = `${adults} بالغ${children ? ` و${children} طفل` : ''}`;
  const lines = offers.map(
    (o) => `${o.tier === 'premium' ? '⭐ ' : '▪️ '}<b>${o.label}</b> — ${fmt(o.sell)}` +
      `\n     ${fmt(o.perAdult)} للبالغ · ربح ${fmt(o.profit)}`,
  );
  return [`<b>${nights + 1} أيام / ${nights} ليالٍ · ${pax}</b>`, '', ...lines].join('\n');
}

/**
 * نص العرض الجاهز للإرسال للزبون على واتساب.
 * لا يحتوي التكلفة ولا الربح — هذه نسخة الزبون.
 */
export function customerOffer(args: {
  destinationName: string;
  nights: number;
  adults: number;
  children: number;
  infants: number;
  rooms: number;
  tourNames: string[];
  offers: TierOffer[];
  depositPct: number;
  hasGuide: boolean;
  hasTickets: boolean;
  serial?: string;
}): string {
  const days = args.nights + 1;
  const pax =
    `${args.adults} بالغ` +
    (args.children ? ` و${args.children} طفل` : '') +
    (args.infants ? ` و${args.infants} رضيع` : '');
  const chosen = args.offers.find((o) => o.tier === 'premium') ?? args.offers[0];

  const out: (string | null)[] = [
    `🌿 عرض سعر — ${args.destinationName}`,
    args.serial ? `رقم العرض: ${args.serial}` : null,
    '',
    `المدة: ${days} أيام / ${args.nights} ليالٍ`,
    `عدد المسافرين: ${pax}`,
    `عدد الغرف: ${args.rooms}`,
    '',
    '— البرنامج يشمل الجولات التالية —',
    ...(args.tourNames.length ? args.tourNames.map((n) => `• ${n}`) : ['• حسب طلبكم']),
    '',
    '— ثلاثة خيارات —',
    ...args.offers.map((o) => `▪ ${TIER_LABEL[o.tier]}: ${fmt(o.sell)}`),
    '',
    '— البكج يشمل —',
    `• الإقامة ${args.nights} ليالٍ مع الإفطار`,
    '• الاستقبال والتوديع من المطار',
    '• سيارة خاصة مع سائق طوال البرنامج',
    '• الجولات المذكورة أعلاه',
    args.hasTickets ? '• تذاكر الدخول للأماكن المذكورة' : null,
    args.hasGuide ? '• مرشد عربي طوال البرنامج' : null,
    '',
    '— لا يشمل —',
    '• تذاكر الطيران',
    '• الغداء والعشاء',
    '• المصاريف الشخصية والتأمين',
    '',
    `لتثبيت الحجز: عربون ${args.depositPct}٪ = ${fmt(chosen!.deposit)}`,
    'الإلغاء مجاني قبل 14 يوماً من موعد السفر.',
    'الأسعار صالحة لمدة 7 أيام وتخضع لتوفر الغرف.',
    '',
    'المسافرون العرب — بضيافة عربية 🇹🇷',
  ];
  return out.filter((l) => l !== null).join('\n');
}
