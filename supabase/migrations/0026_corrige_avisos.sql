-- 0026_corrige_avisos.sql
--
-- CORREÇÃO de um defeito da 0025: os avisos nunca apareciam para ninguém.
--
-- A CAUSA
--
-- Em `returns table (id uuid, titulo text, ...)`, os nomes das colunas de
-- retorno viram VARIÁVEIS em escopo no corpo inteiro da função. Então, nesta
-- linha do corpo:
--
--     select papel into v_papel from usuario where id = auth.uid();
--
-- o `id` não era `usuario.id` — era a variável de saída `id`, nula. O Postgres
-- acusa "column reference id is ambiguous" e a função erra. Como o layout
-- ignorava o erro da RPC, o resultado era uma lista vazia e nenhum aviso na
-- tela, sem mensagem nenhuma.
--
-- `avisos_todos()` não tinha o problema porque qualifica tudo com `a.` — por
-- isso o aviso aparecia normalmente na tela da coordenação. Sintoma exato do
-- que foi relatado: publica, lista lá, não aparece em lugar nenhum.
--
-- A LIÇÃO, para as próximas funções deste projeto:
--
--   Em função com `returns table` ou parâmetros OUT, TODA referência a coluna
--   no corpo precisa ser qualificada com o alias da tabela. Não é preferência
--   de estilo: sem alias, o nome resolve para a variável, e o comportamento
--   varia entre erro e valor nulo silencioso conforme o caso.
--
-- Some-se a isso um agravante meu no lado do código: engolir o erro da RPC
-- transformou um erro explícito do banco em tela vazia. Erro que não aparece
-- custa muito mais caro para achar do que erro que quebra a página.

create or replace function meus_avisos()
returns table (id uuid, titulo text, mensagem text, tipo text)
language plpgsql stable security definer set search_path = public as $fn$
declare v_papel text;
begin
  -- `u.id`, não `id`: sem o alias, resolve para a variável de saída.
  select u.papel::text into v_papel from usuario u where u.id = auth.uid();
  if v_papel is null then return; end if;

  return query
    select a.id, a.titulo, a.mensagem, a.tipo
    from aviso a
    where (a.inicio_em is null or a.inicio_em <= now())
      and (a.fim_em    is null or a.fim_em    >= now())
      and (
        a.publico = 'todos'
        or (a.publico = 'alunos'      and v_papel = 'aluno')
        or (a.publico = 'instrutores' and v_papel in ('instrutor', 'admin'))
      )
    order by
      case a.tipo when 'urgente' then 0 when 'atencao' then 1 else 2 end,
      a.criado_em desc
    limit 3;
end $fn$;

grant execute on function meus_avisos() to authenticated;

-- ---------------------------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------------------------

-- Rode trocando o UUID por uma conta sua. Deve devolver os avisos vigentes
-- para o papel dessa conta. Antes desta migration, devolvia erro.
--
--   begin;
--   set local role authenticated;
--   set local "request.jwt.claims" = '{"sub":"UUID_DA_CONTA","role":"authenticated"}';
--   select * from meus_avisos();
--   rollback;

insert into migration_aplicada (nome) values ('0026_corrige_avisos.sql')
on conflict (nome) do nothing;
