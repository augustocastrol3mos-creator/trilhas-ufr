import Link from 'next/link'
import { ChevronRight, UserCheck, UserX } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { sessaoAtual } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const STATUS: Record<string, { rotulo: string; classe: string }> = {
  inscrito: { rotulo: 'Inscrito', classe: 'border border-border-strong text-muted' },
  em_andamento: { rotulo: 'Em andamento', classe: 'bg-accent-soft text-accent' },
  trilha_concluida: { rotulo: 'Aguardando encontro', classe: 'bg-accent-soft text-accent' },
  aprovado: { rotulo: 'Aprovado', classe: 'bg-primary text-white' },
  reprovado: { rotulo: 'Reprovado', classe: 'bg-danger-soft text-danger' },
  certificado_emitido: { rotulo: 'Certificado emitido', classe: 'bg-primary text-white' },
}

export default async function MeusCursosPage() {
  const supabase = await createClient()
  const user = await sessaoAtual()

  const { data, error } = await supabase
    .from('matricula')
    .select('id, status, presenca_confirmada, presenca_em, turma(identificador, encontro_data, curso(titulo, carga_horaria, modalidade))')
    .eq('usuario_id', user?.id ?? '')
    .order('criado_em', { ascending: false })

  if (error) {
    return (
      <div className="rounded-lg border border-danger-soft bg-danger-soft/40 p-4 text-sm text-danger">
        {error.message}
      </div>
    )
  }

  const matriculas = (data ?? []) as any[]

  // O filtro por dono está DENTRO da RPC (where usuario_id = auth.uid()), para
  // nenhuma tela precisar lembrar de aplicá-lo — as policies de presenca
  // incluem "admin vê tudo".
  const { data: resumo } = await supabase.rpc('meu_resumo_presenca')
  const presencas = (resumo ?? {}) as Record<
    string,
    { total: number; presentes: number; minima: number }
  >

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">Meus cursos</h1>
      <p className="mt-1 text-sm text-muted">Suas matrículas e o progresso em cada trilha.</p>

      <ul className="mt-6 space-y-3">
        {matriculas.map((m) => {
          const status = STATUS[m.status] ?? { rotulo: m.status, classe: 'border border-border-strong text-muted' }
          return (
            <li key={m.id}>
              <Link
                href={`/trilha/${m.id}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-5 hover:border-border-strong"
              >
                <div className="min-w-0">
                  <p className="truncate font-display text-base font-semibold text-ink">
                    {m.turma?.curso?.titulo}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.classe}`}>
                      {status.rotulo}
                    </span>
                    <span className="text-xs text-muted">{m.turma?.curso?.carga_horaria}h</span>
                  </div>

                  {/* Presença: o elo da cadeia que o aluno nunca via. Só faz
                      sentido em curso híbrido — em online não há encontro. */}
                  {m.turma?.curso?.modalidade === 'hibrido' && presencas[m.id]?.total > 0 && (
                    <p className="mt-2 text-xs text-muted">
                      Presença em {presencas[m.id].presentes} de {presencas[m.id].total}{' '}
                      {presencas[m.id].total === 1 ? 'encontro' : 'encontros'} · mínimo{' '}
                      {presencas[m.id].minima}%
                    </p>
                  )}

                  {m.turma?.curso?.modalidade === 'hibrido' && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs">
                      {m.presenca_confirmada ? (
                        <>
                          <UserCheck className="h-3.5 w-3.5 text-primary" />
                          <span className="text-primary-dark">
                            Presença suficiente para o certificado
                            {m.presenca_em
                              ? ` em ${new Date(m.presenca_em).toLocaleDateString('pt-BR')}`
                              : ''}
                          </span>
                        </>
                      ) : (
                        <>
                          <UserX className="h-3.5 w-3.5 text-muted" />
                          <span className="text-muted">
                            Presença ainda insuficiente
                            {m.turma?.encontro_data
                              ? ` · encontro em ${new Date(m.turma.encontro_data).toLocaleDateString('pt-BR')}`
                              : ''}
                          </span>
                        </>
                      )}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-subtle" />
              </Link>
            </li>
          )
        })}
      </ul>

      {matriculas.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-border-strong p-8 text-center">
          <p className="text-sm text-muted">Você ainda não se inscreveu em nenhum curso.</p>
          <Link href="/cursos" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
            Ver cursos disponíveis
          </Link>
        </div>
      )}
    </div>
  )
}
