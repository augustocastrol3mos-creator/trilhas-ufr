'use client'

import { useState } from 'react'
import { Monitor, Users } from 'lucide-react'

const campo = 'mt-1.5 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink'
const rotulo = 'block text-sm font-medium text-ink'

export default function FormNovoCurso({
  acao,
  categorias,
}: {
  acao: (formData: FormData) => void
  categorias: { id: string; nome: string }[]
}) {
  const [modalidade, setModalidade] = useState<'hibrido' | 'online'>('hibrido')

  return (
    <form action={acao} className="mt-6 space-y-6">
      <input type="hidden" name="modalidade" value={modalidade} />

      <div className="grid gap-3 sm:grid-cols-2">
        {([
          { valor: 'hibrido', Icon: Users, titulo: 'Híbrido', desc: 'Trilha online + encontro presencial de avaliação. Você decide quem passa.' },
          { valor: 'online', Icon: Monitor, titulo: '100% online', desc: 'Curso permanente, autoinstrucional. Certificado emitido automaticamente.' },
        ] as const).map(({ valor, Icon, titulo, desc }) => (
          <button
            key={valor}
            type="button"
            onClick={() => setModalidade(valor)}
            className={`rounded-lg border p-4 text-left transition-colors ${
              modalidade === valor ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:border-border-strong'
            }`}
          >
            <Icon className={`h-5 w-5 ${modalidade === valor ? 'text-primary' : 'text-subtle'}`} />
            <p className="mt-2 font-display font-semibold text-ink">{titulo}</p>
            <p className="mt-1 text-xs text-muted">{desc}</p>
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-surface p-5 space-y-5">
        <label className={rotulo}>
          Categoria
          <select name="categoriaId" required className={campo} defaultValue="">
            <option value="" disabled>Selecione…</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </label>

        <label className={rotulo}>
          Título
          <input name="titulo" required maxLength={120} className={campo} />
        </label>

        <label className={rotulo}>
          Descrição
          <textarea name="descricao" rows={3} className={campo} />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className={rotulo}>
            Carga horária (horas)
            <input name="cargaHoraria" type="number" min={1} defaultValue={20} className={campo} />
          </label>
          <label className={rotulo}>
            Nota mínima para aprovação
            <input name="notaMinima" type="number" min={0} max={100} defaultValue={60} className={campo} />
          </label>
        </div>

        {modalidade === 'hibrido' && (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className={rotulo}>
                Identificador da turma
                <input name="turma" placeholder="2026/2" className={campo} />
              </label>
              <label className={rotulo}>
                Peso da parte online (%)
                <input name="pesoOnline" type="number" min={0} max={100} defaultValue={60} className={campo} />
                <span className="mt-1 block text-xs text-subtle">O restante é peso do encontro presencial.</span>
              </label>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className={rotulo}>
                Data do encontro
                <input name="encontroData" type="date" required className={campo} />
              </label>
              <label className={rotulo}>
                Local do encontro
                <input name="encontroLocal" placeholder="UFR — Bloco A, sala 12" className={campo} />
              </label>
            </div>
          </>
        )}
      </div>

      <button className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark">
        Criar curso
      </button>
      <p className="text-xs text-subtle">
        O curso nasce como rascunho. Você adiciona os módulos e publica depois.
      </p>
    </form>
  )
}
