-- 0013_inscricao.sql
--
-- A tabela turma modela quatro regras desde a 0001, e inscrever() não
-- verificava nenhuma: vagas, inscricoes_ate, turma.status e curso.status.
-- É o mesmo padrão do papel do usuário e do bucket de materiais — o modelo
-- estava certo, o cumprimento não existia. Coluna no schema cria expectativa;
-- expectativa não é regra. Regra é raise exception.
--
-- O pior caso não era teórico: depois de fechar_turma, um aluno com o link
-- antigo se matriculava numa turma ENCERRADA e ficava preso — sem trilha a
-- concluir, sem certificado possível, e sem caminho de saída no produto.

-- ---------------------------------------------------------------------------
-- A. A regra
-- ---------------------------------------------------------------------------

create or replace function inscrever(p_turma uuid)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_id          uuid;
  v_turma       turma%rowtype;
  v_curso       text;
  v_ocupadas    int;
begin
  if auth.uid() is null then raise exception 'nao autenticado'; end if;

  -- Já matriculado: devolve a matrícula existente sem validar nada.
  -- Quem já entrou não pode ser expulso por lotação ou prazo, e o botão do
  -- catálogo é o mesmo que leva de volta à trilha. Precisa vir ANTES de
  -- qualquer checagem, senão o aluno de uma turma lotada perde o acesso ao
  -- próprio curso.
  select id into v_id from matricula
  where usuario_id = auth.uid() and turma_id = p_turma;
  if v_id is not null then
    return v_id;
  end if;

  -- Serializa inscrições concorrentes na mesma turma. Sem isto, duas
  -- requisições simultâneas leem o mesmo total de ocupadas e as duas passam
  -- pelo teste de vagas — a última vaga vira duas.
  perform pg_advisory_xact_lock(hashtext('inscrever'), hashtext(p_turma::text));

  select * into v_turma from turma where id = p_turma;
  if v_turma.id is null then raise exception 'turma inexistente'; end if;

  select status into v_curso from curso where id = v_turma.curso_id;
  if v_curso is distinct from 'publicado' then
    raise exception 'este curso nao esta aberto para inscricao';
  end if;

  -- reabrir_turma devolve a turma para 'em_andamento', não para
  -- 'inscricoes_abertas'. É proposital: reabrir para lançar nota não deve
  -- reabrir inscrição.
  if v_turma.status <> 'inscricoes_abertas' then
    raise exception 'as inscricoes desta turma estao encerradas';
  end if;

  if v_turma.inscricoes_ate is not null and current_date > v_turma.inscricoes_ate then
    raise exception 'o prazo de inscricao terminou em %',
      to_char(v_turma.inscricoes_ate, 'DD/MM/YYYY');
  end if;

  if v_turma.vagas is not null then
    select count(*) into v_ocupadas from matricula where turma_id = p_turma;
    if v_ocupadas >= v_turma.vagas then
      raise exception 'nao ha vagas nesta turma';
    end if;
  end if;

  insert into matricula (usuario_id, turma_id)
  values (auth.uid(), p_turma)
  returning id into v_id;

  return v_id;
end $fn$;

-- ---------------------------------------------------------------------------
-- B. A mesma regra, para a tela poder mostrar antes de o aluno clicar
-- ---------------------------------------------------------------------------

-- Regra que o banco recusa mas a tela oferece vira erro na cara do aluno.
-- Esta função existe para o catálogo saber o que já se sabe no servidor.
--
-- SECURITY DEFINER é necessário: contar as matrículas de uma turma exige ler
-- linhas de outras pessoas, que o RLS corretamente esconde. A função devolve
-- só o AGREGADO — número de ocupadas — nunca quem são.
--
-- A lógica de "aberta" é deliberadamente a mesma da função acima. Se um dia
-- mudar uma, mude as duas: são duas cópias da mesma regra, e essa duplicação
-- é o preço de a tela poder antecipar a decisão do banco.

create or replace function turmas_abertas()
returns table (
  turma_id  uuid,
  ocupadas  int,
  restantes int,
  aberta    boolean
)
language sql stable security definer set search_path = public as $fn$
  select
    t.id,
    count(m.id)::int,
    case when t.vagas is null then null::int
         else greatest(t.vagas - count(m.id), 0)::int end,
    t.status = 'inscricoes_abertas'
      and (t.inscricoes_ate is null or current_date <= t.inscricoes_ate)
      and (t.vagas is null or count(m.id) < t.vagas)
  from turma t
  join curso c on c.id = t.curso_id
  left join matricula m on m.turma_id = t.id
  where c.status = 'publicado'
  group by t.id, t.vagas, t.status, t.inscricoes_ate;
$fn$;

-- O catálogo é público: visitante sem conta precisa ver o que está aberto.
grant execute on function turmas_abertas() to anon, authenticated;
