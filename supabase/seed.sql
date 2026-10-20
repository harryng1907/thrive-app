-- =====================================================================
-- POOL — demo data. Run after schema.sql. Safe to re-run.
--   • 11 public campus venues
--   • 26 activity cards (8 real weekly sessions + 18 interest cards)
--   • 3 demo logins (maya/alex/sam @pool.demo) — real accounts, start empty
--   • 30 simulated students (is_seed) with courses, free times and past swipes
-- =====================================================================

-- Remove previous demo data (cascades to profiles, swipes, squads, ratings).
delete from auth.users where email ilike '%@pool.demo';
delete from public.activities;
delete from public.venues;

-- ---------------------------------------------------------------------
-- Venues
-- ---------------------------------------------------------------------
insert into public.venues (id, name, detail, category) values
  ('lawlib-l2',   'Law Library, Level 2',        'Silent study booths',        'quiet'),
  ('mainlib-l3',  'Main Library, Level 3',       'Bookable group pods',        'quiet'),
  ('mainlib-l4',  'Main Library, Level 4',       'Quiet zone · Pod 4B',        'quiet'),
  ('k17-lab',     'Computing Building, Ground Floor', 'Lab benches',            'quiet'),
  ('roundhouse',  'Student Bar',                 'Beer garden tables',         'social'),
  ('library-lawn','Library Lawn',                'Under the big fig tree',     'social'),
  ('ufac',        'Campus Sports Centre',       'Sports hall, courts 1–3',   'active'),
  ('makerspace',  'Engineering Makerspace',     'Workbenches & laser cutter','maker'),
  ('quad-food',   'Quadrangle Food Court',       'Upstairs window tables',     'food'),
  ('gongcha',     'Bubble tea, Upper Campus',   'Corner booth',               'food'),
  ('esmes',       'Campus Café, Student Hub',   'Couches by the window',      'food');

-- ---------------------------------------------------------------------
-- Activities (sessions recur weekly; get_deck rolls past ones forward)
-- ---------------------------------------------------------------------
insert into public.activities
  (id, kind, squad_type, title, description, course, category, tags, icon, duration_mins, venue_id, starts_at, capacity)
