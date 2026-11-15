/**
 * The pitch deck in one place: slide text (Polish), which clip goes where, and the speaker notes.
 *
 *   bun deck/deck.ts html          writes deck/slides/s1.html … s7.html (render each to deck/out/slide-N.png)
 *   bun deck/deck.ts build <out>   assembles the PPTX from the rendered PNGs and clips via deck/build.ts
 */
import { $ } from "bun";

interface Slide {
  side: "right" | "left";
  clip: string;
  title: string;
  /** paragraph HTML; <b> marks numbers shown in white */
  body?: string;
  /** extra HTML for the text column (slide 7: QR and team) */
  extra?: string;
  notes: string;
}

const SLIDES: Slide[] = [
  {
    side: "right",
    clip: "clip-hook-s.gif",
    title: "Tydzień po lądowaniu lądownik IM-1 stracił Słońce i zamilkł.",
    body: "Luty 2024, okolice bieguna południowego Księżyca. Lądownik przewrócił się na stoku o nachyleniu <b>12°</b> i działał <b>7 dni</b>. Na nagraniu: <b>10 dni</b> światła nad kraterem Shackleton w 13 sekund.",
    notes:
      "Luty 2024. Lądownik IM-1 siada w rejonie bieguna Księżyca, przewraca się i po tygodniu milknie. Słońce zeszło z jedynego panelu, który jeszcze dawał prąd.",
  },
  {
    side: "left",
    clip: "clip-sun.gif",
    title: "Na biegunie Słońce wznosi się najwyżej około 1,5° nad horyzont.",
    body: "Jedno wzgórze albo tydzień opóźnienia startu decyduje, czy lądownik ma prąd i łączność z Ziemią. Na nagraniu widok z lądownika: Słońce sunie wzdłuż horyzontu, Ziemia wisi po lewej.",
    notes:
      "Na biegunie Słońce wisi półtora stopnia nad horyzontem. Jedno wzgórze albo tydzień opóźnienia startu decyduje, czy lądownik ma prąd i łączność z Ziemią. Narzędzia, które to liczą, są dla ekspertów. Opis wyzwania mówi wprost, że są za trudne do szybkiego porównania.",
  },
  {
    side: "right",
    clip: "clip-slip.gif",
    title: "Start opóźnia się o tydzień i to samo lądowisko przestaje się nadawać.",
    body: "Krawędź krateru Shackleton, lądowanie 15 stycznia 2027: łączność z Ziemią przez <b>63%</b> czasu, bateria cały czas pełna. Tydzień później: <b>16%</b> łączności, bateria spada do <b>18%</b>. Liczone na rzeczywistym terenie z danych NASA LOLA.",
    notes:
      "To nasza aplikacja. Prawdziwy teren z danych NASA, krater Shackleton. Stawiam lądownik na krawędzi, lądowanie 15 stycznia 2027. Słońce jest, łączność z Ziemią przez 63 procent czasu, ocena: można lądować. Teraz rakieta spóźnia się o tydzień. Jedno kliknięcie. Łączność spada do 16 procent, bateria do 18, ocena: nie lądować. To samo miejsce, siedem dni różnicy.",
  },
  {
    side: "left",
    clip: "clip-ai.gif",
    title: "Opisujesz misję jednym zdaniem, a aplikacja znajduje lądowisko.",
    body: "Asystent AI ustawia daty i przeszukuje <b>66 049</b> punktów terenu. Każda liczba w jego odpowiedzi pochodzi z obliczeń aplikacji, a wynik od razu trafia do raportu.",
    notes:
      "Nie trzeba zgadywać, gdzie postawić lądownik. Wpisuję wymagania misji zwykłym zdaniem. Asystent ustawia daty, przeszukuje 66 tysięcy punktów terenu i stawia lądownik w najlepszym. Cytuje tylko liczby, które policzyła aplikacja.",
  },
  {
    side: "right",
    clip: "clip-game.gif",
    title: "Uczeń gra na tych samych danych, na których pracuje inżynier.",
    body: "Ma <b>45 sekund</b> na wybór lądowiska. Stok o nachyleniu <b>26°</b> kończy misję przewróceniem, tak jak było z IM-1. Obok gry są <b>4</b> lekcje po 30 sekund.",
    notes:
      "I teraz to, co nas wyróżnia. Przełączam tryb. Ten sam Księżyc, te same obliczenia, ale dla ucznia. W grze ma 45 sekund na wybór lądowiska. Jak wybierze stok, lądownik się przewraca, tak jak IM-1. Niczego nie udajemy, uczeń gra na danych inżyniera.",
  },
  {
    side: "left",
    clip: "report.png",
    title: "Raport PDF zbiera całą analizę w jednym dokumencie.",
    body: "Porównanie lądowników z oceną GO albo NO-GO, wykresy Słońca, Ziemi i baterii, najlepsze miejsca z wyszukiwania, założenia i źródła. Pozycje Słońca i Ziemi zgadzają się z NASA JPL Horizons do <b>0,004°</b>, nasłonecznienie z mapami NASA ze średnim błędem najwyżej <b>2,1 pkt proc.</b>",
    notes:
      "Wynik da się zabrać ze sobą. Raport PDF porównuje lądowniki, pokazuje wykresy Słońca, Ziemi i baterii, najlepsze miejsca z wyszukiwania, założenia i źródła. Sprawdziliśmy wyniki: pozycje Słońca i Ziemi zgadzają się z kalkulatorem NASA JPL do czterech tysięcznych stopnia, a nasłonecznienie z mapami NASA z dokładnością do około dwóch punktów procentowych.",
  },
  {
    side: "right",
    clip: "clip-heat-s.gif",
    title: "Ten sam silnik obliczeń, od szkolnej klasy do planowania misji.",
    extra: `<div class="outro">
      <img class="qr" src="../out/qr.png" alt="" />
      <div class="url">malapert.us</div>
      <div class="who">Szkoły i centra nauki korzystają za darmo. Firmy budujące lądowniki dostają szybkie pierwsze sprawdzenie miejsca i daty.</div>
      <div class="team">opsec demons x honda varadero xl125 2001<br />Tomasz Tłusty, Nikodem Marek, Michał Urbaniak</div>
    </div>`,
    notes:
      "Dla kogo? Szkoły i centra nauki dostają lekcje i grę za darmo. Firmy budujące lądowniki dostają szybkie pierwsze sprawdzenie miejsca i daty. Jeden silnik, od klasy szkolnej do sali planowania misji. Opsec Demons razy Honda Varadero, dziękujemy.",
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
