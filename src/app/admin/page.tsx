import Link from 'next/link'
import { Award, BookOpen, ScrollText, Tags, Megaphone, Users, Presentation } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data } = await supabase.rpc('admin_visao_geral')
  const v = (data ?? {}) as any

  if (v.erro) {
    return (
      <div className="rounded-lg border border-danger-soft bg-danger-soft/40 p-4 text-sm text-danger">
        Esta área é restrita à coordenação.
      </div>
    )
  }

  const cards = [
    { href: '/admin/usuarios', Icon: Users, titulo: 'Usuários', valor: v.usuarios,
      detalhe: `${v.instrutores} com papel de instrutor` },
    { href: '/admin/cursos', Icon: BookOpen, titulo: 'Cursos', valor: v.cursosPublicados,
      detalhe: v.cursosEmAnalise > 0 ? `${v.cursosEmAnalise} aguardando autorização` : 'nenhum aguardando' ,
      alerta: v.cursosEmAnalise > 0 },
    { href: '/admin/turmas', Icon: Presentation, titulo: 'Turmas', valor: v.matriculas,
      detalhe: 'editar, fechar ou reabrir qualquer turma' },
    { href: '/admin/certificados', Icon: Award, titulo: 'Certificados', valor: v.certificadosAtivos,
      detalhe: `${v.certificadosRevogados} revogados` },
    { href: '/admin/categorias', Icon: Tags, titulo: 'Categorias', valor: (v as any).categorias ?? 0,
      detalhe: 'que o professor escolhe e o aluno filtra' },
    { href: '/admin/avisos', Icon: Megaphone, titulo: 'Avisos', valor: (v as any).avisos ?? 0,
      detalhe: 'mensagens no topo das telas de quem está logado' },
    { href: '/admin/auditoria', Icon: ScrollText, titulo: 'Auditoria', valor: v.ajustesDeNota,
      detalhe: `${v.decisoesDivergentes} decisões divergentes` },
  ]

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">Coordenação</h1>
      <p className="mt-1 text-sm text-muted">
        Atos que só a coordenação pode praticar: conceder papéis, autorizar publicação e
        revogar certificados.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {cards.map(({ href, Icon, titulo, valor, detalhe, alerta }) => (
          <Link
            key={href}
            href={href}
            className={`rounded-lg border bg-surface p-5 hover:border-border-strong ${
              alerta ? 'border-accent' : 'border-border'
            }`}
          >
            <Icon className={`h-5 w-5 ${alerta ? 'text-accent' : 'text-primary'}`} />
            <p className="mt-3 font-display text-2xl font-semibold text-ink">{valor ?? 0}</p>
            <p className="text-sm font-medium text-ink">{titulo}</p>
            <p className="mt-1 text-xs text-subtle">{detalhe}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
