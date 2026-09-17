# In etwa 20–30 Minuten online

Du brauchst ein kostenloses GitHub-Konto und ein kostenloses Supabase-Projekt. Eine eigene Domain ist nicht erforderlich. Veröffentlicht wird nur `docs/`; Passwort und geheime Schlüssel gehören niemals in diese Dateien oder in ein öffentliches Repository.

## 1. Supabase anlegen

1. Auf [supabase.com](https://supabase.com/dashboard) ein neues Projekt im **Free**-Tarif erstellen. Das Datenbankpasswort des Projekts ist etwas anderes als das Schiedsrichterpasswort.
2. Im Projekt den **SQL Editor** öffnen. Den gesamten Inhalt von `supabase/setup.sql` einfügen und **Run** wählen.
3. In einer **separaten SQL-Abfrage** das vereinbarte Schiedsrichterpasswort setzen. Dazu nur im SQL Editor den Platzhalter unten durch das bereits vereinbarte Passwort ersetzen, dann ausführen. Diese ausgefüllte Abfrage nicht ins GitHub-Repository übernehmen:

```sql
update tournament_private.auth
set password_hash = extensions.crypt(
  'HIER_DAS_VEREINBARTE_PASSWORT',
  extensions.gen_salt('bf', 12)
), attempts = 0, window_start = now()
where id = 1;
delete from tournament_private.sessions;
```

Das speichert einen gesalzenen Passwort-Hash und beendet gegebenenfalls vorhandene Sitzungen. Supabase Auth mit E-Mail-Konten wird für diese App nicht benötigt. Das kurze, vereinbarte Passwort wird unterstützt; die Anmeldung ist durch einen globalen Versuchszähler begrenzt.

## 2. Geschützten Schreibzugriff veröffentlichen

[Node.js LTS](https://nodejs.org/) installieren, falls es noch fehlt. Im entpackten Ordner `voelkerball` ein Terminal öffnen und diese Befehle einzeln ausführen:

```sh
npx supabase login
npx supabase link --project-ref DEINE_PROJEKT_ID
npx supabase functions deploy tournament --no-verify-jwt
```

`DEINE_PROJEKT_ID` ist die Project Reference aus den Supabase-Projekteinstellungen, also der Teil vor `.supabase.co` in der Projekt-URL. Bei `npx` die Installation des offiziellen Supabase-CLI-Pakets bestätigen. Beim Verknüpfen gegebenenfalls das **Datenbankpasswort** aus Schritt 1 eingeben.

`--no-verify-jwt` ist hier absichtlich nötig: Die App verwendet ihre eigene serverseitig geprüfte Schiedsrichtersitzung. Jede Speicherung prüft diese Sitzung, die Spielregeln und den aktuellen Datenstand. Der Service-Schlüssel ist ausschließlich in der Edge-Umgebung verfügbar; Supabase stellt `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` dort automatisch bereit. Keinen Service-Schlüssel in `config.js` eintragen.

## 3. Webseite verbinden

Im Supabase-Projekt aus dem **Connect**-Dialog bzw. den API-Einstellungen die **Project URL** und den **Publishable key** kopieren. In `docs/config.js` eintragen:

```js
window.VOELKERBALL_CONFIG = {
  supabaseUrl: 'https://DEINE_PROJEKT_ID.supabase.co',
  publishableKey: 'sb_publishable_DEIN_OEFFENTLICHER_SCHLUESSEL',
};
```

Die URL ohne abschließenden Schrägstrich eintragen. Beide Werte dürfen öffentlich sein. Die Zugriffsrechte in der Datenbank verhindern damit Änderungen. Ein vorhandener alter `anon`-Schlüssel ist ebenfalls möglich; niemals `service_role` oder `sb_secret_…` verwenden.

## 4. GitHub Pages einschalten

1. Auf GitHub ein neues **öffentliches** Repository, z. B. `voelkerballturnier`, erstellen.
2. Den Inhalt des Projektordners hochladen, sodass `docs/index.html` direkt unter dem Repository liegt. **Nicht die ZIP-Datei hochladen.** Die mitgelieferten Dateien enthalten keine Zugangsdaten; selbst ergänzte geheime Dateien nicht hochladen.
3. Im Repository **Settings → Pages → Build and deployment** öffnen.
4. **Deploy from a branch** wählen, Branch **main**, Ordner **/docs**, **Save**.
5. Nach erfolgreicher Veröffentlichung den dort angezeigten Link öffnen. Beispiel: `https://DEINNAME.github.io/voelkerballturnier/`.

Zuschauer erhalten diesen normalen Link. Schiedsrichter öffnen denselben Link mit `#admin` am Ende oder tippen auf **Schiedsrichter**. Dort gilt das Passwort aus Schritt 1.

## 5. Vor dem Turnier kurz prüfen

Optional zuerst `supabase/verify.sql` im SQL Editor ausführen. Der Test prüft Datenbankrechte, Anmeldung und gleichzeitiges Speichern und rollt seine Teständerungen vollständig zurück.

- Auf einem Gerät anmelden und Spiel 1 mit 4 regulären Spielern + 3 Kapitänsleben gegen 3 + 2 speichern. Auf einem zweiten Gerät muss spätestens nach 15 Sekunden **7:5 – Unentschieden** und je ein Punkt erscheinen.
- Dasselbe Spiel korrigieren; die Tabelle muss den neuen Wert genau einmal berücksichtigen.
- Auf einem nicht angemeldeten Gerät darf die Schiedsrichterseite nur die Anmeldung zeigen.
- Testdaten **vor dem Turnier** gezielt im SQL Editor zurücksetzen (löscht alle aktuellen Ergebnisse und Losentscheidung; nicht während des Turniers ausführen):

```sql
update public.tournament_state
set payload = '{"results":{},"lot":null}'::jsonb,
    revision = revision + 1,
    updated_at = now()
where id = 1;
delete from tournament_private.sessions;
```

Danach alle geöffneten Eingabeseiten neu laden und erneut anmelden. Das private Änderungsprotokoll bleibt erhalten.

## Wenn etwas nicht klappt

| Meldung/Problem | Konkrete Lösung |
|---|---|
| „Vorschau“ | Beide Werte in `docs/config.js` fehlen noch; nach Änderung erneut auf GitHub hochladen. |
| Ergebnisse werden nicht geladen | Projekt-URL und öffentlichen Schlüssel prüfen; Supabase-Projekt aktivieren, falls pausiert; `setup.sql` muss ausgeführt sein. |
| Anmeldung/Speichern scheitert sofort | Prüfen, ob die Function `tournament` veröffentlicht ist und JWT-Verifikation deaktiviert ist. |
| „Zugang ist noch nicht eingerichtet“ | Separate Passwort-Abfrage aus Schritt 1 ausführen. |
| „Zu viele Anmeldeversuche“ | Bis zu 15 Minuten warten. Bestehende Sitzungen funktionieren weiter. Alle Geräte teilen sich dieses Limit. |
| „Inzwischen wurden Ergebnisse geändert“ | Am betroffenen Spiel **Aktuelle Werte laden** drücken und die Eingabe neu prüfen. Ungespeicherte Werte dieses Spiels werden dabei verworfen. |
| Speichern bei Verbindungsabbruch unklar | Erst Verbindung wiederherstellen und den gespeicherten Stand prüfen; die App bestätigt erst nach Serverantwort. |

Bei einem unveränderten Netzwerkausfall bleibt der zuletzt geladene Stand sichtbar. Es gibt keine Offline-Synchronisierung. Neue Änderungen müssen online gespeichert werden.

**Kostenstand geprüft am 16.09.2026:** [Supabase Free](https://supabase.com/pricing) bietet für dieses kleine Turnier ausreichende Inklusivkontingente; kostenlose Projekte können bei Inaktivität pausiert werden. Das Projekt am Vortag öffnen und den Live-Test durchführen. [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages) ist mit GitHub Free für öffentliche Repositories verfügbar. Die Einrichtung erfordert kein kostenpflichtiges Upgrade.

Offizielle Anleitungen: [Supabase Function Deployment](https://supabase.com/docs/guides/functions/deploy), [Edge-Umgebungsvariablen](https://supabase.com/docs/guides/functions/secrets), [GitHub-Pages-Veröffentlichung](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
