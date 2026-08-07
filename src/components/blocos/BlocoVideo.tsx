'use client'

import { useEffect, useRef, useState } from 'react'
import { videoSchema, type BlocoAluno } from '@/lib/blocos/schemas'
import { registrarProgressoVideo } from '@/app/trilha/actions'

declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: () => void
  }
}

const JANELA = 10 // segundos por fatia rastreada

function carregarApi(): Promise<void> {
  return new Promise((resolve) => {
    if (window.YT?.Player) return resolve()
    const anterior = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      anterior?.()
      resolve()
    }
    if (!document.getElementById('yt-iframe-api')) {
      const s = document.createElement('script')
      s.id = 'yt-iframe-api'
      s.src = 'https://www.youtube.com/iframe_api'
      document.body.appendChild(s)
    }
  })
}

export default function BlocoVideo({
  bloco, matriculaId,
}: { bloco: BlocoAluno; matriculaId: string }) {
  const parsed = videoSchema.safeParse(bloco.config)
  const containerRef = useRef<HTMLDivElement>(null)
  const fatiasRef = useRef<Set<number>>(new Set())
  const [percentual, setPercentual] = useState(
    Number(bloco.dados?.percentualAssistido ?? 0)
  )
  const [concluido, setConcluido] = useState(bloco.estado === 'concluido')

  useEffect(() => {
    if (!parsed.success || !containerRef.current) return

    const { videoId, duracaoSegundos } = parsed.data
    const totalFatias = Math.max(1, Math.ceil(duracaoSegundos / JANELA))
    let player: any
    let timer: ReturnType<typeof setInterval> | undefined
    let cancelado = false

    carregarApi().then(() => {
      if (cancelado || !containerRef.current) return

      player = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1, cc_load_policy: 1 },
        events: {
          onStateChange: (e: any) => {
            // 1 = tocando
            if (e.data === 1 && !timer) {
              timer = setInterval(tick, 1000)
            } else if (e.data !== 1 && timer) {
              clearInterval(timer)
              timer = undefined
              enviar()
            }
          },
        },
      })
    })

    function tick() {
      const t = player?.getCurrentTime?.()
      if (typeof t !== 'number') return
      fatiasRef.current.add(Math.floor(t / JANELA))
      const pct = Math.min(100, (fatiasRef.current.size / totalFatias) * 100)
      setPercentual(Math.round(pct))
      if (fatiasRef.current.size % 3 === 0) enviar()
    }

    async function enviar() {
      const pct = Math.min(100, (fatiasRef.current.size / totalFatias) * 100)
      if (pct <= 0) return
      const r = await registrarProgressoVideo(matriculaId, bloco.blocoId, pct)
      if (r?.concluido) setConcluido(true)
    }

    return () => {
      cancelado = true
      if (timer) clearInterval(timer)
      player?.destroy?.()
    }
  }, [parsed.success, matriculaId, bloco.blocoId])

  if (!parsed.success) {
    return <p className="text-sm text-red-600">Configuração inválida deste bloco.</p>
  }

  return (
    <div>
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
        <div ref={containerRef} className="h-full w-full" />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${Math.round(percentual)}%` }}
          />
        </div>
        <span className="text-sm text-muted">{Math.round(percentual)}%</span>
      </div>
      {concluido && <p className="mt-2 text-sm text-primary">Vídeo concluído.</p>}
    </div>
  )
}
