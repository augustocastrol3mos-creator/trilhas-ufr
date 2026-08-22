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
    <div className="flex h-full flex-col rounded-lg border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
        Prazo para concluir
      </h2>

      {/* Rótulo acima do campo, campo e botão na mesma linha. Antes o rótulo
          envolvia o input e o botão ia para outra linha por causa do
          flex-wrap — o cartão ficava com três alturas diferentes. */}
      <label htmlFor="prazo" className="mt-4 block text-sm font-medium text-ink">
        Dias após a inscrição
      </label>

      <div className="mt-1.5 flex items-center gap-2">
        <input
          id="prazo"
          type="number"
          min={1}
          max={3650}
          value={valor}
          onChange={(e) => { setValor(e.target.value); setSalvo(false) }}
          placeholder="sem prazo"
          className="w-32 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
        />

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
          {pendente ? 'Salvando…' : 'Salvar'}
        </button>

        {salvo && !pendente && (
          <span className="flex items-center gap-1.5 text-sm text-success">
            <Check className="h-4 w-4" aria-hidden="true" />
            Salvo
          </span>
        )}
      </div>

      {erro && (
        <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>
      )}

      {/* mt-auto empurra a ajuda para o rodapé do cartão, alinhando com o
          cartão vizinho independentemente do tamanho do texto. */}
      <p className="mt-auto pt-4 text-xs leading-relaxed text-subtle">
        {valor.trim() === '' ? (
          <>
            <strong className="text-ink">Sem prazo.</strong> O aluno conclui quando quiser
            e a matrícula fica aberta indefinidamente.
          </>
        ) : (
          <>
            <strong className="text-ink">{dias || '—'} dias</strong> a partir da inscrição
            de cada aluno. Passado o prazo, ele precisa se inscrever de novo — o progresso
            é mantido e o relógio recomeça.
          </>
        )}
        {matriculados > 0 && (
          <>
            {' '}Vale para quem se inscrever daqui em diante; os {matriculados} já
            matriculados mantêm o prazo que receberam ao entrar.
          </>
        )}
      </p>
    </div>
  )
}
