'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Eye, EyeOff, X, Check } from 'lucide-react'
import { criarCategoria, atualizarCategoria, excluirCategoria } from './acoes'

export type Categoria = {
  id: string
  nome: string
  slug: string
  descricao: string | null
  ordem: number
  ativa: boolean
  cursos: number
  publicados: number
}

const campo =
  'mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink'
const rotulo = 'block text-xs font-medium text-muted'

export default function GestorCategorias({ categorias }: { categorias: Categoria[] }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const [editando, setEditando] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState({ nome: '', descricao: '', ordem: 0 })
  const [nova, setNova] = useState({ nome: '', descricao: '' })

  function rodar(fn: () => Promise<{ ok: boolean; erro?: string }>, aoDar?: () => void) {
    setErro(null)
    iniciar(async () => {
      const r = await fn()
      if (!r.ok) setErro(r.erro ?? 'nao foi possivel concluir')
      else {
        aoDar?.()
        router.refresh()
      }
    })
  }

  return (
    <div>
      {erro && (
        <p className="mb-4 rounded-md border border-danger-soft bg-danger-soft px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}

      <ul className="space-y-3">
        {categorias.map((c) => (
          <li
            key={c.id}
            className={`rounded-lg border bg-surface p-4 ${
              c.ativa ? 'border-border' : 'border-dashed border-border-strong'
            }`}
          >
            {editando === c.id ? (
              <div className="grid gap-3 sm:grid-cols-6">
                <label className={`${rotulo} sm:col-span-2`}>
                  Nome
                  <input
                    value={rascunho.nome}
                    onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
                    className={campo}
                  />
                </label>
                <label className={`${rotulo} sm:col-span-3`}>
                  Descrição
                  <input
                    value={rascunho.descricao}
                    onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })}
                    className={campo}
                  />
                </label>
                <label className={rotulo}>
                  Ordem
                  <input
                    type="number"
                    value={rascunho.ordem}
                    onChange={(e) => setRascunho({ ...rascunho, ordem: Number(e.target.value) })}
                    className={campo}
                  />
                </label>

                <div className="flex gap-3 sm:col-span-6">
                  <button
                    onClick={() =>
                      rodar(
                        () => atualizarCategoria(c.id, { ...rascunho, ativa: c.ativa }),
                        () => setEditando(null)
                      )
                    }
                    disabled={pendente || !rascunho.nome.trim()}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Salvar
                  </button>
                  <button
                    onClick={() => setEditando(null)}
                    className="text-sm font-medium text-muted hover:text-ink"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-semibold text-ink">
                    {c.nome}
                    {!c.ativa && (
                      <span className="ml-2 rounded-full border border-border-strong px-2 py-0.5 text-xs font-medium text-muted">
                        inativa
                      </span>
                    )}
                  </h3>
                  {c.descricao && <p className="mt-1 text-sm text-muted">{c.descricao}</p>}
                  <p className="mt-1 text-xs text-subtle">
                    /cursos?cat={c.slug} · {c.cursos} curso(s), {c.publicados} publicado(s) ·
                    ordem {c.ordem}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setEditando(c.id)
                      setRascunho({
                        nome: c.nome,
                        descricao: c.descricao ?? '',
                        ordem: c.ordem,
                      })
                    }}
                    aria-label={`Editar ${c.nome}`}
                    className="text-muted hover:text-ink"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() =>
                      rodar(() =>
                        atualizarCategoria(c.id, {
                          nome: c.nome,
                          descricao: c.descricao ?? '',
                          ordem: c.ordem,
                          ativa: !c.ativa,
                        })
                      )
                    }
                    disabled={pendente}
                    aria-label={c.ativa ? `Desativar ${c.nome}` : `Reativar ${c.nome}`}
                    title={
                      c.ativa
                        ? 'Desativar: some do formulário do professor e do filtro, mas os cursos que já a usam continuam rotulados'
                        : 'Reativar'
                    }
                    className="text-muted hover:text-ink disabled:opacity-50"
                  >
                    {c.ativa ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>

                  <button
                    onClick={() => rodar(() => excluirCategoria(c.id))}
                    disabled={pendente || c.cursos > 0}
                    aria-label={`Excluir ${c.nome}`}
                    title={
                      c.cursos > 0
                        ? `${c.cursos} curso(s) usam esta categoria — desative em vez de excluir`
                        : 'Excluir'
                    }
                    className="text-muted hover:text-danger disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-lg border border-dashed border-border-strong bg-surface p-5">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
          <Plus className="h-4 w-4" />
          Nova categoria
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className={rotulo}>
            Nome *
            <input
              value={nova.nome}
              onChange={(e) => setNova({ ...nova, nome: e.target.value })}
              placeholder="Logística"
              className={campo}
            />
          </label>
          <label className={`${rotulo} sm:col-span-2`}>
            Descrição
            <input
              value={nova.descricao}
              onChange={(e) => setNova({ ...nova, descricao: e.target.value })}
              placeholder="Cadeia de suprimentos e operações"
              className={campo}
            />
          </label>
        </div>
        <button
          onClick={() =>
            rodar(
              () => criarCategoria(nova.nome, nova.descricao),
              () => setNova({ nome: '', descricao: '' })
            )
          }
          disabled={pendente || !nova.nome.trim()}
          className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {pendente ? 'Salvando…' : 'Criar categoria'}
        </button>
      </div>
    </div>
  )
}
