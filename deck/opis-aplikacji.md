# Malapert: pełny opis aplikacji (materiał dla agenta planującego prezentację)

Ten plik opisuje wszystko, co aplikacja robi, z prawdziwymi liczbami. Służy do zaplanowania treści i kolejności slajdów oraz filmów. Wszystkie liczby poniżej pochodzą z działającej aplikacji albo z plików walidacji w repozytorium. Nie dopisuj funkcji, których tu nie ma.

## 1. Kontekst

- **Wydarzenie:** NASA Space Apps Challenge 2026, lokalizacja Stalowa Wola, 14–15 listopada 2026.
- **Wyzwanie:** „Lunar Landing Site Navigator” (partner: CSA, tag: CLPS). Prosi o narzędzie, które pozwala planistom misji, nauczycielom i publiczności szybko porównywać miejsca i daty lądowania, pokazując Słońce i Ziemię względem horyzontu (energia i łączność). Jedyny cel, który opis wyzwania podaje jako nieopcjonalny, to pokazanie, ile czasu zostało do zachodu Słońca i do zachodu Ziemi.
- **Zespół:** opsec demons x honda varadero xl125 2001 (Tomasz Tłusty, Nikodem Marek, Michał Urbaniak).
- **Adres na żywo:** https://malapert.us (zapasowy: https://malapert.imalfect.workers.dev). Działa w przeglądarce, bez instalacji i bez logowania.
- **Repozytorium:** github.com/TomaszTlusty/nasa-space (prywatne).
- **Język:** interfejs aplikacji jest po angielsku. Prezentacja jest po polsku.

### Format prezentacji (ograniczenia)

- Maksymalnie 7 slajdów, około 2,5 minuty mówienia.
- Na slajdach osadzone są animowane GIF-y z aplikacji (zapętlone, bez dźwięku). Prezentacja jest odtwarzana na laptopie organizatorów jako PPTX.
- Struktura od organizatorów: Hook → Problem → Rozwiązanie → Wartość → Biznes → Finał.
- Kryteria jury (każde 1–5): Impact, Creativity, Validity, Relevance (dane NASA jako rdzeń, a nie dodatek), Presentation.
- Pytania jury podane przez organizatorów: czy problem jest realny, czy pomysł jest innowacyjny, czy działa, kto skorzysta, czy można go rozwinąć, czy znacie swój projekt.
- Kategorie lokalne: technologiczna oraz artystyczno-kreatywna (storytelling, gry, przystępna nauka). Projekt pasuje do obu.
- Szkic planu jest w `deck/plan-prezentacji.md`. Ten plik jest jego źródłem faktów.

## 2. Problem w prostych słowach

- Lądowniki przy biegunie południowym Księżyca potrzebują dwóch rzeczy: Słońca na panelach (prąd) i Ziemi w zasięgu wzroku (łączność radiowa bez przekaźnika).
- Oś Księżyca jest nachylona tylko o około 1,54°, więc na biegunie Słońce krąży około 1,5° nad horyzontem. Jedno wzgórze, nawet odległe o dziesiątki kilometrów, rzuca cień na lądowisko.
- Ziemia wisi nisko i „kołysze się” (libracja około ±6,7° i ±7,9°). Przy biegunie bywa widoczna około dwóch tygodni, potem schowana około dwóch tygodni.
- Opóźnienie startu o kilka dni albo przesunięcie lądownika o kilkaset metrów potrafi zmienić misję z udanej w nieudaną.
- Przykład z rzeczywistości: lądownik IM-1 (Intuitive Machines, luty 2024) wylądował w rejonie Malapert A, przewrócił się (stok około 12°) i wyłączył się po około tygodniu, gdy Słońce zeszło z jedynego działającego panelu.
- Istniejące narzędzia NASA (LROC QuickMap, Moon Trek, JPL Horizons) są dla ekspertów. Opis wyzwania mówi wprost, że są za trudne do szybkiego porównywania scenariuszy.
- Kontekst programu: Artemis III to od lutego 2026 test na orbicie Ziemi. Pierwsze załogowe lądowanie to Artemis IV (początek 2028), z tymi samymi 9 regionami kandydackimi. Blue Origin Blue Moon MK1 celuje w Connecting Ridge przy kraterze Shackleton (początek 2027).

