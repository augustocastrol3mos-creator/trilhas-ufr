import Link from 'next/link'
import { redirect } from 'next/navigation'
import { RefreshCw, Sparkles, TriangleAlert, ArrowUpRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { sessaoAtual } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type Perfil = {
  competencia_id: string
  numero: number
  nome: string
  slug: string
  media: number
  faixa: 'desenvolvida' | 'em_desenvolvimento' | 'a_desenvolver'
  itens: number
  respondido_em: string
}

type Recomendado = {
  curso_id: string
  titulo: string
  slug: string
  descricao: string | null
  carga_horaria: number
  competencia_nome: string
  competencia_slug: string
}

type Cobertura = { competencia_id: string; nome: string; cursos_publicados: number }

const FAIXA = {
  desenvolvida: { rotulo: 'Desenvolvida', classe: 'bg-success-soft text-success', barra: 'bg-success' },
  em_desenvolvimento: { rotulo: 'Em desenvolvimento', classe: 'bg-accent-soft text-accent', barra: 'bg-accent' },
  a_desenvolver: { rotulo: 'Espaço para crescer', classe: 'bg-primary-soft text-primary-dark', barra: 'bg-primary' },
} as const

export default async function ResultadoPage() {
  const usuario = await sessaoAtual()
  if (!usuario) redirect('/login?proximo=/questionario/resultado')

  const supabase = await createClient()

  const [
    { data: perfilData, error: erroPerfil },
    { data: recData, error: erroRec },
    { data: covData },
    { data: refazData },
  ] = await Promise.all([
    supabase.rpc('meu_perfil_competencias'),
    supabase.rpc('cursos_recomendados', { p_competencias: 3, p_limite: 6 }),
    supabase.rpc('cobertura_competencias'),
    supabase.rpc('pode_refazer_questionario'),
  ])

  if (erroPerfil) {
    console.error('meu_perfil_competencias:', erroPerfil.message)
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-danger-soft bg-danger-soft/40 p-4 text-sm text-danger">
        Não consegui carregar seu resultado: {erroPerfil.message}
      </div>
    )
  }
  if (erroRec) console.error('cursos_recomendados:', erroRec.message)

  const perfil = (perfilData ?? []) as Perfil[]
  const recomendados = (recData ?? []) as Recomendado[]
  const cobertura = (covData ?? []) as Cobertura[]
  const refaz = (refazData ?? { pode: false }) as {
    pode: boolean
    motivo?: string
    disponivel_em?: string
  }

  if (perfil.length === 0) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-border bg-surface p-6">
        <h1 className="font-display text-lg font-semibold text-ink">Você ainda não respondeu</h1>
        <p className="mt-2 text-sm text-muted">
          A autoavaliação leva cerca de dez minutos e pode ser feita em partes.
        </p>
        <Link
          href="/questionario"
          className="mt-4 inline-block rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
        >
          Responder agora
        </Link>
      </div>
    )
  }

  // A RPC devolve ordenado da menor média para a maior. As três primeiras são o
  // grupo de foco — não a "pior competência". Numa escala de 3 itens, eleger uma
  // campeã por 0,2 ponto é decidir no ruído; o grupo é estável mesmo quando a
  // ordem dentro dele não é.
  const foco = perfil.slice(0, 3)
  const semCurso = foco.filter(
    (f) => (cobertura.find((c) => c.competencia_id === f.competencia_id)?.cursos_publicados ?? 0) === 0
  )

  const quando = perfil[0]?.respondido_em
    ? new Date(perfil[0].respondido_em).toLocaleDateString('pt-BR')
    : null

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {/* "Sua autoavaliação", não "suas competências": o que está aqui é o
              que a própria pessoa relatou. Quando a avaliação do professor
              existir, ela entra como uma segunda voz nesta mesma tela, sem que
              nada precise ser renomeado. */}
          <h1 className="font-display text-2xl font-semibold text-ink">Sua autoavaliação</h1>
          {quando && <p className="mt-1 text-sm text-muted">Respondida em {quando}</p>}
        </div>
        {/* O botão só existe quando refazer está liberado. Um botão que sempre
            aparece e às vezes recusa ensina a pessoa a desconfiar da tela. */}
        {refaz.pode ? (
          <Link
            href="/questionario?refazer=1"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-ink hover:border-border-strong"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {refaz.motivo === 'concluiu_curso' ? 'Refazer — você concluiu um curso' : 'Refazer'}
          </Link>
        ) : (
          <p className="max-w-[16rem] text-right text-xs text-subtle">
            Refazer libera quando você concluir um curso
            {refaz.disponivel_em
              ? `, ou a partir de ${new Date(refaz.disponivel_em).toLocaleDateString('pt-BR')}`
              : ''}
            .
          </p>
        )}
      </div>

      <p className="mt-4 rounded-md border border-border bg-canvas px-3 py-2.5 text-sm text-muted">
        Este é o retrato de como você se percebe hoje, não uma medição da sua competência.
        Ele serve para escolher por onde começar.
      </p>

      <h2 className="mt-8 font-display text-base font-semibold text-ink">
        Por onde começar
      </h2>
      <p className="mt-1 text-sm text-muted">
        As três em que você se avaliou mais baixo.
      </p>

      <ul className="mt-4 space-y-3">
        {foco.map((c) => {
          const f = FAIXA[c.faixa]
          return (
            <li key={c.competencia_id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display font-semibold text-ink">{c.nome}</p>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${f.classe}`}>
                  {f.rotulo}
                </span>
              </div>
              {/* A largura da barra carrega a magnitude sem imprimir "3,8/5".
                  Com 3 a 7 frases por competência, a casa decimal seria uma
                  precisão que o instrumento não tem. */}
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div className={`h-full rounded-full ${f.barra}`} style={{ width: `${(Number(c.media) / 5) * 100}%` }} />
              </div>
              <p className="mt-2 text-xs text-subtle">A partir de {c.itens} frases</p>
            </li>
          )
        })}
      </ul>

      {semCurso.length > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-md border border-accent-soft bg-accent-soft px-3 py-2.5 text-sm text-accent">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Ainda não há curso publicado para{' '}
            {semCurso.map((s) => s.nome).join(', ')}. A coordenação está montando as trilhas —
            volte aqui depois.
          </span>
        </p>
      )}

      {recomendados.length > 0 && (
        <>
          <h2 className="mt-8 flex items-center gap-2 font-display text-base font-semibold text-ink">
            <Sparkles className="h-4 w-4 text-primary" />
            Cursos para essas competências
          </h2>
          <ul className="mt-4 space-y-3">
            {recomendados.map((r) => (
              <li key={r.curso_id}>
                <Link
                  href={`/cursos/${r.slug}`}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface p-4 hover:border-border-strong"
                >
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-subtle">
                      {r.competencia_nome}
                    </p>
                    <p className="mt-1 font-display font-semibold text-ink">{r.titulo}</p>
                    <p className="mt-1 text-sm text-muted">{r.carga_horaria}h</p>
                  </div>
                  <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="mt-10 font-display text-base font-semibold text-ink">Todas as competências</h2>
      <ul className="mt-4 space-y-2">
        {[...perfil]
          .sort((a, b) => a.numero - b.numero)
          .map((c) => {
            const f = FAIXA[c.faixa]
            return (
              <li
                key={c.competencia_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface px-4 py-3"
              >
                <span className="text-sm text-ink">{c.nome}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${f.classe}`}>
                  {f.rotulo}
                </span>
              </li>
            )
          })}
      </ul>
    </div>
  )
}
