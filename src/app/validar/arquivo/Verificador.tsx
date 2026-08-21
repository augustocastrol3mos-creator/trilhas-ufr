'use client'

import { useState, useTransition, useRef } from 'react'
import { CheckCircle2, FileJson, TriangleAlert, Upload, XCircle } from 'lucide-react'
import { verificarArquivo } from './acoes'
import type { Resultado } from '@/lib/credencial'

export default function Verificador() {
  const [r, setR] = useState<Resultado | null>(null)
  const [nome, setNome] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const input = useRef<HTMLInputElement>(null)

  function ler(arquivo: File) {
    setR(null)
    setNome(arquivo.name)
    const leitor = new FileReader()
    leitor.onload = () => {
      const texto = String(leitor.result ?? '')
      iniciar(async () => setR(await verificarArquivo(texto)))
    }
    leitor.readAsText(arquivo)
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) ler(f)
          e.target.value = ''
        }}
      />

      <button
        onClick={() => input.current?.click()}
        disabled={pendente}
        className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border-strong bg-surface px-6 py-10 hover:border-primary disabled:opacity-50"
      >
        <Upload className="h-6 w-6 text-primary" aria-hidden="true" />
        <span className="font-medium text-ink">
          {pendente ? 'Verificando…' : 'Escolher o arquivo da credencial'}
        </span>
        <span className="text-sm text-muted">
          {nome ?? 'um arquivo .json baixado da página de validação'}
        </span>
      </button>

      {r && (
        <div
          className={`mt-6 rounded-lg border p-5 ${
            r.assinaturaValida
              ? 'border-success bg-success-soft'
              : 'border-danger bg-danger-soft'
          }`}
        >
          <p className="flex items-start gap-2.5 font-display text-base font-semibold text-ink">
            {r.assinaturaValida ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
            )}
            {r.assinaturaValida ? 'Assinatura confere' : 'Não foi possível confirmar'}
          </p>
          <p className="mt-1.5 pl-[30px] text-sm leading-relaxed text-muted">{r.motivo}</p>

          {r.assinaturaValida && (
            <>
              <dl className="mt-4 space-y-2 border-t border-white/40 pt-4 text-sm">
                <Linha rotulo="Titular" valor={r.emitidoPara} />
                <Linha rotulo="Curso" valor={r.curso} />
                <Linha rotulo="Código" valor={r.codigo} />
                <Linha rotulo="Emissor" valor={r.emissor} />
              </dl>

              {r.revogado ? (
                <p className="mt-4 flex items-start gap-2 rounded-md bg-surface p-3 text-sm text-danger">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  Esta credencial foi emitida já marcada como revogada.
                </p>
              ) : (
                <p className="mt-4 rounded-md bg-surface p-3 text-sm leading-relaxed text-muted">
                  A assinatura prova que o arquivo é autêntico e não foi alterado. Ela{' '}
                  <strong className="text-ink">não prova</strong> que o certificado
                  continua válido hoje — revogação é um fato posterior. Para isso, consulte
                  o código acima na busca por código.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Linha({ rotulo, valor }: { rotulo: string; valor?: string }) {
  if (!valor) return null
  return (
    <div className="flex flex-wrap gap-x-3">
      <dt className="w-24 shrink-0 text-muted">{rotulo}</dt>
      <dd className="min-w-0 flex-1 break-words font-medium text-ink">{valor}</dd>
    </div>
  )
}
