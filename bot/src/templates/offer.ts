/**
 * مستند عرض السعر — A4 عمودي RTL، مبني حول الصورة.
 *
 * هذه **نسخة الزبون**. بنية `OfferDoc` لا تحتوي حقل تكلفة ولا ربح إطلاقاً —
 * ليس إخفاءً بل غياباً: ما لا يدخل الدالة لا يمكن أن يخرج منها.
 *
 * التقسيم صفحات صريحة (`.sheet`) بارتفاع A4 كامل و`@page{margin:0}`، لأن
 * الغلاف يحتاج صورة تملأ الورقة حتى حوافها — وهذا مستحيل مع هوامش `@page`.
 * ثمن ذلك أن الطول مسؤوليتنا: الجولات تُقسَّم على صفحات بـ `chunk` أدناه.
 */
import { brand, palette, fonts, whatsappDisplay } from '../brand.ts';
import { fontFaceCss } from '../fontface.ts';
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
  /** صورة رأس البطاقة — صورة مختلفة لكل فئة حين تتوفر. */
  image?: string;
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
  /** صورة الغلاف — من مكتبة صور الموقع. */
  heroImage?: string;
  /** صور إضافية للشريط. */
  gallery?: string[];
  /** سطر مصدر الصور الخارجية — يوجبه ترخيص كومنز. */
  imageCredits?: string;
}

const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const STARS: Record<string, string> = { '3': '★★★', '4': '★★★★', '5': '★★★★★' };

/** أقصى عدد جولات في الصفحة الواحدة قبل أن تُفتح صفحة جديدة. */
const TOURS_PER_SHEET = 9;

