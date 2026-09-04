-- مستخدمو البوت. في وضع الفتح (OPEN_ACCESS) يُسجَّل تلقائياً كل من يراسل البوت.
create table if not exists users (
  telegram_id integer primary key,
  name        text,
  username    text,
  -- admin | blocked
  role        text    not null default 'admin',
  created_at  text    not null default (datetime('now'))
);

-- إعدادات عامة تُبدَّل من داخل البوت بلا إعادة تشغيل
create table if not exists settings (
  key   text primary key,
  value text not null
);
insert or ignore into settings (key, value) values ('open_access', '1');
