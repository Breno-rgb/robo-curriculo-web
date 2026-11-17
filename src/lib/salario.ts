// "Quanto pedir?": uma ESTIMATIVA de salário pra vaga, pra servir de referência.
// 1) Se a vaga já diz o valor, usa o da vaga.
// 2) Se não diz, compara o cargo com tabelas de mercado (nov/2026).
// 3) Se o cargo não está nas tabelas, avisa em vez de chutar.
// Os números são médias de mercado: mudam com cidade, empresa e experiência.

import { norm } from './normalizar'

export type Estimativa = {
  tipo: 'informado' | 'estimado' | 'sem-referencia'
  /** Faixa em R$ por mês. */
  faixa?: { min: number; max: number }
  /** Quanto faz sentido pedir (meio da faixa, puxado pro nível da vaga). */
  sugestao?: number
  /** Linhas curtas explicando de onde veio. */
  detalhes: string[]
  fonte: string
  /** Pra pesquisar quando não há referência. */
  busca?: string
}

// ---------- tabela de tecnologia (Nerdin, valores 2026, por nível e regime) ----------
type Nivel = 'estagio' | 'junior' | 'pleno' | 'senior'
type AreaTI = 'front' | 'back' | 'full'
type Faixa = [number, number]

const TI: Record<AreaTI, Record<Exclude<Nivel, 'estagio'>, { clt: Faixa; pj: Faixa }>> = {
  front: { junior: { clt: [4500, 6500], pj: [6000, 9000] }, pleno: { clt: [6500, 9500], pj: [9000, 13000] }, senior: { clt: [9500, 14500], pj: [13000, 20000] } },
  back: { junior: { clt: [5000, 7000], pj: [6500, 10000] }, pleno: { clt: [7000, 10500], pj: [10000, 15000] }, senior: { clt: [10500, 16500], pj: [15000, 24000] } },
  full: { junior: { clt: [5500, 8000], pj: [7500, 11500] }, pleno: { clt: [8000, 12000], pj: [11500, 17000] }, senior: { clt: [12000, 18500], pj: [17000, 27000] } },
}
const ESTAGIO_TI: Faixa = [1200, 2200]
const FONTE_TI = 'Nerdin, tabela de cargos e salários TI 2026'

