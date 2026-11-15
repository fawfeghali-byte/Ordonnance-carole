-- Ordonnance — table de synchronisation (à coller dans Supabase > SQL Editor > Run).
-- Le serveur ne stocke que des données chiffrées par le navigateur (AES-256-GCM).

create table if not exists public.records (
  user_id    uuid    not null default auth.uid() references auth.users (id) on delete cascade,
  id         text    not null,
  updated_at bigint  not null,
  deleted    boolean not null default false,
  data       text    not null default '',
  rev        bigint  not null default 0,
  primary key (user_id, id)
);

create sequence if not exists public.records_rev_seq;

create or replace function public.records_set_rev() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.rev := nextval('public.records_rev_seq');
  return new;
end $$;

drop trigger if exists records_rev on public.records;
create trigger records_rev before insert or update on public.records
  for each row execute function public.records_set_rev();

create index if not exists records_user_rev on public.records (user_id, rev);

alter table public.records enable row level security;

drop policy if exists "own rows" on public.records;
create policy "own rows" on public.records for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.records to authenticated;
