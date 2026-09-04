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
  whatsapp: process.env.WHATSAPP_NUMBER ?? '905013196750',
  email: process.env.BRAND_EMAIL ?? '',
  address: process.env.BRAND_ADDRESS ?? '',
  /** رقم رخصة الوكالة (TÜRSAB مثلاً). يُترك فارغاً حتى يُعطى. */
  license: process.env.BRAND_LICENSE ?? '',
  instagram: process.env.BRAND_INSTAGRAM ?? 'alarab_travelers',
  logoUrl:
    process.env.BRAND_LOGO ??
    'https://alarabtravelers.com/wp-content/uploads/2020/02/%D8%B4%D8%B9%D8%A7%D8%B1-%D9%85%D9%88%D9%82%D8%B9-%D8%A7%D9%84%D9%85%D8%B3%D8%A7%D9%81%D8%B1%D9%88%D9%86-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8-192.png',
} as const;

/** ألوان الهوية — نفس ألوان خطة الإطلاق وصفحات الموقع الجديدة. */
export const palette = {
  teal: '#0E6E6B',
  pine: '#2C4A3E',
  copper: '#A8632B',
  gold: '#C9973F',
  paper: '#F3F5F3',
  card: '#FFFFFF',
  ink: '#141D1A',
  ink2: '#3D4A46',
  muted: '#69776F',
  line: '#D3DAD6',
  lineSoft: '#E4EAE7',
  tealSoft: '#E7F1F0',
} as const;

/** رقم الواتساب بصيغة عرض: ‎+90 501 319 6750‎ */
export function whatsappDisplay(): string {
  const d = brand.whatsapp.replace(/\D/g, '');
  if (d.length < 10) return d;
  return `+${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
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
