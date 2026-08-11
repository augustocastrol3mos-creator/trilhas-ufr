import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import PreviaAluno from './PreviaAluno'

export const dynamic = 'force-dynamic'

type Item = { nivel: 'erro' | 'aviso'; onde: string; mensagem: string; blocoId?: string }

export default async function RevisarPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: curso } = await supabase
    .from('curso')
    .select('id, titulo, status, modalidade, carga_horaria')
    .eq('id', id)
    .single()

  if (!curso) notFound()

  const { data: revisao, error } = await supabase.rpc('revisar_curso', { p_curso: id })

  const { data: modulos } = await supabase
    .from('modulo')
    .select('id, ordem, titulo, descricao, bloco(id, ordem, tipo, titulo, config, obrigatorio)')
    .eq('curso_id', id)
    .order('ordem')

  if (error) {
    return (
      <div className="rounded-lg border border-danger-soft bg-danger-soft/40 p-4 text-sm text-danger">
        {error.message}
      </div>
    )
  }

  const r = revisao as { erros: number; avisos: number; itens: Item[] }
  const lista = (modulos ?? []).map((m: any) => ({
    ...m,
    bloco: [...(m.bloco ?? [])].sort((a: any, b: any) => a.ordem - b.ordem),
  }))

  return (
    <div>
      <Link
        href={`/professor/cursos/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar ao editor
      </Link>

      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Revisar antes de publicar</h1>
      <p className="mt-1 text-sm text-muted">
        {curso.titulo} · aqui você confere o que o aluno vai ver e o que ainda está pendente.
      </p>

      {/* Diagnóstico */}
      <div className="mt-6">
        {r.erros === 0 && r.avisos === 0 ? (
          <div className="flex items-start gap-3 rounded-lg border border-primary bg-primary-soft p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary-dark" />
            <div>
              <p className="font-display font-semibold text-ink">Nada pendente</p>
              <p className="mt-1 text-sm text-muted">
                Nenhum problema encontrado. Role abaixo para conferir a prévia e volte ao editor
                para publicar.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {r.erros > 0 && (
              <p className="text-sm font-medium text-danger">
                {r.erros} {r.erros === 1 ? 'problema impede' : 'problemas impedem'} a publicação
              </p>
            )}
            {r.avisos > 0 && r.erros === 0 && (
              <p className="text-sm font-medium text-accent">
                {r.avisos} {r.avisos === 1 ? 'ponto de atenção' : 'pontos de atenção'} — não
                impedem publicar
              </p>
            )}

            <ul className="space-y-2">
              {r.itens.map((item, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-3 rounded-lg border p-4 ${
                    item.nivel === 'erro'
                      ? 'border-danger-soft bg-danger-soft/40'
                      : 'border-accent-soft bg-accent-soft'
                  }`}
                >
                  {item.nivel === 'erro' ? (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-ink">{item.mensagem}</p>
                    <p className="mt-0.5 text-xs text-subtle">{item.onde}</p>
                  </div>
                  {item.blocoId && (
                    <Link
                      href={`/professor/cursos/${id}/blocos/${item.blocoId}`}
                      className="shrink-0 text-sm font-medium text-primary hover:underline"
                    >
                      Corrigir
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Prévia */}
      <div className="mt-10 flex items-center gap-2 border-t border-border pt-8">
        <Eye className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-semibold text-ink">Como o aluno vê</h2>
      </div>
      <p className="mt-1 text-sm text-muted">
        Prévia navegável. Nada aqui grava progresso nem conta tentativa.
      </p>

      <PreviaAluno modulos={lista} />
    </div>
  )
}
