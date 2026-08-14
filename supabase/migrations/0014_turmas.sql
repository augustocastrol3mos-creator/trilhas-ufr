-- 0014_turmas.sql
--
-- Não existia gestão de turma. As quatro telas que tocam em `turma` só liam;
-- nenhuma escrevia. A única turma de cada curso nascia colada ao criar_curso,
-- com identificador chutado, e nunca mais podia ser editada nem duplicada.
--
-- O schema sempre supôs oferta recorrente: `identificador` ("2026/1"),
-- `unique (curso_id, identificador)`, `tipo` coorte com data de encontro. A
-- interface supunha uma oferta única e eterna. Consequência prática: rodar o
-- mesmo curso em 2026/2 não tinha caminho — a turma de 2026/1 está encerrada,
-- e reabri-la traria os alunos antigos misturados aos novos, num fechamento só.
--
-- Autorização acordada:
--   professor  -> cria e edita turma dos cursos DELE (e_autor_do_curso)
--   coordenação -> tudo, em qualquer turma (e_admin)
-- Nada de papel novo: os dois predicados já existem desde a 0006/0007.

-- ---------------------------------------------------------------------------
-- Predicado único de autorização, para as três funções não divergirem
-- ---------------------------------------------------------------------------

create or replace function pode_gerir_turma(p_curso uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select e_admin() or e_autor_do_curso(p_curso);
$fn$;

-- ---------------------------------------------------------------------------
-- Criar
-- ---------------------------------------------------------------------------

-- A modalidade do curso decide o tipo da turma, não quem preenche o
-- formulário. É a mesma regra que criar_curso já aplicava, e existe porque o
-- schema tem duas constraints que se contradizem se o tipo vier errado:
--   coorte_tem_encontro   -> coorte PRECISA de encontro_data
--   continua_sem_encontro -> continua NÃO PODE ter encontro_data
-- Deixar o usuário escolher o tipo seria deixá-lo escolher violar constraint.

create or replace function criar_turma(p_curso uuid, p_dados jsonb)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_id         uuid;
  v_modalidade modalidade_curso;
  v_ident      text;
  v_encontro   timestamptz;
  v_vagas      int;
begin
  if not pode_gerir_turma(p_curso) then
    raise exception 'sem permissao para abrir turma neste curso';
  end if;

  select modalidade into v_modalidade from curso where id = p_curso;
  if v_modalidade is null then raise exception 'curso inexistente'; end if;

  v_ident := nullif(trim(coalesce(p_dados->>'identificador', '')), '');
  if v_ident is null then
    raise exception 'a turma precisa de um identificador (ex: 2026/1)';
  end if;

  if exists (select 1 from turma where curso_id = p_curso and identificador = v_ident) then
    raise exception 'ja existe uma turma % neste curso', v_ident;
  end if;

  v_encontro := (p_dados->>'encontroData')::timestamptz;
  if v_modalidade = 'hibrido' and v_encontro is null then
    raise exception 'turma de curso hibrido precisa de data de encontro';
  end if;

  v_vagas := nullif(p_dados->>'vagas', '')::int;
  if v_vagas is not null and v_vagas < 1 then
    raise exception 'vagas precisa ser maior que zero, ou vazio para ilimitado';
  end if;

  insert into turma (
    curso_id, instrutor_id, identificador, tipo,
    encontro_data, encontro_local, inscricoes_ate, vagas, inicio, fim, status
  )
  values (
    p_curso,
    coalesce(nullif(p_dados->>'instrutorId','')::uuid, auth.uid()),
    v_ident,
    case when v_modalidade = 'online' then 'continua' else 'coorte' end::tipo_turma,
    case when v_modalidade = 'online' then null else v_encontro end,
    case when v_modalidade = 'online' then null
         else nullif(trim(coalesce(p_dados->>'encontroLocal','')), '') end,
    nullif(p_dados->>'inscricoesAte','')::date,
    v_vagas,
    case when v_modalidade = 'online' then null else current_date end,
    case when v_modalidade = 'online' then null else v_encontro::date end,
    'inscricoes_abertas'
  )
  returning id into v_id;

  return v_id;
end $fn$;

-- ---------------------------------------------------------------------------
-- Editar
-- ---------------------------------------------------------------------------

-- Só campos operacionais: vagas, prazo, encontro, local, instrutor. NÃO edita
-- `tipo` (violaria as constraints) nem `status` (isso é ato próprio, abaixo)
-- nem `identificador` (é a chave que o aluno vê no certificado).
--
-- Turma encerrada não se edita: fechar_turma congelou nota e emitiu
-- certificado, então mexer nos parâmetros depois seria reescrever o passado.
-- É a mesma regra do certificado imutável — erro se corrige reabrindo.

create or replace function atualizar_turma(p_turma uuid, p_dados jsonb)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  v_turma    turma%rowtype;
  v_ocupadas int;
  v_vagas    int;
begin
  select * into v_turma from turma where id = p_turma;
  if v_turma.id is null then raise exception 'turma inexistente'; end if;

  if not pode_gerir_turma(v_turma.curso_id) then
    raise exception 'sem permissao para editar esta turma';
  end if;

  if v_turma.status = 'encerrada' then
    raise exception 'turma encerrada nao pode ser editada; reabra antes';
  end if;

  v_vagas := nullif(p_dados->>'vagas','')::int;
  if v_vagas is not null then
    select count(*) into v_ocupadas from matricula where turma_id = p_turma;
    if v_vagas < v_ocupadas then
      raise exception 'ja ha % matriculados; vagas nao pode ser menor que isso', v_ocupadas;
    end if;
  end if;

  update turma set
    vagas          = v_vagas,
    inscricoes_ate = nullif(p_dados->>'inscricoesAte','')::date,
    encontro_data  = case when v_turma.tipo = 'continua' then null
                          else coalesce((p_dados->>'encontroData')::timestamptz, encontro_data) end,
    encontro_local = case when v_turma.tipo = 'continua' then null
                          else nullif(trim(coalesce(p_dados->>'encontroLocal','')), '') end,
    instrutor_id   = coalesce(nullif(p_dados->>'instrutorId','')::uuid, instrutor_id),
    fim            = case when v_turma.tipo = 'continua' then null
                          else coalesce((p_dados->>'encontroData')::date, fim) end
  where id = p_turma;
end $fn$;

-- ---------------------------------------------------------------------------
-- Abrir e encerrar inscrições
-- ---------------------------------------------------------------------------

-- Distinto de fechar_turma. Encerrar inscrição só impede gente nova de entrar;
-- quem já está segue fazendo a trilha normalmente. Fechar a turma é o ato
-- final que congela nota e emite certificado.
--
-- Os estados de turma passam a ser três, com significados separados:
--   inscricoes_abertas -> aceita matrícula nova
--   em_andamento       -> não aceita matrícula nova, trilha rodando
--   encerrada          -> fechada, notas congeladas (só fechar_turma põe aqui)

create or replace function definir_inscricoes(p_turma uuid, p_abertas boolean)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_turma turma%rowtype;
begin
  select * into v_turma from turma where id = p_turma;
  if v_turma.id is null then raise exception 'turma inexistente'; end if;

  if not pode_gerir_turma(v_turma.curso_id) then
    raise exception 'sem permissao para alterar esta turma';
  end if;

  if v_turma.status = 'encerrada' then
    raise exception 'turma encerrada; use reabrir_turma antes';
  end if;

  update turma
     set status = case when p_abertas then 'inscricoes_abertas' else 'em_andamento' end
   where id = p_turma;
end $fn$;

grant execute on function
  criar_turma(uuid, jsonb), atualizar_turma(uuid, jsonb),
  definir_inscricoes(uuid, boolean), pode_gerir_turma(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Leitura para a tela de gestão
-- ---------------------------------------------------------------------------

-- Por que uma RPC em vez de um select direto na tela: contar matriculados
-- exige ler matrículas de terceiros, que o RLS esconde — e a política
-- matricula_do_instrutor só libera para quem é INSTRUTOR da turma, enquanto
-- quem gere a turma pode ser o AUTOR do curso sem ser instrutor de nenhuma.
-- A função devolve só o agregado, nunca quem são os alunos. Mesmo desenho de
-- turmas_abertas() na 0013.

create or replace function turmas_do_curso(p_curso uuid)
returns table (
  id             uuid,
  identificador  text,
  tipo           text,
  status         text,
  encontro_data  timestamptz,
  encontro_local text,
  inscricoes_ate date,
  vagas          int,
  ocupadas       int,
  instrutor_id   uuid,
  instrutor_nome text
)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not pode_gerir_turma(p_curso) then
    raise exception 'sem permissao para ver as turmas deste curso';
  end if;

  return query
    select t.id, t.identificador, t.tipo::text, t.status,
           t.encontro_data, t.encontro_local, t.inscricoes_ate, t.vagas,
           (select count(*)::int from matricula m where m.turma_id = t.id),
           t.instrutor_id,
           coalesce(u.nome_completo, u.email, '—')
    from turma t
    left join usuario u on u.id = t.instrutor_id
    where t.curso_id = p_curso
    order by t.identificador desc;
end $fn$;

grant execute on function turmas_do_curso(uuid) to authenticated;
