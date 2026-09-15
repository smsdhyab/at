// مولَّد آلياً من bot/src/pricing.ts بواسطة npm run calc:build — لا تعدّله هنا.
// أي تغيير في منطق المال يكون في pricing.ts ثم يُعاد البناء.
/**
 * محرك التسعير.
 *
 * كل المبالغ أعداد صحيحة بالسنت. لا يوجد عدد عشري عائم في أي مبلغ محفوظ أو معاد:
 * `0.1 + 0.2 !== 0.3` غير مقبول في نظام يحسب أرباحاً.
 * المعاملات (الموسم، الهامش، الرسوم) أعداد صحيحة بالنسبة المئوية أو بأجزاء العشرة آلاف،
 * وكل ضرب يُقرَّب فوراً إلى سنت صحيح قبل أن يدخل في أي جمع.
 */

                                                
                                                 

/** معامل الموسم كنسبة مئوية صحيحة. */
export const SEASON_PCT                         = { normal: 100, high: 115, peak: 130 };

/** هامش الربح لكل فئة، نسبة مئوية صحيحة. */
export const TIER_MARGIN_PCT                       = { economy: 18, premium: 22, vip: 28 };

export const SEASON_LABEL                         = {
  normal: 'عادي',
  high: 'مرتفع',
  peak: 'ذروة',
};

export const TIER_LABEL                       = {
  economy: 'اقتصادي',
  premium: 'مميز',
  vip: 'VIP',
};

                       
               
                                           
                
 

                             
                 
                 
                                                                                 
                       
                                                                            
                      
                 

                                          
                    
                                                 
                      
                      
                     

                                          
                  
                  

                                            
                    
                       

                

                                           
                          

                    
                    

                       
                          
                    

                                      
                    
     
                                                                        
                                                          
     
                       
     
                                                                           
                                                                 
                                                 
     
                        
                                                     
                 
                                        
                     
                                                                                 
                  
 

                           
                            
                
                                                    
                  
                                                  
                    
 

/**
 * توزيع الغرف.
 *
 * البالغون يتقاسمون غرفاً مزدوجة. كل طفل من ست سنوات فأكثر يحوّل غرفة مزدوجة
 * إلى ثلاثية بسرير إضافي — وهذا أرخص للزبون من غرفة كاملة. فإن زاد عدد هؤلاء
 * الأطفال عن عدد الغرف المتاحة، يُفتح لهم غرف إضافية.
 *
 * من هم دون السادسة لا يدخلون الحساب إطلاقاً: لا سرير ولا تذكرة ولا خدمة.
 *
 * السرير الثالث يُحتسب على من لا يجد مكاناً في غرفة مزدوجة، لا على كل طفل:
 * بالغان وطفلان يسكنان غرفتين مزدوجتين بلا سرير إضافي إطلاقاً. احتساب سرير
 * ثالث مع فتح غرفة ثانية ازدواج في الحساب — الغرفة الثانية تتسع للطفل أصلاً.
 */
export function planRooms(adults        , childrenBed        )           {
  const a = Math.max(1, Math.floor(adults) || 0);
  const kids = Math.max(0, Math.floor(childrenBed) || 0);

  const baseRooms = Math.ceil(a / 2);
  const inParentRooms = Math.min(kids, baseRooms);
  const rooms = baseRooms + Math.ceil((kids - inParentRooms) / 2);
  // الأسرّة المزدوجة تستوعب غرفتين لكل شخصين؛ الباقي فقط يحتاج سريراً ثالثاً
  const triples = Math.max(0, a + kids - rooms * 2);

  return { rooms, triples, payingPax: a + kids };
}

                            
              
                
                 
                 
 

                              
                     
                                          
                 
                                   
               
                                      
                 
                      
               
                                     
                   
                                    
               
                                          
                 
                                        
                   
                  
                                                                 
                    
 

/** يضرب مبلغاً بالسنت في نسبة مئوية صحيحة ويعيد سنتاً صحيحاً. */
function pct(cents        , percent        )         {
  return Math.round((cents * percent) / 100);
}

/** يضرب مبلغاً بالسنت في نسبة بأجزاء العشرة آلاف ويعيد سنتاً صحيحاً. */
function bp(cents        , basisPoints        )         {
  return Math.round((cents * basisPoints) / 10_000);
}

