// Descobre empresa, cargo e link no texto colado da vaga (a pessoa confere antes de gerar).

const limparLinha = (s: string) => s.replace(/^[\s*•\-–✅✨]+/, '').trim()

// Botões e avisos que vêm junto quando se copia a página do LinkedIn/Gupy.
const LIXO = /^(compartilhar|share|salvar|save|candidatar|candidatura simplificada|apply|easy apply|mostrar mais|show more|denunciar|seguir|follow|promovida|promoted|logo|\d+ (candidat|applicant))/i

// Palavras que quase sempre aparecem no nome de uma vaga (de qualquer área).
const PARECE_CARGO = /(desenvolvedor|developer|engenheir|programador|estagi|analista|front|back|full|software|dev\b|web|trainee|j[uú]nior|pleno|s[eê]nior|designer|dados|data|t[eé]cnic|auxiliar|assistente|enfermeir|vendedor|atendente|recepcionista|motorista|operador|gerente|coordenador|supervisor|professor|consultor|estoquista|almoxarife|porteiro|vigilante|cozinheir|gar[cç]om|fot[oó]graf|contador|advogad|mec[aâ]nic|eletricista|promotor|repositor|secret[aá]ri|farmac|fisioterapeut|nutricionista|psic[oó]log|m[eé]dic|dentista|caixa|l[ií]der|especialista|executivo|representante)/i

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
    linhas.slice(0, 15).find((l) => l.length <= 80 && PARECE_CARGO.test(l) && !/[.:]$/.test(l) && !/^(sobre|requisitos|responsabilidades)/i.test(l)) ||
    // LinkedIn/Gupy costumam vir assim: 1ª linha empresa, 2ª linha cargo.
    linhas.slice(0, 6).filter((l) => l.length <= 80 && !l.includes(':') && !/[.]$/.test(l))[1] ||
    ''
  const primeiraCurta = linhas.slice(0, 15).find((l) => l.length <= 60 && !l.includes(':') && l !== cargo) ?? ''
  const empresa = procura(/^empresa\s*:\s*(.+)$/i) || primeiraCurta
  const link = texto.match(/https?:\/\/\S+/)?.[0] ?? ''
  return { empresa, cargo, link }
}
