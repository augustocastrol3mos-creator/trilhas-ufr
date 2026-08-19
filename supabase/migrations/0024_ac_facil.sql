-- 0024_ac_facil.sql
--
-- Liga o Trilhas ao AC Fácil — o app que reúne os certificados do aluno e gera
-- o comprovante em PDF para o processo no SEI.
--
-- POR QUE EM `configuracao` E NÃO NO CÓDIGO
--
-- A URL de hoje é `ac-facil-production.up.railway.app`, um subdomínio gerado
-- pela plataforma de hospedagem. Endereço assim muda: ao migrar de plano, ao
-- adotar domínio próprio, ao trocar de provedor. Fixar no código significaria
-- que trocar de endereço vira commit, build e deploy — e, se ninguém lembrar,
-- vira um botão quebrado que manda o aluno para lugar nenhum bem no momento em
-- que ele está tentando entregar documento à universidade.
--
-- Na tabela, a coordenação troca com um UPDATE. E vazio esconde o botão, o que
-- também serve para desligar a integração se o AC Fácil sair do ar.

alter table configuracao add column if not exists url_ac_facil text;
alter table configuracao add column if not exists rotulo_ac_facil text;

comment on column configuracao.url_ac_facil is
  'URL do AC Fácil. Vazio ou nulo esconde o botão na tela de certificados.';

update configuracao set
  url_ac_facil = coalesce(nullif(url_ac_facil, ''), 'https://ac-facil-production.up.railway.app/'),
  rotulo_ac_facil = coalesce(nullif(rotulo_ac_facil, ''),
                             'Como lançar suas atividades complementares no SEI')
where id;

-- Leitura: a policy de `configuracao` criada na 0011 já libera SELECT para
-- todos e restringe a escrita a e_admin(). Nada a fazer aqui.

insert into migration_aplicada (nome) values ('0024_ac_facil.sql')
on conflict (nome) do nothing;
