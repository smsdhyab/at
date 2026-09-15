/**
 * حاسبة أسعار المسافرون العرب — واجهة واحدة لصفحة GitHub Pages ولإضافة ووردبرس.
 *
 * المحرك: pricing.js المولَّد من bot/src/pricing.ts — نفس منطق البوت حرفياً.
 * الأسعار: تُقرأ حيّة من Supabase بالمفتاح العام (قراءة فقط، جداول الأسعار
 * الخمسة، الصفوف الفعّالة). التعديل يبقى من البوت — مصدر واحد للحقيقة.
 *
 * وضعان:
 *   staff  — أداة داخلية: تكلفة وهامش وربح وتفصيل كامل.
 *   public — لزوار الموقع: أسعار البيع فقط، السعر الكبير للبالغ، وزر واتساب.
 *            كل ما هو تكلفة يُخفى في CSS (.staff-only .int .pr) وفي النصوص هنا.
 */
import { threeTiers, planRooms, money, toCents } from './pricing.js';

const DEFAULTS = {
  url: 'https://lhjfapvqvbasobrtjtdi.supabase.co',
  // المفتاح العام (publishable) مصمَّم للنشر في المتصفح
  key: 'sb_publishable_fcmAehdlnIa_D6JB9iQqlw_uOpFksWN',
  mode: 'staff',
  whatsapp: '966534436932',
  brand: 'المسافرون العرب',
  site: 'alarabtravelers.com',
  // سياسة الربح لليوم بالسنت — تحقنها إضافة ووردبرس من الإعدادات؛ هنا الافتراضي فقط
  marginPerDay: 4000,
};

