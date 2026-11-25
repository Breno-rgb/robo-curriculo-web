// Perfil: e-mail, trocar senha, cópia de segurança e apagar conta (pede a senha).
import { useRef, useState, type FormEvent } from 'react'
import type { Mestre } from '../lib/tipos'
import { importarMestre } from '../lib/mestre'
import { dados } from '../lib/dados'

type Props = { email: string; mestre: Mestre; aoImportar: (m: Mestre) => Promise<void>; aoVerTutorial: () => void }
type Msg = { tipo: 'ok' | 'erro'; texto: string } | null

export function Perfil({ email, mestre, aoImportar, aoVerTutorial }: Props) {
  const [novaSenha, setNovaSenha] = useState('')
  const [msgSenha, setMsgSenha] = useState<Msg>(null)
  const [msgBackup, setMsgBackup] = useState<Msg>(null)
  const [apagar, setApagar] = useState(false)
  const [senhaApagar, setSenhaApagar] = useState('')
  const [erroApagar, setErroApagar] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const arquivo = useRef<HTMLInputElement>(null)

  async function trocarSenha(e: FormEvent) {
    e.preventDefault()
    setMsgSenha(null); setOcupado(true)
    try {
      if (novaSenha.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.')
      await dados.trocarSenha(novaSenha)
      setNovaSenha('')
      setMsgSenha({ tipo: 'ok', texto: 'Senha trocada.' })
    } catch (falha) { setMsgSenha({ tipo: 'erro', texto: (falha as Error).message }) } finally { setOcupado(false) }
  }

  function exportar() {
    const blob = new Blob([JSON.stringify(mestre, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'curriculo-mestre.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function importar(f: File | undefined) {
    if (!f) return
    setMsgBackup(null)
    try {
      await aoImportar(importarMestre(await f.text()))
      setMsgBackup({ tipo: 'ok', texto: 'Currículo mestre restaurado.' })
    } catch (falha) { setMsgBackup({ tipo: 'erro', texto: (falha as Error).message }) }
    if (arquivo.current) arquivo.current.value = ''
  }

  async function apagarConta(e: FormEvent) {
    e.preventDefault()
    setErroApagar(''); setOcupado(true)
    try {
      if (!senhaApagar) throw new Error('Digite sua senha.')
      await dados.apagarConta(senhaApagar) // se der certo, a pessoa sai e volta pra tela de entrada
    } catch (falha) { setErroApagar((falha as Error).message); setOcupado(false) }
  }

  return (
    <div className="perfil">
      <div className="cabecalho-pagina"><div><h1>Perfil</h1><p className="sub">{email}</p></div></div>

      <section className="cartao">
        <h2>Trocar senha</h2>
        <form onSubmit={trocarSenha} className="campos">
          <div className="campo">
            <label htmlFor="nova-senha">Senha nova (mínimo 6 caracteres)</label>
            <input id="nova-senha" type="password" autoComplete="new-password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
          </div>
          <div className="campo" style={{ alignSelf: 'end' }}><button className="botao" disabled={ocupado}>Salvar senha</button></div>
        </form>
        {msgSenha && <div className={msgSenha.tipo} role="status">{msgSenha.texto}</div>}
      </section>

      <section className="cartao">
        <h2>Cópia de segurança</h2>
        <p className="sub">Baixe seu currículo mestre num arquivo, ou restaure de um arquivo baixado antes.</p>
        <div className="ferramentas">
          <button className="botao leve" onClick={exportar}>Baixar cópia (.json)</button>
          <button className="botao leve" onClick={() => arquivo.current?.click()}>Restaurar cópia</button>
          <input ref={arquivo} type="file" accept="application/json,.json" hidden onChange={(e) => importar(e.target.files?.[0])} />
        </div>
        {msgBackup && <div className={msgBackup.tipo} role="status">{msgBackup.texto}</div>}
      </section>

      <section className="cartao">
        <h2>Como usar o app</h2>
        <p className="sub">Reveja o passo a passo que aparece quando você cria a conta.</p>
        <button className="botao leve" onClick={aoVerTutorial}>Ver o tutorial de novo</button>
      </section>

      <section className="cartao zona-perigo">
        <h2>Apagar conta</h2>
        <p className="sub">Apaga sua conta, seu currículo mestre e todos os currículos gerados. Não dá pra desfazer.</p>
        {!apagar ? (
          <button className="botao perigo" onClick={() => setApagar(true)}>Apagar minha conta</button>
        ) : (
          <form onSubmit={apagarConta}>
            <div className="campo">
              <label htmlFor="senha-apagar">Digite sua senha pra confirmar</label>
              <input id="senha-apagar" type="password" autoComplete="current-password" value={senhaApagar} onChange={(e) => setSenhaApagar(e.target.value)} autoFocus />
            </div>
            {erroApagar && <div className="erro" role="alert">{erroApagar}</div>}
            <div className="linha">
              <button className="botao perigo-cheio" disabled={ocupado}>{ocupado ? 'Apagando…' : 'Apagar para sempre'}</button>
              <button type="button" className="botao leve" onClick={() => { setApagar(false); setSenhaApagar(''); setErroApagar('') }}>Cancelar</button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
