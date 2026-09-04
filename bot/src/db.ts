/**
 * الوصول لقاعدة البيانات — SQLite المدمجة في Node، بلا أي مكتبة خارجية.
 *
 * ponytail: البوت داخلي بنسخة واحدة وحجم كتابته صغير جداً (عشرات العروض شهرياً)،
 * وهذا هو المجال الذي تتفوق فيه SQLite على أي قاعدة عبر الشبكة: صفر حسابات،
 * صفر رابط اتصال، صفر زمن شبكة، وملف واحد يُنسخ احتياطياً بنسخه. لو صار البوت
 * بعدة نسخ متوازية أو احتاج وصولاً من خدمة أخرى، انقل إلى Postgres — كل
 * الاستعلامات هنا قياسية ما عدا `datetime('now')`.
 *
 * كل المبالغ العائدة أعداد صحيحة بالسنت.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { QuoteInput, Season, Tier } from './pricing.ts';

const file = process.env.DB_FILE ?? './data/aat.db';
if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });

export const db = new DatabaseSync(file);
db.exec('pragma journal_mode = WAL');
db.exec('pragma foreign_keys = ON');

export const close = () => db.close();

/** الأنواع التي تقبلها node:sqlite كمعامل مربوط. */
type P = null | number | bigint | string | Uint8Array;
const all = <T>(sql: string, ...p: P[]): T[] => db.prepare(sql).all(...p) as T[];
const one = <T>(sql: string, ...p: P[]): T | undefined => db.prepare(sql).get(...p) as T | undefined;
const run = (sql: string, ...p: P[]) => db.prepare(sql).run(...p);

export interface Destination {
  slug: string;
  name: string;
  transfer_rate: number;
  ticket_pp: number;
  guide_rate: number;
}

export interface Hotel {
  id: number;
  destination: string;
  name: string;
  class: string;
  rate_normal: number;
  rate_high: number;
}

export interface Car {
  id: number;
  destination: string;
  kind: string;
  name: string;
  rate_day: number;
}

export interface TourRow {
  id: number;
  destination: string;
  name: string;
  price: number;
}

export interface QuoteRow {
  id: number;
  serial: string;
  destination: string;
  nights: number;
  adults: number;
  children: number;
  sell: number;
  cost: number;
  status: string;
  chosen_tier: Tier;
  wp_post_id: number | null;
  created_at: string;
}

/* ------------------------------- الوجهات ------------------------------- */

export const listDestinations = () =>
  all<Destination>(
    `select slug, name, transfer_rate, ticket_pp, guide_rate
     from destinations where active = 1 order by sort_order, name`,
  );

export const getDestination = (slug: string) =>
  one<Destination>(
    `select slug, name, transfer_rate, ticket_pp, guide_rate from destinations where slug = ?`,
    slug,
  );

const DEST_RATE_FIELDS = ['transfer_rate', 'ticket_pp', 'guide_rate'] as const;
export type DestRateField = (typeof DEST_RATE_FIELDS)[number];

export const setDestinationRate = (slug: string, field: DestRateField, cents: number) => {
  // اسم العمود لا يمكن أن يكون معامَلاً مربوطاً، فيُتحقق منه من قائمة مغلقة
  if (!DEST_RATE_FIELDS.includes(field)) throw new Error(`عمود غير مسموح: ${field}`);
  return run(`update destinations set ${field} = ? where slug = ?`, cents, slug);
};

/* ------------------------------- الفنادق ------------------------------- */

export const listHotels = (destination: string) =>
  all<Hotel>(
    `select id, destination, name, class, rate_normal, rate_high
     from hotels where destination = ? and active = 1 order by rate_normal`,
    destination,
  );

/** أرخص فندق في كل فئة — يغذّي توليد الأسعار الثلاثة. */
export const hotelsByClass = (destination: string) => {
  const rows = listHotels(destination);
  const pick = (cls: string) => rows.find((h) => h.class === cls);
  return { three: pick('3'), four: pick('4'), five: pick('5'), cabin: pick('cabin'), all: rows };
};

export const addHotel = (h: Omit<Hotel, 'id'>) =>
  run(
    `insert into hotels (destination, name, class, rate_normal, rate_high) values (?, ?, ?, ?, ?)`,
    h.destination,
    h.name,
    h.class,
    h.rate_normal,
    h.rate_high,
  );

export const setHotelRates = (id: number, normal: number, high: number) =>
  run(`update hotels set rate_normal = ?, rate_high = ? where id = ?`, normal, high, id);

export const deactivateHotel = (id: number) => run(`update hotels set active = 0 where id = ?`, id);

/* ------------------------------ السيارات ------------------------------ */

export const listCars = (destination: string) =>
  all<Car>(
    `select id, destination, kind, name, rate_day
     from cars where destination = ? and active = 1 order by rate_day`,
    destination,
  );

