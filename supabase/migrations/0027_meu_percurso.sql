-- 0027_meu_percurso.sql
--
-- Resumo do percurso do próprio aluno, para o perfil.
--
-- POR QUE RPC E NÃO CONSULTA NA TELA
--
-- Somar horas exige cruzar matricula -> turma -> curso e certificado. Feito no
-- código, seriam três consultas e a soma em JavaScript. Feito aqui, é uma
-- viagem só — e, mais importante, o filtro `usuario_id = auth.uid()` mora
-- DENTRO da função. Nenhuma tela precisa lembrar de aplicá-lo, o que já foi a
-- origem de cinco vazamentos neste projeto (seção 3 do ESTADO_DO_PROJETO).
--
-- HORAS: contadas só em matrícula com certificado emitido, não em curso
-- concluído. Para atividade complementar, o que a coordenação aceita é o
-- documento — somar hora de curso terminado sem certificado daria ao aluno um
-- número que a universidade não vai reconhecer, o que é pior que não mostrar.

create or replace function meu_percurso()
returns jsonb language sql stable security definer set search_path = public as $fn$
  select jsonb_build_object(
    'matriculas', (
      select count(*) from matricula m where m.usuario_id = auth.uid()
    ),
    'emAndamento', (
      select count(*) from matricula m
      where m.usuario_id = auth.uid()
        and m.status in ('inscrito', 'em_andamento', 'trilha_concluida')
    ),
    'concluidos', (
      select count(*) from matricula m
      where m.usuario_id = auth.uid()
        and m.status in ('aprovado', 'certificado_emitido')
    ),
    'certificados', (
      select count(*) from certificado c
      join matricula m on m.id = c.matricula_id
      where m.usuario_id = auth.uid() and c.revogado_em is null
    ),
    'horas', coalesce((
      select sum(cu.carga_horaria)
      from certificado ce
      join matricula m on m.id = ce.matricula_id
      join turma t     on t.id = m.turma_id
      join curso cu    on cu.id = t.curso_id
      where m.usuario_id = auth.uid() and ce.revogado_em is null
    ), 0),
    'porCategoria', coalesce((
      select jsonb_agg(x order by x->>'horas' desc)
      from (
        select jsonb_build_object(
                 'nome', coalesce(cat.nome, 'Sem categoria'),
                 'horas', sum(cu.carga_horaria)
               ) as x
        from certificado ce
        join matricula m  on m.id = ce.matricula_id
        join turma t      on t.id = m.turma_id
        join curso cu     on cu.id = t.curso_id
        left join categoria cat on cat.id = cu.categoria_id
        where m.usuario_id = auth.uid() and ce.revogado_em is null
        group by cat.nome
      ) s
    ), '[]'::jsonb)
  );
$fn$;

grant execute on function meu_percurso() to authenticated;

insert into migration_aplicada (nome) values ('0027_meu_percurso.sql')
on conflict (nome) do nothing;
