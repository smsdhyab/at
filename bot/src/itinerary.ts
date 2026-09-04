/**
 * بناء البرنامج اليومي والمسار.
 *
 * الشركات الكبرى لا ترسل قائمة جولات بل برنامجاً يوم بيوم: أين تستيقظ، وماذا
 * ترى، وأين تنام. هذه الوحدة تبني ذلك من الليالي والجولات المختارة ومسار المدن،
 * فلا يحتاج المستخدم إلى كتابة برنامج يدوي لكل عرض.
 */

export interface RouteStop {
  city: string;
  /** وزن نسبي لتوزيع الليالي — لا عدد ثابت، لأن الليالي تختلف بين عرض وآخر. */
  weight: number;
}

export interface RouteNight extends RouteStop {
  nights: number;
}

export interface Day {
  n: number;
  title: string;
  body: string;
  /** مدينة المبيت في نهاية اليوم — فارغة في يوم المغادرة. */
  sleep: string;
}

export interface TourInput {
  name: string;
  description?: string;
}

/**
 * يوزّع الليالي على المدن بالأوزان، بطريقة البواقي الكبرى.
 * مجموع الليالي الموزَّعة يساوي المجموع المطلوب بالضبط — لا ليلة تُخلق ولا تضيع.
 */
export function splitNights(route: RouteStop[], nights: number): RouteNight[] {
  const stops = route.filter((r) => r.city && r.weight > 0);
  if (!stops.length || nights <= 0) return [];

  const total = stops.reduce((s, r) => s + r.weight, 0);
  const exact = stops.map((r) => (r.weight / total) * nights);
  const floors = exact.map(Math.floor);
  let left = nights - floors.reduce((a, b) => a + b, 0);

  // البواقي الأكبر تأخذ الليالي المتبقية
  const order = exact
    .map((v, i) => ({ i, rem: v - floors[i]! }))
    .sort((a, b) => b.rem - a.rem);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i]!++;
    left--;
  }

  // مدينة بصفر ليالٍ لا تُعرض — الأولى تأخذ ليلتها إن لزم
  return stops
    .map((r, i) => ({ ...r, nights: floors[i]! }))
    .filter((r) => r.nights > 0);
}

/** اسم مدينة المبيت لليلة رقم `night` (تبدأ من 1). */
function cityForNight(plan: RouteNight[], night: number): string {
  let acc = 0;
  for (const stop of plan) {
    acc += stop.nights;
    if (night <= acc) return stop.city;
  }
  return plan.at(-1)?.city ?? '';
}

/**
 * يبني الأيام: وصول، ثم أيام الجولات، ثم مغادرة.
 *
 * إن زادت الأيام عن الجولات تُدرج أيام حرة — وهذا مقصود: يوم حر في برنامج
 * طويل أصدق من حشو الأيام بجولات لم يطلبها الزبون.
 * وإن زادت الجولات عن الأيام تُدمج جولتان في يوم واحد.
 */
export function buildDays(nights: number, tours: TourInput[], route: RouteStop[]): Day[] {
  const totalDays = Math.max(1, nights + 1);
  const plan = splitNights(route, nights);
  const firstCity = plan[0]?.city ?? '';

  const days: Day[] = [];

  days.push({
    n: 1,
    title: 'الوصول والاستقبال',
    body:
      `استقبالكم في المطار من مندوبنا، ثم التوجه إلى الفندق واستلام الغرف` +
      `${firstCity ? ` في ${firstCity}` : ''}. ` +
      `بقية اليوم راحة بعد السفر، أو جولة قصيرة قريبة حسب وقت الوصول ورغبتكم.`,
    sleep: cityForNight(plan, 1),
  });

  const middle = Math.max(0, totalDays - 2);
  if (middle > 0) {
    // توزيع الجولات على الأيام الوسطى: قد تُدمج جولتان أو يُترك يوم حراً
    const perDay: TourInput[][] = Array.from({ length: middle }, () => []);
    tours.forEach((t, i) => perDay[i % middle]!.push(t));

    for (let d = 0; d < middle; d++) {
      const dayNo = d + 2;
      const items = perDay[d]!;
      const sleepCity = cityForNight(plan, dayNo);

      if (!items.length) {
        days.push({
          n: dayNo,
          title: 'يوم حر',
          body:
            'يوم مفتوح للراحة أو التسوق أو زيارة ما تحبون. مندوبنا على تواصل معكم ' +
            'لترتيب أي جولة إضافية أو حجز مطعم عند الرغبة.',
          sleep: sleepCity,
        });
        continue;
      }

      days.push({
        n: dayNo,
        title: items.map((t) => t.name).join(' + '),
        body:
          items
            .map((t) => t.description?.trim())
            .filter(Boolean)
            .join(' ') || 'جولة اليوم بسيارة خاصة مع سائق، ويُرتَّب توقيتها حسب الطقس.',
        sleep: sleepCity,
      });
    }
  }

  if (totalDays > 1) {
    days.push({
      n: totalDays,
      title: 'المغادرة',
      body:
        'إخلاء الغرف صباحاً، مع إمكانية حفظ الحقائب في الفندق إن كان الطيران متأخراً، ' +
        'ثم التوصيل إلى المطار قبل موعد الرحلة بوقت كافٍ.',
      sleep: '',
    });
  }

  return days;
}

/** يفكّ عمود route من قاعدة البيانات بأمان. */
export function parseRoute(json: string): RouteStop[] {
  try {
    const v: unknown = JSON.parse(json || '[]');
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is RouteStop => Boolean(x) && typeof x === 'object')
      .map((x) => ({ city: String(x.city ?? ''), weight: Number(x.weight) || 0 }))
      .filter((x) => x.city && x.weight > 0);
  } catch {
    return [];
  }
}

export interface Practical {
  best_time?: string;
  weather?: string;
  currency?: string;
  flight?: string;
  pack?: string;
}

/** يفكّ عمود practical بأمان. */
export function parsePractical(json: string): Practical {
  try {
    const v: unknown = JSON.parse(json || '{}');
    return v && typeof v === 'object' ? (v as Practical) : {};
  } catch {
    return {};
  }
}
