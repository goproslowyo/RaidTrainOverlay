# Translation review checklist

The non-English catalogs were machine-translated then hardened by an automated
back-translation + critic pass. These are the strings that pass flagged for a
**native speaker to confirm** — almost all are short, context-poor badges. A
reviewer only needs to eyeball the list for their language (verify live with
`overlay.html?event=demo&lang=<locale>&theme=departures`).

Severity: **high** = meaning could be off; med/low = tone/word-choice polish.

## Spanish (`es`)

- **high** `status.lead` — EN CABEZA replaces GUIA
- **med** `status.onTime` — A TIEMPO over EN HORA

## Brazilian Portuguese (`pt-BR`)

- **high** `overlay.played` — FEITO (="done") correctly avoids the "played a game" trap, but a native streamer might prefer JÁ FOI / TOCOU on the train-car badge. Confirm FEITO reads as "this slot's turn is over" in-context, not as a generic checkmark. Within budget (12).
- **high** `status.lead` — LÍDER conveys "leader" but the source sense is "head of the line" on the departures board (the lead streamer who already played but still heads the train). Confirm LÍDER reads right as a board status lamp vs. an alternative like À FRENTE; budget 10 allows it.
- **med** `overlay.conductor` — MAQUINISTA = train driver/engineer, the intended sense (not cobrador/maestro). Confirm a viewer reads it as the lead/organiser badge over the locomotive and not literally "the train's driver". 10 chars, budget 13.
- **med** `overlay.open` — LIVRE (="free/available") chosen for the unbooked-slot badge over ABERTA/VAGA. It must stay consistent with openslotsHint which also uses LIVRE (it does). Confirm LIVRE is the most natural "sign up here" cue on a car.
- **med** `status.departed` — PARTIU (3rd person "it departed") used as a board status lamp. Departures boards in Brazil sometimes show PARTIU/EMBARCOU; confirm PARTIU is the idiomatic split-flap status vs. an alternative like SAIU. Budget 12.
- **med** `time.m` — Changed from bare "m" to "min" to disambiguate minutes (bare m can read as meters/months). Renders as e.g. "30min" with no space, matching the compact-unit convention. Confirm "2h30min" looks right on the fixed-width car and does not overflow vs. the English single-letter "m".
- **low** `overlay.signUp` — inscreva-se! is correct imperative + informal. Confirm casual register is desired over the snappier "entra!"; 12 chars within budget 14.
- **low** `configurator.theme.paper` — Two phrasings mirror English: configurator "Recorte de papel" (cutout) vs landing "Papel cartão" (construction paper). Intentional, but a reviewer may prefer one consistent label across both surfaces.
- **low** `configurator.modeMarquee` — Marquee rendered as "Letreiro" (scrolling-ticker sense) consistently across modeMarquee/intervalNoteShuffle/themeHint. Confirm "letreiro" reads as a scrolling ticker to Brazilian streamers rather than a static sign.

## Italian (`it`)

- **med** `status.lead` — Rendered "CAPOTRENO" (literally the railway head conductor) to fit the departures-board rail metaphor and the 10-char budget. The English DESCRIPTION says "Lead / head of the line" for a streamer who has played but still heads the train. CAPOTRENO is idiomatic and on-theme but is the railway role, not a generic "lead"; it also overlaps conceptually with overlay.conductor (MACCHINISTA). Confirm a native is happy with CAPOTRENO vs. alternatives like CAPOFILA (head of the line) or TESTA.
- **med** `overlay.conductor` — "MACCHINISTA" (engine driver, 11 chars, budget 13) marks the organiser/locomotive lead. It is the correct driver-of-the-locomotive sense, but confirm it doesn't read as confusingly distinct from status.lead/CAPOTRENO when both themes are seen by the same viewer. Alternative CAPOTRENO was reserved for the status lamp.
- **med** `overlay.played` — "FATTO" (done) for a slot whose turn is over (NOT "played a game"). It is short and correct past-state, but it is informal/blunt; a native may prefer "CONCLUSO" or "FINITO" for a status stamp. Within budget (12) either way. Confirm tone/register.
- **low** `overlay.open` — "LIBERO" for an unbooked slot a viewer can claim (available/free). Natural and matches train-compartment usage, and the configurator hint LIBERO badge matches. Confirm it reads as "sign-up-able" rather than just "vacant".
- **low** `overlay.staff` — Kept the English loanword "STAFF" (common in Italian). Confirm it is preferred over a native term like "TEAM" or "ORGANIZZAZIONE" given the 10-char badge budget.
- **low** `configurator.theme.flat` — "Cartoon flat" uses the English "cartoon" to avoid "cartone" (= cardboard). Confirm a native prefers this over "Stile cartoon piatto" or simply "Flat" (the landing variant is just "Flat").
- **low** `configurator.presets` — Switched the whole presets family (presets/presetNamePlaceholder/presetNameFirst/presetReplace/presetSaved/presetLoaded/presetDeleteConfirm/presetDeleted) to the loanword "Preset" instead of the draft's "Preimpostazioni". Idiomatic in Italian software UI, but confirm consistency is desired over the fully-native term.
- **low** `configurator.obs2` — OBS "Sources" rendered as "Fonti" (and "fonte" in obs7/obsChanged/how2) to match OBS Studio's Italian localization. OBS Italian has historically also used "Sorgenti"/"Origini"; verify against the OBS version the audience runs so instructions read native.
- **low** `time.d` — Day unit token rendered "g" (giorno). Correct Italian convention, but differs from English "d"; confirm "g" is unambiguous next to "h"/"m" in the compact 2g3h-style assembly on the fixed-width car.

