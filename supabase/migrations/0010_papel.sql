-- 0010_papel.sql
-- Impede que o dono da linha altere colunas que não são dele para alterar.
-- RLS controla LINHA, não COLUNA: a policy usuario_proprio_update
-- (id = auth.uid()) autoriza o update da linha inteira, papel incluso — o que
-- permitia a qualquer aluno rodar no console do navegador:
--     supabase.from('usuario').update({ papel: 'admin' }).eq('id', meuId)
-- e ganhar todos os poderes da coordenação.

create or replace function proteger_campos_usuario()
returns trigger
language plpgsql
as $$
begin
  -- auth.uid() nulo = execução pelo SQL Editor ou service_role (fora do app).
  -- Nesse caminho a alteração é permitida: é o caminho da coordenação por SQL.
  if auth.uid() is null then
    return new;
  end if;

  if new.papel is distinct from old.papel and not e_admin() then
    raise exception 'papel so pode ser alterado pela coordenacao';
  end if;

  -- email vive em auth.users; deixar mudar aqui dessincroniza as duas tabelas
  if new.email is distinct from old.email and not e_admin() then
    raise exception 'email so muda pelo fluxo de autenticacao';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_campos_usuario on usuario;

create trigger trg_proteger_campos_usuario
  before update on usuario
  for each row execute function proteger_campos_usuario();
