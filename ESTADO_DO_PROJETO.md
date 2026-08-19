# Trilhas UFR — estado do projeto

Plataforma de **cursos complementares** da UFR (podendo incluir extensão), com
trilha de aprendizado modular e certificado de validação pública. Next.js 16
(App Router, Turbopack) + Supabase (Postgres, Auth, Storage) + Vercel.
Em produção, testada por colegas.

**Repositório:** github.com/augustocastrol3mos-creator/trilhas-ufr (branch `main`)
**Produção:** https://trilhas-ufr-chi.vercel.app

---

## 1. Decisão fundadora — o que este produto É

Não é uma plataforma de vídeos. É **um emissor de certificados com pré-requisitos
verificáveis**. O valor está na cadeia:

```
trilha com trava → avaliação → presença confirmada → certificado com validação pública
```

Toda decisão de escopo deve ser filtrada por essa frase. Corolário prático: cada
elo precisa ser **verificável pelo aluno**, não só pelo sistema. Foi por isso que
a presença ganhou tela própria — era o único elo invisível.

O público mudou de "extensão para a comunidade" para **"cursos complementares,
podendo ter extensão"**. Isso importa: boa parte dos alunos é da própria UFR
buscando horas complementares, o que torna a carga horária no certificado um
número com consequência acadêmica — e é a razão de existir a trava de
reinscrição (seção 6).

Modularidade é **composição, não extensão**: seis tipos de bloco fixos que o
professor empilha e configura, não um sistema de plugins. É o que mantém o
projeto no tamanho de um TCC em vez de virar um Moodle pela metade.

---

## 2. Arquitetura e por que ela é assim

- **Toda lógica sensível vive em funções do Postgres (RPC)**, não no cliente:
  correção de quiz, cálculo de nota, trava sequencial, emissão de certificado,
  fechamento de turma, regras de inscrição, chamada de presença. RLS é rede de
  segurança; regra de negócio é função.
- **O gabarito nunca sai do servidor.** `sanitizar_config()` remove o campo
  `correta`. `bloco` não tem policy de SELECT para aluno — só chega via RPC.
- **Nota calculada nunca é sobrescrita.** Ajustes são append-only em
  `ajuste_nota`, com justificativa obrigatória.
- **Certificado emitido é imutável.** Erro se corrige revogando e reemitindo.
- **Fechamento de turma é transação única**: congela notas, grava decisões,
  emite certificados, encerra. Tudo ou nada.
- **Agregado sobre dados privados vive em `SECURITY DEFINER`.** Contar
  matriculados numa turma exige ler linhas de terceiros que o RLS esconde — e
  deve esconder. O padrão é uma função que devolve **o número**, nunca as
  linhas: `turmas_abertas`, `turmas_do_curso`, `pode_acessar_material`,
  `meu_resumo_presenca`, `pode_excluir_curso`.

---

## 3. As cinco lições que custaram caro (ler antes de mexer no banco)

### 3.1 RLS responde "qual LINHA", nunca "qual COLUNA"

A policy `usuario_proprio_update` com `using (id = auth.uid())` autorizava o
update da linha inteira — **papel incluso**. Qualquer aluno virava coordenação
com uma linha no console:

```js
supabase.from('usuario').update({ papel: 'admin' }).eq('id', meuId)
```

Corrigido pela `0010`, com **trigger**. Sempre que uma tabela tiver coluna que o
dono da linha não pode alterar (`papel`, `status`, `nota`, `autor_id`), a
proteção vem de trigger ou GRANT por coluna. Nunca de policy.

### 3.2 Policy que consulta tabela com RLS dispara a policy dela

A `0019` acrescentou à policy de `curso` uma subconsulta em `turma`. A policy de
`turma` já consultava `curso`. Resultado: `infinite recursion detected in policy
for relation "turma"`, com `/cursos` e `/meus-cursos` fora do ar.

**Toda checagem cruzada entre tabelas com RLS tem que morar numa função
`SECURITY DEFINER`** — que roda como dono, ignora RLS e encerra a cadeia. É por
isso que `e_admin()`, `e_dono_matricula()` e companhia sempre foram funções.
Corrigido pela `0020`.

