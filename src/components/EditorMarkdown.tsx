'use client'

import { useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Bold, Italic, Heading2, Heading3, List, ListOrdered, Link2,
  Quote, Code, Eye, Columns2, HelpCircle,
} from 'lucide-react'

/**
 * Editor de texto para os blocos do curso.
 *
 * ------------------------------------------------------------------------
 * POR QUE NÃO É UM EDITOR VISUAL
 * ------------------------------------------------------------------------
 * A tentação óbvia era usar TipTap, Lexical ou similar. Três motivos contra,
 * nesta ordem de peso:
 *
 * 1. Este projeto precisa sobreviver sem manutenção. Editores de texto rico
 *    são a categoria de dependência que mais quebra sozinha — biblioteca
 *    grande, API que muda, atualização frequente. Em dois anos, sem ninguém
 *    para consertar, seria o primeiro lugar a falhar.
 *
 * 2. Editor visual guarda HTML. HTML escrito por um usuário e exibido para
 *    outros exige sanitização, e sanitização mal feita é XSS. Markdown
 *    renderizado é seguro por construção — trocar isso por botões seria
 *    trocar segurança por conveniência.
 *
 * 3. Markdown impede escolher fonte e cor. Todo curso sai com a mesma
 *    tipografia institucional. Editor visual convida ao vermelho 20px, e aí
 *    não há guia de estilo que segure.
 *
 * O QUE ISTO FAZ NO LUGAR: barra que age sobre a seleção, atalhos de teclado e
 * prévia ao vivo. O professor seleciona, clica em N, vê negrito na hora —
 * mesma experiência, sem precisar saber que existe Markdown por baixo.
 */

type Acao = {
  Icon: typeof Bold
  titulo: string
  antes: string
  depois?: string
  linha?: boolean       // aplica no começo da linha, em vez de envolver
  exemplo: string
  atalho?: string
}

const ACOES: Acao[] = [
  { Icon: Bold,        titulo: 'Negrito',    antes: '**', depois: '**', exemplo: 'texto', atalho: 'b' },
  { Icon: Italic,      titulo: 'Itálico',    antes: '_',  depois: '_',  exemplo: 'texto', atalho: 'i' },
  { Icon: Heading2,    titulo: 'Título',     antes: '## ',  linha: true, exemplo: 'Título da seção' },
  { Icon: Heading3,    titulo: 'Subtítulo',  antes: '### ', linha: true, exemplo: 'Subtítulo' },
  { Icon: List,        titulo: 'Lista',      antes: '- ',   linha: true, exemplo: 'item' },
  { Icon: ListOrdered, titulo: 'Lista numerada', antes: '1. ', linha: true, exemplo: 'item' },
  { Icon: Quote,       titulo: 'Citação',    antes: '> ',   linha: true, exemplo: 'citação' },
  { Icon: Link2,       titulo: 'Link',       antes: '[', depois: '](https://)', exemplo: 'texto do link', atalho: 'k' },
  { Icon: Code,        titulo: 'Código',     antes: '`', depois: '`', exemplo: 'código' },
]