## German (`de`)

- **med** `overlay.played` — Chose GELAUFEN ("it's done/over", idiomatic past-state) over draft FERTIG ("finished/ready"). Back-translation "RAN" confirms the right sense, but a native streamer should confirm GELAUFEN reads naturally as a stamp on a slot whose turn is over rather than literally "walked/ran". VORBEI or FERTIG are fallbacks if GELAUFEN feels off on the car.
- **med** `status.lead` — KOPF for the lead/head-of-train status lamp (a streamer who has played but still heads the train). Zugkopf = head of train, so KOPF is defensible and short (4 chars), but standalone KOPF could read as literal "head". SPITZE ("front/lead") is a candidate alternative; native confirmation on the departures-board context recommended.
- **low** `overlay.conductor` — LOKFÜHRER (engine driver) for the locomotive lead/organiser. Correct rail sense and within budget (9/13). A native may prefer ZUGFÜHRER (train guard/conductor) — but ZUGFÜHRER is the guard, not the driver, so LOKFÜHRER better matches the 'drives the locomotive' description. Confirm preferred term.
- **low** `status.boarding` — EINSTIEG ("boarding/getting on") for the live-now departures status. Natural German rail signage word; confirm it reads as an active 'boarding now' lamp rather than the noun 'entrance'.
- **low** `overlay.signUp` — mitmachen! ("join in!") as the casual CTA under FREI. Friendly and within budget; anmelden! ("sign up!") is the more literal sign-up verb. Confirm which the streamer audience expects.
- **low** `landing.howTitle` — Used the apostrophized colloquial "So funktioniert’s" (curly apostrophe U+2019) for a friendlier register than the draft's "So funktioniert es". Confirm the casual contraction is desired in a section heading.

## Dutch (`nl`)

- **high** `overlay.conductor` — Changed CONDUCTEUR -> MACHINIST. In Dutch rail a 'conducteur' is the ticket inspector/guard; the engine driver (the lead/organiser who drives the locomotive, per DESCRIPTION) is the 'machinist'. Confirm MACHINIST reads right on the locomotive badge and fits the fixed-width car (budget 13, MACHINIST = 9).
- **high** `overlay.played` — GEWEEST (lit. 'been/over'). Idiomatic Dutch for 'already happened', avoids the 'played a game' trap, fits budget 12. But it's casual/elliptical as a stamp; a native may prefer GEHAD or GEDAAN. Confirm it reads clearly as a done/aired stamp on the car.
- **med** `departures.header` — VERTREK is singular ('departure') for an English plural 'DEPARTURES'. Real NL departure boards (NS/Schiphol) do use the singular 'Vertrek' as a heading, so this should be right, but please confirm vs. 'VERTREKKEN'. Budget 12 (VERTREK = 7).
- **med** `status.lead` — KOP for 'LEAD / head of the line' (matches German KOPF). Confirm KOP reads naturally as a departures-board status lamp on the lead streamer rather than e.g. 'KOPLOPER' (too long, budget 10).
- **med** `status.boarding` — INSTAPPEN (= 'boarding/get in'). 9 chars, within budget 12, idiomatic rail term. Confirm it conveys 'live now' as a status lamp.
- **low** `overlay.staff` — CREW (English loanword, common in NL streaming). Confirm preferred over 'TEAM' (German uses TEAM); budget 10.
- **low** `time.h` — 'u' (uur) as the hours token — natural Dutch in time contexts (14u30), unlike German 'h'. Confirm 'u' is preferred over 'h' for the compact '2u' rendering.
- **low** `configurator.theme.shuffle` — 'Shuffle' kept as an English loanword (common in NL UI) with the explanatory 'wissel door alle thema's'. Confirm leaving 'Shuffle' untranslated is desired; the <strong>Shuffle</strong> in themeHint matches it.
- **low** `configurator.tabLineup` — 'Line-up' kept as a loanword (common in NL events/music). Used consistently across tabLineup, refreshHint, slugDemo, demoNote. Confirm preferred over a fully Dutch term.

