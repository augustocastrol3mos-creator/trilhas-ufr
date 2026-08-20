'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Check, X, PencilLine } from 'lucide-react'
import { solicitarNome, cancelarSolicitacao } from './acoes'

export type Solicitacao = {
  id: string
  nome_solicitado: string
  motivo: string
  status: string
  resposta: string | null
} | null

export default function SolicitarNome({
  nomeAtual, solicitacao,
}: { nomeAtual: string; solicitacao: Solicitacao }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState(nomeAtual)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function rodar(fn: () => Promise<{ ok: boolean; erro?: string }>) {
    setErro(null)
    iniciar(async () => {
      const r = await fn()
      if (!r.ok) setErro(r.erro ?? 'nao foi possivel concluir')
      else { setAberto(false); setMotivo(''); router.refresh() }
    })
  }

  // Aguardando análise
  if (solicitacao?.status === 'pendente') {
    return (
      <div className="mt-3 rounded-md border border-accent-soft bg-accent-soft p-3.5">
        <p className="flex items-center gap-2 text-sm font-medium text-ink">
          <Clock className="h-4 w-4 text-accent" aria-hidden="true" />
          Alteração aguardando a coordenação
        </p>
        <p className="mt-1 text-sm text-muted">
          Você pediu para mudar para <strong className="text-ink">{solicitacao.nome_solicitado}</strong>.
          Assim que for analisada, o nome muda sozinho.
        </p>
        <button
          onClick={() => rodar(() => cancelarSolicitacao(solicitacao.id))}
          disabled={pendente}
          className="mt-2 text-sm font-medium text-muted underline hover:text-ink disabled:opacity-50"
        >
          Cancelar o pedido
        </button>
      </div>
    )
  }

  return (
    <div className="mt-3">
      {solicitacao?.status === 'recusada' && (
        <p className="mb-3 rounded-md border border-border bg-canvas p-3.5 text-sm">
          <span className="flex items-center gap-2 font-medium text-ink">
            <X className="h-4 w-4 text-muted" aria-hidden="true" />
            Pedido anterior não aprovado
          </span>
          {solicitacao.resposta && (
            <span className="mt-1 block text-muted">{solicitacao.resposta}</span>
          )}
        </p>
      )}

      {solicitacao?.status === 'aprovada' && (
        <p className="mb-3 flex items-center gap-2 text-sm text-success">
          <Check className="h-4 w-4" aria-hidden="true" />
          Sua última alteração foi aprovada.
        </p>
      )}

      {!aberto ? (
        <button
          onClick={() => setAberto(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <PencilLine className="h-3.5 w-3.5" />
          Solicitar correção do nome
        </button>
      ) : (
        <div className="rounded-md border border-border bg-canvas p-4">
          <label className="block text-xs font-medium text-muted">
            Nome correto
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
            />
          </label>

          <label className="mt-3 block text-xs font-medium text-muted">
            O que precisa ser corrigido
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: faltou o acento em Antônio"
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
            />
          </label>

          {erro && (
            <p className="mt-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>
          )}

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => rodar(() => solicitarNome(nome, motivo))}
              disabled={pendente || !nome.trim() || motivo.trim().length < 10}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {pendente ? 'Enviando…' : 'Enviar pedido'}
            </button>
            <button
              onClick={() => setAberto(false)}
              className="text-sm font-medium text-muted hover:text-ink"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
