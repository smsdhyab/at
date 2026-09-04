-- حالة المحادثة محفوظة لا في الذاكرة: البيئة بلا خادم تنشئ نسخة جديدة لكل
-- رسالة، والحاوية تفقد الذاكرة عند كل إعادة تشغيل.
create table if not exists sessions (
  telegram_id integer primary key,
  -- اسم الخطوة المنتظرة مثل q.nights — نص لأن الدالة المغلقة لا تُخزَّن
  step        text,
  arg         text,
  draft       text    not null default '{}',
  updated_at  text    not null default (datetime('now'))
);
