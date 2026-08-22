-- 0038_competencias.sql
--
-- Vocabulário de competências: as 12 definidas pela equipe pedagógica, com os
-- atributos que as compõem.
--
-- POR QUE ISTO NÃO É SÓ UM RÓTULO
--
-- Histórico de atividade complementar registra QUANTIDADE: tantas horas,
-- tantos certificados. É o que a integralização exige, e não é o que alguém
-- pergunta numa entrevista ou numa banca — lá a pergunta é o que a pessoa
-- aprendeu a fazer.
--
-- Ligando curso a competência, três coisas passam a existir de graça:
--   1. o certificado declara o que foi desenvolvido, não só quanto tempo durou
--   2. o aluno vê HORAS POR COMPETÊNCIA, que é o retrato que falta hoje
--   3. a autoavaliação futura tem onde se apoiar: um diagnóstico apontando
--      "Comunicação Efetiva baixa" vira consulta a esta tabela para sugerir
--      cursos. A estrutura já nasce pronta para isso.
--
-- E há um encaixe com o padrão que já usamos: o Open Badges 3.0 tem um campo
-- próprio (`alignment`) para alinhar credencial a referencial de competências.
-- O vocabulário entra na credencial assinada de forma legível por máquina —
-- é o uso pretendido do padrão, não enfeite.

create table if not exists competencia (
  id        uuid primary key default gen_random_uuid(),
  numero    int  not null unique,
  nome      text not null unique,
  slug      text not null unique,
  descricao text,
  atributos text[] not null default '{}',
  ordem     int  not null default 0,
  ativa     boolean not null default true,
  criado_em timestamptz not null default now()
);

create index if not exists idx_competencia_ordem on competencia (ordem, nome);

-- Relação curso <-> competência. Tabela de ligação, não coluna: um curso
-- desenvolve mais de uma, e uma competência é desenvolvida por vários cursos.
create table if not exists curso_competencia (
  curso_id       uuid not null references curso(id) on delete cascade,
  competencia_id uuid not null references competencia(id) on delete restrict,
  primary key (curso_id, competencia_id)
);

create index if not exists idx_curso_competencia_comp on curso_competencia (competencia_id);

-- `on delete restrict` de propósito: excluir uma competência em uso deixaria
-- cursos sem o rótulo que já foi impresso em certificado. Desativar é o caminho.

alter table certificado add column if not exists competencias text[];

comment on column certificado.competencias is
  'Snapshot das competências no momento da emissão. Como o nome e o RGA, o documento não muda quando o cadastro mudar.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table competencia enable row level security;
alter table curso_competencia enable row level security;

-- Leitura pública: o catálogo é aberto a visitante sem conta e mostra as
-- competências de cada curso. Não há nada sensível aqui.
drop policy if exists competencia_leitura on competencia;
create policy competencia_leitura on competencia for select using (true);

drop policy if exists curso_competencia_leitura on curso_competencia;
create policy curso_competencia_leitura on curso_competencia for select using (true);

-- Escrita só por RPC (security definer). Sem policy de insert/update/delete.

-- ---------------------------------------------------------------------------
-- Semente: as 12 competências e seus atributos
-- ---------------------------------------------------------------------------

