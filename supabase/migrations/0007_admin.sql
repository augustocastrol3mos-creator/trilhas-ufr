-- 0007_admin.sql — coordenação: papéis, autorização de publicação,
-- revogação de certificado, reabertura de turma e auditoria

create or replace function e_admin()
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from usuario u where u.id = auth.uid() and u.papel = 'admin');
$fn$;

-- Log de atos da coordenação. Append-only, como ajuste_nota.
create table if not exists log_admin (
  id            uuid primary key default gen_random_uuid(),
  acao          text not null,          -- 'papel' | 'publicacao' | 'revogacao' | 'reabertura'
  alvo_tipo     text not null,          -- 'usuario' | 'curso' | 'certificado' | 'turma'
  alvo_id       uuid not null,
  detalhe       text,
  justificativa text,
  autor_id      uuid not null references usuario(id),
  criado_em     timestamptz not null default now()
);

create index if not exists log_admin_idx on log_admin (criado_em desc);

-- Publicação passa por autorização quando quem pede não é admin
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
  if not (v_check->>'ok')::boolean then return v_check; end if;

  if e_admin() then
    update curso set status = 'publicado' where id = p_curso;
    insert into log_admin (acao, alvo_tipo, alvo_id, detalhe, autor_id)
    values ('publicacao', 'curso', p_curso, 'publicado diretamente pela coordenação', auth.uid());
    return jsonb_build_object('ok', true, 'status', 'publicado');
  end if;

  update curso set status = 'em_analise' where id = p_curso;
  return jsonb_build_object('ok', true, 'status', 'em_analise');
end $fn$;

