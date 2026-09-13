-- قراءة الأسعار من المتصفح للحاسبة العامة على GitHub Pages.
--
-- RLS مفعّل على كل الجداول بلا سياسات، فالمفتاح العام (anon) لا يقرأ شيئاً.
-- هذه السياسات تفتح القراءة فقط — لا كتابة — على جداول الأسعار الخمسة،
-- وللصفوف الفعّالة فقط. العروض والزبائن والجلسات والمستخدمون تبقى مغلقة تماماً.
--
-- البوت يتصل بدور postgres مباشرة ويتجاوز RLS، فلا يتأثر.

create policy "calc_read" on destinations for select to anon using (active);
create policy "calc_read" on hotels       for select to anon using (active);
create policy "calc_read" on cars         for select to anon using (active);
create policy "calc_read" on tours        for select to anon using (active);
create policy "calc_read" on services     for select to anon using (active);
