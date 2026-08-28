'use client'

import { useState, useTransition } from 'react'
import { Globe, Link2, Lock } from 'lucide-react'
import { definirVisibilidade } from './acoes-visibilidade'

const OPCOES = [
  {
    valor: 'catalogo',
    Icon: Globe,
    titulo: 'No catálogo',
    texto: 'Aparece na vitrine. Qualquer pessoa encontra e se inscreve.',
  },
  {
    valor: 'link',
    Icon: Link2,
    titulo: 'Fora do catálogo, com link',
    texto:
      'Não aparece na vitrine, mas quem tiver o endereço se inscreve sozinho. Se o link for repassado, quem o receber também entra.',
  },
  {
    valor: 'convite',
    Icon: Lock,
    titulo: 'Apenas por convite',
    texto:
      'Não aparece e não tem autoinscrição. Só você coloca as pessoas dentro, pelo e-mail, na tela da turma. É o certo quando o certificado depende de algo que aconteceu fora da plataforma.',
  },
] as const

export default function VisibilidadeCurso({
  cursoId,
  atual,
}: {
  cursoId: string
  atual: string
}) {
  const [valor, setValor] = useState(atual)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, iniciar] = useTransition()

  function escolher(novo: string) {
    if (novo === valor) return
    const anterior = valor
    setValor(novo)
    setErro(null)
    iniciar(async () => {
      const r = await definirVisibilidade(cursoId, novo)
      if (!r.ok) {
        setValor(anterior)
        setErro(r.erro ?? 'Não consegui salvar.')
      }
    })
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="font-display text-base font-semibold text-ink">Quem pode encontrar</h2>
      <p className="mt-1 text-sm text-muted">
        Isto não substitui a publicação: mesmo fora do catálogo, o curso só emite certificado
        depois de autorizado pela coordenação.
      </p>

      <div className="mt-4 space-y-2">
        {OPCOES.map(({ valor: v, Icon, titulo, texto }) => (
          <button
            key={v}
            onClick={() => escolher(v)}
            disabled={ocupado}
            className={`flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors disabled:opacity-60 ${
              valor === v
                ? 'border-primary bg-primary-soft/40'
                : 'border-border hover:border-border-strong'
            }`}
          >
            <Icon
              className={`mt-0.5 h-4 w-4 shrink-0 ${valor === v ? 'text-primary' : 'text-muted'}`}
            />
            <span>
              <span className="block text-sm font-medium text-ink">{titulo}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">{texto}</span>
            </span>
          </button>
        ))}
      </div>

      {erro && (
        <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>
      )}
    </div>
  )
}
