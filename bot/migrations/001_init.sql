-- مخطط قاعدة بيانات بوت المسافرون العرب — SQLite.
-- كل المبالغ أعداد صحيحة بالسنت (integer). لا يوجد عمود real في المخطط كله.
-- المنطقية تُخزَّن 0/1 لأن SQLite بلا نوع boolean.

create table if not exists destinations (
  slug          text    primary key,
  name          text    not null,
  -- خدمات ثابتة لكل وجهة، بالسنت
  transfer_rate integer not null default 0,
  ticket_pp     integer not null default 0,
  guide_rate    integer not null default 0,
  active        integer not null default 1,
  sort_order    integer not null default 0
);

create table if not exists hotels (
  id          integer primary key autoincrement,
  destination text    not null references destinations(slug) on delete cascade,
  name        text    not null,
  -- 3 | 4 | 5 | cabin — تحدد أي فئة بكج يصلح لها الفندق
  class       text    not null default '4',
  rate_normal integer not null default 0,
  rate_high   integer not null default 0,
  notes       text,
  active      integer not null default 1,
  created_at  text    not null default (datetime('now'))
);
create index if not exists hotels_destination_idx on hotels (destination) where active = 1;

create table if not exists cars (
  id          integer primary key autoincrement,
  destination text    not null references destinations(slug) on delete cascade,
  -- sedan | van | vip
  kind        text    not null,
  name        text    not null,
  rate_day    integer not null default 0,
  active      integer not null default 1
);
create index if not exists cars_destination_idx on cars (destination) where active = 1;

create table if not exists tours (
  id          integer primary key autoincrement,
  destination text    not null references destinations(slug) on delete cascade,
  name        text    not null,
  -- السعر للمجموعة كاملة لا للشخص
  price       integer not null default 0,
  active      integer not null default 1,
  sort_order  integer not null default 0
);
create index if not exists tours_destination_idx on tours (destination) where active = 1;

create table if not exists customers (
  id         integer primary key autoincrement,
  name       text,
  phone      text,
  country    text,
  notes      text,
  created_at text not null default (datetime('now'))
);

create table if not exists quotes (
  id           integer primary key autoincrement,
  serial       text    not null unique,
  customer_id  integer references customers(id) on delete set null,
  -- معرّف تليغرام لمن أنشأ العرض
  created_by   integer not null,
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
  -- الفئة المعروضة على الزبون
  chosen_tier  text    not null default 'premium',
  -- نسخ سريعة للتقارير، بالسنت
  cost         integer not null,
  sell         integer not null,
  -- draft | sent | won | lost
  status       text    not null default 'draft',
  -- رقم منشور tvl_package بعد النشر على الموقع
  wp_post_id   integer,
  created_at   text    not null default (datetime('now')),
  updated_at   text    not null default (datetime('now'))
);
create index if not exists quotes_status_idx  on quotes (status, created_at desc);
create index if not exists quotes_creator_idx on quotes (created_by, created_at desc);

-- عدّادات: SQLite بلا sequence. يُستعمل لتوليد أرقام العروض AT-2026-0001.
create table if not exists counters (
  name  text    primary key,
  value integer not null default 0
);
insert or ignore into counters (name, value) values ('quote_serial', 0);
