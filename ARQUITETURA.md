# Arquitetura do Trilhas UFR

Para quem vai mexer no código e nunca viu este projeto. Leia junto com o
`ESTADO_DO_PROJETO.md`, que tem as decisões e os erros já cometidos.

---

## 1. A ideia central, em uma frase

**A regra de negócio mora no banco, não na aplicação.**

Corrigir quiz, calcular nota, emitir certificado, verificar se alguém pode se
inscrever — tudo isso são funções PostgreSQL. O Next.js chama, formata e mostra.

Isso é incomum e foi deliberado. O motivo é o produto: a plataforma existe para
que um certificado signifique alguma coisa. Se a regra que decide "esta pessoa
concluiu o curso" vivesse no navegador, ela pertenceria ao usuário — e ele
poderia mudá-la. No banco, com `security definer`, ele não tem como.

A consequência prática, e é a mais importante para quem chega:

> **Antes de escrever lógica em TypeScript, pergunte se ela deveria estar numa
> função do Postgres.** Se envolve autorização, nota, progresso ou certificado,
> a resposta é sim.

---

## 2. As três camadas

```
┌──────────────────────────────────────────────────┐
│ Next.js — telas, formulários, formatação          │
│   Server Components buscam dados                  │
│   Server Actions disparam ações                   │
├──────────────────────────────────────────────────┤
│ Supabase JS — só transporte                       │
│   .rpc() para regra · .from() para leitura simples│
├──────────────────────────────────────────────────┤
│ PostgreSQL — a autoridade                         │
│   Funções (security definer) = regra de negócio   │
│   RLS = rede de segurança                         │
│   Constraints = invariantes                       │
└──────────────────────────────────────────────────┘
```

### Quando usar `.rpc()` e quando usar `.from()`

**`.rpc()`** para qualquer coisa que decida, calcule ou agregue: inscrever,
submeter quiz, fechar turma, contar matriculados, listar materiais.

**`.from()`** só para leitura simples de linha que o RLS já protege — buscar um
curso pelo slug, listar os próprios certificados.

**A regra de ouro:** se a resposta depende de ler dado de outra pessoa, tem que
ser `.rpc()` com `security definer`. Contar quantos alunos há numa turma exige
ler matrículas alheias, que o RLS esconde — e deve esconder. A função devolve
**o número**, nunca as linhas.

---

## 3. Autorização — três camadas independentes

Cada uma sozinha resolve. A redundância é intencional: já houve cinco vazamentos
neste projeto por confiar em uma só.

**1. Middleware** (`src/lib/supabase/middleware.ts`)
Bloqueia rota por papel. `/admin` exige `admin`, `/professor` exige `instrutor`
ou `admin`.

**2. Guarda na tela** (`src/lib/auth.ts`)
Toda página em `/admin` e `/professor` começa com `await exigirAdmin()` ou
`await exigirProfessor()`. Devolve 404 se não puder.

Por que repetir o middleware? Porque middleware falha em silêncio: um `matcher`
mal editado ou uma rota nova não coberta simplesmente abre a página. A guarda
não tem esse modo de falha.

**3. RLS + função**
As policies limitam as linhas; as funções checam quem chama.

### Os predicados que já existem

Antes de escrever uma checagem nova, veja se ela já existe:

| Função | Verdadeiro quando |
|---|---|
| `e_admin()` | quem chama é coordenação |
| `e_dono_matricula(id)` | a matrícula é de quem chama |
| `e_autor_do_curso(id)` | quem chama criou o curso |
| `e_instrutor_da_turma(id)` | quem chama dá aula naquela turma |
| `pode_gerir_turma(curso)` | autor do curso ou admin |
| `pode_acessar_material(path)` | matriculado no curso do material |
| `verificar_matricula_ativa(id)` | **lança exceção** se expirou ou o curso bloqueia |

### ⚠️ A armadilha que já derrubou a produção

**Nunca consulte uma tabela com RLS de dentro de uma policy.** A policy da outra
tabela dispara, e se ela consultar a primeira, o Postgres recursa infinitamente.