### 3.3 Política de leitura ampla vaza em tela que confia só no RLS

Políticas permissivas combinam com **OR**, não se escolhem. "Admin vê tudo"
somou com "vê o que é seu" e telas que filtravam só pelo RLS passaram a mostrar
dados alheios. Aconteceu **cinco vezes**: `/meus-cursos`, `/certificados`,
`/professor`, `/trilha/[matriculaId]`, `/certificados/[id]`, e quase no catálogo.

**Toda consulta a `matricula`, `certificado`, `curso` ou `turma` precisa de
`.eq('usuario_id', user.id)` explícito no código.** A policy é a segunda linha
de defesa, não a primeira.

### 3.4 A ordem das checagens decide se a regra ajuda ou atrapalha

Em `inscrever()`, o "já matriculado nesta turma" é a **primeira** coisa, antes
de vaga, prazo, status e trava de reinscrição. Sem essa ordem, o aluno de uma
turma lotada perderia acesso ao próprio curso, e o aluno aprovado perderia
acesso ao próprio certificado. Regra nova é escrita pensando em quem está
entrando, e quebra quem já entrou. Decidiu o desenho três vezes.

### 3.5 Cascade apaga mais do que se imagina

`curso → turma → matricula → certificado`, todas `on delete cascade`. Um
`delete from curso` apagaria **certificados emitidos**, quebrando as URLs
públicas de validação — quem tem o PDF impresso na mão bate em "não encontrado".

Por isso `excluir_curso` só aceita curso com **zero matrículas**; todo o resto é
`arquivar_curso`. Antes de expor qualquer delete, mapear a cascata.

---

## 4. Migrations (rodar em ordem, uma vez cada)

A partir da `0021` existe a tabela `migration_aplicada`. Para saber o que já
rodou num banco:

```sql
select nome, aplicada_em from migration_aplicada order by nome;
```

| | O que faz |
|---|---|
| `0001_schema` | tabelas base: usuario, curso, turma, modulo, bloco, matricula, progresso_bloco |
| `0002_functions` | RPCs da trilha: modulos_trilha, modulo_conteudo, concluir_bloco, registrar_progresso_video, submeter_quiz, inscrever |
| `0003_rls` | RLS inicial |
| `0004_certificados` | certificado, emissão automática, validar_certificado (público), configuracao |
| `0005_fechamento` | pesos, ajuste_nota, fechar_turma (transação), turma_alunos |
| `0006_autoria` | políticas de escrita, validar_publicacao, criar_curso, publicar_curso |
| `0007_admin` | papel admin, log_admin, auditoria, revogar/reemitir, reabrir_turma |
| `0008_trilha` | tempo estimado, devolutiva de quiz por questão |
| `0009_professor` | análise de quiz, progresso individual, bucket `materiais` |
| `0010_papel` | **trigger que impede o aluno de alterar o próprio papel** (ver 3.1) |
| `0011_integridade` | fecha o bucket de materiais por matrícula/autoria; trava de relógio no progresso de vídeo |
| `0012_quiz` | devolutiva só ao aprovar ou esgotar tentativas; lock na contagem |
| `0013_inscricao` | aplica vagas, prazo, status da turma e curso publicado |
| `0014_turmas` | criar/editar turma, abrir e encerrar inscrições |
| `0015_presenca` | presença com vida própria, fora do fechamento |
| `0016_encontros` | encontros como entidade; presença por encontro com mínimo percentual |
| `0017_indices` | índices em chaves estrangeiras (o Postgres não cria sozinho) |
| `0018_reinscricao` | aprovado não cursa o mesmo curso de novo |
| `0019_arquivar` | arquivar e excluir curso (só coordenação) |
| `0020_corrige_recursao` | **corrige a recursão de RLS que a 0019 criou** (ver 3.2) |
| `0021_controle` | tabela `migration_aplicada` |

---

## 5. Papéis

