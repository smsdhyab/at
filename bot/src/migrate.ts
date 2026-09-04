/**
 * تطبيق ملفات migrations بالترتيب مرة واحدة فقط.
 *
 * يُستدعى تلقائياً عند إقلاع البوت، وليس خطوة نشر منفصلة: على قرص جديد
 * (حاوية تُنشر أول مرة) لا توجد جداول أصلاً، ونسيان الخطوة يعني بوتاً يسقط
 * عند أول ضغطة زر. التطبيق آمن للتكرار لأن جدول `_migrations` يمنع الإعادة.
 *
 * التشغيل يدوياً: npm run migrate
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, close } from './db.ts';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

export async function runMigrations(log = console.log): Promise<number> {
  db.exec(`
    create table if not exists _migrations (
      name       text primary key,
      applied_at text not null default (datetime('now'))
    )`);

  const done = new Set(
    (db.prepare('select name from _migrations').all() as { name: string }[]).map((r) => r.name),
  );
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const body = await readFile(join(dir, file), 'utf8');
    db.exec('begin');
    try {
      db.exec(body);
      db.prepare('insert into _migrations (name) values (?)').run(file);
      db.exec('commit');
    } catch (e) {
      db.exec('rollback');
      throw new Error(`فشل تطبيق ${file}: ${e instanceof Error ? e.message : String(e)}`);
    }
    log(`طُبّق   ${file}`);
    applied++;
  }
  return applied;
}

// التشغيل المباشر من سطر الأوامر فقط
if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const applied = await runMigrations();
  console.log(`\nجاهز — ${applied} ملف جديد.`);
  close();
}
