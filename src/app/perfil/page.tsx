import { revalidatePath } from 'next/cache'
import { AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function salvar(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('usuario')
    .update({ nome_completo: String(formData.get('nome') ?? '').trim() })
    .eq('id', user.id)

  revalidatePath('/perfil')
  revalidatePath('/', 'layout')
}

export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfil } = await supabase
    .from('usuario')
    .select('nome_completo, email')
    .eq('id', user?.id ?? '')
    .single()

  const vazio = !perfil?.nome_completo?.trim()

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-display text-2xl font-semibold text-ink">Perfil</h1>
      <p className="mt-1 text-sm text-muted">
        Este nome aparece exatamente assim no certificado.
      </p>

      {vazio && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-accent-soft bg-accent-soft p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p className="text-ink">
            Preencha seu nome completo antes de concluir um curso. Sem ele, o certificado
            não pode ser emitido.
          </p>
        </div>
      )}

      <form action={salvar} className="mt-6 rounded-lg border border-border bg-surface p-6">
        <label className="block text-sm font-medium text-ink">
          Nome completo
          <input
            name="nome"
            required
            defaultValue={perfil?.nome_completo ?? ''}
            className="mt-1.5 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
          />
        </label>
        <p className="mt-1.5 text-xs text-subtle">
          Escreva como consta no seu documento. Corrigir depois da emissão exige revogar e reemitir.
        </p>

        <label className="mt-5 block text-sm font-medium text-ink">
          E-mail
          <input
            disabled
            value={perfil?.email ?? ''}
            className="mt-1.5 w-full rounded-md border border-border bg-canvas px-3 py-2 text-sm text-muted"
          />
        </label>

        <button className="mt-6 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark">
          Salvar
        </button>
      </form>
    </div>
  )
}
