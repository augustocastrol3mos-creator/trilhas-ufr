-- 0002_functions.sql — RPCs. Toda a lógica sensível vive aqui, não no cliente.

create or replace function e_dono_matricula(p_matricula uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from matricula where id = p_matricula and usuario_id = auth.uid()
  );
$fn$;

-- Remove o gabarito do config antes de qualquer coisa chegar ao navegador.
create or replace function sanitizar_config(p_tipo tipo_bloco, p_config jsonb)
returns jsonb language sql immutable set search_path = public as $fn$
  select case
    when p_tipo <> 'quiz' then p_config
    else jsonb_set(
      p_config,
      '{questoes}',
      coalesce((
        select jsonb_agg(
          case
            when q.value->>'tipo' = 'verdadeiro_falso'
              then q.value - 'resposta' - 'feedback'
            else jsonb_set(
              q.value - 'feedback',
              '{alternativas}',
              coalesce((
                select jsonb_agg(a.value - 'correta')
                from jsonb_array_elements(q.value->'alternativas') as a(value)
              ), '[]'::jsonb)
            )
          end
          order by q.ordinality
        )
        from jsonb_array_elements(p_config->'questoes') with ordinality as q(value, ordinality)
      ), '[]'::jsonb)
    )
  end;
$fn$;

-- Estado da trilha inteira: quais módulos estão liberados e quais estão concluídos.
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
      count(pb.id) filter (where b.obrigatorio and pb.estado = 'concluido')::int as concluidos
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
      'liberado', not exists (
        select 1 from marcado p where p.ordem < m.ordem and not p.ok
      )
    ) order by m.ordem
  ) into v_out
  from marcado m;

  return coalesce(v_out, '[]'::jsonb);
end $fn$;

-- Conteúdo de um módulo, já sanitizado e com o progresso do aluno embutido.
create or replace function modulo_conteudo(p_matricula uuid, p_modulo uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_liberado boolean;
  v_out      jsonb;
begin
  if not e_dono_matricula(p_matricula) then
    raise exception 'nao autorizado';
  end if;

  select (m->>'liberado')::boolean into v_liberado
  from jsonb_array_elements(modulos_trilha(p_matricula)) as t(m)
  where (m->>'moduloId')::uuid = p_modulo;

  if v_liberado is not true then
    raise exception 'modulo bloqueado';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'blocoId', b.id,
      'ordem', b.ordem,
      'tipo', b.tipo,
      'titulo', b.titulo,
      'config', sanitizar_config(b.tipo, b.config),
      'obrigatorio', b.obrigatorio,
      'estado', coalesce(pb.estado, 'pendente'::status_progresso),
      'dados', coalesce(pb.dados, '{}'::jsonb),
      'nota', pb.nota
    ) order by b.ordem
  ) into v_out
  from bloco b
  left join progresso_bloco pb
         on pb.bloco_id = b.id and pb.matricula_id = p_matricula
  where b.modulo_id = p_modulo;

  return coalesce(v_out, '[]'::jsonb);
end $fn$;

