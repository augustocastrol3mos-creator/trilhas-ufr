'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, CircleAlert } from 'lucide-react'
import { responder, concluir } from './acoes'

export type Item = {
  id: string
  ordem: number
  enunciado: string
  valor: number | null
}

const ESCALA = [
  { valor: 1, rotulo: 'Nunca' },
  { valor: 2, rotulo: 'Raramente' },
  { valor: 3, rotulo: 'Às vezes' },
  { valor: 4, rotulo: 'Frequentemente' },
  { valor: 5, rotulo: 'Sempre' },
]

export default function Questionario({
  itens: itensIniciais,
  respostaId: respostaInicial,
}: {
  itens: Item[]
  respostaId: string | null
}) {
  const router = useRouter()
  const [itens, setItens] = useState(itensIniciais)
  const [respostaId, setRespostaId] = useState(respostaInicial)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciarSalvar] = useTransition()
  const [enviando, iniciarEnvio] = useTransition()

  // Retoma na primeira frase sem resposta. Quem parou na 30 volta na 30, não na
  // 1 — e quem já respondeu tudo cai na última, para revisar antes de enviar.
  const primeiroVazio = itensIniciais.findIndex((i) => i.valor === null)
  const [atual, setAtual] = useState(primeiroVazio === -1 ? itensIniciais.length - 1 : primeiroVazio)

  const respondidos = useMemo(() => itens.filter((i) => i.valor !== null).length, [itens])
  const total = itens.length
  const completo = respondidos === total
  const item = itens[atual]

  function marcar(valor: number) {
    setErro(null)

    // Otimista: a bolinha acende antes de o servidor confirmar. Se falhar,
    // desfaz e avisa — travar a tela a cada clique tornaria 50 questões
    // insuportáveis numa conexão ruim.
    const anterior = item.valor
    setItens((lista) => lista.map((i) => (i.id === item.id ? { ...i, valor } : i)))

    iniciarSalvar(async () => {
      const r = await responder(item.id, valor, respostaId ?? undefined)
      if (!r.ok) {
        setItens((lista) => lista.map((i) => (i.id === item.id ? { ...i, valor: anterior } : i)))
        setErro(r.erro ?? 'Não consegui salvar essa resposta. Tente de novo.')
        return
      }
      if (r.respostaId) setRespostaId(r.respostaId)
      // Avança sozinho, mas só se ainda houver frase à frente. Na última, fica
      // parado para a pessoa ver o botão de enviar.
      if (atual < total - 1) setAtual((n) => n + 1)
    })
  }

  function enviar() {
    if (!respostaId) return
    setErro(null)
    iniciarEnvio(async () => {
      const r = await concluir(respostaId)
      if (!r.ok) {
        setErro(r.erro ?? 'Não consegui concluir.')
        return
      }
      router.push('/questionario/resultado')
    })
  }

  const pct = Math.round((respondidos / total) * 100)

  return (
    <div className="mx-auto max-w-xl">
      {/* Progresso. `respondidos`, não `atual`: o que importa é quanto falta
          responder, não onde a pessoa está navegando. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {respondidos} de {total} respondidas
        </p>
        <p className="text-sm text-subtle">{pct}%</p>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-subtle">
          Frase {atual + 1} de {total}
        </p>
        <p className="mt-3 font-display text-lg leading-snug text-ink">{item.enunciado}</p>

        <div className="mt-6 space-y-2">
          {ESCALA.map((e) => {
            const escolhido = item.valor === e.valor
            return (
              <button
                key={e.valor}
                onClick={() => marcar(e.valor)}
                disabled={salvando}
                className={`flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-60 ${
                  escolhido
                    ? 'border-primary bg-primary-soft text-primary-dark'
                    : 'border-border bg-canvas text-ink hover:border-border-strong'
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-medium ${
                    escolhido ? 'border-primary bg-primary text-white' : 'border-border-strong text-subtle'
                  }`}
                >
                  {escolhido ? <Check className="h-3 w-3" /> : e.valor}
                </span>
                {e.rotulo}
              </button>
            )
          })}
        </div>

        {erro && (
          <p className="mt-4 flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{erro}</span>
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => setAtual((n) => Math.max(0, n - 1))}
          disabled={atual === 0}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-ink hover:border-border-strong disabled:opacity-40"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Anterior
        </button>

        <button
          onClick={() => setAtual((n) => Math.min(total - 1, n + 1))}
          disabled={atual === total - 1}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-ink hover:border-border-strong disabled:opacity-40"
        >
          Próxima
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* O botão de enviar só aparece quando não falta nenhuma. Antes disso,
          a tela diz QUANTAS faltam e leva até a primeira — mensagem de erro
          depois do clique seria pior. */}
      <div className="mt-6 rounded-lg border border-border bg-surface p-5">
        {completo ? (
          <>
            <p className="text-sm text-ink">Todas respondidas. Você ainda pode voltar e revisar.</p>
            <button
              onClick={enviar}
              disabled={enviando}
              className="mt-4 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {enviando ? 'Enviando...' : 'Concluir e ver meu resultado'}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">
              Faltam {total - respondidos} de {total}. Suas respostas ficam salvas — dá para
              parar agora e continuar depois.
            </p>
            <button
              onClick={() => {
                const i = itens.findIndex((x) => x.valor === null)
                if (i !== -1) setAtual(i)
              }}
              className="mt-3 text-sm text-primary underline underline-offset-2"
            >
              Ir para a próxima sem resposta
            </button>
          </>
        )}
      </div>
    </div>
  )
}
