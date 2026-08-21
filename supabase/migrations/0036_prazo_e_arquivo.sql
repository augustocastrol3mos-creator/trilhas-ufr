-- 0036_prazo_e_arquivo.sql
--
-- Duas travas que faltavam, e que compartilham o mesmo ponto de aplicação.
--
-- ===========================================================================
-- 1. PRAZO DE CONCLUSÃO
-- ===========================================================================
--
-- Curso contínuo sem prazo acumula matrícula zumbi para sempre. E há um
-- problema maior, de integridade do documento: alguém se inscreve em 2026,
-- conclui em 2029, e o certificado sai dizendo que o curso foi realizado no
-- período de 2026. O campo "período" deixa de significar alguma coisa.
--
-- O prazo é do CURSO (é uma decisão de desenho pedagógico, não da oferta) e
-- conta a partir da matrícula de cada aluno — não de uma data fixa, porque em
-- turma contínua cada um entra num dia.
--
-- O QUE ACONTECE AO EXPIRAR: o aluno não consegue mais avançar na trilha nem
-- receber certificado. Para voltar, precisa se inscrever de novo, e aí o
-- relógio recomeça.
--
-- O PROGRESSO É PRESERVADO ao reinscrever, e essa é uma escolha discutível.
-- Apagar puniria sem beneficiar ninguém: o aluno que fez 80% e perdeu o prazo
-- por uma semana não aprende mais nada refazendo tudo, e a instituição não
-- ganha nada com isso. O prazo existe para evitar matrícula eterna e para o
-- período do certificado fazer sentido — não para castigar. Se a coordenação
-- preferir zerar, é trocar uma linha na função inscrever.
--
-- ===========================================================================
-- 2. CURSO ARQUIVADO
-- ===========================================================================
--
-- Hoje, arquivar tira o curso do catálogo e encerra as inscrições, mas quem já
-- está matriculado conclui normalmente e recebe certificado de um curso
-- arquivado.
--
-- Bloquear sempre seria errado: há dois motivos distintos para arquivar.
-- "O conteúdo está desatualizado" pede que ninguém mais se certifique.
-- "Não vamos mais ofertar" pede que quem está com 90% feito termine — punir
-- trinta alunos por uma decisão administrativa que não é sobre eles seria
-- injusto e desnecessário.
--
-- Então a coordenação ESCOLHE ao arquivar, e o padrão é o seguro para o aluno:
-- deixar concluir.

alter table curso add column if not exists prazo_conclusao_dias int;
alter table curso add column if not exists arquivo_bloqueia_conclusao boolean not null default false;

alter table curso drop constraint if exists prazo_positivo;
alter table curso add constraint prazo_positivo
  check (prazo_conclusao_dias is null or prazo_conclusao_dias between 1 and 3650);

alter table matricula add column if not exists expira_em timestamptz;
alter table matricula add column if not exists reiniciada_em timestamptz;

create index if not exists idx_matricula_expira on matricula (expira_em)
  where expira_em is not null;

comment on column curso.prazo_conclusao_dias is
  'Dias que o aluno tem, a partir da própria matrícula, para concluir. Nulo = sem prazo.';

-- ---------------------------------------------------------------------------
-- O predicado, num lugar só
-- ---------------------------------------------------------------------------

-- Todas as ações da trilha passam por aqui. Concentrar a regra numa função
-- evita o problema de acrescentar uma trava em três lugares e esquecer o
-- quarto — que é exatamente como o buraco do arquivamento nasceu.
create or replace function verificar_matricula_ativa(p_matricula uuid)
returns void language plpgsql stable security definer set search_path = public as $fn$
declare v_expira timestamptz; v_status text; v_bloqueia boolean; v_titulo text;
begin
  select m.expira_em, cu.status, cu.arquivo_bloqueia_conclusao, cu.titulo
    into v_expira, v_status, v_bloqueia, v_titulo
  from matricula m
  join turma t  on t.id = m.turma_id
  join curso cu on cu.id = t.curso_id
  where m.id = p_matricula;

  if v_status is null then raise exception 'matricula inexistente'; end if;

  if v_status = 'arquivado' and v_bloqueia then
    raise exception 'o curso "%" foi encerrado pela coordenacao e nao aceita mais conclusoes', v_titulo;
  end if;

  if v_expira is not null and now() > v_expira then
    raise exception 'o prazo para concluir este curso terminou em %; inscreva-se novamente para retomar',
      to_char(v_expira, 'DD/MM/YYYY');
  end if;