| Papel | Pode |
|---|---|
| `aluno` (padrão) | próprio progresso, presença e certificados |
| `instrutor` | criar/editar os próprios cursos, abrir turmas neles, chamada, fechar turma |
| `admin` (coordenação) | tudo do instrutor em qualquer curso, conceder papéis, autorizar publicação, revogar certificado, reabrir turma, arquivar/excluir curso, auditoria |

Contas de teste existem em produção, mas **credenciais não entram neste
arquivo**: o repositório é público. Elas ficam no gerenciador de senhas de
Augusto. Se você está lendo isto e precisa de acesso, peça — não procure aqui.

**Confirmação de e-mail está desligada** no Supabase para facilitar teste. Como
`nome_completo` vem do metadata do cadastro, o nome impresso no certificado é
hoje **autodeclarado e não verificado**. Religar antes de uso institucional real.

---

## 6. Regras de negócio que não são óbvias no schema

- **Inscrição** exige: curso publicado, turma `inscricoes_abertas`, dentro do
  prazo, com vaga, e o aluno não pode já ter sido aprovado naquele curso.
- **Estados de turma:** `inscricoes_abertas` (aceita gente) → `em_andamento`
  (não aceita, trilha rodando) → `encerrada` (notas congeladas, certificados
  emitidos). Só `fechar_turma` chega no terceiro; `reabrir_turma` volta ao
  segundo, nunca ao primeiro.
- **Presença** é calculada, não digitada: `matricula.presenca_confirmada` vira
  `true` quando o aluno atinge `turma.presenca_minima` (padrão 75%) dos
  encontros. `fechar_turma` continua lendo só o booleano — foi assim que os
  encontros entraram sem tocar na transação mais crítica do sistema.
- **Curso arquivado** sai do catálogo mas continua legível para quem já está
  matriculado (as três policies de leitura aceitam "sou matriculado").
- **Quiz** libera devolutiva por questão só ao aprovar ou ao esgotar tentativas
  (padrão 3). Antes, saber quais questões errou entregava o gabarito de
  verdadeiro/falso na segunda tentativa.

---

## 7. Os seis tipos de bloco

| Tipo | Status |
|---|---|
| texto, video, quiz, checkpoint, material | ✅ aluno e editor do professor |
| envio | ❌ nunca construído — arrasta fila de correção. Adiar até haver demanda |

---

## 8. O que falta, em ordem

1. **Catálogo com área, filtro e busca.** `curso` não tem campo `area`, e
   `/cursos` é lista única sem busca. Fazer **antes** de subir conteúdo real,
   senão vira backfill em curso publicado.
2. **Livro de certificados exportável (CSV).** Aberto desde a primeira revisão.
   É simultaneamente backup e o registro que a PROEX vai querer independente da
   plataforma existir. Hoje, perder o projeto Supabase mata toda validação
   pública já emitida.
3. **Acessibilidade e tokens de cor.** `--color-subtle: #9aa0a6` sobre branco dá
   contraste 2,64:1 — reprovado na WCAG AA (mínimo 4,5:1), usado em 66 lugares.
   Site de universidade federal: eMAG e LBI não são opcionais. A correção
   honesta é reduzir a dois níveis de cor e diferenciar o terceiro por tamanho
   e peso, porque um `subtle` legível fica indistinguível do `muted`.
4. **Papel acima da coordenação** (remover/atribuir papéis, desabilitar usuário,
   avisos). Hoje "coordenador" e "admin" são o mesmo papel; criar um quarto
   nível exige revisitar todo `e_admin()`.
5. **Notificações por e-mail.** Nunca implementadas.
6. **`liberar_reinscricao`.** Não há como a coordenação liberar quem foi
   aprovado a refazer um curso (caso de certificado revogado por fraude).
   Não construído por falta de caso real; seria RPC com `log_admin`, nos moldes
   de `reabrir_turma`.
7. **Reordenação por arrastar** (`mover_modulo`/`mover_bloco` já existem).
8. **Migrar `middleware` para `proxy`** — aviso do Next 16, ainda não quebra.

