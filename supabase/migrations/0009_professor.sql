-- 0009_professor.sql — revisão antes de publicar, bloco de material,
-- progresso individual do aluno e análise de questão

-- ---------------------------------------------------------------
-- 1. Guardar o resultado por questão, não só a nota da tentativa
-- ---------------------------------------------------------------
-- Sem isso é impossível saber qual questão a turma errou.
-- Tentativas anteriores a esta migration não terão o detalhamento.

create or replace function submeter_quiz(p_matricula uuid, p_bloco uuid, p_respostas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_config   jsonb; v_q jsonb; v_resp jsonb; v_ok boolean;
  v_peso numeric; v_total numeric := 0; v_acertos numeric := 0;
  v_nota numeric; v_min numeric; v_max int;
  v_hist jsonb; v_num int;
  v_corretas text[]; v_marcadas text[]; v_gabarito jsonb;
  v_brutos jsonb := '[]'::jsonb; v_detalhes jsonb := '[]'::jsonb;
  v_itens jsonb := '[]'::jsonb;
  v_mostrar boolean; v_politica text; d jsonb;
begin
  if not e_dono_matricula(p_matricula) then raise exception 'nao autorizado'; end if;

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

    -- persistido: base da análise de questão
    v_itens := v_itens || jsonb_build_array(jsonb_build_object(
      'id', v_q->>'id', 'correta', v_ok, 'resposta', v_resp
    ));
  end loop;

  v_nota := case when v_total = 0 then 0 else round(v_acertos / v_total * 100, 2) end;
  v_mostrar := (v_politica = 'apos_tentativa')
               or (v_politica = 'apos_aprovacao' and v_nota >= v_min);

  for d in select value from jsonb_array_elements(v_brutos) loop
    v_detalhes := v_detalhes || jsonb_build_array(
      case when v_mostrar then d else jsonb_build_object('id', d->>'id', 'correta', d->'correta') end
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
end $fn$;

-- ---------------------------------------------------------------
-- 2. Revisão do curso: o que está errado, bloco a bloco
-- ---------------------------------------------------------------
create or replace function revisar_curso(p_curso uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_curso curso%rowtype;
  v_itens jsonb := '[]'::jsonb;
  r record;
  q jsonb;
  v_corretas int;
begin
  if not e_autor_do_curso(p_curso) then raise exception 'nao autorizado'; end if;
  select * into v_curso from curso where id = p_curso;
  if v_curso.id is null then raise exception 'curso inexistente'; end if;

  if not exists (select 1 from modulo where curso_id = p_curso) then
    v_itens := v_itens || jsonb_build_array(jsonb_build_object(
      'nivel', 'erro', 'onde', 'Curso', 'mensagem', 'O curso precisa de ao menos um módulo.'
    ));
  end if;

  if not exists (
    select 1 from modulo mo join bloco b on b.modulo_id = mo.id
    where mo.curso_id = p_curso and b.obrigatorio
  ) then
    v_itens := v_itens || jsonb_build_array(jsonb_build_object(
      'nivel', 'erro', 'onde', 'Curso',
      'mensagem', 'Nenhum bloco obrigatório: a trilha não teria trava nem conclusão.'
    ));
  end if;

  if v_curso.emissao = 'automatica' and not exists (
    select 1 from modulo mo join bloco b on b.modulo_id = mo.id
    where mo.curso_id = p_curso and b.pontuavel
  ) then
    v_itens := v_itens || jsonb_build_array(jsonb_build_object(
      'nivel', 'erro', 'onde', 'Curso',
      'mensagem', 'Emissão automática exige ao menos um quiz que valha nota.'
    ));
  end if;

  -- módulos vazios
  for r in
    select mo.ordem, mo.titulo from modulo mo
    where mo.curso_id = p_curso
      and not exists (select 1 from bloco b where b.modulo_id = mo.id)
  loop
    v_itens := v_itens || jsonb_build_array(jsonb_build_object(
      'nivel', 'aviso', 'onde', 'Módulo ' || r.ordem || ': ' || r.titulo,
      'mensagem', 'Módulo sem nenhum bloco. O aluno abre e não encontra conteúdo.'
    ));
  end loop;

  -- problemas por bloco
  for r in
    select b.id, b.tipo, b.titulo, b.config, b.obrigatorio, mo.ordem as mordem, mo.titulo as mtitulo
    from modulo mo join bloco b on b.modulo_id = mo.id
    where mo.curso_id = p_curso
    order by mo.ordem, b.ordem
  loop
    if r.tipo = 'video' then
      if coalesce(r.config->>'videoId', '') !~ '^[\w-]{11}$' then
        v_itens := v_itens || jsonb_build_array(jsonb_build_object(
          'nivel', 'erro', 'onde', 'Módulo ' || r.mordem || ' · ' || r.titulo,
          'blocoId', r.id,
          'mensagem', 'Link do YouTube ausente ou inválido. O aluno verá um player vazio.'
        ));
      end if;
      if coalesce((r.config->>'duracaoSegundos')::int, 0) <= 0 then
        v_itens := v_itens || jsonb_build_array(jsonb_build_object(
          'nivel', 'erro', 'onde', 'Módulo ' || r.mordem || ' · ' || r.titulo,
          'blocoId', r.id,
          'mensagem', 'Duração não informada: o progresso do vídeo não pode ser calculado.'
        ));
      end if;

    elsif r.tipo = 'texto' then
      if char_length(coalesce(r.config->>'markdown', '')) < 40 then
        v_itens := v_itens || jsonb_build_array(jsonb_build_object(
          'nivel', 'aviso', 'onde', 'Módulo ' || r.mordem || ' · ' || r.titulo,
          'blocoId', r.id, 'mensagem', 'Texto muito curto ou ainda no conteúdo de exemplo.'
        ));
      end if;

    elsif r.tipo = 'checkpoint' then
      if coalesce(trim(r.config->>'texto'), '') = '' then
        v_itens := v_itens || jsonb_build_array(jsonb_build_object(
          'nivel', 'erro', 'onde', 'Módulo ' || r.mordem || ' · ' || r.titulo,
          'blocoId', r.id, 'mensagem', 'Confirmação sem texto de declaração.'
        ));
      end if;

    elsif r.tipo = 'material' then
      if coalesce(jsonb_array_length(r.config->'arquivos'), 0) = 0 then
        v_itens := v_itens || jsonb_build_array(jsonb_build_object(
          'nivel', 'erro', 'onde', 'Módulo ' || r.mordem || ' · ' || r.titulo,
          'blocoId', r.id, 'mensagem', 'Nenhum arquivo enviado neste bloco de material.'
        ));
      end if;

    elsif r.tipo = 'quiz' then
      if coalesce(jsonb_array_length(r.config->'questoes'), 0) = 0 then
        v_itens := v_itens || jsonb_build_array(jsonb_build_object(
          'nivel', 'erro', 'onde', 'Módulo ' || r.mordem || ' · ' || r.titulo,
          'blocoId', r.id, 'mensagem', 'Quiz sem nenhuma questão.'
        ));
      else
        for q in select value from jsonb_array_elements(r.config->'questoes') loop
          if coalesce(trim(q->>'enunciado'), '') = '' then
            v_itens := v_itens || jsonb_build_array(jsonb_build_object(
              'nivel', 'erro', 'onde', 'Módulo ' || r.mordem || ' · ' || r.titulo,
              'blocoId', r.id, 'mensagem', 'Há questão sem enunciado.'
            ));
          end if;

          if q->>'tipo' = 'multipla_escolha' then
            select count(*) into v_corretas
            from jsonb_array_elements(q->'alternativas') as a(value)
            where (a.value->>'correta')::boolean is true;

            if v_corretas <> 1 then
              v_itens := v_itens || jsonb_build_array(jsonb_build_object(
                'nivel', 'erro', 'onde', 'Módulo ' || r.mordem || ' · ' || r.titulo,
                'blocoId', r.id,
                'mensagem', 'Questão de múltipla escolha com ' || v_corretas ||
                            ' alternativas corretas. Deve ter exatamente uma.'
              ));
            end if;
          end if;

          if q->>'tipo' = 'multipla_resposta' then
            select count(*) into v_corretas
            from jsonb_array_elements(q->'alternativas') as a(value)
            where (a.value->>'correta')::boolean is true;

            if v_corretas = 0 then
              v_itens := v_itens || jsonb_build_array(jsonb_build_object(
                'nivel', 'erro', 'onde', 'Módulo ' || r.mordem || ' · ' || r.titulo,
                'blocoId', r.id, 'mensagem', 'Questão de múltipla resposta sem nenhuma alternativa correta.'
              ));
            end if;
          end if;

          if exists (
            select 1 from jsonb_array_elements(coalesce(q->'alternativas','[]'::jsonb)) as a(value)
            where coalesce(trim(a.value->>'texto'), '') = ''
          ) then
            v_itens := v_itens || jsonb_build_array(jsonb_build_object(
              'nivel', 'erro', 'onde', 'Módulo ' || r.mordem || ' · ' || r.titulo,
              'blocoId', r.id, 'mensagem', 'Há alternativa sem texto.'
            ));
          end if;
        end loop;
      end if;

    elsif r.tipo = 'envio' and v_curso.modalidade = 'online' then
      v_itens := v_itens || jsonb_build_array(jsonb_build_object(
        'nivel', 'erro', 'onde', 'Módulo ' || r.mordem || ' · ' || r.titulo,
        'blocoId', r.id,
        'mensagem', 'Curso 100% online não pode ter bloco de envio: sem correção, o aluno trava.'
      ));
    end if;
  end loop;

  return jsonb_build_object(
    'erros', (select count(*) from jsonb_array_elements(v_itens) x where x.value->>'nivel' = 'erro'),
    'avisos', (select count(*) from jsonb_array_elements(v_itens) x where x.value->>'nivel' = 'aviso'),
    'itens', v_itens
  );
end $fn$;

-- ---------------------------------------------------------------
-- 3. Progresso individual do aluno, para o professor
-- ---------------------------------------------------------------
create or replace function progresso_aluno(p_matricula uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_curso uuid;
  v_out   jsonb;
  v_aluno jsonb;
begin
  if not e_instrutor_da_matricula(p_matricula) then raise exception 'nao autorizado'; end if;

  select c.id into v_curso
  from matricula m join turma t on t.id = m.turma_id join curso c on c.id = t.curso_id
  where m.id = p_matricula;

  select jsonb_build_object(
    'nome', u.nome_completo, 'email', u.email, 'status', m.status,
    'inscritoEm', m.criado_em, 'notaOnline', calcular_nota_online(m.id),
    'ultimaAtividade', (
      select max(pb.atualizado_em) from progresso_bloco pb where pb.matricula_id = m.id
    )
  ) into v_aluno
  from matricula m join usuario u on u.id = m.usuario_id
  where m.id = p_matricula;

  select jsonb_agg(t order by t->>'ordem') into v_out
  from (
    select jsonb_build_object(
      'ordem', mo.ordem,
      'titulo', mo.titulo,
      'blocos', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'titulo', b.titulo,
          'tipo', b.tipo,
          'obrigatorio', b.obrigatorio,
          'estado', coalesce(pb.estado, 'pendente'::status_progresso),
          'nota', pb.nota,
          'atualizadoEm', pb.atualizado_em,
          'tentativas', coalesce(jsonb_array_length(pb.dados->'tentativas'), 0)
        ) order by b.ordem), '[]'::jsonb)
        from bloco b
        left join progresso_bloco pb on pb.bloco_id = b.id and pb.matricula_id = p_matricula
        where b.modulo_id = mo.id
      )
    ) as t
    from modulo mo where mo.curso_id = v_curso
  ) sub;

  return jsonb_build_object('aluno', v_aluno, 'modulos', coalesce(v_out, '[]'::jsonb));