end $fn$;

grant execute on function verificar_matricula_ativa(uuid) to authenticated;

-- Versão sem exceção, para as telas mostrarem o estado sem tomar erro.
create or replace function situacao_matricula(p_matricula uuid)
returns jsonb language sql stable security definer set search_path = public as $fn$
  select jsonb_build_object(
    'expiraEm', m.expira_em,
    'expirada', m.expira_em is not null and now() > m.expira_em,
    'diasRestantes', case
      when m.expira_em is null then null
      else greatest(0, extract(day from m.expira_em - now())::int)
    end,
    'cursoArquivado', cu.status = 'arquivado',
    'bloqueada', cu.status = 'arquivado' and cu.arquivo_bloqueia_conclusao
  )
  from matricula m
  join turma t  on t.id = m.turma_id
  join curso cu on cu.id = t.curso_id
  where m.id = p_matricula and e_dono_matricula(m.id);
$fn$;

grant execute on function situacao_matricula(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Inscrição: carimba o prazo, e reinicia o relógio de quem expirou
-- ---------------------------------------------------------------------------

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
  -- não pode ser expulso por vaga, prazo ou trava de reinscrição.
  select id, expira_em into v_id, v_atual from matricula
  where usuario_id = auth.uid() and turma_id = p_turma;

  if v_id is not null then
    -- Expirou: reinicia o relógio e mantém o progresso. Esta é a "reinscrição"
    -- do ponto de vista do aluno — ele clica no mesmo botão e volta a poder
    -- avançar. Fica registrado em reiniciada_em.
    if v_atual is not null and now() > v_atual then
      update matricula
         set expira_em = v_expira, reiniciada_em = now()
       where id = v_id;
    end if;
    return v_id;
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
-- Arquivar: a coordenação escolhe o efeito sobre quem já está dentro
-- ---------------------------------------------------------------------------

drop function if exists arquivar_curso(uuid, text);

create or replace function arquivar_curso(
  p_curso uuid, p_motivo text, p_bloquear_conclusao boolean default false
)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_status text; v_titulo text; v_abertas int; v_ativos int;
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;

  select status, titulo into v_status, v_titulo from curso where id = p_curso;
  if v_status is null then raise exception 'curso inexistente'; end if;
  if v_status = 'arquivado' then raise exception 'curso ja esta arquivado'; end if;

  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'informe o motivo do arquivamento';
  end if;

  select count(*) into v_ativos
  from matricula m join turma t on t.id = m.turma_id
  where t.curso_id = p_curso
    and m.status in ('inscrito', 'em_andamento', 'trilha_concluida');

  update curso set
    status = 'arquivado',
    arquivo_bloqueia_conclusao = coalesce(p_bloquear_conclusao, false)
  where id = p_curso;

  update turma set status = 'em_andamento'
   where curso_id = p_curso and status = 'inscricoes_abertas';
  get diagnostics v_abertas = row_count;

  insert into log_admin (acao, alvo_tipo, alvo_id, detalhe, justificativa, autor_id)
  values ('arquivamento', 'curso', p_curso,
          v_titulo || ' — ' || v_abertas || ' turma(s) com inscricao encerrada; '
            || v_ativos || ' aluno(s) em andamento; '
            || case when p_bloquear_conclusao
                 then 'CONCLUSAO BLOQUEADA' else 'conclusao permitida' end,
          p_motivo, auth.uid());
end $fn$;

create or replace function desarquivar_curso(p_curso uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_status text;
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;

  select status into v_status from curso where id = p_curso;
  if v_status is distinct from 'arquivado' then
    raise exception 'curso nao esta arquivado';
  end if;

  update curso set status = 'rascunho', arquivo_bloqueia_conclusao = false
  where id = p_curso;

  insert into log_admin (acao, alvo_tipo, alvo_id, detalhe, autor_id)
  values ('desarquivamento', 'curso', p_curso, 'voltou para rascunho', auth.uid());
end $fn$;

grant execute on function
  arquivar_curso(uuid, text, boolean), desarquivar_curso(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------

-- Matrículas que já existem ficam SEM prazo. Aplicar um prazo retroativo
-- expiraria na hora quem se inscreveu há meses — o aluno abriria a trilha e
-- encontraria a porta fechada por uma regra que não existia quando ele entrou.
-- O prazo passa a valer para quem se inscrever daqui em diante.
--
-- (Seção 9 do ESTADO_DO_PROJETO: migration que muda comportamento automático
-- precisa de backfill. Aqui o backfill correto é justamente não fazer nada,
-- e isso precisa estar escrito para ninguém "corrigir" depois.)


-- ---------------------------------------------------------------------------
-- As três ações da trilha passam a checar
-- ---------------------------------------------------------------------------

-- Reescritas a partir do corpo real de cada uma, acrescentando UMA linha logo
-- após a checagem de dono. Bloquear só na emissão do certificado seria pior:
-- o aluno faria o curso inteiro para ser recusado no fim.

create or replace function concluir_bloco(p_matricula uuid, p_bloco uuid, p_dados jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_tipo tipo_bloco;
begin
  if not e_dono_matricula(p_matricula) then
    raise exception 'nao autorizado';
  end if;

  perform verificar_matricula_ativa(p_matricula);

  select tipo into v_tipo from bloco where id = p_bloco;
  if v_tipo is null then raise exception 'bloco inexistente'; end if;
  if v_tipo = 'quiz'  then raise exception 'use submeter_quiz'; end if;
  if v_tipo = 'envio' then raise exception 'envio depende de correcao do professor'; end if;

  insert into progresso_bloco (matricula_id, bloco_id, estado, dados, atualizado_em)
  values (p_matricula, p_bloco, 'concluido', p_dados, now())
  on conflict (matricula_id, bloco_id) do update
    set estado = 'concluido',
        dados = progresso_bloco.dados || excluded.dados,
        atualizado_em = now();

  perform atualizar_status_matricula(p_matricula);
  return jsonb_build_object('ok', true);
end $fn$;

create or replace function registrar_progresso_video(
  p_matricula uuid,
  p_bloco uuid,
  p_percentual numeric
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_min       numeric;
  v_duracao   numeric;
  v_maior     numeric;
  v_inicio    timestamptz;
  v_decorrido numeric;
  v_teto      numeric;
  v_pedido    numeric;
begin
  if not e_dono_matricula(p_matricula) then
    raise exception 'nao autorizado';
  end if;

  perform verificar_matricula_ativa(p_matricula);

  select coalesce((config->>'percentualMinimo')::numeric, 80),
         nullif((config->>'duracaoSegundos')::numeric, 0)
    into v_min, v_duracao
  from bloco
  where id = p_bloco and tipo = 'video';

  if v_min is null then
    raise exception 'bloco de video inexistente';
  end if;

  -- percentual é percentual: 0..100, venha o que vier do cliente
  v_pedido := least(greatest(coalesce(p_percentual, 0), 0), 100);

  -- garante a linha e carimba o relógio na primeira vez (só na primeira)
  insert into progresso_bloco (matricula_id, bloco_id, estado, dados, atualizado_em)
  values (
    p_matricula, p_bloco, 'em_andamento',
    jsonb_build_object('percentualAssistido', 0, 'iniciadoEm', now()),
    now()
  )
  on conflict (matricula_id, bloco_id) do update
    set dados = case
          when progresso_bloco.dados ? 'iniciadoEm' then progresso_bloco.dados
          else progresso_bloco.dados || jsonb_build_object('iniciadoEm', now())
        end;

  select (dados->>'iniciadoEm')::timestamptz,
         coalesce((dados->>'percentualAssistido')::numeric, 0)
    into v_inicio, v_maior
  from progresso_bloco
  where matricula_id = p_matricula and bloco_id = p_bloco;

  if v_duracao is null then
    v_teto := 100;
  else
    v_decorrido := extract(epoch from (now() - v_inicio));
    v_teto := least(100, (v_decorrido * 2 / v_duracao) * 100 + 5);
  end if;

  -- nunca regride, nunca ultrapassa o teto do relógio
  v_maior := greatest(v_maior, least(v_pedido, v_teto));

  update progresso_bloco
     set dados = dados || jsonb_build_object('percentualAssistido', round(v_maior, 2)),
         estado = case
           when estado = 'concluido' then 'concluido'
           else 'em_andamento'::status_progresso
         end,
         atualizado_em = now()
   where matricula_id = p_matricula and bloco_id = p_bloco;

  if v_maior >= v_min then
    update progresso_bloco
       set estado = 'concluido', atualizado_em = now()
     where matricula_id = p_matricula
       and bloco_id = p_bloco
       and estado <> 'concluido';
    perform atualizar_status_matricula(p_matricula);
  end if;

  return jsonb_build_object(
    'percentual', round(v_maior, 2),
    'concluido', v_maior >= v_min
  );
end;
$$;

create or replace function submeter_quiz(
  p_matricula uuid,
  p_bloco uuid,
  p_respostas jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_config   jsonb; v_q jsonb; v_resp jsonb; v_ok boolean;
  v_peso numeric; v_total numeric := 0; v_acertos numeric := 0;
  v_nota numeric; v_min numeric; v_max int;
  v_hist jsonb; v_num int;
  v_corretas text[]; v_marcadas text[]; v_gabarito jsonb;
  v_brutos jsonb := '[]'::jsonb; v_detalhes jsonb := '[]'::jsonb;
  v_itens jsonb := '[]'::jsonb;
  v_mostrar boolean; v_ultima boolean; v_politica text; d jsonb;
begin
  if not e_dono_matricula(p_matricula) then raise exception 'nao autorizado'; end if;
  perform verificar_matricula_ativa(p_matricula);

  -- (B) serializa submissões concorrentes do mesmo aluno no mesmo bloco
  perform pg_advisory_xact_lock(hashtext(p_matricula::text), hashtext(p_bloco::text));

  select config into v_config from bloco where id = p_bloco and tipo = 'quiz';
  if v_config is null then raise exception 'quiz inexistente'; end if;

  v_min      := coalesce((v_config->>'notaMinima')::numeric, 70);
  v_max      := coalesce((v_config->>'maxTentativas')::int, 3);
  v_politica := coalesce(v_config->>'mostrarGabarito', 'apos_aprovacao');

  select coalesce(dados->'tentativas', '[]'::jsonb) into v_hist
  from progresso_bloco where matricula_id = p_matricula and bloco_id = p_bloco;
  v_hist := coalesce(v_hist, '[]'::jsonb);

  v_num := jsonb_array_length(v_hist) + 1;
  if v_num > v_max then raise exception 'limite de tentativas atingido'; end if;
  v_ultima := v_num >= v_max;

  for v_q in select value from jsonb_array_elements(v_config->'questoes') loop
    v_peso := coalesce((v_q->>'peso')::numeric, 1);
    v_total := v_total + v_peso;
    v_resp := p_respostas -> (v_q->>'id');
    v_ok := false;
    v_gabarito := null;

    if v_q->>'tipo' = 'verdadeiro_falso' then
      v_ok := (v_resp is not null and v_resp = (v_q->'resposta'));
      v_gabarito := v_q->'resposta';

    elsif v_q->>'tipo' = 'multipla_escolha' then
      v_ok := exists (
        select 1 from jsonb_array_elements(v_q->'alternativas') as a(value)
        where (a.value->>'correta')::boolean is true
          and a.value->>'id' = (v_resp #>> '{}')
      );
      select to_jsonb(a.value->>'id') into v_gabarito
      from jsonb_array_elements(v_q->'alternativas') as a(value)
      where (a.value->>'correta')::boolean is true limit 1;

    elsif v_q->>'tipo' = 'multipla_resposta' then
      select array_agg(a.value->>'id' order by a.value->>'id') into v_corretas
      from jsonb_array_elements(v_q->'alternativas') as a(value)
      where (a.value->>'correta')::boolean is true;

      select array_agg(x order by x) into v_marcadas
      from jsonb_array_elements_text(coalesce(v_resp, '[]'::jsonb)) as t(x);

      v_ok := coalesce(v_corretas, '{}') = coalesce(v_marcadas, '{}');
      v_gabarito := to_jsonb(coalesce(v_corretas, '{}'));
    end if;

    if v_ok then v_acertos := v_acertos + v_peso; end if;

    v_brutos := v_brutos || jsonb_build_array(jsonb_build_object(
      'id', v_q->>'id', 'correta', v_ok, 'gabarito', v_gabarito, 'feedback', v_q->>'feedback'
    ));

    -- persistido: base da análise de questão. Guarda SEMPRE, independente do
    -- que o aluno vê — o professor precisa do dado completo.
    v_itens := v_itens || jsonb_build_array(jsonb_build_object(
      'id', v_q->>'id', 'correta', v_ok, 'resposta', v_resp
    ));
  end loop;

  v_nota := case when v_total = 0 then 0 else round(v_acertos / v_total * 100, 2) end;

  -- (A) devolutiva liberada quando não há mais o que explorar:
  --   apos_tentativa  -> sempre (o professor escolheu modo treino)
  --   apos_aprovacao  -> ao aprovar OU ao esgotar as tentativas
  --   nunca           -> nunca
  v_mostrar := (v_politica = 'apos_tentativa')
               or (v_politica = 'apos_aprovacao' and (v_nota >= v_min or v_ultima));

  -- Quando não mostra, não vai NADA por questão: nem o gabarito, nem o
  -- acerto/erro. Era o 'correta' que vazava a V/F.
  for d in select value from jsonb_array_elements(v_brutos) loop
    v_detalhes := v_detalhes || jsonb_build_array(
      case when v_mostrar then d else jsonb_build_object('id', d->>'id') end
    );
  end loop;

  v_hist := v_hist || jsonb_build_array(jsonb_build_object(
    'numero', v_num, 'nota', v_nota, 'em', now(), 'itens', v_itens
  ));

  insert into progresso_bloco (matricula_id, bloco_id, estado, nota, dados, atualizado_em)
  values (
    p_matricula, p_bloco,
    case when v_nota >= v_min then 'concluido'::status_progresso else 'em_andamento'::status_progresso end,
    v_nota, jsonb_build_object('tentativas', v_hist), now()
  )
  on conflict (matricula_id, bloco_id) do update
    set estado = case when v_nota >= v_min then 'concluido'::status_progresso else progresso_bloco.estado end,
        nota = greatest(coalesce(progresso_bloco.nota, 0), v_nota),
        dados = jsonb_build_object('tentativas', v_hist),
        atualizado_em = now();

  perform atualizar_status_matricula(p_matricula);

  return jsonb_build_object(
    'nota', v_nota, 'aprovado', v_nota >= v_min, 'tentativa', v_num,
    'maxTentativas', v_max, 'mostrouGabarito', v_mostrar, 'detalhes', v_detalhes
  );
end;
$$;

create or replace function emitir_certificado(p_matricula uuid)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_cfg      configuracao%rowtype;
  v_status   status_matricula;
  v_nome     text;
  v_rga      text;
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
    assinante_nome, assinante_cargo
  ) values (
    p_matricula, gerar_codigo_certificado(), v_nome, v_rga, v_curso.titulo,
    v_curso.carga_horaria, v_curso.modalidade,
    v_inicio, v_fim, coalesce(v_nota, calcular_nota_online(p_matricula)), v_conteudo,
    v_cfg.assinante_nome, v_cfg.assinante_cargo
  )
  returning id into v_id;

  update matricula set status = 'certificado_emitido' where id = p_matricula;
  return v_id;
end $fn$;

insert into migration_aplicada (nome) values ('0036_prazo_e_arquivo.sql')
on conflict (nome) do nothing;
