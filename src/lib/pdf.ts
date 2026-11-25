// Faz o currículo caber em 1 folha A4.
// Desenha numa "folha" invisível, mede a altura e, se passar, vai enxugando:
// letra 4% menor → 3 projetos → sem experiência "opcional" → menos bullets → letra menor.

import type { CurriculoMontado } from './tipos'
import { A4, montarHtml } from './curriculoHtml'

function medirAltura(html: string): Promise<number> {
  return new Promise((resolver) => {
    const folha = document.createElement('iframe')
    folha.setAttribute('aria-hidden', 'true')
    folha.tabIndex = -1
    // altura mínima de propósito: o scrollHeight nunca é menor que a altura da janela,
    // então uma janela baixinha faz ele medir só o conteúdo
    folha.style.cssText = `position:fixed;left:-10000px;top:0;width:${A4.largura}px;height:10px;border:0;visibility:hidden`
    folha.onload = () => {
      const altura = folha.contentDocument?.documentElement.scrollHeight ?? 0
      folha.remove()
      resolver(altura)
    }
    folha.srcdoc = html
    document.body.appendChild(folha)
  })
}

export type Ajustado = { html: string; ajuste: string; paginas: number }

export async function ajustarParaUmaPagina(cv: CurriculoMontado, cor?: string): Promise<Ajustado> {
  const tres = { ...cv, projetos: cv.projetos.slice(0, 3) }
  const semOpcional = { ...tres, experiencias: tres.experiencias.filter((e) => !e.opcional) }
  const enxuto = {
    ...semOpcional,
    projetos: semOpcional.projetos.map((p) => ({ ...p, destaques: p.destaques.slice(0, 2) })),
    // a 1ª experiência fica inteira; as outras ficam com 1 bullet
    experiencias: semOpcional.experiencias.map((e, i) => ({ ...e, bullets: i === 0 ? e.bullets : e.bullets.slice(0, 1) })),
  }
  const tentativas: [CurriculoMontado, number, string][] = [
    [cv, 1, ''],
    [cv, 0.96, 'letra um pouco menor'],
    [tres, 1, 'ficaram 3 projetos'],
    [tres, 0.96, 'ficaram 3 projetos, letra um pouco menor'],
    [semOpcional, 1, 'ficaram 3 projetos e saiu a experiência marcada como opcional'],
    [semOpcional, 0.96, 'sem a experiência opcional e letra um pouco menor'],
    [enxuto, 1, 'versão enxuta (menos bullets)'],
    [enxuto, 0.94, 'versão enxuta com letra um pouco menor'],
    [enxuto, 0.88, 'versão enxuta com letra menor'],
  ]

  let ultimo: Ajustado = { html: '', ajuste: '', paginas: 1 }
  for (const [versao, zoom, ajuste] of tentativas) {
    const html = montarHtml(versao, zoom, cor)
    const altura = await medirAltura(html)
    ultimo = { html, ajuste, paginas: Math.ceil(altura / A4.altura) }
    if (altura <= A4.altura - 8) return ultimo // 8px de folga pra diferença entre tela e impressão
  }
  return ultimo
}

/** Abre a janela de impressão do navegador. Lá a pessoa escolhe "Salvar como PDF". */
export function imprimir(folha: HTMLIFrameElement, nomeArquivo: string) {
  const janela = folha.contentWindow
  if (!janela) return
  // O Chrome sugere o nome do arquivo a partir do título da página.
  const tituloOriginal = document.title
  document.title = nomeArquivo
  if (folha.contentDocument) folha.contentDocument.title = nomeArquivo
  janela.focus()
  janela.print()
  setTimeout(() => (document.title = tituloOriginal), 1000)
}
