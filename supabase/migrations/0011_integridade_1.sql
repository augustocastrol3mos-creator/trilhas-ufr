-- 0011_integridade.sql
--
-- Dois buracos, ambos exploráveis a partir de uma conta de aluno comum:
--
--   A) o bucket "materiais" liberava leitura para QUALQUER conta autenticada,
--      e a exclusão checava o papel ("é instrutor") em vez da autoria
--      ("esse material é seu"). Mesma confusão que causou o furo do papel:
--      permissão escrita sobre QUEM VOCÊ É em vez de ISSO É SEU.
--
--   B) registrar_progresso_video gravava o percentual que o cliente mandasse,
--      sem validar o valor. Uma chamada de console com percentual=100 fechava
--      o bloco e, em curso online, disparava a emissão automática do
--      certificado. A autorização existia (e_dono_matricula); faltava
--      validar o VALOR, não o AUTOR.

-- ---------------------------------------------------------------------------
-- A. Materiais
-- ---------------------------------------------------------------------------

-- O path gravado pelo EditorMaterial é "<blocoId>/<uuid>.<ext>", então o
-- primeiro segmento identifica o bloco e, por ele, o curso dono do arquivo.
-- SECURITY DEFINER é obrigatório aqui: "bloco" não tem policy de SELECT para
-- aluno (é assim que o gabarito do quiz fica no servidor), então a função
-- precisa ler a tabela por fora do RLS. auth.uid() continua sendo o do aluno.

create or replace function pode_acessar_material(p_path text)
returns boolean
language plpgsql
stable
security definer
as $$
declare
  v_curso uuid;
begin
  if p_path !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/' then
    return false;
  end if;

  select m.curso_id into v_curso
  from bloco b
  join modulo m on m.id = b.modulo_id
  where b.id = substring(p_path from 1 for 36)::uuid;

  if v_curso is null then
    return false;
  end if;

  if e_admin() or e_autor_do_curso(v_curso) then
    return true;
  end if;

  return exists (
    select 1
    from matricula mt
    join turma t on t.id = mt.turma_id
    where t.curso_id = v_curso
      and mt.usuario_id = auth.uid()
  );
end;
$$;

create or replace function pode_editar_material(p_path text)
returns boolean
language plpgsql
stable
security definer
as $$
declare
  v_curso uuid;
begin
  if p_path !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/' then
    return false;
  end if;

  select m.curso_id into v_curso
  from bloco b
  join modulo m on m.id = b.modulo_id
  where b.id = substring(p_path from 1 for 36)::uuid;

  if v_curso is null then
    return false;
  end if;

  return e_admin() or e_autor_do_curso(v_curso);
end;
$$;

grant execute on function pode_acessar_material(text), pode_editar_material(text)
to authenticated;

drop policy if exists materiais_leitura on storage.objects;
create policy materiais_leitura on storage.objects
  for select to authenticated
  using (bucket_id = 'materiais' and pode_acessar_material(name));

drop policy if exists materiais_escrita on storage.objects;
create policy materiais_escrita on storage.objects
  for insert to authenticated
  with check (bucket_id = 'materiais' and pode_editar_material(name));

drop policy if exists materiais_exclusao on storage.objects;
create policy materiais_exclusao on storage.objects
  for delete to authenticated
  using (bucket_id = 'materiais' and pode_editar_material(name));

-- ---------------------------------------------------------------------------
-- B. Progresso de vídeo com trava de relógio
-- ---------------------------------------------------------------------------

-- Ideia: guardar "iniciadoEm" na primeira chamada e nunca aceitar um
-- percentual maior do que o tempo de relógio permitiria. O teto usa o dobro da
-- velocidade real (tolera o aluno assistindo em 2x) mais 5 pontos de folga
-- para a primeira fatia. O valor é ACHATADO no teto, não recusado: o aluno
-- honesto nunca encosta nele e não vê erro nenhum; quem forja simplesmente
-- não avança.
--
-- Limite honesto desta trava: ela não impede deixar a aba aberta e voltar
-- depois. O que ela faz é subir o custo de zero segundos para
-- (duração / 2). É o mesmo padrão de qualquer plataforma séria — verificação
-- de presença de verdade exigiria checkpoint no meio do vídeo.

