-- الأطفال صاروا فئتين لا رقماً واحداً: دون السادسة مجاناً، ومن ستٍّ فأكثر
-- يحتاج سريراً إضافياً. الأعمدة تُعاد تسميتها لتقول ما تحمله فعلاً.
alter table quotes rename column children to children_bed;
alter table quotes rename column infants  to children_free;
