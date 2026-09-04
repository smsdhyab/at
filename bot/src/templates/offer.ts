/**
 * مقترح الرحلة — A4 عمودي RTL، سبع صفحات.
 *
 * هذه **نسخة الزبون**. بنية `OfferDoc` لا تحتوي حقل تكلفة ولا ربح إطلاقاً —
 * ليس إخفاءً بل غياباً: ما لا يدخل الدالة لا يمكن أن يخرج منها.
 *
 * التقسيم صفحات صريحة (`.sheet`) بارتفاع A4 كامل و`@page{margin:0}`، لأن
 * الغلاف يحتاج صورة تملأ الورقة حتى حوافها — وهذا مستحيل مع هوامش `@page`.
 * ثمن ذلك أن الطول مسؤوليتنا: الأيام تُقسَّم على صفحات بـ `chunk` أدناه.
 */
import { brand, palette, fonts, whatsappDisplay } from '../brand.ts';
import { fontFaceCss } from '../fontface.ts';
import { money } from '../pricing.ts';
import type { Day, RouteNight, Practical } from '../itinerary.ts';

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
  heroImage?: string;
  gallery?: string[];
  imageCredits?: string;
  /** البرنامج اليومي. */
  itinerary?: Day[];
  /** المدن وتوزيع الليالي. */
  route?: RouteNight[];
  /** معلومات عملية عن الوجهة. */
  practical?: Practical;
}

const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const STARS: Record<string, string> = { '3': '★★★', '4': '★★★★', '5': '★★★★★' };

/** أقصى عدد أيام في الصفحة الواحدة قبل أن تُفتح صفحة جديدة. */
const DAYS_PER_SHEET = 5;

/**
 * يقسّم على صفحات متوازنة لا ممتلئة ثم شبه فارغة.
 * سبعة أيام بحد أقصى خمسة تصير 4+3 لا 5+2 — صفحتان متوازنتان أفضل شكلاً.
 */
function chunk<T>(items: T[], max: number): T[][] {
  if (!items.length) return [];
  const pages = Math.ceil(items.length / max);
  const per = Math.ceil(items.length / pages);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += per) out.push(items.slice(i, i + per));
  return out;
}

function paxLine(t: OfferDoc['travelers']): string {
  const parts = [`${t.adults} بالغ`];
  if (t.children) parts.push(`${t.children} طفل`);
  if (t.infants) parts.push(`${t.infants} رضيع`);
  return parts.join(' · ');
}

/** ما يميّزنا — قيم خدمة لا أرقام مخترعة عن الشركة. */
const PROMISES: ReadonlyArray<readonly [string, string]> = [
  ['ضيافة عربية', 'مندوبنا يتحدث لغتكم ويرافقكم من لحظة الوصول حتى المغادرة.'],
  ['سيارة خاصة لكم وحدكم', 'لا جولات مشتركة ولا انتظار مجموعات — البرنامج يمشي على وقتكم.'],
  ['برنامج مرن', 'ترتيب الأيام يُعدَّل حسب الطقس ورغبتكم دون نقصان في عدد الجولات.'],
  ['أسعار واضحة', 'ما تقرؤونه في هذا المستند هو ما تدفعونه — بلا رسوم تظهر لاحقاً.'],
];

