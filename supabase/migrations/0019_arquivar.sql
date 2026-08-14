-- 0019_arquivar.sql
--
-- ============================ LEIA ANTES ===================================
-- A cadeia de exclusão em cascata do schema é:
--
--     curso -> turma -> matricula -> certificado
--
-- Todas com `on delete cascade`. Ou seja, um `delete from curso` APAGA OS
-- CERTIFICADOS EMITIDOS daquele curso, sem aviso e sem volta. Quem estiver com
-- o PDF impresso e o QR code na mão bate numa página de "não encontrado".
--
-- Isso contradiz frontalmente o "certificado emitido é imutável" da seção 2 do
-- ESTADO_DO_PROJETO. Por isso a exclusão aqui NÃO é "coordenação pode apagar":
-- é "só é possível apagar o que não tem nada a perder".
--
--   excluir_curso  -> só com ZERO matrículas. Curso criado por engano, teste,
--                     rascunho abandonado. Irreversível, e avisado como tal.
--   arquivar_curso -> todo o resto. Some do catálogo, ninguém novo entra,
--                     e quem já está dentro mantém trilha e certificado.
--
-- Arquivar é a operação normal. Excluir é a exceção estreita.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. RLS: arquivado não pode cegar quem já está matriculado
-- ---------------------------------------------------------------------------

-- As três policies de leitura hoje exigem status = 'publicado'. Ao arquivar,
-- o aluno matriculado perderia o título do curso em /meus-cursos e a trilha
-- quebraria. Elas passam a aceitar também "sou matriculado numa turma deste
-- curso" — condição restrita ao próprio usuário, então não amplia o que
-- ninguém vê além do que já é dele.

drop policy if exists curso_publicado on curso;
create policy curso_publicado on curso
  for select using (
    status = 'publicado'
    or autor_id = auth.uid()
    or exists (
      select 1 from turma t
      join matricula m on m.turma_id = t.id
      where t.curso_id = curso.id and m.usuario_id = auth.uid()
    )
  );

drop policy if exists turma_de_curso_publicado on turma;
create policy turma_de_curso_publicado on turma
  for select using (
    exists (select 1 from curso c where c.id = turma.curso_id and c.status = 'publicado')
    or exists (select 1 from matricula m where m.turma_id = turma.id and m.usuario_id = auth.uid())
  );

drop policy if exists modulo_de_curso_publicado on modulo;
create policy modulo_de_curso_publicado on modulo
  for select using (
    exists (select 1 from curso c where c.id = modulo.curso_id and c.status = 'publicado')
    or exists (
      select 1 from turma t
      join matricula m on m.turma_id = t.id
      where t.curso_id = modulo.curso_id and m.usuario_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Arquivar e desarquivar
-- ---------------------------------------------------------------------------

create or replace function arquivar_curso(p_curso uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_status text; v_titulo text; v_abertas int;
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;

  select status, titulo into v_status, v_titulo from curso where id = p_curso;
  if v_status is null then raise exception 'curso inexistente'; end if;
  if v_status = 'arquivado' then raise exception 'curso ja esta arquivado'; end if;

  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'informe o motivo do arquivamento';
  end if;

  update curso set status = 'arquivado' where id = p_curso;

  -- Turmas ainda aceitando gente são fechadas junto: curso fora do catálogo
  -- com inscrição tecnicamente aberta é estado incoerente, e alguém com o
  -- link antigo entraria num curso que a coordenação tirou do ar.
  -- Turmas 'encerrada' não são tocadas — já estão fechadas com nota congelada.
  update turma set status = 'em_andamento'
   where curso_id = p_curso and status = 'inscricoes_abertas';
  get diagnostics v_abertas = row_count;

  insert into log_admin (acao, alvo_tipo, alvo_id, detalhe, justificativa, autor_id)
  values ('arquivamento', 'curso', p_curso,
          v_titulo || ' — ' || v_abertas || ' turma(s) tiveram inscricao encerrada',
          p_motivo, auth.uid());
end $fn$;

create or replace function desarquivar_curso(p_curso uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_status text;
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;

  select status into v_status from curso where id = p_curso;
  if v_status is distinct from 'arquivado' then
    raise exception 'curso nao esta arquivado';
  end if;

  -- Volta para rascunho, NÃO para publicado. Republicar exige passar de novo
  -- por validar_publicacao e pela autorização da coordenação — o mesmo
  -- caminho de qualquer curso novo. Desarquivar não é atalho de publicação.
  update curso set status = 'rascunho' where id = p_curso;

  insert into log_admin (acao, alvo_tipo, alvo_id, detalhe, autor_id)
  values ('desarquivamento', 'curso', p_curso, 'voltou para rascunho', auth.uid());
end $fn$;

-- ---------------------------------------------------------------------------
-- 3. Excluir — a operação estreita
-- ---------------------------------------------------------------------------

-- Diagnóstico separado da ação: a tela precisa saber ANTES de mostrar o botão
-- se aquele curso é elegível, e por quê não é quando não for.
create or replace function pode_excluir_curso(p_curso uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare v_matriculas int; v_certificados int; v_turmas int;
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;

  select count(*) into v_turmas from turma where curso_id = p_curso;

  select count(*) into v_matriculas
  from matricula m join turma t on t.id = m.turma_id where t.curso_id = p_curso;

  select count(*) into v_certificados
  from certificado c
  join matricula m on m.id = c.matricula_id
  join turma t on t.id = m.turma_id
  where t.curso_id = p_curso;

  return jsonb_build_object(
    'pode', v_matriculas = 0,
    'turmas', v_turmas,
    'matriculas', v_matriculas,
    'certificados', v_certificados
  );
end $fn$;

create or replace function excluir_curso(p_curso uuid, p_confirmacao text)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_titulo text; v_matriculas int;
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;

  select titulo into v_titulo from curso where id = p_curso;
  if v_titulo is null then raise exception 'curso inexistente'; end if;

  -- Confirmação por digitação do título. Não é teatro: é a diferença entre
  -- "cliquei sem ler" e "eu sei qual curso estou apagando". Único ato
  -- irreversível da plataforma, e o único que pede isso.
  if trim(coalesce(p_confirmacao, '')) is distinct from trim(v_titulo) then
    raise exception 'confirmacao nao confere: digite o titulo exato do curso';
  end if;

  -- A TRAVA. Sem ela, o cascade curso->turma->matricula->certificado apagaria
  -- certificados emitidos e quebraria as URLs públicas de validação.
  select count(*) into v_matriculas
  from matricula m join turma t on t.id = m.turma_id where t.curso_id = p_curso;

  if v_matriculas > 0 then
    raise exception
      'este curso tem % matricula(s) e nao pode ser excluido; use arquivar',
      v_matriculas;
  end if;

  -- Registrar ANTES de apagar: depois do delete o curso não existe mais para
  -- ser consultado, e o log é a única memória de que ele existiu.
  insert into log_admin (acao, alvo_tipo, alvo_id, detalhe, justificativa, autor_id)
  values ('exclusao', 'curso', p_curso,
          'EXCLUSAO IRREVERSIVEL do curso "' || v_titulo || '"',
          'curso sem matriculas', auth.uid());

  delete from curso where id = p_curso;
end $fn$;

grant execute on function
  arquivar_curso(uuid, text), desarquivar_curso(uuid),
  excluir_curso(uuid, text), pode_excluir_curso(uuid)
to authenticated;