// ---------- outras profissões (Novo CAGED via salario.com.br, nov/2026: piso, média, teto em CLT) ----------
// [palavras que identificam o cargo, nome, piso, média, teto]
type Cargo = [string[], string, number, number, number]
const CARGOS: Cargo[] = [
  [['tecnico de enfermagem', 'tecnica de enfermagem', 'tec. enfermagem', 'tec enfermagem'], 'Técnico de Enfermagem', 2083, 2560, 3547],
  [['auxiliar de enfermagem'], 'Auxiliar de Enfermagem', 2083, 2400, 3200],
  [['enfermeiro', 'enfermeira'], 'Enfermeiro', 3684, 4493, 6650],
  [['assistente administrativo', 'assistente adm'], 'Assistente Administrativo', 2023, 2476, 3488],
  [['auxiliar administrativo', 'auxiliar de escritorio', 'aux. administrativo'], 'Auxiliar Administrativo', 1841, 2099, 2685],
  [['supervisor administrativo', 'coordenador administrativo'], 'Supervisor Administrativo', 2696, 4107, 7544],
  [['auxiliar de contabilidade', 'assistente contabil', 'auxiliar contabil'], 'Auxiliar de Contabilidade', 2194, 2646, 3800],
  [['recepcionista'], 'Recepcionista', 1730, 1908, 2300],
  [['assistente de vendas', 'assistente comercial'], 'Assistente de Vendas', 1868, 2239, 3000],
  [['promotor de vendas', 'promotora de vendas', 'promotor'], 'Promotor de Vendas', 1775, 1950, 2270],
  [['vendedor', 'vendedora', 'consultor de vendas', 'consultora de vendas'], 'Vendedor', 1768, 1958, 2298],
  [['operador de caixa', 'operadora de caixa'], 'Operador de Caixa', 1762, 1913, 2269],
  [['atendente de farmacia', 'balconista'], 'Atendente de Farmácia', 1778, 1919, 2320],
  [['atendente de lanchonete'], 'Atendente de Lanchonete', 1744, 1862, 2150],
  [['atendente de loja', 'atendente de mercado', 'atendente'], 'Atendente de Loja', 1769, 1885, 2172],
  [['telemarketing', 'operador de atendimento', 'sac', 'call center'], 'Operador de Telemarketing', 1621, 1676, 1826],
  [['repositor'], 'Repositor de Mercadorias', 1783, 1889, 2155],
  [['estoquista'], 'Estoquista', 1826, 2004, 2400],
  [['almoxarife'], 'Almoxarife', 1928, 2179, 2800],
  [['armazenista'], 'Armazenista', 1818, 1988, 2354],
  [['auxiliar de logistica', 'assistente de logistica'], 'Auxiliar de Logística', 1941, 2020, 2276],
  [['expedidor', 'conferente'], 'Expedidor / Conferente', 1984, 2159, 2625],
  [['embalador', 'embaladora'], 'Embalador', 1728, 1874, 2270],
  [['auxiliar de producao', 'alimentador de linha', 'operador de producao'], 'Auxiliar de Produção', 1903, 2048, 2414],
  [['operador de maquinas', 'operador de maquina'], 'Operador de Máquinas', 2116, 2395, 3054],
  [['carregador', 'ajudante de carga'], 'Carregador', 1777, 1951, 2375],
  [['ajudante de motorista'], 'Ajudante de Motorista', 1743, 1877, 2202],
  [['motorista de caminhao', 'motorista carreteiro'], 'Motorista de Caminhão', 2578, 2760, 3355],
  [['motorista'], 'Motorista', 2140, 2371, 3000],
  [['motoboy', 'motofretista', 'entregador'], 'Motofretista', 1672, 1782, 2114],
  [['frentista'], 'Frentista', 1683, 1751, 1963],
  [['porteiro', 'controlador de acesso'], 'Porteiro', 1941, 2016, 2253],
  [['vigilante'], 'Vigilante', 2037, 2130, 2524],
  [['vigia'], 'Vigia', 1819, 1948, 2262],
  [['faxineiro', 'faxineira', 'auxiliar de limpeza', 'servicos gerais'], 'Auxiliar de Limpeza', 1723, 1801, 2048],
  [['manutencao predial', 'manutencao de edificacoes'], 'Manutenção Predial', 1841, 2114, 2725],
  [['cozinheiro', 'cozinheira'], 'Cozinheiro', 1857, 2057, 2592],
  [['auxiliar de cozinha', 'auxiliar de alimentacao'], 'Auxiliar de Cozinha', 1781, 1894, 2200],
  [['garcom', 'garconete'], 'Garçom', 1764, 1982, 2360],
  [['acougueiro'], 'Açougueiro', 1904, 2167, 2800],
  [['pedreiro'], 'Pedreiro', 2451, 2592, 3046],
  [['servente de obras', 'ajudante de obras'], 'Servente de Obras', 1732, 1911, 2302],
  [['eletricista'], 'Eletricista', 2142, 2501, 3461],
  [['soldador'], 'Soldador', 2899, 3427, 5000],
  [['mecanico de manutencao de maquinas', 'mecanico industrial'], 'Mecânico de Máquinas', 2506, 3170, 4636],
  [['mecanico'], 'Mecânico de Automóveis', 1830, 2269, 3242],
]
const FONTE_CAGED = 'Novo CAGED (via salario.com.br, nov/2026), salários de contratação CLT'