create or replace function autorizar_publicacao(p_curso uuid, p_aprovar boolean, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_check jsonb;
begin
  if not e_admin() then raise exception 'apenas a coordenacao pode autorizar'; end if;

  if p_aprovar then
    v_check := validar_publicacao(p_curso);
    if not (v_check->>'ok')::boolean then return v_check; end if;
    update curso set status = 'publicado' where id = p_curso;
  else
    update curso set status = 'rascunho' where id = p_curso;
  end if;

  insert into log_admin (acao, alvo_tipo, alvo_id, detalhe, justificativa, autor_id)
  values ('publicacao', 'curso', p_curso,
          case when p_aprovar then 'autorizado' else 'devolvido ao autor' end,
          p_motivo, auth.uid());

  return jsonb_build_object('ok', true, 'status', case when p_aprovar then 'publicado' else 'rascunho' end);
end $fn$;

create or replace function definir_papel(p_email text, p_papel papel_usuario)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_id uuid;
begin
  if not e_admin() then raise exception 'apenas a coordenacao pode conceder papeis'; end if;

  select id into v_id from usuario where lower(email) = lower(trim(p_email));
  if v_id is null then raise exception 'usuario nao encontrado: %', p_email; end if;
  if v_id = auth.uid() and p_papel <> 'admin' then
    raise exception 'voce nao pode remover o proprio papel de admin';
  end if;

  update usuario set papel = p_papel where id = v_id;

  insert into log_admin (acao, alvo_tipo, alvo_id, detalhe, autor_id)
  values ('papel', 'usuario', v_id, 'papel definido como ' || p_papel, auth.uid());

  return jsonb_build_object('ok', true, 'usuarioId', v_id, 'papel', p_papel);
end $fn$;

-- Certificado não sofre UPDATE de conteúdo: erro se corrige revogando e reemitindo
create or replace function revogar_certificado(p_certificado uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_matricula uuid;
begin
  if not e_admin() then raise exception 'apenas a coordenacao pode revogar'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 10 then
    raise exception 'motivo da revogacao e obrigatorio';
  end if;

  select matricula_id into v_matricula from certificado
  where id = p_certificado and revogado_em is null;
  if v_matricula is null then raise exception 'certificado inexistente ou ja revogado'; end if;

  update certificado
  set revogado_em = now(), revogado_motivo = trim(p_motivo)
  where id = p_certificado;

  update matricula set status = 'aprovado' where id = v_matricula;

  insert into log_admin (acao, alvo_tipo, alvo_id, justificativa, autor_id)
  values ('revogacao', 'certificado', p_certificado, trim(p_motivo), auth.uid());

  return jsonb_build_object('ok', true, 'matriculaId', v_matricula);
end $fn$;

create or replace function reemitir_certificado(p_certificado_antigo uuid)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_matricula uuid;
  v_novo      uuid;
begin
  if not e_admin() then raise exception 'apenas a coordenacao pode reemitir'; end if;

  select matricula_id into v_matricula from certificado
  where id = p_certificado_antigo and revogado_em is not null;
  if v_matricula is null then
    raise exception 'revogue o certificado antes de reemitir';
  end if;

  v_novo := emitir_certificado(v_matricula);

  update certificado set substituido_por = v_novo where id = p_certificado_antigo;

  insert into log_admin (acao, alvo_tipo, alvo_id, detalhe, autor_id)
  values ('revogacao', 'certificado', v_novo,
          'reemitido em substituicao a ' || p_certificado_antigo::text, auth.uid());

  return v_novo;
end $fn$;

create or replace function reabrir_turma(p_turma uuid, p_justificativa text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
begin
  if not e_admin() then raise exception 'apenas a coordenacao pode reabrir turmas'; end if;
  if length(trim(coalesce(p_justificativa, ''))) < 20 then
    raise exception 'justificativa de ao menos 20 caracteres e obrigatoria';
  end if;

  update turma set status = 'em_andamento', fechada_em = null, fechada_por = null
  where id = p_turma and status = 'encerrada';

  if not found then raise exception 'turma nao esta encerrada'; end if;

  -- Certificados já emitidos permanecem: corrigir nota exige revogar e reemitir
  update matricula set fechada_em = null where turma_id = p_turma;

  insert into log_admin (acao, alvo_tipo, alvo_id, justificativa, autor_id)
  values ('reabertura', 'turma', p_turma, trim(p_justificativa), auth.uid());

  return jsonb_build_object('ok', true);
end $fn$;

-- Reordenação: troca a posição com o vizinho, em três passos
-- porque unique(ordem) é verificado a cada statement
create or replace function mover_modulo(p_modulo uuid, p_direcao int)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_curso uuid; v_ordem int; v_vizinho uuid; v_ordem_vizinho int;
begin
  if not e_autor_do_modulo(p_modulo) then raise exception 'nao autorizado'; end if;

  select curso_id, ordem into v_curso, v_ordem from modulo where id = p_modulo;

  select id, ordem into v_vizinho, v_ordem_vizinho from modulo
  where curso_id = v_curso
    and case when p_direcao < 0 then ordem < v_ordem else ordem > v_ordem end
  order by case when p_direcao < 0 then -ordem else ordem end
  limit 1;

  if v_vizinho is null then return jsonb_build_object('ok', false, 'motivo', 'ja esta no limite'); end if;

  update modulo set ordem = -1 where id = p_modulo;
  update modulo set ordem = v_ordem where id = v_vizinho;
  update modulo set ordem = v_ordem_vizinho where id = p_modulo;

  return jsonb_build_object('ok', true);
end $fn$;

create or replace function mover_bloco(p_bloco uuid, p_direcao int)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_modulo uuid; v_ordem int; v_vizinho uuid; v_ordem_vizinho int;
begin
  select modulo_id, ordem into v_modulo, v_ordem from bloco where id = p_bloco;
  if not e_autor_do_modulo(v_modulo) then raise exception 'nao autorizado'; end if;

  select id, ordem into v_vizinho, v_ordem_vizinho from bloco
  where modulo_id = v_modulo
    and case when p_direcao < 0 then ordem < v_ordem else ordem > v_ordem end
  order by case when p_direcao < 0 then -ordem else ordem end
  limit 1;

  if v_vizinho is null then return jsonb_build_object('ok', false, 'motivo', 'ja esta no limite'); end if;

  update bloco set ordem = -1 where id = p_bloco;
  update bloco set ordem = v_ordem where id = v_vizinho;
  update bloco set ordem = v_ordem_vizinho where id = p_bloco;

  return jsonb_build_object('ok', true);
end $fn$;

-- Painéis da coordenação
create or replace function admin_visao_geral()
returns jsonb language sql stable security definer set search_path = public as $fn$
  select case when not e_admin() then jsonb_build_object('erro', 'nao autorizado') else
    jsonb_build_object(
      'usuarios',          (select count(*) from usuario),
      'instrutores',       (select count(*) from usuario where papel in ('instrutor','admin')),
      'cursosPublicados',  (select count(*) from curso where status = 'publicado'),
      'cursosEmAnalise',   (select count(*) from curso where status = 'em_analise'),
      'matriculas',        (select count(*) from matricula),
      'certificadosAtivos',(select count(*) from certificado where revogado_em is null),
      'certificadosRevogados', (select count(*) from certificado where revogado_em is not null),
      'ajustesDeNota',     (select count(*) from ajuste_nota),
      'decisoesDivergentes',(select count(*) from matricula where decisao_divergente)
    )
  end;
$fn$;

create or replace function admin_auditoria(p_limite int default 50)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare v_out jsonb;
begin
  if not e_admin() then raise exception 'nao autorizado'; end if;

  select jsonb_agg(t order by t->>'criadoEm' desc) into v_out
  from (
    select jsonb_build_object(
      'tipo', 'ajuste_nota', 'criadoEm', a.criado_em,
      'autor', au.nome_completo, 'detalhe',
      'nota ' || coalesce(a.valor_anterior::text,'—') || ' → ' || a.valor_novo::text ||
      ' (' || a.escopo || ') para ' || al.nome_completo,
      'justificativa', a.justificativa
    ) as t
    from ajuste_nota a
    join usuario au on au.id = a.autor_id
    join matricula m on m.id = a.matricula_id
    join usuario al on al.id = m.usuario_id

    union all

    select jsonb_build_object(
      'tipo', l.acao, 'criadoEm', l.criado_em,
      'autor', u.nome_completo, 'detalhe', coalesce(l.detalhe, l.alvo_tipo),
      'justificativa', l.justificativa
    )
    from log_admin l join usuario u on u.id = l.autor_id

    union all

    select jsonb_build_object(
      'tipo', 'decisao_divergente', 'criadoEm', m.fechada_em,
      'autor', coalesce(f.nome_completo, '—'),
      'detalhe', m.decisao || ' contrariando a sugestão, para ' || al.nome_completo,
      'justificativa', m.decisao_justificativa
    )
    from matricula m
    join usuario al on al.id = m.usuario_id
    left join usuario f on f.id = m.fechada_por
    where m.decisao_divergente
  ) sub
  limit p_limite;

  return coalesce(v_out, '[]'::jsonb);
end $fn$;

-- Admin enxerga tudo
drop policy if exists usuario_admin on usuario;
create policy usuario_admin on usuario for select to authenticated using (e_admin());

drop policy if exists curso_admin on curso;
create policy curso_admin on curso for select to authenticated using (e_admin());

drop policy if exists turma_admin on turma;
create policy turma_admin on turma for select to authenticated using (e_admin());

drop policy if exists matricula_admin on matricula;
create policy matricula_admin on matricula for select to authenticated using (e_admin());

drop policy if exists certificado_admin on certificado;
create policy certificado_admin on certificado for select to authenticated using (e_admin());

alter table log_admin enable row level security;
drop policy if exists log_admin_leitura on log_admin;
create policy log_admin_leitura on log_admin for select to authenticated using (e_admin());

grant execute on function
  e_admin(), definir_papel(text, papel_usuario),
  autorizar_publicacao(uuid, boolean, text),
  revogar_certificado(uuid, text), reemitir_certificado(uuid),
  reabrir_turma(uuid, text), mover_modulo(uuid, int), mover_bloco(uuid, int),
  admin_visao_geral(), admin_auditoria(int)
to authenticated;
