// Cola a vaga → o robô monta o currículo, a análise e guarda nas candidaturas.
import { useEffect, useRef, useState } from 'react'
import type { Candidatura, Mestre } from '../lib/tipos'
import { analisar } from '../lib/analise'
import { extrairInfo } from '../lib/extrair'
import { oQueFalta } from '../lib/mestre'
import { dados } from '../lib/dados'
import { Resultado } from '../componentes/Resultado'

type Props = { mestre: Mestre; aoCriar: (c: Candidatura) => void }

export function NovaVaga({ mestre, aoCriar }: Props) {
  const [texto, setTexto] = useState('')
  const [campos, setCampos] = useState({ empresa: '', cargo: '', link: '' })
  const editado = useRef({ empresa: false, cargo: false, link: false })
  const [erro, setErro] = useState('')
  const [gerando, setGerando] = useState(false)
  const [ultima, setUltima] = useState<Candidatura | null>(null)
  const falta = oQueFalta(mestre)

  // Ao colar, tenta descobrir empresa, cargo e link (sem apagar o que a pessoa digitou).
  useEffect(() => {
    if (texto.trim().length < 50) return
    const t = setTimeout(() => {
      const info = extrairInfo(texto)
      setCampos((c) => ({
        empresa: editado.current.empresa ? c.empresa : info.empresa,
        cargo: editado.current.cargo ? c.cargo : info.cargo,
        link: editado.current.link ? c.link : info.link,
      }))
    }, 300)
    return () => clearTimeout(t)
  }, [texto])

  function mudarCampo(nome: keyof typeof campos, valor: string) {
    editado.current[nome] = true
    setCampos((c) => ({ ...c, [nome]: valor }))
  }

  async function gerar() {
    setErro('')
    if (texto.trim().length < 200) return setErro('O texto parece curto demais pra ser uma vaga. Cole a descrição inteira.')
    setGerando(true)
    try {
      const empresa = campos.empresa.trim() || 'Empresa'
      const cargo = campos.cargo.trim() || 'Vaga'
      const resultado = analisar(mestre, { empresa, cargo, texto })
      const nova = await dados.criarCandidatura({
        empresa, cargo, link: campos.link.trim(), nota: resultado.analise.nota,
        status: 'pronto pra enviar', vaga: texto.trim().slice(0, 50000), resultado,
      })
      setUltima(nova)
      aoCriar(nova)
      setTexto('')
      setCampos({ empresa: '', cargo: '', link: '' })
      editado.current = { empresa: false, cargo: false, link: false }
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (falha) {
      setErro((falha as Error).message)
    } finally {
      setGerando(false)
    }
  }

  if (falta.length) {
    return (
      <div className="cartao">
        <h1>Primeiro, seu currículo-mestre</h1>
        <p className="sub">O robô só usa o que é verdade sobre você, então ele precisa disso antes. Falta: {falta.join(', ')}.</p>
        <a className="botao" href="#curriculo">Preencher meu currículo</a>
      </div>
    )
  }

  return (
    <div className="grade">
      <div className="cartao">
        <h1>Nova vaga</h1>
        <p className="sub">Selecione o texto inteiro da vaga no site, copie e cole aqui.</p>
        <label htmlFor="texto-vaga">Texto da vaga</label>
        <textarea id="texto-vaga" rows={14} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Cole aqui a descrição completa da vaga…" />
        <div className="campos" style={{ marginTop: 12 }}>
          <div className="campo"><label htmlFor="empresa">Empresa</label><input id="empresa" type="text" value={campos.empresa} onChange={(e) => mudarCampo('empresa', e.target.value)} /></div>
          <div className="campo"><label htmlFor="cargo">Cargo</label><input id="cargo" type="text" value={campos.cargo} onChange={(e) => mudarCampo('cargo', e.target.value)} /></div>
          <div className="campo campo-inteiro"><label htmlFor="link">Link da vaga (opcional)</label><input id="link" type="url" value={campos.link} onChange={(e) => mudarCampo('link', e.target.value)} /></div>
        </div>
        <p className="dica">Empresa e cargo são preenchidos sozinhos quando você cola. Confira antes de gerar.</p>
        {erro && <div className="erro" role="alert">{erro}</div>}
        <div className="linha">
          <button className="botao" onClick={gerar} disabled={gerando}>{gerando ? 'Gerando…' : 'Gerar currículo'}</button>
        </div>
      </div>

      <div className="cartao" aria-live="polite">
        {ultima ? (
          <Resultado empresa={ultima.empresa} cargo={ultima.cargo} curriculo={ultima.resultado.curriculo} analise={ultima.resultado.analise} />
        ) : (
          <div className="vazio">O resultado aparece aqui: nota de aderência, o que falta, a mensagem pro recrutador e o PDF.</div>
        )}
      </div>
    </div>
  )
}
