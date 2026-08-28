# Trilhas UFR — estado do projeto

**Plataforma de cursos complementares da UFR** (podendo incluir extensão), com
trilha modular e certificado de validação pública.

| | |
|---|---|
| Repositório | `github.com/augustocastrol3mos-creator/trilhas-ufr` (branch `main`, público) |
| Produção | https://trilhas-ufr-chi.vercel.app |
| Pilha | Next.js 16 (App Router, Turbopack) · Supabase (Postgres, Auth, Storage) · Vercel |
| Migrations | 0001 a 0039 (ver seção 5) |

> **Se você é uma IA retomando este projeto, leia a seção 2 antes de qualquer
> coisa.** Ela é o protocolo de trabalho, e ignorá-la já custou caro.

---

## 1. A decisão fundadora

Não é uma plataforma de vídeos. É **um emissor de certificados com
pré-requisitos verificáveis**:

```
trilha com trava → avaliação → presença confirmada → certificado com validação pública
```

Toda decisão de escopo passa por essa frase. Corolário: **cada elo precisa ser
verificável pelo aluno**, não só pelo sistema — foi por isso que a presença
ganhou tela própria.

Modularidade é **composição, não extensão**: seis tipos de bloco fixos que o
professor empilha, não um sistema de plugins.

**O que a plataforma NÃO faz, por decisão:** registrar curso de terceiro (ENAP,
Bradesco, Sebrae). Quem certifica é quem ensinou e avaliou. Para comprovante
externo existe o AC Fácil, que é outro sistema.

---

## 2. Protocolo de trabalho (para IA e para humanos)

Estas regras nasceram de erros reais. Cada uma custou pelo menos um build
quebrado ou um bug em produção.

**Clone o repositório ANTES de começar, não só para conferir depois.**
"Funcionou" e "está no GitHub" são fatos diferentes. Um lote foi construído em
cima de código velho porque o anterior não tinha sido enviado, e sobrescreveu
uma migration inteira.

**Rode `next build`, não só `tsc --noEmit`.** Typecheck não pega import de
arquivo apagado; o build pega. (Se as fontes do Google não estiverem acessíveis
no ambiente, um stub temporário no `layout.tsx` permite compilar.)

**Nem o build pega erro de banco.** Recursão de RLS, constraint violada,
permissão negada — só aparecem com banco respondendo. Migration só é validada
pelo teste real.

**Zip adiciona arquivo, nunca remove.** Ao substituir um componente por outro de
nome diferente, o antigo fica na máquina importando coisa que sumiu. Os comandos
`git rm` vão **no topo** da mensagem, antes das instruções de extrair.

**Mande arquivo inteiro, não trecho.** Edição parcial já perdeu chave de
fechamento várias vezes.

**Depois de cada lote:** arquivos alterados, migration a rodar, roteiro curto de
teste — com o teste de **regressão** antes do de novidade.

**Quando um bug revelar um padrão, nomeie o padrão** na seção 4, não corrija só
o caso pontual.

---

## 3. Arquitetura em uma página

Detalhe completo em `ARQUITETURA.md`. O essencial:

- **Toda lógica sensível vive em função do Postgres (`security definer`)**:
  correção de quiz, cálculo de nota, emissão de certificado, fechamento de
  turma, regras de inscrição, chamada. RLS é rede de segurança; regra de negócio
  é função.
- **O gabarito nunca sai do servidor.** `bloco` não tem policy de SELECT para
  aluno; conteúdo chega sanitizado via RPC.
- **Certificado emitido é imutável** e guarda snapshot (nome, RGA, competências,
  assinante). Erro se corrige revogando e reemitindo.
- **Agregado sobre dado privado vive em `security definer`**: contar
  matriculados exige ler linhas de terceiros que o RLS esconde. O padrão é
  devolver **o número**, nunca as linhas.
- **Três camadas de autorização**: middleware por papel → guarda `exigirAdmin()`
  / `exigirProfessor()` na tela → RLS. Qualquer uma sozinha resolve.

---

## 4. As lições que custaram caro

Esta é a seção mais importante do arquivo, porque é a única que não dá para
reconstruir lendo o código.

### 4.1 RLS responde "qual LINHA", nunca "qual COLUNA"
A policy `usuario_proprio_update (id = auth.uid())` autorizava o update da linha
inteira — **papel incluso**. Qualquer aluno virava coordenação com uma linha no
console. Corrigido com trigger (`0010`). Coluna que o dono da linha não pode
alterar (`papel`, `status`, `nota`, `rga`) se protege com trigger ou GRANT por
coluna, nunca com policy.

