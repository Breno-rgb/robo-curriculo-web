// Currículo vazio, um exemplo fictício e a conversão do JSON do robô de terminal.

import type { Mestre } from './tipos'

export const novoId = () => crypto.randomUUID().slice(0, 8)

export function mestreVazio(): Mestre {
  return {
    nome: '',
    titulo_padrao: '',
    titulos: { front: '', full: '', back: '', estagio: '' },
    contatos: { cidade: '', telefone: '', email: '', linkedin: '', github: '', portfolio: '' },
    resumo_base: '',
    grupos: [
      { id: novoId(), nome: 'Front-end', itens: [] },
      { id: novoId(), nome: 'Back-end e dados', itens: [] },
      { id: novoId(), nome: 'Ferramentas', itens: [] },
    ],
    comportamentais: [],
    experiencias: [],
    projetos: [],
    formacao: [],
    idiomas: [],
  }
}

/** Pessoa fictícia, só pra ver o robô funcionando antes de preencher o seu. */
export function mestreExemplo(): Mestre {
  return {
    nome: 'Ana Exemplo',
    titulo_padrao: 'Desenvolvedora Web · Estudante de ADS',
    titulos: { front: 'Desenvolvedora Front-end · Estudante de ADS', full: 'Desenvolvedora Full-stack · Estudante de ADS', back: '', estagio: 'Estudante de ADS · Desenvolvedora Web' },
    contatos: { cidade: 'São Paulo – SP', telefone: '(11) 90000-0000', email: 'ana@exemplo.com', linkedin: 'linkedin.com/in/ana-exemplo', github: 'github.com/ana-exemplo', portfolio: 'ana-exemplo.github.io' },
    resumo_base: 'Estudante de Análise e Desenvolvimento de Sistemas. Desenvolvo aplicações web com React e TypeScript, com atenção a acessibilidade e boas práticas.',
    grupos: [
      { id: novoId(), nome: 'Front-end', itens: ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'React', 'Responsividade', 'Acessibilidade'] },
      { id: novoId(), nome: 'Back-end e dados', itens: ['Node.js', 'APIs REST', 'SQL', 'Supabase'] },
      { id: novoId(), nome: 'Ferramentas', itens: ['Git', 'GitHub', 'Vercel'] },
    ],
    comportamentais: ['Comunicação', 'Trabalho em equipe', 'Organização'],
    experiencias: [
      { id: novoId(), cargo: 'Desenvolvedora Web Freelancer', local: 'Pequenos negócios', periodo: '2025 – atual', opcional: false,
        bullets: ['Criei e publiquei sites responsivos para 3 clientes, do layout ao domínio.', 'Integrei formulários de contato com Supabase.'] },
      { id: novoId(), cargo: 'Atendente', local: 'Loja de Roupas', periodo: '2022 – 2024', opcional: true,
        bullets: ['Atendimento ao cliente e organização de estoque.'] },
    ],
    projetos: [
      { id: novoId(), nome: 'Loja Virtual', link: 'ana-exemplo.github.io/loja', codigo: 'github.com/ana-exemplo/loja', fixo: true,
        stack: ['React', 'TypeScript', 'Supabase'], descricao: 'Loja com catálogo, carrinho e login, com dados no Supabase.',
        destaques: ['Carrinho salvo por usuário com regras de segurança (RLS).'], palavras: ['e-commerce', 'carrinho', 'login'] },
      { id: novoId(), nome: 'Lista de Tarefas', link: 'ana-exemplo.github.io/tarefas', codigo: '', fixo: false,
        stack: ['JavaScript', 'HTML', 'CSS'], descricao: 'App de tarefas com filtros e dados salvos no navegador.', destaques: [], palavras: ['crud'] },
    ],
    formacao: [{ id: novoId(), curso: 'Análise e Desenvolvimento de Sistemas', instituicao: 'Faculdade Exemplo', periodo: '2025 – 2027 (previsão)' }],
    idiomas: ['Português — nativo', 'Inglês — intermediário'],
  }
}

