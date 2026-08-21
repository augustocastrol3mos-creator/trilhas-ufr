import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import FormConfig from './FormConfig'

export const dynamic = 'force-dynamic'

export default async function ConfiguracaoPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('diagnostico_configuracao')
  if (error) notFound()

  const d = (data ?? {}) as any
  const c = d.config ?? {}

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Coordenação
      </Link>

      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">
        Configuração institucional
      </h1>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Os dados desta tela vão impressos em todos os certificados emitidos daqui em
        diante. Alterar aqui não exige nenhum conhecimento técnico e não depende de
        ninguém de fora da coordenação.
      </p>

      <div className="mt-6">
        <FormConfig
          inicial={{
            instituicaoNome: c.instituicao_nome ?? '',
            instituicaoSigla: c.instituicao_sigla ?? '',
            orgaoEmissor: c.orgao_emissor ?? '',
            assinanteNome: c.assinante_nome ?? '',
            assinanteCargo: c.assinante_cargo ?? '',
            urlBase: c.url_base ?? '',
            urlAcFacil: c.url_ac_facil ?? '',
            rotuloAcFacil: c.rotulo_ac_facil ?? '',
          }}
          pendencias={(d.pendencias ?? []) as string[]}
          certificadosEmitidos={d.certificadosEmitidos ?? 0}
        />
      </div>
    </div>
  )
}
