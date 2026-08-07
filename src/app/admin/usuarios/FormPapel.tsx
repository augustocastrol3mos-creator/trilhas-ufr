'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { definirPapel } from '../actions'

export default function FormPapel() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState<'aluno' | 'instrutor' | 'admin'>('instrutor')
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  return (
    <div className="mt-6 rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex-1 text-sm font-medium text-ink">
          E-mail do usuário
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="professor@ufr.edu.br"
            className="mt-1.5 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
          />
        </label>

        <label className="text-sm font-medium text-ink">
          Papel
          <select
            value={papel}
            onChange={(e) => setPapel(e.target.value as any)}
            className="mt-1.5 block rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
          >
            <option value="aluno">Aluno</option>
            <option value="instrutor">Instrutor</option>
            <option value="admin">Coordenação</option>
          </select>
        </label>

        <button
          disabled={pendente || !email}
          onClick={() =>
            iniciar(async () => {
              setErro(null); setMsg(null)
              const r = await definirPapel(email, papel)
              if (r.erro) setErro(r.erro)
              else { setMsg('Papel atualizado.'); setEmail(''); router.refresh() }
            })
          }
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {pendente ? 'Salvando...' : 'Definir'}
        </button>
      </div>

      {msg && <p className="mt-3 text-sm text-primary-dark">{msg}</p>}
      {erro && <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>}
    </div>
  )
}
