import Image from 'next/image'

/**
 * Marca institucional: UFR + Trilhas.
 *
 * ALINHAMENTO — `items-end`, não `items-center`.
 * O logotipo simplificado da UFR tem os triângulos ACIMA da palavra "UFR".
 * Centralizando os dois blocos verticalmente, a palavra "UFR" cai 6,3px
 * abaixo de "TRILHAS" (medido nas alturas usadas aqui) e a marca parece torta.
 * Alinhando pela base, as duas linhas de base ficam a 0,6px uma da outra —
 * que é como se alinham duas palavras lado a lado em tipografia.
 *
 * Manual de Uso da Marca UFR (PROTIC, out/2021):
 * - Versão SIMPLIFICADA para uso cotidiano e telas pequenas.
 * - Área de proteção garantida pelo padding da faixa branca em volta.
 * - PNG oficial, proporção travada: nunca esticado, recolorido ou recriado.
 * - "UFR em primeiro lugar, com peso maior ou igual às outras marcas".
 */
export default function Marca({ compacta = false }: { compacta?: boolean }) {
  const alturaUfr = compacta ? 24 : 30
  const alturaTrilhas = compacta ? 14 : 17

  return (
    <span className="flex items-end gap-3">
      <Image
        src="/logo-ufr.png"
        alt="Universidade Federal de Rondonópolis"
        width={Math.round((282 / 160) * alturaUfr)}
        height={alturaUfr}
        priority
      />

      <span
        aria-hidden="true"
        className="mb-0.5 w-px self-stretch bg-border-strong"
      />

      <Image
        src="/logo-trilhas.png"
        alt="Trilhas"
        width={Math.round((724 / 160) * alturaTrilhas)}
        height={alturaTrilhas}
        className="mb-0.5"
        priority
      />
    </span>
  )
}