values
  -- Real sessions: fixed time + place
  ('comp1511-a2', 'session', 'deadline', 'COMP1511 Assignment 2 grind',
   'Linked lists and pointers. Silent sprint with a 10-minute debug check every hour.',
   'COMP1511', 'quiet', '{COMP1511,quiet focus,first years,assignment}', 'code-slash', 180,
   'lawlib-l2', public.pool_next_slot(4, 14), 4),
  ('math1081-quiz', 'session', 'deadline', 'MATH1081 lab quiz sprint',
   'Set theory, proofs and modular arithmetic past questions before the Friday quiz.',
   'MATH1081', 'quiet', '{MATH1081,problem solving,first years}', 'calculator', 120,
   'mainlib-l3', public.pool_next_slot(5, 11), 4),
  ('desn1000-build', 'session', 'deadline', 'DESN1000 prototype build',
   'Laser cutting, 3D-print tolerance checks and putting the thing together.',
   'DESN1000', 'maker', '{DESN1000,hands-on,building}', 'construct', 180,
   'makerspace', public.pool_next_slot(1, 15), 4),
  ('comp1531-standup', 'session', 'deadline', 'COMP1531 project pair-debug',
   'Bring your failing tests. Pair up and get the pipeline green.',
   'COMP1531', 'quiet', '{COMP1531,pair programming,group project}', 'git-branch', 120,
   'k17-lab', public.pool_next_slot(3, 13), 4),
  ('econ1101-papers', 'session', 'deadline', 'ECON1101 midterm past papers',
   'Two past papers, timed, then compare answers.',
   'ECON1101', 'quiet', '{ECON1101,exam prep,first years}', 'trending-up', 150,
   'mainlib-l4', public.pool_next_slot(1, 10), 4),
  ('badminton', 'session', 'hobby', 'Casual badminton, no skill needed',
   'Racquets provided. Nobody is keeping score.',
   null, 'active', '{badminton,sport,beginner friendly}', 'tennisball', 90,
   'ufac', public.pool_next_slot(2, 17), 4),
  ('trivia-night', 'session', 'hobby', 'Roundhouse trivia team',
   'Wednesday trivia. You need a team of four and we have three.',
   null, 'social', '{trivia,social,chill}', 'help-circle', 120,
   'roundhouse', public.pool_next_slot(3, 18), 4),
  ('resume-roast', 'session', 'career', 'Résumé swap before internship apps',
   'Swap résumés, give honest feedback, leave with one fix each.',
   null, 'food', '{internships,career,feedback}', 'document-text', 60,
   'quad-food', public.pool_next_slot(4, 12), 4),

  -- Interest cards: no fixed time, the matcher finds one
  ('late-night-lib', 'interest', 'deadline', 'Late-night library grinding',
   'Headphones on, heads down, snacks shared.',
   null, 'quiet', '{library,quiet focus,night owl}', 'moon', 180, null, null, 4),
  ('lofi-cowork', 'interest', 'deadline', 'Lofi + silent co-working',
   'Same table, separate work, nobody has to talk.',
   null, 'quiet', '{quiet focus,lofi,library}', 'headset', 120, null, null, 4),
  ('comp1511-lab', 'interest', 'deadline', 'COMP1511 lab exercise catch-up',
   'Behind on labs? Same. Let''s clear them together.',
   'COMP1511', 'quiet', '{COMP1511,first years,pair programming}', 'laptop', 120, null, null, 4),
  ('math1131-explain', 'interest', 'deadline', 'MATH1131 explain-it-back',
   'Take turns explaining one topic each. Best way to actually learn it.',
   'MATH1131', 'quiet', '{MATH1131,problem solving,first years}', 'school', 120, null, null, 4),
  ('leetcode', 'interest', 'career', 'LeetCode practice for internships',
   'One medium problem, 30 minutes, then talk through solutions.',
   null, 'quiet', '{internships,coding interview,career}', 'terminal', 90, null, null, 4),
  ('coffee-internships', 'interest', 'career', 'Coffee chat: software internships',
   'Who''s applied where, what the interviews were like.',
   null, 'food', '{internships,career,chill}', 'cafe', 60, null, null, 4),
  ('startup-ideas', 'interest', 'career', 'Startup ideas brainstorm',
   'Bring one half-baked idea. Leave with three.',
   null, 'food', '{startups,career,building}', 'bulb', 90, null, null, 4),
  ('hackathon', 'interest', 'career', 'Find a hackathon team',
   'Looking for people to build something over a weekend.',
   null, 'maker', '{hackathon,building,coding interview}', 'rocket', 120, null, null, 4),
  ('boba', 'interest', 'hobby', 'Boba after class',
   'Low effort, high sugar.',
   null, 'food', '{boba,chill,social}', 'ice-cream', 60, null, null, 4),
  ('matcha-reading', 'interest', 'hobby', 'Quiet reading + matcha',
   'Bring a book that isn''t for uni.',
   null, 'food', '{reading,quiet focus,matcha}', 'book', 90, null, null, 4),
  ('gym-beginners', 'interest', 'hobby', 'Gym buddy for beginners',
   'Nobody knows what they''re doing. That''s fine.',
   null, 'active', '{gym,sport,beginner friendly}', 'barbell', 60, null, null, 4),
  ('run-club', 'interest', 'hobby', 'Slow-pace run club',
   'Conversational pace. Walking breaks allowed.',
   null, 'active', '{running,outdoors,beginner friendly}', 'walk', 60, null, null, 4),
  ('board-games', 'interest', 'hobby', 'Board games at the Roundhouse',
   'Catan, Codenames, whatever''s on the shelf.',
   null, 'social', '{board games,social,chill}', 'dice', 120, null, null, 4),
  ('sketching', 'interest', 'hobby', 'Sketching on the Library Lawn',
   'Pencils provided. Skill not required.',
   null, 'social', '{art,outdoors,chill}', 'brush', 90, null, null, 4),
  ('photo-walk', 'interest', 'hobby', 'Photo walk around campus',
   'Phones are fine. Find the best angle of the Quad.',
   null, 'social', '{photography,outdoors,chill}', 'camera', 60, null, null, 4),
  ('language-exchange', 'interest', 'hobby', 'Language exchange: Mandarin / English',
   'Half the time in each language.',
   null, 'food', '{language,social,chill}', 'chatbubbles', 60, null, null, 4),
  ('anime-night', 'interest', 'hobby', 'Anime watch party',
   'Two episodes, snacks, opinions.',
   null, 'social', '{anime,social,chill}', 'tv', 120, null, null, 4),
  ('bouldering', 'interest', 'hobby', 'Bouldering for beginners',
   'Short climbs, lots of sitting around chatting.',
   null, 'active', '{climbing,sport,beginner friendly}', 'fitness', 90, null, null, 4);

