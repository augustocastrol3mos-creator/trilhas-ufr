-- 0028_identidade_nome.sql
--
-- ============================ O PROBLEMA ===================================
--
-- `certificado.nome_titular` é um snapshot tirado no momento da emissão. Está
-- certo para o documento — mas significa que o nome que vale é o que estiver no
-- cadastro quando a turma fecha.
--
-- Consequência: alguém percorre três cursos, troca o nome do próprio cadastro
-- para o de outra pessoa na véspera do fechamento, e os certificados saem no
-- nome do comprador. Hoje isso é possível, é instantâneo, e NÃO DEIXA RASTRO
-- NENHUM — nem para a coordenação, nem para auditoria.
--
-- ========================= O QUE ISTO RESOLVE ==============================
--
-- 1. RASTRO. Toda alteração de nome passa a ficar registrada com valor
--    anterior, valor novo, autor, data e — o dado que realmente importa —
--    quantas matrículas a conta já tinha no momento da troca. Conta que muda
--    de nome depois de concluir cursos vira um fato consultável.
--
-- 2. ATRITO. Depois da primeira matrícula, o aluno não altera mais o próprio
--    nome: precisa pedir à coordenação, que registra a justificativa. Erro de
--    digitação continua corrigível; troca silenciosa deixa de existir.
--
-- ========================= O QUE ISTO NÃO RESOLVE ==========================
--
-- Não fecha o mercado. Quem quer vender certificado cadastra a conta já com o
-- nome do comprador desde o início, e nada aqui detecta isso. O problema de
-- fundo é a ausência de identidade: e-mail não confirmado, nome autodeclarado,
-- nenhum identificador único. A terceira camada — RGA no cadastro e impresso no
-- certificado — é decisão de produto e ainda não foi tomada.

create table if not exists historico_nome (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references usuario(id) on delete cascade,
  nome_anterior   text,
  nome_novo       text not null,
  alterado_por    uuid references usuario(id),
  matriculas_ate  int not null default 0,
  justificativa   text,
  alterado_em     timestamptz not null default now()
);

create index if not exists idx_historico_nome_usuario on historico_nome (usuario_id, alterado_em desc);

alter table historico_nome enable row level security;

-- Só a coordenação lê. O próprio dono não precisa — e o histórico é
-- instrumento de fiscalização, não de conveniência.
drop policy if exists historico_nome_leitura on historico_nome;
create policy historico_nome_leitura on historico_nome
  for select to authenticated using (e_admin());

-- ---------------------------------------------------------------------------
-- Trava + registro
-- ---------------------------------------------------------------------------

-- Substitui a função da 0010, acrescentando o terceiro campo protegido.
-- `create or replace` mantém o gatilho existente apontando para ela.
create or replace function proteger_campos_usuario()
returns trigger
language plpgsql
as $$
declare v_matriculas int;
begin
  -- auth.uid() nulo = SQL Editor ou service_role, fora do app. É o caminho da
  -- coordenação por SQL e continua liberado — mas o nome ainda é registrado.
  if auth.uid() is not null then

    if new.papel is distinct from old.papel and not e_admin() then
      raise exception 'papel so pode ser alterado pela coordenacao';
    end if;

    if new.email is distinct from old.email and not e_admin() then
      raise exception 'email so muda pelo fluxo de autenticacao';
    end if;

    if new.nome_completo is distinct from old.nome_completo and not e_admin() then
      select count(*) into v_matriculas from matricula where usuario_id = old.id;

      -- Antes da primeira matrícula, o nome é livre: a pessoa ainda está
      -- montando o cadastro e não há certificado em jogo. Depois dela, o nome
      -- passa a determinar o que sai impresso, e a alteração vira ato da
      -- coordenação.
      if v_matriculas > 0 then
        raise exception
          'seu nome nao pode ser alterado depois da primeira inscricao; peca a alteracao a coordenacao';
      end if;
    end if;
  end if;

  if new.nome_completo is distinct from old.nome_completo then
    select count(*) into v_matriculas from matricula where usuario_id = old.id;

    insert into historico_nome
      (usuario_id, nome_anterior, nome_novo, alterado_por, matriculas_ate)
    values
      (old.id, old.nome_completo, new.nome_completo, auth.uid(), coalesce(v_matriculas, 0));
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Caminho da coordenação
-- ---------------------------------------------------------------------------

create or replace function alterar_nome_usuario(
  p_usuario uuid, p_nome text, p_justificativa text
)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_nome text; v_antigo text;
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;

  v_nome := nullif(trim(coalesce(p_nome, '')), '');
  if v_nome is null then raise exception 'informe o nome'; end if;

  if length(trim(coalesce(p_justificativa, ''))) < 15 then
    raise exception 'justifique a alteracao (minimo 15 caracteres)';
  end if;

  select nome_completo into v_antigo from usuario where id = p_usuario;
  if not found then raise exception 'usuario inexistente'; end if;

  update usuario set nome_completo = v_nome where id = p_usuario;

  -- o gatilho já gravou a linha; completa com a justificativa
  update historico_nome set justificativa = p_justificativa
  where usuario_id = p_usuario
    and id = (select id from historico_nome where usuario_id = p_usuario
              order by alterado_em desc limit 1);

  insert into log_admin (acao, alvo_tipo, alvo_id, detalhe, justificativa, autor_id)
  values ('alteracao_nome', 'usuario', p_usuario,
          coalesce(v_antigo, '(vazio)') || ' -> ' || v_nome, p_justificativa, auth.uid());
end $fn$;

-- Contas cujo nome mudou DEPOIS de já terem matrícula. É a consulta que a
-- coordenação deve olhar antes de fechar turma.
create or replace function nomes_suspeitos()
returns table (
  usuario_id uuid, email text, nome_atual text,
  nome_anterior text, matriculas_ate int, alterado_em timestamptz
)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;

  return query
    select h.usuario_id, u.email, u.nome_completo,
           h.nome_anterior, h.matriculas_ate, h.alterado_em
    from historico_nome h
    join usuario u on u.id = h.usuario_id
    where h.matriculas_ate > 0
    order by h.alterado_em desc;
end $fn$;

grant execute on function
  alterar_nome_usuario(uuid, text, text), nomes_suspeitos()
to authenticated;

insert into migration_aplicada (nome) values ('0028_identidade_nome.sql')
on conflict (nome) do nothing;
