-- 0032_inicio.sql
--
-- Três coisas que a página inicial precisa e o banco ainda não oferecia:
-- capa de curso, destaque curado pela coordenação, e os dados de "o que está
-- acontecendo comigo" — que hoje existem espalhados e nunca são mostrados
-- juntos.

-- ---------------------------------------------------------------------------
-- 1. Capa
-- ---------------------------------------------------------------------------

alter table curso add column if not exists capa_url text;

-- Bucket PÚBLICO, diferente de `materiais`. Capa aparece no catálogo, que é
-- aberto a visitante sem conta — não há como exigir matrícula para vê-la.
insert into storage.buckets (id, name, public)
values ('capas', 'capas', true)
on conflict (id) do nothing;

-- O path é "<cursoId>/<arquivo>", então o primeiro segmento identifica o curso.
-- Mesmo desenho de pode_acessar_material (0011): a autorização deriva do path,
-- nunca do que o cliente afirma.
create or replace function pode_editar_capa(p_path text)
returns boolean language plpgsql stable security definer set search_path = public as $fn$
declare v_curso uuid;
begin
  if p_path !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/' then
    return false;
  end if;
  v_curso := substring(p_path from 1 for 36)::uuid;
  return e_admin() or e_autor_do_curso(v_curso);
end $fn$;

grant execute on function pode_editar_capa(text) to authenticated;

drop policy if exists capas_leitura on storage.objects;
create policy capas_leitura on storage.objects
  for select using (bucket_id = 'capas');

drop policy if exists capas_escrita on storage.objects;
create policy capas_escrita on storage.objects
  for insert to authenticated
  with check (bucket_id = 'capas' and pode_editar_capa(name));

drop policy if exists capas_atualizacao on storage.objects;
create policy capas_atualizacao on storage.objects
  for update to authenticated
  using (bucket_id = 'capas' and pode_editar_capa(name));

drop policy if exists capas_exclusao on storage.objects;
create policy capas_exclusao on storage.objects
  for delete to authenticated
  using (bucket_id = 'capas' and pode_editar_capa(name));

-- ---------------------------------------------------------------------------
-- 2. Destaque
-- ---------------------------------------------------------------------------

-- `destaque_nota` é obrigatória quando o destaque está ativo, e é ela que
-- separa curadoria de vitrine: "por que este curso agora" é o que o aluno lê.
-- Sem justificativa, destaque vira apenas "olha esse", e um espaço que sempre
-- diz a mesma coisa deixa de ser olhado.
alter table curso add column if not exists destaque_nota text;
alter table curso add column if not exists destacado_em timestamptz;

create index if not exists idx_curso_destaque on curso (destacado_em desc nulls last);

create or replace function definir_destaque(p_curso uuid, p_nota text)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_nota text; v_status text; v_titulo text;
begin
  if not e_admin() then raise exception 'acao exclusiva da coordenacao'; end if;

  select status, titulo into v_status, v_titulo from curso where id = p_curso;
  if v_status is null then raise exception 'curso inexistente'; end if;

  v_nota := nullif(trim(coalesce(p_nota, '')), '');

  -- nota vazia = remover o destaque
  if v_nota is null then
    update curso set destaque_nota = null, destacado_em = null where id = p_curso;
    return;
  end if;

  if v_status <> 'publicado' then
    raise exception 'so curso publicado pode ser destacado';
  end if;

  if length(v_nota) < 15 then
    raise exception 'escreva por que este curso merece destaque (minimo 15 caracteres)';
  end if;

  update curso set destaque_nota = v_nota, destacado_em = now() where id = p_curso;
end $fn$;

