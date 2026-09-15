/**
 * الفحص الأهم في هذه المرحلة: أن التكلفة والربح لا يصلان الزبون أبداً.
 * ثم أن التوليد نفسه ينتج PDF وصورة صالحين.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { threeTiers, money, type QuoteInput, type Tier, type TierRates } from './pricing.ts';
import { toOfferDoc, toCardDoc } from './offerdoc.ts';
import { offerHtml } from './templates/offer.ts';
import { cardHtml, CARD_DIMENSIONS } from './templates/card.ts';
import { findBrowser, renderPdf, renderPng, closeBrowser } from './render.ts';

const input: QuoteInput = {
  nights: 6, adults: 2, childrenFree: 0, childrenBed: 2, season: 'normal',
  hotelRate: 9_775, tripleExtra: 3_400, hotelNights: 6, carRate: 9_500, carDays: 5,
  transfers: 2, transferRate: 4_500,
  tours: [
    { name: 'جولة أوزنجول وحيدر نبي', price: 9_000 },
    { name: 'جولة مرتفعات ايدر', price: 11_000 },
    { name: 'دير سوميلا ومدينة طرابزون', price: 10_000 },
  ],
  ticketPerPerson: 1_200, guideDays: 0, guideRate: 7_000,
  simPerPerson: 0, dinnerPerPerson: 0, miscTotal: 0,
  marginPct: 22, feesBp: 250, depositPct: 30, roundTo: 1_000,
};

const rates: Record<Tier, TierRates> = {
  economy: { hotelRate: 5_750, tripleExtra: 2_000, carRate: 7_000, guideIncluded: false, hotelName: 'فندق 3 نجوم — طرابزون' },
  premium: { hotelRate: 9_775, tripleExtra: 3_400, carRate: 9_500, guideIncluded: false, hotelName: 'فندق 4 نجوم — طرابزون' },
  vip: { hotelRate: 16_675, tripleExtra: 5_800, carRate: 15_000, guideIncluded: true, hotelName: 'فندق 5 نجوم — طرابزون' },
};

const offers = threeTiers(input, rates);
const doc = toOfferDoc({
  serial: 'AT-2026-0001',
  destinationName: 'الشمال التركي — طرابزون وأوزنجول',
  nights: 6,
  travelers: { adults: 2, childrenFree: 0, childrenBed: 2, rooms: 2 },
  offers,
  hotelClasses: { economy: '3', premium: '4', vip: '5' },
  tourNames: input.tours.map((t) => t.name),
  depositPct: 30,
  currency: 'USD',
  travelMonth: '2026-07',
  customerName: 'أبو محمد',
  hasTickets: true,
  heroImage: 'https://alarabtravelers.com/wp-content/uploads/2022/06/hero.jpg',
  gallery: [
    'https://alarabtravelers.com/wp-content/uploads/2022/06/a.jpg',
    'https://alarabtravelers.com/wp-content/uploads/2019/09/b.jpg',
  ],
});

test('المستند لا يحمل أي حقل مالي داخلي', () => {
  const json = JSON.stringify(doc);
  for (const forbidden of ['cost', 'profit', 'markup', 'fees', 'rounding', 'lines', 'payingPax']) {
    assert.ok(!json.includes(`"${forbidden}"`), `حقل داخلي تسرّب إلى مستند الزبون: ${forbidden}`);
  }
});

test('أرقام التكلفة والربح لا تظهر في نص المستند', () => {
  const html = offerHtml(doc);
  for (const offer of offers) {
    for (const [label, cents] of [['التكلفة', offer.cost], ['الربح', offer.profit], ['الهامش', offer.markup]] as const) {
      const shown = money(cents, 'USD');
      assert.ok(
        !html.includes(shown),
        `${label} (${shown}) لفئة ${offer.label} ظاهر في مستند الزبون`,
      );
    }
    // سعر البيع يجب أن يظهر — وإلا فالمستند فارغ من فائدته
    assert.ok(html.includes(money(offer.sell, 'USD')), `سعر ${offer.label} غير ظاهر`);
  }
});

test('المستند يحمل الهوية الصحيحة ولا يحمل هوية غيرنا', () => {
  const html = offerHtml(doc);
  assert.ok(html.includes('المسافرون العرب'), 'اسم الشركة غائب');
  assert.ok(html.includes('alarabtravelers.com'), 'الموقع غائب');
  for (const foreign of ['Traveliun', 'ترافليون', 'traveliun.com', 'info@traveliun']) {
    assert.ok(!html.includes(foreign), `هوية شركة أخرى في المستند: ${foreign}`);
  }
});

test('الأقسام الفارغة تُحذف ولا تترك صناديق فارغة', () => {
  const bare = offerHtml({ ...doc, tours: [], customerName: undefined, travelMonth: undefined });
  assert.ok(!bare.includes('البرنامج والجولات'), 'قسم الجولات ظهر بلا جولات');
  assert.ok(!bare.includes('بيانات العرض'), 'قسم بيانات العرض ظهر فارغاً');
  assert.ok(bare.includes('ثلاثة خيارات'), 'قسم الخيارات يجب أن يبقى دائماً');
});

test('كل نص من البيانات مهروب قبل أن يدخل الصفحة', () => {
  // اسم الوجهة واسم الفندق يأتيان من قاعدة البيانات التي يملأها الفريق —
  // حدّ ثقة يجب أن يُهرَّب مهما كان مصدره موثوقاً.
  const evil = '<script>alert(1)</script>';
  const html = offerHtml({
    ...doc,
    destinationName: evil,
    tiers: doc.tiers.map((t) => ({ ...t, hotelName: evil })),
  });
  assert.ok(!html.includes(evil), 'وسم من البيانات دخل الصفحة كما هو');
  assert.ok(html.includes('&lt;script&gt;'), 'الهروب لم يحدث');
});

test('المستند عام لا يحمل اسم زبون بعينه', () => {
  const html = offerHtml({ ...doc, customerName: 'أبو محمد العتيبي' });
  assert.ok(!html.includes('أبو محمد العتيبي'), 'اسم الزبون ظهر في برنامج عام');
  assert.ok(html.includes('عن هذا البرنامج'), 'صفحة التعريف بالبرنامج غائبة');
});

test('الصور تصل إلى المستند والبطاقة', () => {
  const html = offerHtml(doc);
  assert.ok(html.includes('hero.jpg'), 'صورة الغلاف غائبة عن المستند');
  assert.ok(html.includes('/a.jpg') && html.includes('/b.jpg'), 'شريط الصور غائب');
  const card = cardHtml(toCardDoc(doc), 'square');
  assert.ok(card.includes('hero.jpg'), 'خلفية البطاقة غائبة');
  // بلا صور يجب أن يبقى المستند صالحاً لا مكسوراً
  const bare = offerHtml({ ...doc, heroImage: undefined, gallery: [] });
  assert.ok(!bare.includes('<img class="bleed"'), 'وسم صورة فارغ بلا مصدر');
  assert.ok(bare.includes('ثلاثة خيارات'), 'المستند انكسر بلا صور');
});

test('بطاقة الصورة تأخذ أرخص سعر للبالغ ومقاسها صحيح', () => {
  const card = toCardDoc(doc);
  assert.equal(card.fromPrice, Math.min(...offers.map((o) => o.perAdult)));
  assert.ok(cardHtml(card, 'square').includes('للشخص'), 'البطاقة تُنشر على الموقع وسعرها للشخص');
  const square = cardHtml(card, 'square');
  assert.ok(square.includes('1080px'));
  assert.ok(square.includes(money(card.fromPrice, 'USD')));
  for (const offer of offers) {
    assert.ok(!square.includes(money(offer.cost, 'USD')), 'تكلفة ظاهرة في البطاقة');
  }
});

/* --------- التوليد الفعلي: يتخطّى نفسه إن لم يوجد متصفح --------- */

