import Image from 'next/image'

/**
 * Marca institucional: UFR + Trilhas.
 *
 * Regras seguidas do Manual de Uso da Marca UFR (PROTIC, out/2021):
 *
 * - Versão SIMPLIFICADA (só a sigla) para uso cotidiano e telas pequenas.
 *   O manual reserva a versão completa para público que desconhece a marca.
 * - ÁREA DE PROTEÇÃO: espaço livre ao redor equivalente à altura dos
 *   triângulos. É o `p-*` do bloco branco e o `gap` até o separador.
 * - Em fundo escuro ou conflitante, o logotipo colorido vai sobre BLOCO
 *   BRANCO — nunca direto sobre o azul da sidebar, onde o triângulo azul
 *   escuro da marca sumiria.
 * - O logotipo nunca é esticado, recolorido ou recriado: é o PNG oficial,
 *   com proporção travada por `width`/`height`.
 * - "UFR em primeiro lugar, com peso maior ou igual ao das outras marcas" —
 *   por isso ela vem primeiro e o separador dá hierarquia visual.
 */
export default function Marca({
  tema = 'claro',
  compacta = false,
}: {
  tema?: 'claro' | 'escuro'
  compacta?: boolean
}) {
  const alturaUfr = compacta ? 22 : 26
  const alturaTrilhas = compacta ? 14 : 17

  return (
    <span className="flex items-center gap-2.5">
      {/* Bloco branco = área de proteção exigida pelo manual em fundo escuro */}
      <span
        className={
          tema === 'escuro'
            ? 'inline-flex items-center rounded-[3px] bg-white px-2 py-1.5'
            : 'inline-flex items-center'
        }
      >
        <Image
          src="/logo-ufr.png"
          alt="Universidade Federal de Rondonópolis"
          width={Math.round((282 / 160) * alturaUfr)}
          height={alturaUfr}
          priority
        />
      </span>

      <span
        aria-hidden="true"
        className={`h-6 w-px ${tema === 'escuro' ? 'bg-sidebar-border' : 'bg-border-strong'}`}
      />

      <Image
        src={tema === 'escuro' ? '/logo-trilhas-negativo.png' : '/logo-trilhas.png'}
        alt="Trilhas"
        width={Math.round((724 / 160) * alturaTrilhas)}
        height={alturaTrilhas}
        priority
      />
    </span>
  )
}