// ---------- importar o curriculo-mestre.json do robô de terminal ----------

const texto = (v: unknown) => (typeof v === 'string' && !v.includes('PREENCHER') ? v : '')
const lista = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !x.includes('PREENCHER')) : [])

type Bruto = Record<string, any>

/** Aceita o JSON deste site (exportado) ou o curriculo-mestre.json do robô de terminal. */
export function importarMestre(json: string): Mestre {
  const d: Bruto = JSON.parse(json)
  if (!d || typeof d !== 'object' || typeof d.nome !== 'string') throw new Error('Esse arquivo não parece um currículo-mestre.')

  // Já está no formato deste site.
  if (Array.isArray(d.grupos)) return { ...mestreVazio(), ...d } as Mestre

  // Formato do robô de terminal.
  const base = mestreVazio()
  const titulos = { ...base.titulos }
  for (const t of Array.isArray(d.titulos) ? d.titulos : []) {
    const q = lista(t.quando).join(' ')
    if (/estagi/.test(q)) titulos.estagio = texto(t.titulo)
    else if (/full/.test(q)) titulos.full = texto(t.titulo)
    else if (/back/.test(q)) titulos.back = texto(t.titulo)
    else if (/front|react/.test(q)) titulos.front = texto(t.titulo)
  }

  const competencias = lista(d.competencias)
  const grupos = d.grupos_competencias && typeof d.grupos_competencias === 'object'
    ? Object.entries(d.grupos_competencias as Record<string, unknown>).map(([nome, itens]) => ({ id: novoId(), nome, itens: lista(itens) }))
    : []
  const agrupadas = new Set(grupos.flatMap((g) => g.itens))
  const soltas = competencias.filter((c) => !agrupadas.has(c))
  if (soltas.length) grupos.push({ id: novoId(), nome: grupos.length ? 'Outras' : 'Competências', itens: soltas })

  return {
    nome: d.nome,
    titulo_padrao: texto(d.titulo_padrao),
    titulos,
    contatos: { ...base.contatos, ...Object.fromEntries(Object.entries(d.contatos || {}).map(([k, v]) => [k, texto(v)])) },
    resumo_base: texto(d.resumo_base),
    grupos: grupos.length ? grupos : base.grupos,
    comportamentais: lista(d.competencias_comportamentais),
    experiencias: (d.experiencias || []).map((e: Bruto) => ({
      id: novoId(), cargo: texto(e.cargo), local: texto(e.local), periodo: texto(e.periodo), bullets: lista(e.bullets), opcional: Boolean(e.opcional),
    })),
    projetos: (d.projetos || []).map((p: Bruto) => ({
      id: novoId(), nome: texto(p.nome), link: texto(p.link), codigo: texto(p.codigo), stack: lista(p.stack), descricao: texto(p.descricao),
      destaques: lista(p.destaques), palavras: lista(p.palavras), fixo: Boolean(p.fixo),
    })),
    formacao: (d.formacao || []).map((f: Bruto) => ({ id: novoId(), curso: texto(f.curso), instituicao: texto(f.instituicao), periodo: texto(f.periodo) })),
    idiomas: lista(d.idiomas),
  }
}

export const todasCompetencias = (m: Mestre) => [...new Set(m.grupos.flatMap((g) => g.itens))]

/** O mínimo pra gerar um currículo que faça sentido. */
export function oQueFalta(m: Mestre): string[] {
  const falta: string[] = []
  if (!m.nome.trim()) falta.push('seu nome')
  if (!m.contatos.email.trim() && !m.contatos.telefone.trim()) falta.push('um contato (e-mail ou telefone)')
  if (!m.resumo_base.trim()) falta.push('o resumo')
  if (todasCompetencias(m).length < 3) falta.push('pelo menos 3 competências')
  if (!m.projetos.length && !m.experiencias.length) falta.push('pelo menos 1 projeto ou experiência')
  return falta
}
