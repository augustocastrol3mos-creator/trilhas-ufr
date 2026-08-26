# Operação do Trilhas UFR

O que precisa ser feito para a plataforma sair de piloto e entrar em uso real, e
o que precisa ser feito continuamente depois disso.

Este arquivo é para quem **opera**, não para quem programa. A parte técnica está
em `ARQUITETURA.md`.

---

## Parte 1 — A virada para uso real

A ordem importa. Inverter os passos 3 e 5 apaga o trabalho da equipe.

### 1. Contas institucionais

**Este é o item que leva mais tempo e o único que não depende de código.**

Hoje o Supabase, a Vercel e o GitHub provavelmente estão em conta pessoal. Isso
significa que a plataforma morre quando a pessoa sair, por mais bem escrita que
esteja: o projeto Supabase no plano gratuito **pausa após dias sem atividade** e
pode acabar removido, e a recuperação de senha vai para o celular de alguém.

- [ ] Supabase, Vercel e GitHub em conta institucional (via PROTIC)
- [ ] **Plano pago do Supabase** — custo recorrente, precisa entrar em orçamento
- [ ] Credenciais em cofre que a coordenação controle
- [ ] Um contato técnico nomeado

### 2. Antes de emitir qualquer certificado real

- [ ] `/admin/configuracao` — nome do órgão emissor, quem assina, e
      **principalmente o endereço de validação**. O valor de fábrica é
      `localhost`, e com ele o QR code de todo certificado aponta para lugar
      nenhum. A tela avisa quando algo ainda está no padrão.
- [ ] **Redirect URLs no painel do Supabase** (Authentication → URL
      Configuration). Acrescente `https://<endereço>/auth/callback` à allowlist.
      É o que faz o link de qualquer e-mail — confirmar cadastro, redefinir
      senha, trocar e-mail — voltar para a tela certa. Sem isso, o Supabase
      ignora o destino pedido e o link não resolve nada. **Faça este antes do
      próximo**, nesta ordem.
- [ ] Confirmação de e-mail religada no Supabase (Authentication → Providers).
      Enquanto estiver desligada, qualquer pessoa se cadastra com qualquer
      endereço e o nome impresso no certificado é autodeclarado.
- [ ] Recuperação de senha — já existe em `/login` → "Esqueci minha senha".
      Teste com um endereço real antes de liberar a equipe: é o item que, se
      falhar, transforma quem administra no serviço de reset de senha de todo
      aluno que esquecer.
- [ ] Chave de assinatura das credenciais gerada e guardada
      (`node scripts/gerar-chave-credencial.mjs`, valor em
      `CREDENCIAL_CHAVE_PRIVADA` na Vercel, marcado como *Sensitive*)

### 3. Limpar os dados de teste

`supabase/scripts/reset_piloto.sql` apaga todos os cursos e certificados atuais.

⚠️ **Precisa acontecer ANTES de a equipe começar a criar cursos.** Ele não
distingue teste de real — se a ordem inverter, o trabalho da equipe some junto.

Antes de rodar, baixe o livro de certificados em `/admin/dados`, mesmo sendo
dado de teste: é o ensaio da rotina que passa a valer depois.

### 4. Contas de professor

Cadastre a equipe e conceda o papel em `/admin/usuarios`. Todo cadastro novo
nasce como aluno.

### 5. A equipe começa

Só agora. Mande o link de `/professor/guia` junto.

---

## Parte 2 — A rotina que não pode falhar

### Baixar o livro de certificados

**Uma vez por semestre, e sempre que uma turma for fechada.** Em `/admin/dados`
→ Livro de certificados → guardar no drive da coordenação.

É a única coisa desta lista que **não tem conserto depois**. Se a plataforma sair
do ar, for perdida ou substituída, esse arquivo é a prova de que os certificados
existiram — com o código de cada um, que é o que permite conferi-los.

Guarde junto:
- `scripts/verificar-credencial.mjs`
- A chave pública do emissor (`<endereço>/emissor/chaves`)

Com esses três, os certificados continuam comprováveis mesmo sem a plataforma.

### Manter a configuração em dia

**Sempre que a coordenação mudar**, atualize o nome de quem assina em
`/admin/configuracao`. Certificado assinado por quem não está mais no cargo gera
dúvida legítima.

Certificados já emitidos **não mudam** quando essa tela é alterada. É
proposital: documento entregue precisa continuar valendo o que dizia.

### Olhar a fila

- `/admin/solicitacoes` — pedidos de correção de nome e RGA
- `/admin/cursos` — cursos prontos para publicar
- `/admin/avisos` — avisos vencidos que ainda estão no ar

---

## Parte 3 — O que fazer quando

### Um aluno diz que o nome do certificado está errado
Se ainda não recebeu, oriente a pedir correção no próprio perfil — chega em
`/admin/solicitacoes`. Se o certificado já saiu, é caso de revogar e reemitir em
`/admin/certificados`. Certificado não se edita.

### Alguém precisa conferir um certificado e não confia na tela
Na página de validação há o botão de baixar a credencial assinada, e em
`/validar/arquivo` dá para conferir a assinatura de um arquivo. Para conferência
totalmente independente, use o script de linha de comando com a chave pública.

### Um professor saiu da instituição
Os cursos continuam com ele como autor. Troque o instrutor responsável nas
turmas ativas. Se o curso não for mais ofertado, **arquive** — nunca exclua.

### Precisam tirar um curso do ar
**Arquivar**, não excluir. Arquivar tira do catálogo, preserva quem já está
matriculado e os certificados, e é reversível. Ao arquivar, a coordenação
escolhe se quem está no meio ainda pode concluir:

- *Pode concluir* — para quando o curso apenas não será mais ofertado
- *Não pode* — para quando o conteúdo está errado ou desatualizado

### A plataforma está fora do ar
Não há nada a fazer pela interface. Acione o contato técnico. Enquanto isso, o
livro de certificados baixado responde qualquer consulta sobre certificados já
emitidos.

### Ninguém mais mantém o sistema
Baixe as três exportações de `/admin/dados` e guarde junto da chave pública e do
verificador. Com esses arquivos os certificados emitidos continuam comprováveis
indefinidamente.

---

## Parte 4 — Para a equipe permanente

A partir de 2027 o Trilhas passa a ser extensão permanente, com equipe rotativa.
O risco deixa de ser abandono e passa a ser **perda de memória**: gente nova todo
ano, sem contato com quem construiu.

Três coisas que sustentam isso:

**Manter o `ESTADO_DO_PROJETO.md` atualizado é parte do trabalho.** Não é
burocracia — é o único arquivo que registra o *porquê* das decisões, e nenhum
código conta isso. Documento que só uma pessoa mantém morre com ela.

**Criar um segundo projeto Supabase para homologação.** Hoje só existe produção,
e toda migration é rodada direto no banco real. Funcionou enquanto os dados eram
de teste; com certificados reais dentro, é risco desnecessário. O plano gratuito
basta — se pausar por inatividade, tudo bem.

**Quando um bug revelar um padrão, escrever o padrão** na seção 4 do
`ESTADO_DO_PROJETO`, não só corrigir o caso. Aquela seção existe porque cada
item dela custou pelo menos um build quebrado ou um bug em produção — e ler é
mais barato que repetir.
