-- 0037_apresentacao_materiais.sql
--
-- Duas lacunas de entrada e de consulta na trilha.
--
-- ===========================================================================
-- 1. APRESENTAÇÃO
-- ===========================================================================
--
-- A trilha começava direto na lista de módulos. Não foi decisão de desenho —
-- o modelo era "seis tipos de bloco empilhados em módulos", e o ponto de
-- entrada simplesmente nunca foi pensado.
--
-- O contorno natural é o professor fazer do módulo 1 uma introdução, e ele tem
-- um custo específico: a introdução vira uma ETAPA A CONCLUIR em vez de uma
-- REFERÊNCIA A CONSULTAR. O aluno marca como feita, avança, e nada nunca mais
-- o traz de volta — junto com as regras de avaliação e as datas do encontro,
-- que são exatamente o que ele vai querer reler depois.
--
-- Um campo próprio resolve o que módulo nenhum resolve: não ser uma etapa.
--
-- ===========================================================================
-- 2. MATERIAIS
-- ===========================================================================
--
-- Material de apoio dentro de um módulo ficava atrás da trava sequencial:
-- planilha modelo no módulo 3 era inalcançável para quem estava no 1, e
-- depois de concluir o curso só se achava navegando de volta para dentro do
-- módulo. O tipo `material` existe, mas o lugar dele (dentro da sequência)
-- brigava com a natureza dele (referência, consultada a qualquer momento).
--
-- A prateleira agrupa os materiais POR MÓDULO e destrava junto com eles —
-- mesma regra de `modulos_trilha`, não uma segunda regra paralela. Material de
-- módulo travado aparece com o nome e a indicação de quando libera: saber que
-- existe uma planilha à frente é motivação, e nome de arquivo não é spoiler.
--
-- E há um marcador `sempreDisponivel`, para o guia do curso e o glossário —
-- coisas que se usam desde o primeiro dia. Ele é EXCEÇÃO, não padrão: como o
-- comportamento natural (destravar com o módulo) já é o correto, ligar por
-- padrão só criaria risco de expor gabarito por descuido.
--
-- NADA DE PERMISSÃO NOVA. A policy do Storage (0011) já exige apenas matrícula
-- no curso, nunca conclusão de módulo — o aluno SEMPRE teve direito ao arquivo.
-- O que faltava era ele conseguir chegar até a lista.

alter table curso add column if not exists apresentacao text;

comment on column curso.apresentacao is
  'Texto em Markdown exibido no topo da trilha, sempre acessível. Não é uma etapa: não conta progresso nem precisa ser concluído.';

-- ---------------------------------------------------------------------------
-- A prateleira
-- ---------------------------------------------------------------------------

create or replace function materiais_do_curso(p_matricula uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare v_curso uuid; v_out jsonb;
begin
  if not e_dono_matricula(p_matricula) then
    raise exception 'nao autorizado';
  end if;

  select c.id into v_curso
  from matricula m
  join turma t on t.id = m.turma_id
  join curso c on c.id = t.curso_id
  where m.id = p_matricula;

  -- `base` e `marcado` são cópia literal da lógica de modulos_trilha. Copiar em
  -- vez de recalcular de outro jeito é proposital: duas regras de destrave que
  -- divergem seriam pior do que uma repetida — o aluno veria o módulo aberto na
  -- trilha e o material fechado na prateleira, sem entender por quê.
  with base as (
    select mo.id, mo.ordem, mo.titulo,
      count(b.id) filter (where b.obrigatorio)::int as total_obrigatorios,
      count(pb.id) filter (where b.obrigatorio and pb.estado = 'concluido')::int as concluidos
    from modulo mo
    left join bloco b on b.modulo_id = mo.id
    left join progresso_bloco pb
           on pb.bloco_id = b.id and pb.matricula_id = p_matricula
    where mo.curso_id = v_curso
    group by mo.id, mo.ordem, mo.titulo
  ),
  marcado as (
    select *, (concluidos >= total_obrigatorios) as ok from base
  ),
  liberacao as (
    select m.id, m.ordem, m.titulo,
           not exists (select 1 from marcado p where p.ordem < m.ordem and not p.ok) as liberado
    from marcado m
  )
  select jsonb_agg(x order by (x->>'ordem')::int) into v_out
  from (
    select jsonb_build_object(
      'moduloId', l.id,
      'ordem', l.ordem,
      'titulo', l.titulo,
      'liberado', l.liberado,
      'materiais', (
        select jsonb_agg(
          jsonb_build_object(
            'blocoId', b.id,
            'titulo', b.titulo,
            -- Campos explícitos, nunca o `config` inteiro. Existe
            -- sanitizar_config() no projeto justamente porque config de bloco
            -- pode carregar coisa que não deve sair para o cliente.
            'sempreDisponivel', coalesce((b.config->>'sempreDisponivel')::boolean, false),
            'arquivos', coalesce((
              select jsonb_agg(jsonb_build_object('nome', a->>'nome', 'path', a->>'path'))
              from jsonb_array_elements(coalesce(b.config->'arquivos', '[]'::jsonb)) a
            ), '[]'::jsonb)
          ) order by b.ordem
        )
        from bloco b
        where b.modulo_id = l.id and b.tipo = 'material'
      )
    ) as x
    from liberacao l
    where exists (select 1 from bloco b where b.modulo_id = l.id and b.tipo = 'material')
  ) s;

  return coalesce(v_out, '[]'::jsonb);
end $fn$;

grant execute on function materiais_do_curso(uuid) to authenticated;

insert into migration_aplicada (nome) values ('0037_apresentacao_materiais.sql')
on conflict (nome) do nothing;