-- Society events. "Don't go alone — go as a squad." Society names are made-up
-- examples (no real society has partnered with us yet).
insert into public.activities
  (id, kind, squad_type, title, description, course, category, tags, icon, duration_mins, venue_id, starts_at, capacity, host)
values
  ('soc-byte-games', 'session', 'hobby', 'Games night',
   'Mario Kart, Jackbox and too much pizza. Walk in with your squad, not alone.',
   null, 'social', '{board games,social,chill}', 'game-controller', 150,
   'roundhouse', public.pool_next_slot(4, 15), 4, 'Byte Club'),
  ('soc-boba-crawl', 'session', 'hobby', 'Boba crawl: 3 shops, 1 afternoon',
   'Rate every drink. Strong opinions encouraged.',
   null, 'food', '{boba,social,chill}', 'ice-cream', 90,
   'gongcha', public.pool_next_slot(2, 15), 4, 'Boba Appreciation Society'),
  ('soc-coastal-walk', 'session', 'hobby', 'Coastal walk: Coogee to Bondi',
   'Easy pace, lots of photo stops. Meet on the Library Lawn, bus together.',
   null, 'social', '{outdoors,running,photography}', 'walk', 180,
   'library-lawn', public.pool_next_slot(6, 10), 4, 'Hike & Seek'),
  ('soc-board-guild', 'session', 'hobby', 'Beginners'' table: learn a new board game',
   'Someone teaches, nobody needs to know the rules.',
   null, 'food', '{board games,chill,social}', 'dice', 120,
   'esmes', public.pool_next_slot(3, 17), 4, 'Board Game Guild'),
  ('soc-film-night', 'session', 'hobby', 'Outdoor screening: Spirited Away',
   'Bring a blanket. Popcorn provided.',
   null, 'social', '{anime,chill,outdoors}', 'film', 120,
   'library-lawn', public.pool_next_slot(4, 16), 4, 'Reel Film Society'),
  ('soc-pitch-night', 'session', 'career', 'Pitch night: 2-minute ideas',
   'Watch student founders pitch, then grab a drink and talk ideas.',
   null, 'social', '{startups,career,building}', 'bulb', 120,
   'roundhouse', public.pool_next_slot(3, 18), 4, 'Startup Circle'),
  ('soc-wit-qa', 'session', 'career', 'Internship Q&A with final-years',
   'How they got their internships, what they''d do differently.',
   null, 'food', '{internships,career,coding interview}', 'briefcase', 90,
   'quad-food', public.pool_next_slot(4, 13), 4, 'Women in Tech Circle');

-- ---------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------
-- avail entries are 'dow:start-end' in Sydney time (0 = Sun … 6 = Sat).
create temp table _people (
  email text, password text, is_seed boolean,
  display_name text, full_name text, degree text, degree_short text, year int,
  avatar_color text, group_pref text, courses text[], avail text[], says_yes text[],
  vibe text, status_quote text, joined_days_ago int
) on commit drop;

insert into _people values
-- Demo logins (real accounts, no swipes yet)
('maya@pool.demo', 'pool-demo-2026', false, 'Maya', 'Maya Lin', 'Software Engineering', 'SENG', 1, '#F57C2A', 'small',
 '{COMP1511,MATH1081,DESN1000}', '{1:10-13,2:14-18,4:13-18,6:10-16}', '{}',
 'Law Lib Level 2 silent booths, iced matcha, lofi', 'Locked in for the A2 stage 3 tests 🎯', 0),
('alex@pool.demo', 'pool-demo-2026', false, 'Alex', 'Alex Nguyen', 'Computer Science', 'CS', 1, '#0EA5E9', 'one',
 '{COMP1511,MATH1131}', '{2:15-20,3:10-14,5:12-17,0:10-15}', '{}',
 'Would rather play a sport than talk about one', 'Bring a spare racquet pls 🏸', 0),