```sql
-- ERRADO: a policy de turma consulta curso, que consulta turma
create policy x on curso using (
  exists (select 1 from turma t where ...)
);

-- CERTO: função security definer, que ignora RLS e encerra a cadeia
create policy x on curso using ( estou_matriculado_no_curso(curso.id) );
```

---

## 4. O ciclo de uma tela

Exemplo real: o aluno abre a trilha.

```
1. middleware      → tem cookie? renova sessão. /trilha exige só login
2. layout.tsx      → sessaoAtual() resolve usuário + papel UMA vez
                     (cache() do React; layout e página compartilham)
3. page.tsx        → Promise.all([
                       .from('matricula').eq('usuario_id', user.id)  ← filtro explícito!
                       .rpc('modulos_trilha')                        ← regra no banco
                       .rpc('situacao_matricula')
                     ])
4. Postgres        → cada RPC checa e_dono_matricula() por dentro
5. render          → Server Component monta o HTML
```

Repare em duas coisas:

**O filtro explícito por dono** no `.from()`, mesmo com RLS ativo. Isso é a
lição 4.3 do `ESTADO_DO_PROJETO`: policies permissivas combinam com **OR**, e
"admin vê tudo" some com "vê o que é seu". Sem o `.eq()`, uma conta de
coordenação veria dado alheio.

**`Promise.all`** quando as consultas são independentes. Cada ida ao banco custa
latência de rede; em série elas somam.

---

## 5. Modelo de dados

```
usuario ──┬── matricula ──┬── progresso_bloco
          │      │        ├── presenca
          │      │        ├── ajuste_nota
          │      │        └── certificado
          │      │
curso ──┬─┴─ turma ─── encontro
        ├── modulo ─── bloco
        └── curso_competencia ─── competencia

categoria · configuracao · aviso · log_admin · solicitacao_dado · migration_aplicada
```

**Tudo em cascata a partir de `curso`.** Um `delete from curso` derruba turmas,
matrículas, progresso, presença e **certificados**. É por isso que
`excluir_curso` só aceita curso com zero matrículas — apagar certificado emitido
quebra as URLs públicas de validação.

**Os snapshots.** `certificado` guarda cópia de nome, RGA, título do curso,
carga horária, competências e assinante no momento da emissão. Não são
redundância: é o que garante que o documento entregue continue dizendo o que
dizia, mesmo que o curso ou o cadastro mudem depois.

---

## 6. Os seis tipos de bloco

O conteúdo de cada bloco vive em `bloco.config` (jsonb), validado por zod em
`src/lib/blocos/schemas.ts`.

| Tipo | Config | Como conclui |
|---|---|---|
| `texto` | markdown | botão + rolagem + tempo mínimo |
| `video` | videoId, duracaoSegundos, percentualMinimo | percentual assistido, com trava de relógio |
| `quiz` | questoes, notaMinima, maxTentativas, mostrarGabarito | nota ≥ mínima |
| `material` | arquivos[], sempreDisponivel | download (não bloqueia progresso) |
| `checkpoint` | — | confirmação simples |
| `envio` | — | **nunca construído** |

### Para acrescentar um tipo novo

1. `TIPOS_BLOCO` e um schema zod em `src/lib/blocos/schemas.ts`
2. Valor padrão em `src/lib/blocos/defaults.ts`
3. Componente do aluno em `src/components/blocos/`
4. Editor do professor em `professor/cursos/[id]/blocos/[blocoId]/`
5. **RPC no banco** para a ação de conclusão — e ela precisa chamar
   `e_dono_matricula()` e `verificar_matricula_ativa()`
6. `sanitizar_config()` se o config tiver algo que não pode chegar ao aluno

O passo 5 é onde erra quem vem de um LMS tradicional: a conclusão **não** pode
ser um update direto do cliente.

---

## 7. Como escrever uma migration

