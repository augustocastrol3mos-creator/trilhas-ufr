# Trilhas UFR — v0.1

Primeira versão para testes. Cobre o fluxo do aluno de ponta a ponta:
criar conta, inscrever-se, percorrer a trilha com trava sequencial e concluir
blocos de texto, checkpoint, vídeo e quiz.

## O que existe

- Schema completo (curso, turma, módulo, bloco, matrícula, progresso)
- RPCs com toda a lógica sensível no servidor
- Correção de quiz no banco, com o gabarito nunca saindo do servidor
- Trava sequencial de módulos
- Duas modalidades: híbrido (para no `trilha_concluida`) e online (vai a `aprovado`)
- Quatro tipos de bloco funcionando, dois ainda como stub

- Emissão automática de certificado ao concluir curso online
- Certificado em duas páginas (frente e verso com histórico), pronto para impressão
- Página pública de validação por código, com QR code

- Área do professor: turmas, acompanhamento e fechamento
- Fechamento transacional com decisão justificada e emissão em lote
- Ajuste de nota append-only, com justificativa obrigatória
- Editor de cursos, módulos e blocos pelo professor
- Construtor de quiz com três formatos de questão
- Publicação bloqueada por invariantes verificadas no banco
- Área da coordenação: papéis, autorização de publicação, revogação e reemissão
- Reabertura de turma registrada em log
- Auditoria unificada de ajustes, decisões divergentes e atos da coordenação
- Reordenação de módulos e blocos
- Coordenação edita qualquer curso e fecha/reabre qualquer turma, com link direto
- Trilha reativa: progresso e liberação do próximo módulo sem recarregar
- Devolutiva por questão no quiz, com gabarito conforme política do professor
- Conclusão de leitura por botão, com rolagem até o fim e tempo mínimo
- "Continuar de onde parou" e tempo estimado por módulo
- Revisão pré-publicação com diagnóstico por bloco e prévia navegável
- Bloco de material com upload para o Storage
- Progresso individual do aluno visível ao professor
- Análise de acerto por questão do quiz
- Landing pública para visitantes sem conta, com login integrado

## O que não existe ainda

Blocos de material e envio, reordenação por arrastar, notificações por e-mail,
tela de ajuste de nota pelo professor.

## Primeiro admin

O primeiro admin precisa ser criado por SQL, porque só um admin concede papéis:

```sql
update usuario set papel = 'admin' where email = 'seu@email';
```

## Virar instrutor

Não há tela para isso ainda. No SQL Editor:

```sql
update usuario set papel = 'instrutor' where email = 'seu@email';

update turma set instrutor_id = (select id from usuario where email = 'seu@email')
where instrutor_id is null;
```

## Passo a passo

### 1. Criar o projeto Next.js

```bash
npx create-next-app@latest trilhas-ufr --typescript --tailwind --app --eslint --src-dir --import-alias "@/*"
cd trilhas-ufr
npm i @supabase/supabase-js @supabase/ssr zod react-markdown remark-gfm lucide-react qrcode
npm i -D @types/qrcode
npm i -D @tailwindcss/typography
```

Copie o conteúdo deste pacote por cima do projeto criado, mantendo a estrutura de
pastas. Os arquivos `src/app/layout.tsx`, `src/app/page.tsx` e `src/app/globals.css`
substituem os gerados — o `globals.css` deste pacote já vem com os tokens de cor
institucionais e não precisa de edição manual.

Se o seu `create-next-app` gerou Tailwind v3 (verifique a versão em `package.json`),
o `@plugin` dentro do `globals.css` não funciona; troque por
`require('@tailwindcss/typography')` no array `plugins` do `tailwind.config.ts`
e remova a linha `@plugin` do CSS.

### 2. Criar o projeto no Supabase

Em supabase.com, crie um projeto novo. Anote a senha do banco.

Em **Authentication → Providers → Email**, desative "Confirm email" enquanto estiver
testando. Sem isso, cada conta criada fica pendente de confirmação por e-mail.

### 3. Rodar as migrations

Pelo SQL Editor do painel, execute na ordem:

1. `supabase/migrations/0001_schema.sql`
2. `supabase/migrations/0002_functions.sql`
3. `supabase/migrations/0003_rls.sql`
4. `supabase/seed.sql`
5. `supabase/migrations/0004_certificados.sql`
6. `supabase/migrations/0005_fechamento.sql`
7. `supabase/migrations/0006_autoria.sql`
8. `supabase/migrations/0007_admin.sql`
9. `supabase/migrations/0008_trilha.sql`
10. `supabase/migrations/0009_professor.sql`

Cada arquivo inteiro, de uma vez. Se algum der erro, pare e resolva antes de seguir.

### 4. Configurar as variáveis

Em **Project Settings → API**, copie a URL e a chave `anon public`. Crie um
`.env.local` na raiz:

```
NEXT_PUBLIC_SUPABASE_URL=https://SEUPROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=cole_aqui_a_anon_key
```

A chave `service_role` não entra aqui e não vai para o cliente em nenhuma hipótese.

### 5. Rodar

```bash
npm run dev
```

Abra http://localhost:3000

### 6. Roteiro de teste

1. `/login` → criar conta
2. `/cursos` → inscrever-se em "Gestão de custos"
3. Módulo 1: role o texto até o fim (conclui sozinho) e confirme o checkpoint
4. Volte à trilha: o módulo 2 deve aparecer como disponível
5. Módulo 2: assista ao vídeo até passar de 30% e responda o quiz
6. Erre o quiz de propósito na primeira tentativa e confira o contador
7. Ao concluir tudo, a trilha mostra "apto ao encontro presencial"
8. Inscreva-se também em "Introdução ao cooperativismo" (online) e confira que ao
   final o status vai direto para "aprovado", sem encontro

### 7. Verificação de segurança

No navegador, aba Network, abra a resposta da chamada `modulo_conteudo` no módulo
com quiz. Nenhuma alternativa pode ter o campo `correta`, e nenhuma questão de
verdadeiro/falso pode ter o campo `resposta`. Se aparecerem, algo saiu errado na
função `sanitizar_config`.

### 8. Deploy

Suba o repositório no GitHub, importe na Vercel e cadastre as duas variáveis de
ambiente. O deploy é automático a cada push.

## Notas de implementação

- **Progresso de vídeo** conta fatias de 10 segundos efetivamente assistidas, não o
  ponto máximo alcançado. Arrastar a barra até o fim não conclui o bloco.
- **A trava de módulo** é verificada no servidor dentro de `modulo_conteudo`. Digitar
  a URL de um módulo bloqueado devolve erro, não a página.
- **`bloco` não tem policy de select.** O conteúdo só sai pela RPC. Isso é
  intencional: leitura direta devolveria o gabarito.
- **Após concluir blocos, a trilha atualiza no próximo carregamento.** O
  `revalidatePath` cobre a navegação; dentro da mesma página o estado é local.

## Próximo passo

Interface do professor: editor de módulos e blocos, começando pelo tipo `texto`.
O contrato de `config` já está estável, então o editor é formulário sobre o schema
que já existe em `src/lib/blocos/schemas.ts`.