### 4.2 Policy que consulta tabela com RLS dispara a policy dela
A `0019` pôs subconsulta em `turma` dentro da policy de `curso`; a de `turma` já
consultava `curso`. Recursão infinita, `/cursos` fora do ar. **Toda checagem
cruzada entre tabelas com RLS mora em função `SECURITY DEFINER`** — que roda
como dono, ignora RLS e encerra a cadeia. Corrigido na `0020`.

### 4.3 Política de leitura ampla vaza em tela que confia só no RLS
Policies permissivas combinam com **OR**. "Admin vê tudo" somou com "vê o que é
seu" e telas passaram a mostrar dado alheio. **Aconteceu cinco vezes.** Toda
consulta a `matricula`, `certificado`, `curso` ou `turma` precisa de
`.eq('usuario_id', user.id)` explícito no código.

### 4.4 A ordem das checagens decide se a regra ajuda ou atrapalha
Em `inscrever()`, "já matriculado nesta turma" é a **primeira** coisa, antes de
vaga, prazo e trava de reinscrição. Sem isso, o aluno de turma lotada perderia
acesso ao próprio curso. Regra nova é escrita pensando em quem entra, e quebra
quem já entrou. Decidiu o desenho três vezes.

### 4.5 Cascade apaga mais do que se imagina
`curso → turma → matricula → certificado`, tudo `on delete cascade`. Um
`delete from curso` apagaria certificados emitidos e quebraria as URLs públicas.
Por isso `excluir_curso` só aceita curso com zero matrículas.

### 4.6 `array || 'literal'` é ambíguo no Postgres
`v_pendencias text[] || 'texto'` — o Postgres lê como array‖array e tenta
converter a frase em array (`malformed array literal`). **Sempre
`array_append`.** Estava latente desde a `0006` e só disparou meses depois,
derrubando a página inicial inteira, porque `meu_inicio()` chama
`validar_publicacao()`.

### 4.7 Parâmetro OUT sombreia coluna em plpgsql
Em `returns table (id uuid, ...)`, `id` vira variável em escopo no corpo. Um
`where id = auth.uid()` resolvia para a variável nula, não para a coluna.
**Em função com `returns table`, qualifique toda coluna com o alias da tabela.**

### 4.8 Caminho de erro que nunca executa não está testado
As seis linhas quebradas da 4.6 passaram por build, deploy e meses de uso sem
nunca rodar. Só a checagem de categoria, que dispara sempre, revelou.

### 4.9 Engolir erro de RPC transforma bug em silêncio
`const { data } = await supabase.rpc(...)` sem checar `error` escondeu três
defeitos: avisos invisíveis, contadores zerados, página inicial vazia. **Sempre
`const { data, error }` e ao menos `console.error`.**

### 4.10 Funcionalidade que liga por interruptor externo nunca foi testada
`cadastrar()` terminava em `redirect('/cursos')` porque, com a confirmação de
e-mail DESLIGADA, o `signUp` devolve sessão na hora. Ligada, ele não devolve — e
a pessoa cairia em `/cursos` deslogada, sem erro, concluiria que o cadastro
falhou e tentaria de novo. Faltava também a rota `/auth/callback` inteira, sem a
qual nenhum link de e-mail funciona (a troca de e-mail do perfil mandava link
desde a `0031` e ele nunca teve destino).

É a 4.8 num lugar pior: aquele caminho não estava só sem teste, estava
**impossível de executar** — e o que o torna executável não é código, é uma
chave num painel de terceiro. Não passa por build, por deploy nem por revisão.
**Toda configuração externa que muda o comportamento do código precisa estar
escrita como pré-requisito de quem for virá-la**, junto do que precisa existir
antes.

### 4.11 Interface duplicada divide o comportamento sem avisar
A página inicial tinha um formulário de acesso próprio (`AcessoHero`), escrito
separadamente do de `/login`. Compartilhavam as server actions, mas cada um
desenhava a própria tela — e o lote da recuperação de senha corrigiu só um. Três
defeitos ficaram vivos num lado só: sem "Esqueci minha senha", ignorando o campo
`aviso` da resposta (então "conta criada, confira seu e-mail" sumia em silêncio),
e sem pedir RGA, o que fazia quem se cadastrava pela home entrar como não-UFR e
depender da fila de aprovação para consertar.

