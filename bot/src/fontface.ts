/**
 * خط «قمرة» مضمَّناً في المستند.
 *
 * يُضمَّن كـ data URI لا كملف: المتصفح البعيد (Browserless على Supabase) لا يرى
 * قرصنا، فمسار الملف لا ينفعه. الضمّ يجعل المستند مستقلاً عن أي شبكة أو مسار.
 *
 * `unicode-range` مقصود ومهم: ملف الخط يربط أرقام ASCII بأرقام هندية (٠١٢٣)،
 * فلو تُرك على حاله لظهر السعر ‎$٣,٤٦٠‎ ورقم الواتساب بأرقام هندية. بحصر الخط
 * في نطاقات العربية وحدها تسقط الأرقام والحروف اللاتينية تلقائياً إلى الخط
 * التالي في السلسلة — فتبقى الأسعار بأرقام غربية والعربية بخط قمرة.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** نطاقات العربية وعلامات الاقتباس والشرطات — بلا أرقام ولا لاتيني. */
const ARABIC_RANGES = [
  'U+0600-06FF', // العربية
  'U+0750-077F', // ملحق العربية
  'U+08A0-08FF', // العربية الموسّعة
  'U+FB50-FDFF', // أشكال العرض أ
  'U+FE70-FEFF', // أشكال العرض ب
  'U+00AB', 'U+00BB', // « »
  'U+2010-2015', // الشرطات
  'U+2018-201F', // علامات الاقتباس
].join(', ');

let cached: string | null = null;

/** يعيد قواعد @font-face جاهزة للحقن في <style>. تُقرأ مرة وتُخزَّن. */
export function fontFaceCss(): string {
  if (cached !== null) return cached;

  const path = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'qomra.ttf');
  let dataUri: string;
  try {
    dataUri = `data:font/ttf;base64,${readFileSync(path).toString('base64')}`;
  } catch {
    // بلا ملف الخط يبقى المستند صالحاً بالخط الاحتياطي بدل أن ينهار
    console.warn('ملف الخط assets/qomra.ttf غير موجود — سيُستعمل الخط الاحتياطي.');
    cached = '';
    return cached;
  }

  // الملف بوزن واحد. تعريفه عند 400 فقط يجعل المتصفح يصطنع العريض عند طلب 600
  // أو 700، وهو أوضح في العناوين من استعمال نفس الوزن لكل الأثقال.
  cached = `@font-face{
  font-family:"Qomra";
  src:url(${dataUri}) format("truetype");
  font-weight:400;
  font-style:normal;
  font-display:block;
  unicode-range:${ARABIC_RANGES};
}`;
  return cached;
}
