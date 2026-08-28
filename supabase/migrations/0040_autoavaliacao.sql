-- 0040_autoavaliacao.sql
--
-- Autoavaliação de competências: o aluno responde uma escala de frequência, e o
-- resultado vira o eixo do percurso dele — perfil por competência e recomendação
-- de cursos.
--
-- ============================================================================
-- AS TRÊS DECISÕES QUE EXPLICAM ESTE ARQUIVO
-- ============================================================================
--
-- 1. GUARDA-SE A RESPOSTA ITEM A ITEM, NUNCA SÓ A MÉDIA
--
-- A planilha da equipe pedagógica tem uma coluna chamada "CHECKED -->
-- [RE]ordenado": o mapeamento de frase para competência JÁ MUDOU uma vez, e as
-- trilhas ainda estão sendo montadas. Vai mudar de novo.
--
-- Se gravássemos {Comunicação: 3.8}, mover uma frase da competência 8 para a 7
-- transformaria todo resultado anterior em número que ninguém consegue
-- recalcular nem invalidar. Gravando {item 34: 4}, uma correção de mapeamento
-- vira um recálculo.
--
-- É o princípio do snapshot do certificado ao contrário: o certificado congela
-- porque o documento entregue não pode mudar; aqui guarda-se o cru porque a
-- interpretação ainda vai mudar.
--
-- 2. O CONJUNTO DE ITENS É VERSIONADO
--
-- `resposta_questionario.questionario_id` amarra cada resultado à versão do
-- instrumento que o produziu. Sem isso, comparar a resposta de março com a de
-- outubro seria comparar réguas diferentes sem saber. Com isso, refazer o teste
-- depois — que é como a extensão vai mostrar evolução — sai de graça.
--
-- 3. NENHUMA POLICY DE LEITURA AMPLA É CRIADA
--
-- A coordenação e o professor precisam ver resultado de aluno. A tentação é uma
-- policy "admin vê tudo" em `resposta_questionario`. Não foi feito: a lição 4.3
-- registra CINCO vazamentos causados por exatamente isso, porque policies
-- permissivas combinam com OR e telas que confiam só no RLS passam a mostrar
-- dado alheio.
--
-- Em vez disso, o RLS destas tabelas é dono-apenas, sem exceção, e o acesso de
-- terceiro passa por `perfil_competencias_de()` — `security definer`, com a
-- checagem de quem pode ver por dentro. Consequência prática: nenhuma tela
-- existente muda de comportamento por causa desta migration.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table if not exists questionario (
  id           uuid primary key default gen_random_uuid(),
  versao       int  not null unique,
  titulo       text not null,
  descricao    text,
  ativo        boolean not null default false,
  publicado_em timestamptz,
  criado_em    timestamptz not null default now()
);

-- Só um questionário ativo por vez. Índice parcial em vez de trigger: o banco
-- garante sozinho, e a garantia não depende de ninguém lembrar de chamar nada.
create unique index if not exists idx_questionario_um_ativo
  on questionario ((true)) where ativo;

create table if not exists questionario_item (
  id              uuid primary key default gen_random_uuid(),
  questionario_id uuid not null references questionario(id) on delete cascade,
  competencia_id  uuid not null references competencia(id) on delete restrict,
  ordem           int  not null,
  enunciado       text not null,
  criado_em       timestamptz not null default now(),
  unique (questionario_id, ordem)
);

create index if not exists idx_questionario_item_comp
  on questionario_item (competencia_id);

create table if not exists resposta_questionario (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references usuario(id) on delete cascade,
  questionario_id uuid not null references questionario(id) on delete restrict,
  iniciado_em     timestamptz not null default now(),
  concluido_em    timestamptz
);

-- Uma resposta em andamento por pessoa e por versão. O aluno fecha o navegador
-- na questão 30 e retoma de onde parou, em vez de recomeçar — com 53 itens,
-- recomeçar é o mesmo que abandonar.
create unique index if not exists idx_resposta_uma_em_andamento
  on resposta_questionario (usuario_id, questionario_id)
  where concluido_em is null;

create index if not exists idx_resposta_usuario
  on resposta_questionario (usuario_id, concluido_em desc);

