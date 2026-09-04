/** فحص البرنامج اليومي وتوزيع الليالي. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitNights, buildDays, parseRoute, parsePractical, type RouteStop } from './itinerary.ts';

const ROUTE: RouteStop[] = [
  { city: 'طرابزون', weight: 3 },
  { city: 'أوزنجول', weight: 2 },
  { city: 'ريزا وايدر', weight: 1 },
];

test('مجموع الليالي الموزَّعة يساوي المطلوب بالضبط', () => {
  for (let n = 1; n <= 30; n++) {
    const plan = splitNights(ROUTE, n);
    const sum = plan.reduce((s, r) => s + r.nights, 0);
    assert.equal(sum, n, `${n} ليلة وُزّعت إلى ${sum}`);
    assert.ok(plan.every((r) => r.nights > 0), 'مدينة بصفر ليالٍ ما زالت معروضة');
  }
});

test('التوزيع يتبع الأوزان', () => {
  const plan = splitNights(ROUTE, 6);
  assert.deepEqual(
    plan.map((r) => [r.city, r.nights]),
    [['طرابزون', 3], ['أوزنجول', 2], ['ريزا وايدر', 1]],
  );
});

test('مسار فارغ أو ليالٍ صفر لا يكسر شيئاً', () => {
  assert.deepEqual(splitNights([], 5), []);
  assert.deepEqual(splitNights(ROUTE, 0), []);
});

test('البرنامج يبدأ بالوصول وينتهي بالمغادرة وعدد أيامه صحيح', () => {
  const days = buildDays(6, [{ name: 'جولة أ' }, { name: 'جولة ب' }], ROUTE);
  assert.equal(days.length, 7, 'ست ليالٍ = سبعة أيام');
  assert.equal(days[0]!.n, 1);
  assert.equal(days[0]!.title, 'الوصول والاستقبال');
  assert.equal(days.at(-1)!.title, 'المغادرة');
  assert.equal(days.at(-1)!.sleep, '', 'يوم المغادرة لا مبيت فيه');
  assert.deepEqual(days.map((d) => d.n), [1, 2, 3, 4, 5, 6, 7], 'ترقيم الأيام متسلسل');
});

test('الأيام الزائدة عن الجولات تصير أياماً حرة لا حشواً', () => {
  const days = buildDays(6, [{ name: 'جولة واحدة' }], ROUTE);
  const free = days.filter((d) => d.title === 'يوم حر');
  assert.equal(free.length, 4, 'خمسة أيام وسطى وجولة واحدة ⇒ أربعة أيام حرة');
});

test('الجولات الزائدة عن الأيام تُدمج ولا تضيع', () => {
  const tours = Array.from({ length: 6 }, (_, i) => ({ name: `جولة ${i + 1}` }));
  const days = buildDays(3, tours, ROUTE); // يومان وسطيان فقط
  const shown = days.map((d) => d.title).join(' ');
  for (const t of tours) {
    assert.ok(shown.includes(t.name), `${t.name} ضاعت من البرنامج`);
  }
});

test('كل ليلة لها مدينة مبيت', () => {
  const days = buildDays(6, [{ name: 'ج' }], ROUTE);
  for (const d of days.slice(0, -1)) {
    assert.ok(d.sleep, `اليوم ${d.n} بلا مدينة مبيت`);
  }
});

test('وصف الجولة يدخل نص اليوم', () => {
  const days = buildDays(2, [{ name: 'جولة أوزنجول', description: 'وصف تفصيلي للجولة.' }], ROUTE);
  assert.ok(days.some((d) => d.body.includes('وصف تفصيلي للجولة.')));
});

test('رحلة ليلة واحدة تعمل', () => {
  const days = buildDays(1, [{ name: 'ج' }], ROUTE);
  assert.equal(days.length, 2);
  assert.equal(days[0]!.title, 'الوصول والاستقبال');
  assert.equal(days[1]!.title, 'المغادرة');
});

test('بيانات تالفة تُفكّ بأمان', () => {
  assert.deepEqual(parseRoute('ليس JSON'), []);
  assert.deepEqual(parseRoute('{"a":1}'), []);
  assert.deepEqual(parseRoute('[{"city":"","weight":3},{"city":"طرابزون","weight":0}]'), []);
  assert.deepEqual(parsePractical('تالف'), {});
  assert.equal(parsePractical('{"weather":"معتدل"}').weather, 'معتدل');
});
