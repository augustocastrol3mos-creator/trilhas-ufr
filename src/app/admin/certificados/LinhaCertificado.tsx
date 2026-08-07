'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { revogarCertificado, reemitirCertificado } from '../actions'

export default function LinhaCertificado({
  certificado: c,
}: {
  certificado: {
    id: string; codigo: string; nome_titular: string; curso_titulo: string
    emitido_em: string; revogado_em: string | null; revogado_motivo: string | null
  }
}) {
  const router = useRouter()
  const [motivo, setMotivo] = useState('')
  const [abrindo, setAbrindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const revogado = Boolean(c.revogado_em)

  return (
    <li className="rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display font-semibold text-ink">{c.nome_titular}</p>
          <p className="mt-0.5 text-sm text-muted">{c.curso_titulo}</p>
          <p className="mt-1 font-mono text-xs text-subtle">
            {c.codigo} · {new Date(c.emitido_em).toLocaleDateString('pt-BR')}
          </p>
        </div>

        {revogado ? (
          <div className="flex shrink-0 items-center gap-3">
            <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
              revogado
            </span>
            <button
              disabled={pendente}
              onClick={() =>
                iniciar(async () => {
                  setErro(null)
                  const r = await reemitirCertificado(c.id)
                  if (r.erro) setErro(r.erro)
                  else router.refresh()
                })
              }
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              Reemitir
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAbrindo((v) => !v)}
            className="shrink-0 rounded-md border border-border-strong px-3 py-1.5 text-sm text-ink hover:border-danger hover:text-danger"
          >
            Revogar
          </button>
        )}
      </div>

      {revogado && c.revogado_motivo && (
        <p className="mt-3 text-sm text-muted">Motivo: {c.revogado_motivo}</p>
      )}

      {abrindo && !revogado && (
        <div className="mt-4 border-t border-border pt-4">
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo da revogação (mínimo 10 caracteres)"
            className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
          />
          <button
            disabled={pendente || motivo.trim().length < 10}
            onClick={() =>
              iniciar(async () => {
                setErro(null)
                const r = await revogarCertificado(c.id, motivo)
                if (r.erro) setErro(r.erro)
                else { setAbrindo(false); router.refresh() }
              })
            }
            className="mt-3 rounded-md bg-danger px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {pendente ? 'Revogando...' : 'Confirmar revogação'}
          </button>
        </div>
      )}

      {erro && <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>}
    </li>
  )
}