## 3. Rozwiązanie w jednym zdaniu

Malapert to aplikacja webowa z trójwymiarowym terenem bieguna południowego Księżyca z danych NASA, w której stawia się lądownik i datę, a aplikacja liczy na prawdziwym horyzoncie, kiedy lądownik ma Słońce i Ziemię. **Ten sam silnik obliczeń obsługuje dwa tryby:** narzędzie dla planisty misji oraz tryb nauki z przewodnikiem LUNA, lekcjami i grą dla ucznia.

### Główny wyróżnik (najważniejsza myśl prezentacji)

Fuzja: tryb edukacyjny jest interaktywny i działa na tych samych prawdziwych obliczeniach co narzędzie inżynierskie. Gra niczego nie symuluje na niby. Bateria pada, bo prawdziwy teren zasłania Słońce. Lądownik na stoku powyżej 10° przewraca się jak IM-1. LUNA reaguje na prawdziwe wyniki.

Nie mów, że nikt inny nie ma widoku horyzontu. Inne zespoły (np. Penumbra, LunaMission) też liczą horyzont z terenu. Prawdziwe stwierdzenie: w projektach, które sprawdziliśmy, nie znaleźliśmy trybu dla uczniów działającego na tym samym silniku.

## 4. Wspólne elementy (oba tryby)

### Scena 3D

- **Teren:** prawdziwa topografia z NASA LRO LOLA. Siatka 513 × 513 punktów co 80 m, region 41 × 41 km. Teren można obracać i przybliżać myszą.
- **Regiony (wybór w górnym pasku):**
  - **Shackleton & Connecting Ridge:** krater Shackleton z wiecznie zacienionym dnem, oświetlona krawędź i grzbiet Connecting Ridge.
  - **Malapert Massif:** region kandydacki Artemis. Szczyt jest około 5 km nad poziomem odniesienia, widzi Ziemię i dużo Słońca. Stoki za nim tracą Ziemię całkowicie.
- **Cienie:** każdy punkt terenu porównuje wysokość Słońca z prawdziwym horyzontem w tym kierunku. Horyzont uwzględnia góry do około 300 km, czyli także poza wyświetlanym fragmentem. Obraz 3D i liczby w panelach pochodzą z tych samych danych, więc nie mogą się różnić.
- **Lądowniki A i B:** stawia się je kliknięciem w teren albo na znanym miejscu. Nad lądownikiem jest etykieta „Sun X% / Earth link”.
- **Wiązka do Ziemi:** linia z anteny lądownika w stronę Ziemi. Niebieska ciągła, gdy jest łączność. Czerwona przerywana, gdy teren zasłania Ziemię.
- **Widok z lądownika (first person):** kamera na wysokości 2 m. Widać prawdziwy profil horyzontu, tarczę Słońca, Ziemię w poprawnej fazie i siatkę kątów (azymut i wysokość). Można rozglądać się o 360°.
- **Znane miejsca na mapie (pinezki ze źródłami):**
  - Shackleton: Connecting Ridge C1, Shackleton rim S, Connecting Ridge C2, NASA example landing point CR1, Blue Moon MK1 target, środek regionu Connecting Ridge (Site 01), środek regionu Shackleton rim (Site 04), dno krateru Shackleton.
  - Malapert: Malapert Massif (Site 23), szczyt Malapert, niższy stok, dno krateru przy Malapert.
  - Współrzędne pochodzą z NASA Lunar Surface Data Book i z pracy Gläser i in. 2018.

### Górny pasek