create or replace function atualizar_status_matricula(p_matricula uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  v_curso curso%rowtype;
  v_falta int;
begin
  select c.* into v_curso
  from matricula m
  join turma t on t.id = m.turma_id
  join curso c on c.id = t.curso_id
  where m.id = p_matricula;

  select count(*) into v_falta
  from modulo mo
  join bloco b on b.modulo_id = mo.id
  left join progresso_bloco pb
         on pb.bloco_id = b.id and pb.matricula_id = p_matricula
  where mo.curso_id = v_curso.id
    and b.obrigatorio
    and coalesce(pb.estado, 'pendente'::status_progresso) <> 'concluido';

  if v_falta = 0 then
    if v_curso.modalidade = 'online' and v_curso.emissao = 'automatica' then
      update matricula set status = 'aprovado'
      where id = p_matricula and status <> 'certificado_emitido';
    else
      update matricula set status = 'trilha_concluida'
      where id = p_matricula and status in ('inscrito','em_andamento');
    end if;
  else
    update matricula set status = 'em_andamento'
    where id = p_matricula and status = 'inscrito';
  end if;
end $fn$;

-- Conclusão de blocos autocorrigíveis sem nota (texto, checkpoint, video, material).
create or replace function concluir_bloco(p_matricula uuid, p_bloco uuid, p_dados jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_tipo tipo_bloco;
begin
  if not e_dono_matricula(p_matricula) then
    raise exception 'nao autorizado';
  end if;

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

-- Progresso parcial de vídeo, sem concluir o bloco.
create or replace function registrar_progresso_video(p_matricula uuid, p_bloco uuid, p_percentual numeric)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_min   numeric;
  v_maior numeric;
begin
  if not e_dono_matricula(p_matricula) then
    raise exception 'nao autorizado';
  end if;

  select coalesce((config->>'percentualMinimo')::numeric, 80) into v_min
  from bloco where id = p_bloco and tipo = 'video';
  if v_min is null then raise exception 'bloco de video inexistente'; end if;

  insert into progresso_bloco (matricula_id, bloco_id, estado, dados, atualizado_em)
  values (p_matricula, p_bloco, 'em_andamento',
          jsonb_build_object('percentualAssistido', round(p_percentual, 2)), now())
  on conflict (matricula_id, bloco_id) do update
    set dados = progresso_bloco.dados || jsonb_build_object(
          'percentualAssistido',
          greatest(coalesce((progresso_bloco.dados->>'percentualAssistido')::numeric, 0),
                   round(p_percentual, 2))
        ),
        estado = case
          when progresso_bloco.estado = 'concluido' then 'concluido'
          else 'em_andamento'::status_progresso
        end,
        atualizado_em = now();

  select (dados->>'percentualAssistido')::numeric into v_maior
  from progresso_bloco where matricula_id = p_matricula and bloco_id = p_bloco;

  if v_maior >= v_min then
    update progresso_bloco set estado = 'concluido', atualizado_em = now()
    where matricula_id = p_matricula and bloco_id = p_bloco and estado <> 'concluido';
    perform atualizar_status_matricula(p_matricula);
  end if;

  return jsonb_build_object('percentual', v_maior, 'concluido', v_maior >= v_min);
end $fn$;

-- Correção de quiz. O gabarito nunca sai do servidor.
create or replace function submeter_quiz(p_matricula uuid, p_bloco uuid, p_respostas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_config   jsonb;
  v_q        jsonb;
  v_resp     jsonb;
  v_ok       boolean;
  v_peso     numeric;
  v_total    numeric := 0;
  v_acertos  numeric := 0;
  v_nota     numeric;
  v_min      numeric;
  v_max      int;
  v_hist     jsonb;
  v_num      int;
  v_corretas text[];
  v_marcadas text[];
begin
  if not e_dono_matricula(p_matricula) then
    raise exception 'nao autorizado';
  end if;

  select config into v_config from bloco where id = p_bloco and tipo = 'quiz';
  if v_config is null then raise exception 'quiz inexistente'; end if;

  v_min := coalesce((v_config->>'notaMinima')::numeric, 70);
  v_max := coalesce((v_config->>'maxTentativas')::int, 3);

  select coalesce(dados->'tentativas', '[]'::jsonb) into v_hist
  from progresso_bloco where matricula_id = p_matricula and bloco_id = p_bloco;
  v_hist := coalesce(v_hist, '[]'::jsonb);

  v_num := jsonb_array_length(v_hist) + 1;
  if v_num > v_max then raise exception 'limite de tentativas atingido'; end if;

  for v_q in select value from jsonb_array_elements(v_config->'questoes') loop
    v_peso  := coalesce((v_q->>'peso')::numeric, 1);
    v_total := v_total + v_peso;
    v_resp  := p_respostas -> (v_q->>'id');
    v_ok    := false;

    if v_q->>'tipo' = 'verdadeiro_falso' then
      v_ok := (v_resp is not null and v_resp = (v_q->'resposta'));

    elsif v_q->>'tipo' = 'multipla_escolha' then
      v_ok := exists (
        select 1 from jsonb_array_elements(v_q->'alternativas') as a(value)
        where (a.value->>'correta')::boolean is true
          and a.value->>'id' = (v_resp #>> '{}')
      );

    elsif v_q->>'tipo' = 'multipla_resposta' then
      select array_agg(a.value->>'id' order by a.value->>'id') into v_corretas
      from jsonb_array_elements(v_q->'alternativas') as a(value)
      where (a.value->>'correta')::boolean is true;

      select array_agg(x order by x) into v_marcadas
      from jsonb_array_elements_text(coalesce(v_resp, '[]'::jsonb)) as t(x);

      v_ok := coalesce(v_corretas, '{}') = coalesce(v_marcadas, '{}');
    end if;

    if v_ok then v_acertos := v_acertos + v_peso; end if;
  end loop;

  v_nota := case when v_total = 0 then 0 else round(v_acertos / v_total * 100, 2) end;
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
    'maxTentativas', v_max
  );
end $fn$;

create or replace function inscrever(p_turma uuid)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'nao autenticado'; end if;

  insert into matricula (usuario_id, turma_id)
  values (auth.uid(), p_turma)
  on conflict (usuario_id, turma_id) do update set status = matricula.status
  returning id into v_id;

  return v_id;
end $fn$;

grant execute on function
  modulos_trilha(uuid), modulo_conteudo(uuid, uuid),
  concluir_bloco(uuid, uuid, jsonb), registrar_progresso_video(uuid, uuid, numeric),
  submeter_quiz(uuid, uuid, jsonb), inscrever(uuid)
to authenticated;
