-- فصل خانة الفئة عن تصنيف النجوم.
--
-- عمود class يؤدي وظيفتين: يحدّد أي فئة بكج يخدمها الفندق (اقتصادي/مميز/VIP)
-- وتُطبع قيمته نجوماً في عرض الزبون. الوظيفتان تفترقان عندما يخدم فندق أربع
-- نجوم الفئة الاقتصادية: تبقى الخانة '3' بينما النجوم الحقيقية '4'. طباعة '3'
-- في هذه الحالة كذب على الزبون، فصار للنجوم عمود مستقل.
--
-- class  = خانة الفئة التي يملأها الفندق في التوليد
-- stars  = تصنيفه الحقيقي، وهو وحده ما يظهر في المستند

alter table hotels add column if not exists stars text not null default '';
update hotels set stars = class where stars = '';

-- ═══ فنادق إسطنبول الحقيقية ═══

-- Uranus Istanbul Topkapı — مسعّر باليورو: ثنائية €85 وثلاثية €115.
-- حُوّل بسعر 1.163 (سعر يوم 2026-09-07) وقُرّب لأقرب عشرة:
--   85 × 1.163 = 98.9  → 100$ للغرفة
--  115 × 1.163 = 133.8 → 130$ للثلاثية، أي 30$ فرق السرير الثالث
insert into hotels (destination, name, class, stars, rate_normal, rate_high, rate_triple, notes)
values ('istanbul', 'Uranus Istanbul Topkapı — زيتين بورنو', '5', '5', 10000, 10000, 3000,
        'الأصل باليورو: فردية €80 · ثنائية €85 · ثلاثية €115 — حُوّل بسعر 1.163 يوم 2026-09-07')
on conflict do nothing;

-- Green Anka فندق أربع نجوم لكنه الأرخص، فيملأ الخانة الاقتصادية
-- وتبقى نجومه الحقيقية أربعاً في المستند.
update hotels set class = '3', stars = '4'
where destination = 'istanbul' and name like 'Green Anka%';

update hotels set stars = '4' where destination = 'istanbul' and name like 'Four Sides%';

-- الفندقان التجريبيان يخرجان من التوليد بعد وصول البدائل الحقيقية
update hotels set active = false
where destination = 'istanbul'
  and name in ('فندق 3 نجوم — الفاتح', 'فندق 5 نجوم — شيشلي');