- Przełącznik trybów: „Mission planning” i „Explore & learn”. Przełączanie nie resetuje lądowników ani daty.
- Wybór regionu.
- Data i godzina UTC. Kliknięcie otwiera wybór daty startu misji. Zakres dat: listopad 2026 – grudzień 2028.
- **Odliczanie (wymóg wyzwania):** dwa żetony dla aktywnego lądownika, np. „Sunset in 17 d 16 h” (bursztynowy) i „Earthset in 9 d 9 h” (niebieski). Pokazują też wschody („Sunrise in…”, „Earthrise in…”). Aktualizują się przy przesuwaniu czasu.
- Przyciski: Report (PDF/CSV) oraz About (o danych).

### Dolna oś czasu

- Odtwarzanie i pauza (także spacją), prędkość 1 h/s, 6 h/s albo 1 dzień/s.
- Długość okna misji: 1, 7, 15 albo 30 dni.
- Suwak czasu z podziałką dni. Pod nim dwa paski: bursztynowy (kiedy jest Słońce) i niebieski (kiedy jest Ziemia).
- **Launch slip:** przyciski −1 d, +3 d i +7 d przesuwają okno startu. Wszystkie liczby przeliczają się od razu.

### Ekran powitalny

- Pytanie „Where and when can you land at the Moon's south pole?” i dwa kafelki z wyborem trybu.
- Widoczny tylko przy pierwszej wizycie.

### O danych (okno About)

- Jak to działa w trzech krokach, karta walidacji z wynikami porównań, lista źródeł danych, założenia modelu i ujawnienie użycia AI.

## 5. Tryb planowania misji („Mission planning”)

### Panel lądownika (prawa kolumna)

- **Zakładki:** A, B i Compare.
- **Lokalizacja:** szerokość i długość selenograficzna, wysokość terenu, nachylenie stoku z porównaniem do limitu 10°.
- **„Now” (chwila na osi czasu):**
  - Wysokość Słońca i wysokość terenu w tym kierunku, np. „Sun 0.7° · terrain −1.9° → 100% visible”.
  - To samo dla Ziemi.
  - Bieżąca moc paneli i stan baterii.
- **„Mission window” (całe okno):** średnie nasłonecznienie (średnia widoczna część tarczy Słońca), procent czasu ze Słońcem, procent czasu z Ziemią, najdłuższa ciemność i najdłuższa przerwa w łączności (w godzinach), energia (kWh), minimalny stan baterii oraz informacja, czy lądownik przetrwa okno.
- **Screening (progi NASA z selekcji lądowisk Artemis):**
  - Warunki: stok < 10°, Ziemia ≥ 25% czasu, Słońce ≥ 5% czasu.
  - Wynik: odznaka GO albo NO-GO.
- **Wysokość masztu paneli (0, 2, 5 lub 10 m):** dla znanych miejsc. Podniesienie paneli łapie światło nad pobliskimi grzbietami.
- **Compare:** tabela A i B z różnicami. Lepsze wartości są zaznaczone. Pod tabelą jedno zdanie podsumowania wyliczone z liczb.

### Warstwy mapy (lewa kolumna)

- **Terrain:** zwykły teren oświetlony Słońcem z danej chwili.
- **Sun now:** bursztynowy teren w słońcu, ciemny w cieniu. Niebieskie kreskowanie oznacza miejsca, z których widać Ziemię.
- **Average:** mapa cieplna średniego nasłonecznienia w oknie misji, od fioletowego (0%) do bursztynowego (100%). Liczona w tle w około 0,2–0,4 s.
- **Slope:** nachylenie terenu. Turkusowy poniżej 5°, bursztynowy 5–10°, czerwony powyżej 10°.
- **Model zasilania:** edytowalne parametry z wartościami domyślnymi (panel 4 m², sprawność 28%, bateria 3 kWh, pobór 150 W). Założenie: pionowe panele obracające się za Słońcem. Płaski panel dostałby tylko około 2,6% światła.

### Wyszukiwarka lądowisk („Find sites”)

- Trzy suwaki: maksymalny stok, minimalne średnie nasłonecznienie, minimalny czas łączności z Ziemią.
- Przycisk „Find landing sites” przeszukuje 66 049 punktów terenu (siatka co 160 m).
- Wynik to top 5 miejsc z oceną, procentem Słońca i Ziemi, stokiem i najdłuższą ciemnością.
- Na mapie pojawiają się białe słupy światła z etykietami „Site #1 · 86%”.
- Kliknięcie wyniku stawia tam lądownik, a kamera tam przelatuje.
- Gdy nic nie spełnia wymagań, aplikacja wskazuje, który filtr blokuje, i proponuje wartość, przy której coś się znajdzie.

