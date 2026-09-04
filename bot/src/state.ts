/**
 * حالة المحادثة لكل مستخدم — محفوظة في قاعدة البيانات لا في الذاكرة.
 *
 * لماذا لا الذاكرة: البيئة السحابية بلا خادم (Supabase Edge Functions) تنشئ
 * نسخة جديدة لكل رسالة، فلا شيء يبقى بين رسالة وأخرى. وحتى في الحاوية، الحالة
 * في الذاكرة تضيع عند كل إعادة تشغيل فيجد الزبون نفسه في منتصف معالج مكسور.
 *
 * ولماذا خطوات بأسماء لا دوال: الدالة المغلقة (closure) لا تُخزَّن في قاعدة
 * بيانات. الخطوة صارت نصاً مثل `q.nights`، والمُرسِل يوزّعها على المعالج الصحيح.
 */
import { db } from './db.ts';

/** مسودة عرض السعر قيد البناء — كلها قابلة للتحويل إلى JSON. */
export interface DraftData {
  destination?: string;
  destinationName?: string;
  nights?: number;
  adults?: number;
  children?: number;
  infants?: number;
  rooms?: number;
  season?: 'normal' | 'high';
  travelMonth?: string;
  /** معرّفات الجولات المختارة — مصفوفة لا Set، لأن Set لا يُحوَّل إلى JSON. */
  tourIds: number[];
  guideDays?: number;
  customerName?: string;
  customerPhone?: string;
  savedId?: number;
  savedSerial?: string;
}

export interface Session {
  telegramId: number;
  /** الخطوة المنتظرة من رسالة المستخدم القادمة، أو null. */
  step: string | null;
  /** معطى الخطوة — معرّف فندق أو رمز وجهة مثلاً. */
  arg: string | null;
  draft: DraftData;
}

const EMPTY_DRAFT: DraftData = { tourIds: [] };

function parseDraft(raw: string): DraftData {
  try {
    const d: unknown = JSON.parse(raw || '{}');
    if (!d || typeof d !== 'object') return { ...EMPTY_DRAFT };
    const draft = d as DraftData;
    // tourIds قد تصل من نسخة أقدم أو من صف تالف
    return { ...draft, tourIds: Array.isArray(draft.tourIds) ? draft.tourIds : [] };
  } catch {
    return { ...EMPTY_DRAFT };
  }
}

export function getSession(telegramId: number): Session {
  const row = db
    .prepare('select step, arg, draft from sessions where telegram_id = ?')
    .get(telegramId) as { step: string | null; arg: string | null; draft: string } | undefined;
  return {
    telegramId,
    step: row?.step ?? null,
    arg: row?.arg ?? null,
    draft: row ? parseDraft(row.draft) : { ...EMPTY_DRAFT },
  };
}

function write(s: Session): void {
  db.prepare(
    `insert into sessions (telegram_id, step, arg, draft, updated_at)
     values (?, ?, ?, ?, datetime('now'))
     on conflict(telegram_id) do update set
       step = excluded.step, arg = excluded.arg,
       draft = excluded.draft, updated_at = excluded.updated_at`,
  ).run(s.telegramId, s.step, s.arg, JSON.stringify(s.draft));
}

/** يحفظ الجلسة كاملة كما هي. */
export const save = (s: Session): void => write(s);

/** يسجّل أن الرسالة النصية القادمة تخصّ هذه الخطوة. */
export function expectStep(s: Session, step: string, arg: string | null = null): void {
  s.step = step;
  s.arg = arg;
  write(s);
}

/** ينهي انتظار النص دون المساس بالمسودة. */
export function clearStep(s: Session): void {
  s.step = null;
  s.arg = null;
  write(s);
}

/** يبدأ مسودة جديدة ويمسح أي خطوة منتظرة. */
export function resetDraft(telegramId: number): Session {
  const s: Session = { telegramId, step: null, arg: null, draft: { ...EMPTY_DRAFT } };
  write(s);
  return s;
}

/** يمسح الجلسة كلها. */
export function dropSession(telegramId: number): void {
  db.prepare('delete from sessions where telegram_id = ?').run(telegramId);
}

/** هل بدأ المستخدم مسودة فعلاً — يميّز «انتهت الجلسة» عن «لم يبدأ». */
export const hasDraft = (s: Session): boolean => Boolean(s.draft.destination);
