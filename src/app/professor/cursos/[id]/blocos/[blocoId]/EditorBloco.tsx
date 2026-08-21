'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { salvarBloco, excluirBloco } from '@/app/professor/cursos/actions'
import type { TipoBloco } from '@/lib/blocos/schemas'
import EditorMaterial from './EditorMaterial'
import EditorMarkdown from '@/components/EditorMarkdown'

const campo = 'mt-1.5 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink'
const rotulo = 'block text-sm font-medium text-ink'

type Alternativa = { id: string; texto: string; correta: boolean }
type Questao = {
  id: string
  tipo: 'multipla_escolha' | 'verdadeiro_falso' | 'multipla_resposta'
  enunciado: string
  peso: number
  alternativas?: Alternativa[]
  resposta?: boolean
}

export default function EditorBloco({
  cursoId, bloco,
}: {
  cursoId: string
  bloco: { id: string; tipo: TipoBloco; titulo: string; config: any; obrigatorio: boolean; pontuavel: boolean }
}) {
  const router = useRouter()
  const [titulo, setTitulo] = useState(bloco.titulo)
  const [obrigatorio, setObrigatorio] = useState(bloco.obrigatorio)
  const [config, setConfig] = useState<any>(bloco.config ?? {})
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const set = (patch: any) => setConfig((c: any) => ({ ...c, ...patch }))

  function salvar() {
    setErro(null)
    setMsg(null)
    iniciar(async () => {
      const r = await salvarBloco(cursoId, bloco.id, {
        titulo,
        config,
        obrigatorio,
        pontuavel: bloco.tipo === 'quiz',
      })
      if (r.erro) setErro(r.erro)
      else {
        setMsg('Alterações salvas.')
        router.refresh()
      }
    })
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-lg border border-border bg-surface p-5">
        <label className={rotulo}>
          Título do bloco
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={campo} />
        </label>

        <label className="mt-4 flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={obrigatorio} onChange={(e) => setObrigatorio(e.target.checked)} />
          Obrigatório para concluir o módulo
        </label>
        <p className="mt-1 text-xs text-subtle">
          Blocos não obrigatórios são material de apoio: não travam a trilha.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5">
        {bloco.tipo === 'texto' && (
          <>
            <label className={rotulo}>Conteúdo da etapa</label>
            <div className="mt-1.5">
              <EditorMarkdown
                valor={config.markdown ?? ''}
                aoMudar={(v) => set({ markdown: v })}
              />
            </div>
            <p className="mt-2 text-xs text-subtle">
              O tempo mínimo de leitura é calculado a partir do tamanho do texto — o aluno
              não consegue marcar como concluído antes disso.
            </p>
          </>
        )}

        {bloco.tipo === 'video' && (
          <>
            <label className={rotulo}>
              Link do YouTube
              <input
                value={config.videoId ?? ''}
                onChange={(e) => set({ videoId: extrairId(e.target.value) })}
                placeholder="https://youtube.com/watch?v=..."
                className={campo}
              />
              <span className="mt-1 block text-xs text-subtle">
                O vídeo precisa estar como <strong>não listado</strong>. Vídeo privado não abre no player.
              </span>
            </label>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className={rotulo}>
                Duração (segundos)
                <input
                  type="number"
                  min={1}
                  value={config.duracaoSegundos ?? 600}
                  onChange={(e) => set({ duracaoSegundos: Number(e.target.value) })}
                  className={campo}
                />
              </label>
              <label className={rotulo}>
                Percentual mínimo assistido
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={config.percentualMinimo ?? 80}
                  onChange={(e) => set({ percentualMinimo: Number(e.target.value) })}
                  className={campo}
                />
              </label>
            </div>

            {config.videoId && (
              <div className="mt-4 aspect-video w-full overflow-hidden rounded-md bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${config.videoId}`}
                  className="h-full w-full"
                  allowFullScreen
                  title="Prévia do vídeo"
                />
              </div>
            )}
          </>
        )}

        {bloco.tipo === 'checkpoint' && (
          <>
            <label className={rotulo}>
              Texto da declaração
              <textarea
                value={config.texto ?? ''}
                onChange={(e) => set({ texto: e.target.value })}
                rows={4}
                className={campo}
              />
            </label>
            <label className={`mt-4 ${rotulo}`}>
              Texto do botão
              <input
                value={config.rotuloBotao ?? ''}
                onChange={(e) => set({ rotuloBotao: e.target.value })}
                maxLength={40}
                className={campo}
              />
            </label>
          </>
        )}

        {bloco.tipo === 'quiz' && <EditorQuiz config={config} set={set} />}

        {bloco.tipo === 'material' && (
          <EditorMaterial blocoId={bloco.id} config={config} set={set} />
        )}
      </div>

      {msg && <p className="rounded-md bg-primary-soft px-3 py-2 text-sm text-primary-dark">{msg}</p>}
      {erro && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>}

      <div className="flex items-center justify-between gap-4">
        <button
          onClick={salvar}
          disabled={pendente}
          className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {pendente ? 'Salvando...' : 'Salvar bloco'}
        </button>

        <button
          onClick={() =>
            iniciar(async () => {
              await excluirBloco(cursoId, bloco.id)
              router.push(`/professor/cursos/${cursoId}`)
              router.refresh()
            })
          }
          disabled={pendente}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-danger"
        >
          <Trash2 className="h-4 w-4" />
          Excluir bloco
        </button>
      </div>
    </div>
  )
}

