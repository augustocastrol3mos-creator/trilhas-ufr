'use client'

import { useState, useTransition } from 'react'
import { UserPlus, Check, TriangleAlert } from 'lucide-react'
import { matricularPorEmail, type Resultado } from './acoes-convite'

export default function ConvidarAlunos({ turmaId }: { turmaId: string }) {
  const [texto, setTexto] = useState('')
  const [res, setRes] = useState<Resultado | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, iniciar] = useTransition()

  // Aceita vírgula, ponto e vírgula, espaço e quebra de linha. Quem cola uma
  // lista vinda de planilha ou de e-mail não deveria precisar reformatá-la.
  const emails = texto
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  function enviar() {
    setErro(null)
    setRes(null)
    iniciar(async () => {
      const r = await matricularPorEmail(turmaId, emails)
      if (!r.ok) setErro(r.erro ?? 'Não consegui matricular.')
      else {
        setRes(r.resultado ?? null)
        setTexto('')
      }
    })
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-ink">
        <UserPlus className="h-4 w-4 text-primary" />
        Colocar alunos na turma
      </h2>
      <p className="mt-1.5 text-sm text-muted">
        Cole os e-mails, separados por vírgula, espaço ou um por linha. A pessoa precisa já
        ter conta na plataforma — o nome que sai no certificado é o que ela mesma cadastrou.
      </p>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={4}
        placeholder={'fulano@ufr.br\nbeltrana@ufr.br'}
        className="mt-4 w-full rounded-md border border-border-strong bg-surface px-3 py-2 font-mono text-sm text-ink placeholder:text-subtle focus:border-primary"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={enviar}
          disabled={ocupado || emails.length === 0}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {ocupado ? 'Matriculando...' : `Matricular ${emails.length || ''}`.trim()}
        </button>
        {emails.length > 0 && (
          <span className="text-xs text-subtle">
            {emails.length} {emails.length === 1 ? 'endereço' : 'endereços'} reconhecidos
          </span>
        )}
      </div>

      {erro && (
        <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>
      )}

      {/* O resultado vem por endereço, não como "deu certo" ou "deu errado".
          Matricular 9 de 12 e dizer quais 3 faltaram é muito mais útil que
          recusar as 12 porque um e-mail estava errado. */}
      {res && (
        <div className="mt-4 space-y-2">
          {res.matriculados.length > 0 && (
            <p className="flex items-start gap-2 rounded-md bg-success-soft px-3 py-2 text-sm text-success">
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {res.matriculados.length}{' '}
                {res.matriculados.length === 1 ? 'matriculado' : 'matriculados'}:{' '}
                {res.matriculados.join(', ')}
              </span>
            </p>
          )}
          {res.ja_estavam.length > 0 && (
            <p className="rounded-md border border-border bg-canvas px-3 py-2 text-sm text-muted">
              Já estavam na turma: {res.ja_estavam.join(', ')}
            </p>
          )}
          {res.sem_conta.length > 0 && (
            <p className="flex items-start gap-2 rounded-md bg-accent-soft px-3 py-2 text-sm text-accent">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Sem conta na plataforma: {res.sem_conta.join(', ')}. Peça para essas pessoas
                se cadastrarem e matricule de novo.
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
