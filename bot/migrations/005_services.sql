-- خدمات إضافية متغيّرة العدد لكل وجهة.
--
-- الأعمدة الثابتة في destinations (transfer_rate/ticket_pp/guide_rate) تكفي
-- لوجهة فيها مطار واحد وسعر نقلة واحد. إسطنبول فيها مطاران، ولكل مطار سعران
-- (مع حجز رحلات / ترانسفير فقط)، ومندوب استقبال ومبيت سائق. هذه لا تُمثَّل
-- بعمود واحد، فصارت صفوفاً.
--
-- كل المبالغ بالسنت — لا عمود عشري في المخطط كله.

create table if not exists services (
  id          serial  primary key,
  destination text    not null references destinations(slug) on delete cascade,
  name        text    not null,
  price       integer not null default 0,
  -- per_trip: لكل نقلة · per_night: لكل ليلة · per_person: للشخص · once: مرة واحدة
  unit        text    not null default 'per_trip',
  active      boolean not null default true,
  sort_order  integer not null default 0
);
create index if not exists services_destination_idx on services (destination) where active;

-- ═══ إسطنبول — ورقة المواصلات السارية من 2026-09-07 ═══

insert into services (destination, name, price, unit, sort_order) values
  ('istanbul', 'نقلة مطار إسطنبول — مع حجز رحلات',  3500, 'per_trip',  1),
  ('istanbul', 'نقلة مطار صبيحة — مع حجز رحلات',    4500, 'per_trip',  2),
  ('istanbul', 'ترانسفير مطار إسطنبول — دون رحلات', 4000, 'per_trip',  3),
  ('istanbul', 'ترانسفير مطار صبيحة — دون رحلات',   5000, 'per_trip',  4),
  ('istanbul', 'مندوب استقبال',                      500, 'per_trip',  5),
  ('istanbul', 'رسوم صعود الجبل',                   6000, 'once',      6),
  ('istanbul', 'مبيت السائق خارج إسطنبول',          4000, 'per_night', 7)
on conflict do nothing;

-- نقلة المطار الافتراضية: مطار إسطنبول مع حجز رحلات
update destinations set transfer_rate = 3500 where slug = 'istanbul';

-- ═══ أسعار الجولات البرية في إسطنبول ═══
-- الجولات البحرية (البوسفور، جزر الأميرات) خارج ورقة المواصلات فتبقى كما هي.

update tours set price = 10000 where destination = 'istanbul' and name like 'جولة المدينة القديمة%';
update tours set price = 11000 where destination = 'istanbul' and name like 'الجانب الآسيوي%';
update tours set price = 14000 where destination = 'istanbul' and name like 'جولة صبنجة%';
update tours set price = 23000 where destination = 'istanbul' and name like 'جولة بورصة%';

-- ═══ فنادق إسطنبول الحقيقية ═══
-- السعر واحد لكل غرفة مزدوجة في الليلة، بلا تقسيم موسمي: الورقة لم تذكر
-- سعرين، ووضع فارق موسمي مخترَع يضخّم كل عرض بصمت.

insert into services (destination, name, price, unit, sort_order) values
  ('istanbul', 'غرفة متصلة — Four Sides (بدل غرفتين)', 12000, 'per_night', 8)
on conflict do nothing;

insert into hotels (destination, name, class, rate_normal, rate_high, rate_triple, notes) values
  ('istanbul', 'Green Anka Hotel — المدينة القديمة (الفاتح)', '4', 6000, 6000, 1500,
   'فردية $55 · دبل $60 · ثلاثية $75 — أمام ترام Fındıkzade'),
  ('istanbul', 'Four Sides Hotel — شيشلي', '4', 6000, 6000, 2000,
   'فردية $60 · ثنائية $60 · ثلاثية $80 · متصلة $120 — 250م عن المترو')
on conflict do nothing;

-- الفندق التجريبي ذو الأربع نجوم يخرج من التوليد ولا يُحذف: عروض سابقة تشير إليه.
-- فندق الخمس نجوم التجريبي يبقى فعّالاً: Uranus مسعّر باليورو ولم يُدخَل بعد،
-- وبلا فندق خمس نجوم تنهار فئة VIP عند التوليد.
update hotels set active = false
where destination = 'istanbul' and name = 'فندق 4 نجوم — تقسيم';
