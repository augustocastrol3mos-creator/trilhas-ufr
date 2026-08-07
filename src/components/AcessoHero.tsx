'use client'

import { useActionState, useState } from 'react'
import { Lock, UserPlus } from 'lucide-react'
import { entrar, cadastrar } from '@/app/login/actions'

const campo =
  'mt-1.5 w-full rounded-md border border-border-strong bg-canvas px-3 py-2 text-sm text-ink focus:border-primary focus:bg-surface'
const rotulo = 'block text-xs font-medium text-muted'

export default function AcessoHero() {
  const [aba, setAba] = useState<'entrar' | 'criar'>('entrar')
  const [estadoEntrar, acaoEntrar, pendenteEntrar] = useActionState(entrar, null)
  const [estadoCriar, acaoCriar, pendenteCriar] = useActionState(cadastrar, null)

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-xl shadow-black/10">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-primary" />
        <h2 className="font-display text-base font-semibold text-ink">Acesse a plataforma</h2>
      </div>

      <div className="mt-4 flex gap-1 rounded-md bg-canvas p-1">
        {([
          ['entrar', 'Entrar', Lock],
          ['criar', 'Criar conta', UserPlus],
        ] as const).map(([valor, texto, Icon]) => (
          <button
            key={valor}
            onClick={() => setAba(valor)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              aba === valor ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {texto}
          </button>
        ))}
      </div>

      {aba === 'entrar' ? (
        <form action={acaoEntrar} className="mt-5">
          <input type="hidden" name="proximo" value="/meus-cursos" />
          <label className={rotulo}>
            E-mail
            <input name="email" type="email" required className={campo} />
          </label>
          <label className={`mt-3 ${rotulo}`}>
            Senha
            <input name="senha" type="password" required className={campo} />
          </label>
          <button
            disabled={pendenteEntrar}
            className="mt-5 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {pendenteEntrar ? 'Entrando...' : 'Acessar'}
          </button>
          {estadoEntrar?.erro && (
            <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
              {estadoEntrar.erro}
            </p>
          )}
        </form>
      ) : (
        <form action={acaoCriar} className="mt-5">
          <label className={rotulo}>
            Nome completo
            <input name="nome" required className={campo} />
            <span className="mt-1 block text-[11px] text-subtle">
              É o nome que vai aparecer no seu certificado.
            </span>
          </label>
          <label className={`mt-3 ${rotulo}`}>
            E-mail
            <input name="email" type="email" required className={campo} />
          </label>
          <label className={`mt-3 ${rotulo}`}>
            Senha
            <input name="senha" type="password" required minLength={6} className={campo} />
          </label>
          <button
            disabled={pendenteCriar}
            className="mt-5 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {pendenteCriar ? 'Criando...' : 'Criar conta gratuita'}
          </button>
          {estadoCriar?.erro && (
            <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
              {estadoCriar.erro}
            </p>
          )}
        </form>
      )}
    </div>
  )
}
