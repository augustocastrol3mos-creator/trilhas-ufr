'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import CapaCurso from '@/components/CapaCurso'
import { salvarCapa } from './acoes-capa'

export default function EditorCapa({
  cursoId, titulo, categoria, capaUrl,
}: {
  cursoId: string
  titulo: string
  categoria: string | null
  capaUrl: string | null
}) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const [enviando, setEnviando] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  async function enviar(arquivo: File) {
    setErro(null)

    if (!arquivo.type.startsWith('image/')) {
      setErro('escolha um arquivo de imagem')
      return
    }
    // 2 MB: capa é decoração e vai num bucket público. Arquivo grande só
    // deixaria o catálogo lento no celular de quem tem internet ruim.
    if (arquivo.size > 2 * 1024 * 1024) {
      setErro('a imagem precisa ter no máximo 2 MB')
      return
    }

    setEnviando(true)
    const supabase = createClient()
    const ext = arquivo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    // O path começa pelo id do curso: é dele que pode_editar_capa (0032)
    // deriva a autorização, em vez de confiar no que o cliente afirma.
    const caminho = `${cursoId}/capa.${ext}`

    const { error } = await supabase.storage
      .from('capas')
      .upload(caminho, arquivo, { upsert: true, cacheControl: '3600' })

    if (error) {
      setEnviando(false)
      setErro(error.message)
      return
    }

    const { data } = supabase.storage.from('capas').getPublicUrl(caminho)
    // `?v=` força o navegador a buscar de novo depois de uma substituição —
    // sem isso, trocar a capa não muda nada na tela por causa do cache.
    const url = `${data.publicUrl}?v=${Date.now()}`

    setEnviando(false)
    iniciar(async () => {
      const r = await salvarCapa(cursoId, url)
      if (!r.ok) setErro(r.erro ?? 'nao foi possivel salvar')
      else router.refresh()
    })
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Capa</h2>

      <div className="mt-3 flex flex-wrap items-start gap-4">
        <CapaCurso
          titulo={titulo}
          capaUrl={capaUrl}
          categoria={categoria}
          className="h-24 w-40 shrink-0 rounded-md"
        />

        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">
            {capaUrl
              ? 'Esta é a imagem que aparece no catálogo e na página inicial.'
              : 'Seu curso já tem uma capa gerada automaticamente — ela aparece assim no catálogo. Envie uma imagem só se quiser substituí-la.'}
          </p>
          <p className="mt-1 text-xs text-subtle">
            Proporção larga (cerca de 5:2), até 2 MB. A capa é decorativa: nada que
            precise ser lido deve estar dentro dela.
          </p>

          {erro && (
            <p className="mt-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              ref={input}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) enviar(f)
                e.target.value = ''
              }}
            />
            <button
              onClick={() => input.current?.click()}
              disabled={enviando || pendente}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-50"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              {enviando || pendente ? 'Enviando…' : capaUrl ? 'Trocar imagem' : 'Enviar imagem'}
            </button>

            {capaUrl && (
              <button
                onClick={() =>
                  iniciar(async () => {
                    const r = await salvarCapa(cursoId, null)
                    if (!r.ok) setErro(r.erro ?? 'nao foi possivel remover')
                    else router.refresh()
                  })
                }
                disabled={enviando || pendente}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-danger disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Voltar à capa gerada
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
