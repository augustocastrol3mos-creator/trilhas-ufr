-- excluir_cursos_teste.sql
--
-- ############################################################################
-- #  NÃO É MIGRATION. Mora em supabase/scripts/ para nunca rodar por engano.  #
-- #  RODE UMA ETAPA POR VEZ — o SQL Editor do Supabase mostra apenas o        #
-- #  resultado da ÚLTIMA instrução quando você cola várias.                    #
-- ############################################################################
--
-- Remove cursos DE TESTE por completo: turmas, matrículas, progresso, presença,
-- encontros, ajustes de nota E CERTIFICADOS EMITIDOS.
--
-- Contorna de propósito a trava de `excluir_curso`, que recusa curso com
-- matrícula. A trava vive na RPC e não na tabela justamente por isso: o caminho
-- pela aplicação é protegido contra clique errado, o caminho por SQL é decisão
-- consciente de quem tem acesso ao banco.
--
-- QUANDO NÃO USAR: depois que o piloto começar. A partir dali, certificado
-- emitido é documento institucional — some daqui, some a URL pública de
-- validação, e quem tem o PDF na mão não comprova mais nada. Nesse caso o
-- caminho é ARQUIVAR.
--
-- Exclusão por SQL direto NÃO deixa registro em log_admin.


-- ===========================================================================
-- ETAPA 1 — Descobrir os id
-- ===========================================================================

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
-- ETAPA 2 — Ver o que vai ser destruído
-- ===========================================================================
-- Troque os UUID abaixo pelos da etapa 1. Quantos quiser, separados por
-- vírgula, sem vírgula depois do último. Não precisa de ::uuid: o Postgres
-- converte sozinho ao comparar com uma coluna uuid.
--
-- Use a lista de id, nunca um `like` no título — "Teste" também casa com
-- "Teste de hipóteses", e a diferença só aparece depois de apagar.

select ce.codigo, ce.nome_titular, ce.curso_titulo, u.email, ce.emitido_em
from certificado ce
join matricula m on m.id = ce.matricula_id
join turma t     on t.id = m.turma_id
join usuario u   on u.id = m.usuario_id
where t.curso_id in (
  'a6c17b53-fa0e-456f-a06d-1fafa2faf79c',
  'COLE-OUTRO-UUID-AQUI'
)
order by ce.emitido_em;


-- ===========================================================================
-- ETAPA 3 — Limpar o Storage (ANTES de apagar as linhas)
-- ===========================================================================
-- A ordem importa: o caminho de cada arquivo é derivado do bloco e do curso.
-- Apagando as linhas primeiro, não há mais como descobrir quais arquivos eram
-- deles — e ficam órfãos para sempre, ocupando cota e inacessíveis.
--
-- 3.1 materiais (o caminho começa pelo id do BLOCO)

delete from storage.objects o
where o.bucket_id = 'materiais'
  and split_part(o.name, '/', 1) in (
    select b.id::text
    from bloco b
    join modulo mo on mo.id = b.modulo_id
    where b.tipo = 'material'
      and mo.curso_id in (
        'a6c17b53-fa0e-456f-a06d-1fafa2faf79c',
        'COLE-OUTRO-UUID-AQUI'
      )
  );

-- 3.2 capas (o caminho começa pelo id do CURSO)

delete from storage.objects o
where o.bucket_id = 'capas'
  and split_part(o.name, '/', 1) in (
    'a6c17b53-fa0e-456f-a06d-1fafa2faf79c',
    'COLE-OUTRO-UUID-AQUI'
  );


-- ===========================================================================
-- ETAPA 4 — Apagar
-- ===========================================================================
-- `delete from curso` basta: a cascata do schema derruba turma, matrícula,
-- certificado, progresso_bloco, ajuste_nota, encontro e presenca. Apagar tabela
-- por tabela seria mais linhas e mais chance de esquecer uma — e a `presenca`,
-- que é recente, é justamente a que se esqueceria.

delete from curso
where id in (
  'a6c17b53-fa0e-456f-a06d-1fafa2faf79c',
  'COLE-OUTRO-UUID-AQUI'
);


-- ===========================================================================
-- ETAPA 5 — Conferir
-- ===========================================================================

select 'cursos' as tabela, count(*) from curso
union all select 'turmas',       count(*) from turma
union all select 'matriculas',   count(*) from matricula
union all select 'certificados', count(*) from certificado
union all select 'encontros',    count(*) from encontro
union all select 'presencas',    count(*) from presenca;

-- Arquivos órfãos que tenham sobrado. Se voltar linha, apague pelo painel
-- (Storage -> materiais / capas).

select o.bucket_id, o.name
from storage.objects o
where (o.bucket_id = 'materiais'
       and split_part(o.name, '/', 1) not in (select id::text from bloco))
   or (o.bucket_id = 'capas'
       and split_part(o.name, '/', 1) not in (select id::text from curso));
