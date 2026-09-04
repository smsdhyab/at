/**
 * التحويل من HTML إلى PDF وصورة — متصفح واحد يخدم المخرجين.
 *
 * ponytail: `puppeteer-core` لا `puppeteer` — لا ينزّل متصفحاً بحجم 150 ميغابايت
 * عند التثبيت، بل يستعمل Chrome أو Edge الموجود أصلاً على الجهاز، و Chromium
 * المثبَّت من apt داخل الحاوية. لو لم يجد متصفحاً يقول ذلك صراحة بدل أن يفشل بغموض.
 *
 * المتصفح يُفتح مرة واحدة ويبقى: فتحه يكلّف ثانية أو أكثر، وإغلاقه بعد كل
 * مستند يجعل كل عرض بطيئاً بلا سبب.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer, { type Browser } from 'puppeteer-core';

const WINDOWS_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

const UNIX_CANDIDATES = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

/** يجد متصفحاً صالحاً أو يشرح كيف يُحدَّد. */
export function findBrowser(): string {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv) {
    if (!existsSync(fromEnv)) {
      throw new Error(`PUPPETEER_EXECUTABLE_PATH يشير إلى ملف غير موجود: ${fromEnv}`);
    }
    return fromEnv;
  }

  const candidates = [...WINDOWS_CANDIDATES, ...UNIX_CANDIDATES];
  const local = process.env.LOCALAPPDATA;
  if (local) candidates.unshift(join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'));

  for (const path of candidates) {
    if (existsSync(path)) return path;
  }

  throw new Error(
    'لم أجد متصفحاً لتوليد المستندات.\n' +
      'ثبّت Google Chrome، أو ضع مسار المتصفح في متغيّر PUPPETEER_EXECUTABLE_PATH داخل .env',
  );
}

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browser?.connected) return browser;
  browser = await puppeteer.launch({
    executablePath: findBrowser(),
    headless: true,
    // لازمان داخل الحاويات؛ بلا ضرر خارجها
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser?.connected) await browser.close();
  browser = null;
}

/**
 * يفتح صفحة بالمحتوى وينتظر الخطوط والصور قبل التسليم.
 *
 * المقاس يُضبط **قبل** تحميل المحتوى: ضبطه بعده يعيد التخطيط، وقد تُلتقط الصورة
 * قبل اكتمال إعادة الرسم فتخرج فارغة تماماً.
 */
async function withPage<T>(
  html: string,
  fn: (page: import('puppeteer-core').Page) => Promise<T>,
  viewport?: { width: number; height: number },
): Promise<T> {
  const page = await (await getBrowser()).newPage();
  try {
    if (viewport) await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
    // بلا هذا الانتظار قد تُطبع الصفحة بخط بديل قبل وصول الخط العربي،
    // أو بمربع فارغ مكان الشعار قبل اكتمال تحميله
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images)
          .filter((img) => !img.complete)
          .map((img) => new Promise((done) => { img.onload = img.onerror = done; })),
      );
    });
    return await fn(page);
  } finally {
    await page.close();
  }
}

export function renderPdf(html: string, footerTemplate?: string): Promise<Uint8Array> {
  return withPage(html, (page) =>
    page.pdf({
      format: 'A4',
      printBackground: true,
      // يجعل هوامش @page في القالب هي المرجع، ويترك مكان التذييل
      preferCSSPageSize: true,
      displayHeaderFooter: Boolean(footerTemplate),
      headerTemplate: '<div></div>',
      footerTemplate: footerTemplate ?? '<div></div>',
    }),
  );
}

/**
 * لا تستعمل `clip` هنا. النافذة مضبوطة على مقاس البطاقة تماماً، ومع `clip`
 * يسلك Puppeteer مسار الالتقاط خارج النافذة فتخرج الصورة خلفيةً فارغة بلا محتوى.
 * لقطة النافذة العادية هي المطلوب حرفياً.
 */
export function renderPng(html: string, size: { width: number; height: number }): Promise<Uint8Array> {
  return withPage(html, (page) => page.screenshot({ type: 'png' }), size);
}
