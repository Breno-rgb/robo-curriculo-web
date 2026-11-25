// "Importar currículo em PDF": lê o texto do PDF e tenta preencher o currículo mestre sozinho.
// Não usa IA: procura títulos de seção (Experiência, Formação...), e-mail, telefone, links e
// tecnologias conhecidas. A pessoa sempre confere depois, porque cada currículo é de um jeito.

import type { Experiencia, Formacao, GrupoDeCompetencias, Mestre, Projeto } from './tipos'
import { mestreVazio, normalizarMestre, novoId } from './mestre'
import { dados } from './dados'
import { competenciasNoTexto, grupoDe, norm } from './analise'

// ---------- 1) PDF → linhas de texto ----------

type Pedaco = { x: number; y: number; fim: number; texto: string }

export async function textoDoPdf(arquivo: File): Promise<string[]> {
  // pdf.js é grande, então só carrega quando a pessoa usa o botão.
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default

  const doc = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise
  const linhas: string[] = []

  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n)
    const largura = pagina.getViewport({ scale: 1 }).width
    const conteudo = await pagina.getTextContent()

    // Junta os pedaços que estão na mesma altura (mesma linha).
    const porLinha = new Map<number, Pedaco[]>()
    for (const item of conteudo.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const [, , , , x, y] = item.transform as number[]
      const chave = [...porLinha.keys()].find((k) => Math.abs(k - y) < 2.5) ?? y
      const lista = porLinha.get(chave) ?? []
      lista.push({ x, y, fim: x + item.width, texto: item.str })
      porLinha.set(chave, lista)
    }

    // Dentro de cada linha, um buraco grande separa colunas (currículo com barra lateral).
    const segmentos: Pedaco[] = []
    for (const pedacos of porLinha.values()) {
      pedacos.sort((a, b) => a.x - b.x)
      let atual: Pedaco | null = null
      for (const p of pedacos) {
        const buraco = atual ? p.x - atual.fim : 0
        if (!atual || buraco > 40) {
          if (atual) segmentos.push(atual)
          atual = { ...p }
        } else {
          atual.texto += (buraco > 1 && !atual.texto.endsWith(' ') && !p.texto.startsWith(' ') ? ' ' : '') + p.texto
          atual.fim = p.fim
        }
      }
      if (atual) segmentos.push(atual)
    }

    // Se tiver duas colunas, lê a da esquerda inteira e depois a da direita.
    const direita = segmentos.filter((s) => s.x > largura * 0.3)
    const temColunas = direita.length > segmentos.length * 0.25 && direita.length < segmentos.length * 0.9
    const corte = temColunas ? Math.min(...direita.map((s) => s.x)) - 1 : Infinity
    segmentos.sort((a, b) => Number(a.x >= corte) - Number(b.x >= corte) || b.y - a.y || a.x - b.x)
    linhas.push(...segmentos.map((s) => s.texto.replace(/\s+/g, ' ').trim()).filter(Boolean))
  }
  return linhas
}

// ---------- 2) linhas → currículo mestre ----------

type Secao = 'topo' | 'resumo' | 'competencias' | 'comportamentais' | 'experiencias' | 'projetos' | 'formacao' | 'idiomas' | 'ignorar'

const TITULOS: [Secao, RegExp][] = [
  ['comportamentais', /^(competencias|habilidades) comportamentais$|^soft skills$/],
  ['competencias', /^(competencias|habilidades)( tecnicas)?$|^(hard )?skills$|^tecnologias$|^conhecimentos( tecnicos)?$|^ferramentas$|^stack$/],
  ['resumo', /^(resumo|sobre( mim)?|perfil( profissional)?|objetivo( profissional)?|summary|about( me)?|apresentacao)$/],
  ['experiencias', /^(experiencias?|experiencia profissional|experiencias profissionais|historico profissional|experience|work experience|experiencia voluntaria|voluntariado|atividades extracurriculares)$/],
  ['projetos', /^(projetos( pessoais)?|projects|portfolio)$/],
  ['formacao', /^(formacao( academica)?|educacao|escolaridade|education|cursos( complementares)?|certificacoes|certificados|formacao complementar)$/],
  ['idiomas', /^(idiomas|linguas|languages)$/],
  ['ignorar', /^(referencias|informacoes adicionais|contato|contatos|links)$/],
]

