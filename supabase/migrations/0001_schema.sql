-- 0001_schema.sql — tabelas base

create type papel_usuario       as enum ('aluno','instrutor','admin');
create type modalidade_curso    as enum ('hibrido','online');
create type emissao_certificado as enum ('manual','automatica');
create type tipo_turma          as enum ('coorte','continua');
create type tipo_bloco          as enum ('video','texto','material','quiz','envio','checkpoint');
create type status_progresso    as enum ('pendente','em_andamento','aguardando_correcao','concluido','reprovado');
create type status_matricula    as enum ('inscrito','em_andamento','trilha_concluida','aprovado','reprovado','certificado_emitido');

create table usuario (
  id            uuid primary key references auth.users(id) on delete cascade,
  nome_completo text not null default '',
  cpf           text,
  email         text not null,
  papel         papel_usuario not null default 'aluno',
  criado_em     timestamptz not null default now()
);

create table curso (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  titulo            text not null,
  descricao         text,
  carga_horaria     int  not null default 20,
  modalidade        modalidade_curso not null default 'hibrido',
  emissao           emissao_certificado not null default 'manual',
  peso_online       numeric(5,2) not null default 60,
  peso_presencial   numeric(5,2) not null default 40,
  nota_minima_final numeric(5,2) not null default 60,
  exige_presenca    boolean not null default true,
  autor_id          uuid references usuario(id),
  status            text not null default 'rascunho',
  criado_em         timestamptz not null default now(),
  constraint pesos_somam_cem       check (peso_online + peso_presencial = 100),
  constraint online_e_automatico   check (modalidade <> 'online' or emissao = 'automatica'),
  constraint online_sem_presencial check (
    modalidade <> 'online'
    or (peso_online = 100 and peso_presencial = 0 and exige_presenca = false)
  )
);

create table turma (
  id             uuid primary key default gen_random_uuid(),
  curso_id       uuid not null references curso(id) on delete cascade,
  instrutor_id   uuid references usuario(id),
  identificador  text not null,
  tipo           tipo_turma not null default 'coorte',
  inscricoes_ate date,
  encontro_data  timestamptz,
  encontro_local text,
  vagas          int,
  status         text not null default 'inscricoes_abertas',
  unique (curso_id, identificador),
  constraint coorte_tem_encontro   check (tipo <> 'coorte'   or encontro_data is not null),
  constraint continua_sem_encontro check (tipo <> 'continua' or encontro_data is null)
);

create table modulo (
  id        uuid primary key default gen_random_uuid(),
  curso_id  uuid not null references curso(id) on delete cascade,
  ordem     int  not null,
  titulo    text not null,
  descricao text,
  unique (curso_id, ordem)
);

create table bloco (
  id          uuid primary key default gen_random_uuid(),
  modulo_id   uuid not null references modulo(id) on delete cascade,
  ordem       int  not null,
  tipo        tipo_bloco not null,
  titulo      text not null,
  config      jsonb not null default '{}'::jsonb,
  obrigatorio boolean not null default false,
  pontuavel   boolean not null default false,
  peso        numeric(5,2) not null default 1,
  unique (modulo_id, ordem)
);

create table matricula (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuario(id) on delete cascade,
  turma_id   uuid not null references turma(id) on delete cascade,
  status     status_matricula not null default 'inscrito',
  criado_em  timestamptz not null default now(),
  unique (usuario_id, turma_id)
);

create table progresso_bloco (
  id            uuid primary key default gen_random_uuid(),
  matricula_id  uuid not null references matricula(id) on delete cascade,
  bloco_id      uuid not null references bloco(id) on delete cascade,
  estado        status_progresso not null default 'pendente',
  dados         jsonb not null default '{}'::jsonb,
  nota          numeric(5,2),
  atualizado_em timestamptz not null default now(),
  unique (matricula_id, bloco_id)
);

create index on modulo (curso_id, ordem);
create index on bloco (modulo_id, ordem);
create index on progresso_bloco (matricula_id);
create index on matricula (usuario_id);

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  insert into usuario (id, email, nome_completo)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nome_completo', ''))
  on conflict (id) do nothing;
  return new;
end $fn$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();
