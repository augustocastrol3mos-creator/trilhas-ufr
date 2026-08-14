-- 0018_reinscricao.sql
--
-- Aluno aprovado num curso não pode se matricular nele de novo, em nenhuma
-- turma. Sem isso, quem já tem o certificado de "Introdução ao cooperativismo"
-- pode entrar na turma seguinte e sair com um segundo certificado do mesmo
-- curso — carga horária contada duas vezes.
--
-- ESCOPO: a trava é por CURSO, não por turma. Bloquear só a mesma turma não
-- resolveria nada, já que o problema aparece justamente na oferta seguinte.
--
-- REPROVADO NÃO É BLOQUEADO. Refazer numa turma nova é exatamente para que a
-- oferta recorrente existe. Só aprovado trava.
--
-- CERTIFICADO REVOGADO CONTINUA TRAVANDO: revogar_certificado devolve a
-- matrícula para 'aprovado' (0007, linha 109), porque revogar é o caminho de
-- CORRIGIR E REEMITIR, não de anular a aprovação. Os dois estados são
-- equivalentes para esta regra.

create or replace function inscrever(p_turma uuid)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_id       uuid;
  v_turma    turma%rowtype;
  v_curso    text;
  v_ocupadas int;
begin
  if auth.uid() is null then raise exception 'nao autenticado'; end if;

  -- Já matriculado NESTA turma: devolve a matrícula existente sem validar
  -- nada. Precisa continuar sendo a primeira coisa — inclusive antes da trava
  -- nova. Quem foi aprovado nesta mesma turma tem que conseguir voltar à
  -- própria trilha e ao próprio certificado; a trava é contra entrar de novo,
  -- não contra rever o que já fez.
  select id into v_id from matricula
  where usuario_id = auth.uid() and turma_id = p_turma;
  if v_id is not null then
    return v_id;
  end if;

  perform pg_advisory_xact_lock(hashtext('inscrever'), hashtext(p_turma::text));

  select * into v_turma from turma where id = p_turma;
  if v_turma.id is null then raise exception 'turma inexistente'; end if;

  select status into v_curso from curso where id = v_turma.curso_id;
  if v_curso is distinct from 'publicado' then
    raise exception 'este curso nao esta aberto para inscricao';
  end if;

  -- A trava nova: aprovado em QUALQUER turma deste curso.
  if exists (
    select 1
    from matricula m
    join turma t2 on t2.id = m.turma_id
    where m.usuario_id = auth.uid()
      and t2.curso_id = v_turma.curso_id
      and m.status in ('aprovado', 'certificado_emitido')
  ) then
    raise exception 'voce ja concluiu este curso e nao pode cursa-lo novamente';
  end if;

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

-- LACUNA CONHECIDA, registrada de propósito: não há hoje ação de coordenação
-- para liberar a reinscrição de alguém. Se um certificado for revogado por
-- fraude e a PROEX quiser que o aluno refaça o curso, não existe caminho —
-- teria de ser um UPDATE manual em matricula.status. Se isso acontecer na
-- prática, vira uma RPC `liberar_reinscricao(matricula)` com log_admin, nos
-- moldes de reabrir_turma. Não construído agora por falta de caso real.
