/**
 * The pitch deck in one place: slide text (Polish), which clip goes where, and the speaker notes.
 * Slide order and notes follow the team's spoken script (HOOK, PROBLEM, ROZWIĄZANIE, WARTOŚĆ, BIZNES, FINAŁ).
 *
 *   bun deck/deck.ts html          writes deck/slides/s1.html … s7.html (render each to deck/out/slide-N.png)
 *   bun deck/deck.ts build <out>   assembles the PPTX from the rendered PNGs and clips via deck/build.ts
 */
import { $ } from "bun";

interface Slide {
  side: "right" | "left";
  clip: string;
  title: string;
  /** paragraph HTML */
  body?: string;
  /** extra HTML for the text column (slide 7: QR and team) */
  extra?: string;
  /** what the speaker says on this slide, verbatim from the script */
  notes: string;
}

const SLIDES: Slide[] = [
  {
    // HOOK
    side: "right",
    clip: "clip-intro.gif",
    title: "Lądownik IM-1 wylądował na stoku, przewrócił się i po tygodniu zgasł.",
    body: "Luty 2024, okolice bieguna południowego Księżyca. Lądownik działał jeszcze przez tydzień, a potem Słońce przestało świecić na jego jedyny działający panel.",
    notes:
      "W lutym 2024 lądownik IM-1 dolatuje w okolice bieguna południowego Księżyca, ale ląduje na stoku 12 stopni i się przewraca. Działa jeszcze przez tydzień, a potem gaśnie, bo Słońce przestaje świecić na jego jedyny działający panel.",
  },
  {
    // PROBLEM
    side: "left",
    clip: "clip-slip.gif",
    title: "Na biegunie liczy się nie tylko miejsce lądowania, ale też data.",
    body: "Słońce wisi tam tuż nad horyzontem, więc wystarczy jedno wzgórze, żeby lądownik stracił prąd. Ziemię widać przez dwa tygodnie, a przez kolejne dwa się chowa. Na nagraniu to samo miejsce na krawędzi krateru Shackleton: lądowanie 15 stycznia dostaje GO, a tydzień później NO-GO. Narzędzia, którymi da się to dziś sprawdzić, są zrobione dla ekspertów.",
    notes:
      "I to nie był tylko pech, bo tak właśnie wygląda to miejsce. Na biegunie Słońce wisi zaledwie półtora stopnia nad horyzontem, więc wystarczy jedno wzgórze, nawet kilkadziesiąt kilometrów dalej, żeby lądownik stracił prąd. Z Ziemią, a więc z łącznością, jest podobnie: przez dwa tygodnie ją widać, a przez kolejne dwa się chowa. Dlatego liczy się nie tylko miejsce, ale też data. Weźmy krawędź krateru Shackleton i lądowanie 15 stycznia: łączność przez 63% czasu, bateria cały czas pełna, wynik GO. Wystarczy jednak, że start opóźni się o tydzień, a łączność spada do 16%, bateria do 18% i misja dostaje NO-GO. To samo miejsce, tylko tydzień później. Kłopot w tym, że narzędzia, którymi da się to dziś sprawdzić, są zrobione dla ekspertów.",
  },
  {
    // ROZWIĄZANIE: two modes, scientist mode (maps, horizon, comparison)
    side: "right",
    clip: "clip-maps.gif",
    title: "Malapert ma dwa tryby na tym samym silniku obliczeń: dla naukowca i dla ucznia.",
    body: "W trybie naukowca prawdziwy teren bieguna z danych NASA można oglądać na czterech mapach: zwykły widok, co jest teraz w słońcu i skąd widać Ziemię, średnie nasłonecznienie z całej misji oraz nachylenie. Aplikacja liczy prawdziwy horyzont, więc wiadomo, kiedy jest łączność i ile zostało do zachodu Słońca. Dwa miejsca albo dwie daty można porównać obok siebie.",
    notes:
      "Dlatego zbudowaliśmy Malapert, który ma dwa tryby: jeden dla naukowców, drugi dla uczniów. Oba działają na tym samym silniku obliczeń i na prawdziwym terenie bieguna z danych NASA.\n\nZacznijmy od trybu naukowca. Teren można oglądać na czterech mapach. Pierwsza to zwykły widok terenu w świetle z danej chwili. Druga pokazuje, co jest teraz w słońcu, co w cieniu i skąd widać Ziemię. Trzecia to średnie nasłonecznienie z całej misji, a czwarta to nachylenie, na którym od razu widać zbyt strome stoki. Ponieważ aplikacja liczy prawdziwy horyzont, z górami nawet 300 kilometrów dalej, wiadomo też, kiedy jest łączność z Ziemią i ile zostało do zachodu Słońca. Przy wyborze między dwoma miejscami albo dwiema datami można je porównać obok siebie i od razu zobaczyć wynik GO albo NO-GO.",
  },
  {
    // ROZWIĄZANIE: site search, AI assistant, PDF report
    side: "left",
    clip: "clip-find.gif",
    title: "Gdy nie wiadomo, gdzie lądować, wystarczy ustawić kryteria albo opisać misję.",
    body: "Wyszukiwarka sprawdza cały teren pod kątem nachylenia, oświetlenia i łączności z Ziemią, a potem pokazuje pięć najlepszych miejsc. Asystent AI sam obsługuje aplikację i podaje tylko liczby, które ona policzyła. Na koniec jednym kliknięciem powstaje raport PDF z wykresami, porównaniem miejsc i widokiem 3D.",
    notes:
      "A jeśli w ogóle nie wiadomo, gdzie lądować, wystarczy ustawić kryteria: maksymalne nachylenie terenu, minimalne średnie oświetlenie i minimalny czas łączności z Ziemią. Wyszukiwarka sprawdzi wtedy 66 tysięcy punktów terenu i pokaże pięć najlepszych miejsc. Można też po prostu opisać swoją misję asystentowi AI. On sam obsługuje aplikację i podaje tylko liczby, które ona policzyła. Kiedy wszystko jest gotowe, jednym kliknięciem można zrobić raport w PDF-ie z wykresami, porównaniem miejsc i widokiem 3D.",
  },
  {
    // ROZWIĄZANIE: student mode
    side: "right",
    clip: "clip-learn.gif",
    title: "Te same obliczenia napędzają tryb ucznia, w którym przewodnikiem jest LUNA.",
    body: "Uczeń sam stawia lądownik i patrzy, co się stanie, a LUNA na to reaguje: na dnie krateru zamarza, na grzbiecie się cieszy. Są też krótkie lekcje i gra na czas. Nic nie dzieje się na niby: lądownik postawiony na zbyt stromym stoku przewraca się tak samo jak IM-1.",
    notes:
      "Te same obliczenia napędzają tryb ucznia, w którym przewodnikiem jest LUNA, nasza mała astronautka-robot. Tutaj uczeń nie czyta definicji, tylko sam stawia lądownik i patrzy, co się stanie, a LUNA na to reaguje. Na dnie krateru zamarza, bo jest tam minus 238 stopni, a na grzbiecie się cieszy. Oprócz tego są krótkie lekcje i gra, w której gracz ma 45 sekund na wybór lądowiska. I właśnie to jest największa zaleta tego trybu: nic nie dzieje się na niby. Bateria pada, bo prawdziwy teren zasłania Słońce, a lądownik postawiony na stoku powyżej 10 stopni przewraca się tak samo jak IM-1. Uczeń pracuje więc na tych samych liczbach co inżynier.\n\nDzięki temu z Malaperta skorzystają z jednej strony planiści misji i firmy budujące lądowniki, a z drugiej nauczyciele, uczniowie i centra nauki.",
  },
  {
    // WARTOŚĆ
    side: "left",
    clip: "clip-heat-s.gif",
    title: "Liczby z aplikacji porównaliśmy z danymi NASA i JPL.",
    body: "Pozycje Słońca i Ziemi różnią się od kalkulatora JPL Horizons o tysięczne części stopnia. Widoczność Słońca i Ziemi liczona w skali 18 lat różni się od map NASA o 1–2 punkty procentowe. Na nagraniu nasza mapa średniego nasłonecznienia wokół krateru Shackleton.",
    notes:
      "Żeby mieć pewność, że te liczby się zgadzają, porównaliśmy je z danymi NASA i JPL. Pozycje Słońca i Ziemi różnią się od nich najwyżej o 0,0025 stopnia, a widoczność liczona w skali 18 lat o 1–2 punkty procentowe.",
  },
  {
    // BIZNES + FINAŁ
    side: "right",
    clip: "clip-hook-s.gif",
    title: "IM-1 przegrał przez jeden stok i jeden zachód Słońca. W Malapert widać oba.",
    extra: `<div class="outro">
      <img class="qr" src="../out/qr.png" alt="" />
      <div class="url">malapert.us</div>
      <div class="who">Każdy może tu spróbować wylądować. Szkoły i centra nauki dostają lekcje i grę za darmo, a firmy szybkie pierwsze sprawdzenie miejsca i daty.</div>
      <div class="who next">W kolejnym kroku: wszystkie regiony Artemis, polska wersja i gotowe scenariusze lekcji.</div>
      <div class="team">opsec demons x honda varadero xl125 2001<br />Tomasz Tłusty, Nikodem Marek, Michał Urbaniak</div>
    </div>`,
    notes:
      "Jak chcemy to rozwijać? Szkoły i centra nauki dostają lekcje i grę za darmo, a firmy szybkie pierwsze sprawdzenie miejsca i daty, zanim zapłacą za drogą analizę. W kolejnym kroku dodamy wszystkie 9 regionów Artemis, polską wersję i gotowe scenariusze lekcji dla nauczycieli.\n\nWróćmy na koniec do IM-1, który przegrał przez jeden stok i jeden zachód Słońca. W Malapert oba widać w kilka sekund, niezależnie od tego, czy jest się inżynierem, czy ma się dwanaście lat. Zapraszamy na malapert.us, gdzie każdy może spróbować wylądować.",
  },
];

const dir = new URL(".", import.meta.url).pathname;
const RECT = { right: [644, 270, 1216, 760], left: [60, 270, 1216, 760] } as const;

const html = (s: Slide) => `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8" />
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500&display=swap" rel="stylesheet" />
<link href="base.css" rel="stylesheet" />
</head>
<body class="clip-${s.side}">
  <h1>${s.title}</h1>
  ${s.body ? `<p>${s.body}</p>` : ""}
  ${s.extra ?? ""}
  <div class="clip"></div>
</body>
</html>
`;

const [cmd, out] = process.argv.slice(2);
if (cmd === "html") {
  for (const [i, s] of SLIDES.entries()) await Bun.write(`${dir}slides/s${i + 1}.html`, html(s));
  console.log(`wrote ${SLIDES.length} slides`);
} else if (cmd === "build") {
  const spec = SLIDES.map((s, i) => ({ png: `slide-${i + 1}.png`, gif: s.clip, rect: RECT[s.side], notes: s.notes }));
  await $`bun ${dir}build.ts ${out} ${JSON.stringify(spec)}`;
} else {
  console.error("usage: bun deck/deck.ts html | build <out.pptx>");
  process.exit(1);
}