function EditorQuiz({ config, set }: { config: any; set: (p: any) => void }) {
  const questoes: Questao[] = config.questoes ?? []

  function atualizarQuestao(i: number, patch: Partial<Questao>) {
    const novas = questoes.map((q, idx) => (idx === i ? { ...q, ...patch } : q))
    set({ questoes: novas })
  }

  function novaQuestao(base?: Questao) {
    const id = `q${Date.now().toString(36)}`
    const nova: Questao = base
      ? { ...structuredClone(base), id }
      : {
          id,
          tipo: 'multipla_escolha',
          enunciado: '',
          peso: 1,
          alternativas: [
            { id: 'a', texto: '', correta: true },
            { id: 'b', texto: '', correta: false },
          ],
        }
    set({ questoes: [...questoes, nova] })
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className={rotulo}>
          Nota mínima (%)
          <input
            type="number" min={0} max={100}
            value={config.notaMinima ?? 70}
            onChange={(e) => set({ notaMinima: Number(e.target.value) })}
            className={campo}
          />
        </label>
        <label className={rotulo}>
          Máximo de tentativas
          <input
            type="number" min={1} max={10}
            value={config.maxTentativas ?? 3}
            onChange={(e) => set({ maxTentativas: Number(e.target.value) })}
            className={campo}
          />
        </label>
        <label className={rotulo}>
          Mostrar gabarito
          <select
            value={config.mostrarGabarito ?? 'apos_aprovacao'}
            onChange={(e) => set({ mostrarGabarito: e.target.value })}
            className={campo}
          >
            <option value="nunca">Nunca</option>
            <option value="apos_tentativa">Após cada tentativa</option>
            <option value="apos_aprovacao">Após aprovação</option>
          </select>
        </label>
      </div>

      <ol className="mt-6 space-y-5">
        {questoes.map((q, i) => (
          <li key={q.id} className="rounded-lg border border-border bg-canvas p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="mt-2 text-sm font-medium text-muted">{i + 1}.</span>
              <textarea
                value={q.enunciado}
                onChange={(e) => atualizarQuestao(i, { enunciado: e.target.value })}
                placeholder="Enunciado da questão"
                rows={2}
                className="flex-1 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
              />
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => novaQuestao(q)}
                  title="Duplicar questão"
                  className="rounded p-1.5 text-subtle hover:bg-surface hover:text-ink"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  onClick={() => set({ questoes: questoes.filter((_, idx) => idx !== i) })}
                  title="Remover questão"
                  className="rounded p-1.5 text-subtle hover:bg-surface hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-3">
              <select
                value={q.tipo}
                onChange={(e) => {
                  const tipo = e.target.value as Questao['tipo']
                  atualizarQuestao(i, {
                    tipo,
                    alternativas:
                      tipo === 'verdadeiro_falso'
                        ? undefined
                        : q.alternativas ?? [
                            { id: 'a', texto: '', correta: true },
                            { id: 'b', texto: '', correta: false },
                          ],
                    resposta: tipo === 'verdadeiro_falso' ? (q.resposta ?? true) : undefined,
                  })
                }}
                className="rounded-md border border-border-strong bg-surface px-2 py-1 text-xs text-ink"
              >
                <option value="multipla_escolha">Múltipla escolha</option>
                <option value="verdadeiro_falso">Verdadeiro ou falso</option>
                <option value="multipla_resposta">Múltipla resposta</option>
              </select>

              <label className="flex items-center gap-1.5 text-xs text-muted">
                Peso
                <input
                  type="number" min={1}
                  value={q.peso ?? 1}
                  onChange={(e) => atualizarQuestao(i, { peso: Number(e.target.value) })}
                  className="w-14 rounded-md border border-border-strong bg-surface px-2 py-1 text-xs text-ink"
                />
              </label>
            </div>

            {q.tipo === 'verdadeiro_falso' ? (
              <div className="mt-3 flex gap-4">
                {[true, false].map((v) => (
                  <label key={String(v)} className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="radio"
                      checked={(q.resposta ?? true) === v}
                      onChange={() => atualizarQuestao(i, { resposta: v })}
                    />
                    {v ? 'Verdadeiro' : 'Falso'}
                  </label>
                ))}
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {(q.alternativas ?? []).map((a, ai) => (
                  <div key={a.id} className="flex items-center gap-2">
                    <input
                      type={q.tipo === 'multipla_escolha' ? 'radio' : 'checkbox'}
                      name={`correta-${q.id}`}
                      checked={a.correta}
                      onChange={(e) => {
                        const alts = (q.alternativas ?? []).map((alt, idx) => {
                          if (q.tipo === 'multipla_escolha') {
                            return { ...alt, correta: idx === ai }
                          }
                          return idx === ai ? { ...alt, correta: e.target.checked } : alt
                        })
                        atualizarQuestao(i, { alternativas: alts })
                      }}
                    />
                    <input
                      value={a.texto}
                      onChange={(e) => {
                        const alts = (q.alternativas ?? []).map((alt, idx) =>
                          idx === ai ? { ...alt, texto: e.target.value } : alt
                        )
                        atualizarQuestao(i, { alternativas: alts })
                      }}
                      placeholder={`Alternativa ${a.id.toUpperCase()}`}
                      className="flex-1 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm text-ink"
                    />
                    <button
                      onClick={() =>
                        atualizarQuestao(i, {
                          alternativas: (q.alternativas ?? []).filter((_, idx) => idx !== ai),
                        })
                      }
                      className="rounded p-1 text-subtle hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => {
                    const letras = 'abcdefgh'
                    const alts = q.alternativas ?? []
                    atualizarQuestao(i, {
                      alternativas: [...alts, { id: letras[alts.length] ?? `x${alts.length}`, texto: '', correta: false }],
                    })
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  + alternativa
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>

      <button
        onClick={() => novaQuestao()}
        className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-dashed border-border-strong px-3 py-2 text-sm text-muted hover:border-primary hover:text-primary"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar questão
      </button>

      <p className="mt-3 text-xs text-subtle">
        A correção acontece no servidor: o gabarito nunca é enviado ao navegador do aluno.
      </p>
    </>
  )
}

/** Aceita URL completa ou o ID cru; o professor não precisa saber o que é videoId. */
function extrairId(entrada: string): string {
  const v = entrada.trim()
  const padroes = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
  ]
  for (const p of padroes) {
    const m = v.match(p)
    if (m) return m[1]
  }
  return v
}
