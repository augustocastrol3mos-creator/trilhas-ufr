'use client'

import { useState } from 'react'
import { Download, FileText, Lock, Sparkles } from 'lucide-react'
import { urlDoMaterial } from '../../actions'

type Arquivo = { nome: string; path: string }
type Material = {
  blocoId: string
  titulo: string
  sempreDisponivel: boolean
  arquivos: Arquivo[]
}
export type ModuloMateriais = {
  moduloId: string
  ordem: number
  titulo: string
  liberado: boolean
  materiais: Material[] | null
}

export default function ListaMateriais({ modulos }: { modulos: ModuloMateriais[] }) {
  const [erro, setErro] = useState<string | null>(null)
  const [baixando, setBaixando] = useState<string | null>(null)

  async function baixar(path: string, nome: string) {
    setErro(null)
    setBaixando(path)
    try {
      const r = await urlDoMaterial(path)
      if (r.erro || !r.url) throw new Error(r.erro ?? 'arquivo indisponível')
      // Abre em nova aba em vez de navegar: a URL é assinada e expira, e sair
      // da trilha para baixar um anexo perderia o lugar do aluno.
      window.open(r.url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setErro(`Não foi possível abrir "${nome}": ${(e as Error).message}`)
    } finally {
      setBaixando(null)
    }
  }

  if (modulos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border-strong p-8 text-center text-sm text-muted">
        Este curso não tem materiais para download.
      </p>
    )
  }

  return (
    <div>
      {erro && (
        <p className="mb-4 rounded-md border border-danger-soft bg-danger-soft px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}

      <ul className="space-y-4">
        {modulos.map((m) => {
          const materiais = m.materiais ?? []

          return (
            <li key={m.moduloId} className="rounded-lg border border-border bg-surface p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-display text-base font-semibold text-ink">
                  {m.ordem}. {m.titulo}
                </h2>
                {!m.liberado && (
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    libera ao chegar neste módulo
                  </span>
                )}
              </div>

              <ul className="mt-3 space-y-2">
                {materiais.flatMap((mat) =>
                  mat.arquivos.map((a) => {
                    // Livre quando o módulo está aberto OU quando o professor
                    // promoveu o material a "disponível desde o começo".
                    const livre = m.liberado || mat.sempreDisponivel

                    return (
                      <li key={a.path}>
                        {livre ? (
                          <button
                            onClick={() => baixar(a.path, a.nome)}
                            disabled={baixando === a.path}
                            className="flex w-full items-center gap-3 rounded-md border border-border px-3 py-2.5 text-left hover:border-primary disabled:opacity-50"
                          >
                            <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-ink">{a.nome}</span>
                              {mat.sempreDisponivel && !m.liberado && (
                                <span className="mt-0.5 flex items-center gap-1 text-xs text-primary">
                                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                                  disponível desde o começo
                                </span>
                              )}
                            </span>
                            <Download className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                          </button>
                        ) : (
                          <div className="flex items-center gap-3 rounded-md border border-dashed border-border px-3 py-2.5">
                            <Lock className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate text-sm text-muted">
                              {a.nome}
                            </span>
                          </div>
                        )}
                      </li>
                    )
                  })
                )}
              </ul>

              {materiais.length === 0 && (
                <p className="mt-2 text-sm text-muted">Nenhum arquivo neste módulo.</p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
