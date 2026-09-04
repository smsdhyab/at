/** يطبّق ملفات migrations بالترتيب مرة واحدة فقط. التشغيل: npm run migrate */
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, close } from './db.ts';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

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
  if (done.has(file)) {
    console.log(`تخطّي  ${file}`);
    continue;
  }
  const body = await readFile(join(dir, file), 'utf8');
  db.exec('begin');
  try {
    db.exec(body);
    db.prepare('insert into _migrations (name) values (?)').run(file);
    db.exec('commit');
  } catch (e) {
    db.exec('rollback');
    console.error(`فشل ${file}:`, e);
    close();
    process.exit(1);
  }
  console.log(`طُبّق   ${file}`);
  applied++;
}

console.log(`\nجاهز — ${files.length} ملف، ${applied} جديد.`);
close();