('sam@pool.demo', 'pool-demo-2026', false, 'Sam', 'Sam Patel', 'Commerce / Computer Science', 'COMM', 2, '#16A34A', 'any',
 '{COMP1531,ECON1101}', '{1:9-13,3:12-21,4:11-15,5:16-21}', '{}',
 'Trivia, startups, anything with a whiteboard', 'Ask me about my 14 abandoned side projects', 0),

-- Simulated students
('mei@pool.demo', 'x', true, 'Mei', 'Mei Chen', 'Computer Science', 'CS', 1, '#0E5B66', 'small',
 '{COMP1511,MATH1081}', '{2:13-18,4:12-18,5:10-14,6:10-15}', '{comp1511-a2,lofi-cowork,late-night-lib,math1081-quiz,boba,matcha-reading}',
 'Back corner of the library, headphones on, don''t talk to me', 'Bringing my pointers diagram cheat sheet 📝', 12),
('tomas@pool.demo', 'x', true, 'Tomas', 'Tomas Kowalski', 'Data Science', 'DS', 1, '#2563EB', 'any',
 '{COMP1511,MATH1131}', '{2:10-14,4:14-18,6:11-17}', '{comp1511-a2,comp1511-lab,gym-beginners,hackathon}',
 'Coffee first, then debugging', 'Has the VS Code debugger set up & coffee ☕', 10),
('priya@pool.demo', 'x', true, 'Priya', 'Priya Sharma', 'Computer Science', 'CS', 3, '#9333EA', 'small',
 '{COMP3311,COMP2521}', '{3:10-15,4:13-18,6:12-16}', '{comp1511-a2,leetcode,coffee-internships,resume-roast}',
 'Third year. I like explaining things until they click', 'Did COMP1511 two years ago — ask me anything 🙂', 30),
('jordan@pool.demo', 'x', true, 'Jordan', 'Jordan Lee', 'Software Engineering', 'SENG', 1, '#DC2626', 'small',
 '{COMP1511,MATH1081}', '{1:9-12,3:13-18,5:9-13}', '{comp1511-a2,math1081-quiz,late-night-lib}',
 'Night owl, energy drink, mechanical keyboard', 'Will explain recursion with a diagram nobody asked for', 8),
('kenji@pool.demo', 'x', true, 'Kenji', 'Kenji Watanabe', 'Mechanical Engineering', 'MECH', 1, '#EA580C', 'one',
 '{ENGG1000,MATH1131}', '{2:16-20,5:12-17,0:10-14}', '{badminton,gym-beginners,run-club,bouldering}',
 'Sport > gym > anything indoors', 'Played badminton in high school, very rusty', 15),
('aisha@pool.demo', 'x', true, 'Aisha', 'Aisha Rahman', 'Medicine', 'MED', 2, '#BE185D', 'small',
 '{PSYC1001,BABS1201}', '{1:12-17,3:14-19,6:9-13}', '{matcha-reading,sketching,boba,lofi-cowork}',
 'Quiet cafés, long reads, lots of tea', 'Reading Pachinko for the third time', 20),
('lucas@pool.demo', 'x', true, 'Lucas', 'Lucas Silva', 'Commerce', 'COMM', 1, '#0891B2', 'any',
 '{ECON1101,ACCT1501}', '{1:9-14,3:12-20,5:15-21}', '{econ1101-papers,trivia-night,board-games,startup-ideas}',
 'Group study, then the Roundhouse', 'Ready to lose at trivia with dignity', 18),
('hana@pool.demo', 'x', true, 'Hana', 'Hana Kim', 'Design', 'DESN', 1, '#DB2777', 'small',
 '{DESN1000,ARTS1090}', '{1:14-19,3:10-14,6:10-16}', '{desn1000-build,sketching,photo-walk,boba}',
 'Makerspace rat, sketchbook always in bag', 'Knows how the laser cutter works (mostly)', 9),
('oliver@pool.demo', 'x', true, 'Oliver', 'Oliver Brown', 'Mechatronics', 'MTRN', 1, '#4F46E5', 'small',
 '{DESN1000,ENGG1000,MATH1131}', '{1:13-19,4:9-13,5:13-17}', '{desn1000-build,hackathon,bouldering}',
 'Build first, read the instructions later', 'Bringing calipers and spare M3 screws 🔩', 14),
