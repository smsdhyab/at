/**
 * فحص محرك التسعير — أرقام محسوبة يدوياً.
 * التشغيل:  npm test
 * إن انحرف رقم واحد يفشل الفحص. هذا هو الحارس الوحيد على المال.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  quote, threeTiers, planRooms, money, toCents,
  type QuoteInput, type Tier, type TierRates,
} from './pricing.ts';

/* ------------------------------ توزيع الغرف ------------------------------ */

test('البالغون يتقاسمون غرفاً مزدوجة', () => {
  assert.deepEqual(planRooms(1, 0), { rooms: 1, triples: 0, payingPax: 1 });
  assert.deepEqual(planRooms(2, 0), { rooms: 1, triples: 0, payingPax: 2 });
  assert.deepEqual(planRooms(3, 0), { rooms: 2, triples: 0, payingPax: 3 });
  assert.deepEqual(planRooms(4, 0), { rooms: 2, triples: 0, payingPax: 4 });
});

test('الطفل من ست فأكثر يحوّل غرفة إلى ثلاثية لا يفتح غرفة جديدة', () => {
  // بالغان وطفل واحد: غرفة واحدة ثلاثية — أرخص للزبون من غرفتين
  assert.deepEqual(planRooms(2, 1), { rooms: 1, triples: 1, payingPax: 3 });
  // أربعة بالغين وطفلان: غرفتان، كلتاهما ثلاثية
  assert.deepEqual(planRooms(4, 2), { rooms: 2, triples: 2, payingPax: 6 });
});

test('الأطفال الزائدون عن عدد الغرف تُفتح لهم غرف', () => {
  // بالغان وطفلان: غرفة ثلاثية + غرفة للطفل الثاني
  assert.deepEqual(planRooms(2, 2), { rooms: 2, triples: 0, payingPax: 4 });
  // أربعة بالغين وثلاثة أطفال: غرفتان ثلاثيتان + غرفة للثالث
  assert.deepEqual(planRooms(4, 3), { rooms: 3, triples: 1, payingPax: 7 });
});

test('مدخلات فاسدة لا تكسر التوزيع', () => {
  assert.deepEqual(planRooms(0, 0), { rooms: 1, triples: 0, payingPax: 1 });
  assert.deepEqual(planRooms(-3, -2), { rooms: 1, triples: 0, payingPax: 1 });
  assert.deepEqual(planRooms(NaN, NaN), { rooms: 1, triples: 0, payingPax: 1 });
});

/* ------------------------------ الحالة المرجعية ------------------------------ */

/** طرابزون، 6 ليالٍ، بالغان وطفلان فوق السادسة، موسم مرتفع، فئة مميز. */
const trabzon: QuoteInput = {
  nights: 6,
  adults: 2,
  childrenFree: 0,
  childrenBed: 2,
  season: 'high',
  hotelRate: 8_500,
  tripleExtra: 3_000,
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
};

test('الحالة المرجعية: كل بند محسوب يدوياً', () => {
  const r = quote(trabzon);

  // غرفتان مزدوجتان: البالغان في واحدة والطفلان في الأخرى، بلا سرير إضافي
  assert.deepEqual(r.plan, { rooms: 2, triples: 0, payingPax: 4 });

  // الإقامة: 8500 × غرفتين × 6 ليالٍ = 102000، × 115٪ للموسم المرتفع = 117300
  assert.equal(r.lines.find((l) => l.key === 'hotel')?.amount, 117_300);
  assert.equal(r.lines.find((l) => l.key === 'car')?.amount, 47_500);
  assert.equal(r.lines.find((l) => l.key === 'transfer')?.amount, 9_000);
  assert.equal(r.lines.find((l) => l.key === 'tours')?.amount, 30_000);
  assert.equal(r.lines.find((l) => l.key === 'tickets')?.amount, 4_800);

  assert.equal(r.cost, 208_600);
  assert.equal(r.markup, 45_892);
  assert.equal(r.fees, 6_362);
  assert.equal(r.sell, 261_000);
  assert.equal(r.rounding, 146);
  assert.equal(r.profit, 52_400);
  assert.equal(r.perAdult, 130_500);
  assert.equal(r.deposit, 78_300);
  assert.equal(r.payingPax, 4);
});

test('الأطفال دون السادسة لا يكلّفون شيئاً', () => {
  const withFree = quote({ ...trabzon, childrenFree: 3 });
  const without = quote({ ...trabzon, childrenFree: 0 });
  assert.equal(withFree.cost, without.cost, 'طفل دون السادسة غيّر التكلفة');
  assert.equal(withFree.sell, without.sell);
  assert.equal(withFree.plan.rooms, without.plan.rooms, 'طفل دون السادسة فتح غرفة');
});

