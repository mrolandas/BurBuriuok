-- general purpose and plans writeup in Lithuanian --
"BurBuriuok" web programa skirta padėti vartotojui mokytis, suprasti ir pasiruošti išlaikyti egzaminus pagal "Lietuvos Buriavimo Asociacijos Vidaus vandenu burines jachtos vado mokymo programa (20241015d_redakcija_241024_112644-1)", joje nurodytų žinotinų sąvokų sąrašas yra docs/static_info/LBS_programa.md dokumente. Ši programa padeda teoriniam egzaminui, praktiniam egzaminui pasiruošti bus tik patarimų sąrašas.

Vartotojas:

- mokysis visų būtinų žinoti sąvokų
- pasitikrins išmoktas žinias
- dažniausiai naudos vieną ir tą patį telefoną (70%) arba planšetę (20%), arba kompiuterį (10%) (programos dizainas turi į tai atsižvelgti)

BurBuriuok programa nėra mokymų kursų pakaitalas, tad šioje programoje yra svarbu duoti vartotojui galimybę vesti užrašus ir susieti informaciją su programos skiltimis bei sąvokomis (pvz naudojant # arba @ dinamiškai sukuriamos nuorodos tekste). Tokiu būdu paskaitų metu gautos žinios įgauna tiesioginę prasmę ir yra vertingesnės vėlesnės peržvalgos metu.

Pirmoje BurBuriuok versijoje nebus įdiegta duomenų bazė ar dirbtinis intelektas, antroje BurBuriuok versijoje bus įdiegiama Supabase ir sukuriama sąsaja su (1) Ollama arba (2) nemokamais modeliais internete bei įdiegiamas asistentas padėti paaiškinti bet kurią sąvoką ar atsakyti į klausimus.

BurBuriuok skirta mokytis lietuviškai, bet žinojimas tų pačių terminų anglų kalba yra ytin svarbus, tad sąvokos pateikiamos ir angliškai.

BurBuriuok kodas ir komentarai jame bus anglų kalba, tik UI lietuviškai.

-- code and architecture --
I've written the general purpose writeup in Lithuanian, because i want to be highlight the importance of using Lithuanian language for anything that's user-facing. That being said, we will write the code (syntax, classnames, comments and anything else) in English.

A first-draft prototype (html/js/css) should be referenced when starting to create BurBuriouk. It only contains core basic functionality and lists concept only from Section 1 with corresponding brief explanations. It's imparative to not just try to blindly replicate the existing structure, but use it as guidance staying mindful that the overall amount of information to be covered in BurBuriuok is much larger (total of 10 sections, perhaps expanded on later) with very wide range of topics. So our BurBuriuok needs to be structured properly from the get-go, in modular fashion and keeping separation of concerns for ease of maintenance and expandability pursposes (security is also important, but secondary at this time).

For current development purposes it should be coded as a single-user application at this time, to be hosted on github pages for the forseeable future.

SvelteKit frontend
Modular Express backend
file-based storage, structured to be migrated to supabase in the future
css to be in .css files in /styles
all documentation to be placed in /docs folder except for the generic README.md at the root of the project folder.

use git and push major releases to github.
