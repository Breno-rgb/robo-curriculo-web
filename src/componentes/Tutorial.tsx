// Tutorial em pop-ups: aparece quando a pessoa acabou de criar a conta.
// Cada passo leva pra tela que ele explica e destaca o item do menu.
import { useEffect, useRef, useState } from 'react'

export type Alvo = 'inicio' | 'mestre' | 'realizados' | 'perfil'

type Passo = { titulo: string; texto: string; alvo?: Alvo }

const PASSOS: Passo[] = [
  {
    titulo: 'Bem-vindo ao Robô Currículo! 👋',
    texto: 'Aqui você monta um currículo de 1 página pra cada vaga, em segundos. O robô só usa o que é verdade sobre você: ele escolhe e reorganiza, nunca inventa.',
  },
  {
    alvo: 'mestre',
    titulo: 'Preencha seu currículo mestre',
    texto: 'É onde fica tudo sobre você: experiências, cursos e competências. Você faz isso uma vez só. O jeito mais rápido é "Importar PDF" (o robô lê o currículo que você já tem) ou "Importar JSON". Depois confira e clique em Salvar.',
  },
  {
    alvo: 'inicio',
    titulo: 'Cole a vaga',
    texto: 'Na tela inicial, copie o texto da vaga (LinkedIn, Gupy, Indeed…), cole na caixa e clique em "Gerar currículo".',
  },
  {
    alvo: 'inicio',
    titulo: 'Confira e baixe',
    texto: 'Do lado aparecem a prévia do PDF, a cor do currículo (dá pra trocar), a nota de aderência com o que falta e uma estimativa de quanto pedir de salário. Clique em "Baixar PDF" e escolha "Salvar como PDF".',
  },
  {
    alvo: 'realizados',
    titulo: 'Acompanhe suas candidaturas',
    texto: 'Em "Currículos realizados" ficam todos os currículos que você gerou. Marque o status de cada um: enviado, entrevista, recusado…',
  },
  {
    alvo: 'perfil',
    titulo: 'Pronto! 🎉',
    texto: 'No Perfil você troca a senha, baixa uma cópia do seu currículo mestre e pode rever este tutorial quando quiser.',
  },
]

type Props = {
  /** Muda de tela e destaca o item do menu do passo atual. */
  aoMostrar: (alvo: Alvo | null) => void
  /** Fecha. `irPara` = tela pra abrir no fim (o botão "Começar"). */
  aoFechar: (irPara?: Alvo) => void
}

export function Tutorial({ aoMostrar, aoFechar }: Props) {
  const [i, setI] = useState(0)
  const passo = PASSOS[i]
  const ultimo = i === PASSOS.length - 1
  const principal = useRef<HTMLButtonElement>(null)

  useEffect(() => { aoMostrar(passo.alvo ?? null) }, [passo, aoMostrar])
  useEffect(() => { principal.current?.focus() }, [i])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') aoFechar() }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aoFechar])

  return (
    <div className="tutorial-fundo">
      <div className="tutorial" role="dialog" aria-modal="true" aria-labelledby="tutorial-titulo" aria-describedby="tutorial-texto">
        <p className="tutorial-passo">Passo {i + 1} de {PASSOS.length}</p>
        <h2 id="tutorial-titulo">{passo.titulo}</h2>
        <p id="tutorial-texto">{passo.texto}</p>
        <div className="tutorial-pontos" aria-hidden="true">
          {PASSOS.map((p, j) => <span key={p.titulo} className={j === i ? 'atual' : ''} />)}
        </div>
        <div className="tutorial-botoes">
          {!ultimo && <button type="button" className="link-botao" onClick={() => aoFechar()}>Pular tutorial</button>}
          <span style={{ flex: 1 }} />
          {i > 0 && <button type="button" className="botao leve" onClick={() => setI(i - 1)}>Voltar</button>}
          {ultimo ? (
            <button ref={principal} type="button" className="botao brilho" onClick={() => aoFechar('mestre')}>Começar pelo currículo mestre</button>
          ) : (
            <button ref={principal} type="button" className="botao" onClick={() => setI(i + 1)}>Próximo</button>
          )}
        </div>
      </div>
    </div>
  )
}
