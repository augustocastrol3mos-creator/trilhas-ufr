import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Download, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function DadosPage() {
  await exigirAdmin()
  const supabase = await createClient()

  // Só para confirmar que quem abriu é coordenação — a RPC recusa os demais.
  const { error } = await supabase.rpc('diagnostico_configuracao')
  if (error) notFound()

  const { count } = await supabase
    .from('certificado')
    .select('*', { count: 'exact', head: true })

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Coordenação
      </Link>

      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">
        Exportar dados
      </h1>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Arquivos em CSV, que abrem direto no Excel ou no Google Planilhas. Servem como
        registro da coordenação independente desta plataforma.
      </p>

      <div className="mt-5 flex gap-3 rounded-lg border border-primary-soft bg-primary-soft p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-ink">
          <strong>Baixe o livro de certificados periodicamente.</strong> Se esta
          plataforma sair do ar, for perdida ou substituída, este arquivo é a única prova
          de que os certificados existiram — e ele contém o código de cada um, que é o que
          permite conferi-los. Uma vez por semestre, ou sempre que uma turma for fechada,
          já resolve.
        </p>
      </div>

      <ul className="mt-6 space-y-3">
        <Exportacao
          tipo="certificados"
          titulo="Livro de certificados"
          descricao={`Todos os certificados emitidos${count ? ` (${count} hoje)` : ''}, com código, titular, RGA, curso, carga horária, notas, datas e o endereço público de validação de cada um.`}
        />
        <Exportacao
          tipo="matriculas"
          titulo="Matrículas"
          descricao="Quem está inscrito em quê, com nota, situação de presença e contagem de encontros. Útil para relatório de participação."
        />
        <Exportacao
          tipo="cursos"
          titulo="Cursos"
          descricao="Catálogo completo com autor, situação, número de turmas, matriculados e certificados emitidos por curso."
        />
      </ul>
    </div>
  )
}

function Exportacao({
  tipo, titulo, descricao,
}: { tipo: string; titulo: string; descricao: string }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-border bg-surface p-5">
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-base font-semibold text-ink">{titulo}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">{descricao}</p>
      </div>
      <a
        href={`/admin/exportar/${tipo}`}
        className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
      >
        <Download className="h-3.5 w-3.5" />
        Baixar CSV
      </a>
    </li>
  )
}
