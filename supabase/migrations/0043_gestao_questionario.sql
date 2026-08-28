-- 0043_gestao_questionario.sql
--
-- O que falta para a coordenação operar o questionário sem um desenvolvedor.
--
-- POR QUE ISTO IMPORTA MAIS QUE PARECE
--
-- A partir de 2027 o Trilhas vira extensão permanente com equipe rotativa, e
-- quem construiu não estará mais aqui. Toda operação que só existe pelo SQL
-- Editor é uma operação que, na prática, ninguém vai fazer — ou vai fazer
-- errado, num editor que executa só o trecho selecionado e mostra apenas o
-- resultado da última instrução (seção 8).
--
-- O `liberar_refazer()` da 0041 é o exemplo: existe, funciona, e até agora só
-- podia ser chamado digitando SQL. Isso não é operável por uma coordenação.

-- ---------------------------------------------------------------------------
-- Reordenar item
-- ---------------------------------------------------------------------------
--
-- POR QUE UMA FUNÇÃO E NÃO DOIS UPDATES
--
-- `unique (questionario_id, ordem)` não é deferrable, e o Postgres checa a
-- restrição linha a linha durante o UPDATE. Trocar 3 por 4 e 4 por 3 num
-- comando só falha no meio do caminho, porque existe um instante em que as duas
-- linhas têm o mesmo valor.
--
-- A saída é passar por um valor que não colide. Ordem negativa serve: nenhum
-- item real tem, e o estado intermediário nunca escapa da transação.
--
-- (A alternativa seria tornar o índice deferrable. Não fiz porque mudaria o
-- comportamento de toda inserção na tabela para resolver um caso de tela.)

create or replace function reordenar_item_questionario(p_item uuid, p_para_cima boolean)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  v_q      uuid;
  v_ordem  int;
  v_vizinho uuid;
  v_ordem_vizinho int;
begin
  if not e_admin() then raise exception 'apenas a coordenacao'; end if;

  select questionario_id, ordem into v_q, v_ordem
  from questionario_item where id = p_item;
  if v_q is null then raise exception 'item inexistente'; end if;

  if exists (select 1 from questionario where id = v_q and ativo) then
    raise exception 'esta versao esta ativa; clone antes de editar';
  end if;

  -- O vizinho é o item adjacente na ordem, não `ordem ± 1`: depois de remover
  -- itens a numeração fica com buracos, e ± 1 apontaria para o vazio.
  if p_para_cima then
    select id, ordem into v_vizinho, v_ordem_vizinho
    from questionario_item
    where questionario_id = v_q and ordem < v_ordem
    order by ordem desc limit 1;
  else
    select id, ordem into v_vizinho, v_ordem_vizinho
    from questionario_item
    where questionario_id = v_q and ordem > v_ordem
    order by ordem asc limit 1;
  end if;

  -- Já está na ponta: não é erro, é nada a fazer.
  if v_vizinho is null then return; end if;

  update questionario_item set ordem = -1 where id = p_item;
  update questionario_item set ordem = v_ordem where id = v_vizinho;
  update questionario_item set ordem = v_ordem_vizinho where id = p_item;
end $fn$;

-- ---------------------------------------------------------------------------
-- Listar versões
-- ---------------------------------------------------------------------------
--
-- `respostas` decide o que a tela pode oferecer: versão que já foi respondida
-- não pode ser apagada, porque as respostas apontam para os itens dela.

create or replace function versoes_questionario()
returns table (
  id uuid, versao int, titulo text, ativo boolean,
  publicado_em timestamptz, criado_em timestamptz,
  itens int, respostas int, competencias_sem_item int
)
language sql stable security definer set search_path = public as $fn$
  select
    q.id, q.versao, q.titulo, q.ativo, q.publicado_em, q.criado_em,
    (select count(*)::int from questionario_item i where i.questionario_id = q.id),
    (select count(*)::int from resposta_questionario r
      where r.questionario_id = q.id and r.concluido_em is not null),
    (select count(*)::int from competencia c
      where c.ativa and not exists (
        select 1 from questionario_item i
        where i.questionario_id = q.id and i.competencia_id = c.id
      ))
  from questionario q
  where e_admin()
  order by q.versao desc;
$fn$;

-- ---------------------------------------------------------------------------
-- Apagar rascunho
-- ---------------------------------------------------------------------------

