// Descobre empresa, cargo e link no texto colado da vaga (a pessoa confere antes de gerar).

const limparLinha = (s: string) => s.replace(/^[\s*•\-–✅✨]+/, '').trim()

// Botões e avisos que vêm junto quando se copia a página do LinkedIn/Gupy.
const LIXO = /^(compartilhar|share|salvar|save|candidatar|candidatura simplificada|apply|easy apply|mostrar mais|show more|denunciar|seguir|follow|promovida|promoted|logo|\d+ (candidat|applicant))/i

const PARECE_CARGO = /(desenvolvedor|developer|engenheir|programador|estagi|analista|front|back|full|software|dev\b|web|trainee|j[uú]nior|pleno|designer|dados|data)/i

export function extrairInfo(texto: string) {
  const linhas = texto.split(/\r?\n/).map(limparLinha).filter((l) => l && !LIXO.test(l))
  const procura = (re: RegExp) => {
    for (const l of linhas) {
      const m = l.match(re)
      if (m?.[1]?.trim()) return m[1].trim()
    }
    return ''
  }

  const cargo =
    procura(/^(?:fun[cç][aã]o|cargo|vaga|t[ií]tulo da vaga|posi[cç][aã]o)\s*:\s*(.+)$/i) ||
    linhas.slice(0, 15).find((l) => l.length <= 80 && PARECE_CARGO.test(l) && !/[.:]$/.test(l)) ||
    ''
  const primeiraCurta = linhas.slice(0, 15).find((l) => l.length <= 60 && !l.includes(':') && l !== cargo) ?? ''
  const empresa = procura(/^empresa\s*:\s*(.+)$/i) || primeiraCurta
  const link = texto.match(/https?:\/\/\S+/)?.[0] ?? ''
  return { empresa, cargo, link }
}