function secaoDoTitulo(linha: string): Secao | null {
  const t = norm(linha).replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim()
  if (!t || t.length > 40) return null
  return TITULOS.find(([, re]) => re.test(t))?.[0] ?? null
}

const BULLET = /^[•●▪◦‣\-–—*·]\s*/
const PERIODO = /((jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?\s*\/?\s*)?(\d{2}\/)?\d{4}\s*(?:[-–—]|a|até|ate)\s*((jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?\s*\/?\s*)?((\d{2}\/)?\d{4}|atual|presente|hoje|o momento|current|present)(\s*\(previs[aã]o\))?|((conclu[ií]do|previs[aã]o|desde)\s*(em\s*)?)?((jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?\s*\/?\s*)?(\d{2}\/)?\d{4}/i
const URL_RE = /(https?:\/\/)?(www\.)?[\w-]+(\.[\w-]+)+(\/[\w\-./?=#%&]*)?/gi
const SEPARA = /\s+[|·•–—-]\s+|\s*,\s+(?=[A-ZÀ-Ú])/

const limpa = (s: string) => s.replace(BULLET, '').replace(/\s+/g, ' ').trim()
const dividirLista = (linhas: string[]) =>
  linhas.flatMap((l) => limpa(l).split(/\s*[,;|·•]\s*|\s+-\s+/)).map((s) => s.replace(/^[^:]{2,30}:\s*/, '').trim()).filter((s) => s && s.length <= 40)

function tirarPeriodo(linha: string) {
  const m = linha.match(PERIODO)
  if (!m) return { periodo: '', resto: linha }
  return { periodo: m[0].trim(), resto: linha.replace(m[0], ' ').replace(/[\s|·•,–—-]+$|^[\s|·•,–—-]+/g, '').replace(/\(\s*\)/, '').trim() }
}

function lerExperiencias(linhas: string[]): Experiencia[] {
  const lista: Experiencia[] = []
  let atual: Experiencia | null = null
  const nova = () => { atual = { id: novoId(), cargo: '', local: '', periodo: '', bullets: [], opcional: false }; lista.push(atual) }

  for (const bruta of linhas) {
    const ehBullet = BULLET.test(bruta)
    const linha = limpa(bruta)
    if (!linha) continue
    // Frase que termina com ponto ou é comprida = algo que a pessoa fez (bullet), não um cargo.
    if (ehBullet || (atual && (linha.length > 70 || /[.;]$/.test(linha)))) {
      if (!atual) nova()
      atual!.bullets.push(linha)
      continue
    }
    const { periodo, resto } = tirarPeriodo(linha)
    const a = atual as Experiencia | null
    if (!a || a.bullets.length || (a.cargo && a.local && resto) || (a.periodo && periodo)) nova()
    const e = atual! as Experiencia
    if (periodo && !e.periodo) e.periodo = periodo
    if (!resto) continue
    if (!e.cargo) {
      const [cargo, ...local] = resto.split(SEPARA)
      e.cargo = cargo.trim()
      if (local.length) e.local = local.join(' · ').trim()
    } else if (!e.local) e.local = resto
    else e.bullets.push(resto)
  }
  return lista.filter((e) => e.cargo || e.bullets.length)
}

function lerProjetos(linhas: string[]): Projeto[] {
  const lista: Projeto[] = []
  let atual: Projeto | null = null
  const nova = (nome: string) => { atual = { id: novoId(), nome, link: '', codigo: '', stack: [], descricao: '', destaques: [], palavras: [], fixo: false }; lista.push(atual) }

  for (const bruta of linhas) {
    const ehBullet = BULLET.test(bruta)
    let linha = limpa(bruta)
    if (!linha) continue
    const urls = (linha.match(URL_RE) ?? []).filter((u) => /\.[a-z]{2,}/i.test(u) && !/^\d/.test(u))
    const p = atual as Projeto | null
    for (const u of urls) {
      const limpo = u.replace(/^https?:\/\//, '').replace(/^www\./, '')
      if (!p) break
      if (/github\.com\/[^/]+\/[^/]+/.test(limpo) && !p.codigo) p.codigo = limpo
      else if (!p.link) p.link = limpo
      linha = linha.replace(u, '')
    }
    linha = linha.replace(/\b(c[oó]digo|site|link|demo)\s*:?\s*$/i, '').replace(/[\s|·•–—:-]+$/g, '').trim()
    if (!linha) continue

    const stackLinha = linha.match(/^(tecnologias|stack|ferramentas|tech)\s*:\s*(.+)$/i)
    if (p && stackLinha) { p.stack.push(...dividirLista([stackLinha[2]])); continue }
    const techs = competenciasNoTexto(linha)
    const pareceStack = p && techs.length >= 2 && linha.split(/[·,|]/).length >= 2 && linha.length < 90 && !/[.!]$/.test(linha)
    if (pareceStack) { p!.stack.push(...dividirLista([linha])); continue }

    if (ehBullet && p) { p.destaques.push(linha); continue }
    const curta = linha.length <= 60 && !/[.]$/.test(linha)
    if (!p || (curta && (p.descricao || p.destaques.length))) { nova(linha.split(SEPARA)[0]); continue }
    if (!p.descricao) p.descricao = linha
    else if (p.descricao.length < 220 && !ehBullet) p.descricao += ' ' + linha
    else p.destaques.push(linha)
  }
  return lista.filter((x) => x.nome)
}

const INSTITUICAO = /(universidade|faculdade|fatec|etec|senac|senai|instituto|escola|centro universit|col[eé]gio|puc|usp|unesp|unicamp|fam\b|trybe|alura|rocketseat|dio\b|udemy|coursera)/i

function lerFormacao(linhas: string[]): Formacao[] {
  const lista: Formacao[] = []
  for (const bruta of linhas) {
    const linha = limpa(bruta)
    if (!linha) continue
    const { periodo, resto } = tirarPeriodo(linha)
    const ultima = lista.at(-1)
    if (!resto && periodo && ultima && !ultima.periodo) { ultima.periodo = periodo; continue }
    const partes = resto.split(SEPARA).map((s) => s.trim()).filter(Boolean)
    if (partes.length === 1 && INSTITUICAO.test(partes[0]) && ultima && !ultima.instituicao) {
      ultima.instituicao = partes[0]
      if (periodo && !ultima.periodo) ultima.periodo = periodo
      continue
    }
    if (!partes.length) continue
    const [curso, ...inst] = INSTITUICAO.test(partes[0]) && partes[1] ? [partes[1], partes[0], ...partes.slice(2)] : partes
    lista.push({ id: novoId(), curso, instituicao: inst.join(' · '), periodo })
  }
  return lista
}

export function lerCurriculo(linhas: string[]): Mestre {
  const m = mestreVazio()
  const tudo = linhas.join('\n')

  // Contatos: procurados no texto inteiro.
  m.contatos.email = tudo.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0] ?? ''
  m.contatos.telefone = tudo.match(/(\+?55\s?)?\(?\d{2}\)?\s?9?\s?\d{4}[-\s]?\d{4}/)?.[0]?.trim() ?? ''
  m.contatos.linkedin = tudo.match(/linkedin\.com\/in\/[\w%-]+/i)?.[0] ?? ''
  m.contatos.github = tudo.match(/github\.com\/[\w-]+(?![\w/-])/i)?.[0] ?? ''
  m.contatos.portfolio = (tudo.match(/[\w-]+\.github\.io(\/[\w-]+)?|[\w-]+\.vercel\.app|[\w-]+\.netlify\.app/i) ?? [''])[0]
  m.contatos.cidade = tudo.match(/[A-ZÀ-Ú][a-zà-ú]+(?: (?:d[aeo]s? )?[A-ZÀ-Ú][a-zà-ú]+)* ?[-–/] ?(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/)?.[0] ?? ''

  // Separa as linhas por seção.
  const secoes: Record<Secao, string[]> = { topo: [], resumo: [], competencias: [], comportamentais: [], experiencias: [], projetos: [], formacao: [], idiomas: [], ignorar: [] }
  let atual: Secao = 'topo'
  for (const linha of linhas) {
    const s = secaoDoTitulo(linha)
    if (s) { atual = s; continue }
    secoes[atual].push(linha)
  }

  // Nome e título: primeiras linhas do topo que não são contato.
  const ehContato = (l: string) => /@|\d{4}|linkedin|github|https?:|www\.|\.com|\.br|\.io|\.app/i.test(l) || l === m.contatos.cidade
  const topo = secoes.topo.filter((l) => !ehContato(l))
  const nome = topo.find((l) => /^[A-Za-zÀ-ÿ'.\s]{5,60}$/.test(l) && l.trim().split(/\s+/).length >= 2 && l.trim().split(/\s+/).length <= 6)
  m.nome = nome?.replace(/\s+/g, ' ').trim() ?? ''
  const depoisDoNome = topo.slice(topo.indexOf(nome ?? '') + 1).find((l) => l.length <= 80)
  m.titulo_padrao = nome && depoisDoNome ? depoisDoNome.replace(/\s+/g, ' ').trim() : ''
  // Texto longo no topo sem título "Resumo" costuma ser o resumo.
  const longoNoTopo = topo.filter((l) => l.length > 80)
  m.resumo_base = [...secoes.resumo, ...(secoes.resumo.length ? [] : longoNoTopo)].map(limpa).join(' ').replace(/\s+/g, ' ').trim()

  // Competências: as da seção + as tecnologias conhecidas citadas em qualquer lugar.
  const daSecao = dividirLista(secoes.competencias)
  const conhecidas = competenciasNoTexto(tudo)
  // "ReactJS" na seção vira "React" (nome do catálogo) pra não repetir.
  const canonico = (c: string) => {
    const achados = competenciasNoTexto(c)
    return achados.length === 1 && c.split(/\s+/).length <= 3 ? achados[0] : c
  }
  const todas: string[] = []
  for (const c of [...daSecao.map(canonico), ...conhecidas]) {
    if (!todas.some((x) => norm(x) === norm(c))) todas.push(c)
  }
  const grupos = new Map<string, string[]>()
  for (const c of todas) {
    const g = grupoDe(c)
    grupos.set(g, [...(grupos.get(g) ?? []), c])
  }
  const ordem = ['Front-end', 'Back-end e dados', 'Testes e qualidade', 'Ferramentas e deploy', 'Outras']
  m.grupos = ordem.filter((g) => grupos.has(g)).map((g): GrupoDeCompetencias => ({ id: novoId(), nome: g, itens: grupos.get(g)! }))
  if (!m.grupos.length) m.grupos = mestreVazio().grupos

  m.comportamentais = dividirLista(secoes.comportamentais)
  m.idiomas = secoes.idiomas.flatMap((l) => limpa(l).split(/\s*[;|·•]\s*/)).filter((s) => s && s.length <= 50)
  m.experiencias = lerExperiencias(secoes.experiencias)
  m.projetos = lerProjetos(secoes.projetos)
  if (m.projetos[0]) m.projetos[0].fixo = true
  m.formacao = lerFormacao(secoes.formacao)
  return m
}

/** Quantas partes foram preenchidas (pra mensagem depois de importar). */
export function resumoDoImport(m: Mestre) {
  const partes = [
    m.nome && 'nome',
    (m.contatos.email || m.contatos.telefone) && 'contatos',
    m.resumo_base && 'resumo',
    m.grupos.some((g) => g.itens.length) && `${m.grupos.reduce((s, g) => s + g.itens.length, 0)} competências`,
    m.experiencias.length && `${m.experiencias.length} experiência(s)`,
    m.projetos.length && `${m.projetos.length} projeto(s)`,
    m.formacao.length && `${m.formacao.length} formação(ões)`,
    m.idiomas.length && 'idiomas',
  ].filter(Boolean)
  return partes.join(', ')
}

// ---------- 3) leitura com IA (mais precisa) ----------

/**
 * Manda o texto do PDF pra função do servidor (api/ler-curriculo.js), que pede pra IA
 * organizar tudo no formato do currículo mestre. Devolve null quando a IA não está
 * disponível (modo demonstração, rodando no PC ou sem chave configurada): aí o app
 * usa o leitor sem IA aqui de cima.
 */
export async function lerCurriculoComIA(linhas: string[]): Promise<Mestre | null> {
  const token = await dados.token()
  if (!token) return null
  let r: Response
  try {
    r = await fetch('/api/ler-curriculo', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ texto: linhas.join('\n') }),
    })
  } catch {
    return null // sem internet ou sem servidor
  }
  if (r.status === 404 || r.status === 501) return null
  const corpo = await r.json().catch(() => ({}))
  if (!r.ok || !corpo.curriculo) throw new Error(corpo.erro || 'Não consegui ler esse PDF agora.')
  return normalizarMestre(corpo.curriculo)
}
