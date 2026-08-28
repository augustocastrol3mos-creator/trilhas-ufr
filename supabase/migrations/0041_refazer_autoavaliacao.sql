-- 0041_refazer_autoavaliacao.sql
--
-- Limita quando o aluno pode refazer a autoavaliação.
--
-- O PROBLEMA
--
-- Refazer à vontade destrói as duas coisas que a autoavaliação existe para dar.
--
-- Destrói a linha de base: "progresso" só significa alguma coisa contra um
-- ponto de partida fixo. Se a primeira resposta pode ser reescrita a qualquer
-- momento, não há de onde medir — o aluno tem sempre um retrato só, o de agora.
--
-- E convida à manipulação: com refazer livre, quem não gostou da recomendação
-- responde de novo até o sistema sugerir o que ele já queria fazer. Não é má-fé
-- necessariamente; é o comportamento natural de quem quer o resultado bonito.
--
-- A REGRA
--
-- Refazer é liberado quando aconteceu alguma coisa que justifique o retrato ter
-- mudado:
--
--   1. o aluno CONCLUIU um curso depois da última resposta — este é o caso
--      principal, e é o que dá a narrativa: "você concluiu Comunicação
--      Assertiva; veja o que mudou"
--   2. passou o intervalo de tempo configurado (padrão: 180 dias, um semestre)
--   3. a coordenação liberou manualmente — para o caso de quem respondeu
--      errado, entendeu a escala ao contrário, ou clicou sem ler
--
-- O QUE ISTO NÃO RESOLVE, E É IMPORTANTE DIZER
--
-- Nada impede o aluno de responder o que quiser da PRIMEIRA vez. Autorrelato é
-- gamificável por definição, e nenhuma trava conserta isso. O que dá para fazer
-- é tirar o INCENTIVO: enquanto a autoavaliação servir só para orientar a
-- própria pessoa, manipular só engana a si mesmo. No dia em que ela valer nota,
-- vaga ou certificado, ela passa a valer a pena de manipular — e aí o
-- instrumento morre. É a razão de o certificado nunca poder se apoiar nela.

alter table configuracao
  add column if not exists questionario_refazer_dias int not null default 180;

comment on column configuracao.questionario_refazer_dias is
  'Dias desde a última resposta a partir dos quais refazer fica liberado sozinho. Concluir um curso libera antes disso.';

-- ---------------------------------------------------------------------------
-- Liberação manual
-- ---------------------------------------------------------------------------
--
-- POR QUE TABELA SEPARADA, E NÃO UMA COLUNA EM `usuario`
--
-- A policy `usuario_proprio_update (id = auth.uid())` autoriza o update da
-- LINHA INTEIRA. Uma coluna `refazer_liberado_em` em `usuario` seria escrita
-- pelo próprio aluno com uma linha no console — exatamente a lição 4.1, que
-- neste projeto já transformou aluno em coordenação. Colunas protegidas de
-- `usuario` dependem do trigger da 0010; acrescentar mais uma ali seria
-- ampliar a superfície de um problema já conhecido.
--
-- Tabela própria com RLS de leitura para o dono e escrita só por função
-- `security definer` não tem esse modo de falha.

create table if not exists liberacao_refazer (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references usuario(id) on delete cascade,
  criado_por   uuid references usuario(id) on delete set null,
  motivo       text,
  criado_em    timestamptz not null default now(),
  consumida_em timestamptz
);

create index if not exists idx_liberacao_pendente
  on liberacao_refazer (usuario_id) where consumida_em is null;

alter table liberacao_refazer enable row level security;

drop policy if exists liberacao_leitura_propria on liberacao_refazer;
create policy liberacao_leitura_propria on liberacao_refazer
  for select to authenticated using (usuario_id = auth.uid());

-- Sem policy de INSERT nem de UPDATE para ninguém: quem cria é
-- `liberar_refazer()`, que é security definer e checa e_admin() por dentro.
-- Sem policy de leitura para admin: a coordenação enxerga pela RPC, e assim
-- nenhuma tela existente muda de comportamento (lição 4.3).

