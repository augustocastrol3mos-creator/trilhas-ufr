-- 0042_veredito_competencia.sql
--
-- O professor registra, para cada aluno, quais das competências do curso foram
-- de fato demonstradas.
--
-- ============================================================================
-- POR QUE ISTO EXISTE
-- ============================================================================
--
-- A autoavaliação (0040) é autorrelato: serve para a pessoa se orientar, e não
-- pode sustentar afirmação nenhuma sobre ela. Se o certificado dissesse
-- "desenvolveu Comunicação Efetiva" com base nela, o aluno teria certificado a
-- si mesmo — bastaria marcar 5 em tudo. Isso quebraria a decisão fundadora do
-- projeto, que é emitir certificado com pré-requisito VERIFICÁVEL, e de quebra
-- mataria o diagnóstico: no instante em que a autoavaliação vale certificado,
-- ela passa a compensar manipular.
--
-- Faltava uma evidência que não venha do próprio aluno. É esta tabela.
--
-- Com ela, o certificado passa a poder dizer duas coisas diferentes:
--
--   "Este curso desenvolve: Comunicação Efetiva, Empatia"   ← já existia (0038)
--        afirmação sobre o CURSO, verificada na publicação
--
--   "Competências demonstradas: Comunicação Efetiva"        ← novo
--        afirmação sobre a PESSOA, feita por quem a acompanhou
--
-- ============================================================================
-- A DECISÃO QUE MAIS IMPORTA AQUI: O VEREDITO É OPCIONAL
-- ============================================================================
--
-- `emitir_certificado` NÃO exige veredito, e não pode exigir. Ela é chamada em
-- lote por `fechar_turma` e pela emissão automática de curso online. Tornar o
-- veredito obrigatório travaria a emissão de todo curso online no dia em que
-- esta migration rodasse — comportamento novo quebrando fluxo existente, que é
-- o erro que a seção 8 chama de "migration que muda comportamento automático".
--
-- Sem veredito, o certificado sai exatamente como sai hoje. Com veredito, ele
-- ganha uma linha a mais. Nada regride.
--
-- BACKFILL: nenhum, de propósito. Certificado já emitido não muda — é a mesma
-- razão de todos os outros snapshots existirem. Quem quiser acrescentar a
-- competência demonstrada a um certificado antigo revoga e reemite, que é o
-- caminho documentado para qualquer correção de certificado.
--
-- ============================================================================
-- E O CURSO ONLINE, QUE NÃO TEM PROFESSOR DE PLANTÃO?
-- ============================================================================
--
-- Fica sem veredito, e isso é honesto: não houve ninguém observando. O
-- certificado dele continua dizendo o que o curso desenvolve e qual foi a nota
-- — que já é bastante, e é verificável.
--
-- Existe uma discussão aberta aqui: aprovação no quiz PODERIA contar como
-- evidência de que a competência foi demonstrada. É uma decisão pedagógica, não
-- técnica, e não foi tomada nesta migration. Se a equipe decidir que conta,
-- vira uma função que preenche veredito automaticamente na emissão — e o
-- desenho abaixo já suporta isso, porque `avaliador_id` aceita nulo.

