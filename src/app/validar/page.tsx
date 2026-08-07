import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'

async function buscar(formData: FormData) {
  'use server'
  const codigo = String(formData.get('codigo') ?? '').trim()
  if (codigo) redirect(`/validar/${encodeURIComponent(codigo)}`)
}

export default function ValidarBuscaPage() {
  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-lg border border-border bg-surface p-6">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h1 className="mt-3 font-display text-xl font-semibold text-ink">Validar certificado</h1>
        <p className="mt-1 text-sm text-muted">
          Informe o código impresso no certificado, no formato UFR-2026-XXXXXX.
        </p>

        <form action={buscar} className="mt-5">
          <input
            name="codigo"
            required
            placeholder="UFR-2026-A7K3QX"
            className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 font-mono text-sm uppercase text-ink placeholder:font-body placeholder:text-subtle"
          />
          <button className="mt-3 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark">
            Verificar
          </button>
        </form>
      </div>
    </div>
  )
}
