'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Megaphone, Pencil, Trash2, X } from 'lucide-react'
import { criarAviso, atualizarAviso, excluirAviso, type DadosAviso } from './acoes'

export type AvisoAdmin = {
  id: string
  titulo: string
  mensagem: string
  tipo: string
  publico: string
  inicio_em: string | null
  fim_em: string | null
  criado_em: string
  vigente: boolean
}

const campo =
  'mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink'
const rotulo = 'block text-xs font-medium text-muted'

const VAZIO: DadosAviso = {
  titulo: '', mensagem: '', tipo: 'info', publico: 'todos', inicioEm: '', fimEm: '',
}

const TIPOS = [
  { v: 'info', l: 'Informação' },
  { v: 'atencao', l: 'Atenção' },
  { v: 'urgente', l: 'Urgente' },
]
const PUBLICOS = [
  { v: 'todos', l: 'Todos' },
  { v: 'alunos', l: 'Só alunos' },
  { v: 'instrutores', l: 'Só professores e coordenação' },
]

const paraInput = (d: string | null) => (d ? new Date(d).toISOString().slice(0, 16) : '')

function Formulario({
  dados, setDados, onSalvar, onCancelar, pendente, rotuloBotao,
}: {
  dados: DadosAviso
  setDados: (d: DadosAviso) => void
  onSalvar: () => void
  onCancelar?: () => void
  pendente: boolean
  rotuloBotao: string
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <label className={`${rotulo} sm:col-span-2`}>
        Título *
        <input
          value={dados.titulo}
          onChange={(e) => setDados({ ...dados, titulo: e.target.value })}
          placeholder="Inscrições de 2026/2 abrem dia 10"
          className={campo}
        />
      </label>

      <label className={rotulo}>
        Tipo
        <select
          value={dados.tipo}
          onChange={(e) => setDados({ ...dados, tipo: e.target.value })}
          className={campo}
        >
          {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
      </label>

      <label className={rotulo}>
        Para quem
        <select
          value={dados.publico}
          onChange={(e) => setDados({ ...dados, publico: e.target.value })}
          className={campo}
        >
          {PUBLICOS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
        </select>
      </label>

      <label className={`${rotulo} sm:col-span-4`}>
        Mensagem *
        <textarea
          value={dados.mensagem}
          onChange={(e) => setDados({ ...dados, mensagem: e.target.value })}
          rows={3}
          className={campo}
        />
      </label>

      <label className={`${rotulo} sm:col-span-2`}>
        Começa a aparecer em
        <input
          type="datetime-local"
          value={dados.inicioEm}
          onChange={(e) => setDados({ ...dados, inicioEm: e.target.value })}
          className={campo}
        />
        <span className="mt-1 block text-[11px] text-subtle">vazio = imediatamente</span>
      </label>

      <label className={`${rotulo} sm:col-span-2`}>
        Some em
        <input
          type="datetime-local"
          value={dados.fimEm}
          onChange={(e) => setDados({ ...dados, fimEm: e.target.value })}
          className={campo}
        />
        <span className="mt-1 block text-[11px] text-subtle">
          vazio = fica até alguém remover
        </span>
      </label>

      <div className="flex items-center gap-3 sm:col-span-4">
        <button
          onClick={onSalvar}
          disabled={pendente || !dados.titulo.trim() || !dados.mensagem.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {pendente ? 'Salvando…' : rotuloBotao}
        </button>
        {onCancelar && (
          <button onClick={onCancelar} className="text-sm font-medium text-muted hover:text-ink">
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}

export default function GestorAvisos({ avisos }: { avisos: AvisoAdmin[] }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const [editando, setEditando] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState<DadosAviso>(VAZIO)
  const [novo, setNovo] = useState<DadosAviso>(VAZIO)

  function rodar(fn: () => Promise<Resposta>, aoDar?: () => void) {
    setErro(null)
    iniciar(async () => {
      const r = await fn()
      if (!r.ok) setErro(r.erro ?? 'nao foi possivel concluir')
      else { aoDar?.(); router.refresh() }
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
        {avisos.map((a) => (
          <li
            key={a.id}
            className={`rounded-lg border bg-surface p-4 ${
              a.vigente ? 'border-border' : 'border-dashed border-border-strong'
            }`}
          >
            {editando === a.id ? (
              <Formulario
                dados={rascunho}
                setDados={setRascunho}
                pendente={pendente}
                rotuloBotao="Salvar alterações"
                onCancelar={() => setEditando(null)}
                onSalvar={() =>
                  rodar(() => atualizarAviso(a.id, rascunho), () => setEditando(null))
                }
              />
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold text-ink">{a.titulo}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-muted">{a.mensagem}</p>
                  <p className="mt-2 text-xs text-subtle">
                    {TIPOS.find((t) => t.v === a.tipo)?.l} ·{' '}
                    {PUBLICOS.find((p) => p.v === a.publico)?.l} ·{' '}
                    {a.vigente ? 'no ar agora' : 'fora do ar'}
                    {a.fim_em && ` · some em ${new Date(a.fim_em).toLocaleString('pt-BR')}`}
                    {a.inicio_em && !a.vigente &&
                      ` · agendado para ${new Date(a.inicio_em).toLocaleString('pt-BR')}`}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setEditando(a.id)
                      setRascunho({
                        titulo: a.titulo, mensagem: a.mensagem, tipo: a.tipo,
                        publico: a.publico,
                        inicioEm: paraInput(a.inicio_em), fimEm: paraInput(a.fim_em),
                      })
                    }}
                    aria-label={`Editar aviso ${a.titulo}`}
                    className="text-muted hover:text-ink"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => rodar(() => excluirAviso(a.id))}
                    disabled={pendente}
                    aria-label={`Excluir aviso ${a.titulo}`}
                    className="text-muted hover:text-danger disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {avisos.length === 0 && (
        <p className="rounded-lg border border-dashed border-border-strong p-6 text-center text-sm text-muted">
          Nenhum aviso publicado.
        </p>
      )}

      <div className="mt-6 rounded-lg border border-dashed border-border-strong bg-surface p-5">
        <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-ink">
          <Megaphone className="h-4 w-4" />
          Novo aviso
        </h2>
        <Formulario
          dados={novo}
          setDados={setNovo}
          pendente={pendente}
          rotuloBotao="Publicar aviso"
          onSalvar={() => rodar(() => criarAviso(novo), () => setNovo(VAZIO))}
        />
      </div>
    </div>
  )
}

type Resposta = { ok: boolean; erro?: string }
