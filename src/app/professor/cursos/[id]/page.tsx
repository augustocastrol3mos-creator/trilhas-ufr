import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ROTULOS_TIPO } from '@/lib/blocos/defaults'
import PainelCurso from './PainelCurso'
import AdicionarBloco from './AdicionarBloco'
import NovoModulo from './NovoModulo'
import Reordenar from './Reordenar'
import EditorCapa from './EditorCapa'
import PrazoConclusao from './PrazoConclusao'
import EditorApresentacao from './EditorApresentacao'
import EditorCompetencias from './EditorCompetencias'

export const dynamic = 'force-dynamic'

export default async function EditorCursoPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: curso } = await supabase
    .from('curso')
    .select('id, titulo, descricao, status, modalidade, emissao, carga_horaria, nota_minima_final, capa_url, prazo_conclusao_dias, apresentacao, categoria(nome), curso_competencia(competencia_id)')
    .eq('id', id)
    .single()

  if (!curso) notFound()

  const { data: modulos } = await supabase
    .from('modulo')
    .select('id, ordem, titulo, descricao, bloco(id, ordem, tipo, titulo, obrigatorio, pontuavel)')
    .eq('curso_id', id)
    .order('ordem')

  const { data: validacao } = await supabase.rpc('validar_publicacao', { p_curso: id })

  const { data: competencias } = await supabase.rpc('competencias_com_uso')

  const lista = (modulos ?? []).map((m: any) => ({
    ...m,
    bloco: [...(m.bloco ?? [])].sort((a: any, b: any) => a.ordem - b.ordem),
  }))

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/professor/cursos" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" />
          Meus cursos
        </Link>

        <Link
          href={`/professor/cursos/${id}/turmas`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-sm font-medium text-ink hover:bg-canvas"
        >
          <Users className="h-3.5 w-3.5" />
          Turmas
        </Link>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <PrazoConclusao
          cursoId={id}
          prazo={(curso as any).prazo_conclusao_dias ?? null}
          matriculados={0}
        />
        <EditorCapa
          cursoId={id}
          titulo={(curso as any).titulo}
          categoria={(curso as any).categoria?.nome ?? null}
          capaUrl={(curso as any).capa_url ?? null}
        />
      </div>

      <div className="mt-4">
        <EditorCompetencias
          cursoId={id}
          disponiveis={(competencias ?? []).filter((c: any) => c.ativa) as any}
          selecionadas={((curso as any).curso_competencia ?? []).map((x: any) => x.competencia_id)}
        />
      </div>

      <div className="mt-4">
        <EditorApresentacao
          cursoId={id}
          apresentacao={(curso as any).apresentacao ?? null}
        />
      </div>

      <PainelCurso
        curso={curso as any}
        pendencias={(validacao as any)?.pendencias ?? []}
        podePublicar={Boolean((validacao as any)?.ok)}
      />

      <div className="mt-8">
        <h2 className="font-display text-lg font-semibold text-ink">Módulos</h2>
        <p className="mt-1 text-sm text-muted">
          A trilha é linear: o aluno só abre o módulo seguinte depois de concluir todos os
          blocos obrigatórios do anterior.
        </p>
      </div>

      {lista.length === 0 && (
        <div className="mt-4 rounded-lg border border-border bg-surface p-6">
          <p className="font-display font-semibold text-ink">Como montar seu curso</p>
          <ol className="mt-3 space-y-2 text-sm text-muted">
            <li>
              <span className="font-medium text-ink">1.</span> Crie um módulo. Ele agrupa o
              conteúdo de uma aula ou tema.
            </li>
            <li>
              <span className="font-medium text-ink">2.</span> Adicione blocos ao módulo: vídeo do
              YouTube, texto, material em PDF, quiz ou uma confirmação de leitura. Você combina
              como quiser, na ordem que quiser.
            </li>
            <li>
              <span className="font-medium text-ink">3.</span> Marque como obrigatório o que trava
              a trilha. Blocos opcionais são material de apoio.
            </li>
            <li>
              <span className="font-medium text-ink">4.</span> Use{' '}
              <span className="font-medium text-ink">Revisar e pré-visualizar</span> para ver como
              o aluno enxerga e o que ainda falta antes de publicar.
            </li>
          </ol>
        </div>
      )}

      <ol className="mt-4 space-y-4">
        {lista.map((m: any) => (
          <li key={m.id} className="rounded-lg border border-border bg-surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display font-semibold text-ink">
                  {m.ordem}. {m.titulo}
                </p>
                {m.descricao && <p className="mt-1 text-sm text-muted">{m.descricao}</p>}
              </div>
              <Reordenar tipo="modulo" id={m.id} cursoId={id} />
            </div>

            <ul className="mt-4 space-y-2">
              {m.bloco.map((b: any) => (
                <li key={b.id} className="flex items-center gap-2">
                  <Reordenar tipo="bloco" id={b.id} cursoId={id} />
                  <Link
                    href={`/professor/cursos/${id}/blocos/${b.id}`}
                    className="flex flex-1 items-center gap-3 rounded-md border border-border bg-canvas px-3 py-2 hover:border-primary"
                  >
                    <span className="rounded bg-surface px-2 py-0.5 text-xs font-medium text-muted">
                      {ROTULOS_TIPO[b.tipo as keyof typeof ROTULOS_TIPO]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{b.titulo}</span>
                    {b.obrigatorio && (
                      <span className="shrink-0 text-xs text-accent">obrigatório</span>
                    )}
                  </Link>
                </li>
              ))}
              {m.bloco.length === 0 && (
                <li className="rounded-md border border-dashed border-border-strong px-3 py-3 text-center text-xs text-subtle">
                  Nenhum bloco neste módulo ainda.
                </li>
              )}
            </ul>

            <AdicionarBloco cursoId={id} moduloId={m.id} moduloTitulo={m.titulo} />
          </li>
        ))}
      </ol>

      <NovoModulo cursoId={id} />
    </div>
  )
}
