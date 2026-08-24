'use client'

import { useState } from 'react'
import { BadgeCheck, Copy, Check, ChevronDown } from 'lucide-react'

/**
 * Adicionar o certificado ao LinkedIn.
 *
 * O LinkedIn NÃO aceita upload de arquivo de credencial. Ele guarda cinco
 * campos — nome, organização emissora, data, ID e URL de verificação — e é a
 * URL que permite ao recrutador confirmar que o certificado é real. Todos os
 * cinco já existem aqui.
 *
 * A integração é uma URL montada, sem API, sem chave e sem conta de
 * desenvolvedor. Isso é decisão, não limitação: qualquer coisa que exigisse
 * credencial de aplicação viraria dependência para manter, e este projeto
 * precisa funcionar sem manutenção.
 *
 * O bloco de campos abaixo do botão existe porque o LinkedIn às vezes ignora
 * os parâmetros da URL, dependendo de como a pessoa está logada. Quando isso
 * acontece, ela copia e cola — e não fica sem saída.
 */
export default function CompartilharLinkedIn({
  cursoTitulo, codigo, emitidoEm, orgaoEmissor, urlValidacao,
}: {
  cursoTitulo: string
  codigo: string
  emitidoEm: string
  orgaoEmissor: string
  urlValidacao: string
}) {
  const [aberto, setAberto] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)

  const data = new Date(emitidoEm)

  const url =
    'https://www.linkedin.com/profile/add?' +
    new URLSearchParams({
      startTask: 'CERTIFICATION_NAME',
      name: cursoTitulo,
      organizationName: orgaoEmissor,
      issueYear: String(data.getFullYear()),
      issueMonth: String(data.getMonth() + 1),
      certUrl: urlValidacao,
      certId: codigo,
    }).toString()

  function copiar(valor: string, campo: string) {
    navigator.clipboard.writeText(valor)
    setCopiado(campo)
    setTimeout(() => setCopiado(null), 2000)
  }

  const campos = [
    { rotulo: 'Nome', valor: cursoTitulo },
    { rotulo: 'Organização emissora', valor: orgaoEmissor },
    { rotulo: 'Código da credencial', valor: codigo },
    { rotulo: 'URL da credencial', valor: urlValidacao },
  ]

  return (
    <div className="no-print">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-md border border-border-strong px-4 py-2.5 text-sm font-medium text-ink hover:border-primary hover:text-primary"
      >
        <BadgeCheck className="h-4 w-4" aria-hidden="true" />
        Adicionar ao LinkedIn
        <span className="sr-only">(abre em uma nova aba)</span>
      </a>

      <button
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="ml-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        preencher à mão
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${aberto ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {aberto && (
        <div className="mt-3 rounded-lg border border-border bg-canvas p-4">
          <p className="text-xs leading-relaxed text-muted">
            No LinkedIn: <strong className="text-ink">Adicionar seção → Licenças e
            certificados</strong>. Depois copie cada campo abaixo. A URL é o que permite a
            quem vir seu perfil conferir que o certificado é verdadeiro.
          </p>

          <dl className="mt-3 space-y-2">
            {campos.map((c) => (
              <div key={c.rotulo} className="flex items-start gap-2">
                <dt className="w-40 shrink-0 pt-1.5 text-xs text-muted">{c.rotulo}</dt>
                <dd className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="min-w-0 flex-1 truncate rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-ink">
                    {c.valor}
                  </span>
                  <button
                    onClick={() => copiar(c.valor, c.rotulo)}
                    aria-label={`Copiar ${c.rotulo}`}
                    className="shrink-0 rounded p-1.5 text-muted hover:bg-surface hover:text-ink"
                  >
                    {copiado === c.rotulo ? (
                      <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                </dd>
              </div>
            ))}

            <div className="flex items-start gap-2">
              <dt className="w-40 shrink-0 text-xs text-muted">Data de emissão</dt>
              <dd className="text-xs text-ink">
                {data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  )
}
