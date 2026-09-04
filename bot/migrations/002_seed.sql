-- بذرة البيانات — مولَّدة من القاعدة العاملة لا مكتوبة يدوياً.
-- الوجهات الأربع بصورها ومسارها ومعلوماتها، والفنادق والسيارات والجولات بأوصافها.

insert into destinations (slug, name, transfer_rate, ticket_pp, guide_rate, sort_order, hero_image, gallery, image_credits, route, practical) values
  ('north', 'الشمال التركي — طرابزون وأوزنجول وريزا', 4500, 1200, 7000, 1, 'https://alarabtravelers.com/wp-content/uploads/2022/06/%D8%B1%D9%8A%D8%B2%D8%A7-%D9%88-%D8%A7%D9%8A%D8%AF%D8%B1.jpg', '[
    "https://alarabtravelers.com/wp-content/uploads/2022/06/%D8%A7%D9%8A%D8%AF%D8%B1-%D9%88%D8%A7%D8%AF%D9%8A-%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%AD.jpg",
    "https://alarabtravelers.com/wp-content/uploads/2019/09/%D8%A7%D9%84%D8%B7%D9%82%D8%B3-%D9%81%D9%8A-%D8%B7%D8%B1%D8%A7%D8%A8%D8%B2%D9%88%D9%86-%D8%A7%D9%84%D8%B3%D9%8A%D8%A7%D8%AD%D8%A9-%D9%81%D9%8A-%D8%AA%D8%B1%D9%83%D9%8A%D8%A7-%D8%A7%D9%84%D9%85%D8%B3%D8%A7%D9%81%D8%B1%D9%88%D9%86-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Sumela_From_Across_Valley.JPG/1280px-Sumela_From_Across_Valley.JPG",
    "https://alarabtravelers.com/wp-content/uploads/2019/09/ayder_yaylasi-%D8%A7%D9%8A%D8%AF%D8%B1-%D8%A7%D9%84%D8%B1%D8%A7%D8%A6%D8%B9%D8%A9-%D8%A7%D9%84%D9%85%D8%B3%D8%A7%D9%81%D8%B1%D9%88%D9%86-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8-%D8%A7%D9%84%D8%B3%D9%8A%D8%A7%D8%AD%D8%A9-%D9%81%D9%8A-%D8%AA%D8%B1%D9%83%D9%8A%D8%A7-1.jpg",
    "https://alarabtravelers.com/wp-content/uploads/2019/05/%D8%A8%D9%88%D8%B2%D8%AA%D8%A8%D9%87-%D9%81%D9%8A-%D8%B7%D8%B1%D8%A7%D8%A8%D8%B2%D9%88%D9%86.jpg"
  ]', 'دير سوميلا: ويكيميديا كومنز — CC BY-SA', '[{"city":"طرابزون","weight":3},{"city":"أوزنجول","weight":2},{"city":"ريزا وايدر","weight":1}]', '{"best_time":"مايو إلى سبتمبر — الخضرة في ذروتها","weather":"18 – 26 مئوية صيفاً، أمطار متفرقة","currency":"الليرة التركية · الصرافة متوفرة في المطار والمدينة","flight":"3 – 5 ساعات من الخليج مع ترانزيت اسطنبول","pack":"جاكيت خفيف للمرتفعات · حذاء مريح للمشي · مظلة"}'),
  ('istanbul', 'اسطنبول', 5000, 2000, 7000, 2, 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Exterior_of_Sultan_Ahmed_I_Mosque_in_Istanbul%2C_Turkey_002.jpg/1280px-Exterior_of_Sultan_Ahmed_I_Mosque_in_Istanbul%2C_Turkey_002.jpg', '[
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Hagia_Sophia_Mars_2013.jpg/1280px-Hagia_Sophia_Mars_2013.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Sultan_Ahmed_Mosque_2022_2.jpg/1280px-Sultan_Ahmed_Mosque_2022_2.jpg",
    "https://alarabtravelers.com/wp-content/uploads/2020/06/%D8%A8%D8%B1%D9%86%D8%A7%D9%85%D8%AC-%D8%B3%D9%8A%D8%A7%D8%AD%D9%8A-%D9%81%D9%8A-%D8%A7%D8%B3%D8%B7%D9%86%D8%A8%D9%88%D9%84-%D9%84%D9%85%D8%AF%D8%A9-%D9%A5-%D8%A7%D9%8A%D8%A7%D9%85.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Istanbul_Hagia_Sophia_IMG_8615_2050.jpg/1280px-Istanbul_Hagia_Sophia_IMG_8615_2050.jpg"
  ]', 'صور اسطنبول: ويكيميديا كومنز — CC BY-SA', '[{"city":"اسطنبول — الجانب الأوروبي","weight":4},{"city":"اسطنبول — الجانب الآسيوي","weight":2}]', '{"best_time":"أبريل إلى يونيو وسبتمبر إلى نوفمبر","weather":"20 – 30 مئوية صيفاً، معتدل ربيعاً","currency":"الليرة التركية · البطاقات مقبولة في أغلب المحال","flight":"3 – 4 ساعات مباشرة من أغلب مدن الخليج","pack":"حذاء مريح — المدينة تُمشى · ملابس متوسطة"}'),
  ('cappadocia', 'كابادوكيا', 5500, 2500, 7500, 3, 'https://alarabtravelers.com/wp-content/uploads/2019/04/%D8%A7%D9%84%D9%85%D8%B3%D8%A7%D9%81%D8%B1%D9%88%D9%86-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8-%D8%A7%D9%84%D8%B3%D9%8A%D8%A7%D8%AD%D8%A9-%D9%81%D9%8A-%D8%AA%D8%B1%D9%83%D9%8A%D8%A7-%D9%83%D8%A7%D8%A8%D8%A7%D8%AF%D9%88%D9%83%D9%8A%D8%A7-1-1.jpg', '[
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Cappadocia_Air_Balloon.jpg/1280px-Cappadocia_Air_Balloon.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Bagildere_Love_Valley_Cappadocia_1520259_60_61_Compressor_HDR_lvl_Nevit.jpg/1280px-Bagildere_Love_Valley_Cappadocia_1520259_60_61_Compressor_HDR_lvl_Nevit.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/G%C3%B6reme_Valley_in_Cappadocia_edit1.jpg/1280px-G%C3%B6reme_Valley_in_Cappadocia_edit1.jpg",
    "https://alarabtravelers.com/wp-content/uploads/2019/04/%D9%81%D9%86%D8%AF%D9%82-%D8%A2%D8%B1%D9%88%D8%B3-%D9%81%D9%8A-%D9%85%D9%86%D8%B7%D9%82%D8%A9-%D9%83%D8%A7%D8%A8%D8%A7%D8%AF%D9%88%D9%83%D9%8A%D8%A7-12-.jpg"
  ]', 'صور كابادوكيا: ويكيميديا كومنز — CC BY-SA', '[{"city":"جوريمي","weight":3},{"city":"أورجوب","weight":2}]', '{"best_time":"أبريل إلى يونيو وسبتمبر إلى أكتوبر — أنسب للمناطيد","weather":"حار نهاراً وبارد ليلاً · فروق كبيرة","currency":"الليرة التركية","flight":"ساعة ونصف من اسطنبول","pack":"طبقات ملابس · جاكيت للفجر · واقٍ شمسي"}'),
  ('antalya', 'أنطاليا ومرمريس', 5000, 1800, 7000, 4, 'https://alarabtravelers.com/wp-content/uploads/2019/04/%D9%85%D8%B1%D9%85%D8%B1%D9%8A%D8%B3-%D8%AA%D8%B1%D9%83%D9%8A%D8%A7-%D8%A7%D9%84%D9%85%D8%B3%D8%A7%D9%81%D8%B1%D9%88%D9%86-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8-2.jpg', '[
    "https://alarabtravelers.com/wp-content/uploads/2019/04/%D9%85%D8%B1%D9%85%D8%B1%D9%8A%D8%B3-%D8%AA%D8%B1%D9%83%D9%8A%D8%A7-%D8%A7%D9%84%D9%85%D8%B3%D8%A7%D9%81%D8%B1%D9%88%D9%86-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8-.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Antalya_Harbour_East_side_%C4%B1n_2011_40.jpg/1280px-Antalya_Harbour_East_side_%C4%B1n_2011_40.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/The_Travertine_terraces_of_Pamukkale.jpg/1280px-The_Travertine_terraces_of_Pamukkale.jpg",
    "https://alarabtravelers.com/wp-content/uploads/2019/09/Lake-K%C3%B6yce%C4%9Fiz-%D9%85%D9%88%D8%BA%D9%84%D8%A7-.jpg"
  ]', 'ميناء أنطاليا وباموكالي: ويكيميديا كومنز — CC BY-SA', '[{"city":"أنطاليا","weight":4},{"city":"مرمريس","weight":2}]', '{"best_time":"مايو إلى أكتوبر — موسم البحر","weather":"28 – 35 مئوية صيفاً · بحر دافئ","currency":"الليرة التركية · المنتجعات تقبل الدولار","flight":"3 – 4 ساعات من الخليج","pack":"ملابس صيفية · واقٍ شمسي · حذاء بحر"}')
on conflict (slug) do nothing;

insert into hotels (destination, name, class, rate_normal, rate_high) values
  ('north', 'فندق 3 نجوم — طرابزون', '3', 5000, 5750),
  ('north', 'فندق 4 نجوم — طرابزون', '4', 8500, 9775),
  ('north', 'فندق 5 نجوم — طرابزون', '5', 14500, 16675),
  ('north', 'كوخ كيانا — ايدر', 'cabin', 12000, 13800),
  ('north', 'أكواخ على النهر — أوزنجول', 'cabin', 11000, 12650),
  ('istanbul', 'فندق 3 نجوم — الفاتح', '3', 6000, 6900),
  ('istanbul', 'فندق 4 نجوم — تقسيم', '4', 10000, 11500),
  ('istanbul', 'فندق 5 نجوم — شيشلي', '5', 18000, 20700),
  ('cappadocia', 'فندق 3 نجوم — جوريمي', '3', 6500, 7475),
  ('cappadocia', 'فندق 4 نجوم — أورجوب', '4', 10500, 12075),
  ('cappadocia', 'فندق كهفي 5 نجوم — جوريمي', '5', 17500, 20125),
  ('antalya', 'فندق 3 نجوم — لارا', '3', 7000, 8050),
  ('antalya', 'فندق 4 نجوم — كونيالتي', '4', 12000, 13800),
  ('antalya', 'منتجع 5 نجوم — بيليك', '5', 21000, 24150);

insert into cars (destination, kind, name, rate_day) values
  ('north', 'sedan', 'سيدان خاصة مع سائق', 7000),
  ('north', 'van', 'فان خاصة مع سائق', 9500),
  ('north', 'vip', 'فان VIP مع سائق', 15000),
  ('istanbul', 'sedan', 'سيدان خاصة مع سائق', 8000),
  ('istanbul', 'van', 'فان خاصة مع سائق', 11000),
  ('istanbul', 'vip', 'فان VIP مع سائق', 17000),
  ('cappadocia', 'sedan', 'سيدان خاصة مع سائق', 8000),
  ('cappadocia', 'van', 'فان خاصة مع سائق', 11000),
  ('cappadocia', 'vip', 'فان VIP مع سائق', 16500),
  ('antalya', 'sedan', 'سيدان خاصة مع سائق', 7500),
  ('antalya', 'van', 'فان خاصة مع سائق', 10500),
  ('antalya', 'vip', 'فان VIP مع سائق', 16000);

insert into tours (destination, name, price, sort_order, description) values
  ('antalya', 'جولة القوارب في الميناء القديم', 9500, 1, 'جولة بالقارب في الميناء القديم بين الخلجان والشواطئ الصخرية، مع وقت للسباحة في المياه الفيروزية.'),
  ('antalya', 'مدينة الأساطير Land of Legends', 16000, 2, 'يوم كامل في مدينة الأساطير: الألعاب المائية والعروض والمنطقة الترفيهية — الأنسب للعائلات بالأطفال.'),
  ('antalya', 'شلالات دودان وكورشونلو', 8500, 3, 'زيارة شلالات دودان العليا والسفلى وشلال كورشونلو داخل غابة صنوبر، مع ممرات مشي بين المياه والأشجار.'),
  ('antalya', 'جولة باموكالي يوم كامل', 17500, 4, 'يوم كامل في باموكالي: مدرجات الترافرتين البيضاء ومياهها الدافئة، ومدينة هيرابوليس الأثرية المجاورة.'),
  ('cappadocia', 'الجولة الحمراء — جوريمي', 11000, 1, 'الجولة الحمراء بين وديان جوريمي ومتحفها المفتوح، مع مشاهدة المداخن الجنية والكنائس المنحوتة في الصخر.'),
  ('cappadocia', 'الجولة الخضراء — وادي إهلارا', 12000, 2, 'الجولة الخضراء إلى وادي إهلارا ومدينة ديرينكويو الجوفية، مع المشي في الوادي بين الأشجار والنهر.'),
  ('cappadocia', 'سفاري ATV عند الغروب', 7000, 3, 'رحلة سفاري بعربات ATV بين الوديان عند الغروب، حيث تكتسب الصخور ألواناً ذهبية في آخر النهار.'),
  ('cappadocia', 'منطاد الهواء الساخن — سعر شخصين', 38000, 4, 'رحلة المنطاد عند الفجر فوق وديان كابادوكيا — أشهر تجربة في تركيا. تخضع للأحوال الجوية ويُعاد المبلغ عند الإلغاء.'),
  ('istanbul', 'جولة المدينة القديمة — السلطان أحمد', 10000, 1, 'جولة في قلب اسطنبول التاريخي: ميدان السلطان أحمد والجامع الأزرق وآيا صوفيا وقصر توبكابي، مع وقت في البازار المسقوف.'),
  ('istanbul', 'رحلة البوسفور بالقارب', 11000, 2, 'رحلة بالقارب على مضيق البوسفور بين ضفتي المدينة، مع مشاهدة القصور العثمانية والقلاع والجسور من الماء.'),
  ('istanbul', 'الجانب الآسيوي والعمالية', 9500, 3, 'عبور إلى الجانب الآسيوي وزيارة تلة العمالية بإطلالتها الشهيرة على المدينة، مع جولة في أسواق كاديكوي.'),
  ('istanbul', 'جزر الأميرات', 12000, 4, 'رحلة بحرية إلى جزر الأميرات حيث لا سيارات، وتجوال بين البيوت الخشبية العثمانية والشوارع الهادئة.'),
  ('istanbul', 'جولة بورصة يوم كامل', 18000, 5, 'يوم كامل في مدينة بورصة العثمانية: جبل أولوداغ بالتلفريك، والجامع الكبير، وشجرة الأعوام السبعمئة في جومليك.'),
  ('istanbul', 'جولة صبنجة ومعشوقية', 15000, 6, 'يوم في بحيرة صبنجة وغابات معشوقية: نزهة على ضفاف البحيرة، وشلالات معشوقية، وركوب الخيل لمن يرغب.'),
  ('north', 'جولة أوزنجول وحيدر نبي', 9000, 1, 'انطلاق صباحي عبر الطريق الجبلي إلى بحيرة أوزنجول، وقت للتجوال حول البحيرة وتناول الشاي في المقاهي المطلّة، ثم صعود إلى مرتفعات حيدر نبي لمشاهدة بحر السحاب.'),
  ('north', 'جولة مرتفعات ايدر', 11000, 2, 'صعود إلى مرتفعات ايدر الخضراء حيث المراعي والشلالات وبيوت الجبل الخشبية، مع توقف عند الشلالات ووقت للاستمتاع بالهواء الجبلي.'),
  ('north', 'دير سوميلا ومدينة طرابزون', 10000, 3, 'زيارة دير سوميلا المعلّق على سفح الجبل وهو أشهر معالم البحر الأسود، ثم جولة في مدينة طرابزون تشمل ساحة المدينة والأسواق القديمة.'),
  ('north', 'جولة ريزا وشلال جيلال', 9500, 4, 'جولة في ولاية ريزا موطن الشاي التركي، مع زيارة شلال جيلال ومزارع الشاي المتدرّجة على المنحدرات وإطلالاتها الخضراء.'),
  ('north', 'جولة زيغانا وحمام سو', 9000, 5, 'عبور مرتفعات زيغانا وغاباتها الكثيفة، مع توقف عند المناظر البانورامية وزيارة منطقة حمام سو ذات الطبيعة البكر.');
