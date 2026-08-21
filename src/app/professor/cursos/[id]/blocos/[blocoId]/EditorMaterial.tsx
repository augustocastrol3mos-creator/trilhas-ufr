'use client'

import { useRef, useState } from 'react'
import { FileText, Trash2, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Arquivo = { nome: string; path: string; tamanhoBytes: number }

const MAX_MB = 20

export default function EditorMaterial({
  blocoId, config, set,
}: { blocoId: string; config: any; set: (p: any) => void }) {
  const arquivos: Arquivo[] = config.arquivos ?? []
  const input = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function subir(files: FileList | null) {
    if (!files?.length) return
    setErro(null)
    setEnviando(true)

    const supabase = createClient()
    const novos: Arquivo[] = []

    for (const file of Array.from(files)) {
      if (file.size > MAX_MB * 1024 * 1024) {
        setErro(`"${file.name}" passa de ${MAX_MB} MB. Comprima o arquivo ou divida em partes.`)
        continue
      }

      const extensao = file.name.split('.').pop() ?? 'bin'
      const path = `${blocoId}/${crypto.randomUUID()}.${extensao}`

      const { error } = await supabase.storage.from('materiais').upload(path, file)
      if (error) {
        setErro(error.message)
        continue
      }

      novos.push({ nome: file.name, path, tamanhoBytes: file.size })
    }

    if (novos.length) set({ arquivos: [...arquivos, ...novos] })
    setEnviando(false)
    if (input.current) input.current.value = ''
  }

  async function remover(path: string) {
    const supabase = createClient()
    await supabase.storage.from('materiais').remove([path])
    set({ arquivos: arquivos.filter((a) => a.path !== path) })
  }

  return (
    <div>
      <p className="text-sm font-medium text-ink">Arquivos</p>
      <p className="mt-1 text-xs text-subtle">
        PDF, planilha ou apostila. Até {MAX_MB} MB por arquivo. Não use este bloco para vídeo —
        use o bloco de vídeo, que roda no YouTube.
      </p>

      <ul className="mt-4 space-y-2">
        {arquivos.map((a) => (
          <li
            key={a.path}
            className="flex items-center gap-3 rounded-md border border-border bg-canvas px-3 py-2"
          >
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-sm text-ink">{a.nome}</span>
            <span className="shrink-0 text-xs text-subtle">
              {(a.tamanhoBytes / 1024 / 1024).toFixed(1)} MB
            </span>
            <button
              onClick={() => remover(a.path)}
              className="shrink-0 rounded p-1 text-subtle hover:text-danger"
              title="Remover arquivo"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-canvas p-3">
        <input
          type="checkbox"
          checked={Boolean(config.sempreDisponivel)}
          onChange={(e) => set({ sempreDisponivel: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
        />
        <span className="text-sm text-ink">
          Disponível desde o começo do curso
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">
            Por padrão, o material libera junto com o módulo dele. Marque para o aluno
            baixar desde o primeiro dia — útil para guia do curso, glossário ou planilha
            modelo. Deixe desmarcado se o arquivo só faz sentido depois de alguma etapa.
          </span>
        </span>
      </label>

      {arquivos.length === 0 && (
        <p className="mt-3 rounded-md border border-dashed border-border-strong p-4 text-center text-sm text-subtle">
          Nenhum arquivo ainda.
        </p>
      )}

      <input
        ref={input}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => subir(e.target.files)}
      />

      <button
        onClick={() => input.current?.click()}
        disabled={enviando}
        className="mt-4 inline-flex items-center gap-2 rounded-md border border-border-strong px-4 py-2 text-sm text-ink hover:border-primary hover:text-primary disabled:opacity-50"
      >
        <Upload className="h-4 w-4" />
        {enviando ? 'Enviando...' : 'Enviar arquivo'}
      </button>

      <p className="mt-3 text-xs text-subtle">
        O envio grava o arquivo na hora. Lembre de salvar o bloco para registrar a lista.
      </p>

      {erro && <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>}
    </div>
  )
}
