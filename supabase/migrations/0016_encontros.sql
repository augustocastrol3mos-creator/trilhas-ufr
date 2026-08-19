-- 0016_encontros.sql
--
-- Até aqui o modelo supunha UM encontro por turma: turma.encontro_data
-- (singular), turma.encontro_local (singular), matricula.presenca_confirmada
-- (booleano), e a constraint coorte_tem_encontro amarrando os três. Um curso
-- com três sábados não tinha representação.
--
-- ESTRATÉGIA: o portão continua sendo o booleano; a evidência por trás dele
-- fica granular. presenca_confirmada deixa de ser DIGITADA e passa a ser
-- CALCULADA — vira true quando o aluno atinge o percentual mínimo de
-- encontros. Consequência: fechar_turma NÃO MUDA UMA LINHA. Continua lendo o
-- mesmo booleano que sempre leu.
--
-- É o mesmo movimento da 0015, e vale como padrão: quando precisar detalhar
-- algo que uma função crítica consome, mantenha o formato que ela consome e
-- mude só quem o produz. Reescrever fechar_turma — que congela nota, emite
-- certificado e encerra turma numa transação — seria o maior risco do projeto.

-- ---------------------------------------------------------------------------
-- 1. Schema
-- ---------------------------------------------------------------------------

create table if not exists encontro (
  id        uuid primary key default gen_random_uuid(),
  turma_id  uuid not null references turma(id) on delete cascade,
  ordem     int  not null,
  titulo    text,
  data      timestamptz not null,
  local     text,
  criado_em timestamptz not null default now(),
  unique (turma_id, ordem)
);

create table if not exists presenca (
  id             uuid primary key default gen_random_uuid(),
  matricula_id   uuid not null references matricula(id) on delete cascade,
  encontro_id    uuid not null references encontro(id) on delete cascade,
  presente       boolean not null default false,
  registrado_em  timestamptz not null default now(),
  registrado_por uuid references usuario(id),
  unique (matricula_id, encontro_id)
);

-- Índices de chave estrangeira: o Postgres NÃO cria automaticamente, e estas
-- duas tabelas nascem sabendo que serão lidas sempre por esses campos.
create index if not exists idx_encontro_turma    on encontro (turma_id);
create index if not exists idx_presenca_encontro on presenca  (encontro_id);
create index if not exists idx_presenca_matricula on presenca (matricula_id);

-- Mínimo por turma, não por curso: o número de encontros varia de uma oferta
-- para outra, então a exigência precisa acompanhar a oferta.
alter table turma add column if not exists presenca_minima numeric(5,2) not null default 75;

-- ---------------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------------

alter table encontro enable row level security;
alter table presenca enable row level security;

-- Sem policy de escrita: tudo passa por RPC security definer. RLS ligado sem
-- policy de INSERT/UPDATE já bloqueia escrita direta pelo cliente.

drop policy if exists encontro_leitura on encontro;
create policy encontro_leitura on encontro for select using (
  e_admin()
  or e_instrutor_da_turma(turma_id)
  or exists (select 1 from turma t where t.id = encontro.turma_id and e_autor_do_curso(t.curso_id))
  or exists (select 1 from matricula m where m.turma_id = encontro.turma_id and m.usuario_id = auth.uid())
);

drop policy if exists presenca_leitura on presenca;
create policy presenca_leitura on presenca for select using (
  e_dono_matricula(matricula_id)
  or e_admin()
  or e_instrutor_da_matricula(matricula_id)
);

-- ATENÇÃO (seção 3 do ESTADO_DO_PROJETO): estas duas policies incluem
-- "admin vê tudo". Como as tabelas são NOVAS, nenhuma tela existente depende
-- delas — não há vazamento herdado. Mas toda tela nova que ler `presenca`
-- precisa de filtro explícito por dono no código, não só do RLS.

-- ---------------------------------------------------------------------------
-- 3. O cálculo
-- ---------------------------------------------------------------------------

create or replace function recalcular_presenca(p_matricula uuid)
returns boolean language plpgsql security definer set search_path = public as $fn$
declare
  v_turma     uuid;
  v_minima    numeric;
  v_total     int;
  v_presentes int;
  v_ok        boolean;
  v_ultima    timestamptz;
  v_por       uuid;
