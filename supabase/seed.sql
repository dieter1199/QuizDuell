insert into public.categories (name, description)
values
  ('General Knowledge', 'Fast facts, science, history, and everyday trivia.'),
  ('Movies', 'Blockbusters, characters, directors, and famous scenes.'),
  ('Gaming', 'Consoles, franchises, studios, and game mechanics.'),
  ('Geography', 'Countries, landmarks, capitals, and world maps.')
on conflict (name) do update
set description = excluded.description;

insert into public.questions (category_id, prompt, answers, correct_answer_indexes, explanation, difficulty)
select c.id, seed.prompt, seed.answers::jsonb, seed.correct_answer_indexes, seed.explanation, seed.difficulty
from public.categories c
join (
  values
    ('General Knowledge', 'Which planet is known as the Red Planet?', '["Mars","Venus","Saturn"]', array[0], 'Mars looks red because its surface is rich in iron oxide.', 'easy'),
    ('General Knowledge', 'Which of these are prime numbers?', '["11","12","13"]', array[0,2], '11 and 13 are prime. 12 is divisible by 2, 3, 4, and 6.', 'medium'),
    ('General Knowledge', 'What gas do plants primarily absorb from the atmosphere?', '["Carbon dioxide","Oxygen","Helium"]', array[0], 'Photosynthesis relies on carbon dioxide, water, and sunlight.', 'easy'),
    ('General Knowledge', 'Which two colors mix to make green in traditional color theory?', '["Blue","Yellow","Red"]', array[0,1], 'Blue and yellow combine to make green.', 'easy'),
    ('General Knowledge', 'Which device measures atmospheric pressure?', '["Barometer","Thermometer","Altimeter"]', array[0], 'A barometer measures pressure, often used in weather forecasting.', 'medium'),
    ('General Knowledge', 'Which of these are programming languages?', '["Python","Ruby","Photoshop"]', array[0,1], 'Python and Ruby are languages. Photoshop is design software.', 'easy'),
    ('Movies', 'Which movie features the quote "I''ll be back"?', '["The Terminator","Die Hard","Predator"]', array[0], 'Arnold Schwarzenegger says it in The Terminator.', 'easy'),
    ('Movies', 'Which two movies were directed by Christopher Nolan?', '["Inception","Interstellar","Titanic"]', array[0,1], 'Titanic was directed by James Cameron.', 'medium'),
    ('Movies', 'What is the name of the kingdom in Frozen?', '["Arendelle","Agrabah","Atlantis"]', array[0], 'Elsa and Anna rule over Arendelle.', 'easy'),
    ('Movies', 'Which film won the Oscar for Best Picture for 2020 ceremony?', '["Parasite","1917","Joker"]', array[0], 'Parasite made history as the first non-English language winner.', 'hard'),
    ('Movies', 'Which two characters are part of the Guardians of the Galaxy team?', '["Gamora","Groot","Voldemort"]', array[0,1], 'Voldemort belongs to the Harry Potter series.', 'easy'),
    ('Movies', 'Which animated film is about emotions inside a child''s mind?', '["Inside Out","Soul","Coco"]', array[0], 'Pixar''s Inside Out personifies emotions such as Joy and Sadness.', 'easy'),
    ('Gaming', 'Which company created the Mario franchise?', '["Nintendo","Sega","Capcom"]', array[0], 'Mario has been Nintendo''s mascot for decades.', 'easy'),
    ('Gaming', 'Which two games are battle royale titles?', '["Fortnite","Apex Legends","Stardew Valley"]', array[0,1], 'Stardew Valley is a farming sim, not a battle royale.', 'easy'),
    ('Gaming', 'What color is the chaos emerald often associated with Sonic himself?', '["Blue","Green","Red"]', array[1], 'The standard emerald set includes green as the iconic central gem.', 'hard'),
    ('Gaming', 'Which franchise features the region of Hyrule?', '["The Legend of Zelda","Pokemon","Metroid"]', array[0], 'Hyrule is the recurring kingdom in Zelda games.', 'easy'),
    ('Gaming', 'Which two studios are first-party PlayStation studios?', '["Naughty Dog","Santa Monica Studio","343 Industries"]', array[0,1], '343 Industries is owned by Xbox.', 'medium'),
    ('Gaming', 'In Minecraft, which material is needed to craft a diamond pickaxe besides sticks?', '["Diamonds","Iron ingots","Copper"]', array[0], 'A diamond pickaxe uses 3 diamonds and 2 sticks.', 'easy'),
    ('Geography', 'What is the capital of Japan?', '["Tokyo","Kyoto","Osaka"]', array[0], 'Tokyo is Japan''s capital and largest city.', 'easy'),
    ('Geography', 'Which two countries share the Iberian Peninsula?', '["Spain","Portugal","Italy"]', array[0,1], 'Italy is on the Italian Peninsula.', 'medium'),
    ('Geography', 'Which river flows through Egypt?', '["Nile","Amazon","Danube"]', array[0], 'The Nile is central to Egyptian civilization.', 'easy'),
    ('Geography', 'Which continent is the Sahara Desert located on?', '["Africa","Asia","Australia"]', array[0], 'The Sahara stretches across North Africa.', 'easy'),
    ('Geography', 'Which two cities are national capitals?', '["Canberra","Ottawa","Sydney"]', array[0,1], 'Sydney is the largest Australian city, but not the capital.', 'medium'),
    ('Geography', 'Mount Kilimanjaro is located in which country?', '["Tanzania","Kenya","Uganda"]', array[0], 'Kilimanjaro is in northeastern Tanzania.', 'medium')
) as seed(category_name, prompt, answers, correct_answer_indexes, explanation, difficulty)
  on c.name = seed.category_name
on conflict (category_id, prompt) do update
set
  answers = excluded.answers,
  correct_answer_indexes = excluded.correct_answer_indexes,
  explanation = excluded.explanation,
  difficulty = excluded.difficulty;
