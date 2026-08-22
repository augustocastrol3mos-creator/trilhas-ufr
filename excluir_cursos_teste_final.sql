-- excluir_cursos_teste.sql
--
-- ############################################################################
-- #  NÃO É MIGRATION. Mora em supabase/scripts/ para nunca rodar por engano   #
-- #  junto com as migrations.                                                  #
-- ############################################################################
--
-- Remove cursos DE TESTE por completo: turmas, matrículas, progresso, presença,
-- encontros, ajustes de nota E CERTIFICADOS EMITIDOS.
--
-- Contorna de propósito a trava de `excluir_curso`, que recusa curso com
-- matrícula. A trava vive na RPC e não na tabela justamente por isso: o caminho
-- pela aplicação é protegido contra clique errado; o caminho por SQL é decisão
-- consciente de quem tem acesso ao banco.
--
-- ===========================================================================
-- QUANDO NÃO USAR
-- ===========================================================================
-- Depois que o piloto começar. A partir dali, certificado emitido é documento
-- institucional: some daqui, some a URL pública de validação, e quem tem o PDF
-- na mão não consegue mais comprovar nada. Nesse caso o caminho é ARQUIVAR —
-- tira do catálogo, preserva tudo, fica registrado e é reversível.
--
-- Exclusão por SQL direto NÃO deixa registro em log_admin. A auditoria da
-- coordenação não saberá que estes cursos existiram.
--
-- ===========================================================================
-- DUAS COISAS QUE CUSTARAM TENTATIVAS ATÉ ACERTAR
-- ===========================================================================
--
-- 1. RODE UMA INSTRUÇÃO POR VEZ, E SEM NADA SELECIONADO NO EDITOR.
--    O SQL Editor do Supabase executa apenas o TRECHO SELECIONADO quando há
--    seleção ativa — e mostra só o resultado da última instrução quando você
--    cola várias. Selecionar meio comando numa consulta é chato; num `delete`
--    pode ser irreversível. Clique numa área vazia antes de apertar Run.
--
-- 2. NÃO DÁ PARA APAGAR ARQUIVO POR SQL.
--    `delete from storage.objects` é bloqueado pelo Supabase:
--       "Direct deletion from storage tables is not allowed."
--    E a proteção está certa — aquela tabela é só o REGISTRO do arquivo; o
--    arquivo em si vive no armazenamento de objetos. Apagar a linha deixaria o
--    arquivo lá para sempre, invisível e ocupando cota. Exatamente o oposto do
--    que se queria.
--
--    Por isso a ordem aqui é: apagar os cursos PRIMEIRO, e depois pedir ao
--    banco que aponte os arquivos que ficaram sem dono. É mais confiável do que
--    tentar prever quais arquivos pertenciam a quê.


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
-- ETAPA 2 — Ver nominalmente o que vai ser destruído
-- ===========================================================================
-- Troque a lista de UUID abaixo. Quantos quiser, separados por vírgula, sem
-- vírgula depois do último. Não precisa de ::uuid — o Postgres converte sozinho
-- ao comparar com uma coluna uuid, e cada cast é mais um lugar para errar.
--
-- Use a lista de id, NUNCA um `like` no título: "Teste" também casa com
-- "Teste de hipóteses", e a diferença só aparece depois de apagar.
--
-- Se aparecer aqui o nome de uma pessoa real com certificado que importa, PARE.

select ce.codigo, ce.nome_titular, ce.curso_titulo, u.email, ce.emitido_em
from certificado ce
join matricula m on m.id = ce.matricula_id
join turma t     on t.id = m.turma_id
join usuario u   on u.id = m.usuario_id
where t.curso_id in ('COLE-OS-UUID-AQUI')
order by ce.emitido_em;


-- ===========================================================================
-- ETAPA 3 — Apagar
-- ===========================================================================
-- `delete from curso` basta: a cascata do schema derruba turma, matrícula,
-- certificado, progresso_bloco, ajuste_nota, encontro e presenca. Apagar tabela
-- por tabela seria mais linhas e mais chance de esquecer uma — e a `presenca`,
-- que é das últimas migrations, é justamente a que se esqueceria.

delete from curso
where id in ('COLE-OS-UUID-AQUI');


-- ===========================================================================
-- ETAPA 4 — Descobrir os arquivos órfãos
-- ===========================================================================
-- Roda DEPOIS da exclusão, e é por isso que funciona: o prefixo do caminho de
-- cada arquivo (id do bloco em `materiais`, id do curso em `capas`) deixou de
-- existir nas tabelas, então o próprio banco aponta o que ficou sem dono.

select o.bucket_id, o.name
from storage.objects o
where (o.bucket_id = 'materiais'
       and split_part(o.name, '/', 1) not in (select id::text from bloco))
   or (o.bucket_id = 'capas'
       and split_part(o.name, '/', 1) not in (select id::text from curso));


-- ===========================================================================
-- ETAPA 5 — Apagar os arquivos pelo painel
-- ===========================================================================
-- Supabase -> Storage -> bucket `materiais` -> entrar nas pastas cujos nomes
-- apareceram na etapa 4 -> selecionar -> Delete. Depois o mesmo em `capas`.
--
-- Rode a etapa 4 de novo no fim: deve voltar zero linhas.
--
-- Se sobrar algum órfão, não é grave: ele fica inacessível de qualquer forma,
-- porque `pode_acessar_material` deriva a autorização do id do bloco e, sem
-- bloco, nega tudo. O custo é só cota. Mas vale limpar enquanto são poucos
-- arquivos, em vez de acumular até ninguém saber mais o que era de quê.


-- ===========================================================================
-- ETAPA 6 — Conferir
-- ===========================================================================

select 'cursos' as tabela, count(*) from curso
union all select 'turmas',       count(*) from turma
union all select 'matriculas',   count(*) from matricula
union all select 'certificados', count(*) from certificado
union all select 'encontros',    count(*) from encontro
union all select 'presencas',    count(*) from presenca;
