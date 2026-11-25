// Lembra (neste navegador) se a pessoa já viu o tutorial. Se o navegador bloquear, só não lembra.

const PENDENTE = 'robo:tutorial-pendente'
const visto = (id: string) => `robo:tutorial-visto:${id}`

function ler(chave: string) {
  try { return localStorage.getItem(chave) } catch { return null }
}
function gravar(chave: string, valor: string | null) {
  try { if (valor === null) localStorage.removeItem(chave); else localStorage.setItem(chave, valor) } catch { /* sem localStorage */ }
}

/** Chamado logo depois de criar a conta. */
export const marcarTutorialPendente = () => gravar(PENDENTE, '1')

/** Mostra pra quem acabou de criar a conta, ou pra conta nova (sem nada salvo) que nunca viu aqui. */
export const deveMostrarTutorial = (id: string, contaNova: boolean) =>
  ler(PENDENTE) === '1' || (contaNova && ler(visto(id)) !== '1')

export function tutorialVisto(id: string) {
  gravar(PENDENTE, null)
  gravar(visto(id), '1')
}