('zara@pool.demo', 'x', true, 'Zara', 'Zara Ahmed', 'Computer Science', 'CS', 2, '#7C3AED', 'any',
 '{COMP1531,COMP2521}', '{3:12-18,4:10-14,1:10-13}', '{comp1531-standup,leetcode,hackathon,coffee-internships}',
 'Pair programming is the only programming', 'Our pipeline is green and I intend to keep it that way', 25),
('ethan@pool.demo', 'x', true, 'Ethan', 'Ethan Tran', 'Software Engineering', 'SENG', 2, '#059669', 'small',
 '{COMP1531,MATH1231}', '{3:12-17,5:10-15,2:13-17}', '{comp1531-standup,late-night-lib,anime-night}',
 'Headphones, lofi, late nights', 'Has opinions about tabs vs spaces', 22),
('sofia@pool.demo', 'x', true, 'Sofia', 'Sofia Rossi', 'Arts / Law', 'LAW', 1, '#C2410C', 'small',
 '{ARTS1090,LAWS1052}', '{2:10-15,4:15-20,6:11-15}', '{matcha-reading,language-exchange,photo-walk,boba}',
 'Bookshops, gelato, people-watching', 'Learning Mandarin badly but enthusiastically', 16),
('daniel@pool.demo', 'x', true, 'Daniel', 'Daniel Park', 'Computer Science', 'CS', 1, '#1D4ED8', 'one',
 '{COMP1511,MATH1131}', '{2:15-19,4:9-12,0:12-17}', '{comp1511-lab,badminton,leetcode}',
 'One-on-one, quiet, focused', 'Fast typer, slow talker', 7),
('chloe@pool.demo', 'x', true, 'Chloe', 'Chloe Martin', 'Psychology', 'PSYC', 1, '#E11D48', 'small',
 '{PSYC1001,PSYC1011}', '{1:10-15,3:15-20,5:11-16}', '{boba,board-games,anime-night,sketching}',
 'Board games and overthinking', 'Will bring Codenames', 11),
('arjun@pool.demo', 'x', true, 'Arjun', 'Arjun Mehta', 'Commerce / CS', 'COMM', 2, '#0F766E', 'any',
 '{COMP1531,ECON1101,ACCT1501}', '{1:9-13,3:12-21,4:11-15}', '{startup-ideas,trivia-night,coffee-internships,econ1101-papers}',
 'Always building something', 'Pitching you my startup in 30 seconds', 28),
('ella@pool.demo', 'x', true, 'Ella', 'Ella Nguyen', 'Computer Science', 'CS', 1, '#A21CAF', 'small',
 '{COMP1511,MATH1081}', '{1:10-13,5:10-14,6:10-16}', '{math1081-quiz,comp1511-lab,lofi-cowork,boba}',
 'Library L3 pods with snacks', 'Has every MATH1081 past paper printed', 6),
('ben@pool.demo', 'x', true, 'Ben', 'Ben Taylor', 'Civil Engineering', 'CVEN', 1, '#65A30D', 'any',
 '{ENGG1000,MATH1131}', '{2:15-20,3:16-21,0:9-13}', '{badminton,run-club,gym-beginners,trivia-night}',
 'Anything outdoors', 'Training for my first 5k 🏃', 13),
('linh@pool.demo', 'x', true, 'Linh', 'Linh Pham', 'Data Science', 'DS', 2, '#0369A1', 'small',
 '{MATH1231,COMP2521}', '{1:12-17,4:9-13,6:13-17}', '{leetcode,math1131-explain,lofi-cowork}',
 'Whiteboard + markers + quiet', 'Explains proofs with too many colours', 19),
('noah@pool.demo', 'x', true, 'Noah', 'Noah Williams', 'Software Engineering', 'SENG', 1, '#B45309', 'small',
 '{COMP1511,MATH1131}', '{2:13-18,4:13-18,6:12-16}', '{comp1511-lab,hackathon,anime-night,boba}',
 'Discord, debugging, dumplings', 'Will share my snacks if you share your test cases', 5),
('isla@pool.demo', 'x', true, 'Isla', 'Isla Wilson', 'Fine Arts', 'ARTS', 2, '#9D174D', 'small',
 '{ARTS1090,DESN1000}', '{1:13-18,3:9-13,6:10-14}', '{sketching,photo-walk,desn1000-build,matcha-reading}',
 'Galleries, film cameras, long walks', 'Film camera in my bag at all times 📷', 24),
