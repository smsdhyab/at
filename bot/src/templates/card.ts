/**
 * بطاقة الصورة للواتساب والإنستغرام — نفس هوية المستند.
 * مربعة 1080×1080 أو ستوري 1080×1920.
 *
 * نسخة الزبون: لا تكلفة ولا ربح، تماماً كمستند العرض.
 */
import { brand, palette, whatsappDisplay } from '../brand.ts';
import { money } from '../pricing.ts';

export type CardSize = 'square' | 'story';

export const CARD_DIMENSIONS: Record<CardSize, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

export interface CardDoc {
  destinationName: string;
  days: number;
  nights: number;
  /** أرخص سعر معروض، بالسنت. */
  fromPrice: number;
  currency: string;
  highlights: string[];
  hotelClass?: string;
  /** صورة الخلفية — من مكتبة صور الموقع. بدونها تبقى الخلفية لوناً ونقشاً. */
  heroImage?: string;
}

const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function cardHtml(doc: CardDoc, size: CardSize = 'square'): string {
  const { width, height } = CARD_DIMENSIONS[size];
  const tall = size === 'story';
  const m = money(doc.fromPrice, doc.currency);
  // الستوري أطول، فيتسع لنقاط أكثر دون ازدحام
  const points = doc.highlights.slice(0, tall ? 5 : 3);

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600&display=swap">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: ${width}px;
    height: ${height}px;
    background: ${palette.pine};
    color: #EFF3F0;
    font-family: "IBM Plex Sans Arabic", Tahoma, sans-serif;
    overflow: hidden;
    position: relative;
    -webkit-font-smoothing: antialiased;
  }
  /* نقش هندسي خفيف مستوحى من البلاط — مرسوم بالـ CSS، بلا صور خارجية */
  body::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      repeating-linear-gradient(45deg,  rgba(255,255,255,.045) 0 2px, transparent 2px 46px),
      repeating-linear-gradient(-45deg, rgba(255,255,255,.045) 0 2px, transparent 2px 46px);
    pointer-events: none;
  }
  img.bg {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: cover;
  }
  .scrim {
    position: absolute; inset: 0;
    background: linear-gradient(to bottom,
      rgba(16,24,21,.86) 0%, rgba(16,24,21,.62) 32%,
      rgba(16,24,21,.72) 62%, rgba(16,24,21,.94) 100%);
  }
  .frame {
    position: absolute;
    inset: ${tall ? 54 : 44}px;
    border: 2px solid rgba(233,177,131,.35);
    pointer-events: none;
  }
  .wrap {
    position: relative;
    height: 100%;
    padding: ${tall ? 120 : 96}px ${tall ? 96 : 88}px;
    display: flex;
    flex-direction: column;
    text-align: center;
    align-items: center;
  }

  .brand { display: flex; align-items: center; gap: 20px; justify-content: center; }
  .brand img { width: ${tall ? 84 : 72}px; height: ${tall ? 84 : 72}px; object-fit: contain; }
  .brand div { text-align: right; }
  .brand h1 {
    font-family: "Amiri", serif;
    font-size: ${tall ? 40 : 34}px;
    font-weight: 700;
    line-height: 1.2;
  }
  .brand p { font-size: ${tall ? 19 : 16}px; color: #A8C2B5; }

  .mid { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: ${tall ? 30 : 22}px; }
  /* بلا letter-spacing: العربية متصلة الحروف ويفكّها التباعد. */
  .eyebrow {
    font-size: ${tall ? 24 : 20}px;
    color: #E9B183;
  }
  h2 {
    font-family: "Amiri", serif;
    font-size: ${tall ? 108 : 84}px;
    font-weight: 700;
    line-height: 1.1;
    text-wrap: balance;
    text-shadow: 0 4px 24px rgba(0,0,0,.45);
  }
  .duration {
    font-size: ${tall ? 34 : 28}px;
    color: #A8C2B5;
    font-variant-numeric: tabular-nums;
  }
  ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: ${tall ? 14 : 10}px;
    font-size: ${tall ? 28 : 23}px;
    color: #D6E2DC;
  }
  ul li::before { content: "◆"; color: #E9B183; margin-inline-end: 12px; font-size: .7em; vertical-align: middle; }

  .price {
    border-top: 1px solid rgba(255,255,255,.16);
    border-bottom: 1px solid rgba(255,255,255,.16);
    padding: ${tall ? 30 : 22}px 0;
  }
  .price span { display: block; font-size: ${tall ? 24 : 20}px; color: #A8C2B5; }
  .price strong {
    display: block;
    font-family: "Amiri", serif;
    font-size: ${tall ? 92 : 74}px;
    color: #E9B183;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
  }

  .foot { display: flex; flex-direction: column; gap: 8px; }
  .foot .wa {
    font-size: ${tall ? 36 : 30}px;
    font-weight: 600;
    direction: ltr;
    unicode-bidi: isolate;
    font-variant-numeric: tabular-nums;
  }
  .foot small { font-size: ${tall ? 20 : 17}px; color: #A8C2B5; }
</style>
</head>
<body>
${doc.heroImage ? `<img class="bg" src="${esc(doc.heroImage)}" alt="">` : ''}
<div class="scrim"></div>
<div class="frame"></div>
<div class="wrap">
  <div class="brand">
    <div>
      <h1>${esc(brand.name)}</h1>
      <p>${esc(brand.tagline)}</p>
    </div>
    <img src="${esc(brand.logoUrl)}" alt="">
  </div>

  <div class="mid">
    <p class="eyebrow">عرض خاص</p>
    <h2>${esc(doc.destinationName)}</h2>
    <p class="duration">${doc.days} أيام / ${doc.nights} ليالٍ</p>
    ${points.length ? `<ul>${points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
    <div class="price">
      <span>تبدأ من</span>
      <strong>${esc(m)}</strong>
    </div>
  </div>

  <div class="foot">
    <p class="wa">${esc(whatsappDisplay())}</p>
    <small>${esc(brand.website)}</small>
  </div>
</div>
</body>
</html>`;
}
