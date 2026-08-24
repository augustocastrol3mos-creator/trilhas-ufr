import Link from 'next/link'
import { Plus, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { sessaoAtual, exigirProfessor } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function MeusCursosProfessorPage() {
  await exigirProfessor()
  const supabase = await createClient()
  const user = await sessaoAtual()

  // A coordenação gere qualquer curso (seção 5 do ESTADO_DO_PROJETO), então
  // para ela esta tela é "todos os cursos", não "os meus". Sem isso, uma conta
  // admin que não seja autora de nada via a lista vazia — tecnicamente correto
  // pelo filtro, e errado em relação ao que o papel promete.
  //
  // O filtro explícito continua existindo para o instrutor: a política
  // curso_admin (e_admin()) soma por OR com as demais, então sem o .eq() ele
  // veria curso alheio. É o padrão da seção 3 do documento.
  const ehAdmin = user?.papel === 'admin'

  let consulta = supabase
    .from('curso')
    .select('id, titulo, status, modalidade, carga_horaria, autor_id')
    .order('criado_em', { ascending: false })

  if (!ehAdmin) consulta = consulta.eq('autor_id', user?.id ?? '')

  const { data: cursos, error } = await consulta
  const lista = cursos ?? []

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Meus cursos</h1>
          <p className="mt-1 text-sm text-muted">
            {ehAdmin ? 'Todos os cursos da plataforma.' : 'Cursos que você criou.'}
          </p>
          <p className="mt-3 text-sm text-muted">
            <Link href="/professor/guia" className="font-medium text-primary hover:underline">
              Como criar um curso do zero
            </Link>{' '}
            — vocabulário, passo a passo e o que impede a publicação.
          </p>
        </div>
        <Link
          href="/professor/cursos/novo"
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
        >
          <Plus className="h-4 w-4" />
          Novo curso
        </Link>
      </div>

      {error && (
        <p className="mt-6 rounded-md border border-danger-soft bg-danger-soft px-3 py-2 text-sm text-danger">
          {error.message}
        </p>
      )}

      {!error && lista.length === 0 && (
        <p className="mt-6 rounded-lg border border-dashed border-border-strong p-8 text-center text-sm text-muted">
          {ehAdmin
            ? 'Nenhum curso cadastrado na plataforma ainda.'
            : 'Você ainda não criou nenhum curso. Comece pelo botão acima.'}
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {lista.map((c) => (
          <li key={c.id}>
            <Link
              href={`/professor/cursos/${c.id}`}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-5 hover:border-border-strong"
            >
              <div className="min-w-0">
                <p className="truncate font-display font-semibold text-ink">{c.titulo}</p>
                <div className="mt-1.5 flex items-center gap-2 text-xs">
                  {c.status === 'arquivado' ? (
                    <span className="rounded-full border border-border-strong px-2.5 py-0.5 text-xs font-medium text-muted">
                      arquivado
                    </span>
                  ) : c.status === 'publicado' ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 font-medium text-white">publicado</span>
                  ) : (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">rascunho</span>
                  )}
                  <span className="text-subtle">
                    {c.modalidade === 'online' ? '100% online' : 'híbrido'} · {c.carga_horaria}h
                  </span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {lista.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-border-strong p-8 text-center">
          <FileText className="mx-auto h-6 w-6 text-subtle" />
          <p className="mt-2 text-sm text-muted">Você ainda não criou nenhum curso.</p>
        </div>
      )}
    </div>
  )
}
