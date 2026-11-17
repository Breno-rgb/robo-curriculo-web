// Desenha o currículo em HTML (fundo branco, detalhes laranja).
// Coluna única e texto de verdade: é o formato que os sistemas de triagem (ATS) leem melhor.
// Na tela ele aparece como uma folha A4; na impressão ("Salvar como PDF") vira o PDF.

import type { CurriculoMontado } from './tipos'

const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function link(texto: string) {
  if (!texto) return ''
  if (texto.includes('@')) return `<a href="mailto:${esc(texto)}">${esc(texto)}</a>`
  const semProtocolo = texto.replace(/^https?:\/\//, '')
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(semProtocolo)) return `<a href="https://${esc(semProtocolo)}">${esc(semProtocolo)}</a>`
  return esc(texto)
}

// A4 a 96 dpi = 794 × 1123 px. As margens ficam como "padding" na tela e como margem da página na impressão.
export const A4 = { largura: 794, altura: 1123 }

export function montarHtml(cv: CurriculoMontado, zoom = 1) {
  const c = cv.contatos
  const contatos = [c.cidade, c.telefone, c.email, c.linkedin, c.github, c.portfolio]
    .filter(Boolean).map((x) => `<span class="ct">${link(x)}</span>`).join('')
  const pedidas = new Set(cv.destaques_vaga)

  const grupos = cv.grupos
    .map((g) => `<div class="grupo"><span class="grupo-nome">${esc(g.nome)}:</span> ${g.itens
      .map((i) => (pedidas.has(i) ? `<strong>${esc(i)}</strong>` : esc(i))).join(' · ')}</div>`)
    .join('')

  const projetos = cv.projetos
    .map((p) => `
      <div class="item">
        <div class="item-topo">
          <strong>${esc(p.nome)}</strong>
          <span class="periodo">${[p.link && link(p.link), p.codigo && `código: ${link(p.codigo)}`].filter(Boolean).join(' · ')}</span>
        </div>
        ${p.stack.length ? `<div class="local">${esc(p.stack.join(' · '))}</div>` : ''}
        ${p.descricao ? `<p>${esc(p.descricao)}</p>` : ''}
        ${p.destaques.length ? `<ul>${p.destaques.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
      </div>`)
    .join('')

  const experiencias = cv.experiencias
    .map((e) => `
      <div class="item">
        <div class="item-topo"><strong>${esc(e.cargo)}</strong><span class="periodo">${esc(e.periodo)}</span></div>
        ${e.local ? `<div class="local">${esc(e.local)}</div>` : ''}
        ${e.bullets.length ? `<ul>${e.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
      </div>`)
    .join('')

  const formacao = cv.formacao
    .map((f) => `
      <div class="item curto">
        <div class="item-topo">
          <span><strong>${esc(f.curso)}</strong>${f.instituicao ? `<span class="local"> · ${esc(f.instituicao)}</span>` : ''}</span>
          <span class="periodo">${esc(f.periodo)}</span>
        </div>
      </div>`)
    .join('')

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Curriculo - ${esc(cv.nome)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { background: #fff; }
  body {
    width: ${A4.largura}px; padding: 13mm 15mm; zoom: ${zoom};
    font-family: Arial, Helvetica, sans-serif; color: #1e293b; font-size: 9.4pt; line-height: 1.38; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  @media print { body { width: auto; } }
  a { color: inherit; text-decoration: none; }
  header { border-bottom: 2px solid #f97316; padding-bottom: 8px; margin-bottom: 11px; }
  h1 { font-size: 20pt; letter-spacing: -0.3px; color: #0f172a; }
  .titulo { color: #ea580c; font-size: 11pt; font-weight: bold; margin-top: 1px; }
  .contatos { display: flex; flex-wrap: wrap; column-gap: 14px; row-gap: 1px; color: #475569; font-size: 8.6pt; margin-top: 6px; }
  .ct { white-space: nowrap; }
  .ct + .ct::before { content: '·'; color: #f97316; margin-left: -9px; margin-right: 5px; }
  section { margin-bottom: 9px; }
  h2 { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.08em; color: #ea580c; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 6px; }
  p, li, .grupo { color: #334155; }
  .grupo { margin-bottom: 2px; }
  .grupo-nome, .grupo strong, .item-topo strong { color: #0f172a; font-weight: bold; }
  .item { margin-bottom: 6px; break-inside: avoid; }
  .item.curto { margin-bottom: 3px; }
  .item-topo { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  .periodo { color: #64748b; font-size: 8.4pt; white-space: nowrap; }
  .local { color: #64748b; font-size: 8.6pt; }
  ul { margin: 2px 0 0 15px; }
  li { margin-bottom: 1px; }
</style></head>
<body>
  <header>
    <h1>${esc(cv.nome)}</h1>
    ${cv.titulo ? `<div class="titulo">${esc(cv.titulo)}</div>` : ''}
    <div class="contatos">${contatos}</div>
  </header>
  ${cv.resumo ? `<section><h2>Resumo</h2><p>${esc(cv.resumo)}</p></section>` : ''}
  ${grupos ? `<section><h2>Competências técnicas</h2>${grupos}</section>` : ''}
  ${projetos ? `<section><h2>Projetos</h2>${projetos}</section>` : ''}
  ${experiencias ? `<section><h2>Experiência</h2>${experiencias}</section>` : ''}
  ${formacao ? `<section><h2>Formação</h2>${formacao}</section>` : ''}
  ${cv.comportamentais.length ? `<section><h2>Competências comportamentais</h2><p>${esc(cv.comportamentais.join(' · '))}</p></section>` : ''}
  ${cv.idiomas.length ? `<section><h2>Idiomas</h2><p>${esc(cv.idiomas.join(' · '))}</p></section>` : ''}
</body></html>`
}