begin
  select m.turma_id, t.presenca_minima into v_turma, v_minima
  from matricula m join turma t on t.id = m.turma_id
  where m.id = p_matricula;

  if v_turma is null then return false; end if;

  select count(*) into v_total from encontro where turma_id = v_turma;

  select count(*) filter (where p.presente),
         max(p.registrado_em) filter (where p.presente)
    into v_presentes, v_ultima
  from presenca p join encontro e on e.id = p.encontro_id
  where p.matricula_id = p_matricula and e.turma_id = v_turma;

  -- Turma sem encontro cadastrado não confirma presença de ninguém. Antes
  -- assumir "sem encontro = todos presentes" seria emitir certificado de
  -- curso híbrido sem nenhuma evidência presencial.
  v_ok := v_total > 0
          and (coalesce(v_presentes, 0)::numeric / v_total * 100) >= v_minima;

  select p.registrado_por into v_por
  from presenca p join encontro e on e.id = p.encontro_id
  where p.matricula_id = p_matricula and e.turma_id = v_turma and p.presente
  order by p.registrado_em desc limit 1;

  update matricula set
    presenca_confirmada = v_ok,
    presenca_em  = case when v_ok then v_ultima else null end,
    presenca_por = case when v_ok then v_por    else null end
  where id = p_matricula;

  return v_ok;
end $fn$;

-- ---------------------------------------------------------------------------
-- 4. Gestão de encontros
-- ---------------------------------------------------------------------------

create or replace function pode_gerir_encontros(p_turma uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select e_admin()
      or e_instrutor_da_turma(p_turma)
      or exists (select 1 from turma t where t.id = p_turma and e_autor_do_curso(t.curso_id));
$fn$;

create or replace function criar_encontro(p_turma uuid, p_dados jsonb)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_id uuid; v_ordem int; v_status text;
begin
  if not pode_gerir_encontros(p_turma) then raise exception 'nao autorizado'; end if;

  select status into v_status from turma where id = p_turma;
  if v_status is null then raise exception 'turma inexistente'; end if;
  if v_status = 'encerrada' then raise exception 'turma encerrada; reabra antes'; end if;

  if (p_dados->>'data') is null or trim(p_dados->>'data') = '' then
    raise exception 'o encontro precisa de data';
  end if;

  select coalesce(max(ordem), 0) + 1 into v_ordem from encontro where turma_id = p_turma;

  insert into encontro (turma_id, ordem, titulo, data, local)
  values (
    p_turma, v_ordem,
    nullif(trim(coalesce(p_dados->>'titulo','')), ''),
    (p_dados->>'data')::timestamptz,
    nullif(trim(coalesce(p_dados->>'local','')), '')
  )
  returning id into v_id;

  -- Encontro novo muda o denominador do percentual: quem estava confirmado
  -- com 2 de 2 pode cair para 2 de 3. Recalcular todo mundo é obrigatório,
  -- senão a turma fica com presença confirmada por uma regra que já mudou.
  perform recalcular_presenca(m.id) from matricula m where m.turma_id = p_turma;

  return v_id;
end $fn$;

create or replace function remover_encontro(p_encontro uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_turma uuid; v_status text;
begin
  select e.turma_id, t.status into v_turma, v_status
  from encontro e join turma t on t.id = e.turma_id where e.id = p_encontro;

  if v_turma is null then raise exception 'encontro inexistente'; end if;
  if not pode_gerir_encontros(v_turma) then raise exception 'nao autorizado'; end if;
  if v_status = 'encerrada' then raise exception 'turma encerrada; reabra antes'; end if;

  delete from encontro where id = p_encontro;   -- presencas caem por cascade
  perform recalcular_presenca(m.id) from matricula m where m.turma_id = v_turma;
end $fn$;

-- ---------------------------------------------------------------------------
-- 5. Chamada
-- ---------------------------------------------------------------------------

-- A antiga registrar_presenca(turma, jsonb) some: a chamada agora é de UM
-- encontro, não da turma inteira. Precisa de DROP porque o Postgres recusa
-- trocar o nome de um parâmetro via create or replace.
drop function if exists registrar_presenca(uuid, jsonb);

create or replace function registrar_chamada(p_encontro uuid, p_presencas jsonb)
returns int language plpgsql security definer set search_path = public as $fn$
declare d jsonb; v_turma uuid; v_status text; v_n int := 0;
begin
  select e.turma_id, t.status into v_turma, v_status
  from encontro e join turma t on t.id = e.turma_id where e.id = p_encontro;

  if v_turma is null then raise exception 'encontro inexistente'; end if;
  if not pode_gerir_encontros(v_turma) then raise exception 'nao autorizado'; end if;
  if v_status = 'encerrada' then raise exception 'turma encerrada; reabra antes'; end if;

  for d in select value from jsonb_array_elements(p_presencas) loop
    insert into presenca (matricula_id, encontro_id, presente, registrado_em, registrado_por)
    select m.id, p_encontro, coalesce((d->>'presente')::boolean, false), now(), auth.uid()
    from matricula m
    where m.id = (d->>'matricula')::uuid
      and m.turma_id = v_turma        -- impede marcar aluno de OUTRA turma
    on conflict (matricula_id, encontro_id) do update
      set presente = excluded.presente,
          registrado_em = now(),
          registrado_por = auth.uid();

    perform recalcular_presenca((d->>'matricula')::uuid);
    v_n := v_n + 1;
  end loop;

  return v_n;
end $fn$;

-- ---------------------------------------------------------------------------
-- 6. Leitura
-- ---------------------------------------------------------------------------

create or replace function encontros_da_turma(p_turma uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare v_out jsonb;
begin
  if not pode_gerir_encontros(p_turma) then raise exception 'nao autorizado'; end if;

  select jsonb_build_object(
    'presencaMinima', (select presenca_minima from turma where id = p_turma),
    'alunos', coalesce((
      select jsonb_agg(jsonb_build_object('matriculaId', m.id,
                                          'nome', coalesce(nullif(u.nome_completo,''), u.email))
                       order by u.nome_completo)
      from matricula m join usuario u on u.id = m.usuario_id
      where m.turma_id = p_turma
    ), '[]'::jsonb),
    'encontros', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'ordem', e.ordem, 'titulo', e.titulo,
        'data', e.data, 'local', e.local,
        'presentes', (select count(*) from presenca p where p.encontro_id = e.id and p.presente),
        'marcados', coalesce((
          select jsonb_agg(p.matricula_id) from presenca p
          where p.encontro_id = e.id and p.presente
        ), '[]'::jsonb)
      ) order by e.ordem)
      from encontro e where e.turma_id = p_turma
    ), '[]'::jsonb)
  ) into v_out;

  return v_out;