function nonNeg(n        )         {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * يحسب عرض سعر واحداً.
 *
 * الأطفال دون السادسة خارج الحساب تماماً: لا سرير ولا تذكرة ولا خدمة فردية.
 * ومن هم في السادسة فأكثر لهم سرير إضافي وتُحتسب عليهم التذاكر والخدمات.
 */
export function quote(input            )              {
  const adults = Math.max(1, nonNeg(input.adults));
  const childrenBed = nonNeg(input.childrenBed);
  const plan = planRooms(adults, childrenBed);
  const payingPax = plan.payingPax;
  const seasonPct = SEASON_PCT[input.season] ?? 100;

  const lines              = [];
  const add = (key        , label        , detail        , amount        )         => {
    if (amount > 0) lines.push({ key, label, detail, amount });
    return amount;
  };

  const hotelNights = nonNeg(input.hotelNights);
  const roomCost = nonNeg(input.hotelRate) * plan.rooms;
  const tripleCost = nonNeg(input.tripleExtra) * plan.triples;
  const hotel = add(
    'hotel',
    'الإقامة',
    `${money(input.hotelRate)} × ${plan.rooms} ${plan.rooms === 1 ? 'غرفة' : 'غرف'}` +
      (plan.triples ? ` + ${plan.triples} سرير إضافي` : '') +
      ` × ${hotelNights} ليلة` +
      (seasonPct === 100 ? '' : ` · موسم ${SEASON_LABEL[input.season]}`),
    pct((roomCost + tripleCost) * hotelNights, seasonPct),
  );

  const carDays = nonNeg(input.carDays);
  const car = add(
    'car',
    'المواصلات الداخلية',
    `${money(input.carRate)} × ${carDays} يوم`,
    nonNeg(input.carRate) * carDays,
  );

  const transferCount = nonNeg(input.transfers);
  const transfer = add(
    'transfer',
    'استقبال وتوديع المطار',
    `${transferCount} نقلة × ${money(input.transferRate)}`,
    nonNeg(input.transferRate) * transferCount,
  );

  const tourTotal = input.tours.reduce((sum, t) => sum + nonNeg(t.price), 0);
  const tours = add('tours', 'الجولات', `${input.tours.length} جولة`, tourTotal);

  const tickets = add(
    'tickets',
    'تذاكر الدخول',
    `${money(input.ticketPerPerson)} × ${payingPax} شخص`,
    nonNeg(input.ticketPerPerson) * payingPax,
  );

  const guideDays = nonNeg(input.guideDays);
  const guide = add(
    'guide',
    'مرشد عربي',
    `${guideDays} يوم × ${money(input.guideRate)}`,
    nonNeg(input.guideRate) * guideDays,
  );

  const extras = add(
    'extras',
    'خدمات إضافية',
    'شريحة اتصال · عشاء ترحيبي · متفرقات',
    (nonNeg(input.simPerPerson) + nonNeg(input.dinnerPerPerson)) * payingPax + nonNeg(input.miscTotal),
  );

  const cost = hotel + car + transfer + tours + tickets + guide + extras;

  // الأولوية: ثابت للحجز ← سياسة اليوم ← نسبة الفئة
  const fixed = nonNeg(input.marginFixed ?? 0);
  const perDay = nonNeg(input.marginPerDay ?? 0);
  const days = nonNeg(input.nights) + 1;
  const markup = fixed > 0 ? fixed : perDay > 0 ? perDay * days : pct(cost, Math.max(0, input.marginPct));
  const fees = bp(cost + markup, Math.max(0, input.feesBp));
  const beforeRounding = cost + markup + fees;

  const step = nonNeg(input.roundTo);
  const sell = step > 1 ? Math.ceil(beforeRounding / step) * step : beforeRounding;

  return {
    lines,
    plan,
    cost,
    markup,
    fees,
    rounding: sell - beforeRounding,
    sell,
    profit: sell - cost,
    perAdult: Math.round(sell / adults),
    deposit: pct(sell, Math.max(0, Math.min(100, input.depositPct))),
    payingPax,
  };
}

                            
                                             
                    
                                              
                      
                                              
                  
                                            
                         
                                          
                     
                     
 

                                                
             
                
                     
 

/**
 * يبني ثلاثة عروض من برنامج واحد بتبديل الفندق والسيارة والهامش فقط.
 * الجولات والأيام وعدد الأشخاص تبقى كما هي — نفس البرنامج، ثلاثة أسعار.
 *
 * الهامش الثابت (marginFixed) ينتقل من base إلى الفئات الثلاث بنفس الرقم
 * ويتقدّم على نسبة الفئة — «رقم ثابت» يعني رقماً واحداً لا ثلاثة.
 */
export function threeTiers(base            , rates                         )              {
  return (Object.keys(TIER_MARGIN_PCT)          ).map((tier) => {
    const r = rates[tier];
    const result = quote({
      ...base,
      hotelRate: r.hotelRate,
      tripleExtra: r.tripleExtra,
      carRate: r.carRate,
      guideDays: r.guideIncluded ? Math.max(base.guideDays, base.carDays) : base.guideDays,
      marginPct: r.marginPct ?? TIER_MARGIN_PCT[tier],
    });
    return { ...result, tier, label: TIER_LABEL[tier], hotelName: r.hotelName };
  });
}

/** يحوّل سنتات إلى نص بالدولار مثل `$1,240`. للعرض فقط، لا يُستخدم في الحساب. */
export function money(cents        , currency = 'USD')         {
  const symbols                         = { USD: '$', EUR: '€', SAR: 'ر.س ', TRY: '₺' };
  const sym = symbols[currency] ?? '';
  const whole = Math.round(cents / 100);
  return sym + whole.toLocaleString('en-US');
}

/** يحوّل مبلغاً مكتوباً بالدولار (مثل "85" أو "85.5") إلى سنتات صحيحة. */
export function toCents(amount                 )         {
  const n = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
