-- 0044_visibilidade_curso.sql
--
-- Cursos que não aparecem no catálogo.
--
-- O CASO QUE PEDIU ISTO
--
-- Uma mentoria aconteceu fora da plataforma. O aluno precisa de um lugar para
-- dissertar sobre o que desenvolveu e receber o certificado — mas aquele
-- "curso" existe só para aquelas pessoas e aquela finalidade. Publicá-lo no
-- catálogo convidaria estranhos a se inscreverem numa mentoria que não houve
-- para eles.
--
-- ============================================================================
-- TRÊS VISIBILIDADES, E A DIFERENÇA ENTRE AS DUAS ÚLTIMAS IMPORTA
-- ============================================================================
--
--   catalogo  (padrão)  aparece na vitrine, qualquer um se inscreve
--   link                não aparece, mas quem tem o endereço se inscreve
--   convite             não aparece e não existe autoinscrição; o professor
--                       coloca as pessoas dentro
--
-- `link` é o "não-listado" do YouTube: o ENDEREÇO é a credencial. Cômodo — o
-- professor manda um link no grupo e pronto —, mas se o link vazar, quem o
-- receber se inscreve. Serve para turma aberta que só não se quer anunciar.
--
-- `convite` é para quando o certificado depende de algo que aconteceu fora
-- daqui. Aí a MATRÍCULA é a credencial, e ela só existe se alguém que estava lá
-- colocou a pessoa. Um link vazado não dá acesso a nada.
--
-- Para o caso da mentoria, `convite` é o que preserva a decisão fundadora do
-- projeto: certificado com pré-requisito verificável. A escolha é do professor,
-- curso a curso, porque as duas situações existem.
--
-- ============================================================================
-- O QUE ISTO NÃO AFROUXA
-- ============================================================================
--
-- Visibilidade é ORTOGONAL a publicação. Curso restrito continua precisando
-- passar por `validar_publicacao` e ser publicado pela coordenação para emitir
-- certificado. Sem isso, um instrutor poderia criar um curso invisível, se
-- matricular sozinho e sair emitindo certificado com o nome da UFR sem ninguém
-- nunca ver.
--
-- BACKFILL: todo curso existente vira `catalogo`, que é o comportamento de
-- hoje. Nada muda para nada que já existe.

alter table curso
  add column if not exists visibilidade text not null default 'catalogo';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'curso_visibilidade_check') then
    alter table curso add constraint curso_visibilidade_check
      check (visibilidade in ('catalogo', 'link', 'convite'));
  end if;
end $$;

comment on column curso.visibilidade is
  'catalogo = na vitrine; link = fora da vitrine, autoinscrição por quem tem o endereço; convite = fora da vitrine e sem autoinscrição, só matrícula feita pelo professor.';

-- ---------------------------------------------------------------------------
-- Predicados
-- ---------------------------------------------------------------------------

-- Curso que uma pessoa sem matrícula pode ver. `link` entra: o endereço direto
-- precisa funcionar, senão a visibilidade não serviria para nada.
create or replace function curso_aberto_sem_matricula(p_curso uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from curso
    where id = p_curso and status = 'publicado' and visibilidade <> 'convite'
  );
$fn$;

-- Instrutor de alguma turma do curso, sem ser o autor.
--
-- POR QUE ESTA FUNÇÃO PRECISOU EXISTIR
--
-- Ao estreitar as policies abaixo, um instrutor que dá aula numa turma de curso
-- de outra pessoa perderia a leitura do curso — e a tela de turma dele quebraria
-- em silêncio. As policies antigas não precisavam disso porque `publicado`
-- cobria todo mundo. Estreitar uma permissão sempre corre o risco de derrubar
-- quem dependia da folga.
create or replace function sou_instrutor_em_curso(p_curso uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from turma t where t.curso_id = p_curso and t.instrutor_id = auth.uid()
  );
$fn$;

grant execute on function curso_aberto_sem_matricula(uuid) to anon, authenticated;
grant execute on function sou_instrutor_em_curso(uuid)     to authenticated;

-- ---------------------------------------------------------------------------
-- Policies estreitadas
-- ---------------------------------------------------------------------------
--
-- ATENÇÃO ao ler isto junto da lição 4.3: aqui a mudança é no sentido CONTRÁRIO
-- ao que causou os cinco vazamentos. Não estamos somando uma leitura ampla —
-- estamos removendo cursos `convite` de uma leitura que já era ampla.
--
-- Mas o risco espelhado é real: estreitar quebra quem dependia da folga. Os três
-- casos que dependiam, e continuam cobertos explicitamente, são o autor, o
-- instrutor da turma e quem já está matriculado.

drop policy if exists curso_publicado on curso;
create policy curso_publicado on curso
  for select using (
    curso_aberto_sem_matricula(id)
    or autor_id = auth.uid()
    or sou_instrutor_em_curso(id)
    or estou_matriculado_no_curso(id)
  );

