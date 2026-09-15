/**
 * الحدّ الفاصل بين ما نعرفه وما يراه الزبون.
 *
 * `TierOffer` يحمل التكلفة والربح. هذه الدالة هي المكان الوحيد الذي يتحوّل فيه
 * إلى `OfferDoc`، وهي لا تنسخ إلا سعر البيع ونصيب الفرد. أي حقل مالي داخلي
 * يتوقف هنا. فحص `render.test.ts` يتأكد من ذلك على المخرج النهائي لا على النية.
 */
import type { TierOffer, Tier } from './pricing.ts';
import type { OfferDoc, OfferTier } from './templates/offer.ts';
import type { CardDoc } from './templates/card.ts';
import type { Day, RouteNight, Practical } from './itinerary.ts';

/** ما يميّز كل فئة، بلغة الزبون. */
const TIER_EXTRAS: Record<Tier, string[]> = {
  economy: ['إقامة مع الإفطار', 'سيارة خاصة مع سائق', 'الجولات الأساسية', 'استقبال وتوديع المطار'],
  premium: ['إقامة مع الإفطار', 'فان خاصة مع سائق', 'كل الجولات + تذاكر الدخول', 'شريحة اتصال هدية'],
  vip: ['إقامة فاخرة مع الإفطار', 'فان VIP مع سائق', 'مرشد عربي طوال البرنامج', 'عشاء ترحيبي'],
};

const DEFAULT_EXCLUDES = [
  'تذاكر الطيران الدولية',
  'الغداء والعشاء',
  'التأمين الصحي والسفر',
  'المصاريف الشخصية والإكراميات',
  'كل ما لم يُذكر في بند «يشمل»',
];

export interface OfferDocInput {
  serial: string;
  destinationName: string;
  nights: number;
  travelers: { adults: number; childrenFree: number; childrenBed: number; rooms: number };
  offers: TierOffer[];
  /** فئة الفندق لكل مستوى: economy → '3' وهكذا. */
  hotelClasses: Partial<Record<Tier, string>>;
  tourNames: string[];
  depositPct: number;
  currency: string;
  travelMonth?: string;
  customerName?: string;
  hasTickets: boolean;
  validDays?: number;
  heroImage?: string;
  gallery?: string[];
  imageCredits?: string;
  itinerary?: Day[];
  route?: RouteNight[];
  practical?: Practical;
}

export function toOfferDoc(i: OfferDocInput): OfferDoc {
  const recommended: Tier = 'premium';
  const chosen = i.offers.find((o) => o.tier === recommended) ?? i.offers[0]!;

  // صورة مختلفة لكل فئة ما دامت الصور تكفي، وإلا تتكرر الأولى
  const images = [i.heroImage, ...(i.gallery ?? [])].filter((x): x is string => Boolean(x));

  const tiers: OfferTier[] = i.offers.map((o, idx) => ({
    label: o.label,
    hotelName: o.hotelName,
    hotelClass: i.hotelClasses[o.tier],
    // الحقلان الوحيدان الماليان اللذان يعبران: كلاهما سعر بيع
    price: o.sell,
    perAdult: o.perAdult,
    extras: TIER_EXTRAS[o.tier],
    recommended: o.tier === recommended,
    image: images[idx] ?? images[0],
  }));

  const includes = [
    `الإقامة ${i.nights} ليالٍ مع الإفطار`,
    'الاستقبال والتوديع من المطار',
    'سيارة خاصة مع سائق طوال البرنامج',
    i.tourNames.length ? 'جميع الجولات المذكورة في البرنامج' : 'الجولات حسب الاتفاق',
    ...(i.hasTickets ? ['تذاكر الدخول للأماكن المذكورة'] : []),
    'متابعة على مدار الرحلة من مكتبنا',
  ];

  return {
    serial: i.serial,
    issueDate: new Date().toISOString().slice(0, 10),
    destinationName: i.destinationName,
    days: i.nights + 1,
    nights: i.nights,
    travelMonth: i.travelMonth,
    customerName: i.customerName,
    travelers: i.travelers,
    tiers,
    tours: i.tourNames,
    includes,
    excludes: DEFAULT_EXCLUDES,
    depositPct: i.depositPct,
    depositAmount: chosen.deposit,
    validDays: i.validDays ?? 7,
    currency: i.currency,
    heroImage: i.heroImage,
    gallery: i.gallery,
    imageCredits: i.imageCredits,
    itinerary: i.itinerary,
    route: i.route,
    practical: i.practical,
  };
}

/**
 * بطاقة الصورة من نفس المستند — أرخص سعر **للبالغ** وأبرز الجولات.
 * البطاقات تُنشر على الموقع، وقرار المالك أن سعر الموقع للشخص لا للمجموعة.
 */
export function toCardDoc(doc: OfferDoc): CardDoc {
  return {
    destinationName: doc.destinationName,
    days: doc.days,
    nights: doc.nights,
    fromPrice: Math.min(...doc.tiers.map((t) => t.perAdult)),
    currency: doc.currency,
    highlights: doc.tours.length ? doc.tours : doc.includes,
    heroImage: doc.heroImage,
  };
}
