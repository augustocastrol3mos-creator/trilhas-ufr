'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, TriangleAlert } from 'lucide-react'
import { salvarConfiguracao, type DadosConfig } from './acoes'

const campo =
  'mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink'
const rotulo = 'block text-sm font-medium text-ink'
const ajuda = 'mt-1 text-xs leading-relaxed text-subtle'

export default function FormConfig({
  inicial, pendencias, certificadosEmitidos,
}: {
  inicial: DadosConfig
  pendencias: string[]
  certificadosEmitidos: number
}) {
  const router = useRouter()
  const [d, setD] = useState<DadosConfig>(inicial)
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [pendente, iniciar] = useTransition()

  function set<K extends keyof DadosConfig>(k: K, v: string) {
    setSalvo(false)
    setD({ ...d, [k]: v })
  }

  return (
    <div>
      {pendencias.length > 0 && (
        <div className="mb-6 rounded-lg border border-accent bg-accent-soft p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <TriangleAlert className="h-4 w-4 text-accent" aria-hidden="true" />
            Ajuste antes de emitir certificados de verdade
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {pendencias.map((p, i) => (
              <li key={i}>· {p}</li>
            ))}
          </ul>
        </div>
      )}

      {certificadosEmitidos > 0 && (
        <p className="mb-6 rounded-lg border border-border bg-surface p-4 text-sm leading-relaxed text-muted">
          Já existem <strong className="text-ink">{certificadosEmitidos} certificados
          emitidos</strong>. Eles guardam uma cópia dos dados do momento da emissão e{' '}
          <strong className="text-ink">não mudam</strong> quando esta tela é alterada —
          é o que garante que um documento entregue continue valendo o que dizia. O que
          você editar aqui vale para os próximos.
        </p>
      )}

      <div className="space-y-6">
        <Bloco titulo="Instituição">
          <label className={rotulo}>
            Nome por extenso
            <input value={d.instituicaoNome} onChange={(e) => set('instituicaoNome', e.target.value)} className={campo} />
          </label>
          <label className={rotulo}>
            Sigla
            <input value={d.instituicaoSigla} onChange={(e) => set('instituicaoSigla', e.target.value)} className={campo} />
          </label>
          <label className={rotulo}>
            Órgão emissor
            <input value={d.orgaoEmissor} onChange={(e) => set('orgaoEmissor', e.target.value)} className={campo} />
            <span className={ajuda}>
              Escreva exatamente como a instituição quer que apareça em documento oficial.
            </span>
          </label>
        </Bloco>

        <Bloco titulo="Quem assina o certificado">
          <label className={rotulo}>
            Nome
            <input value={d.assinanteNome} onChange={(e) => set('assinanteNome', e.target.value)} className={campo} />
          </label>
          <label className={rotulo}>
            Cargo
            <input value={d.assinanteCargo} onChange={(e) => set('assinanteCargo', e.target.value)} className={campo} />
          </label>
          <p className={ajuda}>
            Precisa ser atualizado sempre que a coordenação mudar. Certificados já
            emitidos continuam com o nome de quem assinou na época — corretamente.
          </p>
        </Bloco>

        <Bloco titulo="Endereço de validação">
          <label className={rotulo}>
            Endereço público da plataforma
            <input
              value={d.urlBase}
              onChange={(e) => set('urlBase', e.target.value)}
              placeholder="https://trilhas-ufr-chi.vercel.app"
              className={campo}
            />
            <span className={ajuda}>
              É o endereço que vai dentro do QR code de cada certificado. Se estiver
              errado, o QR de todo documento emitido daqui em diante não leva a lugar
              nenhum — e certificado emitido não se corrige, só se revoga e reemite.
            </span>
          </label>
        </Bloco>

        <Bloco titulo="Integração com o AC Fácil">
          <label className={rotulo}>
            Endereço do AC Fácil
            <input
              value={d.urlAcFacil}
              onChange={(e) => set('urlAcFacil', e.target.value)}
              placeholder="https://…"
              className={campo}
            />
            <span className={ajuda}>Em branco esconde o botão na tela de certificados.</span>
          </label>
          <label className={rotulo}>
            Texto do botão
            <input value={d.rotuloAcFacil} onChange={(e) => set('rotuloAcFacil', e.target.value)} className={campo} />
          </label>
        </Bloco>
      </div>

      {erro && (
        <p className="mt-6 rounded-md border border-danger-soft bg-danger-soft px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={() => {
            setErro(null)
            iniciar(async () => {
              const r = await salvarConfiguracao(d)
              if (!r.ok) setErro(r.erro ?? 'nao foi possivel salvar')
              else { setSalvo(true); router.refresh() }
            })
          }}
          disabled={pendente}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {pendente ? 'Salvando…' : 'Salvar configuração'}
        </button>

        {salvo && !pendente && (
          <span className="flex items-center gap-1.5 text-sm text-success">
            <Check className="h-4 w-4" />
            Salvo
          </span>
        )}
      </div>
    </div>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{titulo}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}