Nenhum dos três quebra build, e nenhum aparece em teste que olha uma tela só.
**Dois componentes que fazem a mesma coisa são um defeito com data marcada** — a
próxima correção vai para um deles. Unificado em `FormularioAcesso`, com uma
prop `variante` que muda só o visual.

### 4.12 Duas medições, uma variável
Um `explain analyze` foi de 9ms para 1,4ms e pareceu efeito de uma mudança no
middleware — era cache do Postgres. Middleware não passa pelo SQL Editor.
Descarte a primeira medição de qualquer `explain analyze`.

---

## 5. Migrations

Registro em `migration_aplicada`. Para saber o que rodou num banco:

```sql
select nome, aplicada_em from migration_aplicada order by nome;
```

| | |
|---|---|
| `0001`–`0009` | schema, RPCs da trilha, RLS, certificados, fechamento, autoria, admin, quiz, bucket `materiais` |
| `0010` | trigger que impede o aluno de alterar o próprio papel (4.1) |
| `0011` | fecha o bucket de materiais por matrícula; trava de relógio no vídeo |
| `0012` | devolutiva do quiz só ao aprovar ou esgotar tentativas |
| `0013` | aplica vagas, prazo, status da turma e curso publicado |
| `0014` | criar/editar turma, abrir e encerrar inscrições |
| `0015`–`0016` | presença fora do fechamento; encontros com mínimo percentual |
| `0017` | índices em chaves estrangeiras |
| `0018` | aprovado não cursa o mesmo curso de novo |
| `0019` | arquivar e excluir curso |
| `0020` | **corrige a recursão de RLS da 0019** (4.2) |
| `0021` | tabela `migration_aplicada` |
| `0022`–`0023` | categorias; publicar passa a exigir categoria |
| `0024` | URL do AC Fácil configurável |
| `0025`–`0026` | avisos; **correção do parâmetro OUT** (4.7) |
| `0027` | resumo do percurso do aluno |
| `0028`–`0029` | histórico de nome; RGA único e impresso |
| `0030` | *absorvida pela 0031 — não existe* |
| `0031` | solicitação de alteração de nome/RGA com aprovação |
| `0032` | capas, destaque curado, painéis de início por papel |
| `0033` | configuração pela interface e exportações CSV |
| `0034` | `log_admin.alvo_id` aceita nulo |
| `0035` | corrige o `array_append` (4.6) |
| `0036` | prazo de conclusão; arquivar escolhe se pode concluir |
| `0037` | apresentação do curso; prateleira de materiais |
| `0038` | 12 competências e 75 atributos; impressas no certificado |
| `0039` | código de certificado de 6 para 10 caracteres |

A `0030` não existe — foi absorvida pela `0031` antes de ser aplicada. São 38
arquivos para numeração até 39, e isso é esperado.

**Se uma migration um dia rodar em produção sem entrar no repositório** (já
aconteceu com a `0035`, desde então versionada), o corpo da função é recuperável
do banco:

```sql
select prosrc from pg_proc where proname = 'nome_da_funcao';
```

---

## 6. Papéis

| Papel | Pode |
|---|---|
| `aluno` (padrão) | próprio progresso, presença, certificados, portfólio |
| `instrutor` | criar/editar os próprios cursos, abrir turmas, chamada, fechar turma |
| `admin` (coordenação) | tudo do instrutor em qualquer curso, papéis, publicação, revogar certificado, arquivar, avisos, categorias, configuração, exportação, auditoria |

**Credenciais não entram neste arquivo** — o repositório é público. Ficam no
gerenciador de senhas de quem administra.

---

## 7. Estado atual e o que falta

**Funcionalmente pronto.** Segurança auditada em duas rodadas. Nunca usado por
turma real.

**Antes de liberar o time (ordem obrigatória):**

1. **Livro de certificados em CSV** — já existe em `/admin/dados`; falta virar
   rotina da coordenação
2. **Recuperação de senha** — construída. Falta testar de ponta a ponta em
   produção, com e-mail real
3. **Confirmação de e-mail** — ainda desligada no Supabase; o nome impresso no
   certificado é autodeclarado enquanto estiver assim. O código já está pronto
   para ela (`/auth/callback` e o `cadastrar()` que não assume sessão), mas
   **antes de virar a chave** é preciso pôr `/auth/callback` na allowlist de
   Redirect URLs do painel — sem isso o link do e-mail leva a lugar nenhum