-- ---------------------------------------------------------------------------
-- Pode refazer?
-- ---------------------------------------------------------------------------

create or replace function pode_refazer_questionario()
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_ultima     timestamptz;
  v_dias       int;
  v_liberada   boolean;
  v_concluiu   boolean;
  v_disponivel timestamptz;
begin
  if auth.uid() is null then raise exception 'nao autenticado'; end if;

  select max(r.concluido_em) into v_ultima
  from resposta_questionario r
  join questionario q on q.id = r.questionario_id
  where r.usuario_id = auth.uid() and r.concluido_em is not null and q.ativo;

  -- Nunca respondeu: não é refazer, é fazer.
  if v_ultima is null then
    return jsonb_build_object('pode', true, 'motivo', 'primeira');
  end if;

  select exists (
    select 1 from liberacao_refazer l
    where l.usuario_id = auth.uid() and l.consumida_em is null
  ) into v_liberada;

  if v_liberada then
    return jsonb_build_object('pode', true, 'motivo', 'liberado_pela_coordenacao');
  end if;

  -- Concluiu um curso DEPOIS da última resposta.
  --
  -- `matricula` não tem `atualizado_em`, então a data da conclusão é lida de
  -- onde ela de fato existe: a emissão do certificado, ou o fechamento da turma
  -- para quem foi aprovado sem emissão automática (presencial fechado pelo
  -- professor aprova sem emitir na hora, e o aprendizado aconteceu do mesmo
  -- jeito).
  select exists (
    select 1 from matricula m
    join certificado ce on ce.matricula_id = m.id
    where m.usuario_id = auth.uid()
      and ce.revogado_em is null
      and ce.emitido_em > v_ultima
  ) or exists (
    select 1 from matricula m
    join turma t on t.id = m.turma_id
    where m.usuario_id = auth.uid()
      and m.status in ('aprovado', 'certificado_emitido')
      and t.fechada_em is not null
      and t.fechada_em > v_ultima
  ) into v_concluiu;

  if v_concluiu then
    return jsonb_build_object('pode', true, 'motivo', 'concluiu_curso');
  end if;

  select questionario_refazer_dias into v_dias from configuracao where id;
  v_disponivel := v_ultima + (v_dias || ' days')::interval;

  if now() >= v_disponivel then
    return jsonb_build_object('pode', true, 'motivo', 'intervalo_cumprido');
  end if;

  return jsonb_build_object(
    'pode', false,
    'motivo', 'aguardando',
    'disponivel_em', v_disponivel,
    'respondido_em', v_ultima
  );
end $fn$;

grant execute on function pode_refazer_questionario() to authenticated;

-- ---------------------------------------------------------------------------
-- iniciar_questionario passa a respeitar a trava
-- ---------------------------------------------------------------------------

create or replace function iniciar_questionario()
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_q     uuid;
  v_id    uuid;
  v_pode  jsonb;
begin
  if auth.uid() is null then raise exception 'nao autenticado'; end if;

  select id into v_q from questionario where ativo limit 1;
  if v_q is null then raise exception 'nenhum questionario ativo'; end if;

  -- Retomar vem ANTES de tudo. Quem já começou não pode ser mandado de volta
  -- ao início por uma regra escrita pensando em quem está começando agora
  -- (lição 4.4) — e a trava de refazer é exatamente esse tipo de regra.
  select id into v_id from resposta_questionario
  where usuario_id = auth.uid() and questionario_id = v_q and concluido_em is null;
  if v_id is not null then return v_id; end if;

  v_pode := pode_refazer_questionario();
  if not (v_pode->>'pode')::boolean then
    raise exception 'voce ja respondeu a autoavaliacao; refazer fica disponivel apos concluir um curso';
  end if;

  -- Consome a liberação manual, se foi ela que abriu a porta. Uma liberação
  -- vale uma vez: sem isso a coordenação abriria refazer para sempre sem querer.
  if v_pode->>'motivo' = 'liberado_pela_coordenacao' then
    update liberacao_refazer set consumida_em = now()
    where id = (
      select l.id from liberacao_refazer l
      where l.usuario_id = auth.uid() and l.consumida_em is null
      order by l.criado_em limit 1
    );
  end if;

  insert into resposta_questionario (usuario_id, questionario_id)
  values (auth.uid(), v_q) returning id into v_id;
  return v_id;