drop policy if exists turma_de_curso_publicado on turma;
create policy turma_de_curso_publicado on turma
  for select using (
    curso_aberto_sem_matricula(curso_id)
    or sou_autor_do_curso_id(curso_id)
    or sou_instrutor_em_curso(curso_id)
    or estou_matriculado_na_turma(id)
  );

drop policy if exists modulo_de_curso_publicado on modulo;
create policy modulo_de_curso_publicado on modulo
  for select using (
    curso_aberto_sem_matricula(curso_id)
    or sou_autor_do_curso_id(curso_id)
    or sou_instrutor_em_curso(curso_id)
    or estou_matriculado_no_curso(curso_id)
  );

-- ---------------------------------------------------------------------------
-- Quem pode mudar a visibilidade
-- ---------------------------------------------------------------------------

create or replace function definir_visibilidade_curso(p_curso uuid, p_visibilidade text)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not pode_gerir_turma(p_curso) then raise exception 'apenas o autor ou a coordenacao'; end if;

  if p_visibilidade not in ('catalogo', 'link', 'convite') then
    raise exception 'visibilidade invalida';
  end if;

  update curso set visibilidade = p_visibilidade where id = p_curso;

  -- Tirar um curso do catálogo é decisão que muda quem tem acesso ao que a UFR
  -- certifica. Fica registrado como qualquer outro ato de gestão.
  insert into log_admin (acao, alvo_tipo, alvo_id, detalhe, autor_id)
  values ('visibilidade_curso', 'curso', p_curso, p_visibilidade, auth.uid());
end $fn$;

