// Função que roda no servidor da Vercel (não no navegador).
// Recebe o TEXTO de um currículo em PDF e pede pra IA do Google (Gemini) organizar
// em JSON, no formato do currículo mestre. A chave da IA fica só aqui no servidor:
// ela vem da variável GEMINI_API_KEY da Vercel e nunca vai pro site.
//
// Segurança: só aceita quem está logado no app (confere a sessão no Supabase),
// pra ninguém de fora gastar a cota da IA.

const MODELOS = [process.env.GEMINI_MODEL, 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite'].filter(Boolean)
const URL_IA = (modelo) => `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`
const LIMITE_TEXTO = 20000

const FORMATO = `{
  "nome": "nome completo",
  "titulo_padrao": "cargo/título que a pessoa usa (ex.: Assistente Administrativo, Desenvolvedor Web)",
  "contatos": { "cidade": "", "telefone": "", "email": "", "linkedin": "", "github": "", "portfolio": "" },
  "resumo_base": "o resumo/objetivo/perfil profissional, como está escrito",
  "grupos": [ { "nome": "nome do grupo de competências técnicas", "itens": ["competência", "..."] } ],
  "comportamentais": ["competências comportamentais / soft skills"],
  "experiencias": [ { "cargo": "", "local": "empresa", "periodo": "ex.: Jan 2022 – Atual", "bullets": ["o que fez, uma frase por item"] } ],
  "projetos": [ { "nome": "", "link": "", "codigo": "link do repositório", "stack": ["tecnologias"], "descricao": "uma frase", "destaques": ["detalhes"] } ],
  "formacao": [ { "curso": "", "instituicao": "", "periodo": "" } ],
  "idiomas": ["ex.: Inglês – intermediário"]
}`

const INSTRUCOES = `Você organiza currículos. Abaixo está o texto extraído de um currículo em PDF
(a ordem das linhas pode estar bagunçada, porque o PDF pode ter colunas).
Devolva SOMENTE um JSON neste formato, sem comentários e sem markdown:
${FORMATO}

Regras:
- Use apenas o que está escrito no currículo. Não invente nada. O que não existir fica "" ou [].
- Copie os textos como estão (pode corrigir só espaços e quebras de linha quebradas no meio da frase).
- Separe as competências técnicas em grupos que façam sentido pra área da pessoa
  (ex.: "Front-end", "Back-end", "Ferramentas" pra tecnologia; "Administrativo", "Informática" pra escritório; "Saúde" pra enfermagem).
- Cursos livres e certificações entram em "formacao".
- Trabalho voluntário entra em "experiencias".
- Links sem "https://".

Texto do currículo:
"""
`

const resposta = (status, corpo) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } })

/** Confere no Supabase se o token é de alguém logado. */
async function logado(token) {
  const url = process.env.VITE_SUPABASE_URL
  const chave = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !chave || !token) return false
  const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: chave, authorization: `Bearer ${token}` } })
  return r.ok
}

/** Pega o primeiro {...} do texto da IA (caso ela mande algo antes ou depois). */
function extrairJson(texto) {
  const limpo = texto.replace(/^```(json)?/m, '').replace(/```\s*$/m, '')
  const inicio = limpo.indexOf('{')
  const fim = limpo.lastIndexOf('}')
  if (inicio < 0 || fim <= inicio) throw new Error('sem json')
  return JSON.parse(limpo.slice(inicio, fim + 1))
}

async function perguntarIA(texto, chave) {
  const corpo = (comFormato) => JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: INSTRUCOES + texto + '\n"""' }] }],
    ...(comFormato ? { generationConfig: { responseMimeType: 'application/json', temperature: 0 } } : {}),
  })
  let ultimoErro = ''
  for (const modelo of MODELOS) {
    // Tenta pedindo JSON direto; se a API não aceitar o formato, tenta sem.
    for (const comFormato of [true, false]) {
      const r = await fetch(URL_IA(modelo), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': chave },
        body: corpo(comFormato),
      })
      if (r.status === 404) { ultimoErro = `modelo ${modelo} não encontrado`; break } // tenta o próximo modelo
      if (r.status === 429) throw Object.assign(new Error('limite'), { status: 429 })
      if (!r.ok) { ultimoErro = `${r.status} ${(await r.text()).slice(0, 200)}`; continue }
      const dados = await r.json()
      const partes = dados?.candidates?.[0]?.content?.parts ?? []
      const textoIA = partes.map((p) => p.text ?? '').join('')
      return extrairJson(textoIA)
    }
  }
  throw new Error(ultimoErro || 'IA não respondeu')
}

export async function POST(request) {
  const chave = process.env.GEMINI_API_KEY
  if (!chave) return resposta(501, { erro: 'Leitura com IA não configurada.' })

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!(await logado(token))) return resposta(401, { erro: 'Entre na sua conta pra importar.' })

  let texto = ''
  try { texto = String((await request.json()).texto || '') } catch { /* corpo inválido */ }
  texto = texto.trim().slice(0, LIMITE_TEXTO)
  if (texto.length < 40) return resposta(400, { erro: 'Não deu pra ler texto nesse PDF.' })

  try {
    return resposta(200, { curriculo: await perguntarIA(texto, chave) })
  } catch (falha) {
    if (falha.status === 429) return resposta(429, { erro: 'Muita gente importando agora. Tente de novo em 1 minuto.' })
    console.error('ler-curriculo:', falha.message)
    return resposta(502, { erro: 'A IA não conseguiu ler esse currículo.' })
  }
}