export function offerHtml(doc: OfferDoc): string {
  const m = (cents: number) => money(cents, doc.currency);
  const cheapest = Math.min(...doc.tiers.map((t) => t.price));
  const gallery = (doc.gallery ?? []).filter(Boolean);
  const hero = doc.heroImage ?? '';
  const strip = gallery.length ? gallery : hero ? [hero] : [];
  const dayPages = chunk(doc.itinerary ?? [], DAYS_PER_SHEET);
  const route = doc.route ?? [];
  const practical = doc.practical ?? {};
  const chosen = doc.tiers.find((t) => t.recommended) ?? doc.tiers[0];

  /** خلفية الصفحة — صورة مختلفة لكل صفحة تدور على المعرض. */
  let bgTurn = 0;
  const pageBg = (): string => {
    if (!strip.length) return '';
    const url = strip[bgTurn++ % strip.length]!;
    return `<div class="bg"><img src="${esc(url)}" alt=""><div class="fade"></div></div>`;
  };

  const footer = (label: string) =>
    `<div class="foot"><span>${esc(brand.name)} · ${esc(brand.website)}</span>` +
    `<span class="ltr num">${esc(doc.serial)}</span><span>${esc(label)}</span></div>`;

  const practicalRows: Array<[string, string]> = (
    [
      ['أفضل وقت للزيارة', practical.best_time],
      ['الطقس المتوقع', practical.weather],
      ['العملة والصرافة', practical.currency],
      ['مدة الطيران', practical.flight],
      ['ماذا تحزمون', practical.pack],
    ] as Array<[string, string | undefined]>
  ).flatMap(([k, v]) => (v ? [[k, v] as [string, string]] : []));

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
    line-height: 1.65;
    color: ${palette.ink};
    background: ${palette.skyLow};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .ltr { direction: ltr; unicode-bidi: isolate; }
  .num { font-variant-numeric: tabular-nums; }

  .sheet {
    width: 210mm; height: 297mm;
    page-break-after: always;
    position: relative; overflow: hidden;
    background: ${palette.skyLow};
  }
  .sheet:last-child { page-break-after: auto; }
  .pad { position: relative; height: 100%; padding: 18mm 16mm 12mm; display: flex; flex-direction: column; }

  /* التذييل يقع فوق الصورة، فيحتاج أرضيته الخاصة وإلا ضاع. */
  .foot {
    margin-top: auto;
    background: rgba(255,255,255,.86);
    border-radius: 2mm;
    padding: 2.6mm 4mm;
    display: flex; justify-content: space-between; gap: 4mm;
    font-size: 8pt; font-weight: 500; color: ${palette.seaDeep};
  }

  /* رأس القسم: كلمة صغيرة بلون الشمس، ثم عنوان ثقيل، ثم خطّان بلونين. */
  .sec-eyebrow {
    font-size: 9pt; font-weight: 600; color: ${palette.sand};
    margin: 0 0 1.5mm;
  }
  h3.sec {
    font-family: ${fonts.display}; font-size: 26pt; font-weight: 900;
    color: ${palette.seaDeep}; margin: 0 0 2mm; line-height: 1.15;
  }
  .sec-note { font-size: 9.5pt; color: ${palette.ink2}; margin: 0 0 4mm; }
  .sec-rule {
    height: 1mm; width: 26mm; margin: 0 0 7mm; border-radius: 1mm;
    background: linear-gradient(to left, ${palette.sand} 0 14mm, ${palette.sea} 14mm 100%);
  }

  /* ---------------- الغلاف ---------------- */
  .cover { color: #fff; }
  .cover img.bleed { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .cover .scrim {
    position: absolute; inset: 0;
    background: linear-gradient(to top, rgba(23,86,96,.93) 0%, rgba(23,86,96,.62) 36%,
                                rgba(23,86,96,.14) 64%, rgba(23,86,96,.42) 100%);
  }
  .cover .pad { padding: 16mm 16mm 14mm; }
  .cover-top { display: flex; align-items: center; gap: 5mm; }
  .cover-top img { width: 17mm; height: 17mm; object-fit: contain; }
  .cover-top h1 { font-family: ${fonts.display}; font-size: 17pt; font-weight: 700; margin: 0; line-height: 1.25; color: #fff; }
  .cover-top p { margin: 0; font-size: 8.5pt; color: rgba(255,255,255,.75); }
  .cover-mid { margin-top: auto; }
  .eyebrow { font-size: 11pt; font-weight: 500; color: ${palette.sun}; margin: 0 0 3mm; text-shadow: 0 .5mm 2mm rgba(0,0,0,.45); }
  .cover-mid h2 {
    font-family: ${fonts.display}; font-weight: 900;
    font-size: 48pt; line-height: 1.08; margin: 0 0 3mm; color: #fff;
    text-shadow: 0 1mm 4mm rgba(0,0,0,.35);
  }
  .cover-mid .duration { font-size: 13pt; color: rgba(255,255,255,.88); margin: 0 0 7mm; }
  .cover-rule { width: 30mm; height: 0.6mm; background: ${palette.sun}; margin-bottom: 7mm; }
  .cover-price { display: flex; align-items: baseline; gap: 4mm; margin: 0 0 10mm; }
  .cover-price span { font-size: 9.5pt; color: rgba(255,255,255,.78); }
  .cover-price strong { font-family: ${fonts.display}; font-size: 40pt; color: ${palette.sun}; line-height: 1; font-variant-numeric: tabular-nums; }
  .cover-bar { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 0.2mm solid rgba(255,255,255,.28); padding-top: 5mm; }
  .cover-bar div { text-align: center; }
  .cover-bar div + div { border-inline-start: 0.2mm solid rgba(255,255,255,.2); }
  .cover-bar span { display: block; font-size: 8pt; color: rgba(255,255,255,.62); margin-bottom: .8mm; }
  .cover-bar strong { font-size: 10.5pt; font-weight: 500; color: #fff; }

  /* ---------------- رسالة الترحيب ---------------- */
  .letter { font-size: 11.5pt; line-height: 1.95; color: ${palette.ink2}; max-width: 155mm; }
  .letter p { margin: 0 0 4mm; }

  .promises { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-top: 9mm; }
  .promise { background: #fff; border-radius: 4mm; padding: 5mm 5.5mm; box-shadow: 0 1mm 3mm rgba(46,157,168,.12); }
  .promise b { display: block; font-size: 11pt; color: ${palette.seaDeep}; margin-bottom: 1.5mm; }
  .promise span { font-size: 9.5pt; color: ${palette.ink2}; line-height: 1.6; }

  /* ---------------- البرنامج اليومي ---------------- */
  .days { display: flex; flex-direction: column; gap: 4mm; }
  .day { display: grid; grid-template-columns: 15mm 1fr; gap: 4mm; align-items: start; }
  .day .badge { background: ${palette.seaSoft}; border-radius: 3mm; text-align: center; padding: 2.5mm 1mm; color: ${palette.seaDeep}; }
  .day .badge small { display: block; font-size: 7.5pt; opacity: .8; }
  .day .badge b { display: block; font-size: 15pt; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .day h4 { margin: 0 0 1mm; font-size: 12pt; font-weight: 700; color: ${palette.seaDeep}; line-height: 1.35; }
  .day p { margin: 0; font-size: 9.8pt; line-height: 1.7; color: ${palette.ink2}; }
  .day .sleep { display: inline-block; margin-top: 1.5mm; font-size: 8.5pt; color: ${palette.sand}; }

  /* ---------------- المسار والإقامة ---------------- */
  .route { display: flex; align-items: stretch; margin-bottom: 9mm; }
  .stop { flex: 1; text-align: center; position: relative; padding: 0 2mm; }
  .stop::before { content: ""; position: absolute; top: 5mm; inset-inline: 50% -50%; height: 0.5mm; background: ${palette.line}; }
  .stop:last-child::before { display: none; }
  .stop .dot {
    position: relative; width: 10mm; height: 10mm; margin: 0 auto 2.5mm;
    border-radius: 50%; background: ${palette.sea}; color: #fff;
    font-size: 10pt; font-weight: 700; line-height: 10mm; font-variant-numeric: tabular-nums;
  }
  .stop b { display: block; font-size: 10.5pt; color: ${palette.seaDeep}; }
  .stop span { font-size: 8.5pt; color: ${palette.muted}; }

  .hotels { display: flex; flex-direction: column; gap: 3mm; }
  .hotelrow {
    display: grid; grid-template-columns: 26mm 1fr auto; gap: 4mm; align-items: center;
    background: #fff; border-radius: 3mm; padding: 4mm 5mm;
    box-shadow: 0 .8mm 2.5mm rgba(46,157,168,.10);
  }
  .hotelrow .lvl { font-size: 10pt; font-weight: 700; color: ${palette.seaDeep}; }
  .hotelrow .nm { font-size: 10.5pt; color: ${palette.ink}; }
  .hotelrow .st { font-size: 9.5pt; color: ${palette.sun}; }

  /* ---------------- خلفية الصفحة ---------------- */
  /* منظر تركي أسفل كل صفحة يتلاشى صعوداً في لون الورق: الصفحة لا تظهر
     بيضاء فارغة، والنص يبقى على أرضية نظيفة تماماً في أعلى الصفحة. */
  .bg { position: absolute; inset: 0; z-index: 0; overflow: hidden; }
  .bg img { width: 100%; height: 100%; object-fit: cover; display: block; }
  /* سماء فوق وأرض تحت: الورقة تُقرأ كمشهد واحد لا كنص فوق بياض.
     الطبقة معتمة تماماً في الأعلى حيث النص، ثم تنفتح عند الأفق. */
  .bg .fade {
    position: absolute; inset: 0;
    background:
      linear-gradient(to bottom,
        ${palette.sky} 0%,
        ${palette.skyMid} 20%,
        ${palette.skyLow} 38%,
        rgba(240,248,246,.92) 50%,
        rgba(240,248,246,.55) 60%,
        rgba(240,248,246,.18) 72%,
        rgba(240,248,246,.10) 88%,
        rgba(240,248,246,.30) 100%);
  }
  .pad { z-index: 1; }

  .filler { flex: 1; min-height: 0; position: relative; overflow: hidden; margin: 7mm 0 0; border-radius: 3mm; }
  .filler img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .filler .cap {
    position: absolute; inset-inline: 0; bottom: 0;
    background: linear-gradient(to top, rgba(23,86,96,.85), transparent);
    color: #fff; padding: 6mm 6mm 4mm; font-size: 10pt;
  }

  /* ---------------- الخيارات ---------------- */
  .tiers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5mm; align-items: start; padding-top: 5mm; }
  .tier { border-radius: 4mm; overflow: hidden; background: ${palette.card};
    box-shadow: 0 1mm 4mm rgba(46,157,168,.16); display: flex; flex-direction: column; }
  .tier.rec { box-shadow: 0 2mm 8mm rgba(46,157,168,.34); margin-top: -5mm; }
  .tier .ribbon { background: ${palette.seaDeep}; color: #fff; font-size: 9.5pt; font-weight: 700; padding: 2.2mm; text-align: center; }
  .tier .top { position: relative; height: 36mm; overflow: hidden; background: ${palette.seaDeep}; }
  .tier .top img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .tier .top .veil { position: absolute; inset: 0; background: linear-gradient(to top, rgba(23,86,96,.88) 0%, rgba(23,86,96,.20) 74%); }
  .tier .top .name { position: absolute; inset-inline: 4.5mm; bottom: 3.5mm; color: #fff; }
  .tier .top h4 { margin: 0; font-size: 15pt; font-weight: 700; line-height: 1.2; }
  .tier .top .stars { color: ${palette.sun}; font-size: 9.5pt; margin-top: .6mm; }
  .tier .body { padding: 5mm 4.5mm 6mm; display: flex; flex-direction: column; flex: 1; }
  .tier .price { font-family: ${fonts.display}; font-size: 27pt; color: ${palette.sand}; line-height: 1.05; font-variant-numeric: tabular-nums; margin: 0; }
  .tier .per { font-size: 8.5pt; color: ${palette.muted}; margin: 1mm 0 4mm; font-variant-numeric: tabular-nums; }
  .tier .hotel { font-size: 9pt; color: ${palette.ink2}; margin: 0 0 3.5mm; padding-bottom: 3mm; border-bottom: 0.2mm solid ${palette.lineSoft}; }
  .tier ul { margin: 0; padding: 0; list-style: none; font-size: 9pt; color: ${palette.ink2}; }
  .tier ul li { display: grid; grid-template-columns: 4.5mm 1fr; gap: 1.5mm; align-items: start; margin-bottom: 1.7mm; line-height: 1.45; }
  .tier ul li::before { content: "✓"; color: ${palette.sea}; font-weight: 700; font-size: 9.5pt; }

  /* ---------------- يشمل / لا يشمل / عملي ---------------- */
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
  .box { border-radius: 3mm; padding: 5mm 6mm; }
  .box.inc { background: ${palette.seaSoft}; }
  .box.exc { background: ${palette.sandSoft}; }
  .box h4 { margin: 0 0 3mm; font-size: 11.5pt; font-weight: 700; }
  .box.inc h4 { color: ${palette.seaDeep}; }
  .box.exc h4 { color: ${palette.sand}; }
  .box ul { margin: 0; padding: 0; list-style: none; font-size: 9.5pt; color: ${palette.ink2}; }
  .box li { display: grid; grid-template-columns: 5mm 1fr; gap: 1.5mm; align-items: start; margin-bottom: 1.9mm; line-height: 1.5; }
  .box.inc li::before { content: "✓"; color: ${palette.sea}; font-weight: 700; }
  .box.exc li::before { content: "✕"; color: ${palette.sand}; font-weight: 700; }

  .facts { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-top: 6mm; }
  .fact { background: #fff; border-radius: 3mm; padding: 4mm 5mm; box-shadow: 0 .8mm 2.5mm rgba(46,157,168,.10); }
  .fact b { display: block; font-size: 9pt; color: ${palette.sea}; margin-bottom: 1mm; }
  .fact span { font-size: 9.8pt; color: ${palette.ink2}; line-height: 1.55; }

  /* ---------------- الدفع والشروط ---------------- */
  .pay { display: flex; gap: 4mm; margin-bottom: 8mm; }
  .paystep { flex: 1; background: #fff; border-radius: 3mm; padding: 5mm; text-align: center;
    box-shadow: 0 1mm 3mm rgba(46,157,168,.12); border-top: 1mm solid ${palette.sea}; }
  .paystep small { display: block; font-size: 8.5pt; color: ${palette.muted}; }
  .paystep b { display: block; font-family: ${fonts.display}; font-size: 19pt; color: ${palette.sand};
    font-variant-numeric: tabular-nums; margin: 1mm 0; }
  .paystep span { font-size: 9pt; color: ${palette.ink2}; }

  ul.terms { margin: 0; padding-inline-start: 5mm; font-size: 9.5pt; color: ${palette.ink2}; }
  ul.terms li { margin-bottom: 1.6mm; }

  .cta { margin-top: 8mm; position: relative; overflow: hidden; flex: 1; min-height: 62mm;
    display: flex; align-items: center; justify-content: center; text-align: center; color: #fff; border-radius: 3mm; }
  .cta img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .cta .scrim { position: absolute; inset: 0; background: rgba(23,86,96,.78); }
  .cta .inner { position: relative; }
  .cta p { margin: 0 0 2mm; font-size: 11pt; color: rgba(255,255,255,.88); }
  .cta .wa { font-family: ${fonts.display}; font-size: 26pt; font-weight: 700; color: ${palette.sun};
    direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; line-height: 1.3; }
  .cta small { display: block; margin-top: 2mm; font-size: 9pt; color: rgba(255,255,255,.72); }
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
      <p class="eyebrow">مقترح رحلة</p>
      <h2>${esc(doc.destinationName)}</h2>
      <p class="duration num">${doc.days} أيام / ${doc.nights} ليالٍ</p>
      <div class="cover-rule"></div>
      <p class="cover-price"><span>تبدأ من</span><strong>${esc(m(cheapest))}</strong></p>
      <div class="cover-bar">
        <div><span>رقم البرنامج</span><strong class="ltr num">${esc(doc.serial)}</strong></div>
        <div><span>السعر مبني على</span><strong>${esc(paxLine(doc.travelers))}</strong></div>
        <div><span>تاريخ الإصدار</span><strong class="ltr num">${esc(doc.issueDate)}</strong></div>
      </div>
    </div>
  </div>
</div>

<!-- ============ 2 · عن البرنامج ============ -->
<div class="sheet">
  ${pageBg()}
  <div class="pad">
    <p class="sec-eyebrow">برنامج مصمَّم بعناية</p>
    <h3 class="sec">عن هذا البرنامج</h3>
    <div class="sec-rule"></div>

    <div class="letter">
      <p>
        برنامج ${esc(doc.destinationName)} لمدة ${doc.days} أيام و${doc.nights} ليالٍ،
        صُمِّم ليجمع بين أشهر معالم المنطقة ووقت كافٍ للراحة — لا برنامج مزدحم
        يُنهك المسافر، ولا فارغ يضيّع رحلته.
      </p>
      <p>
        ستجدون في الصفحات التالية البرنامج يوماً بيوم، والمدن التي تنامون فيها،
        وثلاثة خيارات تختلف في فئة الفندق والسيارة لا في الجولات — لتختاروا ما
        يناسب ميزانيتكم دون أن ينقص من رحلتكم شيء.
      </p>
      <p>
        الأسعار في هذا المستند مبنية على ${esc(paxLine(doc.travelers))}
        في ${doc.travelers.rooms} ${doc.travelers.rooms === 1 ? 'غرفة' : 'غرف'}.
        أي تغيير في عدد المسافرين أو المدة أو الفنادق نعيد تسعيره لكم فوراً.
      </p>
    </div>

    <div class="promises">
      ${PROMISES.map(([t, d]) => `<div class="promise"><b>${esc(t)}</b><span>${esc(d)}</span></div>`).join('')}
    </div>

    ${footer('عن البرنامج')}
  </div>
</div>

<!-- ============ 3 · البرنامج اليومي ============ -->
${dayPages
  .map(
    (page, idx) => `<div class="sheet">
  ${pageBg()}
  <div class="pad">
    <p class="sec-eyebrow">رحلتكم خطوة بخطوة</p>
    <h3 class="sec">البرنامج يوماً بيوم${dayPages.length > 1 ? ` (${idx + 1}/${dayPages.length})` : ''}</h3>
    <p class="sec-note">جميع الجولات بسيارة خاصة مع سائق. الترتيب قابل للتبديل حسب الطقس دون نقصان في العدد.</p>
    <div class="sec-rule"></div>
    <div class="days">
      ${page
        .map(
          (d) => `<div class="day">
        <div class="badge"><small>اليوم</small><b>${d.n}</b></div>
        <div>
          <h4>${esc(d.title)}</h4>
          <p>${esc(d.body)}</p>
          ${d.sleep ? `<span class="sleep">المبيت في ${esc(d.sleep)}</span>` : ''}
        </div>
      </div>`,
        )
        .join('')}
    </div>
    ${footer('البرنامج')}
  </div>
</div>`,
  )
  .join('')}

<!-- ============ 4 · المسار والإقامة ============ -->
<div class="sheet">
  ${pageBg()}
  <div class="pad">
    <p class="sec-eyebrow">أين تنامون</p>
    <h3 class="sec">المسار والإقامة</h3>
    <p class="sec-note">أين تنامون كل ليلة، وفندق كل فئة.</p>
    <div class="sec-rule"></div>

    ${
      route.length
        ? `<div class="route">
      ${route
        .map(
          // الرقم ترتيب المحطة لا عدد الليالي — كان يلتبس بها حين تتساويان
          (r, i) => `<div class="stop">
        <div class="dot num">${i + 1}</div>
        <b>${esc(r.city)}</b>
        <span>${r.nights === 1 ? 'ليلة واحدة' : `${r.nights} ليالٍ`}</span>
      </div>`,
        )
        .join('')}
    </div>`
        : ''
    }

    <div class="hotels">
      ${doc.tiers
        .map(
          (t) => `<div class="hotelrow">
        <span class="lvl">${esc(t.label)}</span>
        <span class="nm">${esc(t.hotelName ?? 'حسب التوفر')}</span>
        <span class="st">${t.hotelClass && STARS[t.hotelClass] ? STARS[t.hotelClass] : ''}</span>
      </div>`,
        )
        .join('')}
    </div>

    ${footer('المسار')}
  </div>
</div>

<!-- ============ 5 · الخيارات ============ -->
<div class="sheet">
  ${pageBg()}
  <div class="pad">
    <p class="sec-eyebrow">اختاروا ما يناسبكم</p>
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
    ${footer('الخيارات')}
  </div>
</div>

<!-- ============ 6 · يشمل / لا يشمل + معلومات عملية ============ -->
<div class="sheet">
  ${pageBg()}
  <div class="pad">
    <p class="sec-eyebrow">بوضوح تام</p>
    <h3 class="sec">ما يشمله العرض</h3>
    <div class="sec-rule"></div>
    <div class="two">
      <div class="box inc">
        <h4>يشمل</h4>
        <ul>${doc.includes.map((i) => `<li><span>${esc(i)}</span></li>`).join('')}</ul>
      </div>
      <div class="box exc">
        <h4>لا يشمل</h4>
        <ul>${doc.excludes.map((i) => `<li><span>${esc(i)}</span></li>`).join('')}</ul>
      </div>
    </div>

    ${
      practicalRows.length
        ? `<h3 class="sec" style="margin-top:10mm">معلومات تهمّكم</h3>
    <div class="sec-rule"></div>
    <div class="facts">
      ${practicalRows.map(([k, v]) => `<div class="fact"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('')}
    </div>`
        : ''
    }
    ${footer('التفاصيل')}
  </div>
</div>

<!-- ============ 7 · الدفع والشروط والتواصل ============ -->
<div class="sheet">
  ${pageBg()}
  <div class="pad">
    <p class="sec-eyebrow">الخطوة الأخيرة</p>
    <h3 class="sec">الحجز والدفع</h3>
    <div class="sec-rule"></div>

    <div class="pay">
      <div class="paystep">
        <small>عند تأكيد الحجز</small>
        <b>${esc(m(doc.depositAmount))}</b>
        <span>عربون ${doc.depositPct}٪ — تُثبَّت به الفنادق</span>
      </div>
      <div class="paystep">
        <small>قبل السفر بـ 14 يوماً</small>
        <b>${esc(m(Math.max(0, (chosen?.price ?? 0) - doc.depositAmount)))}</b>
        <span>المبلغ المتبقي من قيمة البكج</span>
      </div>
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
      ${strip.at(-1) ? `<img src="${esc(strip.at(-1))}" alt="">` : ''}
      <div class="scrim"></div>
      <div class="inner">
        <p>لتأكيد الحجز أو تعديل البرنامج، راسلونا مباشرة</p>
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
