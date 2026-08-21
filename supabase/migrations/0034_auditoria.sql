-- 0034_auditoria.sql
--
-- Corrige dois defeitos meus na gravação da auditoria.
--
-- 1) `alvo_id` era `uuid not null`, mas nem todo ato administrativo tem um
--    alvo com id. Alterar a configuração institucional é um deles: é uma linha
--    única de tabela, não um curso nem um usuário. A tentativa de gravar null
--    ali derrubava o salvamento inteiro, com uma mensagem de banco na cara da
--    coordenação — que não tem como saber o que é uma not-null constraint.
--
--    A coluna passa a aceitar null. É o modelo correto: "qual objeto foi
--    afetado" é uma pergunta que nem sempre tem resposta.
--
-- 2) Eu vinha gravando `alvo_tipo = 'curso'` para categoria, aviso e
--    configuração, porque não conferi os valores esperados quando escrevi
--    aquelas funções. A tela de auditoria é ferramenta de fiscalização de longo
--    prazo — rótulo errado ali significa alguém, daqui a dois anos, procurando
--    um curso que nunca existiu.

alter table log_admin alter column alvo_id drop not null;

comment on column log_admin.alvo_id is
  'Objeto afetado, quando existe. Nulo em atos sem alvo específico, como alterar a configuração institucional.';

comment on column log_admin.alvo_tipo is
  'usuario | curso | certificado | turma | categoria | aviso | configuracao';

create or replace function atualizar_configuracao(p_dados jsonb)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_url text;
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;

  v_url := nullif(trim(coalesce(p_dados->>'urlBase', '')), '');

  if v_url is not null then
    if v_url !~ '^https?://' then
      raise exception 'o endereco de validacao precisa comecar com https://';
    end if;
    if v_url ~* 'localhost|127\.0\.0\.1' then
      raise exception 'o endereco de validacao nao pode ser localhost: o QR code do certificado ficaria inutil fora da sua maquina';
    end if;
    v_url := rtrim(v_url, '/');
  end if;

  update configuracao set
    instituicao_nome  = coalesce(nullif(trim(coalesce(p_dados->>'instituicaoNome','')), ''), instituicao_nome),
    instituicao_sigla = coalesce(nullif(trim(coalesce(p_dados->>'instituicaoSigla','')), ''), instituicao_sigla),
    orgao_emissor     = coalesce(nullif(trim(coalesce(p_dados->>'orgaoEmissor','')), ''), orgao_emissor),
    assinante_nome    = coalesce(nullif(trim(coalesce(p_dados->>'assinanteNome','')), ''), assinante_nome),
    assinante_cargo   = coalesce(nullif(trim(coalesce(p_dados->>'assinanteCargo','')), ''), assinante_cargo),
    url_base          = coalesce(v_url, url_base),
    url_ac_facil      = nullif(trim(coalesce(p_dados->>'urlAcFacil','')), ''),
    rotulo_ac_facil   = nullif(trim(coalesce(p_dados->>'rotuloAcFacil','')), '')
  where id;

  insert into log_admin (acao, alvo_tipo, alvo_id, detalhe, autor_id)
  values ('configuracao', 'configuracao', null,
          'configuracao institucional alterada', auth.uid());
end $fn$;

create or replace function criar_categoria(p_nome text, p_descricao text default null)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_id uuid; v_nome text; v_slug text; v_ordem int;
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;

  v_nome := nullif(trim(coalesce(p_nome, '')), '');
  if v_nome is null then raise exception 'informe o nome da categoria'; end if;

  v_slug := gerar_slug_categoria(v_nome);
  if v_slug = '' then raise exception 'nome invalido para gerar endereco'; end if;

  if exists (select 1 from categoria where slug = v_slug) then
    raise exception 'ja existe uma categoria equivalente a "%"', v_nome;
  end if;

  select coalesce(max(ordem), 0) + 10 into v_ordem from categoria;

  insert into categoria (nome, slug, descricao, ordem)
  values (v_nome, v_slug, nullif(trim(coalesce(p_descricao,'')), ''), v_ordem)
  returning id into v_id;

  insert into log_admin (acao, alvo_tipo, alvo_id, detalhe, autor_id)
  values ('categoria', 'categoria', v_id, 'criou a categoria "' || v_nome || '"', auth.uid());

  return v_id;
end $fn$;

create or replace function excluir_categoria(p_categoria uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_n int; v_nome text;
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;

  select nome into v_nome from categoria where id = p_categoria;
  if v_nome is null then raise exception 'categoria inexistente'; end if;

  select count(*) into v_n from curso where categoria_id = p_categoria;
  if v_n > 0 then
    raise exception '% curso(s) usam esta categoria; desative em vez de excluir', v_n;
  end if;

  delete from categoria where id = p_categoria;

  insert into log_admin (acao, alvo_tipo, alvo_id, detalhe, autor_id)
  values ('categoria', 'categoria', p_categoria, 'excluiu a categoria "' || v_nome || '"', auth.uid());
end $fn$;

create or replace function criar_aviso(p_dados jsonb)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_id uuid; v_titulo text; v_msg text;
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;

  v_titulo := nullif(trim(coalesce(p_dados->>'titulo','')), '');
  v_msg    := nullif(trim(coalesce(p_dados->>'mensagem','')), '');
  if v_titulo is null or v_msg is null then
    raise exception 'titulo e mensagem sao obrigatorios';
  end if;

  insert into aviso (titulo, mensagem, tipo, publico, inicio_em, fim_em, criado_por)
  values (
    v_titulo, v_msg,
    coalesce(nullif(p_dados->>'tipo',''), 'info'),
    coalesce(nullif(p_dados->>'publico',''), 'todos'),
    nullif(p_dados->>'inicioEm','')::timestamptz,
    nullif(p_dados->>'fimEm','')::timestamptz,
    auth.uid()
  )
  returning id into v_id;

  insert into log_admin (acao, alvo_tipo, alvo_id, detalhe, autor_id)
  values ('aviso', 'aviso', v_id, 'publicou o aviso "' || v_titulo || '"', auth.uid());

  return v_id;
end $fn$;

insert into migration_aplicada (nome) values ('0034_auditoria.sql')
on conflict (nome) do nothing;
