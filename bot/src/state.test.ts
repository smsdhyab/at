/**
 * فحص حالة المحادثة المحفوظة.
 * الفحص الأهم: أن المسودة تنجو من «إعادة تشغيل» — أي من قراءة جديدة تماماً
 * من القاعدة، وهو بالضبط ما يحدث في كل رسالة في البيئة بلا خادم.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.DB_FILE = ':memory:';
const db = await import('./db.ts');
const st = await import('./state.ts');

const migrations = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

before(() => {
  for (const f of readdirSync(migrations).filter((f) => f.endsWith('.sql')).sort()) {
    db.db.exec(readFileSync(join(migrations, f), 'utf8'));
  }
});
after(() => db.close());

const UID = 555_001;

test('جلسة جديدة فارغة ولا تنفجر', () => {
  const s = st.getSession(UID);
  assert.equal(s.step, null);
  assert.equal(s.arg, null);
  assert.deepEqual(s.draft.tourIds, []);
  assert.equal(st.hasDraft(s), false);
});

test('المسودة تنجو من إعادة القراءة الكاملة من القاعدة', () => {
  const s = st.resetDraft(UID);
  s.draft.destination = 'north';
  s.draft.destinationName = 'الشمال التركي';
  s.draft.nights = 6;
  s.draft.adults = 2;
  s.draft.tourIds = [3, 7];
  st.save(s);

  // قراءة جديدة تماماً — كما يحدث في كل رسالة على بيئة بلا خادم
  const again = st.getSession(UID);
  assert.equal(again.draft.destination, 'north');
  assert.equal(again.draft.nights, 6);
  assert.deepEqual(again.draft.tourIds, [3, 7]);
  assert.equal(st.hasDraft(again), true);
});

test('الخطوة المنتظرة ومعطاها يُحفظان ويُمسحان', () => {
  const s = st.getSession(UID);
  st.expectStep(s, 'r.hotel', '42');

  const again = st.getSession(UID);
  assert.equal(again.step, 'r.hotel');
  assert.equal(again.arg, '42');
  // مسح الخطوة لا يمسّ المسودة
  assert.equal(again.draft.destination, 'north');

  st.clearStep(again);
  const third = st.getSession(UID);
  assert.equal(third.step, null);
  assert.equal(third.arg, null);
  assert.equal(third.draft.nights, 6, 'مسح الخطوة أتلف المسودة');
});

test('مسودة جديدة تمحو القديمة والخطوة معاً', () => {
  const s = st.getSession(UID);
  st.expectStep(s, 'q.nights');
  st.resetDraft(UID);

  const again = st.getSession(UID);
  assert.equal(again.step, null);
  assert.equal(again.draft.destination, undefined);
  assert.deepEqual(again.draft.tourIds, []);
});

test('حذف الجلسة يحذفها فعلاً', () => {
  const s = st.resetDraft(UID);
  s.draft.destination = 'istanbul';
  st.save(s);
  st.dropSession(UID);
  assert.equal(st.getSession(UID).draft.destination, undefined);
});

test('صف تالف لا يوقف البوت', () => {
  db.db.prepare('insert into sessions (telegram_id, draft) values (?, ?)').run(999, 'ليس JSON');
  const s = st.getSession(999);
  assert.deepEqual(s.draft.tourIds, [], 'draft تالف يجب أن يعود فارغاً لا أن يرمي');

  db.db.prepare('update sessions set draft = ? where telegram_id = ?').run('{"tourIds":"نص"}', 999);
  assert.deepEqual(st.getSession(999).draft.tourIds, [], 'tourIds غير مصفوفة يجب أن تُصحَّح');
});

test('جلستان لمستخدمين مختلفين لا تتداخلان', () => {
  const a = st.resetDraft(1001);
  a.draft.destination = 'north';
  st.expectStep(a, 'q.nights');

  const b = st.resetDraft(1002);
  b.draft.destination = 'antalya';
  st.expectStep(b, 'r.car', '9');

  assert.equal(st.getSession(1001).draft.destination, 'north');
  assert.equal(st.getSession(1001).step, 'q.nights');
  assert.equal(st.getSession(1002).draft.destination, 'antalya');
  assert.equal(st.getSession(1002).arg, '9');
});
