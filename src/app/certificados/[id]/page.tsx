import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { CertificadoFrente, CertificadoVerso, type CertificadoDados } from '@/components/Certificado'
import BotaoImprimir from './BotaoImprimir'
import { sessaoAtual } from '@/lib/auth'
import CompartilharLinkedIn from './CompartilharLinkedIn'

export const dynamic = 'force-dynamic'

export default async function CertificadoPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const user = await sessaoAtual()
  if (!user) notFound()

  // certificado e configuracao são independentes — juntas
  const [{ data: c }, { data: cfg }] = await Promise.all([
    supabase.from('certificado').select('*').eq('id', id).single(),
    supabase.from('configuracao').select('instituicao_nome, url_base, orgao_emissor').single(),
  ])

  if (!c) notFound()

  // Mesmo motivo da trilha: certificado_admin (e_admin()) soma por OR com
  // certificado_proprio. Sem esta checagem, admin abre o certificado alheio.
  const { data: minha } = await supabase
    .from('matricula')
    .select('id')
    .eq('id', c.matricula_id)
    .eq('usuario_id', user.id)
    .maybeSingle()

  if (!minha) notFound()

  const base = cfg?.url_base ?? 'http://localhost:3000'
  const urlValidacao = `${base}/validar/${c.codigo}`

  let qr: string | null = null
  try {
    qr = await QRCode.toDataURL(urlValidacao, { margin: 1, width: 200 })
  } catch {
    qr = null
  }

  const dados = c as unknown as CertificadoDados

  return (
    <div>
      <div className="no-print mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{c.curso_titulo}</h1>
          <p className="mt-1 text-sm text-muted">
            Código {c.codigo} · para salvar em PDF, use Imprimir e escolha &quot;Salvar como PDF&quot;
          </p>
        </div>
        <BotaoImprimir codigo={c.codigo} />
      </div>

      {/* Compartilhar só faz sentido para certificado válido: divulgar um
          revogado seria pedir para a pessoa se expor. */}
      {!c.revogado_em && (
        <div className="no-print mb-6">
          <CompartilharLinkedIn
            cursoTitulo={c.curso_titulo}
            codigo={c.codigo}
            emitidoEm={c.emitido_em}
            orgaoEmissor={cfg?.orgao_emissor ?? cfg?.instituicao_nome ?? 'Universidade Federal de Rondonópolis'}
            urlValidacao={urlValidacao}
          />
        </div>
      )}

      {c.revogado_em && (
        <div className="no-print mb-6 rounded-lg bg-danger-soft p-4 text-sm text-danger">
          Este certificado foi revogado{c.revogado_motivo ? `: ${c.revogado_motivo}` : '.'}
        </div>
      )}

      <div className="space-y-6">
        <div className="pagina overflow-hidden rounded-lg border border-border shadow-sm">
          <CertificadoFrente c={dados} instituicao={cfg?.instituicao_nome ?? 'A UFR'} />
        </div>
        <div className="pagina overflow-hidden rounded-lg border border-border shadow-sm">
          <CertificadoVerso c={dados} qrDataUrl={qr} urlValidacao={urlValidacao} />
        </div>
      </div>
    </div>
  )
}