### Asystent AI („Ask the assistant”)

- Wpisujesz misję zwykłym zdaniem, np. „survive 10 days, need Earth contact half the time, landing early March 2027”.
- Asystent (Claude od Anthropic) sam obsługuje aplikację. Ustawia okno misji, przesuwa start, uruchamia wyszukiwarkę, stawia lądowniki i porównuje je. Każdy krok widać jako etykietę, np. „Set window 1–16 Mar 2027”, „Searched 66,049 grid points · 5 found”, „Placed A at Site #1”.
- **Może cytować tylko liczby policzone przez aplikację**, bo narzędzia działają w przeglądarce na tym samym silniku. Odpowiedź jest oznaczona etykietą „AI”.
- Ma ograniczenia: limit zapytań na adres IP i maksymalną długość wiadomości.

### Wykresy („Charts”)

- Wysokość Słońca i Ziemi względem horyzontu terenu w czasie.
- Moc paneli (W) i stan baterii (%).
- Paski dostępności Słońca i łączności.
- Pokazuje A i B naraz, z linią bieżącej chwili.

### Raport („Report”)

- **PDF „Site Selection Report”:**
  - okno misji i region, zrzut widoku 3D;
  - tabela A/B z lokalizacją, stokiem, Słońcem, Ziemią, ciemnością, łącznością, baterią, screeningiem i GO/NO-GO;
  - tabela wyników wyszukiwarki;
  - wykresy, źródła, założenia i ujawnienie użycia AI.
- **CSV:** godzinowe dane dla lądowników.

## 6. Tryb nauki („Explore & learn”)

### LUNA, przewodnik

- **Wygląd:** animowana maskotka, astronauta-robot rysowany w 2D (biały hełm, ciemna szyba z turkusowymi oczami, antena). Mruga, oczy śledzą kursor, unosi się. Po kliknięciu macha i otwiera czat.
- **Nastroje według zdarzeń:**
  - zmarznięta, ze szronem na szybie: lądownik na dnie krateru;
  - zaniepokojona: ciemne miejsce albo zachód Słońca;
  - podekscytowana, z iskrami: dobre miejsce albo wschód Słońca;
  - smutna: utrata Ziemi;
  - zachwycona: widok z lądownika;
  - zamyślona: gdy AI odpowiada.
- **Dymki:** tekst pisze się na żywo. Przy faktach są linki do źródeł.
  - Przykład z dna krateru: „Brrr! Lander A landed on a crater floor that never sees the Sun. Floors like this can sit in the dark for ages and drop to about −238 °C. My visor is frosting up!”
  - Przykład z grzbietu: „Great spot! Lander A sees the Sun 100% of the time in this window. Over many years, even the best ridge spots average under 90%.”
- **„Ask LUNA”:** czat z AI dla ucznia, przyjaznym językiem. Ma gotowe pytania („Where should I land?”, „Why are craters so cold?”, „Why does Earth wobble?”, „What happens at night?”). LUNA może przestawiać lądownik, a jej odpowiedzi są oznaczone jako AI.
- **Gra:** po zakończeniu misji LUNA ją komentuje.

### Cztery lekcje („Knowledge pills”, około 30 s każda)

Każdy krok lekcji sam ustawia kamerę, warstwę mapy, lądowniki i czas. Liczby są brane na żywo z obliczeń. „Exit lesson” przywraca stan sprzed lekcji.

