/**
 * سياسة الربح لليوم الواحد — قيمة داخلية للشركة، لا تظهر للزبون أبداً.
 *
 * المصدر الأول: خيار في لوحة ووردبرس تكشفه إضافة الحاسبة عبر
 * GET /wp-json/alarab/v1/policy (عام) وتقبل تعديله عبر POST (مدير + Application
 * Password). وهكذا تُعدَّل من اللوحة ومن البوت وتصل إلى الحاسبة على الموقع من
 * مكان واحد. صف settings في القاعدة مرآة يعمل بها البوت قبل ربط الموقع أو
 * عند تعذّر الوصول إليه.
 */
import * as db from './db.ts';

const WP_URL = process.env.WP_URL?.replace(/\/+$/, '') ?? '';
const WP_USER = process.env.WP_USER ?? '';
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD ?? '';
const DEFAULT_CENTS = 4_000;
const TTL_MS = 5 * 60_000;

let cache: { value: number; at: number } | null = null;

export const wpConfigured = () => Boolean(WP_URL);
export const wpWritable = () => Boolean(WP_URL && WP_USER && WP_APP_PASSWORD);

/** ربح اليوم الواحد بالسنت. لا يرمي أبداً — الافتراضي 40$ إن غاب كل مصدر. */
export async function marginPerDay(): Promise<number> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let value: number | null = null;
  if (WP_URL) {
    try {
      const r = await fetch(`${WP_URL}/wp-json/alarab/v1/policy`, { signal: AbortSignal.timeout(5_000) });
      if (r.ok) {
        const j = (await r.json()) as { margin_per_day?: unknown };
        if (Number.isInteger(j.margin_per_day)) value = j.margin_per_day as number;
      }
    } catch {
      // الموقع لا يستجيب — نسقط إلى المرآة المحلية
    }
  }
  if (value === null) value = parseInt(await db.getSetting('margin_per_day', String(DEFAULT_CENTS)), 10);
  if (!Number.isFinite(value) || value < 0) value = DEFAULT_CENTS;
  cache = { value, at: Date.now() };
  return value;
}

/** يحفظ في المرآة المحلية دائماً، وفي الموقع إن كان مربوطاً. يعيد هل وصل إلى الموقع. */
export async function setMarginPerDay(cents: number): Promise<{ wp: boolean | null }> {
  await db.setSetting('margin_per_day', String(cents));
  cache = null;
  if (!wpWritable()) return { wp: null };
  try {
    const r = await fetch(`${WP_URL}/wp-json/alarab/v1/policy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64'),
      },
      body: JSON.stringify({ margin_per_day: cents }),
      signal: AbortSignal.timeout(8_000),
    });
    return { wp: r.ok };
  } catch {
    return { wp: false };
  }
}
