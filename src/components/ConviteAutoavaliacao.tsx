'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, X } from 'lucide-react'

const CHAVE = 'trilhas:convite-autoavaliacao-adiado'

/**
 * Convite para responder a autoavaliação, mostrado a quem ainda não respondeu.
 *
 * POR QUE ELE FECHA, SE A AUTOAVALIAÇÃO É OBRIGATÓRIA
 *
 * Porque quem obriga não é este aviso — é o `inscrever()`, que recusa a primeira
 * inscrição de quem não respondeu (0040). Um aviso que não fecha não obriga
 * ninguém a nada: ele só impede a pessoa de usar o catálogo antes de decidir, e
 * quem chegou para olhar os cursos vai embora em vez de responder 53 frases que
 * ainda não sabe para que servem.
 *
 * A ordem que funciona é a inversa: deixa olhar, avisa, e cobra no momento em
 * que a resposta passa a fazer diferença — a inscrição, que é quando a pessoa
 * já quer alguma coisa da plataforma e a autoavaliação passa a ter propósito
 * visível ("é isso que vai orientar sua trilha").
 *
 * `sessionStorage` e não `localStorage`: adiar vale para a visita de hoje. Na
 * próxima vez que abrir, o convite volta. Adiar para sempre com um clique seria
 * o mesmo que não ter convite.
 */
export default function ConviteAutoavaliacao() {
  const [visivel, setVisivel] = useState(false)
  const caminho = usePathname()

  useEffect(() => {
    // Não aparece em cima da própria tela do questionário nem no login: seria
    // um convite para ir onde a pessoa já está.
    if (caminho.startsWith('/questionario') || caminho.startsWith('/login')) return
    try {
      if (sessionStorage.getItem(CHAVE)) return
    } catch {
      // Navegador com armazenamento bloqueado: mostra assim mesmo. Perder o
      // "adiar" é menos ruim que sumir com o convite.
    }
    setVisivel(true)
  }, [caminho])

  function adiar() {
    try {
      sessionStorage.setItem(CHAVE, '1')
    } catch {}
    setVisivel(false)
  }

  if (!visivel) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="convite-titulo"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" />
            <h2 id="convite-titulo" className="font-display text-base font-semibold text-ink">
              Vamos conhecer suas competências?
            </h2>
          </div>
          <button
            onClick={adiar}
            aria-label="Adiar"
            className="rounded p-1 text-muted hover:bg-canvas hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-sm text-muted">
          São 53 frases sobre como você age no dia a dia. O resultado mostra por onde
          começar e sugere cursos — e é o que você vai poder comparar depois, para ver
          o quanto mudou.
        </p>

        <p className="mt-3 text-sm text-muted">
          Leva uns dez minutos e dá para parar no meio: suas respostas ficam salvas.
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <Link
            href="/questionario"
            onClick={adiar}
            className="flex-1 rounded-md bg-primary px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-primary-dark"
          >
            Começar agora
          </Link>
          <button
            onClick={adiar}
            className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm text-ink hover:border-border-strong"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  )
}