function chunk<T>(items: T[], size: number): T[][] {
  if (!items.length) return [];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function paxLine(t: OfferDoc['travelers']): string {
  const parts = [`${t.adults} بالغ`];
  if (t.children) parts.push(`${t.children} طفل`);
  if (t.infants) parts.push(`${t.infants} رضيع`);
  return parts.join(' · ');
}

export function offerHtml(doc: OfferDoc): string {
  const m = (cents: number) => money(cents, doc.currency);
  const cheapest = Math.min(...doc.tiers.map((t) => t.price));
  const gallery = (doc.gallery ?? []).filter(Boolean);
  const hero = doc.heroImage ?? '';
  const strip = gallery.length ? gallery : hero ? [hero] : [];
  const tourPages = chunk(doc.tours, TOURS_PER_SHEET);

  const footer = (label: string) =>
    `<div class="foot"><span>${esc(brand.name)} · ${esc(brand.website)}</span>
       <span class="ltr num">${esc(doc.serial)}</span><span>${esc(label)}</span></div>`;

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>${esc(doc.serial)} — ${esc(doc.destinationName)}</title>
<style>
${fontFaceCss()}
  @page { size: A4; margin: 0; }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: ${fonts.body};
    font-size: 11pt;
    line-height: 1.6;
    color: ${palette.ink};
    background: ${palette.cream};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  /* العربية متصلة الحروف: أي letter-spacing يفكّ الوصل. لا يُستعمل على نص عربي. */
  .ltr { direction: ltr; unicode-bidi: isolate; }
  .num { font-variant-numeric: tabular-nums; }

  .sheet {
    width: 210mm; height: 297mm;
    page-break-after: always;
    position: relative; overflow: hidden;
    background: ${palette.cream};
  }
  .sheet:last-child { page-break-after: auto; }
  .pad { position: relative; height: 100%; padding: 18mm 16mm 12mm; display: flex; flex-direction: column; }

  .foot {
    margin-top: auto; padding-top: 5mm;
    border-top: 0.2mm solid ${palette.lineSoft};
    display: flex; justify-content: space-between; gap: 4mm;
    font-size: 7.5pt; color: ${palette.muted};
  }

  /* ---------------- الغلاف ---------------- */
  .cover { color: #fff; }
  .cover img.bleed {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: cover;
  }
  .cover .scrim {
    position: absolute; inset: 0;
    background:
      linear-gradient(to top, rgba(23,86,96,.93) 0%, rgba(23,86,96,.62) 36%,
                      rgba(23,86,96,.14) 64%, rgba(23,86,96,.42) 100%);
  }
  .cover .pad { padding: 16mm 16mm 14mm; }

  .cover-top { display: flex; align-items: center; gap: 5mm; }
  .cover-top img { width: 17mm; height: 17mm; object-fit: contain; }
  .cover-top h1 {
    font-family: ${fonts.display}; font-size: 17pt; font-weight: 700;
    margin: 0; line-height: 1.25; color: #fff;
  }
  .cover-top p { margin: 0; font-size: 8.5pt; color: rgba(255,255,255,.72); }

  .cover-mid { margin-top: auto; }
  .eyebrow { font-size: 11pt; font-weight: 600; color: ${palette.sun}; margin: 0 0 3mm;
    text-shadow: 0 .5mm 2mm rgba(0,0,0,.45); }
  .cover-mid h2 {
    font-family: ${fonts.display}; font-weight: 700;
    font-size: 46pt; line-height: 1.08; margin: 0 0 3mm; color: #fff;
    text-shadow: 0 1mm 4mm rgba(0,0,0,.35);
  }
  .cover-mid .duration { font-size: 13pt; color: rgba(255,255,255,.86); margin: 0 0 7mm; }
  .cover-rule { width: 30mm; height: 0.6mm; background: ${palette.sun}; margin-bottom: 7mm; }
  .cover-price { display: flex; align-items: baseline; gap: 4mm; margin: 0 0 10mm; }
  .cover-price span { font-size: 9.5pt; color: rgba(255,255,255,.75); }
  .cover-price strong {
    font-family: ${fonts.display}; font-size: 38pt; color: ${palette.sun};
    line-height: 1; font-variant-numeric: tabular-nums;
  }

  .cover-bar {
    display: grid; grid-template-columns: repeat(3, 1fr);
    border-top: 0.2mm solid rgba(255,255,255,.28);
    padding-top: 5mm;
  }
  .cover-bar div { text-align: center; }
  .cover-bar div + div { border-inline-start: 0.2mm solid rgba(255,255,255,.2); }
  .cover-bar span { display: block; font-size: 8pt; color: rgba(255,255,255,.6); margin-bottom: .8mm; }
  .cover-bar strong { font-size: 10.5pt; font-weight: 600; color: #fff; }

  /* ---------------- شريط الصور ---------------- */
  .strip { display: grid; gap: 2mm; margin-bottom: 8mm; }
  .strip.one   { grid-template-columns: 1fr; }
  .strip.two   { grid-template-columns: 1fr 1fr; }
  .strip.three { grid-template-columns: 1.6fr 1fr 1fr; }
  .strip img { width: 100%; height: 52mm; object-fit: cover; display: block; }
  .strip.one img { height: 60mm; }

  /* ---------------- الأقسام ---------------- */
  h3.sec { font-family: ${fonts.display}; font-size: 20pt; font-weight: 700; color: ${palette.pine}; margin: 0 0 1.5mm; }
  .sec-note { font-size: 9pt; color: ${palette.muted}; margin: 0 0 4mm; }
  .sec-rule { height: 0.5mm; background: ${palette.copper}; width: 16mm; margin: 0 0 6mm; }

  ol.tours { list-style: none; margin: 0; padding: 0; counter-reset: t; }
  ol.tours li {
    counter-increment: t;
    display: grid; grid-template-columns: 8mm 1fr; gap: 3mm; align-items: center;
    padding: 2.4mm 0; border-bottom: 0.2mm solid ${palette.lineSoft};
  }
  ol.tours li:last-child { border-bottom: 0; }
  ol.tours li::before {
    content: counter(t);
    font-variant-numeric: tabular-nums; color: ${palette.copper}; font-weight: 600;
    font-size: 9.5pt; text-align: center;
    border: 0.25mm solid ${palette.copper}; border-radius: 50%;
    width: 6.5mm; height: 6.5mm; line-height: 6.1mm;
  }

  /* يملأ ما تبقّى من الصفحة بصورة بدل أن يُترك بياضاً ميتاً.
     flex:1 مع min-height:0 يعني: خذ الفائض فقط، واختفِ إن لم يوجد فائض. */
  .filler { flex: 1; min-height: 0; position: relative; overflow: hidden; margin: 7mm 0 0; }
  .filler img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .filler .cap {
    position: absolute; inset-inline-start: 0; bottom: 0; right: 0;
    background: linear-gradient(to top, rgba(23,86,96,.85), transparent);
    color: #fff; padding: 6mm 6mm 4mm; font-size: 10pt;
  }

  .details { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; margin-top: 6mm; }
  .details div { background: ${palette.paper}; border-inline-start: 0.7mm solid ${palette.teal}; padding: 3mm 4mm; }
  .details span { display: block; font-size: 8pt; color: ${palette.muted}; }
  .details strong { font-size: 10pt; color: ${palette.pine}; font-weight: 600; }

  /* ---------------- الخيارات ---------------- */
  .tiers {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 5mm; align-items: start; padding-top: 5mm;
  }
  .tier {
    border-radius: 4mm; overflow: hidden; background: ${palette.card};
    box-shadow: 0 1mm 4mm rgba(46,157,168,.16);
    display: flex; flex-direction: column;
  }
  /* البطاقة الموصى بها مرفوعة قليلاً وظلّها أعمق — الفرق يُرى قبل أن يُقرأ */
  .tier.rec { box-shadow: 0 2mm 8mm rgba(46,157,168,.34); margin-top: -5mm; }

  .tier .top { position: relative; height: 36mm; overflow: hidden; background: ${palette.pine}; }
  .tier .top img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .tier .top .veil {
    position: absolute; inset: 0;
    background: linear-gradient(to top, rgba(23,86,96,.88) 0%, rgba(23,86,96,.20) 74%);
  }
  .tier .top .name { position: absolute; inset-inline: 4.5mm; bottom: 3.5mm; color: #fff; }
  .tier .top h4 { margin: 0; font-size: 15pt; font-weight: 700; line-height: 1.2; }
  .tier .top .stars { color: ${palette.sun}; font-size: 9.5pt; margin-top: .6mm; }
  .tier .ribbon {
    background: ${palette.seaDeep}; color: #fff; font-size: 9.5pt; font-weight: 700;
    padding: 2.2mm; text-align: center;
  }

  .tier .body { padding: 5mm 4.5mm 6mm; display: flex; flex-direction: column; flex: 1; }
  .tier .price {
    font-family: ${fonts.display}; font-size: 27pt; color: ${palette.copper};
    line-height: 1.05; font-variant-numeric: tabular-nums; margin: 0;
  }
  .tier .per { font-size: 8.5pt; color: ${palette.muted}; margin: 1mm 0 4mm; font-variant-numeric: tabular-nums; }
  .tier .hotel {
    font-size: 9pt; color: ${palette.ink2}; margin: 0 0 3.5mm;
    padding-bottom: 3mm; border-bottom: 0.2mm solid ${palette.lineSoft};
  }
  .tier ul { margin: 0; padding: 0; list-style: none; font-size: 9pt; color: ${palette.ink2}; }
  .tier ul li {
    display: grid; grid-template-columns: 4.5mm 1fr; gap: 1.5mm;
    align-items: start; margin-bottom: 1.7mm; line-height: 1.45;
  }
  .tier ul li::before { content: "✓"; color: ${palette.teal}; font-weight: 700; font-size: 9.5pt; }

  /* يشمل / لا يشمل: كتل ملوّنة بلا حدود، وعلامات بدل نقاط */
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; margin-top: 11mm; }
  .box { border-radius: 3mm; padding: 5mm 6mm; }
  .box.inc { background: ${palette.tealSoft}; }
  .box.exc { background: ${palette.copperSoft}; }
  .box h4 { margin: 0 0 3mm; font-size: 11.5pt; font-weight: 700; }
  .box.inc h4 { color: ${palette.teal}; }
  .box.exc h4 { color: ${palette.copper}; }
  .box ul { margin: 0; padding: 0; list-style: none; font-size: 9.5pt; color: ${palette.ink2}; }
  .box li {
    display: grid; grid-template-columns: 5mm 1fr; gap: 1.5mm;
    align-items: start; margin-bottom: 1.9mm; line-height: 1.5;
  }
  .box.inc li::before { content: "✓"; color: ${palette.teal}; font-weight: 700; }
  .box.exc li::before { content: "✕"; color: ${palette.copper}; font-weight: 700; }

  /* شريط طمأنة يختم صفحة الخيارات — لون لا صورة، تفادياً لتكرار صور البطاقات */
  .assure {
    margin-top: auto; margin-bottom: 4mm;
    background: ${palette.pine}; color: #F4FBFB;
    border-radius: 3mm; padding: 5mm 6mm;
    display: flex; align-items: center; justify-content: space-between; gap: 5mm;
  }
  .assure span { font-size: 10pt; }
  .assure b { font-family: ${fonts.display}; font-size: 16pt; color: ${palette.sun}; }

  /* ---------------- الشروط والتواصل ---------------- */
  .deposit {
    display: flex; align-items: center; justify-content: space-between; gap: 6mm;
    background: ${palette.pine}; color: #F4FBFB; padding: 6mm 7mm; margin-bottom: 7mm;
  }
  .deposit span { font-size: 10.5pt; }
  .deposit strong {
    font-family: ${fonts.display}; font-size: 24pt; color: ${palette.sun};
    font-variant-numeric: tabular-nums; line-height: 1;
  }
  ul.terms { margin: 0; padding-inline-start: 5mm; font-size: 9.5pt; color: ${palette.ink2}; }
  ul.terms li { margin-bottom: 1.6mm; }

  /* يأخذ ما تبقّى من الصفحة مثل .filler — لا بياض ميت أسفل الشروط. */
  .cta {
    margin-top: 8mm; position: relative; overflow: hidden;
    flex: 1; min-height: 78mm;
    display: flex; align-items: center; justify-content: center;
    text-align: center; color: #fff;
  }
  .cta img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .cta .scrim { position: absolute; inset: 0; background: rgba(23,86,96,.76); }
  .cta .inner { position: relative; }
  .cta p { margin: 0 0 2mm; font-size: 11pt; color: rgba(255,255,255,.85); }
  .cta .wa {
    font-family: ${fonts.display}; font-size: 26pt; font-weight: 700; color: ${palette.sun};
    direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; line-height: 1.3;
  }
  .cta small { display: block; margin-top: 2mm; font-size: 9pt; color: rgba(255,255,255,.7); }
</style>
</head>
<body>

<!-- ============ 1 · الغلاف ============ -->
<div class="sheet cover">
  ${hero ? `<img class="bleed" src="${esc(hero)}" alt="">` : ''}
  <div class="scrim"></div>
  <div class="pad">
    <div class="cover-top">
      <img src="${esc(brand.logoUrl)}" alt="">
      <div>
        <h1>${esc(brand.name)}</h1>
        <p>${esc(brand.tagline)}</p>
      </div>
    </div>

    <div class="cover-mid">
      <p class="eyebrow">عرض سعر خاص</p>
      <h2>${esc(doc.destinationName)}</h2>
      <p class="duration num">${doc.days} أيام / ${doc.nights} ليالٍ</p>
      <div class="cover-rule"></div>
      <p class="cover-price"><span>تبدأ من</span><strong>${esc(m(cheapest))}</strong></p>
      <div class="cover-bar">
        <div><span>رقم العرض</span><strong class="ltr num">${esc(doc.serial)}</strong></div>
        <div><span>المسافرون</span><strong>${esc(paxLine(doc.travelers))}</strong></div>
        <div><span>تاريخ الإصدار</span><strong class="ltr num">${esc(doc.issueDate)}</strong></div>
      </div>
    </div>
  </div>
</div>

<!-- ============ 2 · البرنامج ============ -->
${
  tourPages.length
    ? tourPages
        .map(
          (page, idx) => `<div class="sheet">
  <div class="pad">
    ${
      idx === 0 && strip.length
        ? `<div class="strip ${strip.length >= 3 ? 'three' : strip.length === 2 ? 'two' : 'one'}">
      ${strip.slice(0, 3).map((u) => `<img src="${esc(u)}" alt="">`).join('\n      ')}
    </div>`
        : ''
    }
    <h3 class="sec">البرنامج والجولات${tourPages.length > 1 ? ` (${idx + 1}/${tourPages.length})` : ''}</h3>
    <p class="sec-note">جميع الجولات بسيارة خاصة مع سائق، وتُرتَّب حسب الطقس وأوقات الوصول.</p>
    <div class="sec-rule"></div>
    <ol class="tours" style="counter-reset: t ${idx * TOURS_PER_SHEET}">
      ${page.map((t) => `<li><span>${esc(t)}</span></li>`).join('\n      ')}
    </ol>
    ${
      idx === tourPages.length - 1 && (hero || strip[0])
        ? `<div class="filler">
      <img src="${esc(hero || strip[0]!)}" alt="">
      <div class="cap">${esc(doc.destinationName)} — ${doc.days} أيام بضيافة عربية</div>
    </div>`
        : ''
    }
    ${
      idx === tourPages.length - 1
        ? `<div class="details">
      <div><span>عدد الغرف</span><strong class="num">${doc.travelers.rooms}</strong></div>
      <div><span>موعد السفر</span><strong class="ltr num">${esc(doc.travelMonth ?? 'حسب اختياركم')}</strong></div>
      <div><span>الزبون</span><strong>${esc(doc.customerName ?? '—')}</strong></div>
    </div>`
        : ''
    }
    ${footer('البرنامج')}
  </div>
</div>`,
        )
        .join('\n')
    : ''
}

<!-- ============ 3 · الخيارات ============ -->
<div class="sheet">
  <div class="pad">
    <h3 class="sec">ثلاثة خيارات</h3>
    <p class="sec-note">نفس البرنامج ونفس الجولات — الفرق في فئة الفندق والسيارة والخدمات.</p>
    <div class="sec-rule"></div>
    <div class="tiers">
      ${doc.tiers
        .map(
          (t) => `<div class="tier${t.recommended ? ' rec' : ''}">
        ${t.recommended ? '<div class="ribbon">الأكثر طلباً</div>' : ''}
        <div class="top">
          ${t.image ? `<img src="${esc(t.image)}" alt="">` : ''}
          <div class="veil"></div>
          <div class="name">
            <h4>${esc(t.label)}</h4>
            ${t.hotelClass && STARS[t.hotelClass] ? `<div class="stars">${STARS[t.hotelClass]}</div>` : ''}
          </div>
        </div>
        <div class="body">
          <p class="price">${esc(m(t.price))}</p>
          <p class="per">${esc(m(t.perAdult))} للبالغ الواحد</p>
          ${t.hotelName ? `<p class="hotel">${esc(t.hotelName)}</p>` : ''}
          ${t.extras.length ? `<ul>${t.extras.map((e) => `<li><span>${esc(e)}</span></li>`).join('')}</ul>` : ''}
        </div>
      </div>`,
        )
        .join('')}
    </div>

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
    <div class="assure">
      <span>كل الخيارات تشمل الاستقبال من المطار وسيارة خاصة طوال البرنامج</span>
      <b class="ltr num">${esc(whatsappDisplay())}</b>
    </div>
    ${footer('الخيارات')}
  </div>
</div>

<!-- ============ 4 · الشروط والتواصل ============ -->
<div class="sheet">
  <div class="pad">
    <h3 class="sec">الحجز والشروط</h3>
    <div class="sec-rule"></div>

    <div class="deposit">
      <span>لتثبيت الحجز — عربون ${doc.depositPct}٪</span>
      <strong>${esc(m(doc.depositAmount))}</strong>
    </div>

    <ul class="terms">
      <li>الأسعار صالحة ${doc.validDays} أيام من تاريخ الإصدار وتخضع لتوفر الغرف وقت التأكيد.</li>
      <li>الإلغاء مجاني قبل 14 يوماً من موعد السفر، وبعدها يُخصم العربون.</li>
      <li>الأسعار لعدد المسافرين المذكور في هذا العرض، وأي تغيير يستوجب إعادة التسعير.</li>
      <li>ترتيب الجولات قابل للتبديل حسب الطقس وأوقات الرحلات دون نقصان في عددها.</li>
      <li>الفنادق المذكورة أو ما يعادلها في الفئة نفسها عند عدم التوفر.</li>
      <li>الأسعار لا تشمل تذاكر الطيران ولا التأمين ما لم يُذكر خلاف ذلك.</li>
    </ul>

    <div class="cta">
      ${strip.at(-1) ? `<img src="${esc(strip.at(-1)!)}" alt="">` : ''}
      <div class="scrim"></div>
      <div class="inner">
        <p>لتأكيد الحجز أو تعديل البرنامج، راسلنا مباشرة</p>
        <div class="wa">${esc(whatsappDisplay())}</div>
        <small>
          ${esc(brand.website)}${brand.email ? ` · ${esc(brand.email)}` : ''}${brand.instagram ? ` · @${esc(brand.instagram)}` : ''}
          ${brand.legalName ? `<br>${esc(brand.legalName)}` : ''}
          ${brand.address ? `<br>${esc(brand.address)}` : ''}
          ${brand.license ? `<br>رخصة رقم ${esc(brand.license)}` : ''}
          ${doc.imageCredits ? `<br><span style="opacity:.72">${esc(doc.imageCredits)}</span>` : ''}
        </small>
      </div>
    </div>
    ${footer('الشروط')}
  </div>
</div>

</body>
</html>`;
}