('ryan@pool.demo', 'x', true, 'Ryan', 'Ryan Wong', 'Computer Science', 'CS', 1, '#155E75', 'any',
 '{COMP1511,MATH1081}', '{1:10-14,3:13-18,5:10-13}', '{late-night-lib,comp1511-lab,leetcode,board-games}',
 'Late nights, cold brew', 'Writes his notes in Markdown', 4),
('grace@pool.demo', 'x', true, 'Grace', 'Grace Liu', 'Accounting', 'ACCT', 1, '#C026D3', 'small',
 '{ACCT1501,ECON1101}', '{1:9-13,3:14-19,5:12-16}', '{econ1101-papers,language-exchange,boba}',
 'Spreadsheets and bubble tea', 'Colour-codes everything', 17),
('mateo@pool.demo', 'x', true, 'Mateo', 'Mateo García', 'Exercise Science', 'EXSC', 1, '#16A34A', 'one',
 '{PHSL2101,BABS1201}', '{2:16-20,4:7-11,0:10-15}', '{gym-beginners,run-club,badminton,bouldering}',
 'Gym at 7am, smoothie at 8', 'Will show you how the leg press works', 21),
('ava@pool.demo', 'x', true, 'Ava', 'Ava Thompson', 'Media', 'MDIA', 1, '#EA580C', 'small',
 '{MDIA1002,ARTS1090}', '{2:11-16,4:14-19,6:10-15}', '{photo-walk,anime-night,sketching,boba}',
 'Film photography and bad horror movies', 'Has seen every Ghibli film at least twice', 3),
('hassan@pool.demo', 'x', true, 'Hassan', 'Hassan Ali', 'Computer Science', 'CS', 3, '#0D9488', 'any',
 '{COMP3900,COMP3311}', '{2:12-16,3:12-17,4:12-16}', '{leetcode,coffee-internships,resume-roast,comp1531-standup}',
 'Interned at a startup last summer, happy to share', 'Has opinions on every big tech interview loop', 35),
('ruby@pool.demo', 'x', true, 'Ruby', 'Ruby Clarke', 'Commerce', 'COMM', 2, '#BE123C', 'small',
 '{ECON1101,MGMT1001}', '{3:13-19,4:11-16,1:10-13}', '{resume-roast,coffee-internships,startup-ideas,trivia-night}',
 'Career fairs and good coffee', 'Rewrote my résumé 11 times this term', 26),
('kai@pool.demo', 'x', true, 'Kai', 'Kai Yamamoto', 'Software Engineering', 'SENG', 1, '#2563EB', 'one',
 '{COMP1511,MATH1131}', '{2:15-19,5:12-16,0:11-15}', '{badminton,comp1511-lab,bouldering}',
 'Quiet, prefers one-on-one', 'Keyboard warrior, literally (I build keyboards)', 2),
('nadia@pool.demo', 'x', true, 'Nadia', 'Nadia Haddad', 'Law', 'LAW', 1, '#7E22CE', 'small',
 '{LAWS1052,ARTS1090}', '{2:10-14,4:14-19,6:9-13}', '{matcha-reading,late-night-lib,language-exchange}',
 'Law Library is my second home', 'Knows which Law Lib booths have working plugs', 23),
('leo@pool.demo', 'x', true, 'Leo', 'Leo Fischer', 'Physics', 'PHYS', 2, '#4338CA', 'any',
 '{MATH1231,PHYS1121}', '{1:13-18,3:9-13,5:13-18}', '{math1131-explain,board-games,bouldering,run-club}',
 'Puzzles, climbing, more puzzles', 'Brought a Rubik''s cube, will solve it while you study', 27),
('sienna@pool.demo', 'x', true, 'Sienna', 'Sienna Bose', 'Computer Science', 'CS', 1, '#DB2777', 'small',
 '{COMP1511,MATH1081}', '{1:10-14,4:9-13,5:10-14}', '{math1081-quiz,lofi-cowork,matcha-reading}',
 'Pomodoro 50/10, strictly enforced', 'Timer is already running ⏱️', 1),
('jack@pool.demo', 'x', true, 'Jack', 'Jack O''Brien', 'Commerce', 'COMM', 1, '#CA8A04', 'any',
 '{ECON1101,ACCT1501}', '{3:15-21,5:16-21,1:10-14}', '{trivia-night,board-games,boba,econ1101-papers}',
 'Social study: talk, snack, eventually study', 'Captain of a trivia team that has never won', 12);