grant execute on function definir_destaque(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Vitrine: destaques, ou rotação diária quando não houver
-- ---------------------------------------------------------------------------

-- A rotação usa a DATA como semente. Sorteio a cada carregamento faria o bloco
-- mudar toda vez que a pessoa atualizasse a página — o que lê como defeito, não
-- como curadoria. Com semente diária, muda uma vez por dia e todo mundo vê o
-- mesmo conjunto, o que é conversável ("viu o curso que está lá hoje?").
create or replace function vitrine_inicio()
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare v_destaques jsonb; v_rotacao jsonb; v_novidades jsonb;
begin
  select coalesce(jsonb_agg(x order by x->>'destacadoEm' desc), '[]'::jsonb)
    into v_destaques
  from (
    select jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'titulo', c.titulo,
      'descricao', c.descricao, 'cargaHoraria', c.carga_horaria,
      'modalidade', c.modalidade, 'capaUrl', c.capa_url,
      'categoria', cat.nome, 'nota', c.destaque_nota,
      'destacadoEm', c.destacado_em
    ) as x
    from curso c
    left join categoria cat on cat.id = c.categoria_id
    where c.status = 'publicado' and c.destaque_nota is not null
    limit 3
  ) s;

  -- Só sorteia se não houver curadoria.
  if jsonb_array_length(v_destaques) = 0 then
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v_rotacao
    from (
      select jsonb_build_object(
        'id', c.id, 'slug', c.slug, 'titulo', c.titulo,
        'descricao', c.descricao, 'cargaHoraria', c.carga_horaria,
        'modalidade', c.modalidade, 'capaUrl', c.capa_url,
        'categoria', cat.nome
      ) as x
      from curso c
      left join categoria cat on cat.id = c.categoria_id
      where c.status = 'publicado'
      -- md5(id || data) é estável dentro do dia e diferente a cada dia
      order by md5(c.id::text || current_date::text)
      limit 3
    ) s;
  else
    v_rotacao := '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(x order by x->>'criadoEm' desc), '[]'::jsonb)
    into v_novidades
  from (
    select jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'titulo', c.titulo,
      'cargaHoraria', c.carga_horaria, 'modalidade', c.modalidade,
      'capaUrl', c.capa_url, 'categoria', cat.nome, 'criadoEm', c.criado_em
    ) as x
    from curso c
    left join categoria cat on cat.id = c.categoria_id
    where c.status = 'publicado'
    order by c.criado_em desc
    limit 4
  ) s;

  return jsonb_build_object(
    'destaques', v_destaques,
    'rotacao', v_rotacao,
    'novidades', v_novidades
  );
end $fn$;

grant execute on function vitrine_inicio() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. O que está acontecendo comigo
-- ---------------------------------------------------------------------------

-- Uma função só, que ramifica pelo papel. A página inicial era idêntica para
-- aluno, professor e coordenação — três pessoas com perguntas completamente
-- diferentes ao abrir o sistema.
--
-- O filtro por dono mora aqui dentro, como em meu_percurso e meus_avisos.

