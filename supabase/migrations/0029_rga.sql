-- 0029_rga.sql
--
-- RGA como identificador do estudante da UFR, e o certificado passa a carregá-lo.
--
-- POR QUE ISTO IMPORTA MAIS QUE A TRAVA DA 0028
--
-- A 0028 eliminou a troca silenciosa de nome, mas não fecha o mercado: quem
-- quer vender certificado cadastra a conta já com o nome do comprador. Com o
-- RGA impresso, o documento deixa de valer para qualquer pessoa com aquele
-- nome e passa a valer para UMA matrícula específica — que a coordenação
-- confere contra o registro acadêmico. É a diferença entre "esta conta
-- percorreu o curso" e "esta pessoa percorreu o curso".
--
-- OBRIGATÓRIO PARA QUEM É DA UFR, INEXISTENTE PARA A COMUNIDADE
--
-- Participante externo em curso de extensão não tem RGA. Exigir de todos
-- excluiria a comunidade; não exigir de ninguém tornaria o campo decorativo.
-- A regra é condicional: quem declara ser estudante da UFR precisa informar.

alter table usuario add column if not exists e_estudante_ufr boolean;
alter table usuario add column if not exists rga text;

-- Único: duas contas não podem reivindicar a mesma matrícula. É esta linha que
-- impede a conta paralela em nome de outra pessoa da UFR.
create unique index if not exists idx_usuario_rga on usuario (rga) where rga is not null;

-- ---------------------------------------------------------------------------
-- Formato
-- ---------------------------------------------------------------------------

-- 12 dígitos, os quatro primeiros sendo o ano de ingresso (ex: 202300000000).
-- A faixa de anos é deliberadamente larga: um aluno com ingresso antigo, ou
-- transferido, tem RGA fora do intervalo "óbvio". Recusar um estudante legítimo
-- por causa de validação apertada é pior do que aceitar um ano improvável.
create or replace function rga_valido(p_rga text)
returns boolean language sql immutable as $fn$
  select p_rga ~ '^[0-9]{12}$'
     and substring(p_rga from 1 for 4)::int between 1970 and extract(year from now())::int + 1;
$fn$;

alter table usuario drop constraint if exists usuario_rga_formato;
alter table usuario add constraint usuario_rga_formato
  check (rga is null or rga_valido(rga));

alter table usuario drop constraint if exists usuario_ufr_tem_rga;
alter table usuario add constraint usuario_ufr_tem_rga
  check (e_estudante_ufr is not true or rga is not null);

-- ---------------------------------------------------------------------------
-- Cadastro
-- ---------------------------------------------------------------------------

-- handle_new_user passa a gravar RGA e vínculo. Diferente de `papel`, estes
-- campos NÃO são privilégio: são declaração da própria pessoa sobre si, o
-- mesmo que ela digitaria no perfil. Ler do metadata aqui é seguro.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_rga text; v_ufr boolean;
begin
  v_rga := nullif(trim(coalesce(new.raw_user_meta_data->>'rga', '')), '');
  v_ufr := (new.raw_user_meta_data->>'e_estudante_ufr')::boolean;

  if v_rga is not null and not rga_valido(v_rga) then
    raise exception 'RGA deve ter 12 digitos, comecando pelo ano (ex: 202300000000)';
  end if;

  insert into usuario (id, email, nome_completo, e_estudante_ufr, rga)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'nome_completo', ''),
    coalesce(v_ufr, false),
    v_rga
  )
  on conflict (id) do nothing;

  return new;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- O RGA trava junto com o nome
-- ---------------------------------------------------------------------------

-- Substitui a função da 0028 acrescentando o quarto campo protegido. Um RGA
-- editável depois da matrícula reabriria exatamente o buraco que ele fecha.
create or replace function proteger_campos_usuario()
returns trigger language plpgsql as $$
declare v_matriculas int;
begin
  select count(*) into v_matriculas from matricula where usuario_id = old.id;

  if auth.uid() is not null then
    if new.papel is distinct from old.papel and not e_admin() then
      raise exception 'papel so pode ser alterado pela coordenacao';
    end if;

    if new.email is distinct from old.email and not e_admin() then
      raise exception 'email so muda pelo fluxo de autenticacao';
    end if;

    if new.nome_completo is distinct from old.nome_completo
       and not e_admin() and v_matriculas > 0 then
      raise exception
        'seu nome nao pode ser alterado depois da primeira inscricao; peca a alteracao a coordenacao';
    end if;

    if new.rga is distinct from old.rga and not e_admin() and v_matriculas > 0 then
      raise exception
        'seu RGA nao pode ser alterado depois da primeira inscricao; peca a alteracao a coordenacao';
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

-- ---------------------------------------------------------------------------
-- O certificado carrega o RGA
-- ---------------------------------------------------------------------------

alter table certificado add column if not exists rga_titular text;

-- Snapshot, como o nome: o documento não muda quando o cadastro mudar.
-- A 0005 REDEFINIU emitir_certificado (versão que aceita nota do fechamento).
-- É essa a versão viva no banco, e é ela que precisa ser reescrita aqui — a da
-- 0004 já não vale. Detalhe que só se descobre lendo as duas migrations.