let hasBrowser = true;
try {
  findBrowser();
} catch {
  hasBrowser = false;
}

test('توليد PDF حقيقي', { skip: hasBrowser ? false : 'لا يوجد متصفح على هذا الجهاز' }, async (t) => {
  t.after(closeBrowser);
  const pdf = await renderPdf(offerHtml(doc));
  const head = Buffer.from(pdf.slice(0, 5)).toString('latin1');
  assert.equal(head, '%PDF-', 'المخرج ليس ملف PDF');
  assert.ok(pdf.byteLength > 20_000, `الملف صغير على نحو مريب: ${pdf.byteLength} بايت`);
});

test('توليد صورة مربعة حقيقية', { skip: hasBrowser ? false : 'لا يوجد متصفح على هذا الجهاز' }, async (t) => {
  t.after(closeBrowser);
  const png = await renderPng(cardHtml(toCardDoc(doc), 'square'), CARD_DIMENSIONS.square);
  assert.deepEqual([...png.slice(0, 4)], [0x89, 0x50, 0x4e, 0x47], 'المخرج ليس PNG');
  // عرض الصورة مخزَّن في IHDR بترتيب big-endian بدءاً من البايت 16
  const width = Buffer.from(png.slice(16, 20)).readUInt32BE(0);
  const height = Buffer.from(png.slice(20, 24)).readUInt32BE(0);
  assert.equal(width, 1080);
  assert.equal(height, 1080);
});
