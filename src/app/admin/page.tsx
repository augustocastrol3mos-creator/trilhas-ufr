import Link from 'next/link'
import { Award, BookOpen, ScrollText, Tags, Megaphone, PencilLine, Settings, Download, LifeBuoy, Users, Presentation } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data } = await supabase.rpc('admin_visao_geral')
  const v = (data ?? {}) as any

  // admin_visao_geral (0007) não conhece avisos, que só existem desde a 0025.
  // Contar aqui evita reescrever aquela função — que é lida por outras telas —
  // só para acrescentar um número.
  // admin_visao_geral (0007) não conhece categorias, que só existem desde a
  // 0022. O `?? 0` mascarava isso: mostrava zero para sempre, sem erro nenhum.
  // É a mesma armadilha que já pegou avisos e solicitações — chave ausente num
  // objeto vindo de RPC não falha, vira `undefined` e o fallback engole.
  const { count: totalCategorias } = await supabase
    .from('categoria')
    .select('*', { count: 'exact', head: true })

  const { count: pendentesNome } = await supabase
    .from('solicitacao_nome')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pendente')

  const { count: totalAvisos } = await supabase
    .from('aviso')
    .select('*', { count: 'exact', head: true })

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
    { href: '/admin/categorias', Icon: Tags, titulo: 'Categorias', valor: totalCategorias ?? 0,
      detalhe: 'que o professor escolhe e o aluno filtra' },
    { href: '/admin/configuracao', Icon: Settings, titulo: 'Configuração', valor: null,
      detalhe: 'dados que vão impressos no certificado' },
    { href: '/admin/dados', Icon: Download, titulo: 'Exportar dados', valor: null,
      detalhe: 'livro de certificados, matrículas e cursos em CSV' },
    { href: '/admin/manual', Icon: LifeBuoy, titulo: 'Manual da coordenação', valor: null,
      detalhe: 'como operar a plataforma e o que fazer quando algo der errado' },
    { href: '/admin/solicitacoes', Icon: PencilLine, titulo: 'Alterações de nome', valor: pendentesNome ?? 0,
      detalhe: 'pedidos de correção aguardando análise' },
    { href: '/admin/avisos', Icon: Megaphone, titulo: 'Avisos', valor: totalAvisos ?? 0,
      detalhe: 'mensagens no topo das telas de quem está logado' },
    { href: '/admin/auditoria', Icon: ScrollText, titulo: 'Auditoria', valor: v.ajustesDeNota,
      detalhe: `${v.decisoesDivergentes} decisões divergentes` },
  ]

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">Coordenação</h1>
      <p className="mt-1 text-sm text-muted">
        Atos que só a coordenação pode praticar. Se for sua primeira vez por aqui,
        comece pelo manual.
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
            {/* valor null = cartão de ação, não contador. Mostrar "0" ali daria
                a impressão de que não há nada a fazer naquela tela. */}
            {valor != null && (
              <p className="mt-3 font-display text-2xl font-semibold text-ink">{valor}</p>
            )}
            <p className={`text-sm font-medium text-ink ${valor == null ? 'mt-3' : ''}`}>
              {titulo}
            </p>
            <p className="mt-1 text-xs text-subtle">{detalhe}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
