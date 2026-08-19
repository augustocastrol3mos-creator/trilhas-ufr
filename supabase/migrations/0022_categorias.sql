-- 0022_categorias.sql
--
-- Categoria como TABELA gerenciada, não enum no schema nem lista no código.
-- A coordenação cria, renomeia e ordena sem precisar de deploy; o professor
-- escolhe no ato de criar o curso; o aluno filtra no catálogo.
--
-- Enum seria mais simples de escrever e pior de viver: cada categoria nova
-- exigiria migration, deploy e alguém disponível para fazer isso. Numa
-- plataforma cuja prioridade é ATIVIDADE COMPLEMENTAR — onde o vocabulário
-- acompanha o curso de Administração hoje e outros cursos depois — engessar a
-- lista no código seria transferir para o desenvolvedor uma decisão que é da
-- coordenação.

create table if not exists categoria (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null unique,
  slug      text not null unique,
  descricao text,
  ordem     int  not null default 0,
  ativa     boolean not null default true,
  criado_em timestamptz not null default now()
);

create index if not exists idx_categoria_ordem on categoria (ordem, nome);

alter table curso add column if not exists categoria_id uuid
  references categoria(id) on delete set null;

create index if not exists idx_curso_categoria on curso (categoria_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table categoria enable row level security;

-- Leitura pública: o catálogo em /cursos é aberto a visitante sem conta, e ele
-- precisa das categorias para filtrar. Não há nada sensível aqui.
-- Sem policy de escrita: tudo passa pelas RPCs abaixo, que exigem e_admin().
drop policy if exists categoria_leitura on categoria;
create policy categoria_leitura on categoria for select using (true);

-- ---------------------------------------------------------------------------
-- Slug
-- ---------------------------------------------------------------------------

-- translate() em vez da extensão unaccent: resolve o acento do português sem
-- depender de extensão instalada no projeto Supabase, que é uma dependência a
-- menos para quem for reconstruir o banco.
create or replace function gerar_slug_categoria(p_nome text)
returns text language sql immutable as $fn$
  select trim(both '-' from regexp_replace(
    lower(translate(
      p_nome,
      'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
    )),
    '[^a-z0-9]+', '-', 'g'
  ));
$fn$;

-- ---------------------------------------------------------------------------
-- Gestão (coordenação)
-- ---------------------------------------------------------------------------

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
  values ('categoria', 'curso', v_id, 'criou a categoria "' || v_nome || '"', auth.uid());

  return v_id;
end $fn$;

create or replace function atualizar_categoria(p_categoria uuid, p_dados jsonb)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_nome text; v_slug text;
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;
  if not exists (select 1 from categoria where id = p_categoria) then
    raise exception 'categoria inexistente';
  end if;

  v_nome := nullif(trim(coalesce(p_dados->>'nome','')), '');
  if v_nome is null then raise exception 'informe o nome da categoria'; end if;

  v_slug := gerar_slug_categoria(v_nome);
  if exists (select 1 from categoria where slug = v_slug and id <> p_categoria) then
    raise exception 'ja existe outra categoria equivalente a "%"', v_nome;
  end if;

  update categoria set
    nome      = v_nome,
    slug      = v_slug,
    descricao = nullif(trim(coalesce(p_dados->>'descricao','')), ''),
    ordem     = coalesce(nullif(p_dados->>'ordem','')::int, ordem),
    ativa     = coalesce((p_dados->>'ativa')::boolean, ativa)
  where id = p_categoria;
end $fn$;

-- Excluir só quando nenhum curso usa. Categoria em uso desaparecendo deixaria
-- cursos sem rótulo e quebraria o filtro que o aluno acabou de usar. Para tirar
-- de circulação sem perder o histórico, use `ativa = false`: some do formulário
-- do professor e do filtro, mas os cursos que já a têm continuam rotulados.
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
  values ('categoria', 'curso', p_categoria, 'excluiu a categoria "' || v_nome || '"', auth.uid());
end $fn$;

-- Leitura com contagem de cursos: a tela de gestão precisa saber quais dá para
-- excluir, e o catálogo precisa saber quais têm curso para mostrar no filtro.
create or replace function categorias_com_uso()
returns table (
  id uuid, nome text, slug text, descricao text,
  ordem int, ativa boolean, cursos int, publicados int
)
language sql stable security definer set search_path = public as $fn$
  select c.id, c.nome, c.slug, c.descricao, c.ordem, c.ativa,
         (select count(*)::int from curso where categoria_id = c.id),
         (select count(*)::int from curso where categoria_id = c.id and status = 'publicado')
  from categoria c
  order by c.ordem, c.nome;
$fn$;

grant execute on function
  criar_categoria(text, text), atualizar_categoria(uuid, jsonb),
  excluir_categoria(uuid), categorias_com_uso(), gerar_slug_categoria(text)
to authenticated;

grant execute on function categorias_com_uso() to anon;

-- ---------------------------------------------------------------------------
-- Categorias iniciais
-- ---------------------------------------------------------------------------

-- Ponto de partida, não decisão definitiva: nenhuma está em uso, então todas
-- podem ser renomeadas ou excluídas pela tela da coordenação. Administração
-- vem primeiro porque é o curso de origem do piloto.

insert into categoria (nome, slug, descricao, ordem) values
  ('Administração',      'administracao',      'Gestão, processos e organizações', 10),
  ('Finanças',           'financas',           'Custos, orçamento e análise financeira', 20),
  ('Empreendedorismo',   'empreendedorismo',   'Criação e gestão de novos negócios', 30),
  ('Tecnologia',         'tecnologia',         'Ferramentas digitais e sistemas', 40),
  ('Comunicação',        'comunicacao',        'Expressão, redação e apresentação', 50),
  ('Desenvolvimento pessoal', 'desenvolvimento-pessoal', 'Habilidades transversais e carreira', 60)
on conflict (slug) do nothing;

insert into migration_aplicada (nome) values ('0022_categorias.sql')
on conflict (nome) do nothing;

-- ---------------------------------------------------------------------------
-- criar_curso passa a gravar a categoria
-- ---------------------------------------------------------------------------

-- Reescrita completa da função da 0006: `create or replace` exige o corpo
-- inteiro. A única diferença são as duas linhas de categoria_id no insert.



create or replace function criar_curso(p_dados jsonb)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_id         uuid;
  v_modalidade modalidade_curso;
  v_slug       text;
  v_sufixo     int := 1;
begin
  if not pode_criar_curso() then raise exception 'apenas instrutores podem criar cursos'; end if;

  v_modalidade := (p_dados->>'modalidade')::modalidade_curso;

  v_slug := regexp_replace(lower(trim(p_dados->>'titulo')), '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then v_slug := 'curso'; end if;
  while exists (select 1 from curso where slug = v_slug) loop
    v_sufixo := v_sufixo + 1;
    v_slug := v_slug || '-' || v_sufixo;
  end loop;

  insert into curso (
    slug, titulo, descricao, carga_horaria, modalidade, emissao,
    peso_online, peso_presencial, nota_minima_final, exige_presenca,
    autor_id, status, categoria_id
  ) values (
    v_slug,
    trim(p_dados->>'titulo'),
    nullif(trim(coalesce(p_dados->>'descricao','')), ''),
    coalesce((p_dados->>'cargaHoraria')::int, 20),
    v_modalidade,
    case when v_modalidade = 'online' then 'automatica' else 'manual' end::emissao_certificado,
    case when v_modalidade = 'online' then 100 else coalesce((p_dados->>'pesoOnline')::numeric, 60) end,
    case when v_modalidade = 'online' then 0   else 100 - coalesce((p_dados->>'pesoOnline')::numeric, 60) end,
    coalesce((p_dados->>'notaMinima')::numeric, 60),
    v_modalidade <> 'online',
    auth.uid(),
    'rascunho',
    nullif(p_dados->>'categoriaId','')::uuid
  )
  returning id into v_id;

  insert into turma (curso_id, instrutor_id, identificador, tipo, encontro_data, encontro_local, inicio, fim)
  values (
    v_id, auth.uid(),
    coalesce(nullif(trim(p_dados->>'turma'), ''),
             case when v_modalidade = 'online' then 'continua' else to_char(now(),'YYYY') || '/1' end),
    case when v_modalidade = 'online' then 'continua' else 'coorte' end::tipo_turma,
    case when v_modalidade = 'online' then null else (p_dados->>'encontroData')::timestamptz end,
    case when v_modalidade = 'online' then null else nullif(trim(coalesce(p_dados->>'encontroLocal','')), '') end,
    case when v_modalidade = 'online' then null else current_date end,
    case when v_modalidade = 'online' then null else (p_dados->>'encontroData')::date end
  );

  return v_id;
end $fn$;

insert into migration_aplicada (nome) values ('0022_categorias.sql')
on conflict (nome) do nothing;