1. **Why are Moon shadows pitch black?** Kroki: światło i cień obok siebie, brak powietrza (więc nie ma poświaty), noc, która się nie kończy (dno krateru, około −238 °C).
2. **Peaks of eternal light vs craters of eternal night.** Kroki: mapa nasłonecznienia z 30 dni, grzbiet kontra dno krateru, wyjaśnienie różnicy. Żaden szczyt nie jest oświetlony cały czas; najlepsze miejsca mają około 88% przy panelach na wysokości 2 m.
3. **Why does Earth dance in the sky?** Kroki: widok z lądownika, odtwarzanie dzień na sekundę, libracja, dwa tygodnie widoczności i dwa tygodnie przerwy.
4. **How a short move saves a mission.** Kroki: dwa lądowniki 300 m od siebie, porównanie nasłonecznienia, przetrwanie nocy.

### Gra „Mission: Survive, land the lander!”

| # | Misja | Region | Start | Cel |
|---|---|---|---|---|
| 1 | First light | Shackleton | 13 stycznia 2027 | przetrwać 7 dni, Ziemia ≥ 25% |
| 2 | Long shadow | Malapert | 15 kwietnia 2027 (ciemniejsza pora) | przetrwać 7 dni, Ziemia ≥ 25% |
| 3 | Deep survey | Shackleton | 1 listopada 2027, okno 15 dni | przetrwać ≥ 10 dni, Ziemia ≥ 60% |

1. **Wybór miejsca:** gracz ma 45 sekund na kliknięcie w teren. Pinezki znanych miejsc są ukryte, więc trzeba szukać samemu. Może włączyć pomocniczą mapę nasłonecznienia. Panel pokazuje „Flat enough: 6°” albo „Too steep: 26°”.
2. **„LAND HERE”:** kamera schodzi do widoku z lądownika, a misja przewija się w około 10 sekund. Widać duży pasek baterii (Full / Charging / Draining), wskaźnik Słońca, ilustracyjny termometr („Warm-ish” albo „Freezing”, oznaczony jako poglądowy) i sygnał Ziemi. Brzegi ekranu ciemnieją w cieniu.
3. **Stok powyżej 10°:** lądownik się przewraca, jak IM-1 na stoku 12°. Misja jest przegrana.
4. **Wynik:** punkty 0–100, odznaka (Cadet, Navigator, Mission Specialist, Flight Director) i dwa zdania wyjaśnienia z prawdziwymi liczbami. Przyciski: Retry, Next mission, „See it in Mission planning”.

## 7. Nauka i dane (do slajdu „Dowód” i odpowiedzi jury)

### Jak to liczymy

1. **Teren i horyzont (offline, raz):** dla każdego z 66 049 punktów siatki (co 160 m) liczymy wysokość horyzontu w 180 kierunkach (co 2°), na wysokości 2 m. Promień idzie po prawdziwym łuku wielkiego koła do około 300 km, przez mapy LOLA o rozdzielczości 20, 40, 80 i 240 m na piksel. Znane miejsca mają dokładniejsze horyzonty: 720 kierunków, na wysokości 0, 2, 5 i 10 m.
2. **Pozycje Słońca i Ziemi (na żywo w przeglądarce):** biblioteka astronomy-engine i model obrotu Księżyca IAU, liczone z powierzchni Księżyca.
3. **Oświetlenie:** porównanie wysokości Słońca lub Ziemi z horyzontem w tym kierunku, z uwzględnieniem tego, jaka część tarczy jest widoczna.
4. **Moc i bateria:** model godzinowy dla pionowych paneli obracających się za Słońcem.

### Walidacja (liczby z `public/validation.json`)

- **Pozycje Słońca i Ziemi kontra NASA JPL Horizons:** 10 przypadków testowych. Największa różnica wysokości to 0,0025°, a azymutu 0,004°.
- **Długoterminowa widoczność kontra mapy NASA (Mazarico i in., PGDA), 18,6 roku, po 64 punkty na region:**

| Region | Średni błąd: Słońce | Średni błąd: Ziemia |
|---|---|---|
| Shackleton | 2,1 pkt proc. | 1,3 pkt proc. |
| Malapert | 1,1 pkt proc. | 1,2 pkt proc. |

- **Kontrola zdrowego rozsądku:** dno krateru Shackleton ma 0% Słońca przez cały rok. Punkt C1 na Connecting Ridge ma 85,6% przy panelach na 2 m, a literatura (Gläser 2018) podaje 88,0%.
- **Testy automatyczne:** 37, wszystkie przechodzą.

