import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { criarCurso } from '@/app/professor/cursos/actions'
import FormNovoCurso from './FormNovoCurso'

export default function NovoCursoPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/professor/cursos" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </Link>

      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Novo curso</h1>
      <p className="mt-1 text-sm text-muted">
        A modalidade vem primeiro porque ela define o resto: curso online é
        autoinstrucional e certifica sozinho; híbrido termina num encontro presencial
        que você avalia.
      </p>

      <FormNovoCurso acao={criarCurso} />
    </div>
  )
}