create or replace function excluir_questionario(p_questionario uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  v_respostas int;
begin
  if not e_admin() then raise exception 'apenas a coordenacao'; end if;

  if exists (select 1 from questionario where id = p_questionario and ativo) then
    raise exception 'esta versao esta ativa; publique outra antes de apagar esta';
  end if;

  select count(*) into v_respostas from resposta_questionario
  where questionario_id = p_questionario;

  -- Mesma lógica do `excluir_curso`, que só aceita curso com zero matrículas:
  -- apagar aqui levaria junto respostas de pessoas, e resultado de aluno não é
  -- rascunho de ninguém.
  if v_respostas > 0 then
    raise exception 'esta versao ja foi respondida por % pessoa(s) e nao pode ser apagada', v_respostas;
  end if;

  delete from questionario where id = p_questionario;

  insert into log_admin (acao, alvo_tipo, alvo_id, detalhe, autor_id)
  values ('questionario_excluido', 'questionario', p_questionario, null, auth.uid());
end $fn$;

-- ---------------------------------------------------------------------------
-- Quem está aguardando refazer
-- ---------------------------------------------------------------------------
--
-- Para a coordenação encontrar a pessoa sem pedir o UUID dela. Devolve quem já
-- concluiu a autoavaliação e ainda não tem liberação pendente.

create or replace function alunos_autoavaliacao()
returns table (
  usuario_id uuid, nome text, email text,
  respondido_em timestamptz, liberacao_pendente boolean
)
language sql stable security definer set search_path = public as $fn$
  select u.id, u.nome_completo, u.email,
         max(r.concluido_em),
         exists (
           select 1 from liberacao_refazer l
           where l.usuario_id = u.id and l.consumida_em is null
         )
  from usuario u
  join resposta_questionario r on r.usuario_id = u.id
  where e_admin() and r.concluido_em is not null
  group by u.id, u.nome_completo, u.email
  order by max(r.concluido_em) desc;
$fn$;

grant execute on function reordenar_item_questionario(uuid, boolean) to authenticated;
grant execute on function versoes_questionario()                     to authenticated;
grant execute on function excluir_questionario(uuid)                 to authenticated;
grant execute on function alunos_autoavaliacao()                     to authenticated;

-- ---------------------------------------------------------------------------
-- Publicar versão nova não pode zerar a plataforma
-- ---------------------------------------------------------------------------
--
-- O DEFEITO QUE ISTO CORRIGE, ENCONTRADO NO TESTE
--
-- `tem_autoavaliacao()` (0040) exigia resposta concluída da versão ATIVA. Ao
-- publicar uma versão 2, todo mundo que já havia respondido a 1 voltava a
-- contar como "nunca respondeu":
--
--   · o convite reaparecia para a plataforma inteira
--   · com a trava ligada, TODOS ficavam impedidos de se inscrever até refazer
--     53 frases
--
-- E a coordenação dispararia isso sem nenhum aviso, clicando em "Publicar" —
-- exatamente o tipo de estrago que a seção 8 chama de "migration que muda
-- comportamento automático", só que provocado pela interface.
--
-- A correção: responder é responder. Quem já se autoavaliou alguma vez cumpriu
-- o requisito, e uma versão nova do instrumento não apaga isso. O que a versão
-- nova faz é LIBERAR o refazer — vira convite, não bloqueio.
--
-- A comparação entre respostas continua sabendo de qual versão cada uma veio,
-- porque `resposta_questionario.questionario_id` nunca deixou de ser gravado.
-- Era só a leitura que estava estreita demais.

create or replace function tem_autoavaliacao(p_aluno uuid default null)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from resposta_questionario r
    where r.usuario_id = coalesce(p_aluno, auth.uid())
      and r.concluido_em is not null
  );
$fn$;

create or replace function pode_refazer_questionario()
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_ultima      timestamptz;
  v_versao_resp uuid;
  v_ativo       uuid;
  v_dias        int;
  v_liberada    boolean;
  v_concluiu    boolean;
  v_disponivel  timestamptz;
begin
  if auth.uid() is null then raise exception 'nao autenticado'; end if;

  select r.concluido_em, r.questionario_id into v_ultima, v_versao_resp
  from resposta_questionario r
  where r.usuario_id = auth.uid() and r.concluido_em is not null
  order by r.concluido_em desc limit 1;

  if v_ultima is null then
    return jsonb_build_object('pode', true, 'motivo', 'primeira');
  end if;

  select id into v_ativo from questionario where ativo limit 1;

  -- Instrumento novo: o retrato anterior foi tirado com outra régua, e refazer
  -- passa a fazer sentido. Convite, não exigência — quem não refizer continua
  -- valendo, porque `tem_autoavaliacao()` não olha versão.
  if v_ativo is not null and v_versao_resp is distinct from v_ativo then
    return jsonb_build_object('pode', true, 'motivo', 'nova_versao');
  end if;

  select exists (
    select 1 from liberacao_refazer l
    where l.usuario_id = auth.uid() and l.consumida_em is null
  ) into v_liberada;

  if v_liberada then
    return jsonb_build_object('pode', true, 'motivo', 'liberado_pela_coordenacao');
  end if;

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
    'pode', false, 'motivo', 'aguardando',
    'disponivel_em', v_disponivel, 'respondido_em', v_ultima
  );
end $fn$;

insert into migration_aplicada (nome) values ('0043_gestao_questionario.sql')
on conflict (nome) do nothing;
