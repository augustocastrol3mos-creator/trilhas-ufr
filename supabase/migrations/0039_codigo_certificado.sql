-- 0039_codigo_certificado.sql
--
-- Aumenta o código de validação de 6 para 10 caracteres.
--
-- O PROBLEMA
--
-- O prefixo é previsível (`UFR-2026-`), então toda a entropia vinha dos 6
-- caracteres finais num alfabeto de 31 símbolos: cerca de 900 milhões de
-- combinações.
--
-- Parece muito, e não é — porque a validação é PÚBLICA e SEM LIMITE DE
-- TENTATIVAS, que é o desenho correto para o que ela faz. Com alguns milhares
-- de certificados emitidos, a chance de um palpite acertar deixa de ser
-- desprezível: um script testando códigos encontra um válido de tempos em
-- tempos. E cada acerto revela nome, RGA e curso de uma pessoa real.
--
-- Com 10 caracteres, são ~820 trilhões de combinações — quatro ordens de
-- grandeza acima, e o custo é uma linha.
--
-- POR QUE NÃO LIMITAR AS TENTATIVAS EM VEZ DISSO
--
-- Seria tratar como abuso o uso legítimo. A página de validação existe para
-- quem não tem conta conferir um documento; qualquer limite por IP atingiria a
-- secretaria que confere trinta certificados de uma turma numa tarde. Entropia
-- não tem esse efeito colateral.
--
-- CERTIFICADOS JÁ EMITIDOS NÃO MUDAM. São imutáveis por desenho, e os códigos
-- antigos continuam válidos — apenas mais curtos. Isso é aceitável porque hoje
-- todos são de teste; depois do reset, todos os reais nascem com 10.

create or replace function gerar_codigo_certificado()
returns text language plpgsql volatile set search_path = public as $fn$
declare
  -- Sem I, L, O, 0 e 1: o código é lido em voz alta e digitado a partir de
  -- papel impresso, e esses cinco são os que as pessoas confundem.
  v_alfabeto text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_sufixo   text;
  v_codigo   text;
  i          int;
begin
  loop
    v_sufixo := '';
    for i in 1..10 loop
      v_sufixo := v_sufixo || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::int, 1);
    end loop;

    -- Um hífen no meio do sufixo: ninguém copia 10 caracteres corridos sem
    -- errar, e quem digita a partir do papel agradece o agrupamento.
    v_codigo := 'UFR-' || to_char(now(), 'YYYY') || '-'
                || substr(v_sufixo, 1, 5) || '-' || substr(v_sufixo, 6, 5);

    exit when not exists (select 1 from certificado where codigo = v_codigo);
  end loop;

  return v_codigo;
end $fn$;

-- A busca já é case-insensitive em validar_certificado (upper() nos dois
-- lados), então quem digitar em minúsculas continua encontrando.

insert into migration_aplicada (nome) values ('0039_codigo_certificado.sql')
on conflict (nome) do nothing;
