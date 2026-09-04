-- توسيع معرض الصور لكل وجهة.
-- المصدر الأول مكتبة صور الموقع نفسه، والنقص من ويكيميديا كومنز (مرخّصة
-- للاستعمال التجاري وتشترط ذكر المصدر — لذلك عمود image_credits).
-- كل الصور مناظر ومعالم بلا أشخاص، تحققت منها بصرياً قبل الإدراج.

alter table destinations add column image_credits text not null default '';

-- ================= الشمال التركي =================
update destinations set
  gallery = '[
    "https://alarabtravelers.com/wp-content/uploads/2022/06/%D8%A7%D9%8A%D8%AF%D8%B1-%D9%88%D8%A7%D8%AF%D9%8A-%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%AD.jpg",
    "https://alarabtravelers.com/wp-content/uploads/2019/09/%D8%A7%D9%84%D8%B7%D9%82%D8%B3-%D9%81%D9%8A-%D8%B7%D8%B1%D8%A7%D8%A8%D8%B2%D9%88%D9%86-%D8%A7%D9%84%D8%B3%D9%8A%D8%A7%D8%AD%D8%A9-%D9%81%D9%8A-%D8%AA%D8%B1%D9%83%D9%8A%D8%A7-%D8%A7%D9%84%D9%85%D8%B3%D8%A7%D9%81%D8%B1%D9%88%D9%86-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Sumela_From_Across_Valley.JPG/1600px-Sumela_From_Across_Valley.JPG",
    "https://alarabtravelers.com/wp-content/uploads/2019/09/ayder_yaylasi-%D8%A7%D9%8A%D8%AF%D8%B1-%D8%A7%D9%84%D8%B1%D8%A7%D8%A6%D8%B9%D8%A9-%D8%A7%D9%84%D9%85%D8%B3%D8%A7%D9%81%D8%B1%D9%88%D9%86-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8-%D8%A7%D9%84%D8%B3%D9%8A%D8%A7%D8%AD%D8%A9-%D9%81%D9%8A-%D8%AA%D8%B1%D9%83%D9%8A%D8%A7-1.jpg",
    "https://alarabtravelers.com/wp-content/uploads/2019/05/%D8%A8%D9%88%D8%B2%D8%AA%D8%A8%D9%87-%D9%81%D9%8A-%D8%B7%D8%B1%D8%A7%D8%A8%D8%B2%D9%88%D9%86.jpg"
  ]',
  image_credits = 'دير سوميلا: ويكيميديا كومنز — CC BY-SA'
where slug = 'north';

-- ================= اسطنبول =================
-- مكتبة الموقع تكاد تخلو من صور اسطنبول نظيفة، فأغلبها من كومنز
update destinations set
  hero_image = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Exterior_of_Sultan_Ahmed_I_Mosque_in_Istanbul%2C_Turkey_002.jpg/1600px-Exterior_of_Sultan_Ahmed_I_Mosque_in_Istanbul%2C_Turkey_002.jpg',
  gallery = '[
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Hagia_Sophia_Mars_2013.jpg/1600px-Hagia_Sophia_Mars_2013.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Sultan_Ahmed_Mosque_2022_2.jpg/1600px-Sultan_Ahmed_Mosque_2022_2.jpg",
    "https://alarabtravelers.com/wp-content/uploads/2020/06/%D8%A8%D8%B1%D9%86%D8%A7%D9%85%D8%AC-%D8%B3%D9%8A%D8%A7%D8%AD%D9%8A-%D9%81%D9%8A-%D8%A7%D8%B3%D8%B7%D9%86%D8%A8%D9%88%D9%84-%D9%84%D9%85%D8%AF%D8%A9-%D9%A5-%D8%A7%D9%8A%D8%A7%D9%85.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Istanbul_Hagia_Sophia_IMG_8615_2050.jpg/1600px-Istanbul_Hagia_Sophia_IMG_8615_2050.jpg"
  ]',
  image_credits = 'صور اسطنبول: ويكيميديا كومنز — CC BY-SA'
where slug = 'istanbul';

-- ================= كابادوكيا =================
update destinations set
  gallery = '[
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Cappadocia_Air_Balloon.jpg/1600px-Cappadocia_Air_Balloon.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Bagildere_Love_Valley_Cappadocia_1520259_60_61_Compressor_HDR_lvl_Nevit.jpg/1600px-Bagildere_Love_Valley_Cappadocia_1520259_60_61_Compressor_HDR_lvl_Nevit.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/G%C3%B6reme_Valley_in_Cappadocia_edit1.jpg/1600px-G%C3%B6reme_Valley_in_Cappadocia_edit1.jpg",
    "https://alarabtravelers.com/wp-content/uploads/2019/04/%D9%81%D9%86%D8%AF%D9%82-%D8%A2%D8%B1%D9%88%D8%B3-%D9%81%D9%8A-%D9%85%D9%86%D8%B7%D9%82%D8%A9-%D9%83%D8%A7%D8%A8%D8%A7%D8%AF%D9%88%D9%83%D9%8A%D8%A7-12-.jpg"
  ]',
  image_credits = 'صور كابادوكيا: ويكيميديا كومنز — CC BY-SA'
where slug = 'cappadocia';

-- ================= أنطاليا ومرمريس =================
update destinations set
  gallery = '[
    "https://alarabtravelers.com/wp-content/uploads/2019/04/%D9%85%D8%B1%D9%85%D8%B1%D9%8A%D8%B3-%D8%AA%D8%B1%D9%83%D9%8A%D8%A7-%D8%A7%D9%84%D9%85%D8%B3%D8%A7%D9%81%D8%B1%D9%88%D9%86-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8-.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Antalya_Harbour_East_side_%C4%B1n_2011_40.jpg/1600px-Antalya_Harbour_East_side_%C4%B1n_2011_40.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/The_Travertine_terraces_of_Pamukkale.jpg/1600px-The_Travertine_terraces_of_Pamukkale.jpg",
    "https://alarabtravelers.com/wp-content/uploads/2019/09/Lake-K%C3%B6yce%C4%9Fiz-%D9%85%D9%88%D8%BA%D9%84%D8%A7-.jpg"
  ]',
  image_credits = 'ميناء أنطاليا وباموكالي: ويكيميديا كومنز — CC BY-SA'
where slug = 'antalya';