create table if not exists veredito_competencia (
  matricula_id   uuid not null references matricula(id) on delete cascade,
  competencia_id uuid not null references competencia(id) on delete restrict,
  demonstrada    boolean not null,
  observacao     text,
  avaliador_id   uuid references usuario(id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  primary key (matricula_id, competencia_id)
);

create index if not exists idx_veredito_competencia
  on veredito_competencia (competencia_id);

comment on table veredito_competencia is
  'Julgamento do professor sobre uma competência de um aluno num curso. `demonstrada = false` é informação, não ausência: significa que o professor olhou e concluiu que não. Quem não foi avaliado simplesmente não tem linha aqui.';

comment on column veredito_competencia.avaliador_id is
  'Nulo quando o veredito não vier de uma pessoa. Hoje sempre vem; a coluna aceita nulo para o dia em que a equipe decidir que aprovação no quiz conta como evidência.';

alter table certificado
  add column if not exists competencias_demonstradas text[];

comment on column certificado.competencias_demonstradas is
  'Snapshot das competências que o professor atestou no momento da emissão. Distinto de `competencias`, que diz o que o CURSO desenvolve. Vazio quando ninguém avaliou — a maioria dos cursos online.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table veredito_competencia enable row level security;

-- Leitura para o dono da matrícula e para quem dá aula nela. Nenhuma policy de
-- "admin vê tudo": a coordenação enxerga pelas RPCs, que são security definer e
-- checam por dentro. É a lição 4.3 — policy permissiva combina com OR e já
-- vazou dado alheio cinco vezes neste projeto. Nenhuma tela existente muda de
-- comportamento por causa desta migration.
drop policy if exists veredito_leitura on veredito_competencia;
create policy veredito_leitura on veredito_competencia
  for select to authenticated using (
    e_dono_matricula(matricula_id) or e_instrutor_da_matricula(matricula_id)
  );

-- Sem policy de INSERT/UPDATE para ninguém. Escrever é só por
-- `registrar_veredito()`, que checa quem chama.

-- ---------------------------------------------------------------------------
-- Registrar
-- ---------------------------------------------------------------------------

create or replace function registrar_veredito(
  p_matricula uuid, p_competencia uuid, p_demonstrada boolean, p_observacao text default null
) returns void language plpgsql security definer set search_path = public as $fn$
declare
  v_curso uuid;
begin
  if not e_instrutor_da_matricula(p_matricula) then
    raise exception 'apenas quem da aula nesta turma';
  end if;

  select t.curso_id into v_curso
  from matricula m join turma t on t.id = m.turma_id
  where m.id = p_matricula;

  if v_curso is null then raise exception 'matricula inexistente'; end if;

  -- A competência precisa ser uma das que o CURSO declara desenvolver. Sem
  -- isto, um professor poderia atestar qualquer uma das doze em qualquer curso,
  -- e a afirmação do certificado perderia a âncora que a torna verificável: a
  -- coordenação aprovou aquele curso com aquelas competências.
  if not exists (
    select 1 from curso_competencia cc
    where cc.curso_id = v_curso and cc.competencia_id = p_competencia
  ) then
    raise exception 'esta competencia nao faz parte deste curso';
  end if;

  -- Certificado já emitido congelou o snapshot. Deixar o veredito mudar depois
  -- criaria divergência silenciosa entre a tela e o documento na mão do aluno.
  if exists (
    select 1 from certificado c
    where c.matricula_id = p_matricula and c.revogado_em is null
  ) then
    raise exception 'o certificado ja foi emitido; para corrigir, revogue e reemita';
  end if;

  insert into veredito_competencia
    (matricula_id, competencia_id, demonstrada, observacao, avaliador_id)
  values
    (p_matricula, p_competencia, p_demonstrada,
     nullif(trim(coalesce(p_observacao, '')), ''), auth.uid())
  on conflict (matricula_id, competencia_id) do update
    set demonstrada   = excluded.demonstrada,
        observacao    = excluded.observacao,
        avaliador_id  = excluded.avaliador_id,
        atualizado_em = now();
end $fn$;

-- As competências do curso da matrícula, com o veredito já dado (se houver).
-- Uma consulta só para a tela do professor não precisar cruzar nada no cliente.
create or replace function competencias_da_matricula(p_matricula uuid)
returns table (
  competencia_id uuid, numero int, nome text,
  demonstrada boolean, observacao text, avaliado_em timestamptz, congelado boolean
)
language sql stable security definer set search_path = public as $fn$
  select
    co.id, co.numero, co.nome,
    v.demonstrada, v.observacao, v.atualizado_em,
    exists (
      select 1 from certificado c
      where c.matricula_id = p_matricula and c.revogado_em is null
    )
  from matricula m
  join turma t              on t.id = m.turma_id
  join curso_competencia cc on cc.curso_id = t.curso_id
  join competencia co       on co.id = cc.competencia_id
  left join veredito_competencia v
    on v.matricula_id = m.id and v.competencia_id = co.id
  where m.id = p_matricula
    and (e_dono_matricula(p_matricula) or e_instrutor_da_matricula(p_matricula))
  order by co.ordem;
$fn$;

grant execute on function registrar_veredito(uuid, uuid, boolean, text) to authenticated;
grant execute on function competencias_da_matricula(uuid)               to authenticated;

-- ---------------------------------------------------------------------------
-- O que o aluno vê
-- ---------------------------------------------------------------------------

-- Competências que algum professor atestou, com quantos cursos. Só entra o que
-- tem certificado emitido e não revogado: enquanto o curso não fechou, o
-- veredito ainda pode mudar, e mostrar antes seria prometer o que não está
-- firme.
create or replace function minhas_competencias_demonstradas()
returns table (numero int, nome text, slug text, cursos int)
language sql stable security definer set search_path = public as $fn$
  select co.numero, co.nome, co.slug, count(distinct m.id)::int
  from veredito_competencia v
  join matricula m    on m.id = v.matricula_id
  join certificado ce on ce.matricula_id = m.id and ce.revogado_em is null
  join competencia co on co.id = v.competencia_id
  where m.usuario_id = auth.uid() and v.demonstrada
  group by co.numero, co.nome, co.slug, co.ordem
  order by co.ordem;
$fn$;

grant execute on function minhas_competencias_demonstradas() to authenticated;

-- ---------------------------------------------------------------------------
-- A emissão congela o veredito
-- ---------------------------------------------------------------------------

create or replace function emitir_certificado(p_matricula uuid)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_cfg        configuracao%rowtype;
  v_status     status_matricula;
  v_nome       text;
  v_rga        text;
  v_comps      text[];
  v_demonstra  text[];
  v_curso      curso%rowtype;
  v_turma      turma%rowtype;
  v_conteudo   jsonb;
  v_inicio     date;
  v_fim        date;
  v_nota       numeric;
  v_id         uuid;
begin
  select * into v_cfg from configuracao where id;

  select m.status, u.nome_completo, u.rga, m.nota_final into v_status, v_nome, v_rga, v_nota
  from matricula m join usuario u on u.id = m.usuario_id
  where m.id = p_matricula;

  if v_status is null then raise exception 'matricula inexistente'; end if;

  -- Última barreira: fechar_turma chama esta função em lote, e uma turma pode
  -- ser fechada depois de o curso ter sido arquivado.
  perform verificar_matricula_ativa(p_matricula);

  if v_status not in ('aprovado','certificado_emitido') then
    raise exception 'matricula nao aprovada';
  end if;
  if coalesce(trim(v_nome), '') = '' then
    raise exception 'nome completo do titular nao preenchido';
  end if;

  select id into v_id from certificado
  where matricula_id = p_matricula and revogado_em is null;
  if v_id is not null then return v_id; end if;

  select c.* into v_curso
  from matricula m join turma t on t.id = m.turma_id join curso c on c.id = t.curso_id
  where m.id = p_matricula;

  select t.* into v_turma from matricula m join turma t on t.id = m.turma_id
  where m.id = p_matricula;

  -- Snapshot do que o CURSO desenvolve.
  select array_agg(co.nome order by co.ordem) into v_comps
  from curso_competencia cc
  join competencia co on co.id = cc.competencia_id
  where cc.curso_id = v_curso.id;

  -- Snapshot do que o PROFESSOR atestou. Vazio quando ninguém avaliou, e isso
  -- é o caso normal em curso online — o certificado sai igual ao de hoje.
  select array_agg(co.nome order by co.ordem) into v_demonstra
  from veredito_competencia v
  join competencia co on co.id = v.competencia_id
  where v.matricula_id = p_matricula and v.demonstrada;

  select coalesce(jsonb_agg(mo.titulo order by mo.ordem), '[]'::jsonb) into v_conteudo
  from modulo mo where mo.curso_id = v_curso.id;

  if v_turma.inicio is not null then
    v_inicio := v_turma.inicio;
  else
    select criado_em::date into v_inicio from matricula where id = p_matricula;
  end if;
  v_fim := coalesce(v_turma.fim, current_date);

  insert into certificado (
    matricula_id, codigo, nome_titular, rga_titular, curso_titulo, carga_horaria,
    modalidade, periodo_inicio, periodo_fim, nota_final, conteudo,
    assinante_nome, assinante_cargo, competencias, competencias_demonstradas
  ) values (
    p_matricula, gerar_codigo_certificado(), v_nome, v_rga, v_curso.titulo,
    v_curso.carga_horaria, v_curso.modalidade,
    v_inicio, v_fim, coalesce(v_nota, calcular_nota_online(p_matricula)), v_conteudo,
    v_cfg.assinante_nome, v_cfg.assinante_cargo,
    coalesce(v_comps, '{}'), coalesce(v_demonstra, '{}')
  )
  returning id into v_id;

  update matricula set status = 'certificado_emitido' where id = p_matricula;
  return v_id;
end $fn$;

insert into migration_aplicada (nome) values ('0042_veredito_competencia.sql')
on conflict (nome) do nothing;
