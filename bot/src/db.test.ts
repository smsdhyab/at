/**
 * فحص تكاملي على قاعدة Supabase الحقيقية.
 *
 * الفحوصات قرائية في أغلبها. ما يكتب منها يستعمل معرّفات فحص مخصصة وينظّف
 * نفسه في `after` — لا يترك أثراً في بيانات العمل.
 *
 * يتخطّى نفسه إن لم يوجد DATABASE_URL حتى لا تفشل الفحوصات على جهاز بلا إعداد.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const hasDb = Boolean(process.env.DATABASE_URL);
const skip = hasDb ? false : 'لا يوجد DATABASE_URL — فحص القاعدة متخطّى';

const db = hasDb ? await import('./db.ts') : null;

/** معرّف تليغرام وهمي للفحص — خارج نطاق المعرّفات الحقيقية. */
const TEST_UID = 900_000_001;
const TEST_SERIAL = 'TEST-DO-NOT-USE';

after(async () => {
  if (!db) return;
  await db.sql`delete from quotes where serial = ${TEST_SERIAL}`;
  await db.sql`delete from customers where name = 'زبون فحص'`;
  await db.sql`delete from sessions where telegram_id = ${TEST_UID}`;
  await db.close();
});

test('الوجهات الأربع موجودة بأسعار خدمات', { skip }, async () => {
  const dests = await db!.listDestinations();
  assert.equal(dests.length, 4);
  assert.deepEqual(dests.map((d) => d.slug), ['north', 'istanbul', 'cappadocia', 'antalya']);

  const north = await db!.getDestination('north');
  assert.ok(north);
  assert.ok(north.transfer_rate > 0 && north.ticket_pp > 0 && north.guide_rate > 0);
});

test('كل وجهة كاملة: فنادق الفئات الثلاث وسيارات وجولات وصور', { skip }, async () => {
  for (const dest of await db!.listDestinations()) {
    const { three, four, five } = await db!.hotelsByClass(dest.slug);
    assert.ok(three && four && five, `${dest.slug}: تنقصه فئة فندق`);
    // التساوي مقبول: فندقان حقيقيان قد يتقاربان في السعر رغم اختلاف الخانة،
    // وفندق قد يبيع بسعر واحد طوال السنة. المرفوض هو التراجع فقط.
    assert.ok(three.rate_normal <= four.rate_normal, `${dest.slug}: الاقتصادي أغلى من المميز`);
    assert.ok(four.rate_normal <= five.rate_normal, `${dest.slug}: المميز أغلى من VIP`);
    assert.ok(four.rate_high >= four.rate_normal, `${dest.slug}: الموسم المرتفع أرخص من العادي`);

    for (const kind of ['sedan', 'van', 'vip']) {
      assert.ok(await db!.carByKind(dest.slug, kind), `${dest.slug}: تنقصه سيارة ${kind}`);
    }

    const tours = await db!.listTours(dest.slug);
    assert.ok(tours.length >= 4, `${dest.slug}: جولاته أقل من أربع`);
    assert.ok(tours.every((t) => t.description), `${dest.slug}: جولة بلا وصف تُفرغ البرنامج اليومي`);

    assert.ok(dest.hero_image, `${dest.slug}: بلا صورة غلاف`);
    assert.ok(db!.galleryOf(dest).length >= 3, `${dest.slug}: معرضه أقل من ثلاث صور`);
    assert.ok(JSON.parse(dest.route).length > 0, `${dest.slug}: بلا مسار مدن`);
  }
});

test('كل المبالغ في القاعدة أعداد صحيحة', { skip }, async () => {
  const rows = await db!.sql<{ n: string }[]>`
    select count(*) as n from hotels
    where rate_normal <> trunc(rate_normal) or rate_high <> trunc(rate_high)`;
  assert.equal(Number(rows[0]!.n), 0, 'مبلغ كسري تسرّب إلى جدول الفنادق');
});

test('حفظ عرض وقراءته ثم حذفه', { skip }, async () => {
  const input = {
    nights: 6, adults: 2, childrenFree: 0, childrenBed: 0, season: 'normal' as const,
    hotelRate: 9_775, tripleExtra: 3_400, hotelNights: 6, carRate: 9_500, carDays: 5,
    transfers: 2, transferRate: 4_500, tours: [], ticketPerPerson: 1_200,
    guideDays: 0, guideRate: 7_000, simPerPerson: 0, dinnerPerPerson: 0, miscTotal: 0,
    marginPct: 22, feesBp: 250, depositPct: 30, roundTo: 1_000,
  };
  const row = await db!.saveQuote({
    serial: TEST_SERIAL, createdBy: TEST_UID, destination: 'north', season: 'normal',
    travelMonth: null, customerName: 'زبون فحص', customerPhone: null,
    input, tiers: [{ tier: 'premium' }], chosenTier: 'premium', cost: 100_000, sell: 130_000,
  });
  assert.equal(row.serial, TEST_SERIAL);
  assert.equal(row.sell, 130_000);
  assert.equal(row.status, 'draft');

  const back = await db!.getQuote(row.id);
  assert.equal(back?.customer_name, 'زبون فحص');
  // المدخلات تعود كما دخلت تماماً — يمكن إعادة الحساب بلا تخمين
  assert.deepEqual(JSON.parse(back!.input), JSON.parse(JSON.stringify(input)));

  const recent = await db!.listRecentQuotes(TEST_UID);
  assert.ok(recent.some((q) => q.serial === TEST_SERIAL));
});

test('الأرقام التسلسلية لا تتكرر', { skip }, async () => {
  const a = await db!.nextSerial();
  const b = await db!.nextSerial();
  assert.notEqual(a, b);
  assert.match(a, /^AT-\d{4}-\d{4}$/);
});

test('حالة المحادثة تنجو من قراءة جديدة', { skip }, async () => {
  const st = await import('./state.ts');
  const s = await st.resetDraft(TEST_UID);
  s.draft.destination = 'north';
  s.draft.nights = 6;
  s.draft.tourIds = [3, 7];
  await st.save(s);
  await st.expectStep(s, 'r.hotel', '42');

  // قراءة جديدة تماماً — كما يحدث في كل رسالة على بيئة بلا خادم
  const again = await st.getSession(TEST_UID);
  assert.equal(again.draft.destination, 'north');
  assert.deepEqual(again.draft.tourIds, [3, 7]);
  assert.equal(again.step, 'r.hotel');
  assert.equal(again.arg, '42');

  await st.clearStep(again);
  const third = await st.getSession(TEST_UID);
  assert.equal(third.step, null);
  assert.equal(third.draft.nights, 6, 'مسح الخطوة أتلف المسودة');

  await st.dropSession(TEST_UID);
  assert.equal((await st.getSession(TEST_UID)).draft.destination, undefined);
});

test('اسم عمود غير مسموح يُرفض ولا يصل إلى الاستعلام', { skip }, () => {
  // الرفض يقع قبل بناء الاستعلام أصلاً، فهو رمي متزامن لا وعد مرفوض
  assert.throws(
    () => db!.setDestinationRate('north', 'name = 1; drop table quotes; --' as never, 1),
    /عمود غير مسموح/,
  );
});
