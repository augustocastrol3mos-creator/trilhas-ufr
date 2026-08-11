import type { TipoBloco } from './schemas'

/** Config inicial de cada tipo de bloco recém-criado. */
export const DEFAULTS_CONFIG: Record<TipoBloco, { titulo: string; config: unknown }> = {
  texto: {
    titulo: 'Novo texto',
    config: { markdown: '## Título da seção\n\nEscreva o conteúdo aqui.' },
  },
  video: {
    titulo: 'Novo vídeo',
    config: { videoId: '', duracaoSegundos: 600, percentualMinimo: 80 },
  },
  checkpoint: {
    titulo: 'Nova confirmação',
    config: { texto: 'Declaro que li o material acima.', rotuloBotao: 'Li e concordo' },
  },
  quiz: {
    titulo: 'Nova avaliação',
    config: {
      notaMinima: 70,
      maxTentativas: 3,
      mostrarGabarito: 'apos_aprovacao',
      questoes: [
        {
          id: 'q1',
          tipo: 'multipla_escolha',
          peso: 1,
          enunciado: 'Escreva o enunciado da questão.',
          alternativas: [
            { id: 'a', texto: 'Alternativa correta', correta: true },
            { id: 'b', texto: 'Alternativa incorreta', correta: false },
          ],
        },
      ],
    },
  },
  material: { titulo: 'Novo material', config: { arquivos: [] } },
  envio: {
    titulo: 'Novo envio',
    config: {
      instrucoes: 'Descreva o que o aluno deve enviar.',
      extensoesPermitidas: ['pdf'],
      tamanhoMaximoMb: 10,
      notaMinima: 60,
      permiteReenvio: true,
    },
  },
}

export const ROTULOS_TIPO: Record<TipoBloco, string> = {
  texto: 'Texto',
  video: 'Vídeo',
  quiz: 'Quiz',
  checkpoint: 'Confirmação',
  material: 'Material',
  envio: 'Envio',
}

/** Tipos com editor construído nesta versão. */
export const TIPOS_DISPONIVEIS: TipoBloco[] = ['texto', 'video', 'quiz', 'checkpoint', 'material']
