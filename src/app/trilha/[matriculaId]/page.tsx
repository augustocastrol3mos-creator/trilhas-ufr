import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CalendarClock, Check, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { ModuloTrilha } from '@/lib/blocos/schemas'

export const dynamic = 'force-dynamic'

export default async function TrilhaPage({
  params,
}: { params: Promise<{ matriculaId: string }> }) {
  const { matriculaId } = await params
  const supabase = await createClient()

  const { data: matricula } = await supabase
    .from('matricula')
    .select('id, status, turma(identificador, encontro_data, encontro_local, curso(titulo, modalidade))')
    .eq('id', matriculaId)
    .single()

  if (!matricula) notFound()

  const { data, error } = await supabase.rpc('modulos_trilha', { p_matricula: matriculaId })
  if (error) {
    return (
      <div className="rounded-lg border border-danger-soft bg-danger-soft/40 p-4 text-sm text-danger">
        {error.message}
      </div>
    )
  }

  const modulos = (data ?? []) as ModuloTrilha[]
  const curso = (matricula as any).turma?.curso
  const turma = (matricula as any).turma

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">{curso?.titulo}</h1>

      {matricula.status === 'trilha_concluida' && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-accent-soft bg-accent-soft p-4 text-sm">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p className="text-ink">
            <span className="font-medium">Trilha concluída.</span> Você está apto ao encontro
            presencial
            {turma?.encontro_data
              ? ` em ${new Date(turma.encontro_data).toLocaleDateString('pt-BR')}`
              : ''}
            {turma?.encontro_local ? `, ${turma.encontro_local}` : ''}.
          </p>
        </div>
      )}

      {matricula.status === 'certificado_emitido' && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-primary-soft bg-primary-soft p-4 text-sm">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-dark" />
          <p className="text-ink">
            <span className="font-medium">Curso concluído.</span> Seu certificado já foi emitido —
            veja em <Link href="/certificados" className="font-medium text-primary-dark underline">Certificados</Link>.
          </p>
        </div>
      )}

      {matricula.status === 'aprovado' && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-accent-soft bg-accent-soft p-4 text-sm">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p className="text-ink">
            <span className="font-medium">Aprovado.</span> O certificado ainda não foi emitido.
            Confira se seu <Link href="/perfil" className="font-medium underline">nome completo</Link> está
            preenchido — ele é obrigatório para a emissão.
          </p>
        </div>
      )}

      {matricula.status === 'reprovado' && (
        <div className="mt-4 rounded-lg border border-danger-soft bg-danger-soft p-4 text-sm text-danger">
          Nota final abaixo do mínimo exigido pelo curso.
        </div>
      )}

      <ol className="mt-8">
        {modulos.map((m, i) => {
          const ultimo = i === modulos.length - 1
          const linha = (
            <div className="flex flex-col items-center">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                  m.concluido
                    ? 'bg-primary text-white'
                    : m.liberado
                      ? 'border-2 border-primary text-primary'
                      : 'border-2 border-border-strong text-subtle'
                }`}
              >
                {m.concluido ? <Check className="h-4 w-4" /> : m.liberado ? m.ordem : <Lock className="h-3.5 w-3.5" />}
              </span>
              {!ultimo && (
                <span
                  className={`mt-1 w-px flex-1 ${m.concluido ? 'bg-primary' : 'bg-border-strong'}`}
                  style={{ minHeight: '2.5rem' }}
                />
              )}
            </div>
          )

          const conteudo = (
            <div className="flex-1 pb-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`font-medium ${m.liberado ? 'text-ink' : 'text-subtle'}`}>{m.titulo}</p>
                  {m.descricao && (
                    <p className="mt-1 text-sm text-muted">{m.descricao}</p>
                  )}
                  <p className="mt-2 text-xs text-subtle">
                    {m.concluidos} de {m.totalObrigatorios} itens obrigatórios
                  </p>
                </div>
              </div>
              {!m.liberado && (
                <p className="mt-2 text-xs text-subtle">Conclua o módulo anterior para liberar este.</p>
              )}
            </div>
          )

          return (
            <li key={m.moduloId} className="flex gap-4">
              {linha}
              {m.liberado ? (
                <Link href={`/trilha/${matriculaId}/${m.moduloId}`} className="flex-1 rounded-lg -mt-1 px-3 py-1 hover:bg-surface">
                  {conteudo}
                </Link>
              ) : (
                <div className="flex-1">{conteudo}</div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