// Médias nacionais sem faixa publicada: usamos ±25% em volta da média.
const MEDIAS: [string[], string, number][] = [
  [['professor', 'professora', 'docente'], 'Professor da educação básica', 4800],
  [['contador', 'contadora'], 'Contador', 5800],
  [['engenheiro civil', 'engenheira civil'], 'Engenheiro Civil', 8500],
  [['advogado', 'advogada'], 'Advogado', 6800],
  [['gerente comercial'], 'Gerente Comercial', 7900],
  [['analista de sistemas'], 'Analista de Sistemas', 7200],
]
const FONTE_MEDIAS = 'Levantamento com base em Caged, Rais e IBGE (Agência GBC, jun/2026)'

// ---------- leitura da vaga ----------

/** Procura valores em R$ nas linhas que falam de salário/bolsa (ignora VR, VT etc.). */
export function salarioInformado(texto: string): { min: number; max: number } | null {
  const valores: number[] = []
  for (const linha of texto.split('\n')) {
    if (!/(salario|remuneracao|bolsa|faixa salarial|pretensao|ctc|r\$)/.test(norm(linha))) continue
    // "Salário: R$ 2.800 + VR R$ 30/dia": olha cada pedaço e ignora o que é benefício.
    for (const pedaco of norm(linha).split(/\s*[+;|•]\s*|\s+-\s+|,\s+(?=[a-z])/)) {
    const l = pedaco
    if (/(vale|\bvr\b|\bva\b|\bvt\b|refeicao|alimentacao|transporte|beneficio|plano|seguro|auxilio creche|gympass|wellhub|\/dia|por dia)/.test(l)) continue
    for (const m of l.matchAll(/r\$\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{2})?|(\d+(?:[.,]\d+)?)\s*mil\b/g)) {
      const n = m[1] ? Number(m[1].replace(/\./g, '')) : Number(m[2].replace(',', '.')) * 1000
      if (n >= 600 && n <= 100000) valores.push(n)
    }
    }
  }
  return valores.length ? { min: Math.min(...valores), max: Math.max(...valores) } : null
}

function nivelDaVaga(cargo: string, texto: string): Nivel | null {
  const procura = (t: string): Nivel | null =>
    /estagi/.test(t) ? 'estagio' : /(senior|\bsr\b|especialista)/.test(t) ? 'senior' : /(pleno|\bpl\b)/.test(t) ? 'pleno' : /(junior|\bjr\b|trainee)/.test(t) ? 'junior' : null
  return procura(norm(cargo)) ?? procura(norm(texto))
}

function regimeDaVaga(texto: string): 'clt' | 'pj' | null {
  const t = norm(texto)
  if (/\bpj\b|pessoa juridica/.test(t)) return 'pj'
  if (/\bclt\b|carteira assinada|efetivo/.test(t)) return 'clt'
  return null
}

const ehTI = (cargo: string) =>
  /(desenvolvedor|desenvolvedora|developer|programador|programadora|engenheir[oa] de software|software engineer|front-?end|back-?end|full[\s-]?stack|\bdev\b)/.test(norm(cargo))

function areaTI(cargo: string, texto: string): AreaTI | null {
  const c = norm(cargo)
  if (/full[\s-]?stack/.test(c)) return 'full'
  if (/back[\s-]?end/.test(c)) return 'back'
  if (/front[\s-]?end/.test(c)) return 'front'
  const t = norm(texto)
  if (/full[\s-]?stack/.test(t)) return 'full'
  return null
}

const arredonda = (n: number) => Math.round(n / 100) * 100
const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
export const formatarReais = reais

// ---------- a estimativa ----------

