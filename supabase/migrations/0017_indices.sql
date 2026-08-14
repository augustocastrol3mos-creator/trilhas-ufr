-- 0017_indices.sql
--
-- O Postgres cria índice automaticamente para PRIMARY KEY e para UNIQUE.
-- Para FOREIGN KEY, NÃO cria — é um mal-entendido comum, porque vários outros
-- bancos criam. O resultado é que consultar "todas as matrículas desta turma"
-- varre a tabela inteira.
--
-- Com os dados de teste isso é irrelevante: varrer 20 linhas é mais rápido do
-- que consultar índice, e o planejador do Postgres sabe disso — ele vai
-- IGNORAR estes índices enquanto as tabelas forem pequenas. Não espere ganho
-- mensurável hoje. O objetivo é que a curva não vire parede quando a primeira
-- turma real com 40 alunos entrar, e depois a segunda, e a terceira.
--
-- Índices custam espaço e tornam INSERT/UPDATE marginalmente mais lentos.
-- Estes cinco valem porque são exatamente os caminhos que as telas percorrem.

-- turma_alunos, fechar_turma, encontros_da_turma, turmas_abertas: todos fazem
-- "matriculas desta turma". É a consulta mais repetida do lado do professor.
create index if not exists idx_matricula_turma on matricula (turma_id);

-- /professor/cursos filtra por autor_id; /professor filtra por instrutor_id.
-- São as telas de entrada de quem dá aula — as primeiras a doer.
create index if not exists idx_curso_autor      on curso (autor_id);
create index if not exists idx_turma_instrutor  on turma (instrutor_id);

-- analise_quiz cruza progresso por bloco. O unique (matricula_id, bloco_id)
-- já existente só ajuda quando a matrícula lidera a busca; quando a busca
-- parte do bloco, ele não serve.
create index if not exists idx_progresso_bloco  on progresso_bloco (bloco_id);

-- validar_certificado busca por codigo (já tem unique) mas a listagem da
-- coordenação e a emissão buscam por matricula_id, e o unique existente é
-- PARCIAL (where revogado_em is null), então não cobre certificado revogado.
create index if not exists idx_certificado_matricula on certificado (matricula_id);

-- Para conferir depois, quando houver volume de verdade: rodar
--   explain analyze select * from matricula where turma_id = '<uuid>';
-- e olhar se aparece "Index Scan" (usando) ou "Seq Scan" (ignorando).
-- Enquanto a tabela for pequena, "Seq Scan" é a resposta CERTA.
