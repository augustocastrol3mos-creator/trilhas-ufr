'use client'

import { Printer } from 'lucide-react'

export default function BotaoImprimir() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
    >
      <Printer className="h-4 w-4" />
      Imprimir / salvar PDF
    </button>
  )
}
