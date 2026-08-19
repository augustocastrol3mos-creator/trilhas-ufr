import Image from 'next/image'
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

/**
 * Fita institucional — três faixas nas cores oficiais da UFR.
 *
 * Substitui os traçados em zigue-zague anteriores. A diferença não é só
 * estética: aquilo era desenho arbitrário, sem relação com a identidade; isto
 * é a paleta oficial aplicada como elemento gráfico simples.
 *
 * É também o único lugar onde o verde institucional (#53B366) aparece — e ele
 * pode aparecer aqui justamente porque é decoração, não texto: seu contraste
 * de 2,6:1 sobre branco reprova para leitura, mas faixa colorida não precisa
 * ser lida.
 */
function Fita({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`flex ${className}`}>
      <span className="h-full flex-[3] bg-[#20376B]" />
      <span className="h-full flex-[2] bg-[#0D6AB0]" />
      <span className="h-full flex-1 bg-[#53B366]" />
    </div>
  )
}

function Cabecalho({ instituicao }: { instituicao: string }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex items-center gap-3.5">
        {/* PNG oficial, nunca recriado nem recolorido. O nome por extenso é
            texto separado, fora da área de proteção do logotipo. */}
        <Image src="/logo-ufr.png" alt="" width={70} height={40} className="h-10 w-auto" />
        <span className="border-l border-border pl-3.5 text-[10px] font-medium uppercase leading-[1.35] tracking-wide text-muted">
          {instituicao}
        </span>
      </div>

      <Image src="/logo-trilhas.png" alt="" width={95} height={21} className="h-[21px] w-auto opacity-90" />
    </div>
  )
}

export function CertificadoFrente({
  c, instituicao,
}: { c: CertificadoDados; instituicao: string }) {
  return (
    <div className="relative flex aspect-[297/210] w-full flex-col overflow-hidden bg-white">
      <Fita className="h-[10px] w-full shrink-0" />

      <div className="flex flex-1 flex-col px-[8%] py-[5%]">
        <Cabecalho instituicao={instituicao} />

        <div className="flex flex-1 flex-col justify-center py-[3%] text-center">
          <p className="font-display text-[26px] font-semibold uppercase tracking-[0.32em] text-[#20376B]">
            Certificado
          </p>

          <p className="mt-6 text-[13px] text-muted">Certificamos que</p>

          <p className="mt-2 font-display text-[34px] font-bold leading-tight text-ink">
            {c.nome_titular}
          </p>

          {/* Régua curta sob o nome: separa sem competir com a fita do topo. */}
          <span aria-hidden="true" className="mx-auto mt-3 h-px w-24 bg-[#0D6AB0]" />

          <p className="mx-auto mt-5 max-w-[78%] text-[13px] leading-[1.75] text-ink">
            concluiu o curso{' '}
            <span className="font-semibold">{c.curso_titulo}</span>, com carga horária
            de <span className="font-semibold">{c.carga_horaria} horas</span>
            {c.periodo_inicio && (
              <>
                , realizado entre {data(c.periodo_inicio)} e {data(c.periodo_fim)}
              </>
            )}
            {c.nota_final != null && <>, com aproveitamento final de {c.nota_final}</>}
            {c.modalidade === 'hibrido'
              ? ', incluindo avaliação presencial.'
              : ', na modalidade a distância.'}
          </p>
        </div>

        <div className="flex items-end justify-between gap-6">
          <p className="text-[9px] leading-relaxed text-subtle">
            {c.registro_proex && (
              <>
                Registro {c.registro_proex}
                <br />
              </>
            )}
            Código de validação{' '}
            <span className="font-mono font-semibold text-muted">{c.codigo}</span>
          </p>

          <div className="w-[240px] text-center">
            <span aria-hidden="true" className="block h-px w-full bg-ink" />
            <p className="mt-1.5 text-[12px] font-semibold text-ink">{c.assinante_nome}</p>
            <p className="text-[10px] text-muted">{c.assinante_cargo}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CertificadoVerso({
  c, qrDataUrl, urlValidacao,
}: { c: CertificadoDados; qrDataUrl: string | null; urlValidacao: string }) {
  return (
    <div className="relative flex aspect-[297/210] w-full flex-col overflow-hidden bg-white">
      <Fita className="h-[10px] w-full shrink-0" />

      <div className="flex flex-1 flex-col px-[8%] py-[5%]">
        <div className="flex items-baseline justify-between gap-6 border-b border-border pb-3">
          <h2 className="font-display text-[15px] font-semibold uppercase tracking-[0.18em] text-[#20376B]">
            Histórico do curso
          </h2>
          <p className="font-mono text-[10px] text-muted">{c.codigo}</p>
        </div>

        <dl className="mt-5 grid grid-cols-4 gap-x-6 gap-y-4">
          <Campo rotulo="Participante" valor={c.nome_titular} span={2} />
          <Campo rotulo="Carga horária" valor={`${c.carga_horaria} horas`} />
          <Campo
            rotulo="Modalidade"
            valor={c.modalidade === 'online' ? 'A distância' : 'Com avaliação presencial'}
          />
          <Campo rotulo="Curso" valor={c.curso_titulo} span={2} />
          <Campo
            rotulo="Período"
            valor={`${data(c.periodo_inicio)} a ${data(c.periodo_fim)}`}
          />
          <Campo
            rotulo="Aproveitamento"
            valor={c.nota_final != null ? String(c.nota_final) : '—'}
          />
        </dl>

        {c.conteudo.length > 0 && (
          <>
            <h3 className="mt-6 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Conteúdo programático
            </h3>
            <ol className="mt-2.5 grid grid-cols-2 gap-x-8 gap-y-1.5">
              {c.conteudo.map((titulo, i) => (
                <li key={i} className="flex gap-2 text-[11px] leading-snug text-ink">
                  <span className="font-mono text-[10px] text-[#0D6AB0]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {titulo}
                </li>
              ))}
            </ol>
          </>
        )}

        <div className="mt-auto flex items-center gap-5 rounded border border-border bg-canvas px-5 py-4">
          {qrDataUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={qrDataUrl}
              alt={`QR code de validação do certificado ${c.codigo}`}
              className="h-[74px] w-[74px] shrink-0"
            />
          )}
          <div className="text-[10px] leading-[1.7] text-muted">
            <p className="font-semibold text-ink">Como verificar este certificado</p>
            <p>
              Aponte a câmera para o QR code, ou informe o código{' '}
              <span className="font-mono font-semibold text-ink">{c.codigo}</span> em{' '}
              <span className="text-[#0D6AB0]">{urlValidacao}</span>
            </p>
            <p className="mt-0.5">
              A verificação é pública e não depende de contato com o portador. Emitido em{' '}
              {new Date(c.emitido_em).toLocaleDateString('pt-BR')}.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Campo({ rotulo, valor, span = 1 }: { rotulo: string; valor: string; span?: number }) {
  return (
    <div className={span === 2 ? 'col-span-2' : ''}>
      <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-subtle">
        {rotulo}
      </dt>
      <dd className="mt-0.5 text-[13px] font-medium leading-snug text-ink">{valor}</dd>
    </div>
  )
}

export function SeloValidade({ valido }: { valido: boolean }) {
  return valido ? (
    <div className="flex items-center gap-2 rounded-lg bg-success px-4 py-3 text-white">
      <CheckCircle2 className="h-5 w-5" />
      <span className="font-display font-semibold">Certificado válido</span>
    </div>
  ) : (
    <div className="rounded-lg bg-danger px-4 py-3 font-display font-semibold text-white">
      Certificado revogado
    </div>
  )
}
