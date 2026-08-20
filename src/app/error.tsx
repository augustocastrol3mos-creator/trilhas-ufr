'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { TriangleAlert, RotateCw } from 'lucide-react'

// Fronteira de erro do App Router: precisa ser client component e receber
// `reset`, que tenta renderizar o segmento de novo sem recarregar a página.
export default function Erro({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Vai para os logs da Vercel. Sem isto, um erro de produção só existiria
    // na tela do usuário — foi o que escondeu o defeito dos avisos.
    console.error('erro nao tratado:', error)
  }, [error])

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <TriangleAlert className="h-9 w-9 text-danger" aria-hidden="true" />

      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">
        Alguma coisa deu errado aqui
      </h1>

      <p className="mt-2 text-sm leading-relaxed text-muted">
        O problema é nosso, não seu. Nada do que você já concluiu foi perdido: progresso,
        notas e certificados ficam guardados no servidor, não nesta tela.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
        >
          <RotateCw className="h-4 w-4" />
          Tentar de novo
        </button>
        <Link
          href="/"
          className="rounded-md border border-border-strong px-5 py-2.5 text-sm font-medium text-ink hover:bg-canvas"
        >
          Voltar ao início
        </Link>
      </div>

      {error.digest && (
        <p className="mt-8 text-xs text-subtle">
          Se precisar relatar, informe o código{' '}
          <span className="font-mono text-muted">{error.digest}</span> — ele identifica
          este erro nos registros do servidor.
        </p>
      )}
    </div>
  )
}
