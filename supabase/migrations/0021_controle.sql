-- 0021_controle.sql
--
-- POR QUE ESTA MIGRATION EXISTE
--
-- A seção 4 do ESTADO_DO_PROJETO já avisava que descobrir divergência entre
-- banco e repositório era feito comparando `select proname from pg_proc` com a
-- lista de migrations na mão. Isso é sintoma, não solução — e cobrou o preço:
-- as migrations 0010, 0016 e 0020 rodaram no banco de produção e NUNCA foram
-- salvas no repositório. Ficaram só como texto no chat.
--
-- A mais grave delas era a 0010, que é justamente a que impede qualquer aluno
-- de virar admin. Ou seja: a correção de segurança mais crítica do projeto era
-- a que não estava versionada.
--
-- A partir daqui, "o que já rodou neste banco?" é um select, não uma auditoria.

create table if not exists migration_aplicada (
  nome        text primary key,
  aplicada_em timestamptz not null default now()
);

comment on table migration_aplicada is
  'Registro de migrations executadas. Toda migration nova deve inserir o próprio nome na última linha.';

-- ---------------------------------------------------------------------------
-- Backfill do histórico
-- ---------------------------------------------------------------------------

-- Lista estática das migrations que já rodaram até aqui. `on conflict do
-- nothing` torna esta migration segura de reexecutar, e faz com que uma
-- reconstrução do zero (rodando 0001..0021 em ordem) registre tudo
-- corretamente ao chegar nesta linha.

insert into migration_aplicada (nome) values
  ('0001_schema.sql'),
  ('0002_functions.sql'),
  ('0003_rls.sql'),
  ('0004_certificados.sql'),
  ('0005_fechamento.sql'),
  ('0006_autoria.sql'),
  ('0007_admin.sql'),
  ('0008_trilha.sql'),
  ('0009_professor.sql'),
  ('0010_papel.sql'),
  ('0011_integridade.sql'),
  ('0012_quiz.sql'),
  ('0013_inscricao.sql'),
  ('0014_turmas.sql'),
  ('0015_presenca.sql'),
  ('0016_encontros.sql'),
  ('0017_indices.sql'),
  ('0018_reinscricao.sql'),
  ('0019_arquivar.sql'),
  ('0020_corrige_recursao.sql')
on conflict (nome) do nothing;

-- ---------------------------------------------------------------------------
-- Convenção para as próximas
-- ---------------------------------------------------------------------------

-- Toda migration daqui em diante termina com a linha abaixo, trocando o nome:
--
--   insert into migration_aplicada (nome) values ('00XX_nome.sql')
--   on conflict (nome) do nothing;
--
-- E para saber o que falta rodar em qualquer banco:
--
--   select nome, aplicada_em from migration_aplicada order by nome;

insert into migration_aplicada (nome) values ('0021_controle.sql')
on conflict (nome) do nothing;
