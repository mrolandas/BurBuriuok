-- seed_concepts.sql
-- Seed initial concept records for Section 1 using data extracted from the first draft prototype.

insert into burburiuok.concepts (
    section_code,
    section_title,
    subsection_code,
    subsection_title,
    slug,
    term_lt,
    term_en,
    description_lt,
    source_ref
) values
    ('1.1', 'KORPUSŲ IR BURLAIVIŲ TIPAI', '1.1', 'Korpusų konstrukcijos tipai', 'jole', 'Jolė', 'Dinghy', 'Maža, lengva valties tipo jachta su plokščiu dugnu. Dažnai naudojama mokymuisi ar kaip papildomas laivelis. Lengvai traukiama į krantą.', 'LBS 1.1'),
    ('1.1', 'KORPUSŲ IR BURLAIVIŲ TIPAI', '1.1', 'Korpusų konstrukcijos tipai', 'svertbotas', 'Švertbotas', 'Centreboard Boat', 'Jachta su keliamu-nuleidžiamu švertu (centreboardu) vietoj nuolatinio kilio. Mažas grimzlimas, tinka sekliam vandeniui.', 'LBS 1.1'),
    ('1.1', 'KORPUSŲ IR BURLAIVIŲ TIPAI', '1.1', 'Korpusų konstrukcijos tipai', 'kiline-jachta', 'Kilinė jachta', 'Keel Yacht', 'Jachta su fiksuotu, sunkiu falškiliu. Stabili, tinkama jūroms. Didesnis grimzlimas nei šverto.', 'LBS 1.1'),
    ('1.1', 'KORPUSŲ IR BURLAIVIŲ TIPAI', '1.1', 'Korpusų konstrukcijos tipai', 'kompromisas', 'Kompromisas', 'Bilge Keel', 'Jachta su dviem trumpais kiliais šonuose. Gali stovėti ant dugno atoslūgyje. Vidutinis grimzlimas.', 'LBS 1.1'),
    ('1.1', 'KORPUSŲ IR BURLAIVIŲ TIPAI', '1.1', 'Korpusų konstrukcijos tipai', 'katamaranas', 'Katamaranas', 'Catamaran', 'Dvikojis laivas - du korpusai sujungti tiltu. Greitas, stabilus, didelis denio plotas. Mažas grimzlimas.', 'LBS 1.1'),
    ('1.1', 'KORPUSŲ IR BURLAIVIŲ TIPAI', '1.1', 'Korpusų konstrukcijos tipai', 'trimaranas', 'Trimaranas', 'Trimaran', 'Trikojis laivas - centrinis korpusas ir du mažesni šoniniai korpusai (amos). Greitas, lengvas, gera stabilumo sąvoka.', 'LBS 1.1'),
    ('1.1', 'KORPUSŲ IR BURLAIVIŲ TIPAI', '1.1', 'Korpusų konstrukcijos tipai', 'proa', 'Proa', 'Proa', 'Tradicinis Ramiojo vandenyno dvikojis laivas su nesimetrišku dizainu - vienas korpusas didesnis, kitas ama (stabilizatorius). Vairą lenkia keisdamas kryptį.', 'LBS 1.1'),
    ('1.1.1', 'KORPUSŲ IR BURLAIVIŲ TIPAI', '1.1.1', 'Burlaivių tipai (rangauto tipai)', 'ketas', 'Ketas', 'Cat Rig', 'Viena burė ant vieno stiebo be forštagio. Paprasčiausias rangautas - tik grotas, be priekinės burės.', 'LBS 1.1.1'),
    ('1.1.1', 'KORPUSŲ IR BURLAIVIŲ TIPAI', '1.1.1', 'Burlaivių tipai (rangauto tipai)', 'sliupas', 'Šliupas', 'Sloop', 'Vienas stiebas, grotas ir priekinė burė (stakselis/genuja). Populiariausias šiuolaikinis rangauto tipas. 90% jachtų.', 'LBS 1.1.1'),
    ('1.1.1', 'KORPUSŲ IR BURLAIVIŲ TIPAI', '1.1.1', 'Burlaivių tipai (rangauto tipai)', 'kuteris', 'Kuteris (Tenderis)', 'Cutter', 'Vienas stiebas, grotas ir DVI priekinės burės (stakselis + trinkelis). Stiebas dažnai toliau nuo priekio nei šliupe.', 'LBS 1.1.1'),
    ('1.1.1', 'KORPUSŲ IR BURLAIVIŲ TIPAI', '1.1.1', 'Burlaivių tipai (rangauto tipai)', 'kecas', 'Kečas', 'Ketch', 'Du stiebai: didesnis priekinis (grotstiebis) ir mažesnis galinis (bizanstiebis) PRIEŠ vairą. Bizanburė mažesnė už grotą.', 'LBS 1.1.1'),
    ('1.1.1', 'KORPUSŲ IR BURLAIVIŲ TIPAI', '1.1.1', 'Burlaivių tipai (rangauto tipai)', 'jolas', 'Jolas', 'Yawl', 'Du stiebai kaip kečas, bet mažas galinis bizanstiebis yra UŽ vairo. Bizanburė labai maža, daugiau balanso nustatymui.', 'LBS 1.1.1'),
    ('1.1.1', 'KORPUSŲ IR BURLAIVIŲ TIPAI', '1.1.1', 'Burlaivių tipai (rangauto tipai)', 'skuna', 'Škuna', 'Schooner', 'Du ar daugiau stiebų, galinis stiebas AUKŠTESNIS arba lygus priekiniam. Tradicinis prekybinis laivas.', 'LBS 1.1.1'),
    ('1.1.1', 'KORPUSŲ IR BURLAIVIŲ TIPAI', '1.1.1', 'Burlaivių tipai (rangauto tipai)', 'brigantina', 'Brigantina', 'Brigantine', 'Du stiebai: priekinis su skersėmis ir keturkampėmis burėmis, galinis su markoni (trikampėmis) burėmis.', 'LBS 1.1.1'),
    ('1.1.1', 'KORPUSŲ IR BURLAIVIŲ TIPAI', '1.1.1', 'Burlaivių tipai (rangauto tipai)', 'brigas', 'Brigas', 'Brig', 'Du stiebai, ant abiejų skersės su keturkampėmis burėmis. Karinis/prekybinis laivas 18-19 amžiuje.', 'LBS 1.1.1'),
    ('1.1.1', 'KORPUSŲ IR BURLAIVIŲ TIPAI', '1.1.1', 'Burlaivių tipai (rangauto tipai)', 'barkentina', 'Barkentina', 'Barquentine', '3+ stiebai: priekinis su skersėmis (keturkampės burės), kiti su markoni burėmis.', 'LBS 1.1.1'),
    ('1.1.1', 'KORPUSŲ IR BURLAIVIŲ TIPAI', '1.1.1', 'Burlaivių tipai (rangauto tipai)', 'barkas', 'Barkas', 'Barque', '3+ stiebai: visi išskyrus galinį turi skersės (keturkampės burės), galinis - markoni burė.', 'LBS 1.1.1'),
    ('1.1.1', 'KORPUSŲ IR BURLAIVIŲ TIPAI', '1.1.1', 'Burlaivių tipai (rangauto tipai)', 'burinis-laivas', 'Burinis laivas', 'Full-rigged Ship', '3+ stiebai, ant visų - skersės su keturkampėmis burėmis. Didžiausi tradiciniai burlaiviai.', 'LBS 1.1.1')

on conflict (slug) do update set
    section_code = excluded.section_code,
    section_title = excluded.section_title,
    subsection_code = excluded.subsection_code,
    subsection_title = excluded.subsection_title,
    term_lt = excluded.term_lt,
    term_en = excluded.term_en,
    description_lt = excluded.description_lt,
    source_ref = excluded.source_ref,
    updated_at = timezone('utc', now());
