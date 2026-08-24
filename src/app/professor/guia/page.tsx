import Link from 'next/link'
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, CircleAlert, Layers, Users } from 'lucide-react'
import { exigirProfessor } from '@/lib/auth'

export const metadata = { title: 'Guia do professor — Trilhas UFR' }

export default async function GuiaPage() {
  await exigirProfessor()
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/professor" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Área do professor
      </Link>

      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">
        Como criar seu primeiro curso
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        Leitura de cinco minutos. Cobre o vocabulário da plataforma, o passo a passo e as
        regras que impedem a publicação — que são a causa mais comum de travamento.
      </p>

      {/* ---------- vocabulário ---------- */}
      <Secao Icon={Layers} titulo="Três palavras que a plataforma usa">
        <p>
          <strong className="text-ink">Curso</strong> é o conteúdo: o que se ensina, quanto
          vale em horas, se é online ou híbrido. Ele é criado uma vez.
        </p>
        <p>
          <strong className="text-ink">Turma</strong> é cada oferta desse curso. O mesmo
          curso pode ter a turma 2026/1 e a 2026/2, com vagas, prazos e encontros
          diferentes. É na turma que o aluno se matricula, não no curso.
        </p>
        <p>
          <strong className="text-ink">Módulo</strong> e <strong className="text-ink">bloco</strong>:
          o curso se divide em módulos, e cada módulo é uma pilha de blocos. O bloco é a
          menor unidade — um vídeo, um texto, um questionário. O aluno só abre o módulo
          seguinte depois de concluir o anterior.
        </p>
      </Secao>

      {/* ---------- blocos ---------- */}
      <Secao Icon={BookOpen} titulo="Os cinco tipos de bloco">
        <ul className="space-y-2">
          <Item nome="Texto">
            Conteúdo escrito. Conclui por botão, depois de rolagem e tempo mínimo de
            leitura.
          </Item>
          <Item nome="Vídeo">
            Vídeo do YouTube. O sistema mede quanto foi assistido e exige um percentual
            mínimo que você define.
          </Item>
          <Item nome="Questionário">
            Múltipla escolha, múltipla resposta e verdadeiro/falso. Você define nota
            mínima, número de tentativas e quando a devolutiva aparece.
          </Item>
          <Item nome="Material">
            Arquivo para download. Só quem está matriculado no curso consegue baixar.
          </Item>
          <Item nome="Checkpoint">
            Confirmação simples de leitura ou ciência. Sem nota.
          </Item>
        </ul>
      </Secao>

      {/* ---------- passo a passo ---------- */}
      <Secao Icon={ArrowRight} titulo="O caminho, do zero ao aluno matriculado">
        <ol className="space-y-2.5">
          <Passo n={1}>
            <strong className="text-ink">Criar o curso</strong> em Meus cursos → Novo
            curso. Aqui você escolhe a categoria, a carga horária e a modalidade.
          </Passo>
          <Passo n={2}>
            <strong className="text-ink">Montar módulos e blocos.</strong> Comece pelos
            módulos, depois preencha cada um. Dá para reordenar com as setas.
          </Passo>
          <Passo n={3}>
            <strong className="text-ink">Revisar.</strong> A tela de revisão lista o que
            ainda falta e deixa você percorrer o curso como o aluno veria.
          </Passo>
          <Passo n={4}>
            <strong className="text-ink">Solicitar a publicação.</strong> Quem publica de
            fato é a coordenação — você pede, ela autoriza.
          </Passo>
          <Passo n={5}>
            <strong className="text-ink">Abrir a turma</strong> pelo botão Turmas, com
            vagas, prazo de inscrição e, em curso híbrido, a data e o local do encontro.
          </Passo>
        </ol>
      </Secao>

      {/* ---------- travas ---------- */}
      <Secao Icon={CircleAlert} titulo="Por que a publicação pode travar">
        <p className="mb-2">
          A plataforma recusa publicar um curso incompleto. Se o botão não liberar, é uma
          destas:
        </p>
        <ul className="space-y-1.5">
          <Trava>O curso precisa de uma categoria.</Trava>
          <Trava>O curso precisa de pelo menos um módulo, e todo módulo precisa de pelo menos um bloco.</Trava>
          <Trava>O curso precisa de pelo menos um bloco que valha nota — sem isso não há como avaliar ninguém.</Trava>
          <Trava>O curso precisa de pelo menos uma turma.</Trava>
        </ul>
      </Secao>

      {/* ---------- híbrido ---------- */}
      <Secao Icon={Users} titulo="Se o curso for híbrido">
        <p>
          Curso híbrido tem encontro presencial, e a presença conta para o certificado.
          Depois de abrir a turma, entre em <strong className="text-ink">Encontros e
          chamada</strong> e cadastre cada encontro com data e local.
        </p>
        <p>
          Faça a chamada logo depois de cada encontro, não deixe para o fechamento — o
          aluno acompanha a própria presença na tela dele, e você não vai depender da
          memória meses depois.
        </p>
        <p>
          O aluno precisa de <strong className="text-ink">75% dos encontros</strong> por
          padrão. Esse percentual é ajustável por turma.
        </p>
      </Secao>

      {/* ---------- fechamento ---------- */}
      <Secao Icon={CheckCircle2} titulo="Fechar a turma">
        <p>
          Terminado o curso, o fechamento congela as notas, registra sua decisão sobre
          cada aluno e emite os certificados — tudo de uma vez.
        </p>
        <p className="rounded-md border border-accent-soft bg-accent-soft px-3 py-2 text-ink">
          <strong>Fechar é definitivo.</strong> Certificado emitido não se edita: erro se
          corrige revogando e reemitindo, o que só a coordenação faz. Confira as notas e a
          presença antes de confirmar.
        </p>
      </Secao>

      <p className="mt-8 rounded-lg border border-border bg-surface p-5 text-sm text-muted">
        Travou em alguma coisa que não está aqui? Anote e mande — este guia cresce com as
        dúvidas reais de quem está usando.
      </p>
    </div>
  )
}

function Secao({
  Icon, titulo, children,
}: { Icon: typeof BookOpen; titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
        {titulo}
      </h2>
      <div className="mt-3 space-y-2.5 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  )
}

function Item({ nome, children }: { nome: string; children: React.ReactNode }) {
  return (
    <li className="rounded-md border border-border bg-surface px-4 py-2.5">
      <strong className="text-ink">{nome}</strong> — {children}
    </li>
  )
}

function Passo({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-dark">
        {n}
      </span>
      <span>{children}</span>
    </li>
  )
}

function Trava({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden="true" className="text-subtle">•</span>
      <span>{children}</span>
    </li>
  )
}
