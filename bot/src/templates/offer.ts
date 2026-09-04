/**
 * مستند عرض السعر — A4 عمودي RTL.
 *
 * هذه **نسخة الزبون**. بنية البيانات `OfferDoc` لا تحتوي حقل تكلفة ولا ربح
 * إطلاقاً — ليس إخفاءً بل غياباً: ما لا يدخل الدالة لا يمكن أن يخرج منها.
 * فحص `render.test.ts` يتأكد أن أرقام التكلفة لا تظهر في المخرج.
 *
 * التنسيق يعتمد على هوامش `@page` ليتولى المتصفح تقسيم الصفحات — لا صفحات
 * بارتفاع ثابت، فلا خطر قص المحتوى مهما طال البرنامج.
 */
import { brand, palette, whatsappDisplay } from '../brand.ts';
import { money } from '../pricing.ts';

export interface OfferTier {
  label: string;
  hotelName?: string;
  hotelClass?: string;
  /** سعر البيع للمجموعة، بالسنت. */
  price: number;
  /** نصيب البالغ، بالسنت. */
  perAdult: number;
  extras: string[];
  recommended?: boolean;
}

export interface OfferDoc {
  serial: string;
  issueDate: string;
  destinationName: string;
  days: number;
  nights: number;
  travelMonth?: string;
  customerName?: string;
  travelers: { adults: number; children: number; infants: number; rooms: number };
  tiers: OfferTier[];
  tours: string[];
  includes: string[];
  excludes: string[];
  depositPct: number;
  depositAmount: number;
  validDays: number;
  currency: string;
}

const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const STARS: Record<string, string> = { '3': '★★★', '4': '★★★★', '5': '★★★★★' };

function paxLine(t: OfferDoc['travelers']): string {
  const parts = [`${t.adults} بالغ`];
  if (t.children) parts.push(`${t.children} طفل`);
  if (t.infants) parts.push(`${t.infants} رضيع`);
  return parts.join(' · ');
}

