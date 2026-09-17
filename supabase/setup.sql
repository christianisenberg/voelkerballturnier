-- Einmal im SQL Editor eines neuen Supabase-Projekts ausführen.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists tournament_private;
revoke all on schema tournament_private from public, anon, authenticated;

create table if not exists public.tournament_state (
  id integer primary key check (id=1),
  payload jsonb not null default '{"results":{},"lot":null}'::jsonb,
  revision integer not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.tournament_state(id) values(1) on conflict do nothing;
alter table public.tournament_state enable row level security;
revoke all on public.tournament_state from public,anon,authenticated;
grant select on public.tournament_state to anon,authenticated;
grant all on public.tournament_state to service_role;
drop policy if exists "Everyone can read tournament" on public.tournament_state;
create policy "Everyone can read tournament" on public.tournament_state for select to anon,authenticated using (true);

create table if not exists tournament_private.auth (
  id integer primary key check(id=1), password_hash text,
  window_start timestamptz not null default now(), attempts integer not null default 0
);
insert into tournament_private.auth(id) values(1) on conflict do nothing;
create table if not exists tournament_private.sessions (
  token_hash text primary key, expires_at timestamptz not null
);
create table if not exists tournament_private.audit (
  revision integer primary key, changed_at timestamptz not null default now(),
  session_hash text not null, old_payload jsonb not null, new_payload jsonb not null
);
revoke all on all tables in schema tournament_private from public,anon,authenticated;

-- Der globale Versuchszähler liegt in Postgres und gilt über alle Edge-Instanzen.
-- Fehlversuche werden als normales Ergebnis zurückgegeben: kein Rollback des Zählers.
create or replace function public.tournament_login(p_password text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a tournament_private.auth%rowtype; raw_token text;
begin
  select * into a from tournament_private.auth where id=1 for update;
  if a.password_hash is null then return jsonb_build_object('error','Zugang ist noch nicht eingerichtet.','status',503); end if;
  if clock_timestamp() >= a.window_start+interval '15 minutes' then
    a.attempts:=0;
    update tournament_private.auth set attempts=0,window_start=clock_timestamp() where id=1;
  end if;
  if a.attempts>=10 then return jsonb_build_object('error','Zu viele Anmeldeversuche. Bitte nach spätestens 15 Minuten erneut versuchen.','status',429); end if;
  update tournament_private.auth set attempts=attempts+1 where id=1;
  if p_password is null or octet_length(p_password)>128 or extensions.crypt(p_password,a.password_hash)<>a.password_hash then
    return jsonb_build_object('error','Passwort nicht korrekt.','status',401);
  end if;
  raw_token:=encode(extensions.gen_random_bytes(32),'hex');
  delete from tournament_private.sessions where expires_at<now();
  insert into tournament_private.sessions values(encode(extensions.digest(raw_token,'sha256'),'hex'),now()+interval '12 hours');
  return jsonb_build_object('token',raw_token);
end; $$;

create or replace function public.tournament_session(p_token text, p_logout boolean default false)
returns boolean language plpgsql security definer set search_path = '' as $$
declare h text; valid boolean;
begin
  if p_token is null or length(p_token)<>64 then return false; end if;
  h:=encode(extensions.digest(p_token,'sha256'),'hex');
  select exists(select 1 from tournament_private.sessions where token_hash=h and expires_at>now()) into valid;
  if p_logout then delete from tournament_private.sessions where token_hash=h; end if;
  return valid;
end; $$;

-- Nur die Edge Function darf diesen Commit aufrufen. Prüfung und Schreiben sind atomar.
create or replace function public.tournament_commit(p_token text,p_revision integer,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_row public.tournament_state%rowtype; changed public.tournament_state%rowtype;
begin
  if not public.tournament_session(p_token,false) then return jsonb_build_object('error','Sitzung abgelaufen. Bitte erneut anmelden.','status',401); end if;
  select * into current_row from public.tournament_state where id=1 for update;
  if current_row.revision<>p_revision then return jsonb_build_object('error','Inzwischen wurden Ergebnisse geändert. Bitte aktuelle Werte laden und die Eingabe erneut prüfen.','status',409); end if;
  update public.tournament_state set payload=p_payload,revision=revision+1,updated_at=now() where id=1 returning * into changed;
  insert into tournament_private.audit(revision,session_hash,old_payload,new_payload) values(changed.revision,encode(extensions.digest(p_token,'sha256'),'hex'),current_row.payload,p_payload);
  return to_jsonb(changed);
end; $$;

revoke all on function public.tournament_login(text) from public,anon,authenticated;
revoke all on function public.tournament_session(text,boolean) from public,anon,authenticated;
revoke all on function public.tournament_commit(text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.tournament_login(text) to service_role;
grant execute on function public.tournament_session(text,boolean) to service_role;
grant execute on function public.tournament_commit(text,integer,jsonb) to service_role;
commit;

-- Passwort separat im SQL Editor setzen, NICHT hier eintragen und hochladen.
-- Siehe DEPLOYMENT.md. Die Erstinstallation überschreibt keine bestehenden Ergebnisse.
