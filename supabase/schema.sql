-- Funil CRM — banco de dados
-- Cole este arquivo inteiro no Supabase: SQL Editor > New query > Run.

create table if not exists public.team (
  name text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  empresa text not null default '',
  email text not null default '',
  telefone text not null default '',
  origem text not null,
  servico text not null,
  valor numeric not null default 0,
  etapa text not null default 'novo'
    check (etapa in ('novo','qualificacao','reuniao','proposta','negociacao','ganho','perdido')),
  resp text not null default '',
  criado timestamptz not null default now(),
  utm jsonb not null default '{}'::jsonb,
  notas jsonb not null default '[]'::jsonb,
  hist jsonb not null default '[]'::jsonb,
  exemplo boolean not null default false,
  ganho_em timestamptz,
  perda text
);
create index if not exists leads_etapa_idx on public.leads (etapa);
create index if not exists leads_criado_idx on public.leads (criado desc);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  titulo text not null,
  venc date not null default current_date,
  resp text not null default '',
  feito boolean not null default false,
  status text check (status in ('todo','doing','done'))
);
create index if not exists tasks_lead_idx on public.tasks (lead_id);

-- Uma única linha: chave da API do formulário do site e contador do rodízio.
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  api_key text not null,
  rr int not null default 0
);
insert into public.settings (id, api_key)
values (1, 'fnl_live_' || encode(gen_random_bytes(12), 'hex'))
on conflict (id) do nothing;

-- Rodízio atômico usado pela função lead-webhook.
create or replace function public.take_rr() returns int
language sql security definer set search_path = public as $$
  update public.settings set rr = rr + 1 where id = 1 returning rr - 1;
$$;
revoke all on function public.take_rr() from public, anon, authenticated;
grant execute on function public.take_rr() to service_role;

-- Segurança: só usuários logados (equipe) acessam os dados.
alter table public.team enable row level security;
alter table public.leads enable row level security;
alter table public.tasks enable row level security;
alter table public.settings enable row level security;

drop policy if exists "equipe_team" on public.team;
drop policy if exists "equipe_leads" on public.leads;
drop policy if exists "equipe_tasks" on public.tasks;
drop policy if exists "equipe_settings_read" on public.settings;
drop policy if exists "equipe_settings_update" on public.settings;

create policy "equipe_team" on public.team for all to authenticated using (true) with check (true);
create policy "equipe_leads" on public.leads for all to authenticated using (true) with check (true);
create policy "equipe_tasks" on public.tasks for all to authenticated using (true) with check (true);
create policy "equipe_settings_read" on public.settings for select to authenticated using (true);
create policy "equipe_settings_update" on public.settings for update to authenticated using (true) with check (true);

-- Atualização ao vivo (um lead que chega do site aparece sem recarregar).
do $$ begin
  begin alter publication supabase_realtime add table public.leads; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.tasks; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.team; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.settings; exception when duplicate_object then null; end;
end $$;