test('البنود الصفرية لا تظهر في التفصيل', () => {
  const r = quote(trabzon);
  assert.equal(r.lines.find((l) => l.key === 'guide'), undefined);
  assert.equal(r.lines.find((l) => l.key === 'extras'), undefined);
  assert.equal(r.lines.length, 5);
});

test('المرشد والخدمات، بلا تقريب وبلا رسوم', () => {
  const r = quote({
    ...trabzon,
    nights: 4,
    childrenBed: 0,
    childrenFree: 1,
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
  });

  // بالغان بلا أطفال بسرير ⇒ غرفة واحدة، وشخصان تُحتسب عليهما التذاكر
  assert.deepEqual(r.plan, { rooms: 1, triples: 0, payingPax: 2 });
  assert.equal(r.lines.find((l) => l.key === 'hotel')?.amount, 24_000);
  assert.equal(r.lines.find((l) => l.key === 'tickets')?.amount, 2_000);
  assert.equal(r.lines.find((l) => l.key === 'extras')?.amount, 6_500);
  assert.equal(r.lines.find((l) => l.key === 'guide')?.amount, 14_000);

  assert.equal(r.cost, 83_500);
  assert.equal(r.markup, 15_030);
  assert.equal(r.fees, 0);
  assert.equal(r.rounding, 0, 'roundTo = 0 يعني بلا تقريب');
  assert.equal(r.sell, 98_530);
  assert.equal(r.deposit, 49_265);
});

test('ثلاث فئات من برنامج واحد', () => {
  const rates: Record<Tier, TierRates> = {
    economy: { hotelRate: 5_000, tripleExtra: 1_800, carRate: 7_000, guideIncluded: false },
    premium: { hotelRate: 8_500, tripleExtra: 3_000, carRate: 9_500, guideIncluded: false },
    vip: { hotelRate: 14_500, tripleExtra: 5_100, carRate: 15_000, guideIncluded: true },
  };
  const [eco, prem, vip] = threeTiers(trabzon, rates);

  assert.equal(prem?.sell, 261_000, 'فئة مميز تطابق الحالة المرجعية تماماً');
  assert.ok(eco!.sell < prem!.sell && prem!.sell < vip!.sell, 'الأسعار لا تتصاعد');

  // VIP يشمل مرشداً طوال أيام البرنامج دون أن يطلبه المستخدم
  assert.equal(vip?.lines.find((l) => l.key === 'guide')?.amount, 35_000);
});

test('الأرقام صحيحة دائماً — لا كسور عشرية في أي مبلغ', () => {
  const r = quote({ ...trabzon, hotelRate: 8_333, tripleExtra: 2_917, feesBp: 333, marginPct: 17 });
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
    hotelRate: -500,
    tripleExtra: -100,
    carDays: NaN,
    tours: [],
    marginPct: -10,
  });
  assert.ok(r.cost >= 0);
  assert.ok(r.sell >= 0);
  assert.ok(Number.isInteger(r.perAdult), 'القسمة على صفر بالغين لا تُنتج NaN');
});

test('برنامجا إسطنبول الحقيقيان يطابقان التكلفة المرسلة', () => {
  // ورقة الأسعار السارية من 2026-09-07: فندق Four Sides بـ 60$ للغرفة المزدوجة
  // في الليلة، السرير الثالث 20$، نقلتا مطار بـ 50$ للنقلة، وثلاث جولات داخل
  // إسطنبول بـ 100$ للجولة. الأرقام أدناه تكلفة صافية بلا هامش ولا رسوم.
  const base = {
    nights: 6, season: 'normal' as const,
    hotelRate: 6_000, tripleExtra: 2_000, hotelNights: 6,
    carRate: 0, carDays: 0,
    transfers: 2, transferRate: 5_000,
    tours: [1, 2, 3].map((i) => ({ name: `جولة ${i}`, price: 10_000 })),
    ticketPerPerson: 0, guideDays: 0, guideRate: 0,
    simPerPerson: 0, dinnerPerPerson: 0, miscTotal: 0,
    marginPct: 0, feesBp: 0, depositPct: 30, roundTo: 1,
  };

  // شخصان: غرفة واحدة — 6×60 + 2×50 + 3×100
  assert.equal(quote({ ...base, adults: 2, childrenFree: 0, childrenBed: 0 }).cost, 76_000);

  // شخصان وطفلان: غرفتان مزدوجتان بلا سرير إضافي — 6×120 + 2×50 + 3×100
  assert.equal(quote({ ...base, adults: 2, childrenFree: 0, childrenBed: 2 }).cost, 112_000);
});
