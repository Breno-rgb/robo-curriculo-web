import type { Estimativa } from './salario'

// Os "contratos" do app: o formato de cada coisa que circula entre telas, análise e banco.

export type Experiencia = {
  id: string
  cargo: string
  local: string
  periodo: string
  bullets: string[]
  /** Sai primeiro quando o currículo não cabe em 1 página. */
  opcional: boolean
}

export type Projeto = {
  id: string
  nome: string
  link: string
  codigo: string
  stack: string[]
  descricao: string
  destaques: string[]
  /** Temas do projeto (ex.: e-commerce, testes) que ajudam a achar vagas parecidas. */
  palavras: string[]
  /** Sempre entra no currículo, em primeiro (o seu melhor projeto). */
  fixo: boolean
}

export type Formacao = { id: string; curso: string; instituicao: string; periodo: string }

export type GrupoDeCompetencias = { id: string; nome: string; itens: string[] }

/** Títulos alternativos usados quando a vaga é desse tipo. Vazio = usa o título padrão. */
export type Titulos = { front: string; full: string; back: string; estagio: string }

/** O currículo-mestre: tudo que é verdade sobre a pessoa. O robô só escolhe e reordena daqui. */
export type Mestre = {
  nome: string
  titulo_padrao: string
  titulos: Titulos
  contatos: { cidade: string; telefone: string; email: string; linkedin: string; github: string; portfolio: string }
  resumo_base: string
  grupos: GrupoDeCompetencias[]
  comportamentais: string[]
  experiencias: Experiencia[]
  projetos: Projeto[]
  formacao: Formacao[]
  idiomas: string[]
  /** Cor dos detalhes do PDF (id de CORES em curriculoHtml.ts). Vazio = laranja. */
  cor?: string
}

/** O currículo já montado para UMA vaga (é isso que vira PDF). */
export type CurriculoMontado = {
  nome: string
  titulo: string
  contatos: Mestre['contatos']
  resumo: string
  grupos: { nome: string; itens: string[] }[]
  destaques_vaga: string[]
  comportamentais: string[]
  projetos: Projeto[]
  experiencias: Experiencia[]
  formacao: Formacao[]
  idiomas: string[]
}

export type Analise = {
  nota: number
  pontos_fortes: string[]
  lacunas: string[]
  faltando: string[]
  alertas: string[]
  mensagem: string
  /** Estimativa de salário (currículos antigos não têm). */
  salario?: Estimativa
}

export type Candidatura = {
  id: string
  criado_em: string
  empresa: string
  cargo: string
  link: string
  nota: number
  status: string
  vaga: string
  resultado: { curriculo: CurriculoMontado; analise: Analise }
}

export const STATUS = ['pronto pra enviar', 'enviado', 'entrevista', 'teste técnico', 'proposta', 'recusado', 'sem resposta'] as const
