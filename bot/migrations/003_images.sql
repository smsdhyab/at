-- صور الوجهات: من مكتبة صور الموقع نفسه (853 صورة) لا من بنوك صور أجنبية.
-- hero_image: صورة الغلاف. gallery: مصفوفة JSON من روابط إضافية للشريط.
-- استُبعدت الصور التي عليها كتابة أو التي هي خرائط أو صور مولات.

alter table destinations add column hero_image text not null default '';
alter table destinations add column gallery    text not null default '[]';

update destinations set
  hero_image = 'https://alarabtravelers.com/wp-content/uploads/2022/06/%D8%B1%D9%8A%D8%B2%D8%A7-%D9%88-%D8%A7%D9%8A%D8%AF%D8%B1.jpg',
  gallery = '["https://alarabtravelers.com/wp-content/uploads/2022/06/%D8%A7%D9%8A%D8%AF%D8%B1-%D9%88%D8%A7%D8%AF%D9%8A-%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%AD.jpg","https://alarabtravelers.com/wp-content/uploads/2019/09/%D8%A7%D9%84%D8%B7%D9%82%D8%B3-%D9%81%D9%8A-%D8%B7%D8%B1%D8%A7%D8%A8%D8%B2%D9%88%D9%86-%D8%A7%D9%84%D8%B3%D9%8A%D8%A7%D8%AD%D8%A9-%D9%81%D9%8A-%D8%AA%D8%B1%D9%83%D9%8A%D8%A7-%D8%A7%D9%84%D9%85%D8%B3%D8%A7%D9%81%D8%B1%D9%88%D9%86-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8.jpg"]'
where slug = 'north';

update destinations set
  hero_image = 'https://alarabtravelers.com/wp-content/uploads/2020/06/%D8%A8%D8%B1%D9%86%D8%A7%D9%85%D8%AC-%D8%B3%D9%8A%D8%A7%D8%AD%D9%8A-%D9%81%D9%8A-%D8%A7%D8%B3%D8%B7%D9%86%D8%A8%D9%88%D9%84-%D9%84%D9%85%D8%AF%D8%A9-%D9%A5-%D8%A7%D9%8A%D8%A7%D9%85.jpg',
  gallery = '[]'
where slug = 'istanbul';

update destinations set
  hero_image = 'https://alarabtravelers.com/wp-content/uploads/2019/04/%D8%A7%D9%84%D9%85%D8%B3%D8%A7%D9%81%D8%B1%D9%88%D9%86-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8-%D8%A7%D9%84%D8%B3%D9%8A%D8%A7%D8%AD%D8%A9-%D9%81%D9%8A-%D8%AA%D8%B1%D9%83%D9%8A%D8%A7-%D9%83%D8%A7%D8%A8%D8%A7%D8%AF%D9%88%D9%83%D9%8A%D8%A7-1-1.jpg',
  gallery = '["https://alarabtravelers.com/wp-content/uploads/2019/04/%D9%81%D9%86%D8%AF%D9%82-%D8%A2%D8%B1%D9%88%D8%B3-%D9%81%D9%8A-%D9%85%D9%86%D8%B7%D9%82%D8%A9-%D9%83%D8%A7%D8%A8%D8%A7%D8%AF%D9%88%D9%83%D9%8A%D8%A7-12-.jpg"]'
where slug = 'cappadocia';

update destinations set
  hero_image = 'https://alarabtravelers.com/wp-content/uploads/2019/04/%D9%85%D8%B1%D9%85%D8%B1%D9%8A%D8%B3-%D8%AA%D8%B1%D9%83%D9%8A%D8%A7-%D8%A7%D9%84%D9%85%D8%B3%D8%A7%D9%81%D8%B1%D9%88%D9%86-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8-2.jpg',
  gallery = '["https://alarabtravelers.com/wp-content/uploads/2019/04/%D9%85%D8%B1%D9%85%D8%B1%D9%8A%D8%B3-%D8%AA%D8%B1%D9%83%D9%8A%D8%A7-%D8%A7%D9%84%D9%85%D8%B3%D8%A7%D9%81%D8%B1%D9%88%D9%86-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8-.jpg","https://alarabtravelers.com/wp-content/uploads/2019/09/Lake-K%C3%B6yce%C4%9Fiz-%D9%85%D9%88%D8%BA%D9%84%D8%A7-.jpg"]'
where slug = 'antalya';
