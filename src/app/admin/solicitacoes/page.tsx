import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Decisao from './Decisao'

export const dynamic = 'force-dynamic'

type Solicitacao = {
  id: string
  email: string
  nome_atual: string | null
  nome_solicitado: string | null
  rga_atual: string | null
  rga_solicitado: string | null
  motivo: string
  status: string
  resposta: string | null
  criado_em: string
  decidido_em: string | null
  matriculas: number
  certificados: number
}

export default async function SolicitacoesPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('solicitacoes_dados')
  if (error) notFound()

  const lista = (data ?? []) as Solicitacao[]
  const pendentes = lista.filter((s) => s.status === 'pendente')

  return (
    <div>
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Coordenação
      </Link>

      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">
        Alterações de nome
      </h1>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Depois da primeira inscrição, o aluno não altera nome nem RGA sozinho — os dois
        vão impressos no certificado. Correções passam por aqui.
      </p>

      <p className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm leading-relaxed text-muted">
        A maioria destes pedidos é correção legítima: erro de digitação, nome social, nome
        de casada, acento que faltava — e, no caso do RGA, reingresso ou novo curso na
        UFR, que geram matrícula nova. Ao avaliar, compare o nome pedido com o RGA e o
        registro acadêmico — e, na dúvida, converse com a pessoa antes de recusar. Um
        pedido aqui não é indício de nada.
      </p>

      {pendentes.length === 0 && (
        <p className="mt-6 rounded-lg border border-dashed border-border-strong p-6 text-center text-sm text-muted">
          Nenhuma solicitação aguardando análise.
        </p>
      )}

      <ul className="mt-6 space-y-4">
        {lista.map((s) => {
          const aguardando = s.status === 'pendente'
          return (
            <li
              key={s.id}
              className={`rounded-lg border bg-surface p-5 ${
                aguardando ? 'border-accent' : 'border-border'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="space-y-1">
                    {s.nome_solicitado && (
                      <p className="flex flex-wrap items-center gap-2 font-display text-base font-semibold text-ink">
                        {s.nome_atual || '(sem nome)'}
                        <ArrowRight className="h-4 w-4 text-subtle" aria-hidden="true" />
                        {s.nome_solicitado}
                      </p>
                    )}
                    {s.rga_solicitado && (
                      <p className="flex flex-wrap items-center gap-2 font-mono text-sm text-ink">
                        RGA {s.rga_atual || '—'}
                        <ArrowRight className="h-4 w-4 text-subtle" aria-hidden="true" />
                        {s.rga_solicitado}
                      </p>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-subtle">
                    {s.email} · {s.matriculas} inscrição(ões), {s.certificados} certificado(s)
                  </p>
                </div>

                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    aguardando
                      ? 'bg-accent-soft text-accent'
                      : s.status === 'aprovada'
                        ? 'bg-success-soft text-success'
                        : 'border border-border-strong text-muted'
                  }`}
                >
                  {aguardando ? 'aguardando' : s.status}
                </span>
              </div>

              <p className="mt-3 rounded-md bg-canvas px-3 py-2 text-sm text-ink">
                <span className="text-muted">Motivo informado:</span> {s.motivo}
              </p>

              {s.resposta && (
                <p className="mt-2 text-sm text-muted">
                  <span className="font-medium text-ink">Resposta:</span> {s.resposta}
                </p>
              )}

              {aguardando && <Decisao id={s.id} />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
