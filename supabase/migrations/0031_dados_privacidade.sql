-- 0031_dados_privacidade.sql
--
-- Generaliza a solicitação da 0030 para cobrir NOME e RGA, e destrava a troca
-- de e-mail pelo fluxo de autenticação.
--
-- POR QUE O RGA TAMBÉM PRECISA DE UM CAMINHO
--
-- A 0029 travou o RGA depois da primeira matrícula tratando-o como imutável.
-- Está errado: aluno que tranca e retorna, ou que conclui um curso e ingressa
-- em outro na UFR, RECEBE MATRÍCULA NOVA. Sem caminho de correção, a conta
-- ficaria presa a um número que não é mais dele — e o problema seria o oposto
-- do que a trava pretendia evitar.
--
-- Mudança de RGA é legítima e frequente o bastante para ter fluxo próprio, e
-- rara o bastante para passar por aprovação.
--
-- DESENHO: uma solicitação pode pedir nome, RGA ou os dois. Campo nulo
-- significa "não mexer". Separar em duas tabelas duplicaria todo o fluxo de
-- aprovação para ganhar nada.

-- ---------------------------------------------------------------------------
-- 1. Tabela generalizada
-- ---------------------------------------------------------------------------

create table if not exists solicitacao_dado (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references usuario(id) on delete cascade,
  nome_atual      text,
  nome_solicitado text,
  rga_atual       text,
  rga_solicitado  text,
  motivo          text not null,
  status          text not null default 'pendente'
                  check (status in ('pendente', 'aprovada', 'recusada')),
  resposta        text,
  decidido_por    uuid references usuario(id),
  decidido_em     timestamptz,
  criado_em       timestamptz not null default now(),

  constraint pede_alguma_coisa
    check (nome_solicitado is not null or rga_solicitado is not null)
);

create index if not exists idx_solicitacao_dado_status
  on solicitacao_dado (status, criado_em desc);

create unique index if not exists idx_solicitacao_dado_pendente
  on solicitacao_dado (usuario_id) where status = 'pendente';

alter table solicitacao_dado enable row level security;

drop policy if exists solicitacao_dado_leitura on solicitacao_dado;
create policy solicitacao_dado_leitura on solicitacao_dado
  for select to authenticated
  using (usuario_id = auth.uid() or e_admin());

-- Traz o que já existia da 0030 — SE ela chegou a rodar.
--
-- A 0030 cria uma tabela que esta migration apaga logo em seguida, então é
-- razoável que ninguém a tenha rodado. Depender dela era defeito de desenho:
-- migration não pode exigir que uma etapa intermediária tenha existido.
-- `to_regclass` devolve nulo quando a relação não existe, sem erro.
do $$
begin
  if to_regclass('public.solicitacao_nome') is not null then
    insert into solicitacao_dado
      (id, usuario_id, nome_atual, nome_solicitado, motivo, status, resposta,
       decidido_por, decidido_em, criado_em)
    select id, usuario_id, nome_atual, nome_solicitado, motivo, status, resposta,
           decidido_por, decidido_em, criado_em
    from solicitacao_nome
    on conflict (id) do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. E-mail: o espelho passa a poder acompanhar a fonte
-- ---------------------------------------------------------------------------

-- `usuario.email` é cópia de `auth.users.email`. A 0010 proibiu qualquer
-- alteração dele fora da coordenação, o que também impedia o espelho de
-- acompanhar a troca legítima feita pelo próprio usuário no fluxo de Auth.
--
-- A regra fica melhor assim: o espelho pode mudar, DESDE QUE passe a valer o
-- que a fonte diz. Continua sem existir caminho para digitar um e-mail
-- arbitrário — só para sincronizar com o que o Supabase Auth já confirmou.

create or replace function proteger_campos_usuario()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare v_matriculas int; v_email_auth text;
begin
  select count(*) into v_matriculas from matricula where usuario_id = old.id;

  if auth.uid() is not null then
    if new.papel is distinct from old.papel and not e_admin() then
      raise exception 'papel so pode ser alterado pela coordenacao';
    end if;

    if new.email is distinct from old.email and not e_admin() then
      select email into v_email_auth from auth.users where id = old.id;
      if new.email is distinct from v_email_auth then
        raise exception 'email so muda pelo fluxo de autenticacao';
      end if;
    end if;

    if new.nome_completo is distinct from old.nome_completo
       and not e_admin() and v_matriculas > 0 then
      raise exception
        'seu nome nao pode ser alterado depois da primeira inscricao; solicite a correcao';
    end if;

    if new.rga is distinct from old.rga and not e_admin() and v_matriculas > 0 then
      raise exception
        'seu RGA nao pode ser alterado depois da primeira inscricao; solicite a correcao';
    end if;
  end if;

  if new.nome_completo is distinct from old.nome_completo then
    insert into historico_nome
      (usuario_id, nome_anterior, nome_novo, alterado_por, matriculas_ate)
    values
      (old.id, old.nome_completo, new.nome_completo, auth.uid(), coalesce(v_matriculas, 0));
  end if;

  return new;
