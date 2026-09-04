/**
 * الوصول لقاعدة البيانات — PostgreSQL على Supabase.
 *
 * الاتصال عبر الـ pooler لا المضيف المباشر: `db.<ref>.supabase.co` لا يُحلّ
 * على IPv4 في المشاريع الجديدة. الرابط الكامل في `.env`.
 *
 * كل الدوال غير متزامنة — هذا فرق جوهري عن نسخة SQLite السابقة، ومترجم
 * TypeScript هو ما يضمن أن كل نداء صار عليه `await`.
 *
 * كل المبالغ العائدة أعداد صحيحة بالسنت.
 */
import postgres from 'postgres';
import type { QuoteInput, Season, Tier } from './pricing.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL غير موجود. انسخ .env.example إلى .env واملأه.');
}

export const sql = postgres(url, {
  ssl: 'require',
  max: 5,
  idle_timeout: 20,
  connect_timeout: 15,
  types: {
    // معرّفات تليغرام من نوع bigint، ويعيدها المحرّك نصاً افتراضياً فتنكسر
    // المقارنات. أرقامها دون حدّ Number الآمن فتحويلها آمن.
    bigint: {
      to: 20,
      from: [20],
      serialize: (v: number) => String(v),
      parse: (v: string) => Number(v),
    },
  },
});

export const close = () => sql.end({ timeout: 5 });

export interface Destination {
  slug: string;
  name: string;
  transfer_rate: number;
  ticket_pp: number;
  guide_rate: number;
  hero_image: string;
  /** مصفوفة JSON من روابط الصور — تُفكّ بـ `galleryOf`. */
  gallery: string;
  /** سطر مصدر الصور الخارجية — يوجبه ترخيص كومنز. */
  image_credits: string;
  /** مسار المدن بالأوزان — يُفكّ بـ parseRoute. */
  route: string;
  /** معلومات عملية — تُفكّ بـ parsePractical. */
  practical: string;
}

