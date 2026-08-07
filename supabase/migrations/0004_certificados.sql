-- 0004_certificados.sql — emissão, snapshot e validação pública

-- Período do curso, para o certificado (o ENAP mostra início e fim)
alter table turma add column if not exists inicio date;
alter table turma add column if not exists fim    date;

-- Configuração institucional: linha única
create table if not exists configuracao (
  id                 boolean primary key default true check (id),
  instituicao_nome   text not null default 'Universidade Federal de Rondonópolis',
  instituicao_sigla  text not null default 'UFR',
  orgao_emissor      text not null default 'Pró-Reitoria de Extensão, Cultura e Assuntos Estudantis',
  assinante_nome     text not null default 'Coordenação de Extensão',
  assinante_cargo    text not null default 'Pró-Reitoria de Extensão',
  url_base           text not null default 'http://localhost:3000'
);
insert into configuracao (id) values (true) on conflict (id) do nothing;

create table if not exists certificado (
  id              uuid primary key default gen_random_uuid(),
  matricula_id    uuid not null references matricula(id) on delete cascade,
  codigo          text not null unique,

  -- snapshot: o documento não muda quando o cadastro mudar
  nome_titular    text not null,
  curso_titulo    text not null,
  carga_horaria   int  not null,
  modalidade      modalidade_curso not null,
  periodo_inicio  date,
  periodo_fim     date,
  nota_final      numeric(5,2),
  conteudo        jsonb not null default '[]'::jsonb,
  assinante_nome  text not null,
  assinante_cargo text not null,
  registro_proex  text,

  emitido_em      timestamptz not null default now(),
  revogado_em     timestamptz,
  revogado_motivo text,
  substituido_por uuid references certificado(id)
);

-- No máximo um certificado ativo por matrícula
create unique index if not exists certificado_ativo_unico
  on certificado (matricula_id) where revogado_em is null;

-- Alfabeto sem caracteres ambíguos (0/O, 1/I/L)
create or replace function gerar_codigo_certificado()
returns text language plpgsql volatile set search_path = public as $fn$
declare
  v_alfabeto text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_sufixo   text;
  v_codigo   text;
  i          int;
begin
  loop
    v_sufixo := '';
    for i in 1..6 loop
      v_sufixo := v_sufixo || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::int, 1);
    end loop;

    v_codigo := 'UFR-' || to_char(now(), 'YYYY') || '-' || v_sufixo;
    exit when not exists (select 1 from certificado where codigo = v_codigo);
  end loop;

  return v_codigo;
end $fn$;

create or replace function calcular_nota_online(p_matricula uuid)
returns numeric language sql stable set search_path = public as $fn$
  select case
    when coalesce(sum(b.peso), 0) = 0 then null
    else round(sum(coalesce(pb.nota, 0) * b.peso) / sum(b.peso), 2)
  end
  from matricula m
  join turma t   on t.id = m.turma_id
  join modulo mo on mo.curso_id = t.curso_id
  join bloco b   on b.modulo_id = mo.id and b.pontuavel
  left join progresso_bloco pb
         on pb.bloco_id = b.id and pb.matricula_id = m.id
  where m.id = p_matricula;
$fn$;

create or replace function emitir_certificado(p_matricula uuid)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_cfg    configuracao%rowtype;
  v_status status_matricula;
  v_nome   text;
  v_curso  curso%rowtype;
  v_turma  turma%rowtype;
  v_conteudo jsonb;
  v_inicio date;
  v_fim    date;
  v_id     uuid;
begin
  select * into v_cfg from configuracao where id;

  select m.status, u.nome_completo into v_status, v_nome
  from matricula m join usuario u on u.id = m.usuario_id
  where m.id = p_matricula;

  if v_status is null then raise exception 'matricula inexistente'; end if;
  if v_status not in ('aprovado','certificado_emitido') then
    raise exception 'matricula nao aprovada';
  end if;
  if coalesce(trim(v_nome), '') = '' then
    raise exception 'nome completo do titular nao preenchido';
  end if;

  -- Já existe certificado ativo: devolve o mesmo, não duplica
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

  -- Turma contínua não tem datas próprias: usa inscrição e conclusão do aluno
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
    v_inicio, v_fim, calcular_nota_online(p_matricula), v_conteudo,
    v_cfg.assinante_nome, v_cfg.assinante_cargo
  )
  returning id into v_id;

  update matricula set status = 'certificado_emitido' where id = p_matricula;

  return v_id;
end $fn$;

-- Emissão automática para cursos online, dentro da mesma transação da conclusão
create or replace function atualizar_status_matricula(p_matricula uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  v_curso curso%rowtype;
  v_falta int;
  v_nota  numeric;
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

  if v_falta > 0 then
    update matricula set status = 'em_andamento'
    where id = p_matricula and status = 'inscrito';
    return;
  end if;

  if v_curso.modalidade = 'online' and v_curso.emissao = 'automatica' then
    v_nota := calcular_nota_online(p_matricula);

    if v_nota is null or v_nota >= v_curso.nota_minima_final then
      update matricula set status = 'aprovado'
      where id = p_matricula and status <> 'certificado_emitido';
      perform emitir_certificado(p_matricula);
    else
      update matricula set status = 'reprovado' where id = p_matricula;
    end if;
  else
    update matricula set status = 'trilha_concluida'
    where id = p_matricula and status in ('inscrito','em_andamento');
  end if;
end $fn$;

-- Consulta pública por código. Não expõe matrícula, nota por bloco nem e-mail.
create or replace function validar_certificado(p_codigo text)
returns jsonb language sql stable security definer set search_path = public as $fn$
  select jsonb_build_object(
    'codigo', c.codigo,
    'valido', c.revogado_em is null,
    'revogadoEm', c.revogado_em,
    'revogadoMotivo', c.revogado_motivo,
    'nomeTitular', c.nome_titular,
    'cursoTitulo', c.curso_titulo,
    'cargaHoraria', c.carga_horaria,
    'modalidade', c.modalidade,
    'periodoInicio', c.periodo_inicio,
    'periodoFim', c.periodo_fim,
    'notaFinal', c.nota_final,
    'emitidoEm', c.emitido_em,
    'registroProex', c.registro_proex,
    'instituicao', cfg.instituicao_nome
  )
  from certificado c, configuracao cfg
  where upper(c.codigo) = upper(trim(p_codigo)) and cfg.id;
$fn$;

alter table certificado enable row level security;

create policy certificado_proprio on certificado
  for select to authenticated
  using (exists (
    select 1 from matricula m
    where m.id = certificado.matricula_id and m.usuario_id = auth.uid()
  ));

grant execute on function validar_certificado(text) to anon, authenticated;
grant execute on function emitir_certificado(uuid), calcular_nota_online(uuid) to authenticated;

-- Datas para a turma do seed
update turma set inicio = current_date, fim = current_date + interval '60 days'
where tipo = 'coorte' and inicio is null;
