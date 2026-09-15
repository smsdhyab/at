/**
 * بطاقة الصورة للواتساب والإنستغرام — نفس هوية المستند.
 * مربعة 1080×1080 أو ستوري 1080×1920.
 *
 * نسخة الزبون: لا تكلفة ولا ربح، تماماً كمستند العرض.
 */
import { brand, palette, fonts, whatsappDisplay } from '../brand.ts';
import { fontFaceCss } from '../fontface.ts';
import { money } from '../pricing.ts';
import { sized, IMG } from '../imageurl.ts';

export type CardSize = 'square' | 'story';

export const CARD_DIMENSIONS: Record<CardSize, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

export interface CardDoc {
  destinationName: string;
  days: number;
  nights: number;
  /** أرخص سعر للبالغ، بالسنت. */
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
<style>
${fontFaceCss()}
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: ${width}px;
    height: ${height}px;
    background: ${palette.seaDeep};
    color: #F4FBFB;
    font-family: ${fonts.body};
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
      rgba(23,86,96,.84) 0%, rgba(23,86,96,.46) 34%,
      rgba(23,86,96,.60) 62%, rgba(23,86,96,.92) 100%);
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
    font-family: ${fonts.display};
    font-size: ${tall ? 40 : 34}px;
    font-weight: 700;
    line-height: 1.2;
  }
  .brand p { font-size: ${tall ? 19 : 16}px; color: #BCDDE0; }

  .mid { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: ${tall ? 30 : 22}px; }
  /* بلا letter-spacing: العربية متصلة الحروف ويفكّها التباعد. */
  .eyebrow {
    font-size: ${tall ? 24 : 20}px;
    color: ${palette.sun};
  }
  h2 {
    font-family: ${fonts.display};
    font-size: ${tall ? 108 : 84}px;
    font-weight: 700;
    line-height: 1.1;
    text-wrap: balance;
    text-shadow: 0 4px 24px rgba(0,0,0,.45);
  }
  .duration {
    font-size: ${tall ? 34 : 28}px;
    color: #BCDDE0;
    font-variant-numeric: tabular-nums;
  }
  ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: ${tall ? 14 : 10}px;
    font-size: ${tall ? 28 : 23}px;
    color: #DDF0F1;
  }
  ul li::before { content: "◆"; color: ${palette.sun}; margin-inline-end: 12px; font-size: .7em; vertical-align: middle; }

  .price {
    border-top: 1px solid rgba(255,255,255,.16);
    border-bottom: 1px solid rgba(255,255,255,.16);
    padding: ${tall ? 30 : 22}px 0;
  }
  .price span { display: block; font-size: ${tall ? 24 : 20}px; color: #BCDDE0; }
  .price strong {
    display: block;
    font-family: ${fonts.display};
    font-size: ${tall ? 92 : 74}px;
    color: ${palette.sun};
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
  .foot small { font-size: ${tall ? 20 : 17}px; color: #BCDDE0; }
</style>
</head>
<body>
${doc.heroImage ? `<img class="bg" src="${esc(sized(doc.heroImage, IMG.card))}" alt="">` : ''}
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
      <span>للشخص</span>
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
