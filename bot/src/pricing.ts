/**
 * محرك التسعير.
 *
 * كل المبالغ أعداد صحيحة بالسنت. لا يوجد عدد عشري عائم في أي مبلغ محفوظ أو معاد:
 * `0.1 + 0.2 !== 0.3` غير مقبول في نظام يحسب أرباحاً.
 * المعاملات (الموسم، الهامش، الرسوم) أعداد صحيحة بالنسبة المئوية أو بأجزاء العشرة آلاف،
 * وكل ضرب يُقرَّب فوراً إلى سنت صحيح قبل أن يدخل في أي جمع.
 */

export type Season = 'normal' | 'high' | 'peak';
export type Tier = 'economy' | 'premium' | 'vip';

/** معامل الموسم كنسبة مئوية صحيحة. */
export const SEASON_PCT: Record<Season, number> = { normal: 100, high: 115, peak: 130 };

/** هامش الربح لكل فئة، نسبة مئوية صحيحة. */
export const TIER_MARGIN_PCT: Record<Tier, number> = { economy: 18, premium: 22, vip: 28 };

export const SEASON_LABEL: Record<Season, string> = {
  normal: 'عادي',
  high: 'مرتفع',
  peak: 'ذروة',
};

export const TIER_LABEL: Record<Tier, string> = {
  economy: 'اقتصادي',
  premium: 'مميز',
  vip: 'VIP',
};

export interface Tour {
  name: string;
  /** سعر الجولة للمجموعة كاملة، بالسنت. */
  price: number;
}

export interface QuoteInput {
  nights: number;
  adults: number;
  children: number;
  infants: number;
  rooms: number;
  season: Season;

  /** سعر الغرفة لليلة الواحدة، بالسنت. */
  hotelRate: number;
  hotelNights: number;
  hotelName?: string;

  /** سعر السيارة لليوم الواحد، بالسنت. */
  carRate: number;
  carDays: number;

  /** عدد نقلات المطار (استقبال + توديع). */
  transfers: number;
  transferRate: number;

  tours: Tour[];

  /** تذكرة الدخول للشخص الواحد، بالسنت. */
  ticketPerPerson: number;

  guideDays: number;
  guideRate: number;

  simPerPerson: number;
  dinnerPerPerson: number;
  miscTotal: number;

  /** هامش الربح، نسبة مئوية صحيحة. */
  marginPct: number;
  /** رسوم التحويل بأجزاء العشرة آلاف: 250 = 2.5٪. */
  feesBp: number;
  /** نسبة العربون، نسبة مئوية صحيحة. */
  depositPct: number;
  /** يُقرَّب سعر البيع لأعلى إلى مضاعف هذا المبلغ بالسنت. 0 أو 1 = بلا تقريب. */
  roundTo: number;

  /** الطفل الأول لا يُحتسب عليه سرير ولا تذكرة. */
  childFreeInRoom: boolean;
}

export interface QuoteLine {
  key: string;
  label: string;
  detail: string;
  amount: number;
}

export interface QuoteResult {
  lines: QuoteLine[];
  /** إجمالي التكلفة على الشركة. */
  cost: number;
  /** الزيادة فوق التكلفة (الهامش). */
  markup: number;
  /** رسوم التحويل. */
  fees: number;
  /** ما أُضيف بسبب التقريب لأعلى. */
  rounding: number;
  /** سعر البيع النهائي للمجموعة. */
  sell: number;
  /** صافي الربح = سعر البيع − التكلفة. */
  profit: number;
  /** نصيب الفرد البالغ من سعر البيع. */
  perAdult: number;
  deposit: number;
  /** عدد الأشخاص الذين تُحتسب عليهم التذاكر والخدمات الفردية. */
  payingPax: number;
}

/** يضرب مبلغاً بالسنت في نسبة مئوية صحيحة ويعيد سنتاً صحيحاً. */
function pct(cents: number, percent: number): number {
  return Math.round((cents * percent) / 100);
}

/** يضرب مبلغاً بالسنت في نسبة بأجزاء العشرة آلاف ويعيد سنتاً صحيحاً. */
function bp(cents: number, basisPoints: number): number {
  return Math.round((cents * basisPoints) / 10_000);
}