4. **Reset dos dados de teste** (`supabase/scripts/reset_piloto.sql`) — precisa
   acontecer **antes** de o time criar cursos, ou o trabalho deles some junto
5. **Configuração institucional** em `/admin/configuracao` — `url_base` ainda
   pode estar em `localhost`, o que faria o QR code de todo certificado apontar
   para lugar nenhum
6. **Contas institucionais** de Supabase, Vercel e GitHub, e plano pago do
   Supabase (o gratuito pausa por inatividade)

**Fora de escopo por decisão:** bloco de envio (arrasta fila de correção),
questionário de autoavaliação (a estrutura de competências já é a base dele),
notificações por e-mail, editor visual de texto (dependência que apodrece),
plataforma terceira de badges (recriaria a dependência que a credencial assinada
eliminou).

---

## 8. Armadilhas de ferramenta

- **SQL Editor do Supabase executa apenas o TRECHO SELECIONADO** quando há
  seleção ativa, e mostra só o resultado da última instrução quando se cola
  várias. Numa consulta é chato; num `delete` é irreversível.
- **`delete from storage.objects` é bloqueado.** Aquela tabela é o registro do
  arquivo, não o arquivo. Apagar a linha deixa arquivo órfão para sempre. Apague
  o curso primeiro e depois localize os órfãos.
- **`create or replace function` não troca nome de parâmetro** — precisa de
  `drop function` antes.
- **Migration que muda comportamento automático precisa de backfill.** Mordeu
  quatro vezes. Às vezes o backfill correto é **não fazer nada** (o prazo da
  `0036` não é retroativo de propósito) — e isso precisa estar escrito.
- **Union type em retorno de server action** passa no `next dev` e falha no
  `next build`. Formato único: `{ok: boolean; erro?: string}`.
- **`git push` rejeitado por non-fast-forward:** `git pull --no-edit` antes.
- **Aviso de `middleware` depreciado no Next 16** é só aviso. Não migrado.

---

## 9. Onde está cada coisa

```
src/app/            rotas (App Router)
  ├ page.tsx        landing pública + início logado
  ├ cursos/         catálogo e página do curso
  ├ trilha/         experiência do aluno
  ├ professor/      autoria e gestão de turma
  ├ admin/          coordenação
  ├ validar/        validação pública (sem login)
  ├ api/credencial/ credencial assinada (Open Badges 3.0)
  └ emissor/chaves  chave pública de verificação
src/components/     UI compartilhada (FormularioAcesso serve /login e a home)
src/lib/
  ├ auth.ts         sessaoAtual(), exigirAdmin(), exigirProfessor()
  ├ credencial.ts   monta, assina e verifica credencial
  ├ blocos/         schemas zod dos seis tipos de bloco
  └ supabase/       clientes server, client e middleware
supabase/migrations/  0001 a 0039
supabase/scripts/     reset_piloto.sql, excluir_cursos_teste.sql (NÃO são migrations)
scripts/              gerar e verificar chave de credencial
```

Variável de ambiente além das do Supabase: `CREDENCIAL_CHAVE_PRIVADA` (Ed25519,
PEM com `\n` escapado, marcada como Sensitive na Vercel). Sem ela, a credencial
sai sem assinatura e com aviso — nada quebra.

---

## 10. Como este projeto foi conduzido

Augusto não é desenvolvedor de formação — aprendeu programando este projeto, com
a IA escrevendo o código e explicando as decisões, e ele testando, reportando e
aplicando. O padrão que funcionou:

- Explicar o **porquê** de cada decisão, não só entregar código
- Quando ele diz "isso está estranho", geralmente está — várias das melhores
  correções nasceram de observação dele: o RGA que muda no reingresso, a tela
  que rotularia pessoas inocentes como suspeitas, o desalinhamento de 6px entre
  as duas logos
- Discordar quando for o caso, e dizer o que **não** vale fazer
- Nomear o padrão quando um bug revelar um maior

**A partir de 2027 o Trilhas vira extensão permanente**, com equipe rotativa
mantendo a plataforma e revisando as trilhas. O risco deixa de ser abandono e
passa a ser **perda de memória**: gente nova todo ano, sem contato com quem
construiu.

Por isso este arquivo importa mais que qualquer teste automatizado.
**Atualizá-lo deve ser parte do trabalho de quem mexer no projeto** — documento
que só uma pessoa mantém morre com ela.
