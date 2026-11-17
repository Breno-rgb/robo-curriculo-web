-- Robô de Currículo: tabelas e regras de segurança.
-- Rode tudo de uma vez em: Supabase > SQL Editor > New query > cole > Run.

-- 1) O currículo-mestre de cada pessoa (um por conta).
create table if not exists public.curriculos (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  dados        jsonb not null,
  atualizado_em timestamptz not null default now()
);

-- 2) Cada currículo gerado para uma vaga.
create table if not exists public.candidaturas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  criado_em  timestamptz not null default now(),
  empresa    text not null default '',
  cargo      text not null default '',
  link       text not null default '',
  nota       int  not null default 0 check (nota between 0 and 100),
  status     text not null default 'pronto pra enviar',
  vaga       text not null default '' check (char_length(vaga) <= 50000),
  resultado  jsonb not null
);

create index if not exists candidaturas_user_data on public.candidaturas (user_id, criado_em desc);

-- 3) RLS: cada pessoa só enxerga e mexe no que é dela.
--    Sem isso, a chave pública do site daria acesso a tudo.
alter table public.curriculos   enable row level security;
alter table public.candidaturas enable row level security;

drop policy if exists "dono le curriculo"       on public.curriculos;
drop policy if exists "dono cria curriculo"     on public.curriculos;
drop policy if exists "dono altera curriculo"   on public.curriculos;
drop policy if exists "dono apaga curriculo"    on public.curriculos;
create policy "dono le curriculo"     on public.curriculos for select to authenticated using ((select auth.uid()) = user_id);
create policy "dono cria curriculo"   on public.curriculos for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dono altera curriculo" on public.curriculos for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dono apaga curriculo"  on public.curriculos for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "dono le candidaturas"     on public.candidaturas;
drop policy if exists "dono cria candidaturas"   on public.candidaturas;
drop policy if exists "dono altera candidaturas" on public.candidaturas;
drop policy if exists "dono apaga candidaturas"  on public.candidaturas;
create policy "dono le candidaturas"     on public.candidaturas for select to authenticated using ((select auth.uid()) = user_id);
create policy "dono cria candidaturas"   on public.candidaturas for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dono altera candidaturas" on public.candidaturas for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dono apaga candidaturas"  on public.candidaturas for delete to authenticated using ((select auth.uid()) = user_id);

-- 4) Apagar a própria conta (botão "Apagar conta" no Perfil).
--    O site não pode apagar usuários sozinho; esta função roda com permissão do banco,
--    mas só apaga QUEM ESTÁ LOGADO (auth.uid()). Currículo e candidaturas vão junto (cascade).
create or replace function public.apagar_minha_conta()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.apagar_minha_conta() from public, anon;
grant execute on function public.apagar_minha_conta() to authenticated;