function nonNeg(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * يحسب عرض سعر واحداً.
 *
 * الرضّع لا يُحتسب عليهم تذاكر ولا خدمات فردية.
 * الطفل الأول مجاني في الغرفة عند تفعيل `childFreeInRoom`.
 */
export function quote(input: QuoteInput): QuoteResult {
  const adults = Math.max(1, nonNeg(input.adults));
  const children = nonNeg(input.children);
  const rooms = Math.max(1, nonNeg(input.rooms));
  const chargedChildren = input.childFreeInRoom ? Math.max(0, children - 1) : children;
  const payingPax = adults + chargedChildren;
  const seasonPct = SEASON_PCT[input.season] ?? 100;

  const lines: QuoteLine[] = [];
  const add = (key: string, label: string, detail: string, amount: number): number => {
    if (amount > 0) lines.push({ key, label, detail, amount });
    return amount;
  };

  const hotelNights = nonNeg(input.hotelNights);
  const hotel = add(
    'hotel',
    'الإقامة',
    `${money(input.hotelRate)} × ${rooms} غرفة × ${hotelNights} ليلة` +
      (seasonPct === 100 ? '' : ` · موسم ${SEASON_LABEL[input.season]}`),
    pct(nonNeg(input.hotelRate) * rooms * hotelNights, seasonPct),
  );

  const carDays = nonNeg(input.carDays);
  const car = add(
    'car',
    'المواصلات الداخلية',
    `${money(input.carRate)} × ${carDays} يوم`,
    nonNeg(input.carRate) * carDays,
  );

  const transferCount = nonNeg(input.transfers);
  const transfer = add(
    'transfer',
    'استقبال وتوديع المطار',
    `${transferCount} نقلة × ${money(input.transferRate)}`,
    nonNeg(input.transferRate) * transferCount,
  );

  const tourTotal = input.tours.reduce((sum, t) => sum + nonNeg(t.price), 0);
  const tours = add('tours', 'الجولات', `${input.tours.length} جولة`, tourTotal);

  const tickets = add(
    'tickets',
    'تذاكر الدخول',
    `${money(input.ticketPerPerson)} × ${payingPax} شخص`,
    nonNeg(input.ticketPerPerson) * payingPax,
  );

  const guideDays = nonNeg(input.guideDays);
  const guide = add(
    'guide',
    'مرشد عربي',
    `${guideDays} يوم × ${money(input.guideRate)}`,
    nonNeg(input.guideRate) * guideDays,
  );

  const extras = add(
    'extras',
    'خدمات إضافية',
    'شريحة اتصال · عشاء ترحيبي · متفرقات',
    (nonNeg(input.simPerPerson) + nonNeg(input.dinnerPerPerson)) * payingPax + nonNeg(input.miscTotal),
  );

  const cost = hotel + car + transfer + tours + tickets + guide + extras;

  const markup = pct(cost, Math.max(0, input.marginPct));
  const fees = bp(cost + markup, Math.max(0, input.feesBp));
  const beforeRounding = cost + markup + fees;

  const step = nonNeg(input.roundTo);
  const sell = step > 1 ? Math.ceil(beforeRounding / step) * step : beforeRounding;

  return {
    lines,
    cost,
    markup,
    fees,
    rounding: sell - beforeRounding,
    sell,
    profit: sell - cost,
    perAdult: Math.round(sell / adults),
    deposit: pct(sell, Math.max(0, Math.min(100, input.depositPct))),
    payingPax,
  };
}

export interface TierRates {
  /** سعر الغرفة لليلة لهذه الفئة، بالسنت. */
  hotelRate: number;
  /** سعر السيارة لليوم لهذه الفئة، بالسنت. */
  carRate: number;
  /** هل تشمل الفئة مرشداً طوال البرنامج. */
  guideIncluded: boolean;
  hotelName?: string;
}

export interface TierOffer extends QuoteResult {
  tier: Tier;
  label: string;
  hotelName?: string;
}

/**
 * يبني ثلاثة عروض من برنامج واحد بتبديل الفندق والسيارة والهامش فقط.
 * الجولات والأيام وعدد الأشخاص تبقى كما هي — نفس البرنامج، ثلاثة أسعار.
 */
export function threeTiers(base: QuoteInput, rates: Record<Tier, TierRates>): TierOffer[] {
  return (Object.keys(TIER_MARGIN_PCT) as Tier[]).map((tier) => {
    const r = rates[tier];
    const result = quote({
      ...base,
      hotelRate: r.hotelRate,
      carRate: r.carRate,
      guideDays: r.guideIncluded ? Math.max(base.guideDays, base.carDays) : base.guideDays,
      marginPct: TIER_MARGIN_PCT[tier],
    });
    return { ...result, tier, label: TIER_LABEL[tier], hotelName: r.hotelName };
  });
}

/** يحوّل سنتات إلى نص بالدولار مثل `$1,240`. للعرض فقط، لا يُستخدم في الحساب. */
export function money(cents: number, currency = 'USD'): string {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', SAR: 'ر.س ', TRY: '₺' };
  const sym = symbols[currency] ?? '';
  const whole = Math.round(cents / 100);
  return sym + whole.toLocaleString('en-US');
}

/** يحوّل مبلغاً مكتوباً بالدولار (مثل "85" أو "85.5") إلى سنتات صحيحة. */
export function toCents(amount: string | number): number {
  const n = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
