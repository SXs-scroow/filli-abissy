-- A PROFECIA: configuração GLOBAL + Storage de wallpapers
-- Execute TODO este arquivo no Supabase: SQL Editor > New query > Run.

create table if not exists public.a_profecia_global (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.a_profecia_global (id,data)
values ('main','{}'::jsonb)
on conflict (id) do nothing;

-- Bucket público usado pelas imagens globais e wallpapers dos Players.
insert into storage.buckets (id,name,public)
values ('a-profecia-assets','a-profecia-assets',true)
on conflict (id) do update set public=true;

alter table public.a_profecia_global enable row level security;

drop policy if exists "public read global" on public.a_profecia_global;
drop policy if exists "public insert global" on public.a_profecia_global;
drop policy if exists "public update global" on public.a_profecia_global;
create policy "public read global" on public.a_profecia_global for select using (true);
create policy "public insert global" on public.a_profecia_global for insert with check (true);
create policy "public update global" on public.a_profecia_global for update using (true) with check (true);

-- Policies do Storage. O USING é importante para atualizações; o upload atual
-- também usa nomes únicos para não depender de sobrescrever arquivos antigos.
drop policy if exists "public read assets" on storage.objects;
drop policy if exists "public upload assets" on storage.objects;
drop policy if exists "public update assets" on storage.objects;
drop policy if exists "public delete assets" on storage.objects;
create policy "public read assets" on storage.objects for select using (bucket_id='a-profecia-assets');
create policy "public upload assets" on storage.objects for insert with check (bucket_id='a-profecia-assets');
create policy "public update assets" on storage.objects for update using (bucket_id='a-profecia-assets') with check (bucket_id='a-profecia-assets');
create policy "public delete assets" on storage.objects for delete using (bucket_id='a-profecia-assets');

-- Realtime para todos receberem mudanças sem recarregar.
do $$ begin
  alter publication supabase_realtime add table public.a_profecia_global;
exception when duplicate_object then null;
end $$;
