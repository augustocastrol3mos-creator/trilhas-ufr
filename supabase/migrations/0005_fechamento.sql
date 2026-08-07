-- 0005_fechamento.sql — decisão do professor, ajuste de nota e fechamento de turma

-- Snapshot da avaliação, congelado no fechamento
alter table matricula add column if not exists nota_online          numeric(5,2);
alter table matricula add column if not exists nota_presencial      numeric(5,2);
alter table matricula add column if not exists nota_final           numeric(5,2);
alter table matricula add column if not exists presenca_confirmada  boolean not null default false;
alter table matricula add column if not exists decisao              text;
alter table matricula add column if not exists decisao_divergente   boolean not null default false;
alter table matricula add column if not exists decisao_justificativa text;
alter table matricula add column if not exists fechada_em           timestamptz;
alter table matricula add column if not exists fechada_por          uuid references usuario(id);

alter table turma add column if not exists fechada_em  timestamptz;
alter table turma add column if not exists fechada_por uuid references usuario(id);

-- Ajuste de nota: append-only. Nunca sobrescreve o valor calculado.
create table if not exists ajuste_nota (
  id             uuid primary key default gen_random_uuid(),
  matricula_id   uuid not null references matricula(id) on delete cascade,
  escopo         text not null,                -- 'bloco' | 'presencial' | 'final'
  bloco_id       uuid references bloco(id),
  valor_anterior numeric(5,2),
  valor_novo     numeric(5,2) not null,
  justificativa  text not null,
  autor_id       uuid not null references usuario(id),
  criado_em      timestamptz not null default now(),

  constraint just_minima check (length(trim(justificativa)) >= 20),
  constraint escopo_valido check (escopo in ('bloco','presencial','final')),
  constraint bloco_quando_escopo_bloco check ((escopo = 'bloco') = (bloco_id is not null))
);

create index if not exists ajuste_nota_idx on ajuste_nota (matricula_id, escopo, criado_em desc);

create or replace function e_instrutor_da_turma(p_turma uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from turma t where t.id = p_turma and t.instrutor_id = auth.uid()
  ) or exists (
    select 1 from usuario u where u.id = auth.uid() and u.papel = 'admin'
  );
$fn$;

create or replace function e_instrutor_da_matricula(p_matricula uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from matricula m where m.id = p_matricula and e_instrutor_da_turma(m.turma_id)
  );
$fn$;

-- Nota efetiva do bloco: último ajuste, ou o valor calculado
create or replace function nota_efetiva_bloco(p_matricula uuid, p_bloco uuid)
returns numeric language sql stable set search_path = public as $fn$
  select coalesce(
    (select valor_novo from ajuste_nota
      where matricula_id = p_matricula and bloco_id = p_bloco and escopo = 'bloco'
      order by criado_em desc limit 1),
    (select nota from progresso_bloco
      where matricula_id = p_matricula and bloco_id = p_bloco),
    0
  );
$fn$;

-- Passa a considerar ajustes
create or replace function calcular_nota_online(p_matricula uuid)
returns numeric language sql stable set search_path = public as $fn$
  select case
    when coalesce(sum(b.peso), 0) = 0 then null
    else round(sum(nota_efetiva_bloco(m.id, b.id) * b.peso) / sum(b.peso), 2)
  end
  from matricula m
  join turma t   on t.id = m.turma_id
  join modulo mo on mo.curso_id = t.curso_id
  join bloco b   on b.modulo_id = mo.id and b.pontuavel
  where m.id = p_matricula;
$fn$;

