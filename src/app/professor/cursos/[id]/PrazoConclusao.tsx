'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, Check } from 'lucide-react'
import { salvarPrazo } from './acoes-capa'

export default function PrazoConclusao({
  cursoId, prazo, matriculados,
}: { cursoId: string; prazo: number | null; matriculados: number }) {
  const router = useRouter()
  const [valor, setValor] = useState(prazo != null ? String(prazo) : '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [pendente, iniciar] = useTransition()

  const dias = Number(valor)

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
        Prazo para concluir
      </h2>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block text-sm font-medium text-ink">
          Dias após a inscrição
          <input
            type="number"
            min={1}
            max={3650}
            value={valor}
            onChange={(e) => { setValor(e.target.value); setSalvo(false) }}
            placeholder="sem prazo"
            className="mt-1 w-36 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
          />
        </label>

        <button
          onClick={() => {
            setErro(null)
            iniciar(async () => {
              const r = await salvarPrazo(cursoId, valor.trim() === '' ? null : dias)
              if (!r.ok) setErro(r.erro ?? 'nao foi possivel salvar')
              else { setSalvo(true); router.refresh() }
            })
          }}
          disabled={pendente || (valor.trim() !== '' && (!Number.isInteger(dias) || dias < 1))}
          className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-50"
        >
          {pendente ? 'Salvando…' : 'Salvar prazo'}
        </button>

        {salvo && !pendente && (
          <span className="flex items-center gap-1.5 text-sm text-success">
            <Check className="h-4 w-4" />
            Salvo
          </span>
        )}
      </div>

      {erro && (
        <p className="mt-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>
      )}

      <p className="mt-3 text-xs leading-relaxed text-subtle">
        {valor.trim() === '' ? (
          <>
            <strong className="text-ink">Sem prazo:</strong> o aluno pode concluir quando
            quiser, e a matrícula fica aberta indefinidamente.
          </>
        ) : (
          <>
            O aluno terá <strong className="text-ink">{dias || '—'} dias</strong> a partir
            da própria inscrição. Passado o prazo, ele não avança mais na trilha e precisa
            se inscrever de novo — o progresso é mantido e o relógio recomeça.
          </>
        )}
      </p>

      {matriculados > 0 && (
        <p className="mt-2 text-xs leading-relaxed text-subtle">
          Alterar aqui vale para <strong className="text-ink">quem se inscrever daqui em
          diante</strong>. Os {matriculados} alunos já matriculados mantêm o prazo que
          receberam ao entrar — mudar a regra debaixo de quem já começou seria injusto.
        </p>
      )}
    </div>
  )
}
