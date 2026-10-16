-- Research document uploads for the dashboard.
-- Paste this entire file into the Supabase SQL editor and run it as one statement.

begin;

do $guard$
declare
  bucket_public boolean;
  bucket_name text;
  conflicting_policy text;
begin
  select public, name into bucket_public, bucket_name
  from storage.buckets
  where id = 'research-documents';

  if found and bucket_public then
    raise exception 'research-documents already exists but is public; make it private before provisioning';
  end if;

  if bucket_name is not null and bucket_name <> 'research-documents' then
    raise exception 'research-documents bucket id exists with unexpected name %; inspect it before provisioning', bucket_name;
  end if;

  if to_regclass('public.research_documents') is not null then
    raise exception 'public.research_documents already exists; inspect it before running this one-time script';
  end if;

  if to_regclass('public.research_documents_current') is not null then
    raise exception 'public.research_documents_current already exists; inspect it before running this one-time script';
  end if;

  select policyname into conflicting_policy
  from pg_policies
  where (schemaname, tablename, policyname) in (
    ('public', 'research_documents', 'research_documents_authenticated_select'),
    ('public', 'research_documents', 'research_documents_authenticated_insert'),
    ('storage', 'objects', 'research_documents_objects_authenticated_select'),
    ('storage', 'objects', 'research_documents_objects_authenticated_insert')
  )
  limit 1;

  if conflicting_policy is not null then
    raise exception 'policy % already exists; inspect its definition before running this one-time script', conflicting_policy;
  end if;

  if to_regprocedure('public.research_upload_backend_status()') is not null then
    raise exception 'public.research_upload_backend_status() already exists; inspect it before running this one-time script';
  end if;
end
$guard$;

insert into storage.buckets (id, name, public)
values ('research-documents', 'research-documents', false)
on conflict (id) do update
set public = false
where storage.buckets.public = false;

create table public.research_documents (
  id uuid primary key default gen_random_uuid(),
  topic_id text not null check (btrim(topic_id) <> ''),
  stage smallint not null check (stage in (1, 2, 3)),
  version integer not null check (version > 0),
  title text not null check (btrim(title) <> ''),
  kind text not null check (btrim(kind) <> ''),
  parent_research_id uuid references public.research_documents(id),
  parent_red_team_id uuid references public.research_documents(id),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  bytes bigint not null check (bytes >= 0),
  storage_path text not null unique check (storage_path ~ '^[^/]+/[123]/v[1-9][0-9]*-[0-9a-f]{64}\.md$'),
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  uploaded_at timestamptz not null default now(),
  notes text not null default '',
  constraint research_documents_topic_stage_version_key unique (topic_id, stage, version),
  constraint research_documents_topic_stage_sha256_key unique (topic_id, stage, sha256),
  constraint research_documents_parent_shape check (
    (stage = 1 and parent_research_id is null and parent_red_team_id is null)
    or (stage = 2 and parent_research_id is not null and parent_red_team_id is null)
    or (stage = 3 and parent_research_id is not null and parent_red_team_id is not null)
  )
);

alter table public.research_documents enable row level security;
alter table storage.objects enable row level security;

revoke all on public.research_documents from public, anon, authenticated;
grant select, insert on public.research_documents to authenticated;

create policy research_documents_authenticated_select
on public.research_documents
for select
to authenticated
using (true);

create policy research_documents_authenticated_insert
on public.research_documents
for insert
to authenticated
with check (uploaded_by = (select auth.uid()));

create policy research_documents_objects_authenticated_select
on storage.objects
for select
to authenticated
using (bucket_id = 'research-documents');

create policy research_documents_objects_authenticated_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'research-documents'
  and owner_id::uuid = (select auth.uid())
);

create view public.research_documents_current
with (security_invoker = true)
as
select distinct on (topic_id, stage) *
from public.research_documents
order by topic_id, stage, version desc;

revoke all on public.research_documents_current from public, anon, authenticated;
grant select on public.research_documents_current to authenticated;

-- A metadata-only health check lets the publishable-key verifier confirm provisioning.
-- It exposes no document rows, object names, user ids, or file contents.
create function public.research_upload_backend_status()
returns table (bucket_exists boolean, bucket_private boolean, table_exists boolean)
language sql
security definer
set search_path = pg_catalog, public, storage
stable
as $function$
  select
    exists (select 1 from storage.buckets where id = 'research-documents'),
    coalesce((select not public from storage.buckets where id = 'research-documents'), false),
    to_regclass('public.research_documents') is not null;
$function$;

revoke all on function public.research_upload_backend_status() from public;
grant execute on function public.research_upload_backend_status() to anon, authenticated;

commit;
