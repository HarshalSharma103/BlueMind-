-- Atomic acceptance for new connection requests, plus the missing messaging schema.
-- Existing requests/relationships are intentionally not backfilled or changed.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null unique
    references public.doctor_patient_relationships(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id),
  sender_id uuid not null references public.profiles(id),
  content text not null check (length(btrim(content)) between 1 and 4000),
  is_read boolean not null default false,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_sent_at_idx
  on public.messages (conversation_id, sent_at);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='conversations' and policyname='conversation_participant_select') then
    create policy conversation_participant_select on public.conversations for select to authenticated
      using (exists (
        select 1 from public.doctor_patient_relationships r
        where r.id = relationship_id and r.status in ('ACTIVE', 'OFFBOARD_REQUESTED')
          and auth.uid() in (r.patient_id, r.doctor_id)
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='messages' and policyname='message_participant_select') then
    create policy message_participant_select on public.messages for select to authenticated
      using (exists (
        select 1 from public.conversations c
        join public.doctor_patient_relationships r on r.id = c.relationship_id
        where c.id = conversation_id and r.status in ('ACTIVE', 'OFFBOARD_REQUESTED')
          and auth.uid() in (r.patient_id, r.doctor_id)
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='messages' and policyname='message_active_participant_insert') then
    create policy message_active_participant_insert on public.messages for insert to authenticated
      with check (sender_id = auth.uid() and exists (
        select 1 from public.conversations c
        join public.doctor_patient_relationships r on r.id = c.relationship_id
        where c.id = conversation_id and r.status = 'ACTIVE'
          and auth.uid() in (r.patient_id, r.doctor_id)
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='messages' and policyname='message_recipient_mark_read') then
    create policy message_recipient_mark_read on public.messages for update to authenticated
      using (sender_id <> auth.uid() and exists (
        select 1 from public.conversations c
        join public.doctor_patient_relationships r on r.id = c.relationship_id
        where c.id = conversation_id and auth.uid() in (r.patient_id, r.doctor_id)
      ))
      with check (sender_id <> auth.uid() and is_read and exists (
        select 1 from public.conversations c
        join public.doctor_patient_relationships r on r.id = c.relationship_id
        where c.id = conversation_id and auth.uid() in (r.patient_id, r.doctor_id)
      ));
  end if;
end $$;

notify pgrst, 'reload schema';

grant select on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
revoke update on public.messages from authenticated;
grant update (is_read) on public.messages to authenticated;

create or replace function public.respond_to_connection_request(
  p_request_id uuid,
  p_accept boolean
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_doctor_id uuid := auth.uid();
  v_request public.connection_requests%rowtype;
begin
  if v_doctor_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_request
  from public.connection_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Connection request not found';
  end if;
  if v_request.doctor_id <> v_doctor_id then
    raise exception 'Only the requested doctor can respond';
  end if;
  if v_request.status <> 'PENDING' then
    raise exception 'Connection request is no longer pending';
  end if;

  update public.connection_requests
  set status = case when p_accept then 'ACCEPTED' else 'REJECTED' end,
      responded_at = now(),
      updated_at = now()
  where id = p_request_id;

  if p_accept then
    perform pg_advisory_xact_lock(hashtext(v_request.patient_id::text || ':' || v_doctor_id::text));
    if not exists (
      select 1 from public.doctor_patient_relationships r
      where r.connection_request_id = p_request_id
         or (r.patient_id = v_request.patient_id and r.doctor_id = v_doctor_id and r.status = 'ACTIVE')
    ) then
      insert into public.doctor_patient_relationships
        (patient_id, doctor_id, connection_request_id, status, established_at)
      values
        (v_request.patient_id, v_doctor_id, p_request_id, 'ACTIVE', now());
    end if;
  end if;
end;
$$;

create or replace function public.get_or_create_conversation(p_relationship_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_conversation_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  perform 1 from public.doctor_patient_relationships r
  where r.id = p_relationship_id and r.status = 'ACTIVE'
    and v_user_id in (r.patient_id, r.doctor_id)
  for update;
  if not found then
    raise exception 'Active relationship not found for this user';
  end if;

  insert into public.conversations (relationship_id)
  values (p_relationship_id)
  on conflict (relationship_id) do update set relationship_id = excluded.relationship_id
  returning id into v_conversation_id;

  return v_conversation_id;
end;
$$;

revoke all on function public.respond_to_connection_request(uuid, boolean) from public, anon;
grant execute on function public.respond_to_connection_request(uuid, boolean) to authenticated;
revoke all on function public.get_or_create_conversation(uuid) from public, anon;
grant execute on function public.get_or_create_conversation(uuid) to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
    ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
