'use client'

import { useActionState, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Lock, UserPlus } from 'lucide-react'
import { entrar, cadastrar } from './actions'

export default function LoginForms() {
  const proximo = useSearchParams().get('proximo') ?? '/meus-cursos'
  const [aba, setAba] = useState<'entrar' | 'cadastrar'>('entrar')
  const [estadoEntrar, acaoEntrar, pendenteEntrar] = useActionState(entrar, null)
  const [estadoCadastro, acaoCadastro, pendenteCadastro] = useActionState(cadastrar, null)

  const campo = 'mt-1.5 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-subtle focus:border-primary'
  const label = 'block text-sm font-medium text-ink'

  return (
    <div className="mx-auto max-w-sm">
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="mb-6 flex gap-1 rounded-md bg-canvas p-1">
          <button
            onClick={() => setAba('entrar')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              aba === 'entrar' ? 'bg-surface text-ink shadow-sm' : 'text-muted'
            }`}
          >
            <Lock className="h-3.5 w-3.5" />
            Entrar
          </button>
          <button
            onClick={() => setAba('cadastrar')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              aba === 'cadastrar' ? 'bg-surface text-ink shadow-sm' : 'text-muted'
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Criar conta
          </button>
        </div>

        {aba === 'entrar' ? (
          <form action={acaoEntrar}>
            <input type="hidden" name="proximo" value={proximo} />
            <label className={label}>
              E-mail
              <input name="email" type="email" required className={campo} />
            </label>
            <label className={`mt-4 ${label}`}>
              Senha
              <input name="senha" type="password" required className={campo} />
            </label>
            <button
              disabled={pendenteEntrar}
              className="mt-6 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {pendenteEntrar ? 'Entrando...' : 'Acessar'}
            </button>
            {estadoEntrar?.erro && (
              <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{estadoEntrar.erro}</p>
            )}
          </form>
        ) : (
          <form action={acaoCadastro}>
            <label className={label}>
              Nome completo
              <input name="nome" required className={campo} />
            </label>
            <label className={`mt-4 ${label}`}>
              E-mail
              <input name="email" type="email" required className={campo} />
            </label>
            <label className={`mt-4 ${label}`}>
              Senha
              <input name="senha" type="password" required minLength={6} className={campo} />
            </label>
            <button
              disabled={pendenteCadastro}
              className="mt-6 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {pendenteCadastro ? 'Criando...' : 'Criar conta'}
            </button>
            {estadoCadastro?.erro && (
              <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{estadoCadastro.erro}</p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
