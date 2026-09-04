-- ويكيميديا لا تولّد كل عروض المصغّرات: 1600px يعيد 400 لهذه الملفات بينما
-- 1280px متوفّر دائماً. كل الروابط الخارجية تُصحَّح دفعة واحدة.
update destinations set
  hero_image = replace(hero_image, '/1600px-', '/1280px-'),
  gallery    = replace(gallery,    '/1600px-', '/1280px-')
where hero_image like '%1600px-%' or gallery like '%1600px-%';