grant execute on function definir_visibilidade_curso(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- inscrever() recusa curso por convite
-- ---------------------------------------------------------------------------

create or replace function inscrever(p_turma uuid)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_id       uuid;
  v_turma    turma%rowtype;
  v_curso    text;
  v_visib    text;
  v_prazo    int;
  v_expira   timestamptz;
  v_ocupadas int;
  v_atual    timestamptz;
begin
  if auth.uid() is null then raise exception 'nao autenticado'; end if;

  select c.status, c.prazo_conclusao_dias, c.visibilidade into v_curso, v_prazo, v_visib
  from turma t join curso c on c.id = t.curso_id where t.id = p_turma;

  v_expira := case when v_prazo is null then null else now() + (v_prazo || ' days')::interval end;

  -- Já matriculado NESTA turma continua sendo a primeira coisa. Quem já entrou
  -- não pode ser expulso por vaga, prazo, trava de reinscrição, autoavaliação
  -- nem pela visibilidade — que é a novidade desta migration. Se um curso
  -- aberto virar `convite` depois, quem estava dentro continua dentro
  -- (lição 4.4).
  select id, expira_em into v_id, v_atual from matricula
  where usuario_id = auth.uid() and turma_id = p_turma;

  if v_id is not null then
    if v_atual is not null and now() > v_atual then
      update matricula set expira_em = v_expira, reiniciada_em = now() where id = v_id;
    end if;
    return v_id;
  end if;

  if v_visib = 'convite' then
    raise exception 'este curso e apenas por convite; procure o professor responsavel';
  end if;

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
-- O professor coloca as pessoas dentro
-- ---------------------------------------------------------------------------
--
-- Recebe uma lista de e-mails e devolve o que aconteceu com cada um. NÃO para
-- no primeiro problema: matricular 9 de 12 e dizer quais 3 falharam é muito
-- melhor que recusar as 12 porque um e-mail estava errado.
--
-- POR QUE NÃO CRIA CONTA
--
-- Criar conta para outra pessoa significa escolher a senha dela, ou mandar
-- e-mail de convite — e o nome que sai impresso no certificado passaria a ser
-- digitado por terceiro. Quem não tem conta é devolvido na lista de
-- `sem_conta`, e o professor pede para a pessoa se cadastrar.
--
-- POR QUE A AUTOAVALIAÇÃO NÃO É EXIGIDA AQUI
--
-- A trava do `inscrever()` existe para orientar quem está escolhendo curso. Numa
-- matrícula por convite não há escolha a orientar: a mentoria já aconteceu, e o
-- curso existe para registrar o que foi feito. Exigir 53 frases antes de o
-- professor conseguir registrar a turma dele seria burocracia sem propósito.

create or replace function matricular_por_email(p_turma uuid, p_emails text[])
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_curso     uuid;
  v_status    text;
  v_email     text;
  v_usuario   uuid;
  v_expira    timestamptz;
  v_prazo     int;
  v_ok        text[] := '{}';
  v_sem_conta text[] := '{}';
  v_ja        text[] := '{}';
begin
  if not e_instrutor_da_turma(p_turma) then
    raise exception 'apenas quem da aula nesta turma';
  end if;

  select t.curso_id, c.status, c.prazo_conclusao_dias into v_curso, v_status, v_prazo
  from turma t join curso c on c.id = t.curso_id where t.id = p_turma;

  if v_curso is null then raise exception 'turma inexistente'; end if;

  -- A publicação continua sendo o portão. Curso não publicado não emite
  -- certificado, e matricular gente nele criaria expectativa que não se cumpre.
  if v_status is distinct from 'publicado' then
    raise exception 'o curso precisa estar publicado para receber matriculas';
  end if;

  v_expira := case when v_prazo is null then null else now() + (v_prazo || ' days')::interval end;

  foreach v_email in array p_emails loop
    v_email := lower(trim(v_email));
    continue when v_email = '';

    select id into v_usuario from usuario where lower(email) = v_email;

    if v_usuario is null then
      -- `array_append`, nunca `||` com literal: o `||` é lido como array‖array e
      -- estoura com "malformed array literal" (lição 4.6).
      v_sem_conta := array_append(v_sem_conta, v_email);
      continue;
    end if;

    if exists (select 1 from matricula where usuario_id = v_usuario and turma_id = p_turma) then
      v_ja := array_append(v_ja, v_email);
      continue;
    end if;

    insert into matricula (usuario_id, turma_id, expira_em)
    values (v_usuario, p_turma, v_expira);

    v_ok := array_append(v_ok, v_email);
  end loop;

  if array_length(v_ok, 1) > 0 then
    insert into log_admin (acao, alvo_tipo, alvo_id, detalhe, autor_id)
    values ('matricula_por_convite', 'turma', p_turma,
            array_length(v_ok, 1) || ' pessoa(s)', auth.uid());
  end if;

  return jsonb_build_object(
    'matriculados', to_jsonb(v_ok),
    'sem_conta',    to_jsonb(v_sem_conta),
    'ja_estavam',   to_jsonb(v_ja)
  );
end $fn$;

grant execute on function matricular_por_email(uuid, text[]) to authenticated;


-- ---------------------------------------------------------------------------
-- A vitrine da página inicial também precisa do filtro
-- ---------------------------------------------------------------------------
--
-- `vitrine_inicio()` (0032) é `security definer` — ela roda como dona da tabela
-- e IGNORA o RLS de propósito, porque precisa mostrar o catálogo para visitante
-- sem conta. Isso significa que as policies estreitadas acima não a alcançam:
-- sem esta correção, um curso por convite apareceria em destaque na home,
-- exatamente na tela mais visível da plataforma.
--
-- É o espelho da lição 4.3. Lá o perigo era a tela confiar só no RLS; aqui é a
-- função que passa por cima dele. Toda função `security definer` que lista
-- curso precisa repetir o filtro de visibilidade à mão, porque o banco não vai
-- aplicá-lo por ela.

create or replace function vitrine_inicio()
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare v_destaques jsonb; v_rotacao jsonb; v_novidades jsonb;
begin
  select coalesce(jsonb_agg(x order by x->>'destacadoEm' desc), '[]'::jsonb)
    into v_destaques
  from (
    select jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'titulo', c.titulo,
      'descricao', c.descricao, 'cargaHoraria', c.carga_horaria,
      'modalidade', c.modalidade, 'capaUrl', c.capa_url,
      'categoria', cat.nome, 'nota', c.destaque_nota,
      'destacadoEm', c.destacado_em
    ) as x
    from curso c
    left join categoria cat on cat.id = c.categoria_id
    where c.status = 'publicado' and c.visibilidade = 'catalogo' and c.destaque_nota is not null
    limit 3
  ) s;

  -- Só sorteia se não houver curadoria.
  if jsonb_array_length(v_destaques) = 0 then
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v_rotacao
    from (
      select jsonb_build_object(
        'id', c.id, 'slug', c.slug, 'titulo', c.titulo,
        'descricao', c.descricao, 'cargaHoraria', c.carga_horaria,
        'modalidade', c.modalidade, 'capaUrl', c.capa_url,
        'categoria', cat.nome
      ) as x
      from curso c
      left join categoria cat on cat.id = c.categoria_id
      where c.status = 'publicado' and c.visibilidade = 'catalogo'
      -- md5(id || data) é estável dentro do dia e diferente a cada dia
      order by md5(c.id::text || current_date::text)
      limit 3
    ) s;
  else
    v_rotacao := '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(x order by x->>'criadoEm' desc), '[]'::jsonb)
    into v_novidades
  from (
    select jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'titulo', c.titulo,
      'cargaHoraria', c.carga_horaria, 'modalidade', c.modalidade,
      'capaUrl', c.capa_url, 'categoria', cat.nome, 'criadoEm', c.criado_em
    ) as x
    from curso c
    left join categoria cat on cat.id = c.categoria_id
    where c.status = 'publicado' and c.visibilidade = 'catalogo'
    order by c.criado_em desc
    limit 4
  ) s;

  return jsonb_build_object(
    'destaques', v_destaques,
    'rotacao', v_rotacao,
    'novidades', v_novidades
  );
end $fn$;


grant execute on function vitrine_inicio() to anon, authenticated;

insert into migration_aplicada (nome) values ('0044_visibilidade_curso.sql')
on conflict (nome) do nothing;
