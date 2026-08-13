-- 0012_quiz.sql
--
-- Duas mudanças em submeter_quiz. Vão juntas de propósito: é a função mais
-- longa e mais crítica do sistema, e reescrever duas vezes é dobrar o risco.
--
--   A) DEVOLUTIVA. Hoje o aluno que reprova vê quais questões errou, sem o
--      gabarito. Em multipla_escolha isso é feedback formativo legítimo. Em
--      verdadeiro_falso, saber que errou É o gabarito — com 3 tentativas, o
--      aluno gabarita na segunda sem saber nada do conteúdo. Não é problema
--      dos cursos atuais: é propriedade do formato, aparece toda vez que
--      alguém usar V/F.
--
--      Correção: mudar QUANDO a devolutiva aparece, não O QUE aparece.
--      Enquanto sobrar tentativa, só a nota. Ao aprovar ou ao esgotar as
--      tentativas, devolutiva completa. O aluno continua vendo o que errou —
--      só que depois que isso não pode mais ser explorado. Feedback que chega
--      quando não há mais tentativa é puramente educativo, que era a intenção.
--
--      De quebra, as três opções de mostrarGabarito passam a significar três
--      coisas diferentes. Antes, quem reprovava via exatamente o mesmo em
--      'nunca' e em 'apos_aprovacao' — ou seja, 'nunca' não significava nunca.
--      Quando o nome de uma configuração não bate com o que ela faz, a regra
--      foi pensada pela metade.
--
--   B) CORRIDA NA CONTAGEM. A função lê o histórico de tentativas, conta, e só
--      depois grava. Duas submissões simultâneas leem o mesmo número e as duas
--      passam pelo teste de limite — dá para furar maxTentativas disparando
--      requisições em paralelo. O advisory lock serializa por (matrícula,
--      bloco): a segunda espera a primeira terminar. É lock de transação,
--      então solta sozinho no fim da chamada, sem risco de travar nada.

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
