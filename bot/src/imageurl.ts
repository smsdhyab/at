/**
 * تصغير الصور عند الطلب.
 *
 * صورة الخلفية مغطّاة بتدرّج كثيف ولا تحتاج دقة الغلاف، وصورة رأس بطاقة الفئة
 * ارتفاعها 36 مم فقط. تحميل الجميع بدقة كاملة كان يضخّم المستند بلا فائدة تُرى.
 *
 * لكل مصدر آلية مختلفة، ولا يُلمس ما لا نعرف كيف نصغّره:
 * - ويكيميديا تولّد عروضاً محدودة فقط؛ 960 و1280 هما ما ثبت عملهما بالتجربة،
 *   وطلب عرض غير مولّد يعيد 400 ويترك المستند بصورة مفقودة.
 * - صور الموقع تمرّ عبر Photon (خدمة Jetpack المفعّلة على الموقع) التي تقبل
 *   أي عرض.
 */

/** العروض التي تولّدها ويكيميديا فعلاً — تحققت منها بطلبات حقيقية. */
const WIKIMEDIA_WIDTHS = [960, 1280] as const;

const SITE_ORIGIN = 'https://alarabtravelers.com/';
const PHOTON_ORIGIN = 'https://i0.wp.com/alarabtravelers.com/';

/** يعيد رابط الصورة بأقرب عرض مدعوم لا يقلّ عن المطلوب. */
export function sized(url: string | undefined, width: number): string {
  if (!url) return '';

  if (url.includes('upload.wikimedia.org') && /\/\d+px-/.test(url)) {
    const pick = WIKIMEDIA_WIDTHS.find((w) => w >= width) ?? WIKIMEDIA_WIDTHS.at(-1)!;
    return url.replace(/\/\d+px-/, `/${pick}px-`);
  }

  if (url.startsWith(SITE_ORIGIN)) {
    const sep = url.includes('?') ? '&' : '?';
    return url.replace(SITE_ORIGIN, PHOTON_ORIGIN) + `${sep}w=${width}`;
  }

  // مصدر غير معروف: يُترك كما هو — صورة كبيرة أهون من صورة مكسورة
  return url;
}

/**
 * عرض واحد لكل الصور — والسبب مهم:
 *
 * لو طُلبت الصورة نفسها بعرضين مختلفين لصار لها رابطان، فخزّنها المتصفح
 * مرتين داخل ملف PDF. قياس فعلي: أعراض مختلفة أنتجت 7.4 ميغابايت بينما
 * عرض موحّد أنتج 4.0 — التوحيد يوفّر أكثر مما يوفّره التصغير نفسه.
 *
 * أرقام مقيسة على مستند من ثماني صفحات:
 *   560 ⇒ 2.4 م.ب · 700 ⇒ 3.3 · 800 ⇒ 4.0 · 960 ⇒ 5.4 · 1280 ⇒ 8.0
 */
const WIDTH = 800;

export const IMG = {
  cover: WIDTH,
  background: WIDTH,
  tier: WIDTH,
  cta: WIDTH,
  card: WIDTH,
} as const;