end $fn$;

-- ---------------------------------------------------------------
-- 4. Análise de questão: onde a turma erra
-- ---------------------------------------------------------------
create or replace function analise_quiz(p_turma uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare v_out jsonb;
begin
  if not e_instrutor_da_turma(p_turma) then raise exception 'nao autorizado'; end if;

  with ultimas as (
    select pb.bloco_id, pb.matricula_id,
           pb.dados->'tentativas'->-1 as t
    from progresso_bloco pb
    join matricula m on m.id = pb.matricula_id
    join bloco b on b.id = pb.bloco_id
    where m.turma_id = p_turma
      and b.tipo = 'quiz'
      and jsonb_array_length(coalesce(pb.dados->'tentativas', '[]'::jsonb)) > 0
  ),
  itens as (
    select u.bloco_id,
           i.value->>'id' as questao_id,
           (i.value->>'correta')::boolean as correta
    from ultimas u,
         jsonb_array_elements(coalesce(u.t->'itens', '[]'::jsonb)) as i(value)
  ),
  agregado as (
    select bloco_id, questao_id,
           count(*)::int as respondentes,
           count(*) filter (where correta)::int as acertos
    from itens group by bloco_id, questao_id
  )
  select jsonb_agg(bl order by bl->>'blocoTitulo') into v_out
  from (
    select jsonb_build_object(
      'blocoId', b.id,
      'blocoTitulo', b.titulo,
      'modulo', mo.titulo,
      'questoes', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', a.questao_id,
          'enunciado', (
            select q.value->>'enunciado'
            from jsonb_array_elements(b.config->'questoes') as q(value)
            where q.value->>'id' = a.questao_id
          ),
          'respondentes', a.respondentes,
          'acertos', a.acertos,
          'percentual', round(a.acertos::numeric / nullif(a.respondentes, 0) * 100)
        ) order by (a.acertos::numeric / nullif(a.respondentes, 0))), '[]'::jsonb)
        from agregado a where a.bloco_id = b.id
      )
    ) as bl
    from bloco b
    join modulo mo on mo.id = b.modulo_id
    where b.tipo = 'quiz'
      and exists (select 1 from agregado a where a.bloco_id = b.id)
  ) sub;

  return coalesce(v_out, '[]'::jsonb);
end $fn$;

-- ---------------------------------------------------------------
-- 5. Storage para o bloco de material
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('materiais', 'materiais', false)
on conflict (id) do nothing;

drop policy if exists materiais_leitura on storage.objects;
create policy materiais_leitura on storage.objects
  for select to authenticated using (bucket_id = 'materiais');

drop policy if exists materiais_escrita on storage.objects;
create policy materiais_escrita on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'materiais'
    and exists (select 1 from usuario u where u.id = auth.uid() and u.papel in ('instrutor','admin'))
  );

drop policy if exists materiais_exclusao on storage.objects;
create policy materiais_exclusao on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'materiais'
    and exists (select 1 from usuario u where u.id = auth.uid() and u.papel in ('instrutor','admin'))
  );

grant execute on function
  revisar_curso(uuid), progresso_aluno(uuid), analise_quiz(uuid)
to authenticated;
