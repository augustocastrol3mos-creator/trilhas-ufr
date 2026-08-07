-- seed.sql — dois cursos de teste. Idempotente: pode rodar quantas vezes quiser.

delete from curso where slug in ('gestao-custos', 'intro-cooperativismo');

-- Curso 1: híbrido, com encontro presencial
insert into curso (id, slug, titulo, descricao, carga_horaria, modalidade, emissao, status)
values (
  '11111111-1111-1111-1111-111111111111',
  'gestao-custos',
  'Gestão de custos para pequenos negócios',
  'Formação de preço, markup e análise de margem. Avaliação final presencial.',
  20, 'hibrido', 'manual', 'publicado'
);

insert into turma (id, curso_id, identificador, tipo, encontro_data, encontro_local, vagas)
values (
  '11111111-2222-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '2026/2', 'coorte', now() + interval '60 days', 'UFR — Bloco A, sala 12', 40
);

insert into modulo (id, curso_id, ordem, titulo, descricao) values
  ('11111111-3333-1111-1111-000000000001', '11111111-1111-1111-1111-111111111111', 1,
   'Fundamentos de custo', 'O que entra no custo de um produto e o que não entra.'),
  ('11111111-3333-1111-1111-000000000002', '11111111-1111-1111-1111-111111111111', 2,
   'Markup e formação de preço', 'Divisor, multiplicador e as armadilhas de cada um.');

insert into bloco (modulo_id, ordem, tipo, titulo, config, obrigatorio, pontuavel) values
  ('11111111-3333-1111-1111-000000000001', 1, 'texto', 'Custo fixo e custo variável',
   '{"markdown":"## Custo fixo e custo variável\n\nCusto **fixo** não muda com o volume produzido: aluguel, salário administrativo, seguro. Ele existe mesmo que você não venda nada no mês.\n\nCusto **variável** acompanha o volume: matéria-prima, embalagem, comissão sobre venda.\n\n> A confusão mais comum é tratar despesa como custo. Despesa é o que mantém a estrutura; custo é o que entra no produto.\n\n### Por que a distinção importa\n\nSem separar os dois você não consegue calcular ponto de equilíbrio, e sem ponto de equilíbrio você não sabe quanto precisa vender para não ter prejuízo."}'::jsonb,
   true, false),

  ('11111111-3333-1111-1111-000000000001', 2, 'checkpoint', 'Compromisso com a trilha',
   '{"texto":"Declaro que li o material e me comprometo a comparecer ao encontro presencial de avaliação.","rotuloBotao":"Li e concordo"}'::jsonb,
   true, false),

  ('11111111-3333-1111-1111-000000000002', 1, 'video', 'Calculando o divisor de markup',
   '{"videoId":"aqz-KE-bpKQ","duracaoSegundos":60,"percentualMinimo":30}'::jsonb,
   true, false),

  ('11111111-3333-1111-1111-000000000002', 2, 'quiz', 'Verificação — markup',
   '{"notaMinima":70,"maxTentativas":3,"mostrarGabarito":"apos_aprovacao","questoes":[
      {"id":"q1","tipo":"multipla_escolha","peso":1,
       "enunciado":"Uma empresa quer margem de 30% sobre o preço de venda. Qual é o divisor de markup?",
       "alternativas":[
         {"id":"a","texto":"0,70","correta":true},
         {"id":"b","texto":"1,30","correta":false},
         {"id":"c","texto":"0,30","correta":false}]},
      {"id":"q2","tipo":"verdadeiro_falso","peso":1,
       "enunciado":"Markup divisor e markup multiplicador, aplicados corretamente, chegam ao mesmo preço final.",
       "resposta":true},
      {"id":"q3","tipo":"multipla_escolha","peso":2,
       "enunciado":"O custo da mercadoria vendida deve entrar no percentual do markup?",
       "alternativas":[
         {"id":"a","texto":"Sim, junto com as despesas","correta":false},
         {"id":"b","texto":"Não, ele é a base sobre a qual o markup é aplicado","correta":true}]}]}'::jsonb,
   true, true);

-- Curso 2: 100% online, certificado automático
insert into curso (id, slug, titulo, descricao, carga_horaria, modalidade, emissao,
                   peso_online, peso_presencial, exige_presenca, nota_minima_final, status)
values (
  '22222222-1111-1111-1111-111111111111',
  'intro-cooperativismo',
  'Introdução ao cooperativismo',
  'Curso permanente, autoinstrucional. Certificado emitido automaticamente.',
  10, 'online', 'automatica', 100, 0, false, 60, 'publicado'
);

insert into turma (id, curso_id, identificador, tipo)
values (
  '22222222-2222-1111-1111-111111111111',
  '22222222-1111-1111-1111-111111111111',
  'continua', 'continua'
);

insert into modulo (id, curso_id, ordem, titulo, descricao) values
  ('22222222-3333-1111-1111-000000000001', '22222222-1111-1111-1111-111111111111', 1,
   'O que é uma cooperativa', 'Princípios, história e diferença para a empresa mercantil.');

insert into bloco (modulo_id, ordem, tipo, titulo, config, obrigatorio, pontuavel) values
  ('22222222-3333-1111-1111-000000000001', 1, 'texto', 'Os sete princípios cooperativistas',
   '{"markdown":"## Os sete princípios\n\n1. Adesão voluntária e livre\n2. Gestão democrática\n3. Participação econômica dos membros\n4. Autonomia e independência\n5. Educação, formação e informação\n6. Intercooperação\n7. Interesse pela comunidade\n\nO segundo princípio é o que mais distingue a cooperativa da sociedade empresária: **um membro, um voto**, independentemente do capital integralizado."}'::jsonb,
   true, false),

  ('22222222-3333-1111-1111-000000000001', 2, 'quiz', 'Verificação final',
   '{"notaMinima":60,"maxTentativas":5,"questoes":[
      {"id":"q1","tipo":"multipla_escolha","peso":1,
       "enunciado":"Na gestão democrática de uma cooperativa, o poder de voto de cada membro é proporcional a quê?",
       "alternativas":[
         {"id":"a","texto":"Ao capital integralizado","correta":false},
         {"id":"b","texto":"A nada: cada membro tem um voto","correta":true},
         {"id":"c","texto":"Ao tempo de associação","correta":false}]}]}'::jsonb,
   true, true);
