# BurBuriuok

BurBuriuok is a Lithuanian-first learning companion that helps prepare for the Lithuanian Sailing Association skipper curriculum. User-facing copy will stay in Lithuanian, while source code, internal documentation, and developer discussions remain in English for clarity.

## Lithuanian Overview

### Tikslas

"BurBuriuok" web programa skirta padėti vartotojui mokytis, suprasti ir pasiruošti išlaikyti egzaminus pagal "Lietuvos Buriavimo Asociacijos Vidaus vandenu burines jachtos vado mokymo programa (20241015d_redakcija_241024_112644-1)". Joje nurodytų žinotinų sąvokų sąrašas yra `docs/static_info/LBS_programa.md` dokumente. Ši programa padeda teoriniam egzaminui, o praktiniam egzaminui pasiruošti pateikia patarimų sąrašą.

### Naudotojo poreikiai

- mokysis visų būtinų žinoti sąvokų
- pasitikrins išmoktas žinias
- dažniausiai naudos vieną ir tą patį telefoną (70%) arba planšetę (20%), arba kompiuterį (10%), todėl dizainas turi būti draugiškas mobiliesiems įrenginiams
- galės vesti užrašus ir susieti informaciją su programos skiltimis bei sąvokomis (pvz., naudojant dinamiškai kuriamas žymes `#` arba `@` tekstuose), kad paskaitų metu gautos žinios būtų lengvai pritaikomos ir peržiūrimos

### Versijų gairės

- Pirmoje BurBuriuok versijoje Supabase naudojama pagrindiniam turiniui ir pažangos duomenims saugoti, tačiau nėra autentifikacijos ar vaizdų įkėlimo; sprendimas vis dar publikuojamas „GitHub Pages“ aplinkoje.
- Antroje BurBuriuok versijoje planuojama integruoti Supabase autentifikaciją ir sąsajas su (1) Ollama arba (2) viešai prieinamais modeliais internete, kad atsirastų virtualus asistentas, galintis paaiškinti sąvokas ir atsakyti į klausimus.
- Po Supabase išplėtimo planuojama sudaryti galimybes naudotojams kelti iki keturių iliustracijų kiekvienam sąvokos įrašui, dalintis jomis su bendruomene ir administratoriui atrinkti geriausius vaizdus būsimam numatytajam rodymui.

### Kalbos politika

- BurBuriuok skirta mokytis lietuviškai, tačiau žinojimas tų pačių terminų anglų kalba yra itin svarbus, todėl sąvokos pateikiamos ir anglų kalba.
- BurBuriuok kodas ir komentarai bus anglų kalba; tik naudotojo sąsaja išliks lietuviška.

## Architecture Guidelines

- SvelteKit frontend: komponentinis, prieinamumą užtikrinantis UI, optimizuotas mobiliesiems.
- Modular Express backend: aiškiai atskirtos funkcijos, ruošiantis daugiausia REST/JSON sąveikai su ateities klientais.
- Supabase duomenų sluoksnis: V1 laiko terminų sąrašą ir naudotojo pažangos duomenis Supabase lentelėse, pasiruošus vėlesniems funkcionalumams.
- Vaizdų (images) valdymas: V1 be įkėlimo, V2 planas naudoti Supabase Storage su pernaudojamais kontrolės sluoksniais (per-user kvotos, moderavimo įrankiai).
- CSS sluoksnis laikomas `styles/` kataloge; pirmenybė moduliniam stilių paskirstymui.
- Dokumentacija (išskyrus šį README) saugoma `docs/`, kad būtų lengva rasti produktinius, infrastruktūrinius ir procesinius dokumentus.

## Prototype Reference

- Katalogas `first_draft/` talpina pradinį HTML/JS/CSS prototipą, apimantį tik dalį (1 skyrių) viso terminų sąrašo. Jis skirtas kaip UX bei turinio pateikimo nuoroda, bet architektūriškai nosa reikalaujama komponentinio, plačiai plečiamo sprendimo.

## Documentation

- Išsami dokumentacija prasideda nuo `docs/README.md`, kur rasite nuorodas į planavimo, infrastruktūros ir nuorodų dokumentus.
- Statinis sąvokų sąrašas visada pasiekiamas `docs/static_info/LBS_programa.md`.

## Version Control and Releases

- Naudojame Git (pagrindinis branch `main`).
- Esminius etapus pažymime žymomis arba išskirstome į atskiras šakas pagal funkcijas.
- Pagrindinius leidimus (releases) stumiame į GitHub.
