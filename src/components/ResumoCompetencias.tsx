import Link from 'next/link'
import { Target, ArrowUpRight } from 'lucide-react'

export type Autoavaliacao = {
  competencia_id: string
  numero: number
  nome: string
  slug: string
  media: number
  faixa: 'desenvolvida' | 'em_desenvolvimento' | 'a_desenvolver'
  itens: number
  respondido_em: string
}

export type Cursada = {
  nome: string
  slug: string
  numero: number
  horas: number
  cursos: number
}

const FAIXA = {
  desenvolvida: { rotulo: 'Desenvolvida', classe: 'bg-success-soft text-success' },
  em_desenvolvimento: { rotulo: 'Em desenvolvimento', classe: 'bg-accent-soft text-accent' },
  a_desenvolver: { rotulo: 'Espaço para crescer', classe: 'bg-primary-soft text-primary-dark' },
} as const

/**
 * As competências do aluno, numa linha por competência.
 *
 * POR QUE AS DUAS COLUNAS JUNTAS
 *
 * São medidas de naturezas diferentes, e a graça está em vê-las lado a lado:
 *
 *   AUTOAVALIAÇÃO — o que a própria pessoa relatou. Subjetiva, e ninguém pode
 *   auditar. Serve para orientar escolha, nunca para comprovar nada.
 *
 *   HORAS CURSADAS — o que ela concluiu com certificado emitido. Objetiva e
 *   verificável, mas mede exposição, não domínio: ter cursado 20h de
 *   comunicação não é o mesmo que se comunicar bem.
 *
 * Nenhuma das duas, sozinha, é "a competência da pessoa". Juntas, dão a
 * conversa útil: alta autoavaliação sem nenhuma hora é uma hipótese não
 * testada; horas sem melhora percebida é sinal de que o curso não pegou.
 * Empilhar as duas numa nota só apagaria exatamente essa diferença.
 */
export default function ResumoCompetencias({
  autoavaliacao,
  cursadas,
}: {
  autoavaliacao: Autoavaliacao[]
  cursadas: Cursada[]
}) {
  const respondeu = autoavaliacao.length > 0
  const horasPor = new Map(cursadas.map((c) => [c.numero, c]))

  // Ordem: a autoavaliação vem da RPC da menor média para a maior, e essa é a
  // ordem útil — o que precisa de atenção primeiro fica no topo. Sem
  // autoavaliação, ordena pelas horas.
  const linhas = respondeu
    ? autoavaliacao.map((a) => ({
        chave: a.competencia_id,
        nome: a.nome,
        faixa: a.faixa,
        itens: a.itens,
        cursada: horasPor.get(a.numero),
      }))
    : cursadas.map((c) => ({
        chave: c.slug,
        nome: c.nome,
        faixa: null,
        itens: 0,
        cursada: c,
      }))

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-ink">
        <Target className="h-4 w-4 text-primary" />
        Competências
      </h2>

      {!respondeu && (
        <div className="mt-3 rounded-md border border-border bg-canvas p-4">
          <p className="text-sm text-ink">Você ainda não fez a autoavaliação.</p>
          <p className="mt-1.5 text-sm text-muted">
            São 53 frases sobre como você age no dia a dia. O resultado mostra por onde
            começar e passa a valer como seu ponto de partida.
          </p>
          <Link
            href="/questionario"
            className="mt-3 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            Responder
          </Link>
        </div>
      )}

      {linhas.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Assim que você concluir um curso, as competências dele aparecem aqui.
        </p>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-subtle">
            <span>Competência</span>
            <span className="flex gap-6">
              {respondeu && <span className="w-36 text-right">Como você se percebe</span>}
              <span className="w-24 text-right">Cursado</span>
            </span>
          </div>

          <ul className="mt-2 divide-y divide-border border-t border-border">
            {linhas.map((l) => (
              <li
                key={l.chave}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2.5"
              >
                <span className="text-sm text-ink">{l.nome}</span>
                <span className="flex items-center gap-6">
                  {respondeu && (
                    <span className="w-36 text-right">
                      {l.faixa ? (
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${FAIXA[l.faixa].classe}`}
                        >
                          {FAIXA[l.faixa].rotulo}
                        </span>
                      ) : (
                        <span className="text-xs text-subtle">—</span>
                      )}
                    </span>
                  )}
                  <span className="w-24 text-right text-sm text-muted">
                    {l.cursada ? (
                      `${l.cursada.horas}h`
                    ) : (
                      <span className="text-subtle">—</span>
                    )}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-xs leading-relaxed text-subtle">
            {respondeu && (
              <>
                A coluna da esquerda é a sua autoavaliação — como você se percebe hoje, não
                uma medição. A da direita conta as horas de cursos que você concluiu com
                certificado.{' '}
              </>
            )}
            Um curso pode desenvolver mais de uma competência, e as horas dele contam em
            cada uma — por isso a soma aqui pode passar do seu total de horas. Não é erro
            de conta: você exercitou as duas coisas durante o mesmo curso.
          </p>

          {respondeu && (
            <Link
              href="/questionario/resultado"
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary underline underline-offset-2"
            >
              Ver o resultado completo e os cursos sugeridos
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </>
      )}
    </section>
  )
}
