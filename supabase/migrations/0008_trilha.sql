-- 0008_trilha.sql — a trilha responde ao aluno:
-- devolutiva por questão no quiz e tempo estimado por módulo

-- Estimativa de tempo de um bloco, em segundos
create or replace function tempo_estimado_bloco(p_tipo tipo_bloco, p_config jsonb)
returns int language sql immutable set search_path = public as $fn$
  select case p_tipo
    when 'video'      then coalesce((p_config->>'duracaoSegundos')::int, 300)
    -- ~400 palavras/min, ~5 caracteres por palavra
    when 'texto'      then greatest(30, (char_length(coalesce(p_config->>'markdown','')) / 33)::int)
    when 'quiz'       then coalesce(jsonb_array_length(p_config->'questoes'), 1) * 45
    when 'checkpoint' then 20
    when 'material'   then 120
    when 'envio'      then 600
    else 60
  end;
$fn$;

-- modulos_trilha agora informa o tempo estimado de cada módulo
create or replace function modulos_trilha(p_matricula uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_curso uuid;
  v_out   jsonb;
begin
  if not e_dono_matricula(p_matricula) then
    raise exception 'nao autorizado';
  end if;

  select c.id into v_curso
  from matricula m
  join turma t on t.id = m.turma_id
  join curso c on c.id = t.curso_id
  where m.id = p_matricula;

  with base as (
    select mo.id, mo.ordem, mo.titulo, mo.descricao,
      count(b.id) filter (where b.obrigatorio)::int as total_obrigatorios,
      count(pb.id) filter (where b.obrigatorio and pb.estado = 'concluido')::int as concluidos,
      coalesce(sum(tempo_estimado_bloco(b.tipo, b.config)), 0)::int as tempo_segundos
    from modulo mo
    left join bloco b  on b.modulo_id = mo.id
    left join progresso_bloco pb
           on pb.bloco_id = b.id and pb.matricula_id = p_matricula
    where mo.curso_id = v_curso
    group by mo.id, mo.ordem, mo.titulo, mo.descricao
  ),
  marcado as (
    select *, (concluidos >= total_obrigatorios) as ok from base
  )
  select jsonb_agg(
    jsonb_build_object(
      'moduloId', m.id,
      'ordem', m.ordem,
      'titulo', m.titulo,
      'descricao', m.descricao,
      'totalObrigatorios', m.total_obrigatorios,
      'concluidos', m.concluidos,
      'concluido', m.ok,
      'tempoMinutos', greatest(1, round(m.tempo_segundos / 60.0))::int,
      'liberado', not exists (
        select 1 from marcado p where p.ordem < m.ordem and not p.ok
      )
    ) order by m.ordem
  ) into v_out
  from marcado m;

  return coalesce(v_out, '[]'::jsonb);
end $fn$;

-- submeter_quiz devolve o resultado por questão, respeitando mostrarGabarito
create or replace function submeter_quiz(p_matricula uuid, p_bloco uuid, p_respostas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_config    jsonb;
  v_q         jsonb;
  v_resp      jsonb;
  v_ok        boolean;
  v_peso      numeric;
  v_total     numeric := 0;
  v_acertos   numeric := 0;
  v_nota      numeric;
  v_min       numeric;
  v_max       int;
  v_hist      jsonb;
  v_num       int;
  v_corretas  text[];
  v_marcadas  text[];
  v_gabarito  jsonb;
  v_brutos    jsonb := '[]'::jsonb;
  v_detalhes  jsonb := '[]'::jsonb;
  v_mostrar   boolean;
  v_politica  text;
  d           jsonb;
begin
  if not e_dono_matricula(p_matricula) then
    raise exception 'nao autorizado';
  end if;

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

  for v_q in select value from jsonb_array_elements(v_config->'questoes') loop
    v_peso     := coalesce((v_q->>'peso')::numeric, 1);
    v_total    := v_total + v_peso;
    v_resp     := p_respostas -> (v_q->>'id');
    v_ok       := false;
    v_gabarito := null;

    if v_q->>'tipo' = 'verdadeiro_falso' then
      v_ok       := (v_resp is not null and v_resp = (v_q->'resposta'));
      v_gabarito := v_q->'resposta';

    elsif v_q->>'tipo' = 'multipla_escolha' then
      v_ok := exists (
        select 1 from jsonb_array_elements(v_q->'alternativas') as a(value)
        where (a.value->>'correta')::boolean is true
          and a.value->>'id' = (v_resp #>> '{}')
      );
      select to_jsonb(a.value->>'id') into v_gabarito
      from jsonb_array_elements(v_q->'alternativas') as a(value)
      where (a.value->>'correta')::boolean is true
      limit 1;

    elsif v_q->>'tipo' = 'multipla_resposta' then
      select array_agg(a.value->>'id' order by a.value->>'id') into v_corretas
      from jsonb_array_elements(v_q->'alternativas') as a(value)
      where (a.value->>'correta')::boolean is true;

      select array_agg(x order by x) into v_marcadas
      from jsonb_array_elements_text(coalesce(v_resp, '[]'::jsonb)) as t(x);

      v_ok       := coalesce(v_corretas, '{}') = coalesce(v_marcadas, '{}');
      v_gabarito := to_jsonb(coalesce(v_corretas, '{}'));
    end if;

    if v_ok then v_acertos := v_acertos + v_peso; end if;

    v_brutos := v_brutos || jsonb_build_array(jsonb_build_object(
      'id', v_q->>'id',
      'correta', v_ok,
      'gabarito', v_gabarito,
      'feedback', v_q->>'feedback'
    ));
  end loop;

  v_nota := case when v_total = 0 then 0 else round(v_acertos / v_total * 100, 2) end;

  -- Só revela gabarito conforme a política definida pelo professor
  v_mostrar := (v_politica = 'apos_tentativa')
               or (v_politica = 'apos_aprovacao' and v_nota >= v_min);

  for d in select value from jsonb_array_elements(v_brutos) loop
    v_detalhes := v_detalhes || jsonb_build_array(
      case when v_mostrar then d else jsonb_build_object('id', d->>'id', 'correta', d->'correta') end
    );
  end loop;

  v_hist := v_hist || jsonb_build_array(
    jsonb_build_object('numero', v_num, 'nota', v_nota, 'em', now())
  );

  insert into progresso_bloco (matricula_id, bloco_id, estado, nota, dados, atualizado_em)
  values (
    p_matricula, p_bloco,
    case when v_nota >= v_min then 'concluido'::status_progresso else 'em_andamento'::status_progresso end,
    v_nota,
    jsonb_build_object('tentativas', v_hist),
    now()
  )
  on conflict (matricula_id, bloco_id) do update
    set estado = case
          when v_nota >= v_min then 'concluido'::status_progresso
          else progresso_bloco.estado
        end,
        nota  = greatest(coalesce(progresso_bloco.nota, 0), v_nota),
        dados = jsonb_build_object('tentativas', v_hist),
        atualizado_em = now();

  perform atualizar_status_matricula(p_matricula);

  return jsonb_build_object(
    'nota', v_nota,
    'aprovado', v_nota >= v_min,
    'tentativa', v_num,
    'maxTentativas', v_max,
    'mostrouGabarito', v_mostrar,
    'detalhes', v_detalhes
  );
end $fn$;

grant execute on function tempo_estimado_bloco(tipo_bloco, jsonb) to authenticated;
