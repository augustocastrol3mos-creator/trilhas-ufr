import { z } from 'zod'

export const TIPOS_BLOCO = [
  'video', 'texto', 'material', 'quiz', 'envio', 'checkpoint',
] as const

export type TipoBloco = (typeof TIPOS_BLOCO)[number]

export type EstadoProgresso =
  | 'pendente' | 'em_andamento' | 'aguardando_correcao' | 'concluido' | 'reprovado'

export const videoSchema = z.object({
  videoId: z.string().regex(/^[\w-]{11}$/, 'ID do YouTube inválido'),
  duracaoSegundos: z.number().int().positive(),
  percentualMinimo: z.number().int().min(0).max(100).default(80),
})

export const textoSchema = z.object({
  markdown: z.string().min(1).max(50000),
})

export const checkpointSchema = z.object({
  texto: z.string().min(1).max(5000),
  rotuloBotao: z.string().min(1).max(40).default('Marcar como concluído'),
})

export const materialSchema = z.object({
  arquivos: z.array(z.object({
    nome: z.string().min(1),
    path: z.string().min(1),
    tamanhoBytes: z.number().int().positive(),
  })).min(1).max(10),
  // Exceção, não padrão. O comportamento natural — o material destravar junto
  // com o módulo — já é o correto; isto promove um arquivo para "disponível
  // desde o começo", como um guia do curso ou um glossário.
  sempreDisponivel: z.boolean().default(false),
})

const alternativaPublica = z.object({ id: z.string(), texto: z.string() })

export const questaoPublicaSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('multipla_escolha'),
    id: z.string(), enunciado: z.string(), peso: z.number().default(1),
    alternativas: z.array(alternativaPublica).min(2),
  }),
  z.object({
    tipo: z.literal('verdadeiro_falso'),
    id: z.string(), enunciado: z.string(), peso: z.number().default(1),
  }),
  z.object({
    tipo: z.literal('multipla_resposta'),
    id: z.string(), enunciado: z.string(), peso: z.number().default(1),
    alternativas: z.array(alternativaPublica).min(2),
  }),
])

// Formato que chega ao navegador: já passou por sanitizar_config() no banco.
export const quizPublicoSchema = z.object({
  notaMinima: z.number().default(70),
  maxTentativas: z.number().int().default(3),
  mostrarGabarito: z.enum(['nunca', 'apos_tentativa', 'apos_aprovacao']).optional(),
  questoes: z.array(questaoPublicaSchema).min(1),
})

export type ConfigVideo = z.infer<typeof videoSchema>
export type ConfigTexto = z.infer<typeof textoSchema>
export type ConfigCheckpoint = z.infer<typeof checkpointSchema>
export type ConfigQuizPublico = z.infer<typeof quizPublicoSchema>
export type QuestaoPublica = z.infer<typeof questaoPublicaSchema>

export type BlocoAluno = {
  blocoId: string
  ordem: number
  tipo: TipoBloco
  titulo: string
  config: unknown
  obrigatorio: boolean
  estado: EstadoProgresso
  dados: Record<string, unknown>
  nota: number | null
}

export type ModuloTrilha = {
  moduloId: string
  ordem: number
  titulo: string
  descricao: string | null
  totalObrigatorios: number
  concluidos: number
  concluido: boolean
  liberado: boolean
  tempoMinutos: number
}