create table if not exists resposta_item (
  resposta_id   uuid not null references resposta_questionario(id) on delete cascade,
  item_id       uuid not null references questionario_item(id) on delete restrict,
  valor         smallint not null check (valor between 1 and 5),
  respondido_em timestamptz not null default now(),
  primary key (resposta_id, item_id)
);

-- `on delete restrict` no item: apagar uma frase já respondida deixaria
-- respostas órfãs e resultados irreprodutíveis. A coordenação versiona ou
-- desativa; nunca apaga item com resposta. É o mesmo raciocínio do
-- `on delete restrict` de curso_competencia na 0038.

comment on table resposta_item is
  'Resposta crua, item a item. É a fonte da verdade — as médias por competência são calculadas na leitura, nunca gravadas.';

-- ---------------------------------------------------------------------------
-- Configuração: as duas alavancas da coordenação
-- ---------------------------------------------------------------------------

alter table configuracao
  add column if not exists questionario_obrigatorio boolean not null default false;

alter table configuracao
  add column if not exists questionario_visibilidade text not null default 'turma';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'configuracao_visibilidade_check'
  ) then
    alter table configuracao add constraint configuracao_visibilidade_check
      check (questionario_visibilidade in ('aluno', 'coordenacao', 'turma'));
  end if;
end $$;

comment on column configuracao.questionario_obrigatorio is
  'Quando true, inscrever() exige autoavaliação concluída. NASCE FALSE de propósito: ligar a trava antes de a tela do questionário existir bloquearia toda inscrição da plataforma. A coordenação liga depois, em /admin/configuracao.';

comment on column configuracao.questionario_visibilidade is
  'aluno = só o próprio; coordenacao = + admin; turma = + o instrutor de alguma turma em que o aluno está matriculado.';

-- ---------------------------------------------------------------------------
-- Predicados
-- ---------------------------------------------------------------------------

-- Consulta `resposta_questionario`, que tem RLS. Por isso é security definer:
-- policy que consulta tabela com RLS dispara a policy dela, e a lição 4.2
-- registra a recursão que isso causou na 0019 e derrubou /cursos.
create or replace function e_dono_resposta(p_resposta uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from resposta_questionario r
    where r.id = p_resposta and r.usuario_id = auth.uid()
  );
$fn$;

-- Quem chama dá aula em alguma turma onde este aluno está matriculado.
create or replace function e_instrutor_do_aluno(p_aluno uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from matricula m
    join turma t on t.id = m.turma_id
    where m.usuario_id = p_aluno and t.instrutor_id = auth.uid()
  );
$fn$;