insert into competencia (numero, nome, slug, atributos, ordem) values
  (1, 'Adaptabilidade, Flexibilidade e Resiliência', 'adaptabilidade-flexibilidade-e-resiliencia', array['Adaptabilidade','Flexibilidade cognitiva','Resiliência','Tolerância à ambiguidade','Capacidade de lidar com mudanças','Mentalidade de crescimento','Experimentação'], 10),
  (2, 'Pensamento Analítico e Crítico', 'pensamento-analitico-e-critico', array['Pensamento analítico','Pensamento crítico','Visão sistêmica','Capacidade de síntese','Avaliação de riscos','Capacidade de interpretar dados','Raciocínio lógico'], 20),
  (3, 'Resolução de Problemas em Contextos Incertos', 'resolucao-de-problemas-em-contextos-incertos', array['Resolução de problemas complexos','Tomada de decisão em cenários incertos','Criatividade aplicada à solução de problemas','Agilidade mental','Foco em soluções'], 30),
  (4, 'Julgamento Ético / Tomada de Decisão Responsável', 'julgamento-etico-tomada-de-decisao-responsavel', array['Julgamento ético','Responsabilidade social','Tomada de decisão responsável','Integridade','Consciência dos impactos','Transparência'], 40),
  (5, 'Criatividade / Inovação', 'criatividade-inovacao', array['Criatividade','Inovação','Pensamento divergente','Capacidade de gerar ideias','Visão de futuro','Curiosidade','Experimentação'], 50),
  (6, 'Liderança e Influência Social', 'lideranca-e-influencia-social', array['Liderança','Inspiração pelo exemplo','Gestão de conflitos','Feedback construtivo','Mobilização de pessoas','Responsabilidade','Influência social'], 60),
  (7, 'Comunicação Efetiva + Empatia / Escuta Ativa', 'comunicacao-efetiva-empatia-escuta-ativa', array['Comunicação assertiva','Escuta ativa','Clareza na expressão','Capacidade de adaptar linguagem','Sensibilidade interpessoal','Empatia'], 70),
  (8, 'Influência Social / Comunicação', 'influencia-social-comunicacao', array['Influência social','Comunicação estratégica','Capacidade de persuasão','Construção de redes de relacionamento','Engajamento de públicos diversos','Negociação'], 80),
  (9, 'Inteligência Emocional', 'inteligencia-emocional', array['Inteligência emocional','Autogestão emocional','Reconhecimento de emoções','Regulação emocional','Empatia','Resiliência'], 90),
  (10, 'Empatia, Colaboração, Foco no Cliente/Usuário', 'empatia-colaboracao-foco-no-cliente-usuario', array['Empatia','Colaboração','Foco no cliente/usuário','Trabalho em equipe','Respeito à diversidade','Orientação para o outro'], 100),
  (11, 'Aprendizado Contínuo / Curiosidade', 'aprendizado-continuo-curiosidade', array['Aprendizado contínuo','Curiosidade','Autodesenvolvimento','Busca por conhecimento','Mentalidade de crescimento','Aprender com a experiência'], 110),
  (12, 'Gestão de Tempo, Prioridades e Energia', 'gestao-de-tempo-prioridades-e-energia', array['Planejamento pessoal e profissional','Gestão de tempo','Gestão de energia','Foco e disciplina','Organização','Capacidade de priorização'], 120)
on conflict (numero) do nothing;


-- ---------------------------------------------------------------------------
-- Gestão (coordenação)
-- ---------------------------------------------------------------------------

create or replace function atualizar_competencia(p_competencia uuid, p_dados jsonb)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;

  update competencia set
    nome      = coalesce(nullif(trim(coalesce(p_dados->>'nome','')), ''), nome),
    descricao = nullif(trim(coalesce(p_dados->>'descricao','')), ''),
    ordem     = coalesce(nullif(p_dados->>'ordem','')::int, ordem),
    ativa     = coalesce((p_dados->>'ativa')::boolean, ativa),
    atributos = coalesce(
      (select array_agg(trim(x)) from jsonb_array_elements_text(p_dados->'atributos') x
        where trim(x) <> ''),
      atributos)
  where id = p_competencia;

  if not found then raise exception 'competencia inexistente'; end if;
end $fn$;

-- Lista com uso, para a tela da coordenação e para o catálogo.
create or replace function competencias_com_uso()
returns table (
  id uuid, numero int, nome text, slug text, descricao text,
  atributos text[], ordem int, ativa boolean,
  cursos int, cursos_publicados int
)
language sql stable security definer set search_path = public as $fn$
  select c.id, c.numero, c.nome, c.slug, c.descricao, c.atributos, c.ordem, c.ativa,
         (select count(*)::int from curso_competencia cc where cc.competencia_id = c.id),
         (select count(*)::int from curso_competencia cc
            join curso cu on cu.id = cc.curso_id
            where cc.competencia_id = c.id and cu.status = 'publicado')
  from competencia c
  order by c.ordem, c.numero;
$fn$;

grant execute on function atualizar_competencia(uuid, jsonb) to authenticated;
grant execute on function competencias_com_uso() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- O professor declara as competências do curso
-- ---------------------------------------------------------------------------