/** يفكّ عمود gallery بأمان: عمود تالف لا يجب أن يمنع توليد عرض. */
export function galleryOf(d: Pick<Destination, 'gallery'>): string[] {
  try {
    const parsed: unknown = JSON.parse(d.gallery || '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export interface Hotel {
  id: number;
  destination: string;
  name: string;
  class: string;
  rate_normal: number;
  rate_high: number;
  /** فرق السرير الثالث لليلة، بالسنت. */
  rate_triple: number;
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
  /** وصف يدخل نص اليوم في البرنامج اليومي. */
  description: string;
}

export interface QuoteRow {
  id: number;
  serial: string;
  destination: string;
  nights: number;
  adults: number;
  children_bed: number;
  children_free: number;
  sell: number;
  cost: number;
  status: string;
  chosen_tier: Tier;
  wp_post_id: number | null;
  created_at: Date;
}

/* ------------------------------- الوجهات ------------------------------- */

const DEST_COLS = sql`slug, name, transfer_rate, ticket_pp, guide_rate,
                      hero_image, gallery, image_credits, route, practical`;

export const listDestinations = () => sql<Destination[]>`
  select ${DEST_COLS} from destinations where active order by sort_order, name`;

export const getDestination = async (slug: string): Promise<Destination | undefined> => {
  const [row] = await sql<Destination[]>`
    select ${DEST_COLS} from destinations where slug = ${slug}`;
  return row;
};

const DEST_RATE_FIELDS = ['transfer_rate', 'ticket_pp', 'guide_rate'] as const;
export type DestRateField = (typeof DEST_RATE_FIELDS)[number];

export const setDestinationRate = (slug: string, field: DestRateField, cents: number) => {
  // اسم العمود لا يمكن أن يكون معامَلاً مربوطاً، فيُتحقق منه من قائمة مغلقة
  if (!DEST_RATE_FIELDS.includes(field)) throw new Error(`عمود غير مسموح: ${field}`);
  return sql`update destinations set ${sql(field)} = ${cents} where slug = ${slug}`;
};

/* ------------------------------- الفنادق ------------------------------- */

export const listHotels = (destination: string) => sql<Hotel[]>`
  select id, destination, name, class, rate_normal, rate_high, rate_triple
  from hotels where destination = ${destination} and active
  order by rate_normal`;

/** أرخص فندق في كل فئة — يغذّي توليد الأسعار الثلاثة. */
export const hotelsByClass = async (destination: string) => {
  const rows = await listHotels(destination);
  const pick = (cls: string) => rows.find((h) => h.class === cls);
  return { three: pick('3'), four: pick('4'), five: pick('5'), cabin: pick('cabin'), all: rows };
};

export const addHotel = (h: Omit<Hotel, 'id'>) => sql`
  insert into hotels (destination, name, class, rate_normal, rate_high, rate_triple)
  values (${h.destination}, ${h.name}, ${h.class}, ${h.rate_normal}, ${h.rate_high},
          ${h.rate_triple})`;

export const setHotelRates = (id: number, normal: number, high: number, triple?: number) =>
  triple === undefined
    ? sql`update hotels set rate_normal = ${normal}, rate_high = ${high} where id = ${id}`
    : sql`update hotels set rate_normal = ${normal}, rate_high = ${high},
                            rate_triple = ${triple} where id = ${id}`;

/** إضافة سيارة جديدة — كان التعديل متاحاً والإضافة غير متاحة. */
export const addCar = (destination: string, kind: string, name: string, rateDay: number) =>
  sql`insert into cars (destination, kind, name, rate_day)
      values (${destination}, ${kind}, ${name}, ${rateDay})`;

export const deactivateHotel = (id: number) =>
  sql`update hotels set active = false where id = ${id}`;

/* ------------------------------ السيارات ------------------------------ */

export const listCars = (destination: string) => sql<Car[]>`
  select id, destination, kind, name, rate_day
  from cars where destination = ${destination} and active order by rate_day`;

export const carByKind = async (destination: string, kind: string): Promise<Car | undefined> => {
  const [row] = await sql<Car[]>`
    select id, destination, kind, name, rate_day
    from cars where destination = ${destination} and kind = ${kind} and active limit 1`;
  return row;
};

export const setCarRate = (id: number, cents: number) =>
  sql`update cars set rate_day = ${cents} where id = ${id}`;

/* ------------------------------- الجولات ------------------------------- */

export const listTours = (destination: string) => sql<TourRow[]>`
  select id, destination, name, price, description
  from tours where destination = ${destination} and active order by sort_order, id`;

export const addTour = (destination: string, name: string, price: number) =>
  sql`insert into tours (destination, name, price) values (${destination}, ${name}, ${price})`;

export const setTourPrice = (id: number, cents: number) =>
  sql`update tours set price = ${cents} where id = ${id}`;

export const deactivateTour = (id: number) =>
  sql`update tours set active = false where id = ${id}`;

/* ---------------------------- المستخدمون ---------------------------- */

export interface User {
  telegram_id: number;
  name: string | null;
  username: string | null;
  role: string;
  created_at: Date;
}

export const getUser = async (id: number): Promise<User | undefined> => {
  const [row] = await sql<User[]>`
    select telegram_id, name, username, role, created_at from users where telegram_id = ${id}`;
  return row;
};

export const listUsers = () => sql<User[]>`
  select telegram_id, name, username, role, created_at from users order by created_at`;

export const addUser = (id: number, name: string | null, username: string | null) => sql`
  insert into users (telegram_id, name, username) values (${id}, ${name}, ${username})
  on conflict (telegram_id) do update set name = excluded.name, username = excluded.username`;

export const setUserRole = (id: number, role: 'admin' | 'blocked') =>
  sql`update users set role = ${role} where telegram_id = ${id}`;

/* ----------------------------- الإعدادات ----------------------------- */

export const getSetting = async (key: string, fallback = ''): Promise<string> => {
  const [row] = await sql<{ value: string }[]>`select value from settings where key = ${key}`;
  return row?.value ?? fallback;
};

export const setSetting = (key: string, value: string) => sql`
  insert into settings (key, value) values (${key}, ${value})
  on conflict (key) do update set value = excluded.value`;

export const isOpenAccess = async () => (await getSetting('open_access', '1')) === '1';

/* ------------------------------- العروض ------------------------------- */

/** رقم تسلسلي للعرض بصيغة AT-2026-0001. */
export const nextSerial = async (): Promise<string> => {
  const [row] = await sql<{ value: number }[]>`
    update counters set value = value + 1 where name = 'quote_serial' returning value`;
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

export const saveQuote = (a: SaveQuoteArgs): Promise<QuoteRow> =>
  sql.begin(async (tx) => {
    let customerId: number | null = null;
    if (a.customerName || a.customerPhone) {
      const [c] = await tx<{ id: number }[]>`
        insert into customers (name, phone) values (${a.customerName}, ${a.customerPhone})
        returning id`;
      customerId = c?.id ?? null;
    }
    const [row] = await tx<QuoteRow[]>`
      insert into quotes (
        serial, customer_id, created_by, destination, nights, adults, children_bed, children_free,
        travel_month, input, tiers, chosen_tier, cost, sell
      ) values (
        ${a.serial}, ${customerId}, ${a.createdBy}, ${a.destination}, ${a.input.nights},
        ${a.input.adults}, ${a.input.childrenBed}, ${a.input.childrenFree}, ${a.travelMonth},
        ${JSON.stringify(a.input)}, ${JSON.stringify(a.tiers)}, ${a.chosenTier},
        ${a.cost}, ${a.sell}
      )
      returning id, serial, destination, nights, adults, children_bed, children_free, sell, cost, status,
                chosen_tier, wp_post_id, created_at`;
    return row!;
  }) as Promise<QuoteRow>;

export const getQuote = async (id: number) => {
  const [row] = await sql<
    (QuoteRow & { input: string; tiers: string; customer_name: string | null; customer_phone: string | null })[]
  >`
    select q.*, c.name as customer_name, c.phone as customer_phone
    from quotes q left join customers c on c.id = q.customer_id
    where q.id = ${id}`;
  return row;
};

export const listRecentQuotes = (createdBy: number, limit = 10) => sql<QuoteRow[]>`
  select id, serial, destination, nights, adults, children_bed, children_free, sell, cost, status,
         chosen_tier, wp_post_id, created_at
  from quotes where created_by = ${createdBy}
  order by created_at desc, id desc limit ${limit}`;

export const setQuoteStatus = (id: number, status: 'draft' | 'sent' | 'won' | 'lost') =>
  sql`update quotes set status = ${status}, updated_at = now() where id = ${id}`;

export const setQuoteWpPost = (id: number, wpPostId: number) =>
  sql`update quotes set wp_post_id = ${wpPostId}, updated_at = now() where id = ${id}`;

/** أرقام سريعة للتقرير خلال آخر N يوماً. */
export const stats = async (days = 30) => {
  const [row] = await sql<{ count: string; sell: string; profit: string; won: string }[]>`
    select count(*)                                        as count,
           coalesce(sum(sell), 0)                          as sell,
           coalesce(sum(sell - cost), 0)                   as profit,
           count(*) filter (where status = 'won')          as won
    from quotes
    where created_at > now() - make_interval(days => ${Math.max(1, Math.floor(days))})`;
  return {
    count: Number(row?.count ?? 0),
    sell: Number(row?.sell ?? 0),
    profit: Number(row?.profit ?? 0),
    won: Number(row?.won ?? 0),
  };
};
