'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Todas as regras (permissão, constraints de modalidade, vagas < matriculados,
// turma encerrada) moram na 0014. Aqui só empacotamos o formulário e
// traduzimos a recusa do banco em mensagem na tela — nunca revalidamos nada,
// senão viram duas cópias da mesma regra que divergem com o tempo.

function voltar(cursoId: string, erro?: string) {
  const base = `/professor/cursos/${cursoId}/turmas`
  redirect(erro ? `${base}?erro=${encodeURIComponent(erro)}` : base)
}

export async function criarTurma(formData: FormData) {
  const cursoId = String(formData.get('cursoId'))
  const supabase = await createClient()

  const { error } = await supabase.rpc('criar_turma', {
    p_curso: cursoId,
    p_dados: {
      identificador: String(formData.get('identificador') ?? ''),
      encontroData: String(formData.get('encontroData') ?? ''),
      encontroLocal: String(formData.get('encontroLocal') ?? ''),
      inscricoesAte: String(formData.get('inscricoesAte') ?? ''),
      vagas: String(formData.get('vagas') ?? ''),
    },
  })

  if (error) voltar(cursoId, error.message)
  revalidatePath(`/professor/cursos/${cursoId}/turmas`)
  voltar(cursoId)
}

export async function atualizarTurma(formData: FormData) {
  const cursoId = String(formData.get('cursoId'))
  const supabase = await createClient()

  const { error } = await supabase.rpc('atualizar_turma', {
    p_turma: String(formData.get('turmaId')),
    p_dados: {
      encontroData: String(formData.get('encontroData') ?? ''),
      encontroLocal: String(formData.get('encontroLocal') ?? ''),
      inscricoesAte: String(formData.get('inscricoesAte') ?? ''),
      vagas: String(formData.get('vagas') ?? ''),
    },
  })

  if (error) voltar(cursoId, error.message)
  revalidatePath(`/professor/cursos/${cursoId}/turmas`)
  voltar(cursoId)
}

export async function alternarInscricoes(formData: FormData) {
  const cursoId = String(formData.get('cursoId'))
  const supabase = await createClient()

  const { error } = await supabase.rpc('definir_inscricoes', {
    p_turma: String(formData.get('turmaId')),
    p_abertas: formData.get('abrir') === '1',
  })

  if (error) voltar(cursoId, error.message)
  revalidatePath(`/professor/cursos/${cursoId}/turmas`)
  voltar(cursoId)
}
