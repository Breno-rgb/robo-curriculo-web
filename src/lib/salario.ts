// "Quanto pedir?": uma ESTIMATIVA de salário pra vaga, pra servir de referência.
// 1) Se a vaga já diz o valor, usa o da vaga.
// 2) Se não diz, compara o cargo com tabelas de mercado (nov/2026).
// 3) Se o cargo não está nas tabelas, estima pelo tipo de cargo (auxiliar, analista, gerente...).
// 4) Se nem isso der, avisa em vez de chutar.
// Os números são médias de mercado: mudam com cidade, empresa e experiência.
// Todas as estimativas saem 10% ABAIXO das tabelas (DESCONTO), pra pessoa pedir com folga
// e não perder a vaga por pedir alto demais. Nunca abaixo do salário mínimo.

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

/** Quanto das tabelas a gente sugere pedir (0.9 = 10% abaixo). */
const DESCONTO = 0.9
const SALARIO_MINIMO = 1621

// Outras funções de tecnologia (CLT, por nível). PJ costuma pagar ~35% a mais.
// [como reconhecer no nome da vaga, nome, estágio, júnior, pleno, sênior]
type PapelTI = [RegExp, string, Faixa, Faixa, Faixa, Faixa]
const PAPEIS_TI: PapelTI[] = [
  [/(suporte (tecnico|de ti|ti|em ti|de sistemas|n[123])|(analista|tecnico) de suporte|help ?desk|service ?desk|tecnico (de|em) informatica)/, 'Suporte técnico / Help desk', [1100, 1700], [1900, 2800], [2800, 4000], [4000, 5800]],
  [/(seguranca da informacao|ciberseguranca|cyber ?security|pentest|\bsoc\b)/, 'Segurança da informação', [1400, 2200], [4500, 7000], [7500, 12000], [12000, 18000]],
  [/(devops|\bsre\b|cloud|engenheir[oa] de plataforma|platform engineer)/, 'DevOps / Cloud', [1500, 2400], [5500, 8000], [9000, 13500], [13500, 20000]],
  [/(cientista de dados|data scientist|machine learning|engenheir[oa] de (ia|machine learning))/, 'Ciência de dados', [1600, 2600], [5500, 8500], [9000, 13500], [13500, 20000]],
  [/(engenheir[oa] de dados|data engineer)/, 'Engenharia de dados', [1600, 2500], [5500, 8000], [8500, 13000], [13000, 19000]],
  [/(analista de (dados|bi)|data analyst|business intelligence|\bbi\b|power bi)/, 'Análise de dados / BI', [1300, 2200], [3800, 5800], [6000, 9000], [9000, 13500]],
  [/(\bqa\b|quality assurance|analista de testes?|tester|testador|qualidade de software)/, 'QA / Testes', [1300, 2100], [3800, 5500], [5500, 8500], [8500, 12500]],
  [/(mobile|android|\bios\b|flutter|react native)/, 'Desenvolvimento mobile', [1400, 2300], [5000, 7500], [8000, 12000], [12000, 18000]],
  [/(\bux\b|\bui\b|product designer|designer de produto)/, 'UX/UI Design', [1300, 2100], [3800, 5800], [6000, 9000], [9000, 14000]],
  [/(product owner|\bpo\b|product manager|gerente de produto)/, 'Produto (PO/PM)', [1500, 2400], [6000, 9000], [9500, 14000], [14000, 21000]],
  [/(infraestrutura|\binfra\b|redes|sysadmin|administrador de (redes|sistemas)|telecom)/, 'Infraestrutura / Redes', [1200, 1900], [3000, 4500], [4500, 7000], [7000, 11000]],
  [/(analista de (sistemas|ti)|analista desenvolvedor)/, 'Analista de sistemas', [1300, 2100], [4000, 6000], [6000, 9000], [9000, 13000]],
]

