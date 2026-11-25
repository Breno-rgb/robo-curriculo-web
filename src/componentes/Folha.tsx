// Tudo que mostra o currículo como folha A4: a prévia pequena e o "Visualizar" em tela cheia.
import { useEffect, useRef, useState, type RefObject } from 'react'
import type { CurriculoMontado } from '../lib/tipos'
import { A4 } from '../lib/curriculoHtml'
import { ajustarParaUmaPagina, imprimir, type Ajustado } from '../lib/pdf'

/** Monta o HTML que cabe em 1 página sempre que o currículo muda. */
export function useCurriculoPronto(curriculo: CurriculoMontado | null, cor?: string) {
  const [pronto, setPronto] = useState<Ajustado | null>(null)
  const anterior = useRef<CurriculoMontado | null>(null)
  useEffect(() => {
    let ativo = true
    // Currículo novo: limpa a folha. Só trocou a cor: mantém a folha atual até a nova ficar pronta.
    if (curriculo !== anterior.current) setPronto(null)
    anterior.current = curriculo
    if (curriculo) ajustarParaUmaPagina(curriculo, cor).then((r) => ativo && setPronto(r))
    return () => { ativo = false }
  }, [curriculo, cor])
  return pronto
}

type FolhaProps = {
  html: string | null
  folhaRef?: RefObject<HTMLIFrameElement | null>
  /** Largura máxima em px (no visualizador ela pode crescer até o tamanho real). */
  larguraMax?: number
  vazio?: string
}

/** Uma folha A4 que encolhe pra caber na largura de onde ela está. */
export function FolhaA4({ html, folhaRef, larguraMax = A4.largura, vazio = 'O PDF aparece aqui.' }: FolhaProps) {
  const moldura = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(0.5)

  // A moldura ocupa a largura disponível (com a proporção de uma A4) e a folha encolhe pra caber nela.
  useEffect(() => {
    const el = moldura.current
    if (!el) return
    const obs = new ResizeObserver(([e]) => setEscala(e.contentRect.width / A4.largura))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div className="folha-moldura" ref={moldura} style={{ width: '100%', maxWidth: larguraMax, aspectRatio: `${A4.largura} / ${A4.altura}` }}>
      {html ? (
        <iframe ref={folhaRef} title="Prévia do currículo" srcDoc={html} width={A4.largura} height={A4.altura} style={{ transform: `scale(${escala})` }} />
      ) : (
        <div className="folha-vazia"><img src="/icone.svg" alt="" />{vazio}</div>
      )}
    </div>
  )
}

type VisualizadorProps = { html: string; titulo: string; nomeArquivo: string; aoFechar: () => void }

/** O currículo em tela cheia, com botão de baixar. Fecha no Esc ou no X. */
export function Visualizador({ html, titulo, nomeArquivo, aoFechar }: VisualizadorProps) {
  const folha = useRef<HTMLIFrameElement>(null)
  const fechar = useRef<HTMLButtonElement>(null)
  const aoFecharRef = useRef(aoFechar)
  aoFecharRef.current = aoFechar

  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null
    fechar.current?.focus()
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFecharRef.current()
    document.addEventListener('keydown', tecla)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', tecla)
      document.body.style.overflow = ''
      antes?.focus() // devolve o foco pro botão que abriu
    }
  }, [])

  return (
    <div className="visualizador" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="visualizador-topo">
        <strong>{titulo}</strong>
        <button className="botao" onClick={() => folha.current && imprimir(folha.current, nomeArquivo)}>Baixar PDF</button>
        <button className="botao leve" ref={fechar} onClick={aoFechar} aria-label="Fechar">✕</button>
      </div>
      <div className="visualizador-corpo" onClick={(e) => e.target === e.currentTarget && aoFechar()}>
        <div style={{ width: '100%', maxWidth: A4.largura }}>
          <FolhaA4 html={html} folhaRef={folha} />
        </div>
      </div>
    </div>
  )
}
