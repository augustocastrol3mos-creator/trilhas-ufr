'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, ArchiveRestore, Trash2, TriangleAlert, X } from 'lucide-react'
import { arquivarCurso, desarquivarCurso, excluirCurso } from './acoes'

type Diagnostico = {
  pode: boolean
  turmas: number
  matriculas: number
  certificados: number
}

const campo =
  'mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

export default function GestaoCurso({
  curso,
  diagnostico,
}: {
  curso: { id: string; titulo: string; status: string }
  diagnostico: Diagnostico
}) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const [painel, setPainel] = useState<'nenhum' | 'arquivar' | 'excluir'>('nenhum')
  const [motivo, setMotivo] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [bloquear, setBloquear] = useState(false)

  const arquivado = curso.status === 'arquivado'

  function rodar(fn: () => Promise<{ ok: boolean; erro?: string }>) {
    setErro(null)
    iniciar(async () => {
      const r = await fn()
      if (!r.ok) setErro(r.erro ?? 'nao foi possivel concluir')
      else {
        setPainel('nenhum')
        setMotivo('')
        setConfirmacao('')
        router.refresh()
      }
    })
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      {erro && (
        <p className="mb-3 rounded-md border border-danger-soft bg-danger-soft/40 px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}

      {painel === 'nenhum' && (
        <div className="flex flex-wrap items-center gap-4">
          {arquivado ? (
            <button
              onClick={() => rodar(() => desarquivarCurso(curso.id))}
              disabled={pendente}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-dark disabled:opacity-50"
            >
              <ArchiveRestore className="h-3.5 w-3.5" />
              Desarquivar
            </button>
          ) : (
            <button
              onClick={() => setPainel('arquivar')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
            >
              <Archive className="h-3.5 w-3.5" />
              Arquivar
            </button>
          )}

          <button
            onClick={() => setPainel('excluir')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Excluir
          </button>
        </div>
      )}

      {painel === 'arquivar' && (
        <div className="rounded-md border border-border bg-canvas p-4">
          <div className="flex items-start justify-between gap-3">
            <h4 className="font-display text-sm font-semibold text-ink">
              Arquivar &ldquo;{curso.titulo}&rdquo;
            </h4>
            <button onClick={() => setPainel('nenhum')} aria-label="Cancelar">
              <X className="h-4 w-4 text-muted hover:text-ink" />
            </button>
          </div>

          <ul className="mt-2 space-y-1 text-xs text-muted">
            <li>· Some do catálogo público e ninguém mais se inscreve.</li>
            <li>· Turmas com inscrição aberta são encerradas.</li>
            <li>
              · <strong className="text-ink">Os {diagnostico.matriculas} alunos já
              matriculados mantêm a trilha e os certificados.</strong>
            </li>
            <li>· Reversível: desarquivar devolve o curso para rascunho.</li>
          </ul>

          {/* A pergunta que a coordenação está respondendo implicitamente ao
              arquivar — melhor torná-la explícita do que escolher por ela. */}
          <fieldset className="mt-4 rounded-md border border-border bg-surface p-3">
            <legend className="px-1 text-xs font-medium text-muted">
              E quem já está matriculado?
            </legend>

            <label className="flex cursor-pointer items-start gap-2.5 py-1">
              <input
                type="radio"
                name="conclusao"
                checked={!bloquear}
                onChange={() => setBloquear(false)}
                className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
              />
              <span className="text-sm text-ink">
                Pode concluir normalmente
                <span className="mt-0.5 block text-xs text-muted">
                  Para quando o curso apenas não será mais ofertado. Quem está no meio
                  termina e recebe o certificado.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5 py-1">
              <input
                type="radio"
                name="conclusao"
                checked={bloquear}
                onChange={() => setBloquear(true)}
                className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
              />
              <span className="text-sm text-ink">
                Não pode mais concluir
                <span className="mt-0.5 block text-xs text-muted">
                  Para quando o conteúdo está errado ou desatualizado e ninguém mais deve
                  se certificar por ele. Certificados já emitidos não são afetados.
                </span>
              </span>
            </label>
          </fieldset>

          <label className="mt-3 block text-xs font-medium text-muted">
            Motivo (fica na auditoria)
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: oferta descontinuada em 2027"
              className={campo}
            />
          </label>

          <button
            onClick={() => rodar(() => arquivarCurso(curso.id, motivo, bloquear))}
            disabled={pendente || !motivo.trim()}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {pendente ? 'Arquivando…' : 'Confirmar arquivamento'}
          </button>
        </div>
      )}

      {painel === 'excluir' && (
        <div className="rounded-md border-2 border-danger bg-danger-soft/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <h4 className="flex items-center gap-2 font-display text-sm font-semibold text-danger">
              <TriangleAlert className="h-4 w-4" />
              Excluir &ldquo;{curso.titulo}&rdquo; permanentemente
            </h4>
            <button onClick={() => setPainel('nenhum')} aria-label="Cancelar">
              <X className="h-4 w-4 text-muted hover:text-ink" />
            </button>
          </div>

          {diagnostico.pode ? (
            <>
              <div className="mt-3 rounded-md border border-danger bg-surface p-3">
                <p className="text-sm font-semibold text-danger">
                  ESTA AÇÃO NÃO TEM VOLTA.
                </p>
                <p className="mt-1 text-sm text-ink">
                  O curso, seus {diagnostico.turmas} registro(s) de turma, todos os
                  módulos, blocos, textos, vídeos e materiais enviados serão apagados
                  do banco de dados. Não existe lixeira, backup automático nem
                  desfazer. Se você precisar deste conteúdo depois,{' '}
                  <strong>ele não estará em lugar nenhum.</strong>
                </p>
                <p className="mt-2 text-sm text-muted">
                  Para tirar o curso do ar mantendo tudo,{' '}
                  <button
                    onClick={() => setPainel('arquivar')}
                    className="font-medium text-primary underline"
                  >
                    arquive em vez de excluir
                  </button>
                  .
                </p>
              </div>

              <label className="mt-3 block text-xs font-medium text-ink">
                Digite o título exato do curso para confirmar:
                <input
                  value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)}
                  placeholder={curso.titulo}
                  className={campo}
                />
              </label>

              <button
                onClick={() => rodar(() => excluirCurso(curso.id, confirmacao))}
                disabled={pendente || confirmacao.trim() !== curso.titulo.trim()}
                className="mt-3 inline-flex items-center gap-2 rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
                {pendente ? 'Excluindo…' : 'Excluir permanentemente'}
              </button>
            </>
          ) : (
            <div className="mt-3 rounded-md border border-border bg-surface p-3">
              <p className="text-sm text-ink">
                <strong>Este curso não pode ser excluído.</strong> Ele tem{' '}
                {diagnostico.matriculas} matrícula(s)
                {diagnostico.certificados > 0 && (
                  <>
                    {' '}
                    e <strong>{diagnostico.certificados} certificado(s) já emitido(s)</strong>
                  </>
                )}
                .
              </p>
              <p className="mt-2 text-sm text-muted">
                Excluir apagaria em cascata as matrículas, o progresso e os certificados
                — as URLs públicas de validação parariam de funcionar, e quem estiver
                com o documento impresso na mão não conseguiria mais comprová-lo.
              </p>
              <button
                onClick={() => setPainel('arquivar')}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
              >
                <Archive className="h-4 w-4" />
                Arquivar em vez de excluir
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
