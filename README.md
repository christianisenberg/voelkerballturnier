# Völkerballturnier 2026

Mobile Web-App für 7 Teams, 21 Vorrundenspiele, 2 Halbfinals und ein Finale. Deutsch, ohne Werbung und ohne zusätzliche Frontend-Abhängigkeiten.

**Start:** [Deployment-Anleitung](DEPLOYMENT.md) öffnen. Die Anwendung ist fertig vorbereitet, aber noch nicht mit einem Supabase-Projekt verbunden oder öffentlich veröffentlicht. Ohne Konfiguration zeigt sie den leeren Spielplan als deutlich markierte Vorschau.

- Zuschauer: öffentliche Tabelle, automatische Aktualisierung alle 15 Sekunden, Spielplan und Finalrunde. Keine Schreibrechte.
- Schiedsrichter: `#admin` am Ende der Seitenadresse; Passwortanmeldung, große Plus-/Minus-Tasten, Speichern und Korrigieren.
- Passwort: wird separat im Supabase SQL Editor gesetzt. Es ist absichtlich weder im Browsercode noch im Repository enthalten.
- Datensicherheit: serverseitige Wertung, private Passwort-/Sitzungstabellen, gesperrte direkte Datenbank-Schreibzugriffe, Sitzung für 12 Stunden, global maximal 10 Anmeldeversuche je 15-Minuten-Fenster, Versionsprüfung gegen verlorene Änderungen und privates Änderungsprotokoll.
- Vorrundenkorrekturen aktualisieren die Setzung. KO-Ergebnisse mit geänderten Teilnehmern werden nach Hinweis verworfen.

## Dateien

| Datei/Ordner | Zweck |
|---|---|
| `docs/` | Öffentliche Webseite; dies ist der GitHub-Pages-Ordner |
| `docs/config.js` | Zwei öffentliche Supabase-Verbindungswerte |
| `docs/engine.js` | Wertung und Spielplan |
| `supabase/setup.sql` | Datenbank, Zugriffsrechte, Anmeldung und atomisches Speichern |
| `supabase/functions/tournament/` | Geschützter Schreibzugriff |
| `supabase/functions/_shared/engine.js` | Kopie derselben Wertung für den Server |
| `SPIELPLAN.md` | Plan und Vergleich der Pausen |
| `PRUEFUNG.md` | Testumfang und verbleibender Live-Test |

## Lokal ansehen

Mit Node.js ab 22.13 im entpackten Projektordner:

```sh
npm start
```

Dann `http://127.0.0.1:4173` öffnen. Alternativ das vollständige Paket entpacken und `docs/index.html` per Doppelklick öffnen: Die mitgelieferte Browser-Version funktioniert auch direkt als lokale Datei. Es ist kein `npm install` nötig. Ohne Online-Konfiguration zeigt sie den Spielplan als Vorschau; gemeinsame Ergebnisse und Eingaben erfordern die Supabase-Einrichtung.

```sh
npm test
```

Nach Änderungen an `docs/app.js` oder `docs/engine.js` zuerst `npm run build`, dann Tests ausführen. Bei Regeländerungen zusätzlich die Edge Function erneut veröffentlichen. Browser und Server müssen dieselbe Regelversion verwenden. Die erzeugte `docs/app-bundle.js` wird mit ausgeliefert; beim bloßen Eintragen der Verbindungsdaten in `config.js` ist kein Build nötig.

## Festgelegte Details

Direkter Vergleich bedeutet bei zwei punktgleichen Teams das Ergebnis ihres direkten Spiels; bei mehr Teams die Punkte-Mini-Tabelle aller punktgleichen Teams. Danach gelten die gesamte Lebensdifferenz und die gesamten eigenen Restleben. Die Mini-Tabelle wird nicht rekursiv für kleinere Teilgruppen neu gebildet.

Ein durch alle vier Kriterien ungelöster Gleichstand wird mit `=` angezeigt. Betrifft er die Halbfinalplätze, bleibt deren Setzung gesperrt, bis der Schiedsrichter die angebotene serverseitige Losentscheidung bestätigt. Sie wird gespeichert, ist öffentlich erkennbar und beeinflusst nur vollständig gleiche Teams. Eine nachträgliche Änderung eines Vorrundenergebnisses hebt die Losentscheidung auf. Gleiche Ränge außerhalb der ersten vier müssen nicht ausgelost werden.

Reguläre Spieler beginnen in einer neuen Eingabe bei 0; Kapitäne bei 3. Die Mannschaftsstärke muss deshalb nicht vorab festgelegt werden. Es gibt keine sportliche Obergrenze oder Verknüpfung zwischen Spielerzahl und Kapitänsleben; lediglich ein technisches Eingabelimit von einer Million regulären Spielern schützt die Zahlendarstellung. Beide Kapitäne auf 0 ist immer ungültig. KO-Spiele erfordern genau einen Kapitän auf 0.

Die Finalzeiten sind Planzeiten. Bei Verlängerung wird vor Ort später begonnen; es gibt keinen automatischen Spielabbruch und keine Sudden-Death-Oberfläche.
