-- 0006_autoria.sql — o professor cria e edita os próprios cursos

create or replace function e_autor_do_curso(p_curso uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from curso c where c.id = p_curso and c.autor_id = auth.uid())
      or exists (select 1 from usuario u where u.id = auth.uid() and u.papel = 'admin');
$fn$;

create or replace function e_autor_do_modulo(p_modulo uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from modulo mo where mo.id = p_modulo and e_autor_do_curso(mo.curso_id));
$fn$;

-- Escrita: só instrutor ou admin
create or replace function pode_criar_curso()
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from usuario u where u.id = auth.uid() and u.papel in ('instrutor','admin'));
$fn$;

drop policy if exists curso_insert_instrutor on curso;
create policy curso_insert_instrutor on curso
  for insert to authenticated with check (pode_criar_curso() and autor_id = auth.uid());

drop policy if exists curso_update_autor on curso;
create policy curso_update_autor on curso
  for update to authenticated using (e_autor_do_curso(id)) with check (e_autor_do_curso(id));

drop policy if exists curso_delete_autor on curso;
create policy curso_delete_autor on curso
  for delete to authenticated using (e_autor_do_curso(id) and status = 'rascunho');

drop policy if exists turma_escrita_autor on turma;
create policy turma_escrita_autor on turma
  for all to authenticated using (e_autor_do_curso(curso_id)) with check (e_autor_do_curso(curso_id));

drop policy if exists modulo_leitura_autor on modulo;
create policy modulo_leitura_autor on modulo
  for select to authenticated using (e_autor_do_curso(curso_id));

drop policy if exists modulo_escrita_autor on modulo;
create policy modulo_escrita_autor on modulo
  for all to authenticated using (e_autor_do_curso(curso_id)) with check (e_autor_do_curso(curso_id));

-- Bloco: o autor lê com gabarito; o aluno continua sem policy de select,
-- e só recebe conteúdo por modulo_conteudo(), que sanitiza.
drop policy if exists bloco_leitura_autor on bloco;
create policy bloco_leitura_autor on bloco
  for select to authenticated using (e_autor_do_modulo(modulo_id));

drop policy if exists bloco_escrita_autor on bloco;
create policy bloco_escrita_autor on bloco
  for all to authenticated using (e_autor_do_modulo(modulo_id)) with check (e_autor_do_modulo(modulo_id));

-- Invariantes de publicação
create or replace function validar_publicacao(p_curso uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_curso     curso%rowtype;
  v_pendencias text[] := '{}';
  v_modulos   int;
  v_obrig     int;
  v_pontuavel int;
  v_envios    int;
begin
  select * into v_curso from curso where id = p_curso;
  if v_curso.id is null then raise exception 'curso inexistente'; end if;

  select count(*) into v_modulos from modulo where curso_id = p_curso;
  if v_modulos = 0 then
    v_pendencias := v_pendencias || 'O curso precisa de ao menos um módulo.';
  end if;

  select
    count(*) filter (where b.obrigatorio),
    count(*) filter (where b.pontuavel),
    count(*) filter (where b.tipo = 'envio')
  into v_obrig, v_pontuavel, v_envios
  from modulo mo join bloco b on b.modulo_id = mo.id
  where mo.curso_id = p_curso;

  if coalesce(v_obrig, 0) = 0 then
    v_pendencias := v_pendencias || 'Nenhum bloco obrigatório: a trilha não teria trava nem conclusão.';
  end if;

  if v_curso.emissao = 'automatica' and coalesce(v_pontuavel, 0) = 0 then
    v_pendencias := v_pendencias ||
      'Emissão automática exige ao menos um bloco pontuável (um quiz).';
  end if;

  if v_curso.modalidade = 'online' and coalesce(v_envios, 0) > 0 then
    v_pendencias := v_pendencias ||
      'Curso 100% online não pode ter bloco de envio: sem professor de plantão, o aluno trava esperando correção.';
  end if;

  if not exists (select 1 from turma where curso_id = p_curso) then
    v_pendencias := v_pendencias || 'O curso precisa de ao menos uma turma.';
  end if;

  return jsonb_build_object(
    'ok', array_length(v_pendencias, 1) is null,
    'pendencias', to_jsonb(v_pendencias)
  );
end $fn$;

create or replace function publicar_curso(p_curso uuid, p_publicar boolean)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_check jsonb;
begin
  if not e_autor_do_curso(p_curso) then raise exception 'nao autorizado'; end if;

  if not p_publicar then
    update curso set status = 'rascunho' where id = p_curso;
    return jsonb_build_object('ok', true, 'status', 'rascunho');
  end if;

  v_check := validar_publicacao(p_curso);
  if not (v_check->>'ok')::boolean then
    return v_check;
  end if;

  update curso set status = 'publicado' where id = p_curso;
  return jsonb_build_object('ok', true, 'status', 'publicado');
end $fn$;

-- Cria curso + turma correspondente à modalidade, numa transação
create or replace function criar_curso(p_dados jsonb)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_id         uuid;
  v_modalidade modalidade_curso;
  v_slug       text;
  v_sufixo     int := 1;
begin
  if not pode_criar_curso() then raise exception 'apenas instrutores podem criar cursos'; end if;

  v_modalidade := (p_dados->>'modalidade')::modalidade_curso;

  v_slug := regexp_replace(lower(trim(p_dados->>'titulo')), '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then v_slug := 'curso'; end if;
  while exists (select 1 from curso where slug = v_slug) loop
    v_sufixo := v_sufixo + 1;
    v_slug := v_slug || '-' || v_sufixo;
  end loop;

  insert into curso (
    slug, titulo, descricao, carga_horaria, modalidade, emissao,
    peso_online, peso_presencial, nota_minima_final, exige_presenca,
    autor_id, status
  ) values (
    v_slug,
    trim(p_dados->>'titulo'),
    nullif(trim(coalesce(p_dados->>'descricao','')), ''),
    coalesce((p_dados->>'cargaHoraria')::int, 20),
    v_modalidade,
    case when v_modalidade = 'online' then 'automatica' else 'manual' end::emissao_certificado,
    case when v_modalidade = 'online' then 100 else coalesce((p_dados->>'pesoOnline')::numeric, 60) end,
    case when v_modalidade = 'online' then 0   else 100 - coalesce((p_dados->>'pesoOnline')::numeric, 60) end,
    coalesce((p_dados->>'notaMinima')::numeric, 60),
    v_modalidade <> 'online',
    auth.uid(),
    'rascunho'
  )
  returning id into v_id;

  insert into turma (curso_id, instrutor_id, identificador, tipo, encontro_data, encontro_local, inicio, fim)
  values (
    v_id, auth.uid(),
    coalesce(nullif(trim(p_dados->>'turma'), ''),
             case when v_modalidade = 'online' then 'continua' else to_char(now(),'YYYY') || '/1' end),
    case when v_modalidade = 'online' then 'continua' else 'coorte' end::tipo_turma,
    case when v_modalidade = 'online' then null else (p_dados->>'encontroData')::timestamptz end,
    case when v_modalidade = 'online' then null else nullif(trim(coalesce(p_dados->>'encontroLocal','')), '') end,
    case when v_modalidade = 'online' then null else current_date end,
    case when v_modalidade = 'online' then null else (p_dados->>'encontroData')::date end
  );

  return v_id;
end $fn$;

grant execute on function
  criar_curso(jsonb), publicar_curso(uuid, boolean), validar_publicacao(uuid),
  e_autor_do_curso(uuid), e_autor_do_modulo(uuid), pode_criar_curso()
to authenticated;
