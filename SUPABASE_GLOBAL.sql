-- A PROFECIA: estado compartilhado entre todos os dispositivos
create table if not exists public.a_profecia_global (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.a_profecia_global (id,data)
values ('main','{}'::jsonb)
on conflict (id) do nothing;

-- Bucket para wallpapers e assets globais
insert into storage.buckets (id,name,public)
values ('a-profecia-assets','a-profecia-assets',true)
on conflict (id) do update set public=true;

alter table public.a_profecia_global enable row level security;

-- Projeto sem autenticação Supabase: o app atual já controla Mestre/Player no frontend.
-- Estas policies permitem sincronização pelo cliente. Para segurança real, migre a autenticação para Supabase Auth/servidor.
drop policy if exists "public read global" on public.a_profecia_global;
drop policy if exists "public write global" on public.a_profecia_global;
create policy "public read global" on public.a_profecia_global for select using (true);
create policy "public write global" on public.a_profecia_global for insert with check (true);
create policy "public update global" on public.a_profecia_global for update using (true) with check (true);

drop policy if exists "public read assets" on storage.objects;
drop policy if exists "public upload assets" on storage.objects;
create policy "public read assets" on storage.objects for select using (bucket_id='a-profecia-assets');
create policy "public upload assets" on storage.objects for insert with check (bucket_id='a-profecia-assets');
create policy "public update assets" on storage.objects for update using (bucket_id='a-profecia-assets') with check (bucket_id='a-profecia-assets');