export function estimarSalario(cargo: string, texto: string): Estimativa {
  const informado = salarioInformado(texto)
  const nivel = nivelDaVaga(cargo, texto)
  const regime = regimeDaVaga(texto)

  if (informado) {
    return {
      tipo: 'informado',
      faixa: informado,
      sugestao: informado.max,
      detalhes: [informado.min === informado.max ? 'A vaga informa o valor.' : 'A vaga informa uma faixa. Mire no topo se você atende tudo.'],
      fonte: 'Texto da vaga',
    }
  }

  // Tecnologia
  if (ehTI(cargo) || (nivel === 'estagio' && ehTI(texto.slice(0, 400)))) {
    if (nivel === 'estagio') {
      return {
        tipo: 'estimado', faixa: { min: ESTAGIO_TI[0], max: ESTAGIO_TI[1] }, sugestao: arredonda((ESTAGIO_TI[0] + ESTAGIO_TI[1]) / 2),
        detalhes: ['Estágio em tecnologia: bolsa-auxílio.', 'Grandes empresas costumam pagar acima dessa faixa.'], fonte: FONTE_TI,
      }
    }
    const area = areaTI(cargo, texto)
    const n = nivel ?? 'junior'
    const r = regime ?? 'clt'
    const faixa: Faixa = area
      ? TI[area][n][r]
      : [Math.round((TI.front[n][r][0] + TI.back[n][r][0]) / 2), Math.round((TI.front[n][r][1] + TI.back[n][r][1]) / 2)]
    // Júnior mira mais perto do começo da faixa; pleno e sênior no meio.
    const posicao = n === 'junior' ? 0.35 : 0.5
    const nomeArea = area ? { front: 'Front-end', back: 'Back-end', full: 'Full-stack' }[area] : 'Desenvolvimento'
    const nomeNivel = { junior: 'júnior', pleno: 'pleno', senior: 'sênior' }[n]
    const detalhes = [
      `${nomeArea} · ${nomeNivel}${nivel ? '' : ' (a vaga não diz o nível)'} · ${r.toUpperCase()}${regime ? '' : ' (a vaga não diz o regime)'}`,
    ]
    if (r === 'clt') detalhes.push(`Se for PJ, a faixa sobe pra ${reais(TI[area ?? 'front'][n].pj[0])}–${reais(TI[area ?? 'front'][n].pj[1])} (sem férias, 13º e FGTS).`)
    else detalhes.push('PJ: sem férias, 13º e FGTS, e os impostos ficam com você. Por isso o valor é maior.')
    return { tipo: 'estimado', faixa: { min: faixa[0], max: faixa[1] }, sugestao: arredonda(faixa[0] + (faixa[1] - faixa[0]) * posicao), detalhes, fonte: FONTE_TI }
  }

  // Outras profissões: procura primeiro no cargo, depois no começo do texto.
  const onde = [norm(cargo), norm(texto.slice(0, 300))]
  for (const lugar of onde) {
    const achado = CARGOS.find(([termos]) => termos.some((t) => lugar.includes(t)))
    if (achado) {
      const [, nome, piso, media, teto] = achado
      const extra = nivel === 'senior' || nivel === 'pleno' ? ['Vaga de nível mais alto: dá pra mirar perto do teto.'] : []
      return {
        tipo: 'estimado', faixa: { min: piso, max: teto }, sugestao: arredonda(nivel === 'senior' || nivel === 'pleno' ? (media + teto) / 2 : media),
        detalhes: [`${nome}: média de contratação ${reais(media)}.`, ...extra, 'Capitais e hospitais/empresas grandes costumam pagar mais.'], fonte: FONTE_CAGED,
      }
    }
    const media = MEDIAS.find(([termos]) => termos.some((t) => lugar.includes(t)))
    if (media) {
      const [, nome, valor] = media
      return {
        tipo: 'estimado', faixa: { min: arredonda(valor * 0.75), max: arredonda(valor * 1.25) }, sugestao: arredonda(valor),
        detalhes: [`${nome}: média nacional ${reais(valor)}.`, 'Faixa aproximada (±25% da média).'], fonte: FONTE_MEDIAS,
      }
    }
  }

  return {
    tipo: 'sem-referencia',
    detalhes: ['Esse cargo não está nas nossas tabelas, então não vamos chutar.'],
    fonte: '',
    busca: `https://www.google.com/search?q=${encodeURIComponent(`salário ${cargo || 'cargo'} 2026`)}`,
  }
}
