-- 0025_avisos.sql
--
-- Avisos publicados pela coordenação e exibidos a quem está logado.
--
-- DECISÕES DE MODELO
--
-- `publico`: um aviso sobre prazo de matrícula não interessa ao instrutor, e
-- um sobre fechamento de turma não interessa ao aluno. Sem segmentação, todo
-- aviso vira ruído para metade das pessoas e elas param de ler todos.
--
-- `inicio_em` / `fim_em`: aviso sem prazo é aviso que ninguém apaga. "As
-- inscrições de 2026/2 abrem dia 10" continua no ar em 2027 porque não houve
-- um momento óbvio para remover. Com janela, ele some sozinho.
--
-- Sem exclusão em cascata de nada e sem relação com curso ou turma: aviso é
-- comunicação, não registro acadêmico. Excluir um aviso não afeta nada.

create table if not exists aviso (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null,
  mensagem   text not null,
  tipo       text not null default 'info'
             check (tipo in ('info', 'atencao', 'urgente')),
  publico    text not null default 'todos'
             check (publico in ('todos', 'alunos', 'instrutores')),
  inicio_em  timestamptz,
  fim_em     timestamptz,
  criado_por uuid references usuario(id),
  criado_em  timestamptz not null default now()
);

create index if not exists idx_aviso_janela on aviso (inicio_em, fim_em);

alter table aviso enable row level security;

-- Sem policy de escrita: tudo passa pelas RPCs, que exigem e_admin().
-- Leitura só para quem está logado; a área pública não mostra avisos.
drop policy if exists aviso_leitura on aviso;
create policy aviso_leitura on aviso for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Escrita (coordenação)
-- ---------------------------------------------------------------------------

create or replace function criar_aviso(p_dados jsonb)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_id uuid; v_titulo text; v_msg text;
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;

  v_titulo := nullif(trim(coalesce(p_dados->>'titulo','')), '');
  v_msg    := nullif(trim(coalesce(p_dados->>'mensagem','')), '');
  if v_titulo is null or v_msg is null then
    raise exception 'titulo e mensagem sao obrigatorios';
  end if;

  insert into aviso (titulo, mensagem, tipo, publico, inicio_em, fim_em, criado_por)
  values (
    v_titulo, v_msg,
    coalesce(nullif(p_dados->>'tipo',''), 'info'),
    coalesce(nullif(p_dados->>'publico',''), 'todos'),
    nullif(p_dados->>'inicioEm','')::timestamptz,
    nullif(p_dados->>'fimEm','')::timestamptz,
    auth.uid()
  )
  returning id into v_id;

  insert into log_admin (acao, alvo_tipo, alvo_id, detalhe, autor_id)
  values ('aviso', 'curso', v_id, 'publicou o aviso "' || v_titulo || '"', auth.uid());

  return v_id;
end $fn$;

create or replace function atualizar_aviso(p_aviso uuid, p_dados jsonb)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;
  if not exists (select 1 from aviso where id = p_aviso) then
    raise exception 'aviso inexistente';
  end if;

  update aviso set
    titulo    = coalesce(nullif(trim(coalesce(p_dados->>'titulo','')), ''), titulo),
    mensagem  = coalesce(nullif(trim(coalesce(p_dados->>'mensagem','')), ''), mensagem),
    tipo      = coalesce(nullif(p_dados->>'tipo',''), tipo),
    publico   = coalesce(nullif(p_dados->>'publico',''), publico),
    inicio_em = nullif(p_dados->>'inicioEm','')::timestamptz,
    fim_em    = nullif(p_dados->>'fimEm','')::timestamptz
  where id = p_aviso;
end $fn$;

create or replace function excluir_aviso(p_aviso uuid)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;
  delete from aviso where id = p_aviso;
end $fn$;

-- ---------------------------------------------------------------------------
-- Leitura
-- ---------------------------------------------------------------------------

-- Avisos vigentes para QUEM ESTÁ CHAMANDO. A filtragem por público mora aqui
-- dentro, junto do papel do usuário, para nenhuma tela precisar reimplementar
-- a regra — e para um aluno não conseguir ler aviso de instrutor consultando
-- a tabela direto, já que a policy de leitura é ampla.
create or replace function meus_avisos()
returns table (id uuid, titulo text, mensagem text, tipo text)
language plpgsql stable security definer set search_path = public as $fn$
declare v_papel text;
begin
  select papel into v_papel from usuario where id = auth.uid();
  if v_papel is null then return; end if;

  return query
    select a.id, a.titulo, a.mensagem, a.tipo
    from aviso a
    where (a.inicio_em is null or a.inicio_em <= now())
      and (a.fim_em    is null or a.fim_em    >= now())
      and (
        a.publico = 'todos'
        or (a.publico = 'alunos'      and v_papel = 'aluno')
        or (a.publico = 'instrutores' and v_papel in ('instrutor', 'admin'))
      )
    order by
      case a.tipo when 'urgente' then 0 when 'atencao' then 1 else 2 end,
      a.criado_em desc
    limit 3;   -- mais que isso ninguém lê
end $fn$;

-- Todos os avisos, para a tela da coordenação (inclui expirados e agendados).
create or replace function avisos_todos()
returns table (
  id uuid, titulo text, mensagem text, tipo text, publico text,
  inicio_em timestamptz, fim_em timestamptz, criado_em timestamptz, vigente boolean
)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;

  return query
    select a.id, a.titulo, a.mensagem, a.tipo, a.publico,
           a.inicio_em, a.fim_em, a.criado_em,
           (a.inicio_em is null or a.inicio_em <= now())
             and (a.fim_em is null or a.fim_em >= now())
    from aviso a
    order by a.criado_em desc;
end $fn$;

grant execute on function
  criar_aviso(jsonb), atualizar_aviso(uuid, jsonb), excluir_aviso(uuid),
  meus_avisos(), avisos_todos()
to authenticated;

insert into migration_aplicada (nome) values ('0025_avisos.sql')
on conflict (nome) do nothing;
