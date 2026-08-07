import { CheckCircle2 } from 'lucide-react'

export type CertificadoDados = {
  codigo: string
  nome_titular: string
  curso_titulo: string
  carga_horaria: number
  modalidade: 'hibrido' | 'online'
  periodo_inicio: string | null
  periodo_fim: string | null
  nota_final: number | null
  conteudo: string[]
  assinante_nome: string
  assinante_cargo: string
  registro_proex: string | null
  emitido_em: string
  revogado_em: string | null
}

const data = (d: string | null) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

/** Faixa geométrica lateral — identidade própria, derivada da paleta institucional. */
function Faixa({ lado }: { lado: 'esquerda' | 'direita' }) {
  return (
    <svg
      viewBox="0 0 120 800"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`absolute top-0 h-full w-[70px] ${lado === 'esquerda' ? 'left-0' : 'right-0 rotate-180'}`}
    >
      <path d="M10 0 v120 h60 v100 h-60 v120" fill="none" stroke="var(--color-primary)" strokeWidth="14" opacity="0.9" />
      <path d="M40 360 h50 v120 h-50 v140" fill="none" stroke="var(--color-primary)" strokeWidth="14" opacity="0.55" />
      <path d="M10 620 v80 h60 v100" fill="none" stroke="var(--color-primary)" strokeWidth="14" opacity="0.3" />
    </svg>
  )
}

export function CertificadoFrente({
  c, instituicao,
}: { c: CertificadoDados; instituicao: string }) {
  return (
    <div className="relative aspect-[297/210] w-full overflow-hidden bg-white">
      <Faixa lado="esquerda" />
      <Faixa lado="direita" />

      <div className="relative flex h-full flex-col justify-center px-[14%] py-[8%]">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-3xl font-bold tracking-tight text-primary">UFR</span>
          <span className="text-[11px] leading-tight text-muted">
            Universidade Federal
            <br />
            de Rondonópolis
          </span>
        </div>

        <p className="mt-[8%] text-sm italic text-muted">
          {instituicao} certifica que
        </p>

        <p className="mt-2 font-display text-2xl font-bold uppercase tracking-tight text-ink">
          {c.nome_titular}
        </p>

        <p className="mt-3 max-w-[85%] text-sm leading-relaxed text-ink">
          <span className="italic text-muted">concluiu o curso </span>
          <span className="font-semibold">{c.curso_titulo}</span>
          <span className="italic text-muted">
            , com carga horária de {c.carga_horaria} horas, no período de{' '}
            {data(c.periodo_inicio)} a {data(c.periodo_fim)}
            {c.nota_final != null ? `, com nota final ${c.nota_final}` : ''}.
          </span>
        </p>

        <div className="mt-auto flex items-end justify-between">
          <div className="w-56 border-t border-ink pt-2 text-center">
            <p className="text-sm font-semibold text-ink">{c.assinante_nome}</p>
            <p className="text-xs text-primary">{c.assinante_cargo}</p>
          </div>
          <p className="text-[10px] text-subtle">
            {c.registro_proex ? `Registro ${c.registro_proex} · ` : ''}
            {c.codigo}
          </p>
        </div>
      </div>
    </div>
  )
}

export function CertificadoVerso({
  c, qrDataUrl, urlValidacao,
}: { c: CertificadoDados; qrDataUrl: string | null; urlValidacao: string }) {
  return (
    <div className="relative aspect-[297/210] w-full overflow-hidden bg-white">
      <Faixa lado="direita" />

      <div className="relative flex h-full flex-col px-[8%] py-[6%]">
        <h2 className="font-display text-lg font-semibold text-primary">Histórico</h2>

        <div className="mt-4 grid grid-cols-3 gap-x-6 gap-y-4">
          <Campo rotulo="Nome" valor={c.nome_titular} span={2} />
          <Campo rotulo="Curso" valor={c.curso_titulo} />
          <Campo rotulo="Período" valor={`${data(c.periodo_inicio)} a ${data(c.periodo_fim)}`} />
          <Campo rotulo="Carga horária" valor={`${c.carga_horaria} horas`} />
          <Campo
            rotulo={c.modalidade === 'online' ? 'Modalidade' : 'Modalidade'}
            valor={c.modalidade === 'online' ? 'A distância' : 'Com avaliação presencial'}
          />
          {c.nota_final != null && <Campo rotulo="Nota final" valor={String(c.nota_final)} />}
        </div>

        <h2 className="mt-6 font-display text-lg font-semibold text-primary">Conteúdo</h2>
        <ol className="mt-2 space-y-0.5">
          {c.conteudo.map((titulo, i) => (
            <li key={i} className="border-l-2 border-border pl-3 text-[11px] italic text-muted">
              Módulo {i + 1}: {titulo}
            </li>
          ))}
        </ol>

        <div className="mt-auto flex items-start gap-4 border-t border-border pt-4">
          {qrDataUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={qrDataUrl} alt={`QR code para validar o certificado ${c.codigo}`} className="h-20 w-20" />
          )}
          <div className="text-[10px] leading-relaxed text-muted">
            <p>
              Certificado registrado sob o código{' '}
              <span className="rounded bg-accent-soft px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink">
                {c.codigo}
              </span>
            </p>
            <p>Emitido em {new Date(c.emitido_em).toLocaleDateString('pt-BR')}.</p>
            <p>
              A validade pode ser comprovada pelo QR code ao lado ou informando o código em{' '}
              {urlValidacao}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Campo({ rotulo, valor, span = 1 }: { rotulo: string; valor: string; span?: number }) {
  return (
    <div className={`border-l-2 border-primary pl-3 ${span === 2 ? 'col-span-2' : ''}`}>
      <p className="text-[10px] italic text-muted">{rotulo}</p>
      <p className="text-sm font-semibold text-ink">{valor}</p>
    </div>
  )
}

export function SeloValidade({ valido }: { valido: boolean }) {
  return valido ? (
    <div className="flex items-center gap-2 rounded-lg bg-primary px-4 py-3 text-white">
      <CheckCircle2 className="h-5 w-5" />
      <span className="font-display font-semibold">Certificado válido</span>
    </div>
  ) : (
    <div className="rounded-lg bg-danger px-4 py-3 font-display font-semibold text-white">
      Certificado revogado
    </div>
  )
}
