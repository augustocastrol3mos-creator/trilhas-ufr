'use client'

import { useState, useTransition } from 'react'
import { Download, FileText } from 'lucide-react'
import { materialSchema } from '@/lib/blocos/schemas'
import { concluirBloco, urlDoMaterial } from '@/app/trilha/actions'
import type { PropsBloco } from './BlocoRenderer'

function tamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function BlocoMaterial({ bloco, matriculaId, estado, onConcluir }: PropsBloco) {
  const parsed = materialSchema.safeParse(bloco.config)
  const [erro, setErro] = useState<string | null>(null)
  const [baixando, setBaixando] = useState<string | null>(null)
  const [, iniciar] = useTransition()

  if (!parsed.success) {
    return <p className="text-sm text-danger">Configuração inválida deste bloco.</p>
  }

  async function baixar(path: string, nome: string) {
    setErro(null)
    setBaixando(path)
    const r = await urlDoMaterial(path)
    setBaixando(null)

    if (r.erro || !r.url) {
      setErro(r.erro ?? 'Não foi possível gerar o link do arquivo.')
      return
    }

    const a = document.createElement('a')
    a.href = r.url
    a.download = nome
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()

    if (estado !== 'concluido') {
      iniciar(async () => {
        const c = await concluirBloco(matriculaId, bloco.blocoId, {
          baixadoEm: new Date().toISOString(),
        })
        if (!c.erro) onConcluir()
      })
    }
  }

  return (
    <div>
      <ul className="space-y-2">
        {parsed.data.arquivos.map((a) => (
          <li key={a.path}>
            <button
              onClick={() => baixar(a.path, a.nome)}
              disabled={baixando === a.path}
              className="flex w-full items-center gap-3 rounded-md border border-border bg-canvas px-4 py-3 text-left hover:border-primary disabled:opacity-50"
            >
              <FileText className="h-5 w-5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{a.nome}</span>
                <span className="block text-xs text-subtle">{tamanho(a.tamanhoBytes)}</span>
              </span>
              <Download className="h-4 w-4 shrink-0 text-muted" />
            </button>
          </li>
        ))}
      </ul>

      {erro && <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>}
    </div>
  )
}