// ---------- outras profissões (Novo CAGED via salario.com.br, nov/2026: piso, média, teto em CLT) ----------
// [palavras que identificam o cargo, nome, piso, média, teto]
type Cargo = [string[], string, number, number, number]
const CARGOS: Cargo[] = [
  // administrativo e escritório
  [['auxiliar de departamento pessoal', 'assistente de departamento pessoal', 'auxiliar de dp', 'assistente de dp'], 'Assistente de Departamento Pessoal', 2000, 2500, 3400],
  [['analista de departamento pessoal', 'analista de dp'], 'Analista de Departamento Pessoal', 3000, 3900, 5600],
  [['assistente de rh', 'auxiliar de rh', 'assistente de recursos humanos', 'auxiliar de recursos humanos'], 'Assistente de RH', 1900, 2350, 3200],
  [['analista de rh', 'analista de recursos humanos', 'recrutador', 'recrutadora'], 'Analista de RH', 3200, 4300, 6500],
  [['assistente financeiro', 'auxiliar financeiro', 'assistente financeira', 'auxiliar financeira'], 'Assistente Financeiro', 1950, 2450, 3400],
  [['analista financeiro', 'analista financeira'], 'Analista Financeiro', 3500, 4700, 7200],
  [['assistente de faturamento', 'auxiliar de faturamento', 'analista de faturamento', 'faturista'], 'Assistente de Faturamento', 1900, 2300, 3100],
  [['assistente fiscal', 'auxiliar fiscal'], 'Assistente Fiscal', 2000, 2600, 3600],
  [['analista fiscal', 'analista tributario'], 'Analista Fiscal', 3600, 4800, 7000],
  [['analista contabil'], 'Analista Contábil', 3300, 4400, 6500],
  [['assistente de compras', 'auxiliar de compras'], 'Assistente de Compras', 2000, 2500, 3300],
  [['analista de compras'], 'Analista de Compras', 3300, 4400, 6400],
  [['comprador', 'compradora'], 'Comprador', 2800, 3800, 5800],
  [['analista administrativo', 'analista administrativa'], 'Analista Administrativo', 2800, 3600, 5200],
  [['secretaria escolar', 'secretario escolar'], 'Secretária Escolar', 2000, 2400, 3200],
  [['secretaria', 'secretario'], 'Secretária', 1900, 2400, 3400],
  // comercial e marketing
  [['analista de marketing'], 'Analista de Marketing', 3200, 4300, 6500],
  [['assistente de marketing', 'auxiliar de marketing'], 'Assistente de Marketing', 2000, 2600, 3500],
  [['social media', 'analista de midias sociais'], 'Social Media', 2000, 2800, 4000],
  [['designer grafico', 'designer'], 'Designer Gráfico', 2200, 3000, 4500],
  [['pre-vendas', 'pre vendas', 'sdr', 'bdr'], 'Pré-vendas (SDR)', 2000, 2700, 3800],
  [['customer success', 'sucesso do cliente'], 'Customer Success', 3000, 4000, 6000],
  [['executivo de contas', 'executivo de vendas', 'executivo comercial', 'account executive'], 'Executivo de Vendas', 3500, 5000, 8000],
  [['representante comercial', 'representante de vendas'], 'Representante Comercial', 2500, 3800, 6000],
  [['analista comercial'], 'Analista Comercial', 2900, 3900, 5800],
  [['supervisor de vendas', 'supervisor comercial'], 'Supervisor de Vendas', 3500, 4800, 7500],
  [['gerente de loja'], 'Gerente de Loja', 3500, 4800, 7500],
  [['fiscal de loja', 'prevencao de perdas'], 'Fiscal de Loja', 1800, 2000, 2400],
  [['operador de loja', 'auxiliar de loja'], 'Operador de Loja', 1700, 1850, 2150],
  // saúde e cuidado
  [['farmaceutico', 'farmaceutica'], 'Farmacêutico', 4200, 5200, 7000],
  [['fisioterapeuta'], 'Fisioterapeuta', 3200, 4000, 5500],
  [['nutricionista'], 'Nutricionista', 3300, 4100, 5800],
  [['psicologo', 'psicologa'], 'Psicólogo', 3300, 4200, 6000],
  [['assistente social'], 'Assistente Social', 3300, 4000, 5500],
  [['dentista', 'cirurgiao-dentista', 'cirurgiao dentista'], 'Dentista', 3500, 4800, 7000],
  [['tecnico em radiologia', 'tecnico de radiologia'], 'Técnico em Radiologia', 2600, 3300, 4600],
  [['tecnico de seguranca do trabalho', 'tecnico em seguranca do trabalho'], 'Técnico de Segurança do Trabalho', 2900, 3700, 5200],
  [['auxiliar de saude bucal', 'asb'], 'Auxiliar de Saúde Bucal', 1750, 1950, 2400],
  [['tecnico de laboratorio', 'auxiliar de laboratorio', 'tecnico em analises clinicas'], 'Técnico de Laboratório', 1900, 2400, 3400],
  [['cuidador', 'cuidadora'], 'Cuidador de Idosos', 1700, 1950, 2500],
  [['baba'], 'Babá', 1700, 1950, 2600],
  // educação
  [['professor de educacao infantil', 'professora de educacao infantil'], 'Professor de Educação Infantil', 2600, 3300, 4500],
  [['auxiliar de classe', 'auxiliar de sala', 'auxiliar de professor', 'auxiliar de desenvolvimento infantil'], 'Auxiliar de Classe', 1650, 1850, 2200],
  [['monitor escolar', 'monitora escolar', 'inspetor de alunos', 'inspetora de alunos'], 'Monitor Escolar', 1650, 1850, 2200],
  // serviços, beleza e alimentação
  [['cabeleireiro', 'cabeleireira'], 'Cabeleireiro', 1800, 2300, 3400],
  [['barbeiro'], 'Barbeiro', 1800, 2300, 3200],
  [['manicure', 'pedicure'], 'Manicure', 1650, 1900, 2500],
  [['auxiliar de padaria'], 'Auxiliar de Padaria', 1700, 1850, 2150],
  [['padeiro', 'padeira'], 'Padeiro', 1900, 2200, 2800],
  [['confeiteiro', 'confeiteira'], 'Confeiteiro', 1900, 2250, 2900],
  [['pizzaiolo'], 'Pizzaiolo', 1900, 2300, 3000],
  [['chapeiro'], 'Chapeiro', 1750, 1950, 2350],
  [['barista'], 'Barista', 1700, 1900, 2300],
  [['copeiro', 'copeira'], 'Copeiro', 1680, 1800, 2100],
  [['camareiro', 'camareira'], 'Camareira', 1680, 1820, 2150],
  [['lavanderia'], 'Auxiliar de Lavanderia', 1650, 1780, 2050],
  [['costureiro', 'costureira'], 'Costureira', 1750, 1950, 2400],
  [['jardineiro'], 'Jardineiro', 1750, 1950, 2400],
  [['zelador', 'zeladora'], 'Zelador', 1850, 2050, 2500],
  // indústria, manutenção e logística
  [['operador de empilhadeira', 'empilhadeirista'], 'Operador de Empilhadeira', 2200, 2550, 3100],
  [['tecnico de manutencao', 'tecnico em manutencao'], 'Técnico de Manutenção', 2800, 3500, 5000],
  [['auxiliar de manutencao', 'ajudante de manutencao'], 'Auxiliar de Manutenção', 1850, 2150, 2700],
  [['eletrotecnico', 'tecnico em eletrotecnica'], 'Técnico em Eletrotécnica', 2800, 3500, 5000],
  [['tecnico em eletronica', 'tecnico eletronico'], 'Técnico em Eletrônica', 2400, 3000, 4200],
  [['tecnico em mecanica', 'tecnico mecanico'], 'Técnico em Mecânica', 2700, 3400, 4800],
  [['pintor', 'pintora'], 'Pintor', 2000, 2300, 2900],
  [['encanador', 'bombeiro hidraulico'], 'Encanador', 2000, 2400, 3100],
  [['marceneiro'], 'Marceneiro', 2100, 2500, 3200],
  [['serralheiro'], 'Serralheiro', 2100, 2450, 3100],
  [['lider de producao', 'encarregado de producao'], 'Líder de Produção', 2800, 3500, 5000],
  [['supervisor de producao'], 'Supervisor de Produção', 4000, 5300, 8000],
  [['analista de logistica'], 'Analista de Logística', 3000, 3900, 5600],
  [['coordenador de logistica'], 'Coordenador de Logística', 5500, 7200, 10500],
  [['analista de qualidade'], 'Analista de Qualidade', 3200, 4200, 6200],
  [['inspetor de qualidade', 'auxiliar de qualidade', 'assistente de qualidade'], 'Inspetor de Qualidade', 2000, 2500, 3400],
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
  [['atendente de farmacia', 'auxiliar de farmacia', 'balconista'], 'Atendente de Farmácia', 1778, 1919, 2320],
  [['atendente de lanchonete'], 'Atendente de Lanchonete', 1744, 1862, 2150],
  [['atendente de loja', 'atendente de mercado', 'atendente'], 'Atendente de Loja', 1769, 1885, 2172],
  [['telemarketing', 'operador de atendimento', 'sac', 'call center'], 'Operador de Telemarketing', 1621, 1676, 1826],
  [['repositor'], 'Repositor de Mercadorias', 1783, 1889, 2155],
  [['estoquista', 'auxiliar de estoque'], 'Estoquista', 1826, 2004, 2400],
  [['almoxarife'], 'Almoxarife', 1928, 2179, 2800],
  [['armazenista'], 'Armazenista', 1818, 1988, 2354],
  [['auxiliar de logistica', 'assistente de logistica'], 'Auxiliar de Logística', 1941, 2020, 2276],
  [['expedidor', 'conferente', 'expedicao'], 'Expedidor / Conferente', 1984, 2159, 2625],
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
  [['vigilante', 'seguranca patrimonial'], 'Vigilante', 2037, 2130, 2524],
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
  [['medico', 'medica'], 'Médico', 13000],
]
const FONTE_MEDIAS = 'Levantamento com base em Caged, Rais e IBGE (Agência GBC, jun/2026)'

