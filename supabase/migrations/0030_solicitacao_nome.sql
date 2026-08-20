-- 0030_solicitacao_nome.sql
--
-- Substitui a abordagem da 0028/0029 (deixar alterar e detectar depois) por
-- solicitação com aprovação da coordenação.
--
-- POR QUE A TROCA
--
-- Detecção produz uma tela que lista pessoas cujo nome mudou. Por mais neutro
-- que seja o rótulo, o artefato existe para levantar suspeita — e a esmagadora
-- maioria das linhas ali teria explicação inocente: erro de digitação, nome
-- social, nome de casada, sobrenome que faltava. Uma ferramenta que rotula
-- gente inocente para pegar um caso raro é um mau negócio, e a decisão de
-- construí-la ou não é institucional, não técnica.
--
-- Com aprovação prévia, o problema simplesmente não acontece: a alteração
-- indevida não chega a existir, não há o que descobrir depois, e o aluno com
-- erro de digitação ganha um caminho próprio em vez de precisar procurar
-- alguém por fora do sistema.
--
-- Antes da primeira matrícula o nome continua livre — não há certificado em
-- jogo e obrigar aprovação ali seria burocracia sem finalidade.

drop function if exists alteracoes_de_nome_apos_matricula();

create table if not exists solicitacao_nome (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references usuario(id) on delete cascade,
  nome_atual      text not null,
  nome_solicitado text not null,
  motivo          text not null,
  status          text not null default 'pendente'
                  check (status in ('pendente', 'aprovada', 'recusada')),
  resposta        text,
  decidido_por    uuid references usuario(id),
  decidido_em     timestamptz,
  criado_em       timestamptz not null default now()
);

create index if not exists idx_solicitacao_nome_status
  on solicitacao_nome (status, criado_em desc);

-- Uma solicitação pendente por pessoa. Sem isto, dá para empilhar pedidos e a
-- coordenação decide sobre um estado que já mudou.
create unique index if not exists idx_solicitacao_nome_pendente
  on solicitacao_nome (usuario_id) where status = 'pendente';

alter table solicitacao_nome enable row level security;

drop policy if exists solicitacao_nome_leitura on solicitacao_nome;
create policy solicitacao_nome_leitura on solicitacao_nome
  for select to authenticated
  using (usuario_id = auth.uid() or e_admin());

-- ---------------------------------------------------------------------------
-- Aluno solicita
-- ---------------------------------------------------------------------------

create or replace function solicitar_alteracao_nome(p_nome text, p_motivo text)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_id uuid; v_nome text; v_atual text;
begin
  if auth.uid() is null then raise exception 'nao autenticado'; end if;

  v_nome := nullif(trim(coalesce(p_nome, '')), '');
  if v_nome is null then raise exception 'informe o nome desejado'; end if;

  if length(trim(coalesce(p_motivo, ''))) < 10 then
    raise exception 'explique o motivo da correcao (minimo 10 caracteres)';
  end if;

  select nome_completo into v_atual from usuario where id = auth.uid();

  if trim(coalesce(v_atual, '')) = v_nome then
    raise exception 'o nome solicitado e igual ao atual';
  end if;

  if exists (select 1 from solicitacao_nome s
             where s.usuario_id = auth.uid() and s.status = 'pendente') then
    raise exception 'voce ja tem uma solicitacao aguardando analise';
  end if;

  insert into solicitacao_nome (usuario_id, nome_atual, nome_solicitado, motivo)
  values (auth.uid(), coalesce(v_atual, ''), v_nome, trim(p_motivo))
  returning id into v_id;

  return v_id;
end $fn$;

create or replace function cancelar_solicitacao_nome(p_solicitacao uuid)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  delete from solicitacao_nome
  where id = p_solicitacao and usuario_id = auth.uid() and status = 'pendente';
end $fn$;

-- A própria solicitação do usuário, para a tela de perfil mostrar o andamento.
create or replace function minha_solicitacao_nome()
returns jsonb language sql stable security definer set search_path = public as $fn$
  select to_jsonb(s) from solicitacao_nome s
  where s.usuario_id = auth.uid()
  order by s.criado_em desc limit 1;
$fn$;

-- ---------------------------------------------------------------------------
-- Coordenação decide
-- ---------------------------------------------------------------------------

create or replace function decidir_solicitacao_nome(
  p_solicitacao uuid, p_aprovar boolean, p_resposta text
)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_sol solicitacao_nome%rowtype;
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;

  select * into v_sol from solicitacao_nome where id = p_solicitacao;
  if v_sol.id is null then raise exception 'solicitacao inexistente'; end if;
  if v_sol.status <> 'pendente' then raise exception 'solicitacao ja decidida'; end if;

  if not p_aprovar and length(trim(coalesce(p_resposta, ''))) < 10 then
    raise exception 'ao recusar, explique o motivo para o aluno';
  end if;

  update solicitacao_nome set
    status = case when p_aprovar then 'aprovada' else 'recusada' end,
    resposta = nullif(trim(coalesce(p_resposta, '')), ''),
    decidido_por = auth.uid(),
    decidido_em = now()
  where id = p_solicitacao;

  if p_aprovar then
    -- Quem executa é a coordenação, então o gatilho de proteção libera; e é ele
    -- que grava a linha em historico_nome, sem duplicação aqui.
    update usuario set nome_completo = v_sol.nome_solicitado where id = v_sol.usuario_id;

    insert into log_admin (acao, alvo_tipo, alvo_id, detalhe, justificativa, autor_id)
    values ('alteracao_nome', 'usuario', v_sol.usuario_id,
            v_sol.nome_atual || ' -> ' || v_sol.nome_solicitado,
            v_sol.motivo, auth.uid());
  end if;
end $fn$;

create or replace function solicitacoes_nome()
returns table (
  id uuid, usuario_id uuid, email text, rga text,
  nome_atual text, nome_solicitado text, motivo text,
  status text, resposta text, criado_em timestamptz, decidido_em timestamptz,
  matriculas int, certificados int
)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;

  return query
    select s.id, s.usuario_id, u.email, u.rga,
           s.nome_atual, s.nome_solicitado, s.motivo,
           s.status, s.resposta, s.criado_em, s.decidido_em,
           (select count(*)::int from matricula m where m.usuario_id = s.usuario_id),
           (select count(*)::int from certificado c
              join matricula m on m.id = c.matricula_id
              where m.usuario_id = s.usuario_id and c.revogado_em is null)
    from solicitacao_nome s
    join usuario u on u.id = s.usuario_id
    order by (s.status = 'pendente') desc, s.criado_em desc;
end $fn$;

grant execute on function
  solicitar_alteracao_nome(text, text), cancelar_solicitacao_nome(uuid),
  minha_solicitacao_nome(), decidir_solicitacao_nome(uuid, boolean, text),
  solicitacoes_nome()
to authenticated;

-- ---------------------------------------------------------------------------
-- RGA sem máscara na validação pública
-- ---------------------------------------------------------------------------

-- O RGA não é segredo: alunos veem o dos colegas rotineiramente, e ele sozinho
-- não autentica nada. Mascarar na validação enquanto o número sai inteiro no
-- certificado impresso era incoerente e atrapalhava justamente quem confere.

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

insert into migration_aplicada (nome) values ('0030_solicitacao_nome.sql')
on conflict (nome) do nothing;