create or replace function pode_ver_autoavaliacao(p_aluno uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select case
    when auth.uid() is null then false
    when p_aluno = auth.uid() then true
    when (select questionario_visibilidade from configuracao where id) = 'aluno' then false
    when e_admin() then true
    when (select questionario_visibilidade from configuracao where id) = 'turma'
      then e_instrutor_do_aluno(p_aluno)
    else false
  end;
$fn$;

grant execute on function e_dono_resposta(uuid)        to authenticated;
grant execute on function e_instrutor_do_aluno(uuid)   to authenticated;
grant execute on function pode_ver_autoavaliacao(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS — dono apenas, sem exceção
-- ---------------------------------------------------------------------------

alter table questionario            enable row level security;
alter table questionario_item       enable row level security;
alter table resposta_questionario   enable row level security;
alter table resposta_item           enable row level security;

drop policy if exists questionario_leitura on questionario;
create policy questionario_leitura on questionario
  for select to authenticated using (ativo or e_admin());

drop policy if exists questionario_item_leitura on questionario_item;
create policy questionario_item_leitura on questionario_item
  for select to authenticated using (
    exists (select 1 from questionario q where q.id = questionario_id and (q.ativo or e_admin()))
  );

-- Note que `questionario_item` expõe `competencia_id`. Isso é deliberado: o
-- aluno pode saber que existe um agrupamento. O que a RPC do questionário NÃO
-- devolve é a competência de cada frase enquanto ele responde — saber que seis
-- frases seguidas medem "resiliência" convida a responder de forma coerente com
-- a autoimagem, não com o comportamento. Mesma lógica do gabarito do quiz.

drop policy if exists resposta_propria on resposta_questionario;
create policy resposta_propria on resposta_questionario
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

drop policy if exists resposta_item_propria on resposta_item;
create policy resposta_item_propria on resposta_item
  for all to authenticated
  using (e_dono_resposta(resposta_id))
  with check (e_dono_resposta(resposta_id));

-- ---------------------------------------------------------------------------
-- Responder
-- ---------------------------------------------------------------------------

-- O questionário ativo, com os itens EM ORDEM e SEM revelar a competência de
-- cada frase (ver comentário na policy acima). Devolve também a resposta já
-- dada, para a tela conseguir retomar de onde parou.
create or replace function questionario_ativo()
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_q   questionario%rowtype;
  v_r   resposta_questionario%rowtype;
  v_itens jsonb;
begin
  if auth.uid() is null then raise exception 'nao autenticado'; end if;

  select * into v_q from questionario where ativo limit 1;
  if v_q.id is null then return jsonb_build_object('existe', false); end if;

  select * into v_r from resposta_questionario
  where usuario_id = auth.uid() and questionario_id = v_q.id and concluido_em is null;

  select coalesce(jsonb_agg(
    jsonb_build_object('id', i.id, 'ordem', i.ordem, 'enunciado', i.enunciado,
                       'valor', ri.valor)
    order by i.ordem
  ), '[]'::jsonb) into v_itens
  from questionario_item i
  left join resposta_item ri on ri.item_id = i.id and ri.resposta_id = v_r.id
  where i.questionario_id = v_q.id;

  return jsonb_build_object(
    'existe', true,
    'questionario_id', v_q.id,
    'titulo', v_q.titulo,
    'descricao', v_q.descricao,
    'resposta_id', v_r.id,
    'total', jsonb_array_length(v_itens),
    'itens', v_itens
  );
end $fn$;

create or replace function iniciar_questionario()
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_q  uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'nao autenticado'; end if;

  select id into v_q from questionario where ativo limit 1;
  if v_q is null then raise exception 'nenhum questionario ativo'; end if;

  -- Retomar vem ANTES de criar. Mesma ordem de inscrever(): quem já começou não
  -- pode ser mandado de volta ao início por uma regra escrita pensando em quem
  -- está começando agora (lição 4.4).
  select id into v_id from resposta_questionario
  where usuario_id = auth.uid() and questionario_id = v_q and concluido_em is null;
  if v_id is not null then return v_id; end if;

  insert into resposta_questionario (usuario_id, questionario_id)
  values (auth.uid(), v_q) returning id into v_id;
  return v_id;
end $fn$;

create or replace function responder_item(p_resposta uuid, p_item uuid, p_valor int)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  v_concluido timestamptz;
  v_q         uuid;
begin
  if not e_dono_resposta(p_resposta) then raise exception 'resposta de outra pessoa'; end if;
  if p_valor < 1 or p_valor > 5 then raise exception 'valor fora da escala de 1 a 5'; end if;

  select concluido_em, questionario_id into v_concluido, v_q
  from resposta_questionario where id = p_resposta;

  if v_concluido is not null then
    raise exception 'esta autoavaliacao ja foi concluida';
  end if;

  -- O item precisa pertencer à MESMA versão da resposta. Sem esta checagem,
  -- alguém poderia responder itens de duas versões na mesma resposta e o
  -- resultado seria de uma régua que nunca existiu.
  if not exists (
    select 1 from questionario_item i where i.id = p_item and i.questionario_id = v_q
  ) then
    raise exception 'item nao pertence a este questionario';
  end if;

  insert into resposta_item (resposta_id, item_id, valor)
  values (p_resposta, p_item, p_valor)
  on conflict (resposta_id, item_id)
  do update set valor = excluded.valor, respondido_em = now();
end $fn$;

create or replace function concluir_questionario(p_resposta uuid)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_q          uuid;
  v_total      int;
  v_respondido int;
begin
  if not e_dono_resposta(p_resposta) then raise exception 'resposta de outra pessoa'; end if;

  select questionario_id into v_q from resposta_questionario where id = p_resposta;

  select count(*) into v_total from questionario_item where questionario_id = v_q;
  select count(*) into v_respondido from resposta_item where resposta_id = p_resposta;

  if v_respondido < v_total then
    raise exception 'faltam % de % itens', v_total - v_respondido, v_total;
  end if;

  update resposta_questionario set concluido_em = now()
  where id = p_resposta and concluido_em is null;

  return jsonb_build_object('ok', true, 'itens', v_total);
end $fn$;

grant execute on function questionario_ativo()                     to authenticated;
grant execute on function iniciar_questionario()                   to authenticated;
grant execute on function responder_item(uuid, uuid, int)          to authenticated;
grant execute on function concluir_questionario(uuid)              to authenticated;

-- ---------------------------------------------------------------------------
-- Resultado
-- ---------------------------------------------------------------------------

-- POR QUE FAIXA E NÃO NOTA COM DECIMAL
--
-- O número de itens por competência vai de 3 a 7. A média não é distorcida por
-- isso, mas a PRECISÃO é: numa competência de 3 itens, a diferença entre 3,8 e
-- 4,0 é uma pessoa marcando 4 em vez de 5 numa única frase. Mostrar "3,8/5"
-- promete uma medição que o instrumento não faz. A faixa é honesta, e `itens`
-- vai junto para a tela poder dizer de quantas frases aquilo saiu.
create or replace function perfil_competencias_de(p_aluno uuid)
returns table (
  competencia_id uuid, numero int, nome text, slug text,
  media numeric, faixa text, itens int, respondido_em timestamptz
)
language sql stable security definer set search_path = public as $fn$
  with permissao as (select pode_ver_autoavaliacao(p_aluno) as pode),
  ultima as (
    select r.id, r.concluido_em from resposta_questionario r, permissao p
    where p.pode and r.usuario_id = p_aluno and r.concluido_em is not null
    order by r.concluido_em desc limit 1
  )
  select
    c.id, c.numero, c.nome, c.slug,
    round(avg(ri.valor)::numeric, 2) as media,
    case
      when avg(ri.valor) >= 4.0 then 'desenvolvida'
      when avg(ri.valor) >= 3.0 then 'em_desenvolvimento'
      else 'a_desenvolver'
    end as faixa,
    count(*)::int as itens,
    max(u.concluido_em) as respondido_em
  from ultima u
  join resposta_item ri  on ri.resposta_id = u.id
  join questionario_item qi on qi.id = ri.item_id
  join competencia c     on c.id = qi.competencia_id
  group by c.id, c.numero, c.nome, c.slug
  order by avg(ri.valor) asc, c.ordem asc;
$fn$;

create or replace function meu_perfil_competencias()
returns table (
  competencia_id uuid, numero int, nome text, slug text,
  media numeric, faixa text, itens int, respondido_em timestamptz
)
language sql stable security definer set search_path = public as $fn$
  select * from perfil_competencias_de(auth.uid());
$fn$;

-- Só o número: quem chama descobre se a pessoa respondeu, sem ver resposta.
-- É o padrão "devolve o número, nunca as linhas" da seção 2 do ARQUITETURA.
create or replace function tem_autoavaliacao(p_aluno uuid default null)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from resposta_questionario r
    join questionario q on q.id = r.questionario_id
    where r.usuario_id = coalesce(p_aluno, auth.uid())
      and r.concluido_em is not null
      and q.ativo
  );
$fn$;

grant execute on function perfil_competencias_de(uuid)  to authenticated;
grant execute on function meu_perfil_competencias()     to authenticated;
grant execute on function tem_autoavaliacao(uuid)       to authenticated;

-- ---------------------------------------------------------------------------
-- Recomendação
-- ---------------------------------------------------------------------------

-- Cursos publicados ligados às competências em que o aluno se avaliou mais
-- baixo, excluindo os que ele já concluiu ou está cursando.
--
-- POR QUE UM GRUPO E NÃO A ÚNICA MAIS BAIXA
--
-- Eleger "sua competência mais fraca" por 0,2 ponto de diferença numa escala de
-- 3 itens é decidir no ruído. `p_competencias` pega as N mais baixas — o grupo é
-- estável mesmo quando a ordem interna dele não é.
--
-- `cobertura` volta junto porque a recomendação vale o que o catálogo tiver: se
-- nenhum curso publicado desenvolve a competência apontada, a tela precisa
-- dizer isso em vez de mostrar branco e parecer quebrada.
create or replace function cursos_recomendados(p_competencias int default 3, p_limite int default 6)
returns table (
  curso_id uuid, titulo text, slug text, descricao text, carga_horaria int,
  competencia_nome text, competencia_slug text, media numeric
)
language sql stable security definer set search_path = public as $fn$
  with fracas as (
    select competencia_id, nome, slug, media
    from meu_perfil_competencias()
    order by media asc, numero asc
    limit greatest(p_competencias, 1)
  )
  select distinct on (c.id)
    c.id, c.titulo, c.slug, c.descricao, c.carga_horaria,
    f.nome, f.slug, f.media
  from fracas f
  join curso_competencia cc on cc.competencia_id = f.competencia_id
  join curso c on c.id = cc.curso_id
  where c.status = 'publicado'
    and not exists (
      select 1 from matricula m
      join turma t on t.id = m.turma_id
      where m.usuario_id = auth.uid() and t.curso_id = c.id
    )
  order by c.id, f.media asc
  limit greatest(p_limite, 1);
$fn$;

create or replace function cobertura_competencias()
returns table (competencia_id uuid, nome text, cursos_publicados int)
language sql stable security definer set search_path = public as $fn$
  select c.id, c.nome,
         count(cu.id) filter (where cu.status = 'publicado')::int
  from competencia c
  left join curso_competencia cc on cc.competencia_id = c.id
  left join curso cu on cu.id = cc.curso_id
  where c.ativa
  group by c.id, c.nome, c.ordem
  order by c.ordem;
$fn$;

grant execute on function cursos_recomendados(int, int) to authenticated;
grant execute on function cobertura_competencias()      to authenticated;

-- ---------------------------------------------------------------------------
-- Gestão do instrumento pela coordenação (sem editar código)
-- ---------------------------------------------------------------------------

-- Nova versão a partir da ativa, como RASCUNHO. Editar a versão ativa mudaria a
-- régua embaixo de quem já respondeu; clonar preserva o histórico e deixa a
-- coordenação trabalhar sem pressa antes de publicar.
create or replace function clonar_questionario(p_titulo text default null)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_origem uuid;
  v_versao int;
  v_novo   uuid;
begin
  if not e_admin() then raise exception 'apenas a coordenacao'; end if;

  select id into v_origem from questionario where ativo limit 1;
  select coalesce(max(versao), 0) + 1 into v_versao from questionario;

  insert into questionario (versao, titulo, descricao)
  select v_versao,
         coalesce(p_titulo, q.titulo),
         q.descricao
  from questionario q where q.id = v_origem
  returning id into v_novo;

  if v_novo is null then
    insert into questionario (versao, titulo)
    values (v_versao, coalesce(p_titulo, 'Autoavaliação de competências'))
    returning id into v_novo;
  end if;

  insert into questionario_item (questionario_id, competencia_id, ordem, enunciado)
  select v_novo, i.competencia_id, i.ordem, i.enunciado
  from questionario_item i where i.questionario_id = v_origem;

  perform registrar_log('questionario_clonado', v_novo, jsonb_build_object('versao', v_versao));
  return v_novo;
end $fn$;

create or replace function salvar_item_questionario(
  p_item uuid, p_questionario uuid, p_competencia uuid, p_enunciado text, p_ordem int
) returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_id uuid;
begin
  if not e_admin() then raise exception 'apenas a coordenacao'; end if;
  if coalesce(trim(p_enunciado), '') = '' then raise exception 'o enunciado nao pode ficar vazio'; end if;

  -- Versão ativa não se edita: quem já respondeu ficaria com resultado apurado
  -- por uma régua diferente da que respondeu. Clone, edite, publique.
  if exists (select 1 from questionario where id = p_questionario and ativo) then
    raise exception 'esta versao esta ativa; clone antes de editar';
  end if;

  if p_item is null then
    insert into questionario_item (questionario_id, competencia_id, ordem, enunciado)
    values (p_questionario, p_competencia, p_ordem, trim(p_enunciado))
    returning id into v_id;
  else
    update questionario_item
       set competencia_id = p_competencia, enunciado = trim(p_enunciado), ordem = p_ordem
     where id = p_item and questionario_id = p_questionario
    returning id into v_id;
    if v_id is null then raise exception 'item inexistente nesta versao'; end if;
  end if;

  return v_id;
end $fn$;

create or replace function remover_item_questionario(p_item uuid)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not e_admin() then raise exception 'apenas a coordenacao'; end if;

  if exists (
    select 1 from questionario_item i
    join questionario q on q.id = i.questionario_id
    where i.id = p_item and q.ativo
  ) then
    raise exception 'esta versao esta ativa; clone antes de editar';
  end if;

  delete from questionario_item where id = p_item;
exception
  when foreign_key_violation then
    raise exception 'este item ja tem respostas e nao pode ser apagado';
end $fn$;

create or replace function publicar_questionario(p_questionario uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  v_itens int;
  v_sem   int;
begin
  if not e_admin() then raise exception 'apenas a coordenacao'; end if;

  select count(*) into v_itens from questionario_item where questionario_id = p_questionario;
  if v_itens = 0 then raise exception 'a versao nao tem nenhum item'; end if;

  -- Competência sem nenhum item nunca receberia nota, e a pessoa veria uma
  -- lacuna sem explicação no próprio perfil.
  select count(*) into v_sem from competencia c
  where c.ativa and not exists (
    select 1 from questionario_item i
    where i.questionario_id = p_questionario and i.competencia_id = c.id
  );
  if v_sem > 0 then
    raise exception '% competencia(s) ativa(s) sem nenhum item nesta versao', v_sem;
  end if;

  update questionario set ativo = false where ativo;
  update questionario set ativo = true, publicado_em = now() where id = p_questionario;

  perform registrar_log('questionario_publicado', p_questionario, '{}'::jsonb);
end $fn$;

create or replace function itens_questionario(p_questionario uuid)
returns table (
  id uuid, ordem int, enunciado text,
  competencia_id uuid, competencia_nome text, respostas int
)
language sql stable security definer set search_path = public as $fn$
  select i.id, i.ordem, i.enunciado, c.id, c.nome,
         (select count(*)::int from resposta_item ri where ri.item_id = i.id)
  from questionario_item i
  join competencia c on c.id = i.competencia_id
  where i.questionario_id = p_questionario
    and (e_admin() or exists (select 1 from questionario q where q.id = p_questionario and q.ativo))
  order by i.ordem;
$fn$;

grant execute on function clonar_questionario(text)                          to authenticated;
grant execute on function salvar_item_questionario(uuid, uuid, uuid, text, int) to authenticated;
grant execute on function remover_item_questionario(uuid)                    to authenticated;
grant execute on function publicar_questionario(uuid)                        to authenticated;
grant execute on function itens_questionario(uuid)                           to authenticated;

-- ---------------------------------------------------------------------------
-- A trava da inscrição
-- ---------------------------------------------------------------------------

-- NASCE DESLIGADA (`questionario_obrigatorio` default false).
--
-- Ligar a trava nesta migration bloquearia toda inscrição da plataforma até a
-- tela do questionário existir — o defeito da lição 4.10, que é justamente
-- comportamento que muda por um interruptor fora do código. Aqui o interruptor
-- é interno e a condição está escrita: só ligue depois que /questionario estiver
-- em produção e a equipe tiver revisado os itens.
--
-- BACKFILL: nenhum, de propósito. Quem já está matriculado continua com acesso
-- ao curso; a exigência vale para inscrição NOVA. Retroagir expulsaria gente de
-- curso em andamento por uma regra que não existia quando ela entrou.
create or replace function inscrever(p_turma uuid)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_id       uuid;
  v_turma    turma%rowtype;
  v_curso    text;
  v_prazo    int;
  v_expira   timestamptz;
  v_ocupadas int;
  v_atual    timestamptz;
begin
  if auth.uid() is null then raise exception 'nao autenticado'; end if;

  select c.status, c.prazo_conclusao_dias into v_curso, v_prazo
  from turma t join curso c on c.id = t.curso_id where t.id = p_turma;

  v_expira := case when v_prazo is null then null else now() + (v_prazo || ' days')::interval end;

  -- Já matriculado NESTA turma. Continua sendo a primeira coisa: quem já entrou
  -- não pode ser expulso por vaga, prazo, trava de reinscrição — nem pela
  -- exigência de autoavaliação, que é a novidade desta migration. Se esta
  -- checagem viesse antes, ligar a trava trancaria alunos para fora do próprio
  -- curso em andamento (lição 4.4).
  select id, expira_em into v_id, v_atual from matricula
  where usuario_id = auth.uid() and turma_id = p_turma;

  if v_id is not null then
    if v_atual is not null and now() > v_atual then
      update matricula
         set expira_em = v_expira, reiniciada_em = now()
       where id = v_id;
    end if;
    return v_id;
  end if;

  -- Autoavaliação exigida. Depois de "já matriculado", antes de tudo o mais:
  -- não faz sentido informar que faltam vagas para quem sequer pode se
  -- inscrever ainda, e a mensagem precisa dizer o que fazer.
  if (select questionario_obrigatorio from configuracao where id)
     and not tem_autoavaliacao() then
    raise exception 'responda a autoavaliacao de competencias antes da primeira inscricao';
  end if;

  perform pg_advisory_xact_lock(hashtext('inscrever'), hashtext(p_turma::text));

  select * into v_turma from turma where id = p_turma;
  if v_turma.id is null then raise exception 'turma inexistente'; end if;

  if v_curso is distinct from 'publicado' then
    raise exception 'este curso nao esta aberto para inscricao';
  end if;

  if exists (
    select 1 from matricula m
    join turma t2 on t2.id = m.turma_id
    where m.usuario_id = auth.uid()
      and t2.curso_id = v_turma.curso_id
      and m.status in ('aprovado', 'certificado_emitido')
  ) then
    raise exception 'voce ja concluiu este curso e nao pode cursa-lo novamente';
  end if;

  if v_turma.status <> 'inscricoes_abertas' then
    raise exception 'as inscricoes desta turma estao encerradas';
  end if;

  if v_turma.inscricoes_ate is not null and current_date > v_turma.inscricoes_ate then
    raise exception 'o prazo de inscricao terminou em %',
      to_char(v_turma.inscricoes_ate, 'DD/MM/YYYY');
  end if;

  if v_turma.vagas is not null then
    select count(*) into v_ocupadas from matricula where turma_id = p_turma;
    if v_ocupadas >= v_turma.vagas then
      raise exception 'nao ha vagas nesta turma';
    end if;
  end if;

  insert into matricula (usuario_id, turma_id, expira_em)
  values (auth.uid(), p_turma, v_expira)
  returning id into v_id;

  return v_id;
end $fn$;

-- ---------------------------------------------------------------------------
-- Semente: versão 1, 53 itens
-- ---------------------------------------------------------------------------
--
-- Origem: aba "Questionário" da planilha da equipe pedagógica (55 linhas),
-- menos duas repetições EXATAS dentro da mesma competência:
--   "Eu considero impactos sociais e morais antes de agir."  (competência 4, 2x)
--   "Eu priorizo tarefas conforme urgência e importância."   (competência 12, 2x)
--
-- A ordem NÃO é a da planilha. Lá as frases vêm agrupadas por competência, e
-- seis afirmações seguidas sobre resiliência avisam ao respondente o que está
-- sendo medido — o que puxa a resposta para a autoimagem em vez do
-- comportamento. Aqui elas vão em rodízio entre as 12 competências.
--
-- Distribuição herdada da planilha, de 3 a 7 itens por competência. Não foi
-- equilibrada de propósito: mexer nisso é decisão da equipe pedagógica, e a
-- tela de gestão existe para ela fazer isso sem código.

insert into questionario (versao, titulo, descricao, ativo, publicado_em)
values (1, 'Autoavaliação de competências',
        'Não existe resposta certa. Pense em como você age na maior parte das vezes, não em como gostaria de agir.',
        true, now())
on conflict (versao) do nothing;

insert into questionario_item (questionario_id, competencia_id, ordem, enunciado)
select q.id, c.id, s.ordem, s.enunciado
from (values
  (1, 1, 'Eu me ajusto rapidamente a mudanças de planos ou prioridades.'),
  (2, 2, 'Eu analiso dados e informações antes de tomar decisões.'),
  (3, 3, 'Eu consigo tomar decisões mesmo com informações incompletas.'),
  (4, 4, 'Eu considero impactos sociais e morais antes de agir.'),
  (5, 5, 'Eu proponho ideias originais para melhorar processos ou produtos.'),
  (6, 6, 'Eu inspiro colegas por meio de exemplo e atitude positiva.'),
  (7, 7, 'Eu expresso ideias com clareza e adequação ao público.'),
  (8, 8, 'Eu adapto minha comunicação para gerar engajamento e adesão'),
  (9, 9, 'Eu reconheço e regulo minhas emoções em diferentes contextos.'),
  (10, 10, 'Eu escuto ativamente as necessidades dos outros.'),
  (11, 11, 'Eu busco novos conhecimentos de forma autônoma e frequente'),
  (12, 12, 'Eu planejo minhas atividades com prazos e metas claras.'),
  (13, 1, 'Eu mantenho o foco mesmo diante de situações adversas.'),
  (14, 2, 'Eu questiono argumentos e identifico falhas lógicas em discursos ou propostas.'),
  (15, 3, 'Eu avalio riscos e adapto soluções conforme o contexto.'),
  (16, 4, 'Eu ajo com transparência e responsabilidade mesmo sob pressão.'),
  (17, 5, 'Eu combino conhecimentos de áreas diferentes para gerar soluções inovadoras.'),
  (18, 6, 'Eu mobilizo pessoas em torno de objetivos comuns.'),
  (19, 7, 'Eu escuto com atenção e demonstro empatia.'),
  (20, 8, 'Eu uso argumentos persuasivos com base em valores compartilhados.'),
  (21, 9, 'Eu identifico emoções nos outros e respondo com empatia.'),
  (22, 10, 'Eu colaboro com foco em objetivos comuns.'),
  (23, 11, 'Eu aplico aprendizados em diferentes contextos.'),
  (24, 12, 'Eu priorizo tarefas conforme urgência e importância.'),
  (25, 1, 'Eu aprendo com erros e sigo em frente com novas estratégias.'),
  (26, 2, 'Eu proponho alternativas com base em evidências e raciocínio estruturado.'),
  (27, 3, 'Eu reavalio estratégias diante de novas variáveis.'),
  (28, 4, 'Eu reconheço dilemas éticos e busco soluções justas.'),
  (29, 5, 'Eu experimento novas abordagens e aprendo com os resultados.'),
  (30, 6, 'Eu dou feedback construtivo e reconheço contribuições da equipe.'),
  (31, 7, 'Eu reformulo mensagens para garantir compreensão mútua.'),
  (32, 8, 'Eu construo redes de relacionamento para ampliar impacto.'),
  (33, 9, 'Eu mantenho relações saudáveis mesmo em situações de conflito.'),
  (34, 10, 'Eu proponho soluções centradas na experiência do cliente ou usuário.'),
  (35, 11, 'Eu demonstro interesse por temas além da minha área.'),
  (36, 12, 'Eu mantenho energia e foco ao longo do dia com pausas estratégicas.'),
  (37, 1, 'Eu ajusto meu comportamento diante de mudanças inesperadas sem perder produtividade.'),
  (38, 3, 'Eu identifico variáveis relevantes mesmo com informações incompletas.'),
  (39, 6, 'Costumo assumir a liderança quando trabalho em grupo.'),
  (40, 7, 'Eu demonstro interesse genuíno ao ouvir os outros.'),
  (41, 8, 'Antes de responder, procuro ouvir atentamente o que a outra pessoa tem a dizer.'),
  (42, 10, 'Eu pratico escuta ativa às necessidades dos outros antes de agir.'),
  (43, 1, 'Eu mantenho o equilíbrio emocional em situações de pressão ou adversidade.'),
  (44, 3, 'Eu tomo decisões com base em cenários possíveis e riscos calculados.'),
  (45, 6, 'Consigo motivar outras pessoas a alcançarem objetivos.'),
  (46, 8, 'Tenho facilidade para convencer outras pessoas quando apresento argumentos bem fundamentados.'),
  (47, 10, 'Eu trabalho em equipe com foco em objetivos comuns.'),
  (48, 1, 'Eu aprendo com erros e reoriento estratégias sem resistência.'),
  (49, 3, 'Eu reavalio soluções conforme novas informações surgem.'),
  (50, 6, 'Acredito que um bom líder deve desenvolver outras lideranças.'),
  (51, 8, 'Acredito que uma comunicação respeitosa facilita a resolução de conflitos.'),
  (52, 6, 'Sou capaz de influenciar pessoas sem impor minhas ideias.'),
  (53, 8, 'Minha forma de me comunicar influencia positivamente as pessoas ao meu redor.')
) as s(ordem, numero, enunciado)
join competencia c on c.numero = s.numero
cross join (select id from questionario where versao = 1) q
on conflict (questionario_id, ordem) do nothing;

insert into migration_aplicada (nome) values ('0040_autoavaliacao.sql')
on conflict (nome) do nothing;
