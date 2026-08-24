'use client'

import { useState, useRef, useEffect } from 'react'
import { Printer, ChevronDown, FileJson } from 'lucide-react'

/**
 * Botão dividido: imprimir à esquerda, mais opções na seta.
 *
 * POR QUE O JSON FICA ESCONDIDO AQUI
 *
 * O arquivo em JSON é a credencial assinada — útil para uma minoria pequena, e
 * perigoso se exposto ao lado do PDF: "arquivo assinado" SOA MAIS OFICIAL que
 * "imprimir / salvar PDF". Quem não sabe o que é suporia que o assinado é o
 * documento bom, anexaria no processo do SEI, e a comissão receberia um arquivo
 * que não sabe abrir.
 *
 * Atrás da seta, quem quer o certificado clica no botão principal sem pensar, e
 * quem sabe o que procura encontra. O rótulo diz "Certificado em JSON", não
 * "arquivo assinado", pela mesma razão: descreve o formato, não sugere hierarquia.
 */
export default function BotaoImprimir({ codigo }: { codigo: string }) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora ou apertar Esc — sem isso o menu fica aberto para
  // sempre e cobre o certificado.
  useEffect(() => {
    if (!aberto) return
    function fora(e: MouseEvent) {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false)
    }
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  return (
    <div ref={caixa} className="relative shrink-0">
      <div className="flex">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-l-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          Imprimir / salvar PDF
        </button>

        <button
          onClick={() => setAberto((v) => !v)}
          aria-label="Outros formatos"
          aria-expanded={aberto}
          aria-haspopup="menu"
          className="inline-flex items-center rounded-r-md border-l border-white/25 bg-primary px-2 py-2.5 text-white hover:bg-primary-dark"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${aberto ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-1.5 w-80 rounded-lg border border-border bg-surface p-1 shadow-lg"
        >
          <a
            href={`/api/credencial/${codigo}`}
            role="menuitem"
            onClick={() => setAberto(false)}
            className="flex gap-3 rounded-md p-3 hover:bg-canvas"
          >
            <FileJson className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              <span className="block text-sm font-medium text-ink">Certificado em JSON</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                Versão assinada digitalmente, que continua comprovável mesmo sem esta
                plataforma. Para anexar em processo, use o PDF.
              </span>
            </span>
          </a>
        </div>
      )}
    </div>
  )
}