end;
$$;

-- Mantém o espelho em dia quando o usuário confirma o novo e-mail no Auth.
create or replace function sincronizar_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update usuario set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_sincronizar_email on auth.users;
create trigger trg_sincronizar_email
  after update of email on auth.users
  for each row execute function sincronizar_email();

-- ---------------------------------------------------------------------------
-- 3. Solicitar
-- ---------------------------------------------------------------------------

create or replace function solicitar_alteracao_dados(
  p_nome text, p_rga text, p_motivo text
)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_id uuid; v_nome text; v_rga text;
  v_nome_atual text; v_rga_atual text;
begin
  if auth.uid() is null then raise exception 'nao autenticado'; end if;

  select nome_completo, rga into v_nome_atual, v_rga_atual
  from usuario where id = auth.uid();

  -- nulo = não mexer neste campo
  v_nome := nullif(trim(coalesce(p_nome, '')), '');
  v_rga  := nullif(trim(coalesce(p_rga, '')), '');

  if v_nome is not distinct from v_nome_atual then v_nome := null; end if;
  if v_rga  is not distinct from v_rga_atual  then v_rga  := null; end if;

  if v_nome is null and v_rga is null then
    raise exception 'nada mudou em relacao aos dados atuais';
  end if;

  if v_rga is not null and not rga_valido(v_rga) then
    raise exception 'RGA deve ter 12 digitos, comecando pelo ano (ex: 202300000000)';
  end if;

  if v_rga is not null and exists (
    select 1 from usuario u where u.rga = v_rga and u.id <> auth.uid()
  ) then
    raise exception 'este RGA ja esta vinculado a outra conta';
  end if;

  if length(trim(coalesce(p_motivo, ''))) < 10 then
    raise exception 'explique o motivo da correcao (minimo 10 caracteres)';
  end if;

  if exists (select 1 from solicitacao_dado s
             where s.usuario_id = auth.uid() and s.status = 'pendente') then
    raise exception 'voce ja tem uma solicitacao aguardando analise';
  end if;

  insert into solicitacao_dado
    (usuario_id, nome_atual, nome_solicitado, rga_atual, rga_solicitado, motivo)
  values
    (auth.uid(), v_nome_atual, v_nome, v_rga_atual, v_rga, trim(p_motivo))
  returning id into v_id;

  return v_id;
end $fn$;

create or replace function cancelar_solicitacao_dados(p_solicitacao uuid)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  delete from solicitacao_dado
  where id = p_solicitacao and usuario_id = auth.uid() and status = 'pendente';
end $fn$;

create or replace function minha_solicitacao_dados()
returns jsonb language sql stable security definer set search_path = public as $fn$
  select to_jsonb(s) from solicitacao_dado s
  where s.usuario_id = auth.uid()
  order by s.criado_em desc limit 1;
$fn$;

-- ---------------------------------------------------------------------------
-- 4. Decidir
-- ---------------------------------------------------------------------------

create or replace function decidir_solicitacao_dados(
  p_solicitacao uuid, p_aprovar boolean, p_resposta text
)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_sol solicitacao_dado%rowtype; v_detalhe text := '';
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;

  select * into v_sol from solicitacao_dado where id = p_solicitacao;
  if v_sol.id is null then raise exception 'solicitacao inexistente'; end if;
  if v_sol.status <> 'pendente' then raise exception 'solicitacao ja decidida'; end if;

  if not p_aprovar and length(trim(coalesce(p_resposta, ''))) < 10 then
    raise exception 'ao recusar, explique o motivo para o aluno';
  end if;

  update solicitacao_dado set
    status = case when p_aprovar then 'aprovada' else 'recusada' end,
    resposta = nullif(trim(coalesce(p_resposta, '')), ''),
    decidido_por = auth.uid(),
    decidido_em = now()
  where id = p_solicitacao;

  if p_aprovar then
    -- Quem executa é a coordenação, então o gatilho de proteção libera. É ele
    -- que grava historico_nome, sem duplicação aqui.
    update usuario set
      nome_completo = coalesce(v_sol.nome_solicitado, nome_completo),
      rga           = coalesce(v_sol.rga_solicitado, rga)
    where id = v_sol.usuario_id;

    if v_sol.nome_solicitado is not null then
      v_detalhe := 'nome: ' || coalesce(v_sol.nome_atual, '(vazio)')
                   || ' -> ' || v_sol.nome_solicitado;
    end if;
    if v_sol.rga_solicitado is not null then
      v_detalhe := trim(both '; ' from v_detalhe || '; RGA: '
                   || coalesce(v_sol.rga_atual, '(vazio)') || ' -> ' || v_sol.rga_solicitado);
    end if;

    insert into log_admin (acao, alvo_tipo, alvo_id, detalhe, justificativa, autor_id)
    values ('alteracao_dados', 'usuario', v_sol.usuario_id,
            v_detalhe, v_sol.motivo, auth.uid());
  end if;