```sql
-- 00XX_nome.sql
--
-- Explique o PROBLEMA, não o comando. Quem lê isto daqui a dois anos precisa
-- do raciocínio, não da sintaxe.

<alterações>

insert into migration_aplicada (nome) values ('00XX_nome.sql')
on conflict (nome) do nothing;
```

**A lista de verificação, tirada de erros reais:**

- [ ] `create table if not exists`, `add column if not exists` — a migration
      precisa ser segura de reexecutar
- [ ] Toda coluna qualificada com alias, **principalmente em `returns table`**
      (parâmetro OUT sombreia nome de coluna — lição 4.7)
- [ ] `array_append(x, 'texto')`, nunca `x || 'texto'` (lição 4.6)
- [ ] `drop function` antes de `create or replace` se mudar nome de parâmetro
- [ ] Checagem cruzada entre tabelas com RLS mora em `security definer` (4.2)
- [ ] Precisa de backfill? Às vezes o backfill correto é **não fazer nada** —
      e isso precisa estar escrito, ou alguém "corrige" depois
- [ ] `grant execute` nas funções novas
- [ ] Roteiro de teste, com o de **regressão** antes do de novidade

---

## 8. A credencial verificável

`src/lib/credencial.ts` monta e assina no padrão **Open Badges 3.0** (1EdTech,
sobre Verifiable Credentials do W3C).

**Por que existe:** a validação por código depende do servidor estar vivo. Se a
plataforma sair do ar, todo certificado emitido vira link morto. A credencial
assinada carrega os próprios dados e uma assinatura Ed25519 — quem tem o arquivo
verifica sozinho, para sempre, e alterar um caractere invalida a assinatura.

**Por que VC-JWT e não Linked Data Proofs:** o padrão aceita os dois. O segundo
exige canonicalização de JSON-LD, uma dependência pesada e fonte de erro
silencioso. VC-JWT é um JWS comum, feito com o `node:crypto` que já vem no Node.
Para um projeto que precisa sobreviver sem manutenção, menos dependência é mais
garantia.

**Se a chave não estiver configurada**, a credencial sai sem assinatura e com
aviso explícito. Nada quebra.

`scripts/verificar-credencial.mjs` verifica offline, sem internet e sem
biblioteca. Ele e a chave pública devem ficar guardados junto do livro de
certificados.

---

## 9. Convenções

**Nomes em português** — tabelas, funções, variáveis, componentes. Só o que vem
de biblioteca fica em inglês. Consistência importa mais que a escolha.

**Server Actions devolvem formato único:** `{ok: boolean; erro?: string}`. Union
type (`{erro} | {ok}`) passa no `next dev` e falha no `next build`.

**Sempre `const { data, error }`**, nunca só `data`. Engolir erro de RPC já
escondeu três defeitos (lição 4.9).

**Tokens de cor semânticos** em `globals.css`: `primary`, `muted`, `ink`,
`surface`. Nunca cor literal no componente — trocar a paleta é editar dez linhas.

⚠️ **O verde institucional da UFR (#53B366) reprova no contraste WCAG AA.** Ele
é decorativo. Para verde com significado existe `--color-success`.

**Buckets:** `materiais` é privado com autorização derivada do path; `capas` é
público (aparece no catálogo aberto).

---

## 10. Rodando localmente

```bash
git clone https://github.com/augustocastrol3mos-creator/trilhas-ufr.git
cd trilhas-ufr && npm i
npm run dev          # localhost:3000
npx next build       # SEMPRE antes de enviar
```

`.env.local` (não versionado):
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
CREDENCIAL_CHAVE_PRIVADA=-----BEGIN PRIVATE KEY-----\n...
```

**Hoje só existe o ambiente de produção.** Toda migration é rodada direto no
banco real. Isso funcionou enquanto os dados eram de teste e **deixa de
funcionar** depois que houver certificados reais. A primeira coisa que a equipe
permanente deveria fazer é criar um segundo projeto Supabase para homologação —
o plano gratuito basta, e se pausar por inatividade, tudo bem.