export function offerHtml(doc: OfferDoc): string {
  const m = (cents: number) => money(cents, doc.currency);
  const cheapest = Math.min(...doc.tiers.map((t) => t.price));

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>${esc(doc.serial)} — ${esc(doc.destinationName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap">
<style>
  @page { size: A4; margin: 17mm 14mm 20mm; }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "IBM Plex Sans Arabic", "Noto Sans Arabic", "Segoe UI", Tahoma, sans-serif;
    font-size: 10.5pt;
    line-height: 1.65;
    color: ${palette.ink};
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  /* العربية متصلة الحروف: أي letter-spacing يفكّ الوصل ويشوّه الكلمة.
     التباعد مسموح على الأرقام والحروف اللاتينية فقط. */
  .ltr { direction: ltr; unicode-bidi: isolate; }
  .num { font-variant-numeric: tabular-nums; }

  /* ---------------- الغلاف ---------------- */
  .cover {
    height: 250mm;
    display: flex;
    flex-direction: column;
    page-break-after: always;
    border: 0.6mm solid ${palette.pine};
    padding: 10mm;
    position: relative;
  }
  .cover::after {
    content: "";
    position: absolute;
    inset: 2.2mm;
    border: 0.2mm solid ${palette.line};
    pointer-events: none;
  }
  .masthead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8mm;
    padding-bottom: 6mm;
    border-bottom: 0.3mm solid ${palette.line};
  }
  .masthead img { width: 22mm; height: 22mm; object-fit: contain; }
  .ident { text-align: right; }
  .ident h1 {
    font-family: "Amiri", "Times New Roman", serif;
    font-size: 20pt;
    font-weight: 700;
    color: ${palette.pine};
    margin: 0 0 1mm;
    line-height: 1.2;
  }
  .ident p { margin: 0; font-size: 9pt; color: ${palette.muted}; }

  .cover-mid { flex: 1; display: flex; flex-direction: column; justify-content: center; text-align: center; }
  .eyebrow {
    font-size: 9pt;
    color: ${palette.copper};
    margin: 0 0 5mm;
  }
  .cover-mid h2 {
    font-family: "Amiri", serif;
    font-size: 40pt;
    font-weight: 700;
    color: ${palette.pine};
    margin: 0 0 3mm;
    line-height: 1.15;
  }
  .duration { font-size: 13pt; color: ${palette.teal}; margin: 0 0 9mm; }
  .rule { width: 34mm; height: 0.5mm; background: ${palette.copper}; margin: 0 auto 9mm; }

  .from-price { margin: 0; }
  .from-price span { display: block; font-size: 9pt; color: ${palette.muted}; }
  .from-price strong {
    display: block;
    font-family: "Amiri", serif;
    font-size: 34pt;
    color: ${palette.copper};
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
  }

  .cover-foot {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4mm;
    border-top: 0.3mm solid ${palette.line};
    padding-top: 6mm;
  }
  .fact { text-align: center; }
  .fact span { display: block; font-size: 8pt; color: ${palette.muted}; margin-bottom: 1mm; }
  .fact strong { font-size: 11pt; font-weight: 600; color: ${palette.pine}; }

  /* ---------------- الأقسام ---------------- */
  section { page-break-inside: auto; }
  section + section { margin-top: 10mm; }
  .break { page-break-before: always; }

  h3.sec {
    font-family: "Amiri", serif;
    font-size: 19pt;
    font-weight: 700;
    color: ${palette.pine};
    margin: 0 0 1.5mm;
  }
  .sec-note { font-size: 9pt; color: ${palette.muted}; margin: 0 0 5mm; }
  .sec-rule { height: 0.4mm; background: ${palette.teal}; width: 18mm; margin: 0 0 6mm; }

  /* الجولات */
  ol.tours { list-style: none; margin: 0; padding: 0; counter-reset: t; }
  ol.tours li {
    counter-increment: t;
    display: grid;
    grid-template-columns: 9mm 1fr;
    gap: 3mm;
    align-items: start;
    padding: 2.6mm 0;
    border-bottom: 0.2mm solid ${palette.lineSoft};
    page-break-inside: avoid;
  }
  ol.tours li:last-child { border-bottom: 0; }
  ol.tours li::before {
    content: counter(t);
    font-variant-numeric: tabular-nums;
    color: ${palette.copper};
    font-weight: 600;
    font-size: 10pt;
    text-align: center;
    border: 0.25mm solid ${palette.line};
    border-radius: 50%;
    width: 7mm; height: 7mm;
    line-height: 6.6mm;
  }
  ol.tours li span { padding-top: .6mm; }

  /* الخيارات الثلاثة */
  .tiers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
  .tier {
    border: 0.25mm solid ${palette.line};
    padding: 5mm 4mm;
    page-break-inside: avoid;
    display: flex;
    flex-direction: column;
  }
  .tier.rec { border: 0.5mm solid ${palette.teal}; background: ${palette.tealSoft}; }
  .tier h4 { margin: 0 0 1mm; font-size: 12pt; font-weight: 700; color: ${palette.pine}; }
  .tier .badge {
    display: inline-block;
    font-size: 8pt;
    color: ${palette.teal};
    margin-bottom: 2mm;
  }
  .tier .price {
    font-family: "Amiri", serif;
    font-size: 20pt;
    color: ${palette.copper};
    line-height: 1.25;
    font-variant-numeric: tabular-nums;
    margin: 1mm 0 0;
  }
  .tier .per { font-size: 8.5pt; color: ${palette.muted}; margin: 0 0 3mm; font-variant-numeric: tabular-nums; }
  .tier .hotel { font-size: 9.5pt; color: ${palette.ink2}; margin: 0 0 1mm; font-weight: 600; }
  .tier .stars { color: ${palette.gold}; font-size: 9pt; margin-bottom: 2.5mm; }
  .tier ul { margin: 0; padding-inline-start: 4mm; font-size: 9pt; color: ${palette.ink2}; }
  .tier ul li { margin-bottom: 1mm; }

  /* يشمل / لا يشمل */
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
  .box { border: 0.25mm solid ${palette.line}; padding: 4mm 5mm; page-break-inside: avoid; }
  .box.inc { border-inline-start: 0.9mm solid ${palette.teal}; }
  .box.exc { border-inline-start: 0.9mm solid ${palette.copper}; }
  .box h4 { margin: 0 0 2.5mm; font-size: 11pt; color: ${palette.pine}; }
  .box ul { margin: 0; padding-inline-start: 4.5mm; font-size: 9.5pt; }
  .box li { margin-bottom: 1.2mm; }

  /* العربون والشروط */
  .deposit {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6mm;
    background: ${palette.pine};
    color: #EFF3F0;
    padding: 5mm 6mm;
    margin-top: 8mm;
    page-break-inside: avoid;
  }
  .deposit span { font-size: 10pt; }
  .deposit strong {
    font-family: "Amiri", serif;
    font-size: 20pt;
    font-variant-numeric: tabular-nums;
    color: #E9B183;
  }
  ul.terms { margin: 5mm 0 0; padding-inline-start: 5mm; font-size: 9.5pt; color: ${palette.ink2}; }
  ul.terms li { margin-bottom: 1.4mm; }

  .contact {
    margin-top: 9mm;
    border-top: 0.4mm solid ${palette.line};
    padding-top: 5mm;
    text-align: center;
    page-break-inside: avoid;
  }
  .contact p { margin: 0 0 1.5mm; font-size: 10pt; color: ${palette.ink2}; }
  .contact .wa {
    font-size: 14pt;
    font-weight: 600;
    color: ${palette.teal};
    direction: ltr;
    unicode-bidi: isolate;
    font-variant-numeric: tabular-nums;
  }
  .contact small { color: ${palette.muted}; font-size: 8.5pt; }
</style>
</head>
<body>

<div class="cover">
  <div class="masthead">
    <div class="ident">
      <h1>${esc(brand.name)}</h1>
      <p>${esc(brand.tagline)}</p>
    </div>
    <img src="${esc(brand.logoUrl)}" alt="">
  </div>

  <div class="cover-mid">
    <p class="eyebrow">عرض سعر</p>
    <h2>${esc(doc.destinationName)}</h2>
    <p class="duration num">${doc.days} أيام / ${doc.nights} ليالٍ</p>
    <div class="rule"></div>
    <p class="from-price">
      <span>تبدأ الأسعار من</span>
      <strong>${esc(m(cheapest))}</strong>
    </p>
  </div>

  <div class="cover-foot">
    <div class="fact"><span>رقم العرض</span><strong class="ltr num">${esc(doc.serial)}</strong></div>
    <div class="fact"><span>المسافرون</span><strong>${esc(paxLine(doc.travelers))}</strong></div>
    <div class="fact"><span>تاريخ الإصدار</span><strong class="ltr num">${esc(doc.issueDate)}</strong></div>
  </div>
</div>

${
  doc.customerName || doc.travelMonth
    ? `<section>
  <h3 class="sec">بيانات العرض</h3>
  <div class="sec-rule"></div>
  <div class="two">
    ${doc.customerName ? `<div class="box"><h4>الزبون</h4><p style="margin:0">${esc(doc.customerName)}</p></div>` : ''}
    ${doc.travelMonth ? `<div class="box"><h4>موعد السفر</h4><p style="margin:0" class="ltr num">${esc(doc.travelMonth)}</p></div>` : ''}
  </div>
</section>`
    : ''
}

${
  doc.tours.length
    ? `<section${doc.customerName || doc.travelMonth ? '' : ''}>
  <h3 class="sec">البرنامج والجولات</h3>
  <p class="sec-note">جميع الجولات بسيارة خاصة مع سائق، وتُرتَّب حسب الطقس وأوقات الوصول.</p>
  <div class="sec-rule"></div>
  <ol class="tours">
    ${doc.tours.map((t) => `<li><span>${esc(t)}</span></li>`).join('\n    ')}
  </ol>
</section>`
    : ''
}

<section class="break">
  <h3 class="sec">ثلاثة خيارات</h3>
  <p class="sec-note">نفس البرنامج ونفس الجولات — الفرق في فئة الفندق والسيارة والخدمات.</p>
  <div class="sec-rule"></div>
  <div class="tiers">
    ${doc.tiers
      .map(
        (t) => `<div class="tier${t.recommended ? ' rec' : ''}">
      <h4>${esc(t.label)}</h4>
      ${t.recommended ? '<span class="badge">الأكثر طلباً</span>' : ''}
      ${t.hotelName ? `<p class="hotel">${esc(t.hotelName)}</p>` : ''}
      ${t.hotelClass && STARS[t.hotelClass] ? `<div class="stars">${STARS[t.hotelClass]}</div>` : ''}
      <p class="price">${esc(m(t.price))}</p>
      <p class="per">${esc(m(t.perAdult))} للبالغ الواحد</p>
      ${t.extras.length ? `<ul>${t.extras.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
    </div>`,
      )
      .join('\n    ')}
  </div>
</section>

<section>
  <h3 class="sec">ما يشمله العرض</h3>
  <div class="sec-rule"></div>
  <div class="two">
    <div class="box inc">
      <h4>يشمل</h4>
      <ul>${doc.includes.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
    </div>
    <div class="box exc">
      <h4>لا يشمل</h4>
      <ul>${doc.excludes.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
    </div>
  </div>

  <div class="deposit">
    <span>لتثبيت الحجز — عربون ${doc.depositPct}٪</span>
    <strong>${esc(m(doc.depositAmount))}</strong>
  </div>

  <ul class="terms">
    <li>الأسعار صالحة ${doc.validDays} أيام من تاريخ الإصدار وتخضع لتوفر الغرف وقت التأكيد.</li>
    <li>الإلغاء مجاني قبل 14 يوماً من موعد السفر، وبعدها يُخصم العربون.</li>
    <li>الأسعار لعدد المسافرين المذكور أعلاه، وأي تغيير يستوجب إعادة التسعير.</li>
    <li>ترتيب الجولات قابل للتبديل حسب الطقس وأوقات الرحلات دون نقصان في عددها.</li>
    <li>الفنادق المذكورة أو ما يعادلها في الفئة نفسها عند عدم التوفر.</li>
  </ul>

  <div class="contact">
    <p>لتأكيد الحجز أو تعديل البرنامج، راسلنا مباشرة</p>
    <p class="wa">${esc(whatsappDisplay())}</p>
    <small>
      ${esc(brand.website)}${brand.email ? ` · ${esc(brand.email)}` : ''}${brand.instagram ? ` · @${esc(brand.instagram)}` : ''}
      ${brand.address ? `<br>${esc(brand.address)}` : ''}
      ${brand.license ? `<br>رخصة رقم ${esc(brand.license)}` : ''}
    </small>
  </div>
</section>

</body>
</html>`;
}

/** تذييل يتكرر في كل صفحة — يمرَّر لـ Puppeteer لا لـ CSS. */
export function offerFooter(doc: OfferDoc): string {
  return `<div style="width:100%;font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;
    font-size:7pt;color:${palette.muted};padding:0 14mm;display:flex;
    justify-content:space-between;direction:rtl">
    <span>${esc(brand.name)} · ${esc(brand.website)}</span>
    <span style="direction:ltr">${esc(doc.serial)} — <span class="pageNumber"></span>/<span class="totalPages"></span></span>
  </div>`;
}