end $fn$;

create or replace function solicitacoes_dados()
returns table (
  id uuid, usuario_id uuid, email text,
  nome_atual text, nome_solicitado text,
  rga_atual text, rga_solicitado text, motivo text,
  status text, resposta text, criado_em timestamptz, decidido_em timestamptz,
  matriculas int, certificados int
)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;

  return query
    select s.id, s.usuario_id, u.email,
           s.nome_atual, s.nome_solicitado, s.rga_atual, s.rga_solicitado, s.motivo,
           s.status, s.resposta, s.criado_em, s.decidido_em,
           (select count(*)::int from matricula m where m.usuario_id = s.usuario_id),
           (select count(*)::int from certificado c
              join matricula m on m.id = c.matricula_id
              where m.usuario_id = s.usuario_id and c.revogado_em is null)
    from solicitacao_dado s
    join usuario u on u.id = s.usuario_id
    order by (s.status = 'pendente') desc, s.criado_em desc;
end $fn$;

grant execute on function
  solicitar_alteracao_dados(text, text, text), cancelar_solicitacao_dados(uuid),
  minha_solicitacao_dados(), decidir_solicitacao_dados(uuid, boolean, text),
  solicitacoes_dados()
to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Aposenta as funções específicas de nome
-- ---------------------------------------------------------------------------

drop function if exists solicitar_alteracao_nome(text, text);
drop function if exists cancelar_solicitacao_nome(uuid);
drop function if exists minha_solicitacao_nome();
drop function if exists decidir_solicitacao_nome(uuid, boolean, text);
drop function if exists solicitacoes_nome();
drop table if exists solicitacao_nome;


-- ---------------------------------------------------------------------------
-- 6. O que a 0030 faria, absorvido aqui
-- ---------------------------------------------------------------------------

-- Como a 0030 deixa de ser necessária, o que ela tinha de útil vem para cá:
-- remover a tela de detecção e devolver o RGA inteiro na validação pública.

-- A função que listava "quem mudou de nome" sai de cena. Detecção foi
-- substituída por aprovação prévia: a alteração indevida não chega a existir,
-- e nenhuma tela precisa rotular ninguém.
drop function if exists alteracoes_de_nome_apos_matricula();
drop function if exists nomes_suspeitos();

-- O RGA não é segredo: alunos veem o dos colegas rotineiramente e ele sozinho
-- não autentica nada. Mascarar na validação enquanto o número sai inteiro no
-- certificado impresso era incoerente e atrapalhava quem confere.
drop function if exists mascarar_rga(text);

create or replace function validar_certificado(p_codigo text)
returns jsonb language sql stable security definer set search_path = public as $fn$
  select jsonb_build_object(
    'codigo', c.codigo,
    'valido', c.revogado_em is null,
    'revogadoEm', c.revogado_em,
    'revogadoMotivo', c.revogado_motivo,
    'nomeTitular', c.nome_titular,
    'rgaTitular', c.rga_titular,
    'cursoTitulo', c.curso_titulo,
    'cargaHoraria', c.carga_horaria,
    'modalidade', c.modalidade,
    'periodoInicio', c.periodo_inicio,
    'periodoFim', c.periodo_fim,
    'notaFinal', c.nota_final,
    'emitidoEm', c.emitido_em,
    'registroProex', c.registro_proex,
    'instituicao', cfg.instituicao_nome
  )
  from certificado c, configuracao cfg
  where upper(c.codigo) = upper(trim(p_codigo)) and cfg.id;
$fn$;

grant execute on function validar_certificado(text) to anon, authenticated;

insert into migration_aplicada (nome) values ('0031_dados_privacidade.sql')
on conflict (nome) do nothing;

-- A 0030 foi absorvida por esta e não precisa ser executada. Registrada para o
-- inventário de migrations não ficar com um buraco inexplicável.
insert into migration_aplicada (nome)
values ('0030_solicitacao_nome.sql (absorvida pela 0031)')
on conflict (nome) do nothing;