-- Lista da turma com tudo que o professor precisa ver para decidir
create or replace function turma_alunos(p_turma uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_curso curso%rowtype;
  v_out   jsonb;
begin
  if not e_instrutor_da_turma(p_turma) then
    raise exception 'nao autorizado';
  end if;

  select c.* into v_curso from turma t join curso c on c.id = t.curso_id where t.id = p_turma;

  with obrig as (
    select count(*)::numeric as total
    from modulo mo join bloco b on b.modulo_id = mo.id
    where mo.curso_id = v_curso.id and b.obrigatorio
  ),
  base as (
    select
      m.id, m.status, m.presenca_confirmada, m.nota_presencial,
      m.decisao, m.decisao_justificativa, m.fechada_em,
      u.nome_completo, u.email,
      calcular_nota_online(m.id) as nota_online,
      (select count(*) from modulo mo
         join bloco b on b.modulo_id = mo.id and b.obrigatorio
         join progresso_bloco pb
           on pb.bloco_id = b.id and pb.matricula_id = m.id and pb.estado = 'concluido'
       where mo.curso_id = v_curso.id)::numeric as feitos
    from matricula m
    join usuario u on u.id = m.usuario_id
    where m.turma_id = p_turma
  )
  select jsonb_agg(
    jsonb_build_object(
      'matriculaId', b.id,
      'nome', b.nome_completo,
      'email', b.email,
      'status', b.status,
      'percentualTrilha', case when o.total = 0 then 100 else round(b.feitos / o.total * 100) end,
      'trilhaCompleta', b.feitos >= o.total,
      'notaOnline', b.nota_online,
      'presenca', b.presenca_confirmada,
      'notaPresencial', b.nota_presencial,
      'decisao', b.decisao,
      'justificativa', b.decisao_justificativa,
      'fechada', b.fechada_em is not null
    ) order by b.nome_completo
  ) into v_out
  from base b, obrig o;

  return coalesce(v_out, '[]'::jsonb);
end $fn$;

create or replace function ajustar_nota(
  p_matricula uuid, p_escopo text, p_bloco uuid, p_valor numeric, p_justificativa text
) returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_anterior numeric;
begin
  if not e_instrutor_da_matricula(p_matricula) then
    raise exception 'nao autorizado';
  end if;

  if p_escopo = 'bloco' then
    v_anterior := nota_efetiva_bloco(p_matricula, p_bloco);
  elsif p_escopo = 'presencial' then
    select nota_presencial into v_anterior from matricula where id = p_matricula;
  else
    select nota_final into v_anterior from matricula where id = p_matricula;
  end if;

  insert into ajuste_nota (matricula_id, escopo, bloco_id, valor_anterior, valor_novo, justificativa, autor_id)
  values (p_matricula, p_escopo, p_bloco, v_anterior, p_valor, p_justificativa, auth.uid());

  return jsonb_build_object('ok', true, 'anterior', v_anterior, 'novo', p_valor);
end $fn$;

-- Fechamento: uma transação. Congela notas, grava decisões, emite certificados.
create or replace function fechar_turma(p_turma uuid, p_decisoes jsonb)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_curso     curso%rowtype;
  v_turma     turma%rowtype;
  d           jsonb;
  v_matricula uuid;
  v_online    numeric;
  v_presencial numeric;
  v_final     numeric;
  v_sugerida  text;
  v_decisao   text;
  v_just      text;
  v_aprovados int := 0;
  v_reprovados int := 0;
begin
  if not e_instrutor_da_turma(p_turma) then
    raise exception 'nao autorizado';
  end if;

  select * into v_turma from turma where id = p_turma;
  select c.* into v_curso from curso c where c.id = v_turma.curso_id;

  if v_turma.status = 'encerrada' then
    raise exception 'turma ja encerrada';
  end if;

  for d in select value from jsonb_array_elements(p_decisoes) loop
    v_matricula  := (d->>'matriculaId')::uuid;
    v_presencial := nullif(d->>'notaPresencial', '')::numeric;
    v_decisao    := d->>'decisao';
    v_just       := nullif(trim(coalesce(d->>'justificativa', '')), '');

    if not exists (select 1 from matricula where id = v_matricula and turma_id = p_turma) then
      raise exception 'matricula % nao pertence a esta turma', v_matricula;
    end if;

    v_online := coalesce(calcular_nota_online(v_matricula), 0);
    v_final  := round(
      (v_online * v_curso.peso_online + coalesce(v_presencial, 0) * v_curso.peso_presencial) / 100, 2
    );

    -- Sugestão do sistema: nota, presença e trilha completa
    if v_final >= v_curso.nota_minima_final
       and (not v_curso.exige_presenca or coalesce((d->>'presenca')::boolean, false))
       and not exists (
         select 1 from modulo mo
         join bloco b on b.modulo_id = mo.id and b.obrigatorio
         left join progresso_bloco pb
                on pb.bloco_id = b.id and pb.matricula_id = v_matricula
         where mo.curso_id = v_curso.id
           and coalesce(pb.estado, 'pendente'::status_progresso) <> 'concluido'
       )
    then
      v_sugerida := 'aprovado';
    else
      v_sugerida := 'reprovado';
    end if;

    if v_decisao is null then v_decisao := v_sugerida; end if;

    if v_decisao <> v_sugerida and (v_just is null or length(v_just) < 20) then
      raise exception 'decisao divergente da sugestao exige justificativa de ao menos 20 caracteres';
    end if;

    update matricula set
      nota_online           = v_online,
      nota_presencial       = v_presencial,
      nota_final            = v_final,
      presenca_confirmada   = coalesce((d->>'presenca')::boolean, false),
      decisao               = v_decisao,
      decisao_divergente    = (v_decisao <> v_sugerida),
      decisao_justificativa = v_just,
      status                = case when v_decisao = 'aprovado' then 'aprovado'::status_matricula
                                   else 'reprovado'::status_matricula end,
      fechada_em            = now(),
      fechada_por           = auth.uid()
    where id = v_matricula;

    if v_decisao = 'aprovado' then
      perform emitir_certificado(v_matricula);
      v_aprovados := v_aprovados + 1;
    else
      v_reprovados := v_reprovados + 1;
    end if;
  end loop;

  update turma set status = 'encerrada', fechada_em = now(), fechada_por = auth.uid()
  where id = p_turma;

  return jsonb_build_object('aprovados', v_aprovados, 'reprovados', v_reprovados);
end $fn$;

-- Certificado do curso híbrido usa a nota final congelada
create or replace function emitir_certificado(p_matricula uuid)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_cfg      configuracao%rowtype;
  v_status   status_matricula;
  v_nome     text;
  v_curso    curso%rowtype;
  v_turma    turma%rowtype;
  v_conteudo jsonb;
  v_inicio   date;
  v_fim      date;
  v_nota     numeric;
  v_id       uuid;
begin
  select * into v_cfg from configuracao where id;

  select m.status, u.nome_completo, m.nota_final into v_status, v_nome, v_nota
  from matricula m join usuario u on u.id = m.usuario_id
  where m.id = p_matricula;

  if v_status is null then raise exception 'matricula inexistente'; end if;
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
    matricula_id, codigo, nome_titular, curso_titulo, carga_horaria, modalidade,
    periodo_inicio, periodo_fim, nota_final, conteudo, assinante_nome, assinante_cargo
  ) values (
    p_matricula, gerar_codigo_certificado(), v_nome, v_curso.titulo,
    v_curso.carga_horaria, v_curso.modalidade,
    v_inicio, v_fim, coalesce(v_nota, calcular_nota_online(p_matricula)), v_conteudo,
    v_cfg.assinante_nome, v_cfg.assinante_cargo
  )
  returning id into v_id;

  update matricula set status = 'certificado_emitido' where id = p_matricula;
  return v_id;
end $fn$;

-- RLS: instrutor enxerga sua própria turma
alter table ajuste_nota enable row level security;

drop policy if exists ajuste_visivel on ajuste_nota;
create policy ajuste_visivel on ajuste_nota
  for select to authenticated
  using (
    e_instrutor_da_matricula(matricula_id)
    or exists (select 1 from matricula m where m.id = ajuste_nota.matricula_id and m.usuario_id = auth.uid())
  );
-- sem policy de update/delete: append-only por construção

drop policy if exists turma_do_instrutor on turma;
create policy turma_do_instrutor on turma
  for select to authenticated using (instrutor_id = auth.uid());

drop policy if exists matricula_do_instrutor on matricula;
create policy matricula_do_instrutor on matricula
  for select to authenticated using (e_instrutor_da_turma(turma_id));

drop policy if exists usuario_papel_proprio on usuario;
create policy usuario_papel_proprio on usuario
  for select to authenticated using (id = auth.uid());

grant execute on function
  turma_alunos(uuid), fechar_turma(uuid, jsonb),
  ajustar_nota(uuid, text, uuid, numeric, text),
  e_instrutor_da_turma(uuid), e_instrutor_da_matricula(uuid)
to authenticated;