## Danish (`da`)

- **high** `overlay.staff` — Left as CREW (English loanword) to match the draft and CANDIDATE_A; EN source is STAFF, so this is leftover English. Confirm vs Danish STAB (staff) or HOLD (team). Budget 10.
- **high** `status.boarding` — Changed to BOARDING (the loanword used on real Danish departure boards) from the over-budget draft OMBORDSTIGNING (15>12) and CANDIDATE_A's wrong-sense OMBORD (=aboard, a state). Confirm it reads as the departures lamp meaning 'this streamer is live now'. Fits budget at 8.
- **high** `status.lead` — FØRER for the lead streamer who has played but still heads the train; can read as driver/leader. Confirm it conveys 'head of the line' rather than locomotive driver. Alt: FORREST. Budget 10.
- **med** `overlay.conductor` — KONDUKTØR (9 chars, budget 13). In Danish KONDUKTØR is the ticket-checking conductor, not the driver/lead. Confirm it conveys 'lead' or prefer LOKOFØRER (likely too long) / FØRER.
- **med** `overlay.played` — FÆRDIG (done/finished) chosen over CANDIDATE_A's SPILLET per the description's explicit warning. Confirm FÆRDIG reads as a past-state stamp meaning 'turn over / already aired'. Budget 12.
- **med** `overlay.open` — LEDIG (available/free) as the unbooked-slot badge; openslotsHint uses LEDIG-vogne. Confirm singular LEDIG works as the badge and that LEDIG-vogne reads naturally. Budget 10.
- **low** `configurator.captionPass` — Rendered 'hvert {mins}. minut' (ordinal-style). Confirm this reads correctly for both 1 and many minutes vs 'hvert {mins} minut'.
- **low** `configurator.tabLineup` — Lineup kept as an English loanword, matching GLOSSARY usage elsewhere. Confirm consistency is intended vs a Danish term like Program.

## Lithuanian (`lt`)

- **high** `overlay.played` — Chose 'BAIGTA' (finished/ended) over draft 'ATLIKTA' for the 'turn is over / already aired' sense. 'BAIGTA' (neuter, 'it is finished') reads well as a status stamp, but a native streamer might prefer 'BAIGĖSI' or 'PRAĖJO'. Confirm it does not read as 'the game is over'.
- **high** `status.onTime` — 'PAGAL LAIKĄ' chosen to fit the 12-char badge budget (draft 'PAGAL GRAFIKĄ' was 13/14, over budget). 'PAGAL GRAFIKĄ' is the more idiomatic rail/airport 'on schedule'; 'PAGAL LAIKĄ' is understandable but slightly less standard. Confirm acceptable, or consider 'LAIKU' (shorter, 'on time').
- **high** `status.lead` — 'PRIEKYJE' (= 'in front/ahead') for the lead streamer who has played but still heads the train. Captures 'head of the line' but loses any 'leader' nuance. A native should confirm vs. alternatives like 'PRIEKINIS' or 'VEDA'.
- **med** `overlay.conductor` — 'MAŠINISTAS' = train engine driver (correct for the locomotive/organiser). Confirm preferred over 'KONDUKTORIUS' (which in LT means ticket-collector, so MAŠINISTAS is the right sense for the lead).
- **med** `overlay.staff` — 'KOMANDA' (= team/crew) for the organiser/tender 'staff' caption. Natural but also means 'command'; confirm it reads as 'team/crew' in this tender-card context.
- **med** `configurator.obs6` — CANDIDATE_A's '<strong>ОК</strong>' used Cyrillic О+К (homoglyph bug). Replaced with Latin 'Gerai' to match OBS Lithuanian UI. Confirm OBS LT actually labels this button 'Gerai' (vs. an untranslated 'OK').
- **low** `configurator.modeMarquee` — 'Slankiojimas' (scrolling) used consistently for 'Marquee' mode across mode/interval keys. Confirm the metaphor reads naturally throughout (vs. keeping 'marquee'/'bėganti eilutė').
- **low** `landing.credit` — 'Sukurta su ❤️ transliuotojo, transliuotojams' — 'by a streamer, for streamers' rendered with genitive 'transliuotojo' + dative 'transliuotojams'. Grammatically sound but confirm it flows naturally and the ❤️ placement reads well.
- **low** `configurator.tzHint` — 'abs

