// Casca do app: tela de entrada ou app logado. As páginas trocam pelo # da URL.
import { useCallback, useEffect, useState } from 'react'
import type { Candidatura, Mestre } from './lib/tipos'
import { dados, type Usuario } from './lib/dados'
import { mestreVazio } from './lib/mestre'
import { Entrar, NovaSenha } from './paginas/Entrar'
import { Inicio } from './paginas/Inicio'
import { MeuCurriculo } from './paginas/MeuCurriculo'
import { Realizados } from './paginas/Realizados'
import { Perfil } from './paginas/Perfil'
import { Tutorial, type Alvo } from './componentes/Tutorial'
import { deveMostrarTutorial, tutorialVisto } from './lib/tutorial'

type Pagina = 'inicio' | 'mestre' | 'realizados' | 'perfil'
const NAV: { id: Exclude<Pagina, 'inicio'>; nome: string }[] = [
  { id: 'mestre', nome: 'Currículo mestre' },
  { id: 'realizados', nome: 'Currículos realizados' },
  { id: 'perfil', nome: 'Perfil' },
]
const paginaDaUrl = (): Pagina => {
  const h = window.location.hash.slice(1)
  return NAV.some((n) => n.id === h) ? (h as Pagina) : 'inicio'
}

export function Marca() {
  return (
    <a className="marca" href="#">
      <img src="/icone.svg" alt="" />
      <span>Robô <b>Currículo</b></span>
    </a>
  )
}

export function App() {
  const [usuario, setUsuario] = useState<Usuario | null | undefined>(undefined) // undefined = ainda verificando
  const [recuperando, setRecuperando] = useState(false)
  const [pagina, setPagina] = useState<Pagina>(paginaDaUrl)
  const [mestre, setMestre] = useState<Mestre | null>(null)
  const [candidaturas, setCandidaturas] = useState<Candidatura[] | null>(null)
  const [erro, setErro] = useState('')
  const [tutorial, setTutorial] = useState(false)
  const [destaque, setDestaque] = useState<Alvo | null>(null)

  // Sessão: confere ao abrir e acompanha login/logout.
  useEffect(() => {
    dados.sessaoAtual().then(setUsuario)
    return dados.aoMudarSessao((u, evento) => {
      if (evento === 'recuperar-senha') setRecuperando(true)
      setUsuario((atual) => (atual?.id === u?.id ? atual : u)) // evita recarregar tudo à toa
    })
  }, [])

  useEffect(() => {
    const ouvir = () => { setPagina(paginaDaUrl()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', ouvir)
    return () => window.removeEventListener('hashchange', ouvir)
  }, [])

  const carregar = useCallback(async (id: string) => {
    setErro(''); setMestre(null); setCandidaturas(null)
    try {
      const [m, c] = await Promise.all([dados.carregarMestre(), dados.listarCandidaturas()])
      setMestre(m ?? mestreVazio())
      setCandidaturas(c)
      if (deveMostrarTutorial(id, !m && c.length === 0)) setTutorial(true)
    } catch (falha) {
      setErro((falha as Error).message)
    }
  }, [])

  useEffect(() => {
    if (usuario) carregar(usuario.id)
    else { setMestre(null); setCandidaturas(null); setTutorial(false) }
  }, [usuario, carregar])

  // O tutorial leva pra tela de cada passo.
  const mostrarPasso = useCallback((alvo: Alvo | null) => {
    setDestaque(alvo)
    if (alvo) window.location.hash = alvo === 'inicio' ? '' : alvo
  }, [])
  const fecharTutorial = useCallback((irPara?: Alvo) => {
    setTutorial(false); setDestaque(null)
    if (usuario) tutorialVisto(usuario.id)
    if (irPara) window.location.hash = irPara === 'inicio' ? '' : irPara
  }, [usuario])

  if (usuario === undefined) return <div className="vazio">Carregando…</div>
  if (recuperando) return <NovaSenha aoTerminar={() => setRecuperando(false)} />
  if (!usuario) return <Entrar />

  async function salvarMestre(m: Mestre) {
    await dados.salvarMestre(m)
    setMestre(m)
  }

  // A cor muda na hora na tela; se não conseguir salvar, volta pra anterior.
  function mudarCor(cor: string) {
    if (!mestre) return
    const antes = mestre
    const novo = { ...mestre, cor }
    setMestre(novo)
    dados.salvarMestre(novo).catch(() => setMestre(antes))
  }

  return (
    <>
      {dados.modo === 'demo' && <div className="aviso-demo">Modo demonstração: os dados ficam só neste navegador.</div>}
      <header className={`topo${tutorial ? ' em-tutorial' : ''}`}>
        <div className="topo-dentro">
          <Marca />
          <nav className="abas" aria-label="Menu">
            {NAV.map((n) => (
              <a key={n.id} href={`#${n.id}`} aria-current={pagina === n.id ? 'page' : undefined} className={destaque === n.id ? 'destaque-tutorial' : undefined}>{n.nome}</a>
            ))}
          </nav>
          <button className="botao leve pequeno sair" onClick={() => dados.sair()}>Sair</button>
        </div>
      </header>

      <main>
        {erro ? (
          <div className="cartao">
            <div className="erro" role="alert">{erro}</div>
            <div className="linha"><button className="botao" onClick={() => carregar(usuario.id)}>Tentar de novo</button></div>
          </div>
        ) : !mestre ? (
          <div className="vazio">Carregando seus dados…</div>
        ) : pagina === 'mestre' ? (
          <MeuCurriculo mestre={mestre} aoSalvar={salvarMestre} />
        ) : pagina === 'realizados' ? (
          <Realizados lista={candidaturas} nome={mestre.nome} cor={mestre.cor} aoMudar={setCandidaturas} />
        ) : pagina === 'perfil' ? (
          <Perfil email={usuario.email} mestre={mestre} aoImportar={salvarMestre} aoVerTutorial={() => setTutorial(true)} />
        ) : (
          <Inicio mestre={mestre} aoCriar={(c) => setCandidaturas((l) => [c, ...(l ?? [])])} aoMudarCor={mudarCor} />
        )}
      </main>

      {tutorial && mestre && <Tutorial aoMostrar={mostrarPasso} aoFechar={fecharTutorial} />}
    </>
  )
}
