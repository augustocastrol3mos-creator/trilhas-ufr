-- 0035_pendencias.sql
--
-- Corrige um defeito LATENTE desde a 0006, que só disparou agora.
--
-- A CAUSA
--
-- `v_pendencias` é `text[]`, e todas as linhas que acrescentavam uma pendência
-- faziam:
--
--     v_pendencias := v_pendencias || 'alguma frase';
--
-- Com um literal sem tipo declarado, o Postgres resolve o `||` como
-- "array concatenado com array" e tenta converter a frase inteira num array —
-- resultando em `malformed array literal`. A forma correta e sem ambiguidade é
-- `array_append`.
--
-- POR QUE SÓ APARECEU AGORA
--
-- Todas as seis pendências estavam quebradas, e nenhuma nunca havia disparado:
-- um curso chega em validar_publicacao já com módulo, com bloco obrigatório e
-- com turma — o criar_curso cria uma automaticamente. A checagem de categoria
-- acrescentada pela 0023 foi a PRIMEIRA a disparar de verdade, porque todo
-- curso criado antes da 0022 tem categoria_id nulo.
--
-- E o erro se propagou para longe da origem: meu_inicio() chama
-- validar_publicacao() para contar cursos prontos para publicar, então a página
-- inicial inteira parava de carregar os dados pessoais — mostrando "0h" e
-- "0 certificados" para quem tinha 35h e um certificado.
--
-- A LIÇÃO
--
-- Caminho de erro que nunca executa não está testado, está apenas silencioso.
-- Estas seis linhas passaram por build, deploy e meses de uso sem nunca rodar.

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
    v_pendencias := array_append(v_pendencias, 'O curso precisa de ao menos um módulo.');
  end if;

  select
    count(*) filter (where b.obrigatorio),
    count(*) filter (where b.pontuavel),
    count(*) filter (where b.tipo = 'envio')
  into v_obrig, v_pontuavel, v_envios
  from modulo mo join bloco b on b.modulo_id = mo.id
  where mo.curso_id = p_curso;

  if coalesce(v_obrig, 0) = 0 then
    v_pendencias := array_append(v_pendencias, 'Nenhum bloco obrigatório: a trilha não teria trava nem conclusão.');
  end if;

  if v_curso.emissao = 'automatica' and coalesce(v_pontuavel, 0) = 0 then
    v_pendencias := array_append(v_pendencias, 'Emissão automática exige ao menos um bloco pontuável (um quiz).');
  end if;

  if v_curso.modalidade = 'online' and coalesce(v_envios, 0) > 0 then
    v_pendencias := array_append(v_pendencias, 'Curso 100% online não pode ter bloco de envio: sem professor de plantão, o aluno trava esperando correção.');
  end if;

  if not exists (select 1 from curso where id = p_curso and categoria_id is not null) then
    v_pendencias := array_append(v_pendencias, 'O curso precisa de uma categoria.');
  end if;

  if not exists (select 1 from turma where curso_id = p_curso) then
    v_pendencias := array_append(v_pendencias, 'O curso precisa de ao menos uma turma.');
  end if;

  return jsonb_build_object(
    'ok', array_length(v_pendencias, 1) is null,
    'pendencias', to_jsonb(v_pendencias)
  );
end $fn$;

insert into migration_aplicada (nome) values ('0035_pendencias.sql')
on conflict (nome) do nothing;
