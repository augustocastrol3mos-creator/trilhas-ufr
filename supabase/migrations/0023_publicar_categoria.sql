-- 0023_publicar_categoria.sql
--
-- Publicar passa a exigir categoria. Sem isso, um curso sai no catálogo como
-- "Sem categoria" e fica fora de todo filtro — invisível para quem navega por
-- categoria, que é como o catálogo foi desenhado. Com o time criando dezenas de
-- cursos, isso ia acontecer por esquecimento, não por má vontade.
--
-- A checagem vai em validar_publicacao, junto das outras invariantes, e não no
-- formulário: o formulário já marca o campo como obrigatório, mas curso criado
-- antes da 0022 tem categoria_id nulo e passaria direto.
--
-- Reescrita completa da função da 0006 (create or replace exige o corpo
-- inteiro); a única diferença é o bloco de categoria.

create or replace function validar_publicacao(p_curso uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_curso     curso%rowtype;
  v_pendencias text[] := '{}';
  v_modulos   int;
  v_obrig     int;
  v_pontuavel int;
  v_envios    int;
begin
  select * into v_curso from curso where id = p_curso;
  if v_curso.id is null then raise exception 'curso inexistente'; end if;

  select count(*) into v_modulos from modulo where curso_id = p_curso;
  if v_modulos = 0 then
    v_pendencias := v_pendencias || 'O curso precisa de ao menos um módulo.';
  end if;

  select
    count(*) filter (where b.obrigatorio),
    count(*) filter (where b.pontuavel),
    count(*) filter (where b.tipo = 'envio')
  into v_obrig, v_pontuavel, v_envios
  from modulo mo join bloco b on b.modulo_id = mo.id
  where mo.curso_id = p_curso;

  if coalesce(v_obrig, 0) = 0 then
    v_pendencias := v_pendencias || 'Nenhum bloco obrigatório: a trilha não teria trava nem conclusão.';
  end if;

  if v_curso.emissao = 'automatica' and coalesce(v_pontuavel, 0) = 0 then
    v_pendencias := v_pendencias ||
      'Emissão automática exige ao menos um bloco pontuável (um quiz).';
  end if;

  if v_curso.modalidade = 'online' and coalesce(v_envios, 0) > 0 then
    v_pendencias := v_pendencias ||
      'Curso 100% online não pode ter bloco de envio: sem professor de plantão, o aluno trava esperando correção.';
  end if;

  if not exists (select 1 from curso where id = p_curso and categoria_id is not null) then
    v_pendencias := v_pendencias || 'O curso precisa de uma categoria.';
  end if;

  if not exists (select 1 from turma where curso_id = p_curso) then
    v_pendencias := v_pendencias || 'O curso precisa de ao menos uma turma.';
  end if;

  return jsonb_build_object(
    'ok', array_length(v_pendencias, 1) is null,
    'pendencias', to_jsonb(v_pendencias)
  );
end $fn$;

insert into migration_aplicada (nome) values ('0023_publicar_categoria.sql')
on conflict (nome) do nothing;
