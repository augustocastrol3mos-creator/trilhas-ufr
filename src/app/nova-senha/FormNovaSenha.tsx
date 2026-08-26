'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { KeyRound, CheckCircle2 } from 'lucide-react'
import { definirSenha } from './acoes'

export default function FormNovaSenha({ email }: { email: string }) {
  const [estado, acao, pendente] = useActionState(definirSenha, null)

  const campo = 'mt-1.5 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-subtle focus:border-primary'
  const label = 'block text-sm font-medium text-ink'

  // Tela de confirmação em vez de redirect: um redirect silencioso deixa a
  // pessoa sem saber se funcionou, e ela tenta de novo.
  if (estado?.ok) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-[var(--color-success)]" />
        <h1 className="mt-3 font-display text-base font-semibold text-ink">Senha alterada</h1>
        <p className="mt-1.5 text-sm text-muted">
          Você já está conectado. Se estava logado em outro aparelho, precisará entrar de novo lá.
        </p>
        <Link
          href="/meus-cursos"
          className="mt-5 inline-block rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
        >
          Ir para meus cursos
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <h1 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
        <KeyRound className="h-4 w-4 text-muted" />
        Definir nova senha
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        Conta: <span className="text-ink">{email}</span>
      </p>

      <form action={acao} className="mt-5">
        <label className={label}>
          Nova senha
          <input name="senha" type="password" required minLength={6} className={campo} />
          <span className="mt-1 block text-xs text-subtle">Ao menos 6 caracteres.</span>
        </label>
        <label className={`mt-4 ${label}`}>
          Repita a nova senha
          <input name="repetida" type="password" required minLength={6} className={campo} />
        </label>

        <button
          disabled={pendente}
          className="mt-6 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {pendente ? 'Salvando...' : 'Salvar senha'}
        </button>

        {estado?.erro && (
          <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{estado.erro}</p>
        )}
      </form>
    </div>
  )
}
