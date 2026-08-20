import Link from 'next/link'
import { Compass } from 'lucide-react'

// Fora do layout: `not-found.tsx` na raiz renderiza sem AppShell/PublicShell,
// então precisa da própria estrutura mínima.
export default function NaoEncontrado() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <Compass className="h-9 w-9 text-primary" aria-hidden="true" />

      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">
        Esta página não existe
      </h1>

      <p className="mt-2 text-sm leading-relaxed text-muted">
        O endereço pode ter mudado, ou o curso, turma ou certificado que você procura pode
        ter sido removido. Se você chegou por um link antigo, ele provavelmente não vale
        mais.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/cursos"
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
        >
          Ver os cursos
        </Link>
        <Link
          href="/validar"
          className="rounded-md border border-border-strong px-5 py-2.5 text-sm font-medium text-ink hover:bg-canvas"
        >
          Validar um certificado
        </Link>
      </div>

      <p className="mt-8 text-xs text-subtle">
        Procurando conferir um certificado? Use o código impresso nele em
        Validar certificado — a verificação não depende de ter conta.
      </p>
    </div>
  )
}