### Źródła danych NASA (kryterium Relevance)

- LRO LOLA, polarne mapy wysokości (PDS): teren.
- Mapy średniej widoczności Słońca i Ziemi (Mazarico i in. 2011, NASA PGDA): walidacja.
- JPL Horizons: walidacja pozycji ciał niebieskich.
- NASA Lunar Surface Data Book oraz lista regionów Artemis (październik 2024): współrzędne miejsc.
- Progi selekcji lądowisk z materiałów NASA o lądowniku HLS (2024).
- Uzupełniająco: Gläser i in. 2018 oraz Paige i in. 2010 (temperatury, LRO Diviner).

## 8. Gotowe przykłady z liczbami (do filmów i narracji)

Liczby odczytane z aplikacji. Okno 15 dni, panele na 2 m, domyślny model zasilania.

### Poślizg startu: Shackleton rim S

| | Lądowanie 15.01.2027 | Start o 7 dni później |
|---|---|---|
| Łączność z Ziemią | 63% czasu | 16% czasu |
| Minimalna bateria | 100% | 18% |
| Ocena | GO | NO-GO (Ziemia < 25%) |

Odliczanie do zachodu Słońca: „Sunset in 17 d 16 h”, a po przesunięciu „10 d 16 h”. Ten przykład jest nagrany (`deck/out/clip-slip.gif`).

### Grzbiet kontra krater: Shackleton, 15.01.2027

- Connecting Ridge C1: 100% Słońca, łączność 63%, ocena GO.
- Dno krateru Shackleton: 0% Słońca, 0% Ziemi, bateria pada po około 20 godzinach.
- LUNA na dnie krateru „marznie”, a na grzbiecie się cieszy. Ten przykład jest nagrany (`deck/out/clip-luna.gif`).

### Wyszukiwarka

- Domyślne kryteria (stok ≤ 10°, Słońce ≥ 60%, Ziemia ≥ 50%), okno od 15.01.2027: 5 miejsc. Wyniki mają 91–100% Słońca i 62–68% łączności, a stok 1–2°.

### Przewrócenie w grze

- Lądowanie na stoku 14° albo 30° kończy misję komunikatem „Tipped over!” i porównaniem do IM-1.

## 9. Technologia (jedno zdanie do slajdu, reszta na pytania)

- **Stos:** Next.js 16, React 19, three.js (react-three-fiber), własny system projektowy (Base UI i Tailwind, fonty Sora i Geist Mono), obliczenia w Web Workerze.
- **AI:** AI SDK z modelem Claude od Anthropic.
- **Hosting:** Cloudflare Workers.
- **Rozmiar:** jeden region to około 10 MB danych. Teren pojawia się w około 0,7 s lokalnie i w około 8 s na łączu 12 Mbit/s.
- **Działanie:** 60 klatek na sekundę na laptopie (M1 Pro).
- **Wymagania:** działa offline po załadowaniu, poza czatem AI. Nie ma bazy danych ani logowania.
- **Ekrany:** desktop jest głównym celem. Na tablecie i telefonie panele otwierają się jako wysuwane szuflady.

## 10. Ujawnienie użycia AI (zasady Space Apps 2026)

- Asystent planowania i LUNA odpowiadają przez Claude (AI). W aplikacji są oznaczeni etykietą AI, a ich odpowiedzi opierają się na obliczeniach aplikacji.
- Kod powstał w dużej mierze z pomocą AI, pod kierunkiem i z przeglądem zespołu.
- Koncepcja jest autorstwa zespołu: dwa tryby, przewodnik, gra, mapy nasłonecznienia, wyszukiwarka, porównywarka i raport.
- Nie ma obrazów, wideo ani dźwięku wygenerowanych przez AI. Filmy w prezentacji to nagrania ekranu prawdziwej aplikacji.
- Nie ma logo NASA ani nazw NASA na własnych elementach. Odznaki to „Mission badges”, a przewodnik nazywa się „LUNA”.