alter table _people add column id uuid default gen_random_uuid();
update _people set id = gen_random_uuid() where id is null;

-- Auth accounts (the trigger creates a basic profile row for each).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
       extensions.crypt(case when is_seed then gen_random_uuid()::text else password end, extensions.gen_salt('bf')),
       now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('name', full_name),
       now() - make_interval(days => joined_days_ago), now(), '', '', '', ''
from _people;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text,
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       'email', now(), now(), now()
from _people;

update public.profiles p set
  display_name = x.display_name,
  full_name    = x.full_name,
  initials     = upper(left(x.display_name, 1) || left(split_part(x.full_name, ' ', 2), 1)),
  avatar_color = x.avatar_color,
  degree       = x.degree,
  degree_short = x.degree_short,
  year         = x.year,
  vibe         = x.vibe,
  status_quote = x.status_quote,
  group_pref   = x.group_pref,
  is_seed      = x.is_seed,
  onboarded_at = now() - make_interval(days => x.joined_days_ago),
  created_at   = now() - make_interval(days => x.joined_days_ago)
from _people x where x.id = p.id;

insert into public.profile_courses (user_id, course)
select id, unnest(courses) from _people;

insert into public.availability (user_id, dow, start_hour, end_hour)
select id,
       split_part(slot, ':', 1)::int,
       split_part(split_part(slot, ':', 2), '-', 1)::int,
       split_part(split_part(slot, ':', 2), '-', 2)::int
from _people, unnest(avail) as slot;

insert into public.swipes (user_id, activity_id, decision, created_at)
select id, act, 'in', now() - make_interval(hours => (random() * 24 * 10)::int)
from _people, unnest(says_yes) as act;

-- Hobbies: what the demo accounts picked in onboarding; simulated students' come from what they said yes to.
update public.profiles p set interests = x.i
from (values
  ('maya@pool.demo', '{quiet focus,library,matcha,lofi,boba}'::text[]),
  ('alex@pool.demo', '{badminton,sport,gym,beginner friendly}'::text[]),
  ('sam@pool.demo',  '{trivia,startups,board games,social}'::text[])
) x(email, i), _people pe
where pe.email = x.email and p.id = pe.id;

update public.profiles p set interests = coalesce((
  select array_agg(distinct t) from (
    select unnest(a.tags) t from public.swipes s join public.activities a on a.id = s.activity_id
    where s.user_id = p.id and s.decision = 'in'
  ) z where t !~ '^[A-Z]{4}[0-9]{4}$' and t not in ('first years','assignment','exam prep','group project','feedback')
), '{}')
where p.is_seed;

-- Simulated students say "I'm in" to society events that suit them and when they're free.
insert into public.swipes (user_id, activity_id, decision, created_at)
select p.id, a.id, 'in', now() - make_interval(hours => (random() * 24 * 5)::int)
from public.activities a
cross join lateral (
  select pr.id from public.profiles pr
  where pr.is_seed
    and public.pool_is_free(pr.id, a.starts_at, a.duration_mins)
    and pr.interests && a.tags
  order by cardinality(array(select unnest(pr.interests) intersect select unnest(a.tags))) desc, md5(pr.id::text || a.id)
  limit 5
) p
where a.host is not null
on conflict do nothing;

-- A few "not for me" swipes so interest isn't uniformly positive.
insert into public.swipes (user_id, activity_id, decision, created_at)
select p.id, a.id, 'pass', now() - make_interval(hours => (random() * 24 * 10)::int)
from _people p cross join lateral (
  select id from public.activities a
  where not (a.id = any(p.says_yes))
    and not exists (select 1 from public.swipes sw where sw.user_id = p.id and sw.activity_id = a.id)
  order by md5(a.id || p.email) limit 3
) a
where p.is_seed;

-- ---------------------------------------------------------------------
-- Simulated history (last ~2 weeks) so the metrics screen has a realistic
-- funnel when "Incl. simulated students" is on. Only simulated students.
-- ---------------------------------------------------------------------
do $$
declare
  g        record;
  v_sq     uuid;
  v_start  timestamptz;
  v_mins   int;
