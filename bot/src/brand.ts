/**
 * هوية المسافرون العرب — كل ما يظهر للزبون في المستندات والصور.
 *
 * ما لم يُملأ لا يُطبع أصلاً: المستند يحذف السطر بدل أن يترك فراغاً أو نصاً
 * مؤقتاً. لا تُخترع أرقام تراخيص ولا عناوين — إن لم تكن معروفة فهي غائبة.
 */

export const brand = {
  name: process.env.BRAND_NAME ?? 'المسافرون العرب',
  legalName: process.env.BRAND_LEGAL_NAME ?? '',
  tagline: process.env.BRAND_TAGLINE ?? 'بضيافة عربية — أمان المسافر مسؤوليتنا وسمعتنا',
  website: process.env.BRAND_SITE ?? 'alarabtravelers.com',
  whatsapp: process.env.WHATSAPP_NUMBER ?? '966534436932',
  email: process.env.BRAND_EMAIL ?? '',
  address: process.env.BRAND_ADDRESS ?? '',
  /** رقم رخصة الوكالة (TÜRSAB مثلاً). يُترك فارغاً حتى يُعطى. */
  license: process.env.BRAND_LICENSE ?? '',
  instagram: process.env.BRAND_INSTAGRAM ?? 'alarab_travelers',
  logoUrl:
    process.env.BRAND_LOGO ??
    'https://alarabtravelers.com/wp-content/uploads/2020/02/%D8%B4%D8%B9%D8%A7%D8%B1-%D9%85%D9%88%D9%82%D8%B9-%D8%A7%D9%84%D9%85%D8%B3%D8%A7%D9%81%D8%B1%D9%88%D9%86-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8-192.png',
} as const;

/**
 * ألوان الهوية — لوحة مفرحة هادئة: تركوازي البحر، ورملي دافئ، وشمسي،
 * على أرضية كريمية. استُبدلت اللوحة الداكنة السابقة بطلب المالك.
 */
export const palette = {
  sea: '#2E9DA8',
  seaDeep: '#1D7580',
  seaSoft: '#DFF1F3',
  sand: '#D9834A',
  sandSoft: '#FBEDE1',
  sun: '#EFB94F',
  mint: '#CFE9DC',
  cream: '#FDFAF6',
  // تدرّج السماء: يحلّ محل الأبيض في أعلى الصفحة فتقرأ الورقة كمشهد واحد
  sky: '#D3E9F0',
  skyMid: '#E3F1F3',
  skyLow: '#F0F8F6',
  card: '#FFFFFF',
  ink: '#2C464E',
  ink2: '#55707A',
  muted: '#8AA2A9',
  line: '#DDEBEE',
  lineSoft: '#EBF4F5',

  // أسماء قديمة تُبقي بقية الكود يعمل بلا تعديل
  teal: '#2E9DA8',
  tealSoft: '#DFF1F3',
  copper: '#D9834A',
  copperSoft: '#FBEDE1',
  pine: '#1D7580',
  gold: '#EFB94F',
  paper: '#FDFAF6',
} as const;

/**
 * الخطوط. طلب المالك خط «قمرة» وهو تجاري من Indian Type Foundry وليس على
 * Google Fonts، فلا يجوز تحميله من مواقع القرصنة. البديل المختار أقرب ما
 * يكون لما طُلب: مفرح وهادئ ولطيف.
 *
 * إن توفّر ترخيص «قمرة»: ضع الملف في `assets/` وأضف @font-face واستبدل
 * القيمة هنا — لا تعديل في أي مكان آخر.
 */
export const fonts = {
  // لا رابط خارجي: الخطوط مضمَّنة كاملة في المستند (انظر fontface.ts).
  // المستند صار مستقلاً عن الشبكة — يُطبع بالخط نفسه ولو انقطع الاتصال.
  display: '"Thmanyah Display", "Segoe UI", Tahoma, serif',
  body: '"Thmanyah Sans", "Noto Sans Arabic", "Segoe UI", Tahoma, sans-serif',
} as const;

/**
 * رقم الواتساب بصيغة عرض. رمز الدولة يحدد التقسيم:
 * السعودية ‎+966 53 443 6932‎ · تركيا ‎+90 501 319 6750‎ · غيرهما بلا تقسيم.
 */
export function whatsappDisplay(number = brand.whatsapp): string {
  const d = number.replace(/\D/g, '');
  if (d.length < 10) return d;
  // [رمز الدولة، أطوال المجموعات بعده]
  const groups: ReadonlyArray<readonly [string, readonly number[]]> = [
    ['966', [2, 3, 4]],
    ['90', [3, 3, 4]],
  ];
  for (const [cc, lens] of groups) {
    if (!d.startsWith(cc)) continue;
    let i = cc.length;
    const parts = lens.map((n) => d.slice(i, (i += n)));
    return `+${cc} ${parts.join(' ')}${d.slice(i) ? ' ' + d.slice(i) : ''}`;
  }
  return `+${d}`;
}

/** الحقول الناقصة التي تُضعف المستند أمام الزبون. */
export function missingBrandFields(): string[] {
  const missing: string[] = [];
  if (!brand.legalName) missing.push('BRAND_LEGAL_NAME — الاسم القانوني الكامل');
  if (!brand.license) missing.push('BRAND_LICENSE — رقم رخصة الوكالة');
  if (!brand.address) missing.push('BRAND_ADDRESS — العنوان');
  if (!brand.email) missing.push('BRAND_EMAIL — البريد الرسمي');
  return missing;
}
