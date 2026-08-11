'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { BookOpenCheck } from 'lucide-react'
import { textoSchema } from '@/lib/blocos/schemas'
import { concluirBloco } from '@/app/trilha/actions'
import type { PropsBloco } from './BlocoRenderer'

/** ~400 palavras/min, com piso de 15s e teto de 3min. */
function tempoLeituraSegundos(texto: string) {
  const palavras = texto.trim().split(/\s+/).length
  return Math.min(180, Math.max(15, Math.round((palavras / 400) * 60)))
}

export default function BlocoTexto({ bloco, matriculaId, estado, onConcluir }: PropsBloco) {
  const parsed = textoSchema.safeParse(bloco.config)
  const concluido = estado === 'concluido'

  const [chegouAoFim, setChegouAoFim] = useState(false)
  const [restante, setRestante] = useState(0)
  const [pendente, iniciar] = useTransition()
  const fim = useRef<HTMLDivElement>(null)

  const minimo = parsed.success ? tempoLeituraSegundos(parsed.data.markdown) : 15

  useEffect(() => {
    if (concluido) return
    setRestante(minimo)
    const t = setInterval(() => setRestante((r) => (r <= 1 ? 0 : r - 1)), 1000)
    return () => clearInterval(t)
  }, [concluido, minimo])

  useEffect(() => {
    if (concluido || !fim.current) return
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setChegouAoFim(true)
      },
      { threshold: 1 }
    )
    obs.observe(fim.current)
    return () => obs.disconnect()
  }, [concluido])

  if (!parsed.success) {
    return <p className="text-sm text-danger">Configuração inválida deste bloco.</p>
  }

  const liberado = chegouAoFim && restante === 0

  return (
    <div>
      <article className="prose prose-neutral max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{parsed.data.markdown}</ReactMarkdown>
      </article>

      <div ref={fim} className="h-px" />

      {!concluido && (
        <div className="mt-6 border-t border-border pt-4">
          <button
            disabled={!liberado || pendente}
            onClick={() =>
              iniciar(async () => {
                const r = await concluirBloco(matriculaId, bloco.blocoId, {
                  lidoEm: new Date().toISOString(),
                })
                if (!r.erro) onConcluir()
              })
            }
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-40"
          >
            <BookOpenCheck className="h-4 w-4" />
            {pendente ? 'Registrando...' : 'Marcar como lido'}
          </button>

          {!liberado && (
            <p className="mt-2 text-xs text-subtle">
              {!chegouAoFim
                ? 'Role até o fim do texto para liberar.'
                : `Aguarde mais ${restante}s de leitura.`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
