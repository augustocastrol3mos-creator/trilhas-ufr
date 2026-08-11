'use client'

import { useState, useTransition } from 'react'
import { FileText, ListChecks, PlayCircle, CheckSquare, Download } from 'lucide-react'
import { criarBloco } from '@/app/professor/cursos/actions'
import { TIPOS_DISPONIVEIS, ROTULOS_TIPO } from '@/lib/blocos/defaults'
import type { TipoBloco } from '@/lib/blocos/schemas'

const ICONES: Record<string, typeof FileText> = {
  texto: FileText,
  video: PlayCircle,
  quiz: ListChecks,
  checkpoint: CheckSquare,
  material: Download,
}

export default function AdicionarBloco({
  cursoId, moduloId, moduloTitulo,
}: { cursoId: string; moduloId: string; moduloTitulo: string }) {
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="text-xs text-subtle">Adicionar bloco a &quot;{moduloTitulo}&quot;</p>
      <p className="mt-0.5 text-xs text-subtle">
        Vídeo roda no YouTube · Texto aceita Markdown · Material aceita PDF e planilha ·
        Quiz é corrigido automaticamente
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {TIPOS_DISPONIVEIS.map((tipo: TipoBloco) => {
          const Icon = ICONES[tipo] ?? FileText
          return (
            <button
              key={tipo}
              disabled={pendente}
              onClick={() =>
                iniciar(async () => {
                  setErro(null)
                  const r = await criarBloco(cursoId, moduloId, tipo)
                  if (r?.erro) setErro(r.erro)
                })
              }
              className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm text-ink hover:border-primary hover:text-primary disabled:opacity-50"
            >
              <Icon className="h-3.5 w-3.5" />
              {ROTULOS_TIPO[tipo]}
            </button>
          )
        })}
      </div>

      {erro && (
        <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>
      )}
    </div>
  )
}