// Último recurso: estima pelo TIPO de cargo (palavra no nome da vaga). Menos preciso.
// [como reconhecer, tipo, piso, média, teto, pode ficar abaixo do mínimo?]
type Generico = [RegExp, string, number, number, number, boolean?]
const GENERICOS: Generico[] = [
  [/aprendiz/, 'jovem aprendiz', 850, 1100, 1400, true],
  [/estagi/, 'estágio', 900, 1300, 1800, true],
  [/(gerente|\bhead\b|diretor)/, 'gerência', 7000, 10000, 15000],
  [/coordenador/, 'coordenação', 5000, 7000, 10000],
  [/especialista/, 'especialista', 7000, 9500, 13000],
  [/(supervisor|lider|encarregad)/, 'supervisão / liderança', 3000, 4200, 6000],
  [/analista/, 'analista', 3200, 4300, 6500],
  [/tecnic/, 'técnico', 2400, 3100, 4300],
  [/assistente/, 'assistente', 2000, 2500, 3300],
  [/(auxiliar|ajudante|operador|atendente)/, 'auxiliar / operacional', 1700, 1950, 2400],
]
const FONTE_GENERICA = 'Médias de mercado por tipo de cargo (Caged e pesquisas salariais 2026), aproximadas'

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

/** Aplica o desconto e arredonda. Sem `livre`, nunca fica abaixo do salário mínimo. */
const pedir = (n: number, livre = false) => {
  const v = arredonda(n * DESCONTO)
  return livre ? v : Math.max(SALARIO_MINIMO, v)
}
const faixaPedida = (min: number, max: number, livre = false) => ({ min: pedir(min, livre), max: pedir(max, livre) })
const AVISO_DESCONTO = 'Valores já 10% abaixo da média de mercado, pra você pedir com folga.'
const buscaDo = (cargo: string) => `https://www.google.com/search?q=${encodeURIComponent(`salário ${cargo || 'cargo'} 2026`)}`

