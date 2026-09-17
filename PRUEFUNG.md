# Prüfung und Grenzen

## Automatisch geprüft

35 erfolgreiche Tests (`npm test`, Node.js 24):

- 21 einzigartige Begegnungen, jedes Team sechs Spiele, keine direkten Folgeeinsätze.
- 2/1/0-Punkte, Restleben, 7:5 als Unentschieden, keine ungewünschte Plausibilitätsprüfung.
- Ungültige Zahlen und zwei Kapitäne auf 0 werden abgewiesen; KO-Unentschieden ebenfalls.
- Direkter Vergleich und Mini-Tabelle, vollständiger Gleichstand und gespeicherte Losentscheidung.
- Automatische Halbfinal- und Finalteilnehmer, Korrekturen und gezieltes Verwerfen ungültig gewordener KO-Ergebnisse.
- Geschützte Edge-Anfragen: fehlende/ungültige Sitzung, veraltete Revision, manipulierte Eingaben, Datenbankausfall, Anfragegröße und Methoden.
- Klassischer Browser-Start beider Ansichten ohne Modul-Imports, verständliche Startfehler, aktuelles ausgeliefertes Skript.

Die Edge-Tests führen den tatsächlichen Handler mit einer simulierten Datenbankschnittstelle aus. Sie ersetzen keinen Test in einem echten Supabase-Projekt.

## Im Browser geprüft

- Mobile Zuschauer- und Schiedsrichteransicht; große Plus-/Minus-Tasten ohne seitlichen Seitenüberlauf.
- Falsches Passwort, erfolgreiche Anmeldung, Speichern von 7:5 als Unentschieden und nachträgliche Korrektur zum Sieg.
- Richtige Tabellenpunkte nach Korrektur; keine Eingabeschaltflächen in der Zuschaueransicht.
- Nach der Startkorrektur: Beide Ansichten starten über den lokalen Webserver. Ohne Online-Konfiguration erscheint eine klare Vorschau bzw. Einrichtungsmeldung.

Die Browser-Bedienprüfung verwendet ausschließlich lokale Testdaten, keine echten Turnierergebnisse. Ein direkter Browseraufruf über `file://` war in der Prüfungsumgebung nicht erlaubt. Der dafür vorgesehene klassische Skriptstart ist durch die zusätzlichen automatischen Starttests abgedeckt.

## Vor dem Live-Einsatz

Es wurde kein Supabase-Projekt eingerichtet und keine GitHub-Pages-Seite veröffentlicht, da dafür hier keine Projektverbindung vorliegt. Die echten Datenbankrechte, Passwortprüfung, globale Begrenzung der Anmeldeversuche und der atomare Commit sind deshalb noch nicht gegen eine laufende Supabase-Datenbank geprüft.

Nach der Einrichtung kann `supabase/verify.sql` im SQL Editor ausgeführt werden. Es prüft diese Datenbankfunktionen innerhalb einer zurückgerollten Transaktion; das vorhandene Passwort und die Ergebnisse bleiben danach erhalten. Anschließend den Zwei-Geräte-Test aus `DEPLOYMENT.md` durchführen.