begin
  for g in
    select * from (values
      ('comp1511-lab',  'mainlib-l3',   9, 14, array['mei','tomas','noah','ryan'],   'completed'),
      ('badminton',     'ufac',         8, 17, array['kenji','ben','mateo'],         'completed'),
      ('trivia-night',  'roundhouse',   7, 18, array['lucas','jack','arjun','ruby'], 'completed'),
      ('boba',          'gongcha',      6, 15, array['aisha','sofia','chloe'],       'completed'),
      ('leetcode',      'k17-lab',      5, 13, array['priya','zara','hassan'],       'completed'),
      ('desn1000-build','makerspace',   4, 15, array['hana','oliver','isla'],        'completed'),
      ('math1131-explain','lawlib-l2',  3, 10, array['linh','leo'],                  'completed'),
      ('boba',          'esmes',        2, 16, array['aisha','sofia'],               'completed'),
      ('anime-night',   'library-lawn', 1, 18, array['ethan','ava','chloe'],         'confirmed'),
      ('econ1101-papers','mainlib-l4', -2, 10, array['grace','lucas','jack'],        'proposed')
    ) t(act, venue, days_ago, hr, people, status)
  loop
    select duration_mins into v_mins from public.activities where id = g.act;
    v_start := (((now() at time zone 'Australia/Sydney')::date - g.days_ago) + make_time(g.hr, 0, 0)) at time zone 'Australia/Sydney';

    insert into public.squads (activity_id, venue_id, starts_at, ends_at, status, reasons, created_at)
    values (g.act, g.venue, v_start, v_start + make_interval(mins => v_mins), g.status,
            '{"Simulated history"}', v_start - interval '2 days')
    returning id into v_sq;

    insert into public.squad_members (squad_id, user_id, status, responded_at)
    select v_sq, p.id,
           case when g.status = 'proposed' and split_part(u.email, '@', 1) = 'jack' then 'invited' else 'accepted' end,
           v_start - interval '1 day'
    from public.profiles p join auth.users u on u.id = p.id
    where split_part(u.email, '@', 1) = any(g.people) and u.email like '%@pool.demo';

    if g.status = 'completed' then
      insert into public.member_ratings (squad_id, rater_id, ratee_id, score, created_at)
      select v_sq, a.user_id, b.user_id, 3 + abs(hashtext(a.user_id::text || b.user_id::text)) % 3, v_start + interval '4 hours'
      from public.squad_members a join public.squad_members b on b.squad_id = a.squad_id and b.user_id <> a.user_id
      where a.squad_id = v_sq
        and abs(hashtext(a.user_id::text)) % 5 <> 0;  -- most people rate, not everyone

      insert into public.venue_ratings (squad_id, rater_id, venue_id, score, created_at)
      select v_sq, m.user_id, g.venue,
             case when g.venue = 'lawlib-l2' then 2 else 3 + abs(hashtext(m.user_id::text || g.venue)) % 3 end,
             v_start + interval '4 hours'
      from public.squad_members m
      where m.squad_id = v_sq and abs(hashtext(m.user_id::text)) % 5 <> 0;
    end if;
  end loop;

  -- The second boba squad was a rebook of the first.
  update public.squads s set rebook_of = (
    select id from public.squads where activity_id = 'boba' and reasons = '{"Simulated history"}' order by starts_at limit 1)
  where s.id = (select id from public.squads where activity_id = 'boba' and reasons = '{"Simulated history"}' order by starts_at desc limit 1);
end $$;

-- App opens, so weekly-active and cohort retention have something to show.
insert into public.app_events (user_id, name, created_at)
select p.id, 'app_open', d + make_interval(hours => 8 + (abs(hashtext(p.id::text || d::text)) % 12))
from public.profiles p
cross join lateral generate_series(date_trunc('day', p.created_at), now() - interval '1 day', interval '1 day') d
where p.is_seed and abs(hashtext(p.id::text || d::text)) % 10 < 4;

-- Most people in finished simulated squads checked in (attendance for the metrics screen).
update public.squad_members m set checked_in_at = s.starts_at + interval '5 minutes'
from public.squads s
where s.id = m.squad_id and s.status = 'completed' and s.reasons = '{"Simulated history"}'
  and m.status = 'accepted' and abs(hashtext(m.user_id::text || s.id::text)) % 7 <> 0;