export function estimarSalario(cargo: string, texto: string): Estimativa {
  const informado = salarioInformado(texto)
  const nivel = nivelDaVaga(cargo, texto)
  const regime = regimeDaVaga(texto)
  const c = norm(cargo)

  if (informado) {
    const faixa = informado.min !== informado.max
    return {
      tipo: 'informado',
      faixa: informado,
      // Faixa: pede um pouco abaixo do topo (10%), sem passar do piso da própria vaga.
      sugestao: faixa ? Math.max(informado.min, arredonda(informado.max * DESCONTO)) : informado.max,
      detalhes: [faixa ? 'A vaga informa uma faixa. Pedir um pouco abaixo do topo aumenta a chance.' : 'A vaga informa o valor.'],
      fonte: 'Texto da vaga',
    }
  }

  // Tecnologia: funções específicas (suporte, dados, QA, mobile...).
  // (quem já diz front/back/full-stack no nome vai pra tabela de desenvolvimento, logo abaixo)
  const papel = /(front|back|full)[\s-]?(end|stack)/.test(c) ? undefined : PAPEIS_TI.find(([re]) => re.test(c))
  if (papel) {
    const [, nome, estagio, junior, pleno, senior] = papel
    const n = nivel ?? 'junior'
    const base = { estagio, junior, pleno, senior }[n]
    const pj = regime === 'pj' && n !== 'estagio'
    const [min, max] = pj ? [base[0] * 1.35, base[1] * 1.35] : base
    const posicao = n === 'junior' || n === 'estagio' ? 0.35 : 0.5
    const nomeNivel = { estagio: 'estágio', junior: 'júnior', pleno: 'pleno', senior: 'sênior' }[n]
    return {
      tipo: 'estimado',
      faixa: faixaPedida(min, max, n === 'estagio'),
      sugestao: pedir(min + (max - min) * posicao, n === 'estagio'),
      detalhes: [
        `${nome} · ${nomeNivel}${nivel ? '' : ' (a vaga não diz o nível)'}${n === 'estagio' ? '' : ` · ${pj ? 'PJ' : 'CLT'}`}`,
        ...(n !== 'estagio' && !pj ? [`Se for PJ, costuma ser uns 35% a mais (sem férias, 13º e FGTS).`] : []),
        AVISO_DESCONTO,
      ],
      fonte: 'Médias de mercado de TI 2026 (Nerdin, Glassdoor e pesquisas salariais), aproximadas',
    }
  }

  // Tecnologia: desenvolvimento (front, back, full-stack).
  if (ehTI(cargo) || (nivel === 'estagio' && ehTI(texto.slice(0, 400)))) {
    if (nivel === 'estagio') {
      return {
        tipo: 'estimado', faixa: faixaPedida(ESTAGIO_TI[0], ESTAGIO_TI[1], true), sugestao: pedir((ESTAGIO_TI[0] + ESTAGIO_TI[1]) / 2, true),
        detalhes: ['Estágio em tecnologia: bolsa-auxílio.', 'Grandes empresas costumam pagar acima dessa faixa.', AVISO_DESCONTO], fonte: FONTE_TI,
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
    const pjFaixa = TI[area ?? 'front'][n].pj
    if (r === 'clt') detalhes.push(`Se for PJ, a faixa sobe pra ${reais(pedir(pjFaixa[0]))}–${reais(pedir(pjFaixa[1]))} (sem férias, 13º e FGTS).`)
    else detalhes.push('PJ: sem férias, 13º e FGTS, e os impostos ficam com você. Por isso o valor é maior.')
    detalhes.push(AVISO_DESCONTO)
    return { tipo: 'estimado', faixa: faixaPedida(faixa[0], faixa[1]), sugestao: pedir(faixa[0] + (faixa[1] - faixa[0]) * posicao), detalhes, fonte: FONTE_TI }
  }

  // Outras profissões: procura primeiro no cargo, depois no começo do texto.
  const onde = [c, norm(texto.slice(0, 300))]
  for (const lugar of onde) {
    const achado = CARGOS.find(([termos]) => termos.some((t) => lugar.includes(t)))
    if (achado) {
      const [, nome, piso, media, teto] = achado
      const alto = nivel === 'senior' || nivel === 'pleno'
      return {
        tipo: 'estimado', faixa: faixaPedida(piso, teto), sugestao: pedir(alto ? (media + teto) / 2 : media),
        detalhes: [
          `${nome}: média de contratação ${reais(media)}.`,
          ...(alto ? ['Vaga de nível mais alto: dá pra mirar perto do teto.'] : []),
          'Capitais e empresas grandes costumam pagar mais.',
          AVISO_DESCONTO,
        ],
        fonte: FONTE_CAGED,
      }
    }
    const media = MEDIAS.find(([termos]) => termos.some((t) => lugar.includes(t)))
    if (media) {
      const [, nome, valor] = media
      return {
        tipo: 'estimado', faixa: faixaPedida(valor * 0.75, valor * 1.25), sugestao: pedir(valor),
        detalhes: [`${nome}: média nacional ${reais(valor)}.`, 'Faixa aproximada (±25% da média).', AVISO_DESCONTO], fonte: FONTE_MEDIAS,
      }
    }
  }

  // Último recurso: pelo tipo de cargo (só olha o nome da vaga).
  const generico = GENERICOS.find(([re]) => re.test(c))
  if (generico) {
    const [, tipo, piso, media, teto, livre] = generico
    const fator = nivel === 'senior' ? 1.6 : nivel === 'pleno' ? 1.3 : 1
    const usaNivel = tipo === 'analista' || tipo === 'técnico' || tipo === 'especialista'
    const f = usaNivel ? fator : 1
    return {
      tipo: 'estimado',
      faixa: faixaPedida(piso * f, teto * f, livre),
      sugestao: pedir(media * f, livre),
      detalhes: [
        `Esse cargo não está nas nossas tabelas: estimamos pelo tipo de cargo (${tipo}${usaNivel && nivel && nivel !== 'estagio' ? `, ${{ junior: 'júnior', pleno: 'pleno', senior: 'sênior' }[nivel]}` : ''}).`,
        'É uma referência menos precisa. Vale conferir no Google.',
        AVISO_DESCONTO,
      ],
      fonte: FONTE_GENERICA,
      busca: buscaDo(cargo),
    }
  }

  return {
    tipo: 'sem-referencia',
    detalhes: ['Esse cargo não está nas nossas tabelas, então não vamos chutar.'],
    fonte: '',
    busca: buscaDo(cargo),
  }
}
