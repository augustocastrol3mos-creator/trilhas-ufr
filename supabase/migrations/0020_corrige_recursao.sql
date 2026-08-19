-- 0020_corrige_recursao.sql
--
-- CORREÇÃO URGENTE de um defeito que a 0019 introduziu.
--
-- O erro em produção: "infinite recursion detected in policy for relation
-- turma", quebrando /cursos e /meus-cursos.
--
-- A CAUSA
--
-- A 0019 acrescentou à policy de `curso` a condição "sou matriculado numa
-- turma deste curso", escrita como subconsulta em `turma`. Só que a policy de
-- `turma` já consultava `curso`. O resultado:
--
--     ler curso -> policy do curso consulta turma
--                    -> policy da turma consulta curso
--                       -> policy do curso consulta turma -> ...
--
-- Antes da 0019 não havia ciclo, porque a policy do curso olhava apenas
-- `status` e `autor_id`, sem tocar em outra tabela. Foi a minha condição nova
-- que fechou o laço.
--
-- A LIÇÃO, que vale para toda policy futura deste projeto:
--
--   Policy que consulta OUTRA tabela protegida por RLS dispara a policy
--   daquela tabela. Se as duas se consultarem, o Postgres entra em recursão.
--   Toda checagem cruzada entre tabelas com RLS tem que morar numa função
--   SECURITY DEFINER — que roda como dono, ignora RLS e encerra a cadeia.
--
-- É a mesma razão pela qual e_admin(), e_dono_matricula() e companhia sempre
-- foram funções em vez de subconsultas inline. A 0019 quebrou esse padrão sem
-- perceber. Estas quatro funções restauram ele.

-- ---------------------------------------------------------------------------
-- Predicados sem RLS: encerram a cadeia de avaliação
-- ---------------------------------------------------------------------------

create or replace function curso_esta_publicado(p_curso uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from curso where id = p_curso and status = 'publicado');
$fn$;

create or replace function sou_autor_do_curso_id(p_curso uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from curso where id = p_curso and autor_id = auth.uid());
$fn$;

create or replace function estou_matriculado_no_curso(p_curso uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1
    from turma t
    join matricula m on m.turma_id = t.id
    where t.curso_id = p_curso and m.usuario_id = auth.uid()
  );
$fn$;

create or replace function estou_matriculado_na_turma(p_turma uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from matricula m
    where m.turma_id = p_turma and m.usuario_id = auth.uid()
  );
$fn$;

grant execute on function
  curso_esta_publicado(uuid), sou_autor_do_curso_id(uuid),
  estou_matriculado_no_curso(uuid), estou_matriculado_na_turma(uuid)
to anon, authenticated;

-- ---------------------------------------------------------------------------
-- As três policies, agora sem consultar tabela protegida por dentro
-- ---------------------------------------------------------------------------

-- Nenhuma delas faz subconsulta em tabela com RLS: só chamadas de função e
-- comparação de coluna da própria linha. Não há como recursar.

drop policy if exists curso_publicado on curso;
create policy curso_publicado on curso
  for select using (
    status = 'publicado'
    or autor_id = auth.uid()
    or estou_matriculado_no_curso(curso.id)
  );

drop policy if exists turma_de_curso_publicado on turma;
create policy turma_de_curso_publicado on turma
  for select using (
    curso_esta_publicado(turma.curso_id)
    or sou_autor_do_curso_id(turma.curso_id)
    or estou_matriculado_na_turma(turma.id)
  );

drop policy if exists modulo_de_curso_publicado on modulo;
create policy modulo_de_curso_publicado on modulo
  for select using (
    curso_esta_publicado(modulo.curso_id)
    or sou_autor_do_curso_id(modulo.curso_id)
    or estou_matriculado_no_curso(modulo.curso_id)
  );

-- ---------------------------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------------------------

-- Rode depois de aplicar. Se devolver linhas sem erro, a recursão acabou.
-- (Simula um aluno; troque o UUID por um de verdade se quiser conferir a
--  parte de "matriculado".)
--
--   select id, titulo, status from curso limit 5;
--   select id, identificador from turma limit 5;
--   select id, titulo from modulo limit 5;
