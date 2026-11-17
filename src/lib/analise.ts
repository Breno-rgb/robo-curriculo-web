// O cérebro do robô (sem IA, roda no navegador): lê a vaga e monta o currículo.
// Regra de ouro: só ESCOLHE e REORDENA o que está no currículo-mestre. Nunca inventa.

import type { Analise, CurriculoMontado, Mestre } from './tipos'
import { todasCompetencias } from './mestre'
import { estimarSalario } from './salario'

import { norm } from './normalizar'
export { norm }

// ---------- catálogo: como cada tecnologia costuma aparecer escrita nas vagas ----------
// "basica" = quase toda vaga cita, então pesa menos na nota.
type ItemCatalogo = { nome: string; termos: string[]; basica?: boolean }

const CATALOGO: ItemCatalogo[] = [
  { nome: 'HTML', termos: ['html', 'html5'], basica: true },
  { nome: 'CSS', termos: ['css', 'css3', 'sass', 'scss', 'styled-components'], basica: true },
  { nome: 'JavaScript', termos: ['javascript', 'ecmascript', 'es6', 'js'], basica: true },
  { nome: 'TypeScript', termos: ['typescript', 'ts'] },
  { nome: 'React', termos: ['react', 'reactjs', 'react.js'] },
  { nome: 'Vite', termos: ['vite'] },
  { nome: 'Tailwind CSS', termos: ['tailwind'] },
  { nome: 'shadcn/ui', termos: ['shadcn', 'radix'] },
  { nome: 'TanStack Query', termos: ['tanstack query', 'react query', 'react-query'] },
  { nome: 'TanStack Router', termos: ['tanstack router'] },
  { nome: 'Axios', termos: ['axios'] },
  { nome: 'Node.js', termos: ['node', 'nodejs', 'node.js'] },
  { nome: 'APIs REST', termos: ['api rest', 'apis rest', 'rest api', 'restful', 'apis', 'api', 'consumo de api', 'integracao de api', 'integracoes'] },
  { nome: 'Socket.IO', termos: ['socket.io', 'socket io', 'websocket', 'websockets', 'tempo real', 'real-time', 'realtime'] },
  { nome: 'MSW', termos: ['msw', 'mock service worker', 'mocks de api', 'mock de api'] },
  { nome: 'SQL', termos: ['sql', 'banco de dados', 'bancos de dados'] },
  { nome: 'Supabase', termos: ['supabase'] },
  { nome: 'Firebase', termos: ['firebase'] },
  { nome: 'Playwright', termos: ['playwright'] },
  { nome: 'Testes E2E', termos: ['e2e', 'end-to-end', 'end to end', 'testes automatizados', 'teste automatizado', 'ponta a ponta', 'testes de interface'] },
  { nome: 'Lighthouse', termos: ['lighthouse', 'core web vitals', 'web vitals'] },
  { nome: 'Acessibilidade', termos: ['acessibilidade', 'a11y', 'wcag', 'aria'] },
  { nome: 'Responsividade', termos: ['responsiv', 'mobile first', 'mobile-first'], basica: true },
  { nome: 'Git', termos: ['git', 'versionamento', 'controle de versao'], basica: true },
  { nome: 'GitHub', termos: ['github'], basica: true },
  { nome: 'Vercel', termos: ['vercel'] },
  { nome: 'GitHub Pages', termos: ['github pages'] },
  { nome: 'Deploy de aplicações web', termos: ['deploy', 'ci/cd', 'publicacao'] },
  { nome: 'Next.js', termos: ['next.js', 'nextjs', 'next'] },
  { nome: 'Angular', termos: ['angular'] },
  { nome: 'Vue', termos: ['vue', 'vue.js', 'vuejs', 'nuxt'] },
  { nome: 'Redux', termos: ['redux', 'zustand'] },
  { nome: 'React Native', termos: ['react native'] },
  { nome: 'Flutter', termos: ['flutter', 'dart'] },
  { nome: 'Testes unitários', termos: ['testes unitarios', 'teste unitario', 'unit test', 'jest', 'vitest', 'testing library'] },
  { nome: 'Cypress', termos: ['cypress'] },
  { nome: 'Storybook', termos: ['storybook'] },
  { nome: 'GraphQL', termos: ['graphql'] },
  { nome: 'Material UI', termos: ['material ui', 'mui'] },
  { nome: 'Figma', termos: ['figma'] },
  { nome: 'Python', termos: ['python', 'django', 'flask', 'fastapi'] },
  { nome: 'Pandas', termos: ['pandas', 'numpy'] },
  { nome: 'Java', termos: ['java', 'spring'] },
  { nome: 'Kotlin', termos: ['kotlin'] },
  { nome: 'C#', termos: ['c#', '.net', 'dotnet'] },
  { nome: 'Go', termos: ['golang'] },
  { nome: 'PHP', termos: ['php', 'laravel'] },
  { nome: 'Express', termos: ['express', 'nestjs', 'nest.js'] },
  { nome: 'PostgreSQL', termos: ['postgres', 'postgresql'] },
  { nome: 'MySQL', termos: ['mysql'] },
  { nome: 'MongoDB', termos: ['mongodb', 'mongo'] },
  { nome: 'Docker', termos: ['docker', 'kubernetes', 'k8s'] },
  { nome: 'AWS', termos: ['aws', 'amazon web services'] },
  { nome: 'Azure', termos: ['azure'] },
  { nome: 'GCP', termos: ['gcp', 'google cloud'] },
  { nome: 'Power BI', termos: ['power bi', 'powerbi'] },
  { nome: 'Tableau', termos: ['tableau'] },
  { nome: 'Excel', termos: ['excel'] },
  { nome: 'Scrum', termos: ['scrum', 'kanban', 'metodologias ageis', 'agil'] },
  { nome: 'Jira', termos: ['jira'] },
  { nome: 'Linux', termos: ['linux'] },

  // Fora da tecnologia: requisitos comuns em vagas de qualquer área.
  { nome: 'Pacote Office', termos: ['pacote office', 'microsoft office', 'word', 'powerpoint'], basica: true },
  { nome: 'Informática', termos: ['informatica basica', 'informatica intermediaria', 'conhecimentos em informatica', 'informatica'], basica: true },
  { nome: 'CNH', termos: ['cnh', 'carteira de habilitacao', 'carteira nacional de habilitacao'] },
  { nome: 'COREN', termos: ['coren'] },
  { nome: 'CRC', termos: ['crc ativo', 'registro no crc'] },
  { nome: 'CREA', termos: ['crea'] },
  { nome: 'OAB', termos: ['oab'] },
  { nome: 'SAP', termos: ['sap'] },
  { nome: 'Atendimento ao cliente', termos: ['atendimento ao cliente', 'atendimento ao publico', 'atendimento a clientes', 'atendimento ao paciente'] },
  { nome: 'Vendas', termos: ['vendas', 'metas de vendas', 'experiencia comercial'] },
  { nome: 'Negociação', termos: ['negociacao'] },
  { nome: 'Primeiros socorros', termos: ['primeiros socorros', 'suporte basico de vida', 'bls', 'acls'] },
  { nome: 'Empilhadeira', termos: ['empilhadeira'] },
  { nome: 'NR-10', termos: ['nr-10', 'nr 10', 'nr10'] },
  { nome: 'NR-35', termos: ['nr-35', 'nr 35', 'nr35'] },
  { nome: 'Libras', termos: ['libras'] },
  { nome: 'Rotinas administrativas', termos: ['rotinas administrativas', 'rotina administrativa'] },
  { nome: 'Faturamento', termos: ['faturamento'] },
  { nome: 'Contas a pagar e receber', termos: ['contas a pagar', 'contas a receber'] },
  { nome: 'Departamento pessoal', termos: ['departamento pessoal', 'folha de pagamento'] },
  { nome: 'Redes sociais', termos: ['redes sociais', 'social media', 'instagram'] },
]

