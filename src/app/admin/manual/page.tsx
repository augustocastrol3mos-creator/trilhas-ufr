import Link from 'next/link'
import {
  ArrowLeft, BookOpen, Download, LifeBuoy, Megaphone, Settings, ShieldCheck, Users,
} from 'lucide-react'
import { exigirAdmin } from '@/lib/auth'

export const metadata = { title: 'Manual da coordenação — Trilhas UFR' }

export default async function ManualPage() {
  await exigirAdmin()
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Coordenação
      </Link>

      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">
        Manual da coordenação
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        Tudo que a coordenação precisa fazer nesta plataforma, e o que fazer quando algo
        der errado. Nada aqui exige conhecimento técnico.
      </p>

      <Secao Icon={Settings} titulo="O que precisa estar certo antes de emitir certificados">
        <p>
          Em <Rota href="/admin/configuracao">Configuração institucional</Rota> ficam os
          dados que vão impressos em todo certificado: nome da instituição, órgão
          emissor, quem assina, e o endereço de validação.
        </p>
        <p>
          <strong className="text-ink">Confira sempre que a coordenação mudar.</strong> O
          nome de quem assina é o exemplo mais óbvio: ele muda de gestão para gestão, e
          um certificado assinado por quem não está mais no cargo gera dúvida legítima.
        </p>
        <p className="rounded-md border border-accent-soft bg-accent-soft px-3 py-2 text-ink">
          Certificado já emitido <strong>não muda</strong> quando essa tela é alterada.
          Isso é proposital: um documento entregue precisa continuar valendo o que dizia.
          O que você editar vale para os próximos.
        </p>
      </Secao>

      <Secao Icon={Download} titulo="A rotina que não pode ser esquecida">
        <p>
          Baixe o <Rota href="/admin/dados">livro de certificados</Rota> uma vez por
          semestre, e sempre que uma turma for fechada. Guarde no drive da coordenação.
        </p>
        <p>
          <strong className="text-ink">É a única coisa nesta lista que não tem
          conserto depois.</strong> Se a plataforma sair do ar, for perdida ou
          substituída, esse arquivo é a prova de que os certificados existiram — com o
          código de cada um, que é o que permite conferi-los.
        </p>
      </Secao>

      <Secao Icon={BookOpen} titulo="Cursos e categorias">
        <p>
          O professor cria o curso e prepara a trilha; quem publica é a coordenação, em{' '}
          <Rota href="/admin/cursos">Cursos</Rota>. A plataforma recusa publicar curso
          incompleto e diz o que falta.
        </p>
        <p>
          <Rota href="/admin/categorias">Categorias</Rota> organizam o catálogo e o filtro
          que o aluno usa. Categoria em uso não pode ser excluída — desative para tirá-la
          de circulação sem perder o rótulo dos cursos que já a têm.
        </p>
        <p>
          Em <Rota href="/admin/cursos">Cursos</Rota> também dá para{' '}
          <strong className="text-ink">arquivar</strong> (tira do catálogo e preserva
          quem já está matriculado) e <strong className="text-ink">destacar na página
          inicial</strong>, escrevendo por que aquele curso merece atenção agora. Sem
          destaque escolhido, a plataforma mostra uma amostra que muda a cada dia.
        </p>
      </Secao>

      <Secao Icon={Users} titulo="Pessoas">
        <p>
          Em <Rota href="/admin/usuarios">Usuários</Rota> a coordenação concede o papel de
          professor. Todo cadastro novo nasce como aluno.
        </p>
        <p>
          Em <Rota href="/admin/solicitacoes">Alterações de nome</Rota> ficam os pedidos
          de correção de nome e RGA. Depois da primeira inscrição o aluno não altera
          sozinho, porque esses dados vão impressos no certificado.
        </p>
        <p>
          A maioria dos pedidos é correção legítima — erro de digitação, nome social, nome
          de casada, ou RGA novo por reingresso. Ao avaliar, compare com o registro
          acadêmico e, na dúvida, converse com a pessoa. Um pedido não é indício de nada.
        </p>
      </Secao>

      <Secao Icon={Megaphone} titulo="Avisos">
        <p>
          Em <Rota href="/admin/avisos">Avisos</Rota> você publica mensagens no topo das
          telas de quem está logado. Use a janela de datas para o aviso sumir sozinho —
          aviso sem prazo é aviso que ninguém apaga, e acaba no ar um ano depois.
        </p>
        <p>Máximo de três por vez. Acima disso ninguém lê.</p>
      </Secao>

      <Secao Icon={ShieldCheck} titulo="Certificado revogado, e por que não se apaga">
        <p>
          Certificado emitido é registro institucional: não se edita nem se apaga. Erro se
          corrige <strong className="text-ink">revogando e reemitindo</strong>, o que gera
          um código novo e deixa o histórico visível.
        </p>
        <p>
          Pelo mesmo motivo, curso com matrícula não pode ser excluído — apagá-lo levaria
          junto os certificados e quebraria as URLs de validação de quem já tem o
          documento em mãos. Nesse caso, arquive.
        </p>
      </Secao>

      <Secao Icon={LifeBuoy} titulo="O que fazer quando">
        <Caso titulo="Um aluno diz que o nome do certificado está errado">
          Se ele ainda não recebeu o certificado, oriente-o a pedir a correção no próprio
          perfil — o pedido chega em Alterações de nome. Se o certificado já saiu, é caso
          de revogar e reemitir, em Certificados.
        </Caso>

        <Caso titulo="Alguém precisa conferir um certificado e não confia na tela">
          Na página de validação há o botão de baixar a credencial assinada. É um arquivo
          que carrega os próprios dados e uma assinatura criptográfica: pode ser conferido
          por qualquer sistema que entenda o padrão Open Badges, sem depender desta
          plataforma. Alterar um caractere invalida a assinatura.
        </Caso>

        <Caso titulo="Um professor saiu da instituição">
          Os cursos continuam com ele como autor. Em Turmas, troque o instrutor
          responsável pelas turmas ativas. Se o curso não for mais ofertado, arquive.
        </Caso>

        <Caso titulo="A plataforma está fora do ar">
          Não há nada que a coordenação consiga fazer pela própria interface. Acione o
          contato técnico responsável. Enquanto isso, o livro de certificados baixado
          permite responder a qualquer consulta sobre certificados já emitidos.
        </Caso>

        <Caso titulo="Ninguém mais mantém o sistema">
          Baixe as três exportações em Exportar dados e guarde junto da chave pública do
          emissor, disponível em /emissor/chaves. Com esses arquivos, os certificados
          emitidos continuam comprováveis mesmo sem a plataforma.
        </Caso>
      </Secao>

      <p className="mt-8 rounded-lg border border-border bg-surface p-5 text-sm leading-relaxed text-muted">
        Faltou alguma situação aqui? Anote e peça para incluir. Este manual só é útil se
        cobrir as dúvidas que aparecem de verdade, não as que alguém imaginou.
      </p>

      {/* Origem do projeto. Aqui e não numa tela de "sobre": é onde alguém que
          herdar a plataforma daqui a alguns anos vai procurar de onde ela veio. */}
      <div className="mt-6 border-t border-border pt-6 text-xs leading-relaxed text-subtle">
        <p>
          O Trilhas UFR foi desenvolvido por{' '}
          <strong className="text-muted">Augusto Castro Lemos</strong>, durante projeto de
          extensão coordenado pelo{' '}
          <strong className="text-muted">Prof. Dr. André Luís Janzkovski Cardoso</strong>.
        </p>
        <p className="mt-1.5">
          A documentação técnica do projeto — arquitetura, histórico de decisões e roteiro
          de operação — está no repositório, nos arquivos{' '}
          <code className="text-muted">ESTADO_DO_PROJETO.md</code>,{' '}
          <code className="text-muted">ARQUITETURA.md</code> e{' '}
          <code className="text-muted">OPERACAO.md</code>.
        </p>
      </div>
    </div>
  )
}

function Secao({
  Icon, titulo, children,
}: { Icon: typeof BookOpen; titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
        {titulo}
      </h2>
      <div className="mt-3 space-y-2.5 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  )
}

function Rota({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-primary hover:underline">
      {children}
    </Link>
  )
}

function Caso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-ink">{titulo}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{children}</p>
    </div>
  )
}