create or replace function meu_inicio()
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare v_papel text; v_out jsonb;
begin
  select u.papel::text into v_papel from usuario u where u.id = auth.uid();
  if v_papel is null then return '{}'::jsonb; end if;

  v_out := jsonb_build_object('papel', v_papel);

  -- ---------- aluno (todo mundo tem esta parte) ----------
  v_out := v_out || jsonb_build_object(
    'emAndamento', coalesce((
      select jsonb_agg(x order by x->>'atualizadoEm' desc) from (
        select jsonb_build_object(
          'matriculaId', m.id,
          'cursoTitulo', cu.titulo,
          'capaUrl', cu.capa_url,
          'categoria', cat.nome,
          'total', (select count(*) from bloco b
                    join modulo mo on mo.id = b.modulo_id
                    where mo.curso_id = cu.id),
          'concluidos', (select count(*) from progresso_bloco pb
                         where pb.matricula_id = m.id and pb.estado = 'concluido'),
          'atualizadoEm', coalesce((select max(pb.atualizado_em) from progresso_bloco pb
                                    where pb.matricula_id = m.id), m.criado_em)
        ) as x
        from matricula m
        join turma t  on t.id = m.turma_id
        join curso cu on cu.id = t.curso_id
        left join categoria cat on cat.id = cu.categoria_id
        where m.usuario_id = auth.uid()
          and m.status in ('inscrito', 'em_andamento', 'trilha_concluida')
        limit 4
      ) s
    ), '[]'::jsonb),

    'proximosEncontros', coalesce((
      select jsonb_agg(x order by x->>'data') from (
        select jsonb_build_object(
          'data', e.data, 'local', e.local, 'titulo', e.titulo,
          'cursoTitulo', cu.titulo, 'turma', t.identificador,
          'presente', exists (select 1 from presenca p
                              where p.encontro_id = e.id and p.matricula_id = m.id
                                and p.presente)
        ) as x
        from encontro e
        join turma t     on t.id = e.turma_id
        join curso cu    on cu.id = t.curso_id
        join matricula m on m.turma_id = t.id and m.usuario_id = auth.uid()
        where e.data >= now() - interval '2 hours'
        limit 3
      ) s
    ), '[]'::jsonb),

    'presencaPendente', coalesce((
      select jsonb_agg(x) from (
        select jsonb_build_object(
          'cursoTitulo', cu.titulo,
          'presentes', (select count(*) from presenca p
                        join encontro e on e.id = p.encontro_id
                        where p.matricula_id = m.id and e.turma_id = t.id and p.presente),
          'total', (select count(*) from encontro e where e.turma_id = t.id),
          'minima', t.presenca_minima
        ) as x
        from matricula m
        join turma t  on t.id = m.turma_id
        join curso cu on cu.id = t.curso_id
        where m.usuario_id = auth.uid()
          and cu.modalidade = 'hibrido'
          and not m.presenca_confirmada
          and m.status in ('inscrito', 'em_andamento', 'trilha_concluida')
          and exists (select 1 from encontro e where e.turma_id = t.id)
        limit 3
      ) s
    ), '[]'::jsonb),

    'horas', coalesce((
      select sum(cu.carga_horaria)
      from certificado ce
      join matricula m on m.id = ce.matricula_id
      join turma t     on t.id = m.turma_id
      join curso cu    on cu.id = t.curso_id
      where m.usuario_id = auth.uid() and ce.revogado_em is null
    ), 0),

    'certificados', (
      select count(*) from certificado c
      join matricula m on m.id = c.matricula_id
      where m.usuario_id = auth.uid() and c.revogado_em is null
    )
  );

  -- ---------- professor ----------
  if v_papel in ('instrutor', 'admin') then
    v_out := v_out || jsonb_build_object(
      'chamadasPendentes', coalesce((
        select jsonb_agg(x order by x->>'data') from (
          select jsonb_build_object(
            'turmaId', t.id, 'turma', t.identificador, 'cursoTitulo', cu.titulo,
            'encontro', e.titulo, 'data', e.data
          ) as x
          from encontro e
          join turma t  on t.id = e.turma_id
          join curso cu on cu.id = t.curso_id
          where e.data < now()
            and t.status <> 'encerrada'
            and (e_admin() or t.instrutor_id = auth.uid() or cu.autor_id = auth.uid())
            and not exists (select 1 from presenca p where p.encontro_id = e.id and p.presente)
          limit 4
        ) s
      ), '[]'::jsonb),

      'turmasAtivas', (
        select count(*) from turma t
        join curso cu on cu.id = t.curso_id
        where t.status <> 'encerrada'
          and (e_admin() or t.instrutor_id = auth.uid() or cu.autor_id = auth.uid())
      )
    );
  end if;

  -- ---------- coordenação ----------
  if v_papel = 'admin' then
    v_out := v_out || jsonb_build_object(
      'solicitacoesPendentes', (
        select count(*) from solicitacao_dado where status = 'pendente'
      ),
      -- Não existe estado "aguardando autorização" no schema: o professor
      -- prepara em rascunho e a coordenação publica. O número acionável é
      -- quantos rascunhos JÁ PASSARIAM em validar_publicacao — esses estão
      -- esperando uma decisão, não trabalho do autor.
      'cursosProntos', (
        select count(*) from curso c
        where c.status = 'rascunho'
          and (validar_publicacao(c.id)->>'ok')::boolean
      ),
      'destaquesAtivos', (
        select count(*) from curso where destaque_nota is not null and status = 'publicado'
      )
    );
  end if;

  return v_out;
end $fn$;

grant execute on function meu_inicio() to authenticated;

insert into migration_aplicada (nome) values ('0032_inicio.sql')
on conflict (nome) do nothing;