const BASICA = new Set(CATALOGO.filter((c) => c.basica).map((c) => c.nome))
const pesoBase = (nome: string) => (BASICA.has(nome) ? 1 : 2)

// Termos curtos (ts, js, api, git...) precisam ser palavra inteira; longos casam pelo começo
// ("responsiv" pega "responsivo"). O "." antes bloqueia: "js" não casa dentro de "node.js".
function aparece(texto: string, termo: string) {
  const t = norm(termo)
  const esc = t.replace(/[.+#/*?()[\]\\-]/g, '\\$&')
  const fim = t.length <= 5 || /[^a-z]$/.test(t) ? '(?![a-z0-9])' : ''
  return new RegExp(`(^|[^a-z0-9.])${esc}${fim}`).test(texto)
}

const termosDe = (nome: string) => CATALOGO.find((c) => norm(c.nome) === norm(nome))?.termos ?? [nome]
const citada = (texto: string, nome: string) => termosDe(nome).some((t) => aparece(texto, t))

// ---------- obrigatório × diferencial ----------
// Linha curta tipo "Diferenciais" abre a parte de bônus; "Requisitos" volta pro obrigatório;
// "Benefícios" é ignorado. "Será um diferencial" no meio da linha também é bônus.
const MARCA_DIFERENCIAL = /(diferencia(l|is)|desejave(l|is)|(sera|e) um plus|nice to have|seria legal|plus:)/
const MARCA_OBRIGATORIO = /(requisitos|obrigatori|qualificacoes|o que buscamos|o que esperamos|responsabilidades|atividades|voce vai|precisa ter)/
const MARCA_IGNORAR = /(beneficios|o que oferecemos|remuneracao|sobre a empresa|quem somos)/

function separar(texto: string): [string, string] {
  const obrig: string[] = []
  const dif: string[] = []
  let modo: 'obrig' | 'dif' | 'ignorar' = 'obrig'
  for (const linha of texto.split('\n')) {
    const titulo = linha.trim().length <= 60
    if (titulo && MARCA_DIFERENCIAL.test(linha)) { modo = 'dif'; dif.push(linha); continue }
    if (titulo && MARCA_IGNORAR.test(linha)) { modo = 'ignorar'; continue }
    if (titulo && MARCA_OBRIGATORIO.test(linha)) { modo = 'obrig'; obrig.push(linha); continue }
    if (MARCA_DIFERENCIAL.test(linha) || modo === 'dif') dif.push(linha)
    else if (modo === 'obrig') obrig.push(linha)
  }
  return [obrig.join('\n'), dif.join('\n')]
}

function alertasDeNivel(texto: string, cargo: string, mestre: Mestre) {
  const alertas: string[] = []
  if (/(pleno|senior|sr\b|especialista|lead)/.test(norm(cargo)) || /nivel\s*:?\s*(pleno|senior)/.test(texto)) {
    alertas.push('A vaga é de nível pleno/sênior. Vale tentar, mas espere que peçam mais experiência.')
  }
  const anos = [...texto.matchAll(/(\d+)\s*\+?\s*anos?\s+(de\s+)?experiencia|experiencia\s+(minima\s+)?de\s+(\d+)\s*\+?\s*anos?/g)]
    .map((m) => Number(m[1] || m[4]))
    .filter((n) => n >= 2 && n < 20)
  if (anos.length) alertas.push(`A vaga pede ${Math.max(...anos)}+ anos de experiência.`)

  const seuIngles = mestre.idiomas.find((i) => norm(i).startsWith('ingles')) ?? ''
  if (/ingles\s+(avancado|fluente|fluencia)|fluencia\s+em\s+ingles|ingles\s+c[12]/.test(texto) && !/(avancado|fluente)/.test(norm(seuIngles))) {
    alertas.push(`A vaga pede inglês avançado/fluente e no seu currículo está "${seuIngles.split('—').pop()?.trim() || 'sem inglês'}".`)
  }
  if (/presencial/.test(texto) && !/(remoto|hibrido)/.test(texto)) alertas.push('A vaga parece ser 100% presencial. Confira a cidade antes de se candidatar.')
  return alertas
}

const QUANDO: Record<keyof Mestre['titulos'], string[]> = {
  front: ['front-end', 'frontend', 'front end', 'react', 'interface'],
  full: ['full-stack', 'fullstack', 'full stack'],
  back: ['back-end', 'backend', 'back end'],
  estagio: ['estagio', 'estagiario', 'estagiaria'],
}

function escolherTitulo(mestre: Mestre, cargo: string, texto: string) {
  const c = norm(cargo)
  let melhor = { titulo: mestre.titulo_padrao, pontos: 0 }
  for (const tipo of Object.keys(QUANDO) as (keyof Mestre['titulos'])[]) {
    const titulo = mestre.titulos[tipo]?.trim()
    if (!titulo) continue
    const pontos = QUANDO[tipo].reduce((s, q) => s + (aparece(c, q) ? 3 : 0) + (aparece(texto, q) ? 1 : 0), 0)
    if (pontos > melhor.pontos) melhor = { titulo, pontos }
  }
  return melhor.titulo
}

const listar = (itens: string[]) => (itens.length > 1 ? `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}` : itens[0] ?? '')

// ---------- cargo e formação (funciona pra qualquer área) ----------

const PALAVRAS_VAZIAS = new Set(['de', 'da', 'do', 'das', 'dos', 'em', 'e', 'a', 'o', 'para', 'com', 'junior', 'jr', 'pleno', 'senior', 'sr', 'i', 'ii', 'iii', 'voluntario', 'voluntaria', 'freelancer', 'freela', 'temporario', 'estagiario', 'estagiaria'])
// Palavras que sozinhas não dizem a profissão ("Chefe" de cozinha ≠ chefe escoteiro).
const AMBIGUAS = new Set(['chefe', 'auxiliar', 'assistente', 'analista', 'tecnico', 'tecnica', 'operador', 'operadora', 'gerente', 'supervisor', 'supervisora', 'coordenador', 'coordenadora', 'agente', 'consultor', 'consultora', 'especialista', 'lider'])
const palavras = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !PALAVRAS_VAZIAS.has(w))

/** "Técnico de Enfermagem" (sua experiência) × "Técnico de Enfermagem – UTI" (vaga) → mesmo cargo. */
function mesmoCargo(seu: string, daVaga: string) {
  const a = palavras(seu)
  const b = new Set(palavras(daVaga))
  if (!a.length || !b.size) return false
  const iguais = a.filter((w) => b.has(w)).length
  const precisa = AMBIGUAS.has(a[0]) ? Math.max(2, Math.ceil(a.length / 2)) : Math.ceil(a.length / 2)
  return b.has(a[0]) && iguais >= Math.min(precisa, a.length)
}

/** A vaga cita o curso? Ex.: "cursando Análise e Desenvolvimento de Sistemas", "formação técnica em enfermagem". */
function formacaoCitada(curso: string, texto: string) {
  const nucleo = norm(curso)
    .replace(/^(curso )?(tecnico|tecnologo|tecnologia|bacharelado|licenciatura|graduacao|pos-graduacao|mba|especializacao)( em| de)?\s+/, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  return nucleo.length >= 6 && texto.includes(nucleo)
}

export type Vaga = { empresa: string; cargo: string; texto: string }

export function analisar(mestre: Mestre, vaga: Vaga): { curriculo: CurriculoMontado; analise: Analise } {
  const cargo = vaga.cargo
  const texto = norm(`${cargo}\n${vaga.texto}`)
  const [obrig, dif] = separar(texto)
  // Competências técnicas + comportamentais (as comportamentais pesam pouco: quase toda vaga pede "comunicação").
  // + o que aparece escrito nas suas experiências, projetos e formação (ex.: "atendimento ao paciente" num bullet).
  const textoDoMestre = norm([
    ...mestre.experiencias.flatMap((e) => [e.cargo, ...e.bullets]),
    ...mestre.projetos.flatMap((p) => [p.descricao, ...p.destaques, ...p.stack]),
    ...mestre.formacao.map((f) => f.curso),
  ].join('\n'))
  const naExperiencia = CATALOGO.filter((c) => c.termos.some((t) => aparece(textoDoMestre, t))).map((c) => c.nome)
  const competencias = [...new Set([...todasCompetencias(mestre), ...mestre.comportamentais, ...naExperiencia])]
  const comportamental = new Set(mestre.comportamentais.map(norm))
  const peso = (nome: string) => (comportamental.has(norm(nome)) ? 1 : pesoBase(nome))

  // 1. Suas competências que a vaga cita (mais importantes primeiro).
  const pedidas = competencias
    .filter((c) => citada(texto, c))
    .sort((a, b) => peso(b) - peso(a) || Number(citada(obrig, b)) - Number(citada(obrig, a)))

  // 2. O que a vaga pede e você não tem.
  // Quem já lista tecnologia ou Excel no currículo obviamente sabe "informática".
  const sabeInformatica = competencias.some((c) => ['excel', 'pacote office', 'javascript', 'html', 'python', 'sql', 'power bi'].includes(norm(c)))
  const voceTem = (nome: string) => competencias.some((c) => norm(c) === norm(nome)) || (nome === 'Informática' && sabeInformatica)
  const fora = CATALOGO.filter((c) => !voceTem(c.nome))
  const lacunas = fora.filter((c) => citada(obrig, c.nome)).map((c) => c.nome)
  const diferenciais = fora.filter((c) => !lacunas.includes(c.nome) && citada(dif, c.nome)).map((c) => c.nome)

  // 3. Já trabalhou no cargo? Tem a formação que a vaga pede? (vale pra qualquer área)
  const experienciaNoCargo = mestre.experiencias.find((e) => mesmoCargo(e.cargo, cargo))
  const formacaoPedida = mestre.formacao.find((f) => formacaoCitada(f.curso, texto))

  // 4. Nota: diferencial vale metade; competência básica vale metade de uma específica.
  const temPeso = pedidas.reduce((s, c) => s + peso(c) * (citada(obrig, c) ? 1 : 0.5), 0)
    + (experienciaNoCargo ? 4 : 0) + (formacaoPedida ? 2 : 0)
  const faltaPeso = lacunas.reduce((s, c) => s + peso(c), 0) + diferenciais.reduce((s, c) => s + peso(c) * 0.5, 0)
  // Sem nada pra comparar (nem o que você tem, nem o que falta), a nota não diz nada: fica 0 com aviso.
  const semSinais = !temPeso && !faltaPeso
  const nota = semSinais ? 0 : Math.round((temPeso / (temPeso + faltaPeso)) * 100)

  // 4. Projetos: "fixo" primeiro; o resto por tecnologias + temas em comum com a vaga.
  const pontuados = mestre.projetos
    .map((p, i) => {
      const techs = p.stack.filter((s) => citada(texto, s))
      const temas = p.palavras.filter((w) => aparece(texto, w) && !techs.some((t) => norm(t) === norm(w)))
      return { p, i, techs, temas, pontos: techs.reduce((s, t) => s + peso(t), 0) + temas.length * 1.5 }
    })
    .sort((a, b) => Number(b.p.fixo) - Number(a.p.fixo) || b.pontos - a.pontos || a.i - b.i)
  const projetos = pontuados.filter((x, idx) => idx < 2 || x.pontos > 0).slice(0, 4).map((x) => x.p)
  const maisParecido = [...pontuados].sort((a, b) => b.pontos - a.pontos || a.i - b.i)[0]

  // 5. Experiências: ordem do mestre, mas os bullets ligados à vaga sobem.
  const relevancia = (frase: string) => CATALOGO.filter((c) => citada(norm(frase), c.nome) && citada(texto, c.nome)).length
  const experiencias = mestre.experiencias.map((e) => ({
    ...e,
    bullets: e.bullets.map((b, i) => ({ b, i, r: relevancia(b) })).sort((a, b) => b.r - a.r || a.i - b.i).map((x) => x.b),
  }))

  // 6. Grupos de competências: o que a vaga pede vai na frente e o grupo com mais pedidas sobe.
  const grupos = mestre.grupos
    .map((g) => {
      const itens = [...g.itens].sort((a, b) => Number(pedidas.includes(b)) - Number(pedidas.includes(a)))
      return { nome: g.nome, itens, n: itens.filter((i) => pedidas.includes(i)).length }
    })
    .filter((g) => g.itens.length)
    .sort((a, b) => b.n - a.n)
    .map(({ nome, itens }) => ({ nome, itens }))

  // 7. Textos montados só com fatos do mestre.
  const projetoTop = projetos[0]
  const nomeCurto = projetoTop ? projetoTop.nome.split(' — ')[0] : ''
  const novas = pedidas.filter((c) => !citada(norm(mestre.resumo_base), c)).slice(0, 3)
  let resumo = mestre.resumo_base.trim()
  if (novas.length && mestre.projetos.length) resumo += ` Também utilizo ${listar(novas)} em projetos${nomeCurto ? `, como o ${nomeCurto}` : ''}.`
  else if (novas.length) resumo += ` Tenho experiência com ${listar(novas)}.`
  else if (nomeCurto) resumo += ` Projeto em destaque: ${nomeCurto}.`

  const destaque = pedidas.slice(0, 3)
  let mensagem = `Olá! Vi a vaga${cargo ? ` de ${cargo}` : ''}${vaga.empresa ? ` na ${vaga.empresa}` : ''} e me candidatei. `
  if (experienciaNoCargo) mensagem += `Já atuei como ${experienciaNoCargo.cargo}${experienciaNoCargo.local ? ` (${experienciaNoCargo.local})` : ''}. `
  if (destaque.length) mensagem += `Tenho experiência prática com ${listar(destaque)}. `
  if (projetoTop?.link) mensagem += `Um projeto que mostra bem isso é o ${nomeCurto}: ${projetoTop.link}. `
  if (mestre.contatos.portfolio) mensagem += `Mais projetos em ${mestre.contatos.portfolio}. `
  mensagem += 'Fico à disposição para conversar!'

  const pontos_fortes: string[] = []
  if (pedidas.length) pontos_fortes.push(`A vaga cita ${pedidas.length} competência(s) que você tem: ${pedidas.join(', ')}`)
  else if (!experienciaNoCargo && !formacaoPedida) pontos_fortes.push('A vaga não cita nenhuma das suas competências pelo nome. Leia com atenção antes de se candidatar.')
  if (maisParecido && maisParecido.pontos > 0) {
    pontos_fortes.push(`Projeto mais parecido com a vaga: ${maisParecido.p.nome} (${[...maisParecido.techs, ...maisParecido.temas].join(', ')})`)
  }
  if (experienciaNoCargo) pontos_fortes.unshift(`Você já trabalhou como ${experienciaNoCargo.cargo}${experienciaNoCargo.periodo ? ` (${experienciaNoCargo.periodo})` : ''}.`)
  if (formacaoPedida) pontos_fortes.push(`A vaga cita a sua formação: ${formacaoPedida.curso}.`)
  if (/estagi/.test(norm(cargo))) pontos_fortes.push('Vaga de estágio: confira se o seu curso e semestre batem com o que pedem.')

  const curriculo: CurriculoMontado = {
    nome: mestre.nome,
    titulo: escolherTitulo(mestre, cargo, texto),
    contatos: mestre.contatos,
    resumo,
    grupos,
    destaques_vaga: pedidas,
    comportamentais: mestre.comportamentais,
    projetos,
    experiencias,
    formacao: mestre.formacao,
    idiomas: mestre.idiomas,
  }

  const conteudo = norm(JSON.stringify(curriculo))
  return {
    curriculo,
    analise: {
      nota,
      pontos_fortes,
      lacunas: [
        ...(semSinais
          ? ['O robô não reconheceu os requisitos dessa vaga, então a nota não diz muito. Leia a vaga com atenção.']
          : lacunas.length
          ? lacunas.map((l) => `Requisito: ${l} (não está no seu currículo)`)
          : ['Nenhum requisito obrigatório fora do seu currículo foi encontrado (confira a descrição mesmo assim).']),
        ...diferenciais.map((d) => `Diferencial (não obrigatório): ${d}`),
      ],
      faltando: [...pedidas, ...lacunas].filter((k) => !conteudo.includes(norm(k))),
      alertas: alertasDeNivel(texto, cargo, mestre),
      mensagem,
      salario: estimarSalario(cargo, vaga.texto),
    },
  }
}

// ---------- usado pelo "Importar currículo em PDF" ----------

const GRUPOS: Record<string, string[]> = {
  'Front-end': ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'React', 'Vite', 'Tailwind CSS', 'shadcn/ui', 'TanStack Query', 'TanStack Router', 'Next.js', 'Angular', 'Vue', 'Redux', 'React Native', 'Flutter', 'Material UI', 'Figma', 'Acessibilidade', 'Responsividade', 'Storybook'],
  'Back-end e dados': ['Node.js', 'APIs REST', 'Axios', 'Socket.IO', 'SQL', 'Supabase', 'Firebase', 'GraphQL', 'Python', 'Pandas', 'Java', 'Kotlin', 'C#', 'Go', 'PHP', 'Express', 'PostgreSQL', 'MySQL', 'MongoDB', 'Power BI', 'Tableau', 'Excel'],
  'Testes e qualidade': ['Playwright', 'Testes E2E', 'Testes unitários', 'Cypress', 'MSW', 'Lighthouse'],
  'Ferramentas e deploy': ['Git', 'GitHub', 'Vercel', 'GitHub Pages', 'Deploy de aplicações web', 'Docker', 'AWS', 'Azure', 'GCP', 'Linux', 'Scrum', 'Jira'],
}

/** Em qual grupo uma competência costuma ficar ("Outras" se não conhecemos). */
export function grupoDe(nome: string) {
  return Object.entries(GRUPOS).find(([, itens]) => itens.some((i) => norm(i) === norm(nome)))?.[0] ?? 'Outras'
}

// Palavras comuns demais pra provar que a pessoa conhece a tecnologia (ex.: "publicação" ≠ deploy).
const GENERICOS = new Set(['api', 'apis', 'integracoes', 'tempo real', 'real-time', 'realtime', 'publicacao', 'banco de dados', 'bancos de dados', 'versionamento', 'agil', 'aria', 'next', 'ts', 'js', 'mocks de api', 'mock de api', 'go'])

/** Tecnologias do catálogo citadas num texto (com o nome "bonito"), ignorando palavras genéricas. */
export function competenciasNoTexto(texto: string) {
  const t = norm(texto)
  return CATALOGO.filter((c) => c.termos.some((termo) => !GENERICOS.has(termo) && aparece(t, termo))).map((c) => c.nome)
}
