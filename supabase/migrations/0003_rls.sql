-- 0003_rls.sql — RLS como rede de segurança. A lógica está nas funções.

alter table usuario         enable row level security;
alter table curso           enable row level security;
alter table turma           enable row level security;
alter table modulo          enable row level security;
alter table bloco           enable row level security;
alter table matricula       enable row level security;
alter table progresso_bloco enable row level security;

create policy usuario_proprio_select on usuario
  for select to authenticated using (id = auth.uid());

create policy usuario_proprio_update on usuario
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy curso_publicado on curso
  for select to anon, authenticated
  using (status = 'publicado' or autor_id = auth.uid());

create policy turma_de_curso_publicado on turma
  for select to anon, authenticated
  using (exists (
    select 1 from curso c where c.id = turma.curso_id and c.status = 'publicado'
  ));

create policy modulo_de_curso_publicado on modulo
  for select to anon, authenticated
  using (exists (
    select 1 from curso c where c.id = modulo.curso_id and c.status = 'publicado'
  ));

-- Sem policy de select em `bloco`: o conteúdo só sai por modulo_conteudo(),
-- que sanitiza o gabarito. Leitura direta fica bloqueada de propósito.

create policy matricula_propria on matricula
  for select to authenticated using (usuario_id = auth.uid());

create policy progresso_proprio on progresso_bloco
  for select to authenticated
  using (exists (
    select 1 from matricula m
    where m.id = progresso_bloco.matricula_id and m.usuario_id = auth.uid()
  ));