export const carByKind = (destination: string, kind: string) =>
  one<Car>(
    `select id, destination, kind, name, rate_day
     from cars where destination = ? and kind = ? and active = 1 limit 1`,
    destination,
    kind,
  );

export const setCarRate = (id: number, cents: number) =>
  run(`update cars set rate_day = ? where id = ?`, cents, id);

/* ------------------------------- الجولات ------------------------------- */

export const listTours = (destination: string) =>
  all<TourRow>(
    `select id, destination, name, price
     from tours where destination = ? and active = 1 order by sort_order, id`,
    destination,
  );

export const addTour = (destination: string, name: string, price: number) =>
  run(`insert into tours (destination, name, price) values (?, ?, ?)`, destination, name, price);

export const setTourPrice = (id: number, cents: number) =>
  run(`update tours set price = ? where id = ?`, cents, id);

export const deactivateTour = (id: number) => run(`update tours set active = 0 where id = ?`, id);

/* ------------------------------- العروض ------------------------------- */

/** رقم تسلسلي للعرض بصيغة AT-2026-0001. */
export const nextSerial = (): string => {
  run(`update counters set value = value + 1 where name = 'quote_serial'`);
  const row = one<{ value: number }>(`select value from counters where name = 'quote_serial'`);
  return `AT-${new Date().getFullYear()}-${String(row?.value ?? 1).padStart(4, '0')}`;
};

export interface SaveQuoteArgs {
  serial: string;
  createdBy: number;
  destination: string;
  season: Season;
  travelMonth: string | null;
  customerName: string | null;
  customerPhone: string | null;
  input: QuoteInput;
  tiers: unknown;
  chosenTier: Tier;
  cost: number;
  sell: number;
}

export const saveQuote = (a: SaveQuoteArgs): QuoteRow => {
  db.exec('begin');
  try {
    let customerId: number | null = null;
    if (a.customerName || a.customerPhone) {
      const r = run(
        `insert into customers (name, phone) values (?, ?)`,
        a.customerName,
        a.customerPhone,
      );
      customerId = Number(r.lastInsertRowid);
    }
    run(
      `insert into quotes (
         serial, customer_id, created_by, destination, nights, adults, children, infants,
         travel_month, input, tiers, chosen_tier, cost, sell
       ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      a.serial,
      customerId,
      a.createdBy,
      a.destination,
      a.input.nights,
      a.input.adults,
      a.input.children,
      a.input.infants,
      a.travelMonth,
      JSON.stringify(a.input),
      JSON.stringify(a.tiers),
      a.chosenTier,
      a.cost,
      a.sell,
    );
    const row = one<QuoteRow>(
      `select id, serial, destination, nights, adults, children, sell, cost, status,
              chosen_tier, wp_post_id, created_at
       from quotes where serial = ?`,
      a.serial,
    )!;
    db.exec('commit');
    return row;
  } catch (e) {
    db.exec('rollback');
    throw e;
  }
};

export const getQuote = (id: number) =>
  one<QuoteRow & { input: string; tiers: string; customer_name: string | null; customer_phone: string | null }>(
    `select q.*, c.name as customer_name, c.phone as customer_phone
     from quotes q left join customers c on c.id = q.customer_id
     where q.id = ?`,
    id,
  );

export const listRecentQuotes = (createdBy: number, limit = 10) =>
  all<QuoteRow>(
    `select id, serial, destination, nights, adults, children, sell, cost, status,
            chosen_tier, wp_post_id, created_at
     from quotes where created_by = ? order by created_at desc, id desc limit ?`,
    createdBy,
    limit,
  );

export const setQuoteStatus = (id: number, status: 'draft' | 'sent' | 'won' | 'lost') =>
  run(`update quotes set status = ?, updated_at = datetime('now') where id = ?`, status, id);

export const setQuoteWpPost = (id: number, wpPostId: number) =>
  run(`update quotes set wp_post_id = ?, updated_at = datetime('now') where id = ?`, wpPostId, id);

/** أرقام سريعة للتقرير خلال آخر N يوماً. */
export const stats = (days = 30) => {
  const row = one<{ count: number; sell: number; profit: number; won: number }>(
    `select count(*)                                          as count,
            coalesce(sum(sell), 0)                            as sell,
            coalesce(sum(sell - cost), 0)                     as profit,
            sum(case when status = 'won' then 1 else 0 end)   as won
     from quotes where created_at > datetime('now', ?)`,
    `-${Math.max(1, Math.floor(days))} days`,
  );
  return {
    count: row?.count ?? 0,
    sell: row?.sell ?? 0,
    profit: row?.profit ?? 0,
    won: row?.won ?? 0,
  };
};