end $fn$;

-- Resumo para o aluno: quantos encontros existem e em quantos ele esteve.
-- Só das PRÓPRIAS matrículas — o filtro por auth.uid() está aqui dentro para
-- que nenhuma tela precise lembrar de aplicá-lo.
create or replace function meu_resumo_presenca()
returns jsonb language sql stable security definer set search_path = public as $fn$
  select coalesce(jsonb_object_agg(x.matricula_id, jsonb_build_object(
           'total', x.total, 'presentes', x.presentes, 'minima', x.minima
         )), '{}'::jsonb)
  from (
    select m.id as matricula_id,
           (select count(*) from encontro e where e.turma_id = m.turma_id) as total,
           (select count(*) from presenca p join encontro e on e.id = p.encontro_id
             where p.matricula_id = m.id and e.turma_id = m.turma_id and p.presente) as presentes,
           t.presenca_minima as minima
    from matricula m join turma t on t.id = m.turma_id
    where m.usuario_id = auth.uid()
  ) x;
$fn$;

grant execute on function
  criar_encontro(uuid, jsonb), remover_encontro(uuid),
  registrar_chamada(uuid, jsonb), encontros_da_turma(uuid),
  meu_resumo_presenca(), pode_gerir_encontros(uuid), recalcular_presenca(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Backfill
-- ---------------------------------------------------------------------------

-- Seção 9 do ESTADO_DO_PROJETO: migration que muda comportamento automático
-- precisa de backfill. Sem isto, toda turma existente ficaria com ZERO
-- encontros — e recalcular_presenca zeraria a presença de todo mundo,
-- inclusive de turmas já encerradas com certificado emitido.

-- 7.1 cada turma coorte vira um encontro nº 1
insert into encontro (turma_id, ordem, titulo, data, local)
select t.id, 1, 'Encontro presencial', t.encontro_data, t.encontro_local
from turma t
where t.tipo = 'coorte'
  and t.encontro_data is not null
  and not exists (select 1 from encontro e where e.turma_id = t.id);

-- 7.2 quem já tinha presença confirmada ganha a evidência correspondente
insert into presenca (matricula_id, encontro_id, presente, registrado_em, registrado_por)
select m.id, e.id, true, coalesce(m.presenca_em, now()), m.presenca_por
from matricula m
join encontro e on e.turma_id = m.turma_id and e.ordem = 1
where m.presenca_confirmada
on conflict (matricula_id, encontro_id) do nothing;

-- Nada de recalcular aqui: presenca_confirmada das turmas existentes fica
-- exatamente como está. Com 1 encontro e mínimo de 75%, o cálculo daria o
-- mesmo resultado — mas turma encerrada não deve ser tocada por migration.