end $fn$;

-- ---------------------------------------------------------------------------
-- Coordenação libera
-- ---------------------------------------------------------------------------

create or replace function liberar_refazer(p_usuario uuid, p_motivo text default null)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_id uuid;
begin
  if not e_admin() then raise exception 'apenas a coordenacao'; end if;

  -- Já tem uma pendente: devolve a mesma em vez de empilhar. Duas liberações
  -- pendentes dariam dois refazeres, que não é o que quem clicou duas vezes
  -- quis dizer.
  select id into v_id from liberacao_refazer
  where usuario_id = p_usuario and consumida_em is null limit 1;
  if v_id is not null then return v_id; end if;

  insert into liberacao_refazer (usuario_id, criado_por, motivo)
  values (p_usuario, auth.uid(), nullif(trim(coalesce(p_motivo, '')), ''))
  returning id into v_id;

  insert into log_admin (acao, alvo_tipo, alvo_id, detalhe, autor_id)
  values ('refazer_liberado', 'usuario', p_usuario, nullif(trim(coalesce(p_motivo, '')), ''), auth.uid());

  return v_id;
end $fn$;

grant execute on function liberar_refazer(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Histórico: a linha de base e o retrato de hoje
-- ---------------------------------------------------------------------------
--
-- Devolve uma linha por resposta concluída, com a média geral. É o que permite
-- a tela dizer "em março você se via assim; hoje, assim" — a razão de guardar
-- resposta item a item em vez de sobrescrever.

create or replace function meu_historico_autoavaliacao()
returns table (resposta_id uuid, concluido_em timestamptz, media_geral numeric, itens int)
language sql stable security definer set search_path = public as $fn$
  select r.id, r.concluido_em,
         round(avg(ri.valor)::numeric, 2),
         count(ri.*)::int
  from resposta_questionario r
  join resposta_item ri on ri.resposta_id = r.id
  where r.usuario_id = auth.uid() and r.concluido_em is not null
  group by r.id, r.concluido_em
  order by r.concluido_em asc;
$fn$;

grant execute on function meu_historico_autoavaliacao() to authenticated;

-- ---------------------------------------------------------------------------
-- CORREÇÃO DA 0040: duas funções chamavam `registrar_log()`, que não existe
-- ---------------------------------------------------------------------------
--
-- `clonar_questionario` e `publicar_questionario` foram escritas chamando
-- `registrar_log(acao, alvo, detalhe)`. Essa função nunca existiu neste projeto
-- — a auditoria é feita com `insert into log_admin` direto, como em toda a
-- 0007.
--
-- POR QUE A 0040 APLICOU SEM ERRO
--
-- plpgsql não resolve chamada de função no momento da criação: o corpo é texto
-- até alguém executar. As duas funções foram criadas com sucesso e só
-- quebrariam na primeira vez que a coordenação clonasse ou publicasse uma
-- versão do questionário — que ninguém fez ainda.
--
-- É a lição 4.8 outra vez, e desta vez peguei porque rodei num Postgres de
-- verdade em vez de confiar no build. Nem `next build` nem `tsc` olham para
-- dentro de uma função do banco.

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
  select v_versao, coalesce(p_titulo, q.titulo), q.descricao
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

  insert into log_admin (acao, alvo_tipo, alvo_id, detalhe, autor_id)
  values ('questionario_clonado', 'questionario', v_novo, 'versao ' || v_versao, auth.uid());

  return v_novo;
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

  insert into log_admin (acao, alvo_tipo, alvo_id, detalhe, autor_id)
  values ('questionario_publicado', 'questionario', p_questionario, null, auth.uid());
end $fn$;

insert into migration_aplicada (nome) values ('0041_refazer_autoavaliacao.sql')
on conflict (nome) do nothing;
