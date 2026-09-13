/**
 * يبني ملفات الحاسبة العامة في docs/ (GitHub Pages).
 *
 * محرك المال pricing.ts نقي بلا استيرادات، وtsconfig يفرض erasableSyntaxOnly،
 * فحذف الأنواع وحده يعطي JavaScript صالحاً للمتصفح — نفس المحرك المختبَر
 * حرفياً، لا نسخة ثانية تُكتب باليد وتنحرف مع الوقت.
 *
 * التشغيل: npm run calc:build — قبل كل رفع إن تغيّر pricing.ts أو الخطوط.
 */
import { stripTypeScriptTypes } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const bot = join(here, '..');
const docs = join(bot, '..', 'docs');
mkdirSync(join(docs, 'fonts'), { recursive: true });

// ── المحرك ──
const source = readFileSync(join(here, 'pricing.ts'), 'utf8');
const js = stripTypeScriptTypes(source, { mode: 'strip' });
const header =
  '// مولَّد آلياً من bot/src/pricing.ts بواسطة npm run calc:build — لا تعدّله هنا.\n' +
  '// أي تغيير في منطق المال يكون في pricing.ts ثم يُعاد البناء.\n';
writeFileSync(join(docs, 'pricing.js'), header + js);
console.log('docs/pricing.js  ←  src/pricing.ts');

// ── الخطوط: الأوزان التي تستعملها الصفحة فقط ──
const FONTS = [
  'thmanyah-display-Bold.woff2',
  'thmanyah-sans-Regular.woff2',
  'thmanyah-sans-Medium.woff2',
  'thmanyah-sans-Bold.woff2',
];
for (const f of FONTS) {
  copyFileSync(join(bot, 'assets', f), join(docs, 'fonts', f));
}
console.log(`docs/fonts/      ←  ${FONTS.length} ملفات`);
