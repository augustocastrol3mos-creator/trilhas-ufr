'use client'

import { useState, useTransition } from 'react'
import { ChevronUp, ChevronDown, Trash2, Plus, Lock, Pencil, X } from 'lucide-react'
import { salvarItem, removerItem, moverItem } from './acoes'

export type Item = {
  id: string
  ordem: number
  enunciado: string
  competencia_id: string
  competencia_nome: string
  respostas: number
}

export type Competencia = { id: string; numero: number; nome: string }

export default function EditorItens({
  questionarioId,
  ativa,
  itens,
  competencias,
}: {
  questionarioId: string
  ativa: boolean
  itens: Item[]
  competencias: Competencia[]
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [novo, setNovo] = useState(false)
  const [texto, setTexto] = useState('')
  const [comp, setComp] = useState(competencias[0]?.id ?? '')
  const [ocupado, iniciar] = useTransition()

  const proximaOrdem = itens.length > 0 ? Math.max(...itens.map((i) => i.ordem)) + 1 : 1

  function agir(fn: () => Promise<{ ok: boolean; erro?: string }>) {
    setErro(null)
    iniciar(async () => {
      const r = await fn()
      if (!r.ok) setErro(r.erro ?? 'Não consegui salvar.')
      else {
        setEditando(null)
        setNovo(false)
        setTexto('')
      }
    })
  }

  function abrirEdicao(i: Item) {
    setNovo(false)
    setEditando(i.id)
    setTexto(i.enunciado)
    setComp(i.competencia_id)
  }

  if (ativa) {
    return (
      <div className="rounded-lg border border-border bg-surface p-5">
        <p className="flex items-start gap-2 text-sm text-muted">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Esta é a versão em uso. Ela não pode ser editada — mudar as frases embaixo de
            quem já respondeu faria os resultados anteriores virarem número sem régua.
            Para alterar, crie uma nova versão a partir dela, edite, e publique.
          </span>
        </p>
        <ul className="mt-4 divide-y divide-border border-t border-border">
          {itens.map((i) => (
            <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-3 py-2.5">
              <span className="min-w-0 flex-1 text-sm text-ink">
                <span className="mr-2 text-subtle">{i.ordem}.</span>
                {i.enunciado}
              </span>
              <span className="shrink-0 text-xs text-subtle">{i.competencia_nome}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const campo =
    'mt-1.5 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink focus:border-primary'

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {itens.length} {itens.length === 1 ? 'frase' : 'frases'}. Item já respondido não pode
          ser apagado.
        </p>
        <button
          onClick={() => {
            setNovo(true)
            setEditando(null)
            setTexto('')
          }}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-ink hover:border-border-strong"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova frase
        </button>
      </div>

      {(novo || editando) && (
        <div className="mt-4 rounded-md border border-primary bg-primary-soft/40 p-4">
          <label className="block text-sm font-medium text-ink">
            Frase
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={2}
              placeholder="Eu ajusto meu comportamento diante de mudanças inesperadas."
              className={campo}
            />
            <span className="mt-1 block text-xs text-subtle">
              Escreva em primeira pessoa e sobre comportamento observável, como as demais.
            </span>
          </label>

          <label className="mt-3 block text-sm font-medium text-ink">
            Competência
            <select value={comp} onChange={(e) => setComp(e.target.value)} className={campo}>
              {competencias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero}. {c.nome}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              disabled={ocupado || !texto.trim()}
              onClick={() =>
                agir(() =>
                  salvarItem(
                    questionarioId,
                    comp,
                    texto,
                    editando ? (itens.find((i) => i.id === editando)?.ordem ?? proximaOrdem) : proximaOrdem,
                    editando ?? undefined
                  )
                )
              }
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {ocupado ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={() => {
                setNovo(false)
                setEditando(null)
                setTexto('')
              }}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-ink"
            >
              <X className="h-3.5 w-3.5" />
              Cancelar
            </button>
          </div>
        </div>
      )}

      {erro && (
        <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>
      )}

      <ul className="mt-4 divide-y divide-border border-t border-border">
        {itens.map((i, idx) => (
          <li key={i.id} className="flex flex-wrap items-start gap-3 py-3">
            <span className="w-6 shrink-0 pt-0.5 text-sm text-subtle">{i.ordem}.</span>

            <span className="min-w-0 flex-1">
              <span className="block text-sm text-ink">{i.enunciado}</span>
              <span className="mt-0.5 block text-xs text-subtle">
                {i.competencia_nome}
                {i.respostas > 0 && ` · ${i.respostas} resposta(s)`}
              </span>
            </span>

            <span className="flex shrink-0 gap-1">
              <button
                onClick={() => agir(() => moverItem(i.id, true))}
                disabled={idx === 0 || ocupado}
                aria-label="Mover para cima"
                className="rounded border border-border p-1.5 text-muted hover:border-border-strong disabled:opacity-30"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => agir(() => moverItem(i.id, false))}
                disabled={idx === itens.length - 1 || ocupado}
                aria-label="Mover para baixo"
                className="rounded border border-border p-1.5 text-muted hover:border-border-strong disabled:opacity-30"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => abrirEdicao(i)}
                aria-label="Editar"
                className="rounded border border-border p-1.5 text-muted hover:border-border-strong"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => agir(() => removerItem(i.id))}
                disabled={ocupado || i.respostas > 0}
                aria-label="Apagar"
                title={i.respostas > 0 ? 'Já respondido: não pode ser apagado' : 'Apagar'}
                className="rounded border border-border p-1.5 text-danger hover:border-danger disabled:opacity-30"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