-- Máximo de três. Curso que desenvolve oito competências não desenvolve
-- nenhuma de verdade — e o certificado com oito rótulos não diz nada. O limite
-- força a escolha, que é o ponto.
create or replace function definir_competencias_curso(p_curso uuid, p_ids uuid[])
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not (e_admin() or e_autor_do_curso(p_curso)) then
    raise exception 'sem permissao para editar este curso';
  end if;

  if coalesce(array_length(p_ids, 1), 0) > 3 then
    raise exception 'escolha no maximo 3 competencias: um curso que desenvolve tudo nao desenvolve nada';
  end if;

  delete from curso_competencia where curso_id = p_curso;

  if coalesce(array_length(p_ids, 1), 0) > 0 then
    insert into curso_competencia (curso_id, competencia_id)
    select p_curso, unnest(p_ids)
    on conflict do nothing;
  end if;
end $fn$;

grant execute on function definir_competencias_curso(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Horas por competência — o retrato que faltava
-- ---------------------------------------------------------------------------

-- ATENÇÃO À CONTAGEM: um curso de 20h que declara 3 competências soma 20h em
-- CADA UMA, não 6,7h em cada. Não é erro de soma — a pessoa exercitou as três
-- durante as 20 horas. Por isso o total por competência PODE ULTRAPASSAR o
-- total de horas do aluno, e a tela precisa deixar isso claro para ninguém
-- achar que a conta está errada.

create or replace function minhas_competencias()
returns jsonb language sql stable security definer set search_path = public as $fn$
  select coalesce(jsonb_agg(x order by (x->>'horas')::int desc, x->>'nome'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'nome', co.nome,
      'slug', co.slug,
      'numero', co.numero,
      'horas', sum(cu.carga_horaria)::int,
      'cursos', count(distinct cu.id)::int
    ) as x
    from certificado ce
    join matricula m on m.id = ce.matricula_id
    join turma t     on t.id = m.turma_id
    join curso cu    on cu.id = t.curso_id
    join curso_competencia cc on cc.curso_id = cu.id
    join competencia co       on co.id = cc.competencia_id
    where m.usuario_id = auth.uid() and ce.revogado_em is null
    group by co.id, co.nome, co.slug, co.numero
  ) s;
$fn$;

grant execute on function minhas_competencias() to authenticated;


-- ---------------------------------------------------------------------------
-- A emissão congela as competências
-- ---------------------------------------------------------------------------

create or replace function emitir_certificado(p_matricula uuid)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_cfg      configuracao%rowtype;
  v_status   status_matricula;
  v_nome     text;
  v_rga      text;
  v_comps    text[];
  v_curso    curso%rowtype;
  v_turma    turma%rowtype;
  v_conteudo jsonb;
  v_inicio   date;
  v_fim      date;
  v_nota     numeric;
  v_id       uuid;
begin
  select * into v_cfg from configuracao where id;

  select m.status, u.nome_completo, u.rga, m.nota_final into v_status, v_nome, v_rga, v_nota
  from matricula m join usuario u on u.id = m.usuario_id
  where m.id = p_matricula;

  if v_status is null then raise exception 'matricula inexistente'; end if;

  -- Última barreira: fechar_turma chama esta função em lote, e uma turma pode
  -- ser fechada depois de o curso ter sido arquivado.
  perform verificar_matricula_ativa(p_matricula);

  -- Snapshot, como o nome e o RGA: o documento não muda quando o curso mudar.
  select array_agg(co.nome order by co.ordem) into v_comps
  from curso_competencia cc
  join competencia co on co.id = cc.competencia_id
  join turma t on t.id = (select turma_id from matricula where id = p_matricula)
  where cc.curso_id = t.curso_id;
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
    assinante_nome, assinante_cargo, competencias
  ) values (
    p_matricula, gerar_codigo_certificado(), v_nome, v_rga, v_curso.titulo,
    v_curso.carga_horaria, v_curso.modalidade,
    v_inicio, v_fim, coalesce(v_nota, calcular_nota_online(p_matricula)), v_conteudo,
    v_cfg.assinante_nome, v_cfg.assinante_cargo
  ,
    coalesce(v_comps, '{}')
  )
  returning id into v_id;

  update matricula set status = 'certificado_emitido' where id = p_matricula;
  return v_id;
end $fn$

insert into migration_aplicada (nome) values ('0038_competencias.sql')
on conflict (nome) do nothing;
