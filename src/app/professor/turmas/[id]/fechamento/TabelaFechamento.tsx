'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCheck } from 'lucide-react'
import { fecharTurma, type Decisao } from '@/app/professor/actions'

export type AlunoFechamento = {
  matriculaId: string
  nome: string
  email: string
  percentualTrilha: number
  trilhaCompleta: boolean
  notaOnline: number | null
  presenca: boolean
  notaPresencial: number | null
}

type Linha = {
  presenca: boolean
  notaPresencial: string
  decisao: 'aprovado' | 'reprovado' | null
  justificativa: string
}

export default function TabelaFechamento({
  turmaId, alunos, pesoOnline, pesoPresencial, notaMinima, exigePresenca,
}: {
  turmaId: string
  alunos: AlunoFechamento[]
  pesoOnline: number
  pesoPresencial: number
  notaMinima: number
  exigePresenca: boolean
}) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [pendente, iniciar] = useTransition()

  const [linhas, setLinhas] = useState<Record<string, Linha>>(() =>
    Object.fromEntries(
      alunos.map((a) => [
        a.matriculaId,
        {
          presenca: a.presenca,
          notaPresencial: a.notaPresencial != null ? String(a.notaPresencial) : '',
          decisao: null,
          justificativa: '',
        },
      ])
    )
  )

  function atualizar(id: string, patch: Partial<Linha>) {
    setLinhas((l) => ({ ...l, [id]: { ...l[id], ...patch } }))
  }

  const calculado = useMemo(() => {
    return alunos.map((a) => {
      const l = linhas[a.matriculaId]
      const online = a.notaOnline ?? 0
      const presencial = l.notaPresencial === '' ? 0 : Number(l.notaPresencial)
      const final = Math.round(((online * pesoOnline + presencial * pesoPresencial) / 100) * 100) / 100

      const sugerida: 'aprovado' | 'reprovado' =
        final >= notaMinima && (!exigePresenca || l.presenca) && a.trilhaCompleta
          ? 'aprovado'
          : 'reprovado'

      const decisao = l.decisao ?? sugerida
      const divergente = decisao !== sugerida

      return { aluno: a, linha: l, final, sugerida, decisao, divergente }
    })
  }, [alunos, linhas, pesoOnline, pesoPresencial, notaMinima, exigePresenca])

  const aprovados = calculado.filter((c) => c.decisao === 'aprovado').length
  const reprovados = calculado.length - aprovados
  const faltaJustificar = calculado.filter(
    (c) => c.divergente && c.linha.justificativa.trim().length < 20
  )

  function marcarTodosPresentes() {
    setLinhas((l) =>
      Object.fromEntries(Object.entries(l).map(([k, v]) => [k, { ...v, presenca: true }]))
    )
  }

  function enviar() {
    setErro(null)
    const decisoes: Decisao[] = calculado.map((c) => ({
      matriculaId: c.aluno.matriculaId,
      presenca: c.linha.presenca,
      notaPresencial: c.linha.notaPresencial,
      decisao: c.decisao,
      justificativa: c.linha.justificativa,
    }))

    iniciar(async () => {
      const r = await fecharTurma(turmaId, decisoes)
      if (r.erro) {
        setErro(r.erro)
        setConfirmando(false)
      } else {
        router.push(`/professor/turmas/${turmaId}`)
        router.refresh()
      }
    })
  }

  return (
    <div className="mt-6">
      <button
        onClick={marcarTodosPresentes}
        className="mb-3 inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm text-ink hover:border-primary"
      >
        <CheckCheck className="h-3.5 w-3.5" />
        Marcar todos presentes
      </button>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Aluno</th>
              <th className="px-3 py-3 font-medium">Trilha</th>
              <th className="px-3 py-3 font-medium">Online</th>
              <th className="px-3 py-3 font-medium">Presença</th>
              <th className="px-3 py-3 font-medium">Presencial</th>
              <th className="px-3 py-3 font-medium">Final</th>
              <th className="px-3 py-3 font-medium">Decisão</th>
            </tr>
          </thead>
          <tbody>
            {calculado.map((c) => (
              <tr
                key={c.aluno.matriculaId}
                className={`border-b border-border last:border-0 ${c.divergente ? 'bg-accent-soft/50' : ''}`}
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{c.aluno.nome || '(sem nome)'}</p>
                  <p className="text-xs text-subtle">{c.aluno.email}</p>
                  {c.divergente && (
                    <input
                      value={c.linha.justificativa}
                      onChange={(e) =>
                        atualizar(c.aluno.matriculaId, { justificativa: e.target.value })
                      }
                      placeholder="Justificativa (mínimo 20 caracteres)"
                      className="mt-2 w-64 rounded-md border border-accent bg-surface px-2 py-1 text-xs text-ink"
                    />
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-muted">{c.aluno.percentualTrilha}%</td>
                <td className="px-3 py-3 text-ink">{c.aluno.notaOnline ?? '—'}</td>
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={c.linha.presenca}
                    onChange={(e) => atualizar(c.aluno.matriculaId, { presenca: e.target.checked })}
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={c.linha.notaPresencial}
                    onChange={(e) =>
                      atualizar(c.aluno.matriculaId, { notaPresencial: e.target.value })
                    }
                    className="w-16 rounded-md border border-border-strong bg-surface px-2 py-1 text-sm text-ink"
                  />
                </td>
                <td className="px-3 py-3 font-medium text-ink">{c.final}</td>
                <td className="px-3 py-3">
                  <select
                    value={c.decisao}
                    onChange={(e) =>
                      atualizar(c.aluno.matriculaId, {
                        decisao: e.target.value as 'aprovado' | 'reprovado',
                      })
                    }
                    className={`rounded-md border px-2 py-1 text-sm ${
                      c.decisao === 'aprovado'
                        ? 'border-primary text-primary-dark'
                        : 'border-danger text-danger'
                    }`}
                  >
                    <option value="aprovado">Aprovado</option>
                    <option value="reprovado">Reprovado</option>
                  </select>
                  {c.divergente && (
                    <p className="mt-1 text-[11px] text-accent">sugerido: {c.sugerida}</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {faltaJustificar.length > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-accent-soft bg-accent-soft p-3 text-sm text-ink">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p>
            {faltaJustificar.length}{' '}
            {faltaJustificar.length === 1 ? 'decisão diverge' : 'decisões divergem'} da sugestão do
            sistema e ainda {faltaJustificar.length === 1 ? 'precisa' : 'precisam'} de justificativa.
          </p>
        </div>
      )}

      {erro && (
        <p className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>
      )}

      <div className="mt-6 rounded-lg border border-border bg-surface p-5">
        {confirmando ? (
          <>
            <p className="font-display font-semibold text-ink">Confirmar fechamento</p>
            <p className="mt-1 text-sm text-muted">
              Serão emitidos <span className="font-medium text-ink">{aprovados}</span>{' '}
              {aprovados === 1 ? 'certificado' : 'certificados'} e registrados{' '}
              <span className="font-medium text-ink">{reprovados}</span>{' '}
              {reprovados === 1 ? 'reprovado' : 'reprovados'}. As notas ficam congeladas e a turma
              é encerrada.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={enviar}
                disabled={pendente}
                className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {pendente ? 'Fechando...' : 'Confirmar e emitir'}
              </button>
              <button
                onClick={() => setConfirmando(false)}
                disabled={pendente}
                className="rounded-md border border-border-strong px-4 py-2.5 text-sm text-ink"
              >
                Voltar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">
              {aprovados} {aprovados === 1 ? 'aprovado' : 'aprovados'} · {reprovados}{' '}
              {reprovados === 1 ? 'reprovado' : 'reprovados'}
            </p>
            <button
              onClick={() => setConfirmando(true)}
              disabled={faltaJustificar.length > 0}
              className="mt-3 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-40"
            >
              Fechar turma
            </button>
          </>
        )}
      </div>
    </div>
  )
}
