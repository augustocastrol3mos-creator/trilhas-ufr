import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SeloValidade } from '@/components/Certificado'

export const dynamic = 'force-dynamic'

const data = (d: string | null) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

export default async function ValidarPage({
  params,
}: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const supabase = await createClient()

  const { data: resultado } = await supabase.rpc('validar_certificado', {
    p_codigo: decodeURIComponent(codigo),
  })

  if (!resultado) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <h1 className="font-display text-xl font-semibold text-ink">Código não encontrado</h1>
          <p className="mt-2 text-sm text-muted">
            Nenhum certificado corresponde ao código <span className="font-mono">{decodeURIComponent(codigo)}</span>.
            Confira se foi digitado corretamente, atentando para hífens e letras maiúsculas.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
            Ir para a página inicial
          </Link>
        </div>
      </div>
    )
  }

  const c = resultado as any

  return (
    <div className="mx-auto max-w-lg">
      <SeloValidade valido={c.valido} />

      <div className="mt-4 rounded-lg border border-border bg-surface p-6">
        <dl className="space-y-4">
          <Linha rotulo="Titular" valor={c.nomeTitular} />
          <Linha rotulo="Curso" valor={c.cursoTitulo} />
          <Linha rotulo="Carga horária" valor={`${c.cargaHoraria} horas`} />
          <Linha
            rotulo="Modalidade"
            valor={c.modalidade === 'online' ? 'A distância' : 'Com avaliação presencial'}
          />
          <Linha rotulo="Período" valor={`${data(c.periodoInicio)} a ${data(c.periodoFim)}`} />
          {c.notaFinal != null && <Linha rotulo="Nota final" valor={String(c.notaFinal)} />}
          {c.registroProex && <Linha rotulo="Registro institucional" valor={c.registroProex} />}
          <Linha rotulo="Emitido em" valor={new Date(c.emitidoEm).toLocaleDateString('pt-BR')} />
          <Linha rotulo="Código" valor={c.codigo} mono />
        </dl>

        {!c.valido && (
          <p className="mt-6 rounded-md bg-danger-soft p-3 text-sm text-danger">
            Revogado em {new Date(c.revogadoEm).toLocaleDateString('pt-BR')}
            {c.revogadoMotivo ? `: ${c.revogadoMotivo}` : '.'}
          </p>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-subtle">
        Emitido por {c.instituicao}
      </p>
    </div>
  )
}

function Linha({ rotulo, valor, mono }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-6 border-b border-border pb-3 last:border-0 last:pb-0">
      <dt className="shrink-0 text-sm text-muted">{rotulo}</dt>
      <dd className={`text-right text-sm font-medium text-ink ${mono ? 'font-mono' : ''}`}>{valor}</dd>
    </div>
  )
}
