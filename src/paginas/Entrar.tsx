// Tela de entrada: entrar, criar conta ou recuperar a senha.
import { useState, type FormEvent } from 'react'
import { marcarTutorialPendente } from '../lib/tutorial'
import { dados } from '../lib/dados'

type Modo = 'entrar' | 'cadastrar' | 'esqueci'

export function Entrar() {
  const [modo, setModo] = useState<Modo>('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [enviando, setEnviando] = useState(false)

  function trocar(m: Modo) { setModo(m); setErro(''); setOk('') }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(''); setOk(''); setEnviando(true)
    try {
      if (modo === 'entrar') await dados.entrar(email, senha)
      if (modo === 'cadastrar') {
        marcarTutorialPendente() // antes, porque ao cadastrar a pessoa já entra
        const { precisaConfirmar } = await dados.cadastrar(email, senha)
        if (precisaConfirmar) setOk('Conta criada! Enviamos um link pro seu e-mail. Clique nele e depois entre aqui.')
      }
      if (modo === 'esqueci') {
        await dados.esqueciSenha(email)
        setOk('Se esse e-mail tiver conta, chegou um link pra criar uma senha nova.')
      }
    } catch (falha) {
      setErro((falha as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  const titulo = { entrar: 'Entrar', cadastrar: 'Criar conta', esqueci: 'Recuperar senha' }[modo]

  return (
    <div className="entrada">
      <div className="entrada-caixa">
        <div className="marca"><img src="/icone.svg" alt="" /><span>Robô <b>Currículo</b></span></div>
        <p>Cole a vaga. Receba um currículo sob medida, em 1 página.</p>

        <form className="cartao" onSubmit={enviar} noValidate>
          <h2>{titulo}</h2>
          {dados.modo === 'demo' && <p className="dica" style={{ marginTop: -6, marginBottom: 12 }}>Modo demonstração: a conta fica só neste navegador.</p>}
          <div className="campo">
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {modo !== 'esqueci' && (
            <div className="campo">
              <label htmlFor="senha">Senha {modo === 'cadastrar' && '(mínimo 6 caracteres)'}</label>
              <input
                id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
                autoComplete={modo === 'cadastrar' ? 'new-password' : 'current-password'}
              />
            </div>
          )}
          {erro && <div className="erro" role="alert">{erro}</div>}
          {ok && <div className="ok" role="status">{ok}</div>}
          <div className="linha">
            <button className="botao brilho grande" type="submit" disabled={enviando}>
              {enviando ? 'Aguarde…' : titulo}
            </button>
          </div>
          <div className="entrada-rodape">
            {modo === 'entrar' ? (
              <>
                <button type="button" className="link-botao" onClick={() => trocar('cadastrar')}>Criar conta</button>
                <button type="button" className="link-botao" onClick={() => trocar('esqueci')}>Esqueci a senha</button>
              </>
            ) : (
              <button type="button" className="link-botao" onClick={() => trocar('entrar')}>Já tenho conta</button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

/** Aparece quando a pessoa volta pelo link de "esqueci a senha". */
export function NovaSenha({ aoTerminar }: { aoTerminar: () => void }) {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(''); setEnviando(true)
    try {
      if (senha.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.')
      await dados.trocarSenha(senha)
      aoTerminar()
    } catch (falha) {
      setErro((falha as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="entrada">
      <form className="cartao entrada-caixa" onSubmit={enviar} style={{ textAlign: 'left' }}>
        <h2>Criar senha nova</h2>
        <div className="campo">
          <label htmlFor="nova">Senha nova (mínimo 6 caracteres)</label>
          <input id="nova" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>
        {erro && <div className="erro" role="alert">{erro}</div>}
        <div className="linha"><button className="botao" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar senha'}</button></div>
      </form>
    </div>
  )
}
