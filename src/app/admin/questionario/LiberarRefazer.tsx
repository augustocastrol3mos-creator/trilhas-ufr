'use client'

import { useState, useTransition } from 'react'
import { KeyRound, Check } from 'lucide-react'
import { liberarRefazer } from './acoes'

export type Aluno = {
  usuario_id: string
  nome: string
  email: string
  respondido_em: string
  liberacao_pendente: boolean
}

/**
 * Liberar uma nova tentativa para quem respondeu errado.
 *
 * Isto existia desde a 0041, mas só pelo SQL Editor — e operação que só existe
 * em SQL é operação que, para uma coordenação sem desenvolvedor, não existe. A
 * equipe permanente de 2027 é a razão desta tela.
 */
export default function LiberarRefazer({ alunos }: { alunos: Aluno[] }) {
  const [busca, setBusca] = useState('')
  const [motivo, setMotivo] = useState('')
  const [alvo, setAlvo] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, iniciar] = useTransition()

  const filtrados = busca.trim()
    ? alunos.filter((a) =>
        `${a.nome} ${a.email}`.toLowerCase().includes(busca.trim().toLowerCase())
      )
    : alunos.slice(0, 10)

  function liberar(id: string) {
    setErro(null)
    iniciar(async () => {
      const r = await liberarRefazer(id, motivo)
      if (!r.ok) setErro(r.erro ?? 'Não consegui liberar.')
      else {
        setAlvo(null)
        setMotivo('')
      }
    })
  }

  return (
    <section className="mt-8 rounded-lg border border-border bg-surface p-5">
      <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-ink">
        <KeyRound className="h-4 w-4 text-primary" />
        Liberar nova tentativa
      </h2>
      <p className="mt-1.5 text-sm text-muted">
        Normalmente refazer libera sozinho quando o aluno conclui um curso. Use isto quando
        alguém respondeu por engano, entendeu a escala ao contrário, ou clicou sem ler.
      </p>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome ou e-mail"
        className="mt-4 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-subtle focus:border-primary"
      />

      {erro && (
        <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>
      )}

      {alunos.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Ninguém respondeu a autoavaliação ainda.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border border-t border-border">
          {filtrados.map((a) => (
            <li key={a.usuario_id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{a.nome || '(sem nome)'}</span>
                  <span className="block truncate text-xs text-subtle">
                    {a.email} · respondeu em{' '}
                    {new Date(a.respondido_em).toLocaleDateString('pt-BR')}
                  </span>
                </span>

                {a.liberacao_pendente ? (
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">
                    <Check className="h-3 w-3" />
                    Já liberado
                  </span>
                ) : (
                  <button
                    onClick={() => setAlvo(alvo === a.usuario_id ? null : a.usuario_id)}
                    className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs text-ink hover:border-border-strong"
                  >
                    Liberar
                  </button>
                )}
              </div>

              {alvo === a.usuario_id && (
                <div className="mt-3 rounded-md border border-primary bg-primary-soft/40 p-3">
                  <label className="block text-xs font-medium text-ink">
                    Motivo (fica na auditoria)
                    <input
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="respondeu a escala ao contrário"
                      className="mt-1.5 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-subtle focus:border-primary"
                    />
                  </label>
                  <button
                    onClick={() => liberar(a.usuario_id)}
                    disabled={ocupado}
                    className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
                  >
                    {ocupado ? 'Liberando...' : 'Confirmar liberação'}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {!busca.trim() && alunos.length > 10 && (
        <p className="mt-3 text-xs text-subtle">
          Mostrando os 10 mais recentes. Busque pelo nome para encontrar os demais.
        </p>
      )}
    </section>
  )
}