const UNIT = { per_trip: 'لكل نقلة', per_night: 'لكل ليلة', per_person: 'للشخص', once: 'مرة واحدة' };
const TIERS = ['economy', 'premium', 'vip'];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDate = (iso) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB') : '');
const waDisplay = (d) => (d.startsWith('966') ? `+966 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : `+${d}`);

/** النجوم للعرض: رقم → ★، وغير ذلك (كوخ) بالاسم. */
const starsOf = (h) => (Number(h?.stars) ? '★'.repeat(Number(h.stars)) : h?.stars === 'cabin' ? 'كوخ' : '');
const starsShort = (h) => (Number(h?.stars) ? `${h.stars}★` : h?.stars === 'cabin' ? 'كوخ' : '');

export async function init(root, options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const pub = cfg.mode === 'public';
  root.dataset.mode = pub ? 'public' : 'staff';
  const wa = String(cfg.whatsapp).replace(/\D/g, '');

  const $ = (sel) => root.querySelector(sel);
  const form = $('#f');
  const status = $('#status');
  const errBox = $('#error');
  const v = (name) => form.elements[name].value;
  const num = (name, d = 0) => { const n = parseFloat(v(name)); return Number.isFinite(n) ? n : d; };
  const int = (name, d = 0) => Math.floor(num(name, d));

  async function table(name, query) {
    const r = await fetch(`${cfg.url}/rest/v1/${name}?${query}`, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
    });
    if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
    return r.json();
  }

  let DB = null;
  async function load() {
    const [destinations, hotels, cars, tours, services] = await Promise.all([
      table('destinations', 'select=slug,name,transfer_rate,ticket_pp,guide_rate,sort_order&active=eq.true&order=sort_order.asc'),
      table('hotels', 'select=id,destination,name,class,stars,rate_normal,rate_high,rate_triple&active=eq.true&order=rate_normal.asc,id.asc'),
      table('cars', 'select=id,destination,kind,name,rate_day&active=eq.true&order=rate_day.asc,id.asc'),
      table('tours', 'select=id,destination,name,price&active=eq.true&order=sort_order.asc,id.asc'),
      table('services', 'select=id,destination,name,price,unit&active=eq.true&order=sort_order.asc,id.asc'),
    ]);
    const by = (rows) => (slug) => rows.filter((r) => r.destination === slug);
    DB = { destinations, hotels: by(hotels), cars: by(cars), tours: by(tours), services: by(services) };
  }

  /* ------------------------------ الواجهة ------------------------------ */

  function season() {
    const s = v('season');
    if (s !== 'auto') return s;
    const m = Number((v('depart') || '').split('-')[1]);
    return m >= 6 && m <= 9 ? 'high' : 'normal';
  }

  function fillDestinations() {
    $('#dest').innerHTML = DB.destinations.map((d) => `<option value="${esc(d.slug)}">${esc(d.name)}</option>`).join('');
  }

  /** الأرخص في الخانة — نفس hotelsByClass في البوت. */
  const autoHotel = (hotels, cls) => hotels.find((h) => h.class === cls);

  function fillDestinationDependent() {
    const slug = v('dest');
    const hotels = DB.hotels(slug);
    const high = season() === 'high';
    const auto = {
      economy: autoHotel(hotels, '3'),
      premium: autoHotel(hotels, '4'),
      vip: autoHotel(hotels, '5') ?? autoHotel(hotels, 'cabin'),
    };
    for (const t of TIERS) {
      const sel = form.elements[`h_${t}`];
      const chosen = (auto[t] ?? hotels[0])?.id;
      sel.innerHTML = hotels.map((h) => {
        // للزائر: اسم الفندق ونجومه فقط — سعر الليلة تكلفة مورّد لا تُعرض
        const price = pub ? '' : ` — ${money(high ? h.rate_high : h.rate_normal)}`;
        return `<option value="${h.id}" ${h.id === chosen ? 'selected' : ''}>${esc(h.name)}${price} · ${starsShort(h)}</option>`;
      }).join('') || '<option value="">— لا فنادق —</option>';
    }

    const dest = DB.destinations.find((d) => d.slug === slug);
    const perTrip = DB.services(slug).filter((s) => s.unit === 'per_trip');
    const p = (cents) => (pub ? '' : ` — ${money(cents)}`);
    $('#transferRate').innerHTML =
      `<option value="${dest.transfer_rate}">نقلة المطار الافتراضية${p(dest.transfer_rate)}</option>` +
      perTrip.map((s) => `<option value="${s.price}">${esc(s.name)}${p(s.price)}</option>`).join('');

    $('#tours').innerHTML = DB.tours(slug).map((t) =>
      `<label class="check"><input type="checkbox" name="tour" value="${t.id}"><span class="nm">${esc(t.name)}</span><span class="pr">${money(t.price)}</span></label>`,
    ).join('') || '<p class="hint">لا جولات مسجّلة لهذه الوجهة.</p>';

    const svcs = DB.services(slug);
    $('#servicesBox').hidden = svcs.length === 0;
    $('#services').innerHTML = svcs.map((s) =>
      `<label class="check svc"><input type="checkbox" name="svc" value="${s.id}"><span class="nm">${esc(s.name)}<span class="unit"> · ${UNIT[s.unit] ?? s.unit}</span></span>` +
      `<span class="pr">${money(s.price)}</span><input type="number" class="qty" name="svcqty_${s.id}" min="1" value="1" inputmode="numeric" title="الكمية"></label>`,
    ).join('');

    form.elements.tickets.value = dest.ticket_pp > 0 ? '1' : '0';
  }

  function syncNights() {
    const a = Date.parse(v('depart')), b = Date.parse(v('ret'));
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const n = Math.round((b - a) / 86_400_000);
      if (n >= 1 && n <= 60) form.elements.nights.value = n;
    }
    const s = season();
    $('#seasonHint').textContent = pub
      ? (s === 'high' ? 'موسم الصيف — الأسعار حسب الموسم المرتفع' : '')
      : (s === 'high' ? 'موسم مرتفع — يُستعمل سعر الفندق المرتفع' : 'موسم عادي — يُستعمل سعر الفندق العادي');
  }

  /* ------------------------------ الحساب ------------------------------ */

  function compute() {
    const slug = v('dest');
    const dest = DB.destinations.find((d) => d.slug === slug);
    const hotels = DB.hotels(slug);
    const cars = DB.cars(slug);
    const high = season() === 'high';

    const nights = Math.min(60, Math.max(1, int('nights', 1)));
    const adults = Math.max(1, int('adults', 1));
    const kidsFree = Math.max(0, int('kidsFree'));
    const kidsBed = Math.max(0, int('kidsBed'));
    const plan = planRooms(adults, kidsBed);
    const carDays = form.elements.carDays.value === '' ? Math.max(0, nights - 1) : Math.max(0, int('carDays'));

    const hotelFor = (t) => hotels.find((h) => h.id === Number(v(`h_${t}`))) ?? hotels[0];
    const carFor = (kind) => cars.find((c) => c.kind === kind);
    const rateOf = (h) => (h ? (high ? h.rate_high : h.rate_normal) : 0);

    const tourIds = new Set([...form.querySelectorAll('input[name=tour]:checked')].map((i) => Number(i.value)));
    const tours = DB.tours(slug).filter((t) => tourIds.has(t.id)).map((t) => ({ name: t.name, price: t.price }));

    // الخدمات الإضافية: الوحدة تحدد الضرب، والمجموع يدخل بند المتفرقات
    let svcTotal = 0;
    const svcLines = [];
    const svcNames = [];
    for (const i of form.querySelectorAll('input[name=svc]:checked')) {
      const s = DB.services(slug).find((x) => x.id === Number(i.value));
      if (!s) continue;
      const qty = Math.max(1, int(`svcqty_${s.id}`, 1));
      const mult = s.unit === 'per_night' ? nights : s.unit === 'per_person' ? plan.payingPax : qty;
      svcTotal += s.price * mult;
      svcLines.push(`${s.name} × ${mult}`);
      svcNames.push(s.name);
    }

    const mkind = form.elements.mkind.value;
    const marginRaw = num('margin', NaN);
    const hasMargin = !pub && Number.isFinite(marginRaw) && marginRaw > 0;
    const marginPct = mkind === 'pct' && hasMargin ? marginRaw : undefined;
    const marginFixed = mkind === 'fixed' && hasMargin ? toCents(marginRaw) : undefined;

    const base = {
      nights, adults, childrenFree: kidsFree, childrenBed: kidsBed,
      // الموسم مطبّق في سعر الفندق المختار — لا يُطبّق مرتين (نفس البوت)
      season: 'normal',
      hotelRate: rateOf(hotelFor('premium')), tripleExtra: hotelFor('premium')?.rate_triple ?? 0, hotelNights: nights,
      carRate: carFor('van')?.rate_day ?? 0, carDays,
      transfers: Math.max(0, int('transfers')), transferRate: Number(v('transferRate')) || 0,
      tours,
      ticketPerPerson: v('tickets') === '1' ? dest.ticket_pp : 0,
      guideDays: Math.max(0, int('guideDays')), guideRate: dest.guide_rate,
      simPerPerson: toCents(num('sim')), dinnerPerPerson: toCents(num('dinner')),
      miscTotal: toCents(num('misc')) + svcTotal,
      marginPct: marginPct ?? 22, marginFixed,
      // سياسة الشركة هي الافتراضي؛ النسبة اليدوية (للموظف) تعطّلها
      marginPerDay: marginPct !== undefined ? 0 : Math.max(0, Math.round(Number(cfg.marginPerDay) || 0)),
      feesBp: Math.round(Math.max(0, num('fees')) * 100),
      depositPct: Math.max(0, Math.min(100, int('deposit', 30))),
      roundTo: Math.max(0, toCents(num('roundTo'))),
    };
    const tierRates = (t, kind, guideIncluded) => ({
      hotelRate: rateOf(hotelFor(t)), tripleExtra: hotelFor(t)?.rate_triple ?? 0,
      carRate: carFor(kind)?.rate_day ?? 0, guideIncluded, hotelName: hotelFor(t)?.name, marginPct,
    });
    const rates = {
      economy: tierRates('economy', 'sedan', false),
      premium: tierRates('premium', 'van', false),
      vip: tierRates('vip', 'vip', true),
    };

    const sum = {
      dest: dest.name, nights, depart: v('depart'), ret: v('ret'),
      adults, kidsFree, kidsBed, rooms: plan.rooms, triples: plan.triples,
      transfers: base.transfers, carDays, tourNames: tours.map((t) => t.name),
      tickets: base.ticketPerPerson > 0, guideDays: base.guideDays, svcNames,
      depositPct: base.depositPct,
    };
    render(threeTiers(base, rates), { hotelFor, svcLines, sum });
  }

  let lastSum = null;

  function render(offers, { hotelFor, svcLines, sum }) {
    lastSum = sum;
    const who = [
      `${sum.adults} بالغين`,
      sum.kidsBed ? `${sum.kidsBed} أطفال` : '',
      sum.kidsFree ? `${sum.kidsFree} دون السادسة مجاناً` : '',
      `${sum.rooms} غرفة${sum.triples ? ` منها ${sum.triples} بسرير إضافي` : ''}`,
    ].filter(Boolean).join(' · ');

    $('#tiers').innerHTML = offers.map((o) => {
      const h = hotelFor(o.tier);
      const lines = o.lines.map((l) => {
        const detail = l.key === 'extras' && svcLines.length ? `${l.detail} · ${svcLines.join(' · ')}` : l.detail;
        return `<tr><td>${esc(l.label)}<span class="d">${esc(detail)}</span></td><td>${money(l.amount)}</td></tr>`;
      }).join('');
      // ما يشمله العرض — نص بلا مبالغ، للزائر وللنسخة المطبوعة
      const inc = [
        `إقامة ${sum.nights} ليالٍ مع الإفطار — ${h?.name ?? ''}`,
        sum.transfers ? 'استقبال وتوديع المطار' : '',
        sum.carDays ? `${o.tier === 'vip' ? 'فان VIP' : 'سيارة خاصة'} مع سائق — ${sum.carDays} أيام` : '',
        ...sum.tourNames,
        sum.tickets ? 'تذاكر الدخول للأماكن المذكورة' : '',
        o.tier === 'vip' || sum.guideDays ? 'مرشد عربي' : '',
        ...sum.svcNames,
      ].filter(Boolean);

      // الزائر يرى سعر البالغ كبيراً والمجموعة تحته؛ الموظف يرى المجموعة كبيرة والربح
      const price = pub
        ? `<div class="sell">${money(o.perAdult)}<small>للبالغ</small></div>
           <div class="sub"><span>للمجموعة <b>${money(o.sell)}</b></span><span>العربون <b>${money(o.deposit)}</b></span></div>`
        : `<div class="sell">${money(o.sell)}</div>
           <div class="sub"><span>للبالغ <b>${money(o.perAdult)}</b></span><span>العربون <b>${money(o.deposit)}</b></span><span class="int">الربح <b>${money(o.profit)}</b></span></div>`;

      const waText = `مرحباً، أرغب بعرض ${sum.dest} — ${sum.nights} ليالٍ · ${who}` +
        `\nالفئة: ${o.label} — ${money(o.perAdult)} للبالغ (${money(o.sell)} للمجموعة)` +
        (sum.depart ? `\nالمغادرة: ${fmtDate(sum.depart)}` : '');
      const cta = pub && wa
        ? `<a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(waText)}">اطلب هذا العرض عبر واتساب</a>`
        : '';

      return `<article class="card tier ${o.tier}">
        <div class="thead"><h3>${esc(o.label)}</h3><span class="stars">${starsOf(h)}</span></div>
        ${price}
        <div class="hotel">${esc(h?.name ?? '—')}</div>
        <ul class="inc${pub ? '' : ' print-only'}">${inc.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        <details class="int"><summary>التفصيل</summary>
          <table class="lines">${lines}
            <tr class="total"><td>التكلفة</td><td>${money(o.cost)}</td></tr>
            <tr><td>الهامش</td><td>${money(o.markup)}</td></tr>
            <tr><td>رسوم التحويل</td><td>${money(o.fees)}</td></tr>
            <tr><td>التقريب</td><td>${money(o.rounding)}</td></tr>
            <tr class="total"><td>سعر البيع</td><td>${money(o.sell)}</td></tr>
            <tr class="profit"><td>الربح الصافي</td><td>${money(o.profit)}</td></tr>
          </table>
        </details>
        ${cta}
      </article>`;
    }).join('');

    $('#rsum').textContent = `${sum.dest} · ${sum.nights} ليالٍ · ${who}`;
    const when = sum.depart && sum.ret ? `من ${fmtDate(sum.depart)} إلى ${fmtDate(sum.ret)} · ` : '';
    $('#printHead').innerHTML = `
      <div class="ph-brand"><b>${esc(cfg.brand)}</b><span>${esc(cfg.site)} · واتساب ‎${esc(waDisplay(wa))}‎</span></div>
      <h2>عرض سعر — ${esc(sum.dest)} · ${sum.nights} ليالٍ / ${sum.nights + 1} أيام</h2>
      <p>${when}${who}</p>`;
    $('#printFoot').textContent =
      `الأسعار بالدولار الأمريكي للمجموعة كاملة · العربون ${sum.depositPct}٪ عند التأكيد والباقي قبل الوصول · ` +
      `العرض صالح 7 أيام من ${new Date().toLocaleDateString('en-GB')} وحسب توفر الفنادق.`;
  }

  /* ------------------------------ الربط ------------------------------ */

  // السعر لا يظهر قبل إدخال البيانات والضغط على «احسب» — بعدها يتحدّث مع كل تعديل
  let computed = false;

  function updateHints() {
    const adults = int('adults'), kidsBed = Math.max(0, int('kidsBed')), kidsFree = Math.max(0, int('kidsFree'));
    if (adults >= 1) {
      const plan = planRooms(adults, kidsBed);
      $('#roomsHint').textContent =
        `${plan.rooms} غرفة${plan.triples ? ` — منها ${plan.triples} بسرير إضافي` : ''} · ${plan.payingPax} محسوبون` +
        (kidsFree ? ` · ${kidsFree} مجاناً` : '');
    } else {
      $('#roomsHint').textContent = '';
    }
    $('#calc').disabled = !(int('nights') >= 1 && adults >= 1);
  }

  form.addEventListener('input', (e) => {
    const n = e.target.name;
    if (n === 'dest') fillDestinationDependent();
    if (n === 'depart' || n === 'ret' || n === 'season') { syncNights(); fillDestinationDependent(); }
    if (n === 'nights' || n === 'depart' || n === 'ret' || n === 'dest') {
      form.elements.carDays.value = int('nights') >= 1 ? Math.max(0, int('nights') - 1) : '';
    }
    updateHints();
    if (computed) compute();
  });
  form.addEventListener('change', (e) => {
    if (e.target.name === 'dest' || e.target.name === 'season') fillDestinationDependent();
    updateHints();
    if (computed) compute();
  });

  $('#calc').addEventListener('click', () => {
    computed = true;
    compute();
    $('#placeholder').hidden = true;
    $('#results').hidden = false;
    root.classList.add('results-mode');
    $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#edit').addEventListener('click', () => {
    root.classList.remove('results-mode');
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  const pageTitle = document.title;
  $('#pdf').addEventListener('click', () => {
    document.title = `عرض ${lastSum?.dest ?? ''} ${lastSum?.nights ?? ''} ليالٍ — ${cfg.brand}`;
    window.print();
  });
  window.addEventListener('afterprint', () => { document.title = pageTitle; });

  try {
    await load();
    fillDestinations();
    syncNights();
    fillDestinationDependent();
    updateHints();
    status.textContent = pub ? 'الأسعار محدّثة' : `الأسعار محمّلة · ${DB.destinations.length} وجهات`;
    status.className = 'pill ok';
  } catch (err) {
    status.textContent = 'تعذّر تحميل الأسعار';
    status.className = 'pill err';
    errBox.style.display = 'block';
    errBox.textContent = `لم تصل الأسعار من القاعدة: ${err.message}. تأكد من الاتصال ثم أعد تحميل الصفحة.`;
  }
}

// تشغيل تلقائي: الإعدادات من window.ALARAB_CALC (تحقنها إضافة ووردبرس) أو من data-mode
for (const el of document.querySelectorAll('.alarab-calc')) {
  init(el, { ...(window.ALARAB_CALC ?? {}), ...(el.dataset.mode ? { mode: el.dataset.mode } : {}) });
}
