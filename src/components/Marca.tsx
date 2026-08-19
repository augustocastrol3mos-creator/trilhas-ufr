import Image from 'next/image'

/**
 * Marca institucional: UFR + Trilhas.
 *
 * Regras seguidas do Manual de Uso da Marca UFR (PROTIC, out/2021):
 *
 * - Versão SIMPLIFICADA (só a sigla) para uso cotidiano e telas pequenas.
 *   O manual reserva a versão completa para público que desconhece a marca.
 * - ÁREA DE PROTEÇÃO: espaço livre ao redor equivalente à altura dos
 *   triângulos — aqui garantida pelo padding da faixa branca que envolve
 *   este componente, tanto na sidebar quanto no cabeçalho público.
 * - Sobre fundo escuro, o manual exige o logotipo colorido em área branca.
 *   Resolvemos isso com a FAIXA inteira do topo em branco, não com um
 *   retângulo em volta da marca: mesma conformidade, sem parecer remendo.
 * - O logotipo nunca é esticado, recolorido ou recriado: é o PNG oficial,
 *   com proporção travada por `width`/`height`.
 * - "UFR em primeiro lugar, com peso maior ou igual ao das outras marcas" —
 *   daí a ordem e o separador.
 */
export default function Marca({ compacta = false }: { compacta?: boolean }) {
  const alturaUfr = compacta ? 24 : 30
  const alturaTrilhas = compacta ? 15 : 18

  return (
    <span className="flex items-center gap-3">
      <Image
        src="/logo-ufr.png"
        alt="Universidade Federal de Rondonópolis"
        width={Math.round((282 / 160) * alturaUfr)}
        height={alturaUfr}
        priority
      />

      <span aria-hidden="true" className="h-7 w-px bg-border-strong" />

      <Image
        src="/logo-trilhas.png"
        alt="Trilhas"
        width={Math.round((724 / 160) * alturaTrilhas)}
        height={alturaTrilhas}
        priority
      />
    </span>
  )
}
