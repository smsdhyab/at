/**
 * يبني ملفات الحاسبة من مصدر واحد (calc/) إلى مكانين:
 *   docs/               → صفحة GitHub Pages المستقلة
 *   alarab-calculator/  → إضافة ووردبرس (assets/ + form.html)
 *
 * محرك المال pricing.ts نقي بلا استيرادات، وtsconfig يفرض erasableSyntaxOnly،
 * فحذف الأنواع وحده يعطي JavaScript صالحاً للمتصفح — نفس المحرك المختبَر
 * حرفياً، لا نسخة ثانية تُكتب باليد وتنحرف مع الوقت.
 *
 * التشغيل: npm run calc:build — قبل كل رفع إن تغيّر pricing.ts أو calc/.
 */
import { stripTypeScriptTypes } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const bot = join(here, '..');
const repo = join(bot, '..');
const src = join(repo, 'calc');
const docs = join(repo, 'docs');
const plugin = join(repo, 'alarab-calculator');
const pluginAssets = join(plugin, 'assets');

// ── المحرك ──
const header =
  '// مولَّد آلياً من bot/src/pricing.ts بواسطة npm run calc:build — لا تعدّله هنا.\n' +
  '// أي تغيير في منطق المال يكون في pricing.ts ثم يُعاد البناء.\n';
const pricingJs = header + stripTypeScriptTypes(readFileSync(join(here, 'pricing.ts'), 'utf8'), { mode: 'strip' });

// ── الخطوط: الأوزان التي تستعملها الصفحة فقط ──
const FONTS = [
  'thmanyah-display-Bold.woff2',
  'thmanyah-sans-Regular.woff2',
  'thmanyah-sans-Medium.woff2',
  'thmanyah-sans-Bold.woff2',
];

for (const out of [docs, pluginAssets]) {
  mkdirSync(join(out, 'fonts'), { recursive: true });
  writeFileSync(join(out, 'pricing.js'), pricingJs);
  copyFileSync(join(src, 'calc.css'), join(out, 'calc.css'));
  copyFileSync(join(src, 'calc.js'), join(out, 'calc.js'));
  for (const f of FONTS) copyFileSync(join(bot, 'assets', f), join(out, 'fonts', f));
}

// ── الإضافة: جزء النموذج يُقرأ في PHP عند العرض ──
copyFileSync(join(src, 'form.html'), join(plugin, 'form.html'));

// ── GitHub Pages: صفحة مستقلة تحقن النموذج وتحمّل نفس الملفات ──
const form = readFileSync(join(src, 'form.html'), 'utf8');
writeFileSync(join(docs, 'index.html'), `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>حاسبة الأسعار — المسافرون العرب</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="calc.css">
<style>body { margin: 0; background: #F0F8F6; } @media (max-width: 860px) { body { background: #D3E9F0; } }</style>
</head>
<body>
<!-- مولَّد من calc/form.html بواسطة npm run calc:build — لا تعدّله هنا -->
<div class="alarab-calc" data-mode="staff">
${form}
</div>
<script>/* للمعاينة فقط: ?mode=public يعرض ما يراه الزائر */
if (new URLSearchParams(location.search).get('mode') === 'public') document.querySelector('.alarab-calc').dataset.mode = 'public';</script>
<script type="module" src="calc.js"></script>
</body>
</html>
`);

console.log('docs/ و alarab-calculator/assets/  ←  calc/ + pricing.ts + الخطوط');
