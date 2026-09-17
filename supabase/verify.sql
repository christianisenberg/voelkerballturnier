-- Optionaler Integrationstest im Supabase SQL Editor NACH setup.sql.
-- Alle Änderungen einschließlich temporärem Testpasswort werden zurückgerollt.
-- Bei erfolgreichem Durchlauf erscheint eine NOTICE; danach ROLLBACK.
begin;
do $$
declare result jsonb; tok text; rev integer; payload jsonb; i integer;
begin
  if not has_table_privilege('anon','public.tournament_state','SELECT') then raise exception 'Öffentliches Lesen fehlt'; end if;
  if has_table_privilege('anon','public.tournament_state','UPDATE') or has_table_privilege('authenticated','public.tournament_state','UPDATE') then raise exception 'Unerlaubte Schreibrechte'; end if;
  if has_function_privilege('anon','public.tournament_commit(text,integer,jsonb)','EXECUTE') or has_function_privilege('anon','public.tournament_login(text)','EXECUTE') then raise exception 'Öffentliche RPC-Freigabe'; end if;
  if has_schema_privilege('anon','tournament_private','USAGE') then raise exception 'Private Daten öffentlich'; end if;
  if not (select relrowsecurity from pg_class where oid='public.tournament_state'::regclass) then raise exception 'RLS deaktiviert'; end if;

  update tournament_private.auth set password_hash=extensions.crypt('temporary-test-only',extensions.gen_salt('bf',4)),attempts=0,window_start=now() where id=1;
  result:=public.tournament_login('wrong');
  if result->>'status'<>'401' then raise exception 'Falsches Passwort akzeptiert'; end if;
  result:=public.tournament_login('temporary-test-only'); tok:=result->>'token';
  if length(tok)<>64 or not public.tournament_session(tok,false) then raise exception 'Sitzung fehlt'; end if;
  select revision,tournament_state.payload into rev,payload from public.tournament_state where id=1;
  result:=public.tournament_commit(tok,rev-1,payload);
  if result->>'status'<>'409' then raise exception 'Versionskonflikt nicht erkannt'; end if;
  result:=public.tournament_commit(tok,rev,payload);
  if (result->>'revision')::integer<>rev+1 then raise exception 'Commit fehlgeschlagen'; end if;
  if not exists(select 1 from tournament_private.audit where revision=rev+1) then raise exception 'Audit fehlt'; end if;
  perform public.tournament_session(tok,true);
  if public.tournament_session(tok,false) then raise exception 'Abmeldung fehlgeschlagen'; end if;
  result:=public.tournament_commit(tok,rev+1,payload);
  if result->>'status'<>'401' then raise exception 'Abgelaufene Sitzung akzeptiert'; end if;
  update tournament_private.auth set attempts=0,window_start=now() where id=1;
  for i in 1..10 loop perform public.tournament_login('wrong'); end loop;
  result:=public.tournament_login('temporary-test-only');
  if result->>'status'<>'429' then raise exception 'Versuchslimit fehlt'; end if;
  raise notice 'OK: Leserechte, Schreibsperre, private Daten, Sitzung, Versionsprüfung, Audit und Versuchslimit';
end $$;
rollback;
