/**
 * فحص تكاملي: قاعدة بيانات حقيقية في الذاكرة، بالمخطط والبيانات الابتدائية نفسها.
 * يمرّ على المسار الذي يسلكه البوت فعلاً — من قراءة الأسعار إلى حفظ العرض.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { threeTiers, type QuoteInput, type Tier, type TierRates } from './pricing.ts';

// لا بد من ضبط الملف قبل استيراد db.ts لأنه يفتح القاعدة عند الاستيراد
process.env.DB_FILE = ':memory:';
const db = await import('./db.ts');

const migrations = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

before(() => {
  for (const f of readdirSync(migrations).filter((f) => f.endsWith('.sql')).sort()) {
    db.db.exec(readFileSync(join(migrations, f), 'utf8'));
  }
});

after(() => db.close());

test('الوجهات الأربع مزروعة وبأسعار خدمات', () => {
  const dests = db.listDestinations();
  assert.equal(dests.length, 4);
  assert.deepEqual(
    dests.map((d) => d.slug),
    ['north', 'istanbul', 'cappadocia', 'antalya'],
  );
  const north = db.getDestination('north');
  assert.equal(north?.transfer_rate, 4_500);
  assert.equal(north?.ticket_pp, 1_200);
  assert.equal(north?.guide_rate, 7_000);
});

test('كل وجهة لها فندق في كل فئة وسيارة من كل نوع', () => {
  for (const dest of db.listDestinations()) {
    const { three, four, five } = db.hotelsByClass(dest.slug);
    assert.ok(three && four && five, `${dest.slug}: تنقصه فئة فندق`);
    assert.ok(three.rate_normal < four.rate_normal, `${dest.slug}: 3 نجوم ليست أرخص من 4`);
    assert.ok(four.rate_normal < five.rate_normal, `${dest.slug}: 4 نجوم ليست أرخص من 5`);
    assert.ok(four.rate_high > four.rate_normal, `${dest.slug}: سعر الموسم المرتفع ليس أعلى`);

    for (const kind of ['sedan', 'van', 'vip']) {
      assert.ok(db.carByKind(dest.slug, kind), `${dest.slug}: تنقصه سيارة ${kind}`);
    }
    assert.ok(db.listTours(dest.slug).length >= 4, `${dest.slug}: جولاته أقل من أربع`);
  }
});

test('المسار الكامل: أسعار القاعدة ← ثلاثة عروض ← حفظ ← قراءة', () => {
  const dest = db.getDestination('north')!;
  const { three, four, five } = db.hotelsByClass('north');
  const tours = db.listTours('north').slice(0, 3);

  const input: QuoteInput = {
    nights: 6,
    adults: 2,
    children: 2,
    infants: 0,
    rooms: 1,
    season: 'normal',
    hotelRate: four!.rate_high,
    hotelNights: 6,
    carRate: db.carByKind('north', 'van')!.rate_day,
    carDays: 5,
    transfers: 2,
    transferRate: dest.transfer_rate,
    tours: tours.map((t) => ({ name: t.name, price: t.price })),
    ticketPerPerson: dest.ticket_pp,
    guideDays: 0,
    guideRate: dest.guide_rate,
    simPerPerson: 0,
    dinnerPerPerson: 0,
    miscTotal: 0,
    marginPct: 22,
    feesBp: 250,
    depositPct: 30,
    roundTo: 1_000,
    childFreeInRoom: false,
  };

  const rates: Record<Tier, TierRates> = {
    economy: { hotelRate: three!.rate_high, carRate: db.carByKind('north', 'sedan')!.rate_day, guideIncluded: false },
    premium: { hotelRate: four!.rate_high, carRate: db.carByKind('north', 'van')!.rate_day, guideIncluded: false },
    vip: { hotelRate: five!.rate_high, carRate: db.carByKind('north', 'vip')!.rate_day, guideIncluded: true },
  };
  const offers = threeTiers(input, rates);
  const premium = offers.find((o) => o.tier === 'premium')!;

  assert.ok(premium.sell > premium.cost, 'سعر البيع لا يغطي التكلفة');
  assert.ok(offers[0]!.sell < offers[1]!.sell && offers[1]!.sell < offers[2]!.sell);

  const serial = db.nextSerial();
  assert.match(serial, /^AT-\d{4}-0001$/);

  const row = db.saveQuote({
    serial,
    createdBy: 12345,
    destination: 'north',
    season: 'high',
    travelMonth: '2026-07',
    customerName: 'أبو محمد',
    customerPhone: '+966500000000',
    input,
    tiers: offers,
    chosenTier: 'premium',
    cost: premium.cost,
    sell: premium.sell,
  });

  assert.equal(row.serial, serial);
  assert.equal(row.sell, premium.sell);
  assert.equal(row.status, 'draft');

  const back = db.getQuote(row.id)!;
  assert.equal(back.customer_name, 'أبو محمد');
  // المدخلات تعود كما دخلت تماماً — يمكن إعادة الحساب بلا تخمين
  assert.deepEqual(JSON.parse(back.input), JSON.parse(JSON.stringify(input)));

  const recent = db.listRecentQuotes(12345);
  assert.equal(recent.length, 1);
  assert.equal(recent[0]!.serial, serial);

  // الأرقام التسلسلية لا تتكرر
  assert.match(db.nextSerial(), /^AT-\d{4}-0002$/);
});

test('التقارير تحسب الربح ونسبة النجاح', () => {
  const before = db.stats(30);
  assert.equal(before.count, 1);
  assert.equal(before.won, 0);
  assert.ok(before.profit > 0);

  const [q] = db.listRecentQuotes(12345);
  db.setQuoteStatus(q!.id, 'won');
  assert.equal(db.stats(30).won, 1);
});

test('تعديل الأسعار يُحفظ فعلاً', () => {
  const [hotel] = db.listHotels('north');
  db.setHotelRates(hotel!.id, 9_900, 11_000);
  const after = db.listHotels('north').find((h) => h.id === hotel!.id)!;
  assert.equal(after.rate_normal, 9_900);
  assert.equal(after.rate_high, 11_000);

  db.addTour('north', 'جولة تجريبية', 8_800);
  assert.ok(db.listTours('north').some((t) => t.name === 'جولة تجريبية' && t.price === 8_800));

  db.setDestinationRate('north', 'ticket_pp', 1_500);
  assert.equal(db.getDestination('north')!.ticket_pp, 1_500);
});

test('اسم عمود غير مسموح يُرفض ولا يصل إلى الاستعلام', () => {
  assert.throws(
    () => db.setDestinationRate('north', 'name = 1; drop table quotes; --' as never, 1),
    /عمود غير مسموح/,
  );
});