## French (`fr`)

- **med** `overlay.conductor` — "CONDUCTEUR" is the literal train-driver sense, which fits, but in French streaming/event context an organiser might more naturally read as "CHEF DE TRAIN" (too long, 12+ chars, near budget 13) or be left as the role title. Confirm "CONDUCTEUR" reads as the lead/organiser and not as a generic "driver". Within budget (10/13).
- **med** `status.lead` — "TÊTE" (head/front of the line) for the lead streamer who has played but still heads the train. A native should confirm "TÊTE" reads clearly as a status lamp on a departures board; alternatives like "EN TÊTE" (8 chars, within budget 10) may read more naturally as a status.
- **med** `overlay.now` — "EN COURS" is exactly at the 8-char badge budget (incl. space). Confirm it does not overflow/auto-shrink on the fixed-width car; if it does, consider "LIVE" or "DIRECT" (6) as the live-now badge.
- **med** `status.boarding` — "EMBARQUEMENT" is exactly at the 12-char budget. Correct rail/airport "boarding" sense, but confirm it fits the fixed-width lamp without shrinking; "À BORD" is a shorter fallback if needed.
- **med** `time.m` — Changed to "min" (3 chars, no space) from the draft's "m", because "m" reads as metres in French. Confirm "min" fits the fixed-width car when assembled as e.g. "2h30min" / "30min" and that the no-space convention is acceptable; if width is tight, "m" may be retained.
- **low** `overlay.played` — "PASSÉ" for a slot whose turn is over (done/already aired), not "played a game". Correct past-state sense; confirm it doesn't read as "the past" rather than "already aired". "TERMINÉ" (7) is a longer alternative within budget 12.
- **low** `status.departed` — "PARTI" (departed/gone) on the departures board. Confirm it reads as the rail/airport "departed" status; "DÉPART" or "PARTI" both plausible — current choice is short and within budget.
- **low** `configurator.obs2` — "Navigateur web" used as OBS's localized Browser-source term (per the supplied app-official glossary). Verify against the actual OBS French UI, which historically labels the source simply "Navigateur"; if the live OBS shows "Navigateur", align obs2/obsChanged/how2 accordingly.
- **low** `overlay.staff` — "ÉQUIPE" (team/crew) caption on the organiser/tender card. Reads naturally; confirm it's the intended "event staff/crew" sense and not e.g. "STAFF" (often borrowed as-is in French gaming).
- **low** `configurator.modeMarquee` — "Marquee" kept untranslated as the mode name (per GLOSSARY allowance). Confirm French streamers recognise "Marquee" as the scrolling-ticker mode, or whether "Défilement" would read more naturally as the label.

## Spanish regional (es-ES / es-MX)

- **low** `configurator.spotlightLabel` — Removed because streamers is natural in Spain too and canales is a meaning change.
- **low** `configurator.refreshHint` — Removed because sobrecargar is standard in Spain and saturar is only a marginal stylistic preference.
- **low** `overlay.signUp` — es-MX uses registrate per the brief, but base anotate is also natural in Mexico.
- **medium** `i18n-completeness-test` — Regional catalogs are machine-translated drafts pending native review.

---
Generated from the i18n quality-pass workflow. As natives confirm or correct
strings, delete the resolved lines. See [TRANSLATING.md](../TRANSLATING.md).
