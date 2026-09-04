-- مخطط بوت المسافرون العرب — PostgreSQL.
--
-- كل المبالغ أعداد صحيحة بالسنت (integer). لا يوجد عمود numeric أو real في
-- المخطط كله: 0.1 + 0.2 !== 0.3 غير مقبول في نظام يحسب أرباحاً.
--
-- حقول JSON نصية لا jsonb عن قصد: الكود يفكّها بنفسه بدوال آمنة تتحمّل الصف
-- التالف، ولو صارت jsonb لأعادها المحرّك كائناً وكسرت ذلك.

create table if not exists destinations (
  slug          text    primary key,
  name          text    not null,
  -- خدمات ثابتة لكل وجهة، بالسنت
  transfer_rate integer not null default 0,
  ticket_pp     integer not null default 0,
  guide_rate    integer not null default 0,
  active        boolean not null default true,
  sort_order    integer not null default 0,
  hero_image    text    not null default '',
  -- مصفوفة JSON من روابط الصور
  gallery       text    not null default '[]',
  -- سطر مصدر الصور الخارجية — يوجبه ترخيص كومنز
  image_credits text    not null default '',
  -- [{"city":"طرابزون","weight":3}] — الليالي تُوزَّع بالأوزان
  route         text    not null default '[]',
  -- {"best_time":"...","weather":"...",...}
  practical     text    not null default '{}'
);

create table if not exists hotels (
  id          serial  primary key,
  destination text    not null references destinations(slug) on delete cascade,
  name        text    not null,
  -- 3 | 4 | 5 | cabin — تحدد أي فئة بكج يصلح لها الفندق
  class       text    not null default '4',
  rate_normal integer not null default 0,
  rate_high   integer not null default 0,
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists hotels_destination_idx on hotels (destination) where active;

create table if not exists cars (
  id          serial  primary key,
  destination text    not null references destinations(slug) on delete cascade,
  -- sedan | van | vip
  kind        text    not null,
  name        text    not null,
  rate_day    integer not null default 0,
  active      boolean not null default true
);
create index if not exists cars_destination_idx on cars (destination) where active;

create table if not exists tours (
  id          serial  primary key,
  destination text    not null references destinations(slug) on delete cascade,
  name        text    not null,
  -- السعر للمجموعة كاملة لا للشخص
  price       integer not null default 0,
  -- وصف يدخل نص اليوم في البرنامج اليومي
  description text    not null default '',
  active      boolean not null default true,
  sort_order  integer not null default 0
);
create index if not exists tours_destination_idx on tours (destination) where active;

create table if not exists customers (
  id         serial primary key,
  name       text,
  phone      text,
  country    text,
  notes      text,
  created_at timestamptz not null default now()
);

create table if not exists quotes (
  id           serial  primary key,
  serial       text    not null unique,
  customer_id  integer references customers(id) on delete set null,
  -- معرّف تليغرام لمن أنشأ العرض
  created_by   bigint  not null,
  destination  text    not null references destinations(slug),
  nights       integer not null,
  adults       integer not null,
  children     integer not null default 0,
  infants      integer not null default 0,
  travel_month text,
  -- QuoteInput كاملاً كما دخل المحرك، لإعادة الحساب لاحقاً بلا تخمين
  input        text    not null,
  -- الفئات الثلاث الناتجة
  tiers        text    not null,
  chosen_tier  text    not null default 'premium',
  -- نسخ سريعة للتقارير، بالسنت
  cost         integer not null,
  sell         integer not null,
  -- draft | sent | won | lost
  status       text    not null default 'draft',
  -- رقم منشور tvl_package بعد النشر على الموقع
  wp_post_id   integer,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists quotes_status_idx  on quotes (status, created_at desc);
create index if not exists quotes_creator_idx on quotes (created_by, created_at desc);

-- عدّاد أرقام العروض: AT-2026-0001
create table if not exists counters (
  name  text    primary key,
  value integer not null default 0
);
insert into counters (name, value) values ('quote_serial', 0) on conflict (name) do nothing;

create table if not exists users (
  telegram_id bigint primary key,
  name        text,
  username    text,
  -- admin | blocked
  role        text   not null default 'admin',
  created_at  timestamptz not null default now()
);

create table if not exists settings (
  key   text primary key,
  value text not null
);
insert into settings (key, value) values ('open_access', '1') on conflict (key) do nothing;

-- حالة المحادثة: البيئة بلا خادم تنشئ نسخة لكل رسالة، فلا شيء يبقى في الذاكرة
create table if not exists sessions (
  telegram_id bigint primary key,
  -- اسم الخطوة المنتظرة مثل q.nights — نص لأن الدالة المغلقة لا تُخزَّن
  step        text,
  arg         text,
  draft       text   not null default '{}',
  updated_at  timestamptz not null default now()
);
