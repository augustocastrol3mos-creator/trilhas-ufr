-- 0033_operacao.sql
--
-- Tira do caminho as duas coisas que hoje exigem um desenvolvedor para a
-- plataforma continuar funcionando: alterar a configuração institucional e
-- extrair os dados.
--
-- O CONTEXTO
--
-- Este projeto perde seu único desenvolvedor em dezembro. Tudo que só se faz
-- por SQL vira, na prática, uma dependência permanente de alguém técnico —
-- e o assinante do certificado, por exemplo, MUDA sempre que muda o
-- coordenador. É garantido que vai precisar ser alterado.

-- ---------------------------------------------------------------------------
-- 1. Configuração pela interface
-- ---------------------------------------------------------------------------

create or replace function atualizar_configuracao(p_dados jsonb)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_url text;
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;

  v_url := nullif(trim(coalesce(p_dados->>'urlBase', '')), '');

  -- url_base é o endereço que vai dentro do QR code de todo certificado
  -- emitido daqui em diante. Errado aqui significa documento com QR que não
  -- leva a lugar nenhum — e certificado emitido é imutável, então não há
  -- conserto depois. Por isso a validação é dura.
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
  values ('configuracao', 'curso', null, 'configuracao institucional alterada', auth.uid());
end $fn$;

-- Diagnóstico para a tela avisar o que ainda está com valor de fábrica.
create or replace function diagnostico_configuracao()
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare c configuracao%rowtype; v jsonb := '[]'::jsonb;
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;

  select * into c from configuracao where id;

  if c.url_base ~* 'localhost|127\.0\.0\.1' then
    v := v || to_jsonb('O endereço de validação ainda é localhost: o QR code de qualquer certificado emitido agora não funcionaria fora desta máquina.'::text);
  end if;
  if c.assinante_nome = 'Coordenação de Extensão' then
    v := v || to_jsonb('O nome de quem assina o certificado ainda é o texto genérico de fábrica.'::text);
  end if;
  if c.orgao_emissor = 'Pró-Reitoria de Extensão, Cultura e Assuntos Estudantis' then
    v := v || to_jsonb('O órgão emissor ainda é o valor padrão — confirme se é exatamente como a instituição quer que apareça.'::text);
  end if;

  return jsonb_build_object(
    'config', to_jsonb(c),
    'pendencias', v,
    'certificadosEmitidos', (select count(*) from certificado)
  );
end $fn$;

grant execute on function
  atualizar_configuracao(jsonb), diagnostico_configuracao()
to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Exportações
-- ---------------------------------------------------------------------------

-- O livro de certificados: o registro que a coordenação precisa ter FORA da
-- plataforma. Hoje, se o banco for perdido, todo certificado emitido vira link
-- morto e não existe nenhuma cópia em lugar nenhum.

create or replace function exportar_certificados()
returns table (
  codigo text, nome_titular text, rga_titular text, cpf_ou_email text,
  curso text, categoria text, carga_horaria int, modalidade text,
  turma text, periodo_inicio date, periodo_fim date, nota_final numeric,
  emitido_em timestamptz, revogado_em timestamptz, revogado_motivo text,
  url_validacao text
)
language plpgsql stable security definer set search_path = public as $fn$
declare v_base text;
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;

  select rtrim(url_base, '/') into v_base from configuracao where id;

  return query
    select c.codigo, c.nome_titular, c.rga_titular, u.email,
           c.curso_titulo, cat.nome, c.carga_horaria, c.modalidade::text,
           t.identificador, c.periodo_inicio, c.periodo_fim, c.nota_final,
           c.emitido_em, c.revogado_em, c.revogado_motivo,
           v_base || '/validar/' || c.codigo
    from certificado c
    join matricula m on m.id = c.matricula_id
    join usuario u   on u.id = m.usuario_id
    join turma t     on t.id = m.turma_id
    left join curso cu on cu.id = t.curso_id
    left join categoria cat on cat.id = cu.categoria_id
    order by c.emitido_em desc;
