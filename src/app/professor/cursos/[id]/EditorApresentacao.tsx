'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Info } from 'lucide-react'
import EditorMarkdown from '@/components/EditorMarkdown'
import { salvarApresentacao } from './acoes-capa'

export default function EditorApresentacao({
  cursoId, apresentacao,
}: { cursoId: string; apresentacao: string | null }) {
  const router = useRouter()
  const [texto, setTexto] = useState(apresentacao ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [pendente, iniciar] = useTransition()

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
        Apresentação do curso
      </h2>

      <p className="mt-2 text-sm leading-relaxed text-muted">
        Aparece no topo da trilha, aberta enquanto o aluno não começou e recolhida depois.
        <strong className="text-ink"> Não é uma etapa</strong>: não conta progresso e fica
        sempre à mão para ele reler.
      </p>
      <p className="mt-1 text-xs leading-relaxed text-subtle">
        Bom lugar para: boas-vindas, o que ele vai aprender, como funciona a avaliação, o
        que levar ao encontro presencial. Coisas que o aluno vai querer consultar de novo
        no meio do curso — e que, se estivessem num módulo, ele teria concluído e nunca
        mais visto.
      </p>

      <div className="mt-4">
        <EditorMarkdown valor={texto} aoMudar={(v) => { setTexto(v); setSalvo(false) }} linhas={12} />
      </div>

      {erro && (
        <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={() => {
            setErro(null)
            iniciar(async () => {
              const r = await salvarApresentacao(cursoId, texto.trim() || null)
              if (!r.ok) setErro(r.erro ?? 'nao foi possivel salvar')
              else { setSalvo(true); router.refresh() }
            })
          }}
          disabled={pendente}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {pendente ? 'Salvando…' : 'Salvar apresentação'}
        </button>

        {salvo && !pendente && (
          <span className="flex items-center gap-1.5 text-sm text-success">
            <Check className="h-4 w-4" />
            Salvo
          </span>
        )}
      </div>
    </div>
  )
}
