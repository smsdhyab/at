/**
 * خطوط ثمانية مضمَّنة في المستند.
 *
 * تُضمَّن كـ data URI لا كملف: المتصفح البعيد (Browserless على Supabase) لا يرى
 * قرصنا، فمسار الملف لا ينفعه. والضمّ يجعل المستند مستقلاً عن الشبكة تماماً —
 * لا انتظار Google Fonts ولا خطر أن يصل الزبون مستنداً بخط بديل.
 *
 * صيغة woff2 لا otf: مضغوطة وأصغر بكثير، وChromium يقرأها.
 *
 * ملاحظة على الأرقام: هذه العائلة تُظهر الأرقام غربية (0-9) كما يجب في مستند
 * أسعار، فلا حاجة لحصر نطاق المحارف كما لزم مع خط سابق كان يقلبها هندية.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** [العائلة، الملف، الوزن] — الأوزان المستعملة فعلاً في القوالب فقط. */
const FACES: ReadonlyArray<readonly [string, string, number]> = [
  ['Thmanyah Display', 'thmanyah-display-Bold.woff2', 700],
  ['Thmanyah Display', 'thmanyah-display-Black.woff2', 900],
  ['Thmanyah Sans', 'thmanyah-sans-Light.woff2', 300],
  ['Thmanyah Sans', 'thmanyah-sans-Regular.woff2', 400],
  ['Thmanyah Sans', 'thmanyah-sans-Medium.woff2', 500],
  ['Thmanyah Sans', 'thmanyah-sans-Bold.woff2', 700],
];

let cached: string | null = null;

/** يعيد قواعد @font-face جاهزة للحقن في <style>. تُقرأ مرة وتُخزَّن. */
export function fontFaceCss(): string {
  if (cached !== null) return cached;

  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
  const rules: string[] = [];

  for (const [family, file, weight] of FACES) {
    try {
      const b64 = readFileSync(join(dir, file)).toString('base64');
      rules.push(
        `@font-face{font-family:"${family}";` +
          `src:url(data:font/woff2;base64,${b64}) format("woff2");` +
          `font-weight:${weight};font-style:normal;font-display:block}`,
      );
    } catch {
      // ملف ناقص لا يوقف التوليد — يسقط إلى الخط الاحتياطي
      console.warn(`ملف الخط ${file} غير موجود — سيُستعمل الخط الاحتياطي لهذا الوزن.`);
    }
  }

  cached = rules.join('\n');
  return cached;
}
