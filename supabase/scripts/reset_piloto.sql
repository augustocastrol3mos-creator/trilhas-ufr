-- reset_piloto.sql
--
-- ############################################################################
-- #  ESTE ARQUIVO NÃO É UMA MIGRATION E NÃO DEVE ESTAR EM supabase/migrations #
-- #  Ele apaga dados de propósito. Mora em supabase/scripts/ justamente para  #
-- #  nunca ser rodado por engano junto com as migrations.                     #
-- ############################################################################
--
-- PARA QUE SERVE
--
-- Zerar o conteúdo de teste antes de o grupo de extensão começar a criar os
-- cursos reais. Apaga cursos, turmas, matrículas, progresso, presença e
-- certificados. PRESERVA: schema, funções, policies, contas de usuário e a
-- tabela `configuracao`.
--
-- Não existe botão para isso na aplicação, e isso é intencional. `excluir_curso`
-- recusa qualquer curso com matrícula justamente porque apagar certificado
-- emitido quebra validação pública. Um reset geral é ato operacional, feito uma
-- vez, com o banco na frente — não uma funcionalidade que fica disponível para
-- sempre esperando um clique errado.

-- ===========================================================================
-- ETAPA 1 — ANTES DE APAGAR: veja o que vai embora
-- ===========================================================================
-- Rode isto sozinho primeiro. Confira que os números batem com "só coisa de
-- teste". Se aparecer algo que você não reconhece, PARE.

select 'cursos'        as tabela, count(*) from curso
union all select 'turmas',        count(*) from turma
union all select 'encontros',     count(*) from encontro
union all select 'matriculas',    count(*) from matricula
union all select 'progresso',     count(*) from progresso_bloco
union all select 'presencas',     count(*) from presenca
union all select 'certificados',  count(*) from certificado
union all select 'ajustes_nota',  count(*) from ajuste_nota
union all select 'log_admin',     count(*) from log_admin
union all select 'usuarios',      count(*) from usuario;

-- Liste nominalmente os certificados que serão destruídos. Se algum tiver ido
-- para a mão de uma pessoa de verdade, ele deixa de ser validável para sempre.
select c.codigo, u.nome_completo, cu.titulo, c.emitido_em
from certificado c
join matricula m on m.id = c.matricula_id
join usuario   u on u.id = m.usuario_id
join turma     t on t.id = m.turma_id
join curso    cu on cu.id = t.curso_id
order by c.emitido_em;

-- ===========================================================================
-- ETAPA 2 — O RESET
-- ===========================================================================
-- Rode o bloco inteiro de uma vez. O `begin/commit` garante tudo ou nada: se
-- algo falhar no meio, nada é apagado e você não fica com metade do banco.
--
-- `delete from curso` basta porque a cascata do schema faz o resto:
--   curso -> turma -> matricula -> certificado, progresso_bloco, ajuste_nota, presenca
--   curso -> modulo -> bloco -> progresso_bloco
--   turma -> encontro
-- Apagar tabela por tabela seria mais linhas e mais chance de esquecer uma.

begin;

delete from curso;

-- Auditoria de atos sobre cursos que não existem mais. Some junto porque o
-- histórico do piloto não tem valor institucional e só poluiria a tela de
-- auditoria de verdade.
delete from log_admin;

commit;

-- ===========================================================================
-- ETAPA 3 — O QUE O SQL NÃO APAGA
-- ===========================================================================
--
-- 3.1 ARQUIVOS DO STORAGE. Os materiais enviados são objetos no bucket
--     `materiais`, não linhas de tabela — a cascata não os alcança. Apague
--     pelo painel: Storage -> materiais -> selecionar tudo -> Delete.
--     Se não fizer, ficam arquivos órfãos consumindo cota, inacessíveis
--     (pode_acessar_material não acha o bloco e nega tudo).
--
-- 3.2 CONTAS DE USUÁRIO. Ficam intactas de propósito: você, os professores e
--     as contas de teste continuam existindo. Para apagar alguma, use
--     Authentication -> Users no painel do Supabase, NÃO `delete from usuario`.
--     A FK é usuario.id -> auth.users com cascade nessa direção; apagar só a
--     linha de `usuario` deixaria a conta do Auth viva e sem perfil, e a pessoa
--     entraria num app quebrado.

-- ===========================================================================
-- ETAPA 4 — DEPOIS DO RESET, ANTES DO CONTEÚDO REAL
-- ===========================================================================

-- 4.1 A configuração que vai impressa no certificado. O default de url_base é
--     'http://localhost:3000' — com ele, o QR code de todo certificado aponta
--     para a máquina de quem abrir, ou seja, para lugar nenhum.

select * from configuracao;

-- Ajuste com os dados reais antes de qualquer emissão:
--
-- update configuracao set
--   url_base        = 'https://trilhas-ufr-chi.vercel.app',
--   instituicao_nome= 'Universidade Federal de Rondonópolis',
--   orgao_emissor   = '<nome exato do órgão, como a PROEX quer que apareça>',
--   assinante_nome  = '<nome da pessoa que assina>',
--   assinante_cargo = '<cargo dela>'
-- where id;

-- 4.2 Confirmação de e-mail: religar em Authentication -> Providers -> Email.
--     Enquanto está desligada, qualquer pessoa se cadastra com qualquer
--     endereço, e `nome_completo` vem do que ela mesma digitou — ou seja, o
--     nome impresso no certificado é autodeclarado e não verificado.
--     Com gente real emitindo documento institucional, isso deixa de ser
--     conveniência de teste e vira problema.

-- 4.3 Confira que o banco está completo antes de entregar para o grupo:
select nome, aplicada_em from migration_aplicada order by nome;
-- Devem aparecer 21 linhas (0001 a 0021).
