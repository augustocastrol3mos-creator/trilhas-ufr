'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CheckSquare, FileText, ListChecks, PlayCircle, Download } from 'lucide-react'

type Bloco = {
  id: string
  ordem: number
  tipo: string
  titulo: string
  config: any
  obrigatorio: boolean
}

type Modulo = {
  id: string
  ordem: number
  titulo: string
  descricao: string | null
  bloco: Bloco[]
}

const ICONE: Record<string, typeof FileText> = {
  texto: FileText,
  video: PlayCircle,
  quiz: ListChecks,
  checkpoint: CheckSquare,
  material: Download,
}

export default function PreviaAluno({ modulos }: { modulos: Modulo[] }) {
  const [ativo, setAtivo] = useState(modulos[0]?.id ?? '')
  const modulo = modulos.find((m) => m.id === ativo)

  if (modulos.length === 0) {
    return (
      <p className="mt-6 rounded-lg border border-dashed border-border-strong p-8 text-center text-sm text-subtle">
        O curso ainda não tem módulos para pré-visualizar.
      </p>
    )
  }

  return (
    <div className="mt-6">
      {/* Navegação entre módulos */}
      <div className="flex flex-wrap gap-2">
        {modulos.map((m) => (
          <button
            key={m.id}
            onClick={() => setAtivo(m.id)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              m.id === ativo
                ? 'bg-primary text-white'
                : 'border border-border-strong text-muted hover:border-primary hover:text-primary'
            }`}
          >
            {m.ordem}. {m.titulo}
          </button>
        ))}
      </div>

      {modulo && (
        <div className="mt-4 rounded-lg border border-border bg-surface p-6">
          <h3 className="font-display text-lg font-semibold text-ink">{modulo.titulo}</h3>
          {modulo.descricao && <p className="mt-1 text-sm text-muted">{modulo.descricao}</p>}

          {modulo.bloco.length === 0 && (
            <p className="mt-6 rounded-md border border-dashed border-border-strong p-6 text-center text-sm text-subtle">
              Este módulo está vazio — o aluno abriria e não encontraria nada.
            </p>
          )}

          <div className="mt-6 space-y-8">
            {modulo.bloco.map((b) => {
              const Icone = ICONE[b.tipo] ?? FileText
              return (
                <section key={b.id} className="border-t border-border pt-6 first:border-t-0 first:pt-0">
                  <header className="mb-3 flex items-center gap-2">
                    <Icone className="h-4 w-4 text-primary" />
                    <h4 className="font-display font-semibold text-ink">{b.titulo}</h4>
                    {b.obrigatorio && (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
                        obrigatório
                      </span>
                    )}
                  </header>

                  {b.tipo === 'texto' && (
                    <article className="prose prose-neutral max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {b.config?.markdown ?? ''}
                      </ReactMarkdown>
                    </article>
                  )}

                  {b.tipo === 'video' &&
                    (b.config?.videoId ? (
                      <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
                        <iframe
                          src={`https://www.youtube.com/embed/${b.config.videoId}`}
                          className="h-full w-full"
                          allowFullScreen
                          title={b.titulo}
                        />
                      </div>
                    ) : (
                      <p className="rounded-md bg-danger-soft p-3 text-sm text-danger">
                        Sem link do YouTube: o aluno veria um player vazio.
                      </p>
                    ))}

                  {b.tipo === 'checkpoint' && (
                    <div className="rounded-lg border border-border bg-canvas p-4">
                      <p className="text-ink">{b.config?.texto}</p>
                      <span className="mt-3 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-white opacity-60">
                        {b.config?.rotuloBotao ?? 'Marcar como concluído'}
                      </span>
                    </div>
                  )}

                  {b.tipo === 'material' && (
                    <ul className="space-y-2">
                      {(b.config?.arquivos ?? []).map((a: any) => (
                        <li
                          key={a.path}
                          className="flex items-center gap-3 rounded-md border border-border bg-canvas px-4 py-3"
                        >
                          <FileText className="h-5 w-5 shrink-0 text-primary" />
                          <span className="min-w-0 flex-1 truncate text-sm text-ink">{a.nome}</span>
                        </li>
                      ))}
                      {(b.config?.arquivos ?? []).length === 0 && (
                        <li className="rounded-md bg-danger-soft p-3 text-sm text-danger">
                          Nenhum arquivo enviado neste bloco.
                        </li>
                      )}
                    </ul>
                  )}

                  {b.tipo === 'quiz' && (
                    <div className="rounded-lg border border-border p-4">
                      <p className="mb-4 text-sm text-muted">
                        Nota mínima {b.config?.notaMinima ?? 70}% ·{' '}
                        {b.config?.maxTentativas ?? 3} tentativas
                      </p>
                      <ol className="space-y-5">
                        {(b.config?.questoes ?? []).map((q: any, i: number) => (
                          <li key={q.id}>
                            <p className="font-medium text-ink">
                              {i + 1}. {q.enunciado || <span className="text-danger">(sem enunciado)</span>}
                            </p>

                            {q.tipo === 'verdadeiro_falso' ? (
                              <div className="mt-2 flex gap-4 text-sm text-ink">
                                <label className="flex items-center gap-2">
                                  <input type="radio" disabled /> Verdadeiro
                                </label>
                                <label className="flex items-center gap-2">
                                  <input type="radio" disabled /> Falso
                                </label>
                                <span className="text-xs text-primary">
                                  gabarito: {q.resposta ? 'Verdadeiro' : 'Falso'}
                                </span>
                              </div>
                            ) : (
                              <div className="mt-2 space-y-1.5">
                                {(q.alternativas ?? []).map((a: any) => (
                                  <label
                                    key={a.id}
                                    className="flex items-center gap-2 text-sm text-ink"
                                  >
                                    <input
                                      type={q.tipo === 'multipla_escolha' ? 'radio' : 'checkbox'}
                                      disabled
                                    />
                                    {a.texto || <span className="text-danger">(sem texto)</span>}
                                    {a.correta && (
                                      <span className="text-xs font-medium text-primary">
                                        correta
                                      </span>
                                    )}
                                  </label>
                                ))}
                              </div>
                            )}
                          </li>
                        ))}
                      </ol>
                      <p className="mt-4 text-xs text-subtle">
                        Na prévia o gabarito aparece marcado. O aluno nunca o recebe — a correção
                        acontece no servidor.
                      </p>
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