## 11. Czego nie mówić (błędy i nieścisłości do uniknięcia)

- **Regiony:** aplikacja ma 2 regiony (Shackleton, Malapert), nie 5. Nie ma Haworth.
- **Temperatury:** nie ma „+120 °C w słońcu” na biegunie. To temperatura z równika. Na biegunie mówimy tylko o około −238 °C na dnie kraterów.
- **Kolory heatmapy:** nie są zielono-czerwone. Mapa średnia idzie od fioletu do bursztynu, mapa chwilowa łączy bursztyn z ciemnym, a wiązka łączności jest niebieska albo czerwona.
- **Odznaki:** nie są „odznakami NASA”, tylko odznakami misji.
- **Szczyty:** nie istnieje „szczyt wiecznego światła” w dosłownym sensie. Najlepsze miejsca mają około 88% przy panelach na 2 m.
- **Termometr w grze:** jest poglądowy i nie pokazuje stopni.
- **Model zasilania:** jest przykładowy (wartości domyślne). Oparty jest na fizyce oświetlenia, ale nie odwzorowuje konkretnego lądownika.
- **Walidacja:** nie mów „zweryfikowane przez NASA”. Mów „porównane z danymi NASA/JPL”.
- **Cel lądowania MK1:** Blue Moon MK1 jest pokazany w przybliżonym punkcie CR1, bo dokładne miejsce nie jest opublikowane.

## 12. Odpowiedzi na pytania jury

| Pytanie | Odpowiedź |
|---|---|
| Czy to realny problem? | Tak. IM-1 zgasł po tygodniu, a opis wyzwania sam wskazuje opóźnienia startu i to, że obecne narzędzia są za trudne. |
| Co jest innowacyjne? | Interaktywny tryb nauki na tym samym silniku co narzędzie inżynierskie. Do tego asystent AI, który obsługuje aplikację i cytuje tylko policzone liczby. |
| Czy działa? | Tak, na żywo pod malapert.us. Wyniki porównane z JPL Horizons (0,0025°) i mapami NASA (około 1–2 pkt proc.). |
| Kto skorzysta? | Szkoły i centra nauki (lekcje i gra za darmo). Firmy budujące lądowniki: szybkie pierwsze sprawdzenie miejsca i daty przed drogą analizą. |
| Jak to rozwinąć? | Więcej regionów (wszystkie 9 regionów Artemis), polska wersja, gotowe scenariusze lekcji, wyższa rozdzielczość terenu. |
| Czy znacie projekt? | Patrz sekcja 7 (jak liczymy) i sekcja 8 (konkretne liczby). |
| Gdzie było AI? | Patrz sekcja 10. |

## 13. Materiały do prezentacji (stan)

| Plik | Co to jest | Stan |
|---|---|---|
| `deck/plan-prezentacji.md` | Plan 7 slajdów z tekstem mówionym | szkic do edycji |
| `deck/out/clip-slip.gif` | Poślizg startu, Shackleton rim S | gotowe |
| `deck/out/clip-luna.gif` | LUNA w kraterze, potem na grzbiecie | gotowe |
| `deck/out/przyklad-2-slajdy.pptx` | Dwa przykładowe slajdy w docelowym stylu | gotowe |

Do nagrania:
- cienie przesuwające się nad Shackletonem;
- widok z lądownika ze Słońcem nad horyzontem;
- asystent AI szukający lądowiska;
- gra z przewróceniem lądownika;
- mapa średniego nasłonecznienia.

Narzędzia do nagrań są w `deck/` (nagrywanie w podwójnej rozdzielczości z widocznym kursorem, konwersja do GIF, składanie PPTX).

### Styl slajdów (ustalony)

- Ciemne tło, font Sora. Na slajdzie jeden nagłówek będący pełnym zdaniem i krótki akapit; GIF zajmuje większość slajdu.
- Bez nadtytułów z wersalików, bez punktorów, numerów slajdów, ozdobnych kropek i myślników.
- Kluczowe liczby wyróżnione bielą w szarym tekście.
