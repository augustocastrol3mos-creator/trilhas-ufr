'use client'

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { textoSchema, type BlocoAluno } from '@/lib/blocos/schemas'
import { concluirBloco } from '@/app/trilha/actions'

export default function BlocoTexto({
  bloco, matriculaId,
}: { bloco: BlocoAluno; matriculaId: string }) {
  const parsed = textoSchema.safeParse(bloco.config)
  const [concluido, setConcluido] = useState(bloco.estado === 'concluido')
  const fim = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (concluido || !fim.current) return
    const obs = new IntersectionObserver(async ([e]) => {
      if (!e.isIntersecting) return
      obs.disconnect()
      setConcluido(true)
      await concluirBloco(matriculaId, bloco.blocoId, { lidoEm: new Date().toISOString() })
    }, { threshold: 1 })
    obs.observe(fim.current)
    return () => obs.disconnect()
  }, [concluido, matriculaId, bloco.blocoId])

  if (!parsed.success) {
    return <p className="text-sm text-red-600">Configuração inválida deste bloco.</p>
  }

  return (
    <div>
      <article className="prose prose-neutral max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{parsed.data.markdown}</ReactMarkdown>
      </article>
      <div ref={fim} className="h-px" />
      {concluido && (
        <p className="mt-4 flex items-center gap-1.5 text-sm text-primary">Leitura registrada.</p>
      )}
    </div>
  )
}
