# LevelUp — leer omgaan met geld met je eigen uitgaven

Proof of concept voor de **KBC-case** van de Tectonic Hackathon 2026.

Jongeren leren omgaan met geld via een spel dat hun **eigen transacties** als voorbeeld gebruikt:
Spotify en Netflix, snacks op school, een eerste loonstrook, "achteraf betalen". Terwijl ze spelen, groeit
een **geldprofiel** met een niveau (1–5) voor acht onderwerpen: betalen, sparen, budget, abonnementen,
beleggen, loon & werk, huren & wonen, lenen & schulden. Met **"Wat als ik…?"** simuleren ze plannen zoals
*"ik wil op kot"*, *"ik wil een studentenjob"* of *"ik wil op vakantie"*: wat moet je regelen, wat verandert
er aan je maandbudget, en wat kost het eenmalig? **Ouders** volgen de vooruitgang en passen zakgeld, limieten
en leerinhoud aan.

## Hoe dit de KBC-case beantwoordt

| KBC-vraag | In LevelUp |
|---|---|
| Welke signalen tonen wat een klant nodig heeft? | Transacties (abonnement na gratis proef, snackuitgaven, loon, achteraf betalen) en spelgedrag (juiste/foute antwoorden, bekeken scenario's). |
| Klanten herkennen op situatie, gedrag en intentie | Leeftijd en levensfase, een niveau per geldonderwerp plus een "geldtype", en de "ik wil…"-scenario's als **intentiesignaal** (de ouder ziet: *"Lena verkende 'Gaan studeren'"*). |
| Personalisatie die zich automatisch aanpast | Missies met de eigen cijfers, het zwakste onderwerp eerst, het focus-onderwerp van de ouder bovenaan en inhoud per leeftijd (de simulator opent pas vanaf 14 jaar). |
| Over producten en kanalen heen | Eén profiel voor kind, ouder en (later) de bank-app of het kantoor. |
| Impact voor miljoenen klanten tegelijk | Missies en scenario's zijn **sjablonen** die zich vullen met ieders eigen transacties: geen handwerk per klant. |

## Hoe draaien

Er is niets te installeren, er is geen build-stap en geen backend. Er is enkel een statische webserver nodig:

```bash
cd KBC-game
python3 -m http.server 8000
```

Open daarna **http://localhost:8000**. Is poort 8000 al bezet (bv. door een ander project)? Kies dan een andere
poort, bv. `python3 -m http.server 8080`. `index.html` rechtstreeks openen werkt ook in Chrome. Via de server
blijven de pagina's in elke browser betrouwbaar met elkaar verbonden.

## Pagina's

- **Start** (`index.html`): het concept in 3 stappen. Je kiest wie je bent: Lena (16), Mats (11) of ouder Sofie.
- **Spel** (`spel.html`): missies uit je eigen uitgaven (quiz + XP + level-ups) en de "Wat als ik…?"-simulator
  met 6 scenario's: studeren, studentenjob, eerste job, alleen huren, vakantie en beleggen.
- **Profiel** (`profiel.html`): persoonlijke info, een radargrafiek van de niveaus, en per onderwerp de signalen
  uit de uitgaven naast wat het kind in het spel leerde. Verder badges, spaardoelen, plannen, de afspraken met de
  ouder en de recente transacties.
- **Ouders** (`ouders.html`): per kind het niveau en de vooruitgang (nu tegenover 4 weken geleden), een blok
  "Wat valt op?" met gesprekstips, de activiteit, en de instellingen (zakgeld, sparen, limieten, onderwerpen
  vergrendelen, focus-onderwerp, beloning, persoonlijke gegevens).

Alles hangt live samen. Een missie in het spel verhoogt meteen het niveau op het profiel en verschijnt bij de
ouder. Een onderwerp dat de ouder vergrendelt, staat meteen op slot in het spel. Dat werkt ook tussen twee
tabbladen naast elkaar.

## Demoscript (± 2,5 minuut)

1. **Start** → klik op **Lena**.
2. **Spel**: de missie "Abonnementen-check" staat bovenaan (⭐ aangeraden door de ouder) en toont haar echte
   Spotify-, Netflix- en Disney+-betalingen. Kies **± €348** → +60 XP, level-up naar niveau 3, beloning van de
   ouder en een nieuwe badge.
3. Typ in "Wat als ik…?" **ik wil op kot** → Simuleer. Je ziet de checklist, het maandbudget Nu/Straks
   (€28,97 tekort, precies haar abonnementen) en de eenmalige kosten. Wissel naar **Thuis wonen & pendelen**
   en klik op **Simulatie afronden**.
4. Klik op **Op vakantie**: met haar eigen besparingen haalt ze Interrail in 6 maanden in plaats van 24.
5. **Profiel**: Abonnementen staat op niveau 3, de radar groeide, en "Gaan studeren" staat bij "Mijn plannen".
6. **Ouders**: de nieuwe activiteit en de intentie *"Gaan studeren"* met een gesprekstip. Vink **Beleggen** aan
   bij "vergrendelen", zet het zakgeld op **55** en klik op **Opslaan**.
7. Terug naar **Spel**: beleggen staat op 🔒. Het **Profiel** toont €55 zakgeld.
8. Optioneel: kies **Mats** (11): eenvoudigere missies (Robux, snoep, sparen) en de simulator nog op slot.

Met **↺ Reset demo** onderaan elke pagina begin je opnieuw.

## Wat is fake of niet af

- **Alle data is fictief en hardcoded** (`js/data.js`): het gezin Janssens, rekeningen, transacties, signalen en
  eerdere activiteit. Er is geen koppeling met echte bankdata.
- **Geen login en geen backend**: elke pagina is voor iedereen bereikbaar. Voortgang en ouderinstellingen staan in
  de `localStorage` van je browser. Een kind met technische kennis zou die dus kunnen aanpassen. In een echt
  product horen rollen en rechten server-side.
- **Vrije tekst** ("ik wil…") wordt herkend op trefwoorden, zonder AI.
- **Bedragen en regels zijn vereenvoudigd**: studentenjob-bijdrage, huurwaarborg, inschrijvingsgeld en
  rendementen. Het gaat om illustratie, niet om financieel advies.
- Enkel Lena heeft scenario's. Voor Mats (11) staat de simulator bewust op slot.

## Security

- Een statische site: geen server-logica, geen API-keys, geen externe scripts of CDN's.
- Een Content-Security-Policy op elke pagina (`script-src 'self'`, geen inline scripts).
- Alle dynamische tekst gaat via een auto-escaping template-functie (`html` in `js/app.js`). Vrije tekst en door
  de ouder aangepaste namen worden dus als tekst getoond, nooit als HTML.
- Invoer wordt begrensd en opgeschoond (lengte, getallen binnen min/max, enkel bekende onderwerpen).

## Structuur

```
index.html · spel.html · profiel.html · ouders.html   de vier pagina's
css/style.css                                         gedeelde stijl
js/data.js                                            alle demo-data (gezin, transacties, missies, scenario's)
js/app.js                                             state, niveaus/XP, veilige templates, radar, navigatie
js/start.js · js/spel.js · js/profiel.js · js/ouders.js   logica per pagina
```
