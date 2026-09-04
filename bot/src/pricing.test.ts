/**
 * فحص محرك التسعير — ثلاث حالات محسوبة يدوياً.
 * التشغيل:  npm test
 * إن انحرف رقم واحد يفشل الفحص. هذا هو الحارس الوحيد على المال.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quote, threeTiers, money, toCents, type QuoteInput, type Tier, type TierRates } from './pricing.ts';

/** الحالة المرجعية: طرابزون، 6 ليالٍ، بالغان وطفلان، موسم مرتفع، فئة مميز. */
const trabzon: QuoteInput = {
  nights: 6,
  adults: 2,
  children: 2,
  infants: 0,
  rooms: 1,
  season: 'high',
  hotelRate: 8_500,
  hotelNights: 6,
  carRate: 9_500,
  carDays: 5,
  transfers: 2,
  transferRate: 4_500,
  tours: [
    { name: 'جولة أوزنجول وحيدر نبي', price: 9_000 },
    { name: 'جولة مرتفعات ايدر', price: 11_000 },
    { name: 'دير سوميلا ومدينة طرابزون', price: 10_000 },
  ],
  ticketPerPerson: 1_200,
  guideDays: 0,
  guideRate: 7_000,
  simPerPerson: 0,
  dinnerPerPerson: 0,
  miscTotal: 0,
  marginPct: 22,
  feesBp: 250,
  depositPct: 30,
  roundTo: 1_000,
  childFreeInRoom: false,
};

test('الحالة المرجعية: كل بند محسوب يدوياً', () => {
  const r = quote(trabzon);

  // الإقامة: 8500 × 1 غرفة × 6 ليالٍ = 51000، × 115٪ للموسم المرتفع = 58650
  assert.equal(r.lines.find((l) => l.key === 'hotel')?.amount, 58_650);
  assert.equal(r.lines.find((l) => l.key === 'car')?.amount, 47_500);
  assert.equal(r.lines.find((l) => l.key === 'transfer')?.amount, 9_000);
  assert.equal(r.lines.find((l) => l.key === 'tours')?.amount, 30_000);
  assert.equal(r.lines.find((l) => l.key === 'tickets')?.amount, 4_800);

  assert.equal(r.cost, 149_950);
  assert.equal(r.markup, 32_989);
  assert.equal(r.fees, 4_573);
  assert.equal(r.sell, 188_000);
  assert.equal(r.rounding, 488);
  assert.equal(r.profit, 38_050);
  assert.equal(r.perAdult, 94_000);
  assert.equal(r.deposit, 56_400);
  assert.equal(r.payingPax, 4);
});

test('البنود الصفرية لا تظهر في التفصيل', () => {
  const r = quote(trabzon);
  assert.equal(r.lines.find((l) => l.key === 'guide'), undefined);
  assert.equal(r.lines.find((l) => l.key === 'extras'), undefined);
  assert.equal(r.lines.length, 5);
});

test('الطفل المجاني والمرشد والخدمات، بلا تقريب وبلا رسوم', () => {
  const r = quote({
    ...trabzon,
    nights: 4,
    children: 1,
    infants: 1,
    season: 'normal',
    hotelRate: 6_000,
    hotelNights: 4,
    carRate: 7_000,
    carDays: 3,
    transfers: 1,
    transferRate: 4_000,
    tours: [{ name: 'جولة واحدة', price: 12_000 }],
    ticketPerPerson: 1_000,
    guideDays: 2,
    simPerPerson: 500,
    dinnerPerPerson: 2_000,
    miscTotal: 1_500,
    marginPct: 18,
    feesBp: 0,
    depositPct: 50,
    roundTo: 0,
    childFreeInRoom: true,
  });

  // الرضيع لا يُحتسب، والطفل الأول مجاني ⇒ شخصان فقط تُحتسب عليهما التذاكر والخدمات
  assert.equal(r.payingPax, 2);
  assert.equal(r.lines.find((l) => l.key === 'tickets')?.amount, 2_000);
  assert.equal(r.lines.find((l) => l.key === 'extras')?.amount, 6_500);
  assert.equal(r.lines.find((l) => l.key === 'guide')?.amount, 14_000);

  assert.equal(r.cost, 83_500);
  assert.equal(r.markup, 15_030);
  assert.equal(r.fees, 0);
  assert.equal(r.rounding, 0, 'roundTo = 0 يعني بلا تقريب');
  assert.equal(r.sell, 98_530);
  assert.equal(r.profit, 15_030);
  assert.equal(r.deposit, 49_265);
});

test('ثلاث فئات من برنامج واحد', () => {
  const rates: Record<Tier, TierRates> = {
    economy: { hotelRate: 5_000, carRate: 7_000, guideIncluded: false },
    premium: { hotelRate: 8_500, carRate: 9_500, guideIncluded: false },
    vip: { hotelRate: 14_500, carRate: 15_000, guideIncluded: true },
  };
  const [eco, prem, vip] = threeTiers(trabzon, rates);

  assert.equal(eco?.sell, 138_000);
  assert.equal(prem?.sell, 188_000, 'فئة مميز تطابق الحالة المرجعية تماماً');
  assert.equal(vip?.sell, 334_000);

  // VIP يشمل مرشداً طوال أيام البرنامج دون أن يطلبه المستخدم
  assert.equal(vip?.lines.find((l) => l.key === 'guide')?.amount, 35_000);

  // الأسعار تتصاعد دائماً — لو انعكس الترتيب فهناك خطأ في الأسعار المدخلة
  assert.ok(eco!.sell < prem!.sell && prem!.sell < vip!.sell);
});

test('الأرقام صحيحة دائماً — لا كسور عشرية في أي مبلغ', () => {
  const r = quote({ ...trabzon, hotelRate: 8_333, feesBp: 333, marginPct: 17 });
  for (const [key, value] of Object.entries(r)) {
    if (typeof value === 'number') {
      assert.ok(Number.isInteger(value), `${key} ليس عدداً صحيحاً: ${value}`);
    }
  }
  for (const line of r.lines) {
    assert.ok(Number.isInteger(line.amount), `${line.key} ليس عدداً صحيحاً`);
  }
});

test('تحويل المبالغ نصاً ورقماً', () => {
  assert.equal(toCents('85'), 8_500);
  assert.equal(toCents('85.5'), 8_550);
  assert.equal(toCents('$1,240'), 124_000);
  assert.equal(toCents('نص بلا رقم'), 0);
  assert.equal(money(188_000), '$1,880');
  assert.equal(money(188_000, 'TRY'), '₺1,880');
});

test('المدخلات السالبة أو الفارغة لا تكسر الحساب', () => {
  const r = quote({
    ...trabzon,
    adults: 0,
    rooms: 0,
    hotelRate: -500,
    carDays: NaN,
    tours: [],
    marginPct: -10,
  });
  assert.equal(r.cost >= 0, true);
  assert.equal(r.sell >= 0, true);
  assert.ok(Number.isInteger(r.perAdult), 'القسمة على صفر بالغين لا تُنتج NaN');
});
