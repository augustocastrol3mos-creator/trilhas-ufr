-- excluir_cursos_teste.sql
--
-- ############################################################################
-- #  NÃO É MIGRATION. Mora em supabase/scripts/ para nunca rodar por engano   #
-- #  junto com as migrations.                                                 #
-- ############################################################################
--
-- Remove cursos DE TESTE por completo — turmas, matrículas, progresso,
-- presença, encontros, ajustes de nota E CERTIFICADOS EMITIDOS.
--
-- Isto contorna de propósito a trava de `excluir_curso`, que recusa qualquer
-- curso com matrícula. A trava vive na RPC e não na tabela justamente para
-- isso: o caminho pela aplicação é protegido contra clique errado; o caminho
-- por SQL é uma decisão consciente de quem tem acesso ao banco.
--
-- QUANDO NÃO USAR: depois que o piloto começar. A partir daí, certificado
-- emitido é documento institucional — some daqui, some a URL pública de
-- validação, e quem tem o PDF na mão não consegue mais comprovar nada. Nesse
-- cenário o caminho é ARQUIVAR, nunca isto.
--
-- ATENÇÃO: exclusão por SQL direto NÃO deixa registro em log_admin. A auditoria
-- da coordenação não vai saber que estes cursos existiram.

-- ===========================================================================
-- ETAPA 1 — Escolher
-- ===========================================================================
-- Rode sozinho e anote os id dos cursos que devem morrer.

select c.id, c.titulo, c.status,
       (select count(*) from turma t where t.curso_id = c.id) as turmas,
       (select count(*) from matricula m
          join turma t on t.id = m.turma_id where t.curso_id = c.id) as matriculas,
       (select count(*) from certificado ce
          join matricula m on m.id = ce.matricula_id
          join turma t on t.id = m.turma_id where t.curso_id = c.id) as certificados
from curso c
order by c.titulo;

-- ===========================================================================
-- ETAPA 2 — Conferir o que vai embora
-- ===========================================================================
-- Substitua os UUID abaixo pelos da etapa 1 e rode. Se aparecer o nome de uma
-- pessoa real com certificado que importa, PARE.
--
-- Use a lista explícita de id, nunca um `like` no título: "Teste" também casa
-- com "Teste de hipóteses", e a diferença entre os dois só aparece depois.

with alvo as (
  select unnest(array[
    '00000000-0000-0000-0000-000000000000'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid
  ]) as curso_id
)
select ce.codigo, ce.nome_titular, ce.curso_titulo, ce.emitido_em, u.email
from certificado ce
join matricula m on m.id = ce.matricula_id
join turma t     on t.id = m.turma_id
join usuario u   on u.id = m.usuario_id
join alvo a      on a.curso_id = t.curso_id
order by ce.emitido_em;

-- ===========================================================================
-- ETAPA 3 — Limpar o Storage ANTES de apagar as linhas
-- ===========================================================================
-- A ordem importa: os caminhos dos arquivos são derivados dos blocos e dos
-- cursos. Apagando as linhas primeiro, não há mais como descobrir quais
-- arquivos pertenciam a eles — e eles ficam órfãos para sempre, ocupando cota
-- e inacessíveis (pode_acessar_material não acha o bloco e nega tudo).

begin;

with alvo as (
  select unnest(array[
    '00000000-0000-0000-0000-000000000000'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid
  ]) as curso_id
),
-- materiais: o path começa pelo id do BLOCO
blocos as (
  select b.id::text as prefixo
  from bloco b
  join modulo mo on mo.id = b.modulo_id
  join alvo a on a.curso_id = mo.curso_id
  where b.tipo = 'material'
)
delete from storage.objects o
where o.bucket_id = 'materiais'
  and split_part(o.name, '/', 1) in (select prefixo from blocos);

-- capas: o path começa pelo id do CURSO
with alvo as (
  select unnest(array[
    '00000000-0000-0000-0000-000000000000'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid
  ]) as curso_id
)
delete from storage.objects o
where o.bucket_id = 'capas'
  and split_part(o.name, '/', 1) in (select curso_id::text from alvo);

commit;

-- ===========================================================================
-- ETAPA 4 — Apagar
-- ===========================================================================
-- `delete from curso` basta: a cascata do schema derruba turma, matrícula,
-- certificado, progresso_bloco, ajuste_nota, encontro e presenca. Apagar
-- tabela por tabela seria mais linhas e mais chance de esquecer uma — e a
-- `presenca`, que é recente, é justamente a que se esqueceria.
--
-- O begin/commit garante tudo ou nada: se algo falhar no meio, nada é apagado
-- e você não fica com metade do banco.

begin;

delete from curso
where id in (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111'
);

commit;

-- ===========================================================================
-- ETAPA 5 — Conferir
-- ===========================================================================

select 'cursos' as tabela, count(*) from curso
union all select 'turmas',       count(*) from turma
union all select 'matriculas',   count(*) from matricula
union all select 'certificados', count(*) from certificado
union all select 'encontros',    count(*) from encontro
union all select 'presencas',    count(*) from presenca;

-- Nenhum arquivo órfão deve ter sobrado. Se estas duas devolverem linhas,
-- a etapa 3 não pegou tudo e o resto precisa ser removido pelo painel
-- (Storage -> materiais / capas).

select o.name, o.bucket_id
from storage.objects o
where o.bucket_id = 'materiais'
  and split_part(o.name, '/', 1) not in (select id::text from bloco);

select o.name, o.bucket_id
from storage.objects o
where o.bucket_id = 'capas'
  and split_part(o.name, '/', 1) not in (select id::text from curso);