end $fn$;

create or replace function exportar_matriculas()
returns table (
  aluno text, rga text, email text, curso text, categoria text,
  turma text, status text, nota_final numeric, presenca_confirmada boolean,
  encontros_total int, encontros_presente int, inscrito_em timestamptz
)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;

  return query
    select u.nome_completo, u.rga, u.email, cu.titulo, cat.nome,
           t.identificador, m.status::text, m.nota_final, m.presenca_confirmada,
           (select count(*)::int from encontro e where e.turma_id = t.id),
           (select count(*)::int from presenca p
              join encontro e on e.id = p.encontro_id
              where p.matricula_id = m.id and e.turma_id = t.id and p.presente),
           m.criado_em
    from matricula m
    join usuario u on u.id = m.usuario_id
    join turma t   on t.id = m.turma_id
    join curso cu  on cu.id = t.curso_id
    left join categoria cat on cat.id = cu.categoria_id
    order by cu.titulo, t.identificador, u.nome_completo;
end $fn$;

create or replace function exportar_cursos()
returns table (
  titulo text, categoria text, status text, modalidade text,
  carga_horaria int, autor text, turmas int, matriculados int,
  certificados int, criado_em timestamptz
)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;

  return query
    select cu.titulo, cat.nome, cu.status, cu.modalidade::text,
           cu.carga_horaria, au.nome_completo,
           (select count(*)::int from turma t where t.curso_id = cu.id),
           (select count(*)::int from matricula m
              join turma t on t.id = m.turma_id where t.curso_id = cu.id),
           (select count(*)::int from certificado c
              join matricula m on m.id = c.matricula_id
              join turma t on t.id = m.turma_id
              where t.curso_id = cu.id and c.revogado_em is null),
           cu.criado_em
    from curso cu
    left join categoria cat on cat.id = cu.categoria_id
    left join usuario au on au.id = cu.autor_id
    order by cu.titulo;
end $fn$;

grant execute on function
  exportar_certificados(), exportar_matriculas(), exportar_cursos()
to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Dados da credencial verificável
-- ---------------------------------------------------------------------------

-- Devolve tudo que o Open Badges 3.0 exige de um certificado, num formato
-- pronto para ser assinado pela aplicação. Público, como validar_certificado:
-- credencial verificável que exige login não serve para nada, já que quem
-- verifica é justamente quem NÃO tem conta aqui.

create or replace function dados_credencial(p_codigo text)
returns jsonb language sql stable security definer set search_path = public as $fn$
  select jsonb_build_object(
    'codigo', c.codigo,
    'valido', c.revogado_em is null,
    'revogadoEm', c.revogado_em,
    'nomeTitular', c.nome_titular,
    'rgaTitular', c.rga_titular,
    'emailTitular', u.email,
    'cursoTitulo', c.curso_titulo,
    'cursoDescricao', cu.descricao,
    'categoria', cat.nome,
    'cargaHoraria', c.carga_horaria,
    'modalidade', c.modalidade,
    'notaFinal', c.nota_final,
    'periodoInicio', c.periodo_inicio,
    'periodoFim', c.periodo_fim,
    'conteudo', c.conteudo,
    'emitidoEm', c.emitido_em,
    'instituicao', cfg.instituicao_nome,
    'instituicaoSigla', cfg.instituicao_sigla,
    'orgaoEmissor', cfg.orgao_emissor,
    'urlBase', rtrim(cfg.url_base, '/')
  )
  from certificado c
  join matricula m on m.id = c.matricula_id
  join usuario u   on u.id = m.usuario_id
  join turma t     on t.id = m.turma_id
  left join curso cu on cu.id = t.curso_id
  left join categoria cat on cat.id = cu.categoria_id
  cross join configuracao cfg
  where upper(c.codigo) = upper(trim(p_codigo)) and cfg.id;
$fn$;

grant execute on function dados_credencial(text) to anon, authenticated;

insert into migration_aplicada (nome) values ('0033_operacao.sql')
on conflict (nome) do nothing;