export default function EditorMarkdown({
  valor, aoMudar, linhas = 18,
}: {
  valor: string
  aoMudar: (v: string) => void
  linhas?: number
}) {
  const area = useRef<HTMLTextAreaElement>(null)
  const [vista, setVista] = useState<'dividido' | 'previa'>('dividido')
  const [ajuda, setAjuda] = useState(false)

  function aplicar(a: Acao) {
    const el = area.current
    if (!el) return

    const ini = el.selectionStart
    const fim = el.selectionEnd
    const selecionado = valor.slice(ini, fim)
    const texto = selecionado || a.exemplo

    let novo: string
    let novoIni: number
    let novoFim: number

    if (a.linha) {
      // Marcadores de linha vão no começo da linha onde está o cursor, não
      // onde o cursor está — "## " no meio de uma frase não vira título.
      const comecoLinha = valor.lastIndexOf('\n', ini - 1) + 1
      novo = valor.slice(0, comecoLinha) + a.antes + valor.slice(comecoLinha)
      novoIni = ini + a.antes.length
      novoFim = fim + a.antes.length
    } else {
      novo = valor.slice(0, ini) + a.antes + texto + (a.depois ?? '') + valor.slice(fim)
      novoIni = ini + a.antes.length
      novoFim = novoIni + texto.length
    }

    aoMudar(novo)
    // O foco precisa voltar para o campo, senão o professor clica no botão e
    // perde o lugar onde estava escrevendo.
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(novoIni, novoFim)
    })
  }

  function teclado(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.ctrlKey || e.metaKey) {
      const a = ACOES.find((x) => x.atalho === e.key.toLowerCase())
      if (a) {
        e.preventDefault()
        aplicar(a)
        return
      }
    }

    // Enter dentro de uma lista continua a lista. Sem isto, escrever uma lista
    // de cinco itens exige digitar "- " cinco vezes, e é onde a maioria das
    // pessoas desiste e escreve tudo corrido.
    if (e.key === 'Enter' && !e.shiftKey) {
      const el = e.currentTarget
      const ini = el.selectionStart
      const linha = valor.slice(valor.lastIndexOf('\n', ini - 1) + 1, ini)

      const marcador = linha.match(/^(\s*)([-*]|\d+\.)\s+/)
      if (marcador) {
        e.preventDefault()

        // Enter numa linha de lista vazia encerra a lista, em vez de criar
        // outro item vazio para sempre.
        if (linha.trim() === marcador[2]) {
          const comeco = valor.lastIndexOf('\n', ini - 1) + 1
          const novo = valor.slice(0, comeco) + valor.slice(ini)
          aoMudar(novo)
          requestAnimationFrame(() => el.setSelectionRange(comeco, comeco))
          return
        }

        const proximo = /^\d+\.$/.test(marcador[2])
          ? `${parseInt(marcador[2]) + 1}. `
          : `${marcador[2]} `
        const insercao = '\n' + marcador[1] + proximo
        const novo = valor.slice(0, ini) + insercao + valor.slice(ini)
        aoMudar(novo)
        requestAnimationFrame(() =>
          el.setSelectionRange(ini + insercao.length, ini + insercao.length)
        )
      }
    }
  }

  return (
    <div className="rounded-lg border border-border-strong bg-surface">
      {/* ---------- barra ---------- */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
        {ACOES.map((a) => (
          <button
            key={a.titulo}
            type="button"
            onClick={() => aplicar(a)}
            title={a.atalho ? `${a.titulo} (Ctrl+${a.atalho.toUpperCase()})` : a.titulo}
            aria-label={a.titulo}
            className="rounded p-1.5 text-muted hover:bg-canvas hover:text-ink"
          >
            <a.Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        ))}

        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAjuda((v) => !v)}
            aria-label="Ajuda de formatação"
            aria-expanded={ajuda}
            className="rounded p-1.5 text-muted hover:bg-canvas hover:text-ink"
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setVista(vista === 'dividido' ? 'previa' : 'dividido')}
            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium text-muted hover:bg-canvas hover:text-ink"
          >
            {vista === 'dividido' ? (
              <>
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                Só a prévia
              </>
            ) : (
              <>
                <Columns2 className="h-3.5 w-3.5" aria-hidden="true" />
                Lado a lado
              </>
            )}
          </button>
        </span>
      </div>

      {ajuda && (
        <div className="border-b border-border bg-canvas px-4 py-3 text-xs leading-relaxed text-muted">
          <p className="font-medium text-ink">Você não precisa decorar nada — use os botões.</p>
          <p className="mt-1.5">
            Se preferir digitar: <code className="text-ink">## Título</code>,{' '}
            <code className="text-ink">**negrito**</code>,{' '}
            <code className="text-ink">_itálico_</code>,{' '}
            <code className="text-ink">- item de lista</code>,{' '}
            <code className="text-ink">&gt; citação</code>,{' '}
            <code className="text-ink">[texto](endereço)</code>. Linha em branco separa
            parágrafos.
          </p>
        </div>
      )}

      {/* ---------- edição e prévia ---------- */}
      <div className={vista === 'dividido' ? 'grid lg:grid-cols-2' : ''}>
        {vista === 'dividido' && (
          <div className="border-border lg:border-r">
            <textarea
              ref={area}
              value={valor}
              onChange={(e) => aoMudar(e.target.value)}
              onKeyDown={teclado}
              rows={linhas}
              placeholder="Escreva o conteúdo desta etapa. Use os botões acima para formatar."
              className="w-full resize-y bg-transparent px-4 py-3 font-mono text-[13px] leading-relaxed text-ink outline-none"
            />
          </div>
        )}

        <div className={vista === 'dividido' ? 'bg-canvas/50' : ''}>
          <p className="border-b border-border px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-subtle">
            Como o aluno vai ver
          </p>
          <div className="px-4 py-3">
            {valor.trim() ? (
              <article className="prose prose-sm prose-neutral max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{valor}</ReactMarkdown>
              </article>
            ) : (
              <p className="py-8 text-center text-sm text-subtle">
                A prévia aparece aqui conforme você escreve.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
