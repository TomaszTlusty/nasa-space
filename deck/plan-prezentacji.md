# Prezentacja: który fragment tekstu na którym slajdzie

Tekst mówiony to plik „Poprawiona prezentacja WORD.docx”. Slajdy idą w tej samej kolejności co tekst. Ten sam tekst jest w notatkach prelegenta w PPTX, podzielony na slajdy.

Zespół: opsec demons x honda varadero xl125 2001 (Tomasz Tłusty, Nikodem Marek, Michał Urbaniak)

## Kiedy przełączyć slajd

| Slajd | Część tekstu | Zaczyna się od słów | Na ekranie |
|---|---|---|---|
| 1 | HOOK | „W lutym 2024 lądownik IM-1…” | Cienie nad kraterem Shackleton, potem widok z lądownika ze Słońcem tuż nad horyzontem |
| 2 | PROBLEM | „I to nie był tylko pech…” | To samo miejsce na krawędzi krateru: GO, a po przesunięciu o tydzień NO-GO |
| 3 | ROZWIĄZANIE, tryb naukowca | „Dlatego zbudowaliśmy Malapert…” | Cztery mapy po kolei, na końcu porównanie dwóch miejsc |
| 4 | ROZWIĄZANIE, szukanie miejsca | „A jeśli w ogóle nie wiadomo, gdzie lądować…” | Wyszukiwarka, asystent AI, raport PDF |
| 5 | ROZWIĄZANIE, tryb ucznia | „Te same obliczenia napędzają tryb ucznia…” | LUNA w kraterze i na grzbiecie, potem gra z przewróceniem lądownika |
| 6 | WARTOŚĆ | „Żeby mieć pewność, że te liczby się zgadzają…” | Mapa średniego nasłonecznienia |
| 7 | BIZNES i FINAŁ | „Jak chcemy to rozwijać?” | Krater z pierwszego slajdu, kod QR do malapert.us, zespół |

Zdanie „Dzięki temu z Malaperta skorzystają…” pada jeszcze na slajdzie 5.

## Czas

Tekst ma 613 słów. Przy zwykłym tempie mówienia to ponad 4 minuty, a limit to 2,5 minuty. Zmierzcie stoperem przed wystąpieniem.

## Pytania jury (krótkie odpowiedzi)

| Pytanie | Odpowiedź |
|---|---|
| Czy to realny problem? | Tak. IM-1 zgasł po tygodniu, a opis wyzwania sam podaje opóźnienia startu jako powód. |
| Co jest innowacyjne? | Tryb dla uczniów działa na tym samym silniku co tryb naukowca. W projektach, które sprawdziliśmy, tego nie znaleźliśmy. |
| Czy działa? | Tak, można kliknąć na żywo. Wyniki porównane z JPL Horizons i mapami NASA. |
| Kto skorzysta? | Planiści misji i firmy budujące lądowniki, a z drugiej strony nauczyciele, uczniowie i centra nauki. |
| Jak to rozwinąć? | Wszystkie regiony Artemis (teraz są dwa: Shackleton i Malapert), polska wersja, gotowe scenariusze lekcji. |
| Gdzie było AI? | AI pomagało pisać kod. Pomysł na dwa tryby, przewodnika i grę jest nasz. Asystent w aplikacji jest oznaczony jako AI. |

## Pliki

- `malapert-prezentacja.pptx`: 7 slajdów, GIF-y grają same w pętli. Tekst mówiony jest w notatkach prelegenta.
- `malapert-prezentacja-zapas.pdf`: te same slajdy jako nieruchome kadry, na wypadek gdyby PowerPoint nie odtworzył GIF-ów.
- Odtworzenie: `bun deck/deck.ts html`, render PNG, `bun deck/deck.ts build <plik.pptx>`; nagrania przez `deck/record.mjs`, przycięcie przez `deck/clip.ts`.
