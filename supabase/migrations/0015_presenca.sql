-- 0015_presenca.sql
--
-- `matricula.presenca_confirmada` existe desde a 0005, mas é escrita em
-- EXATAMENTE UM lugar: dentro de fechar_turma. Antes do fechamento ela é
-- `false` para todo mundo, por default.
--
-- A consequência não é só "o aluno não vê". É que a presença não tem vida
-- própria: o professor só consegue registrá-la no instante em que fecha a
-- turma. Encontro em agosto, fechamento em outubro — ele marca de memória ou
-- de uma lista de papel. E se um aluno contestar, não há nada na plataforma
-- para apontar, nem para ele nem para o professor.
--
-- A frase fundadora diz que a cadeia é trilha -> avaliação -> presença
-- confirmada -> certificado. Dos quatro elos, três são visíveis e
-- verificáveis pelo aluno a qualquer momento. Este era o único invisível.
--
-- Nada em fechar_turma muda. turma_alunos já devolve presenca_confirmada
-- (linha 121 da 0005) e a tela de fechamento já lê dali — então presença
-- gravada antes aparece pré-marcada no fechamento sozinha. Era o desenho
-- certo desde o começo; só faltava alguém escrever a coluna mais cedo.

alter table matricula add column if not exists presenca_em  timestamptz;
alter table matricula add column if not exists presenca_por uuid references usuario(id);

-- ---------------------------------------------------------------------------
-- Registrar presença
-- ---------------------------------------------------------------------------

-- Em lote, porque o ato real é "conferir a lista do encontro", não "marcar um
-- aluno". Uma chamada por aluno numa turma de 40 seria 40 idas ao servidor e
-- 40 chances de o professor sair da tela no meio, com a lista pela metade.
--
-- Quem pode: instrutor da turma ou coordenação. Mesma autorização de
-- turma_alunos, para as duas telas nunca discordarem sobre quem entra.

create or replace function registrar_presenca(p_turma uuid, p_presencas jsonb)
returns int language plpgsql security definer set search_path = public as $fn$
declare
  d          jsonb;
  v_turma    turma%rowtype;
  v_n        int := 0;
  v_presente boolean;
begin
  select * into v_turma from turma where id = p_turma;
  if v_turma.id is null then raise exception 'turma inexistente'; end if;

  if not (e_admin() or e_instrutor_da_turma(p_turma)) then
    raise exception 'nao autorizado';
  end if;

  -- Turma encerrada tem nota congelada e certificado emitido. Mudar presença
  -- depois seria alterar a premissa de uma decisão já tomada — mesma regra do
  -- certificado imutável. Corrige-se reabrindo a turma, não editando.
  if v_turma.status = 'encerrada' then
    raise exception 'turma encerrada; reabra antes de alterar presenca';
  end if;

  for d in select value from jsonb_array_elements(p_presencas) loop
    v_presente := coalesce((d->>'presente')::boolean, false);

    update matricula set
      presenca_confirmada = v_presente,
      -- carimbo só quando presente: "quando foi confirmada" não faz sentido
      -- para ausência, e limpar evita carimbo órfão ao desmarcar
      presenca_em  = case when v_presente then now() else null end,
      presenca_por = case when v_presente then auth.uid() else null end
    where id = (d->>'matricula')::uuid
      and turma_id = p_turma;   -- impede marcar aluno de OUTRA turma

    v_n := v_n + 1;
  end loop;

  return v_n;
end $fn$;

grant execute on function registrar_presenca(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- O aluno lendo a própria presença
-- ---------------------------------------------------------------------------

-- Não precisa de RPC: a política matricula_propria já deixa o aluno ler a
-- própria linha, e presenca_confirmada é coluna dela. O que faltava era a
-- tela pedir o campo. Fica registrado aqui só para quem ler a migration
-- entender por que não há função de leitura correspondente.