create or replace function registrar_progresso_video(
  p_matricula uuid,
  p_bloco uuid,
  p_percentual numeric
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_min       numeric;
  v_duracao   numeric;
  v_maior     numeric;
  v_inicio    timestamptz;
  v_decorrido numeric;
  v_teto      numeric;
  v_pedido    numeric;
begin
  if not e_dono_matricula(p_matricula) then
    raise exception 'nao autorizado';
  end if;

  select coalesce((config->>'percentualMinimo')::numeric, 80),
         nullif((config->>'duracaoSegundos')::numeric, 0)
    into v_min, v_duracao
  from bloco
  where id = p_bloco and tipo = 'video';

  if v_min is null then
    raise exception 'bloco de video inexistente';
  end if;

  -- percentual é percentual: 0..100, venha o que vier do cliente
  v_pedido := least(greatest(coalesce(p_percentual, 0), 0), 100);

  -- garante a linha e carimba o relógio na primeira vez (só na primeira)
  insert into progresso_bloco (matricula_id, bloco_id, estado, dados, atualizado_em)
  values (
    p_matricula, p_bloco, 'em_andamento',
    jsonb_build_object('percentualAssistido', 0, 'iniciadoEm', now()),
    now()
  )
  on conflict (matricula_id, bloco_id) do update
    set dados = case
          when progresso_bloco.dados ? 'iniciadoEm' then progresso_bloco.dados
          else progresso_bloco.dados || jsonb_build_object('iniciadoEm', now())
        end;

  select (dados->>'iniciadoEm')::timestamptz,
         coalesce((dados->>'percentualAssistido')::numeric, 0)
    into v_inicio, v_maior
  from progresso_bloco
  where matricula_id = p_matricula and bloco_id = p_bloco;

  if v_duracao is null then
    v_teto := 100;
  else
    v_decorrido := extract(epoch from (now() - v_inicio));
    v_teto := least(100, (v_decorrido * 2 / v_duracao) * 100 + 5);
  end if;

  -- nunca regride, nunca ultrapassa o teto do relógio
  v_maior := greatest(v_maior, least(v_pedido, v_teto));

  update progresso_bloco
     set dados = dados || jsonb_build_object('percentualAssistido', round(v_maior, 2)),
         estado = case
           when estado = 'concluido' then 'concluido'
           else 'em_andamento'::status_progresso
         end,
         atualizado_em = now()
   where matricula_id = p_matricula and bloco_id = p_bloco;

  if v_maior >= v_min then
    update progresso_bloco
       set estado = 'concluido', atualizado_em = now()
     where matricula_id = p_matricula
       and bloco_id = p_bloco
       and estado <> 'concluido';
    perform atualizar_status_matricula(p_matricula);
  end if;

  return jsonb_build_object(
    'percentual', round(v_maior, 2),
    'concluido', v_maior >= v_min
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- C. Backfill
-- ---------------------------------------------------------------------------

-- Seção 9 do ESTADO_DO_PROJETO: "migration que muda comportamento automático
-- precisa de backfill". Esta é uma delas, e já mordeu duas vezes antes.
--
-- As linhas de progresso que já existem não têm "iniciadoEm". Na próxima
-- chamada o carimbo seria now(), o tempo decorrido seria zero e o teto cairia
-- para 5% — travando quem já está com 60% assistidos até o relógio novo
-- alcançar o progresso antigo. Carimbando no passado, ninguém é punido por
-- ter começado antes da migration existir.

update progresso_bloco pb
   set dados = pb.dados || jsonb_build_object('iniciadoEm', now() - interval '1 day')
  from bloco b
 where b.id = pb.bloco_id
   and b.tipo = 'video'
   and not (pb.dados ? 'iniciadoEm');