---

## 9. Armadilhas técnicas (não repetir)

- **`next build` é mais rígido que `next dev`.** Union type em retorno de server
  action passa no dev e falha no build. Sempre formato único:
  `{ok: boolean; erro?: string}`.
- **`tsc --noEmit` não substitui `next build`.** Typecheck não pega import de
  arquivo apagado; o build pega. Aconteceu — um lote reintroduziu import de
  componente removido e só o build acusou.
- **Nem o build pega erro de banco.** Recursão de RLS, permissão negada,
  constraint violada: só aparecem com banco respondendo. Migration só é validada
  pelo teste real.
- **Editar arquivo por trecho perde chave de fechamento.** Mandar o arquivo
  inteiro quando a edição envolver estrutura de blocos.
- **Migration que muda comportamento automático precisa de backfill.** Mordeu
  quatro vezes: certificado sem emissão, seed sem `autor_id`, `iniciadoEm` do
  vídeo, encontro nº 1 das turmas antigas.
- **`create or replace function` não troca nome de parâmetro.** Precisa de `drop
  function` antes — foi o caso de `registrar_presenca` → `registrar_chamada`.
- **`git push` rejeitado por non-fast-forward:** resolver com `git pull --no-edit`.
- **Extrair zip por cima do projeto esconde o que mudou.** O `git status` com
  contagem exata de arquivos substitui a conferência visual.
- **SQL Editor do Supabase mostra só o resultado da ÚLTIMA instrução** quando se
  cola várias separadas por `;`. Rodar uma por vez ou combinar com `union all`.

---

## 10. Performance

Cada `supabase.auth.getUser()` é **ida e volta na rede** ao servidor de Auth, não
leitura de cookie. Chegou a haver três por página (middleware, layout, página).

- `src/lib/auth.ts` expõe `sessaoAtual()`, memorizado com `cache()` do React —
  uma resolução por renderização, compartilhada entre layout e páginas.
  **`cache()`, nunca `unstable_cache`**: o segundo guarda entre requisições, e
  cachear identidade entre requisições serve a sessão de um usuário para outro.
- O middleware pula `getUser()` quando não há cookie `sb-` — visitante anônimo
  em `/validar` não paga viagem nenhuma ao Auth.
- Consultas independentes vão em `Promise.all` nas rotas quentes.
- **Região importa mais que tudo isso.** Função da Vercel e banco do Supabase em
  continentes diferentes custam ~120ms por viagem, e nenhum código conserta.
  Ambos devem estar na América do Sul (`gru1`).

---

## 11. Setup

```bash
git clone https://github.com/augustocastrol3mos-creator/trilhas-ufr.git
cd trilhas-ufr && npm i
```

`.env.local` (não versionado):
```
NEXT_PUBLIC_SUPABASE_URL=https://zflmfgdfxrsxunqfoarh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<chave anon/publishable>
```

`npm run dev` → localhost:3000. Deploy automático a cada push para `main`.
Configuração institucional (nome, assinante, `url_base` dos QR codes): tabela
`configuracao`, linha única, editável por SQL.

---

## 12. Como este projeto é conduzido

Augusto está aprendendo a programar através do projeto: Claude escreve o código
e explica as decisões, Augusto testa, reporta e aplica. O que funciona:

- Explicar o **porquê** de cada decisão de arquitetura, não só entregar código.
- **Clonar o repositório antes de começar cada lote**, não só para conferir
  depois. "Funcionou" e "está no GitHub" são fatos diferentes — confundir os
  dois fez um lote sobrescrever o anterior e quebrar o build.
- **Fazer push antes de dizer que funcionou**, para que os dois fatos coincidam.
- Rodar `next build` de verdade antes de entregar, não só `tsc`.
- Depois de cada lote: listar arquivos alterados, a migration a rodar, e um
  roteiro curto de teste — com o teste de **regressão** antes do de novidade.
- Quando um bug revela um padrão maior, **nomear o padrão** na seção 3, não só
  corrigir o caso pontual.
