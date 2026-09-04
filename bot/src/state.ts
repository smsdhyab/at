/**
 * حالة المحادثة لكل مستخدم.
 *
 * ponytail: الحالة في الذاكرة وتضيع عند إعادة تشغيل الخدمة — مقبول لبوت داخلي
 * بنسخة واحدة، والمستخدم يعيد الخطوة الأخيرة فقط. العروض المحفوظة تذهب لقاعدة
 * البيانات فوراً. لو صار البوت بعدة نسخ، انقل هذين الـ Map إلى Redis أو جدول.
 */
import type { Context } from 'grammy';
import type { Season, Tier } from './pricing.ts';

/** ما ينتظره البوت من رسالة المستخدم النصية القادمة. */
type TextHandler = (ctx: Context, text: string) => Promise<void>;

const pending = new Map<number, TextHandler>();

/** يسجّل أن الرسالة النصية القادمة من هذا المستخدم تذهب لهذه الدالة. */
export function expectText(userId: number, handler: TextHandler): void {
  pending.set(userId, handler);
}

/** يسحب المعالج المنتظر ويمسحه — يُستدعى مرة واحدة فقط. */
export function takeText(userId: number): TextHandler | undefined {
  const h = pending.get(userId);
  pending.delete(userId);
  return h;
}

export function clearText(userId: number): void {
  pending.delete(userId);
}

/** مسودة عرض السعر قيد البناء. */
export interface Draft {
  destination?: string;
  destinationName?: string;
  nights?: number;
  adults?: number;
  children?: number;
  infants?: number;
  rooms?: number;
  season?: Season;
  travelMonth?: string;
  /** معرّفات الجولات المختارة. */
  tourIds: Set<number>;
  guideDays?: number;
  chosenTier?: Tier;
  customerName?: string;
  customerPhone?: string;
  /** رقم العرض بعد الحفظ. */
  savedId?: number;
}

const drafts = new Map<number, Draft>();

export function newDraft(userId: number): Draft {
  const d: Draft = { tourIds: new Set() };
  drafts.set(userId, d);
  return d;
}

export function getDraft(userId: number): Draft | undefined {
  return drafts.get(userId);
}

export function dropDraft(userId: number): void {
  drafts.delete(userId);
  pending.delete(userId);
}
