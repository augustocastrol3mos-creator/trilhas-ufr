import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import FormPapel from './FormPapel'

export const dynamic = 'force-dynamic'

const ROTULO: Record<string, string> = {
  aluno: 'Aluno', instrutor: 'Instrutor', admin: 'Coordenação',
}

export default async function UsuariosPage() {
  const supabase = await createClient()
  const { data: usuarios } = await supabase
    .from('usuario')
    .select('id, nome_completo, email, papel, criado_em')
    .order('criado_em', { ascending: false })

  return (
    <div>
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Coordenação
      </Link>

      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Usuários</h1>
      <p className="mt-1 text-sm text-muted">
        Conceder papel de instrutor é o que permite alguém criar cursos que emitem
        certificado com o nome da UFR.
      </p>

      <FormPapel />

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Papel</th>
            </tr>
          </thead>
          <tbody>
            {(usuarios ?? []).map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-ink">{u.nome_completo || '(sem nome)'}</td>
                <td className="px-4 py-3 text-muted">{u.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.papel === 'admin'
                        ? 'bg-primary text-white'
                        : u.papel === 'instrutor'
                          ? 'bg-primary-soft text-primary-dark'
                          : 'border border-border-strong text-muted'
                    }`}
                  >
                    {ROTULO[u.papel] ?? u.papel}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