-- ---------------------------------------------------------------------------
-- Relatório de alterações de nome — REENQUADRADO
-- ---------------------------------------------------------------------------

-- A função `nomes_suspeitos` da 0028 tinha um nome ruim, e nome ruim em
-- ferramenta de fiscalização não é detalhe: ele já contém o veredito. Quem abre
-- uma lista chamada "suspeitos" começa a leitura procurando confirmar suspeita.
--
-- A esmagadora maioria destas linhas tem explicação inocente: erro de digitação
-- percebido tarde, nome social, nome de casada, acento que faltava, sobrenome
-- que a pessoa usa e não estava no cadastro.
--
-- Isto aqui é um REGISTRO DE EVENTOS, não uma denúncia. Não prova nada sozinho
-- e não deve ser usado para acusar ninguém. O que ele faz é apontar onde vale
-- conferir — e a conferência é comparar RGA com o registro acadêmico e falar
-- com a pessoa, não concluir a partir da lista.

drop function if exists nomes_suspeitos();

create or replace function alteracoes_de_nome_apos_matricula()
returns table (
  usuario_id uuid, email text, rga text, nome_atual text,
  nome_anterior text, matriculas_ate int, alterado_em timestamptz,
  alterado_pelo_proprio boolean
)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;

  return query
    select h.usuario_id, u.email, u.rga, u.nome_completo,
           h.nome_anterior, h.matriculas_ate, h.alterado_em,
           h.alterado_por is not distinct from h.usuario_id
    from historico_nome h
    join usuario u on u.id = h.usuario_id
    where h.matriculas_ate > 0
    order by h.alterado_em desc;
end $fn$;

grant execute on function
  rga_valido(text), alteracoes_de_nome_apos_matricula()
to authenticated;

create or replace function emitir_certificado(p_matricula uuid)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_cfg      configuracao%rowtype;
  v_status   status_matricula;
  v_nome     text;
  v_rga      text;
  v_curso    curso%rowtype;
  v_turma    turma%rowtype;
  v_conteudo jsonb;
  v_inicio   date;
  v_fim      date;
  v_nota     numeric;
  v_id       uuid;
begin
  select * into v_cfg from configuracao where id;

  select m.status, u.nome_completo, u.rga, m.nota_final into v_status, v_nome, v_rga, v_nota
  from matricula m join usuario u on u.id = m.usuario_id
  where m.id = p_matricula;

  if v_status is null then raise exception 'matricula inexistente'; end if;
  if v_status not in ('aprovado','certificado_emitido') then
    raise exception 'matricula nao aprovada';
  end if;
  if coalesce(trim(v_nome), '') = '' then
    raise exception 'nome completo do titular nao preenchido';
  end if;

  select id into v_id from certificado
  where matricula_id = p_matricula and revogado_em is null;
  if v_id is not null then return v_id; end if;

  select c.* into v_curso
  from matricula m join turma t on t.id = m.turma_id join curso c on c.id = t.curso_id
  where m.id = p_matricula;

  select t.* into v_turma from matricula m join turma t on t.id = m.turma_id
  where m.id = p_matricula;

  select coalesce(jsonb_agg(mo.titulo order by mo.ordem), '[]'::jsonb) into v_conteudo
  from modulo mo where mo.curso_id = v_curso.id;

  if v_turma.inicio is not null then
    v_inicio := v_turma.inicio;
  else
    select criado_em::date into v_inicio from matricula where id = p_matricula;
  end if;
  v_fim := coalesce(v_turma.fim, current_date);

  insert into certificado (
    matricula_id, codigo, nome_titular, rga_titular, curso_titulo, carga_horaria,
    modalidade, periodo_inicio, periodo_fim, nota_final, conteudo,
    assinante_nome, assinante_cargo
  ) values (
    p_matricula, gerar_codigo_certificado(), v_nome, v_rga, v_curso.titulo,
    v_curso.carga_horaria, v_curso.modalidade,
    v_inicio, v_fim, coalesce(v_nota, calcular_nota_online(p_matricula)), v_conteudo,
    v_cfg.assinante_nome, v_cfg.assinante_cargo
  )
  returning id into v_id;

  update matricula set status = 'certificado_emitido' where id = p_matricula;
  return v_id;
end $fn$;

-- A validação pública devolve o RGA MASCARADO: quem confere precisa saber que
-- existe e checar o ano de ingresso e os dois últimos dígitos, o que já elimina
-- o certificado de outra pessoa. Devolver inteiro transformaria qualquer código
-- de validação num jeito de descobrir a matrícula alheia. O certificado
-- impresso traz o número completo — e quem o tem em mãos é o titular.

create or replace function mascarar_rga(p_rga text)
returns text language sql immutable as $fn$
  select case
    when p_rga is null or length(p_rga) <> 12 then null
    else substring(p_rga from 1 for 4) || '******' || substring(p_rga from 11 for 2)
  end;
$fn$;

grant execute on function mascarar_rga(text) to anon, authenticated;

insert into migration_aplicada (nome) values ('0029_rga.sql')
on conflict (nome) do nothing;
