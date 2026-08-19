import { Info, TriangleAlert, Megaphone } from 'lucide-react'

export type Aviso = { id: string; titulo: string; mensagem: string; tipo: string }

// Cada tipo tem cor E ícone. Cor sozinha não comunica para quem não distingue
// as cores — é o critério 1.4.1 da WCAG, "uso de cor".
const ESTILO: Record<string, { caixa: string; icone: string; Icon: typeof Info }> = {
  urgente: {
    caixa: 'border-danger bg-danger-soft',
    icone: 'text-danger',
    Icon: Megaphone,
  },
  atencao: {
    caixa: 'border-accent bg-accent-soft',
    icone: 'text-accent',
    Icon: TriangleAlert,
  },
  info: {
    caixa: 'border-primary-soft bg-primary-soft',
    icone: 'text-primary',
    Icon: Info,
  },
}

export default function Avisos({ avisos }: { avisos: Aviso[] }) {
  if (avisos.length === 0) return null

  return (
    <section aria-label="Avisos da coordenação" className="no-print mb-8 space-y-3">
      {avisos.map((a) => {
        const e = ESTILO[a.tipo] ?? ESTILO.info
        return (
          <div key={a.id} className={`flex gap-3 rounded-lg border p-4 ${e.caixa}`}>
            <e.Icon className={`mt-0.5 h-4 w-4 shrink-0 ${e.icone}`} aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold text-ink">{a.titulo}</p>
              <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-muted">
                {a.mensagem}
              </p>
            </div>
          </div>
        )
      })}
    </section>
  )
}
