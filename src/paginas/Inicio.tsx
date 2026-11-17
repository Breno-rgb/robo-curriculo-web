// Tela principal: cola a vaga → gera. Do lado: o PDF (visualizar/baixar) e a aderência.
import { useRef, useState } from 'react'
import type { Candidatura, Mestre } from '../lib/tipos'
import { analisar } from '../lib/analise'
import { extrairInfo } from '../lib/extrair'
import { todasCompetencias } from '../lib/mestre'
import { imprimir } from '../lib/pdf'
import { dados } from '../lib/dados'
import { FolhaA4, Visualizador, useCurriculoPronto } from '../componentes/Folha'
import { Aderencia } from '../componentes/Aderencia'
import { Salario } from '../componentes/Salario'

type Props = { mestre: Mestre; aoCriar: (c: Candidatura) => void }

export function Inicio({ mestre, aoCriar }: Props) {
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')
  const [gerando, setGerando] = useState(false)
  const [ultima, setUltima] = useState<Candidatura | null>(null)
  const [vendo, setVendo] = useState(false)
  const folha = useRef<HTMLIFrameElement>(null)
  const pronto = useCurriculoPronto(ultima?.resultado.curriculo ?? null)

  const mestreVazio = !mestre.nome.trim() && todasCompetencias(mestre).length === 0
  const nomeArquivo = ultima ? `Curriculo - ${mestre.nome || 'curriculo'} - ${ultima.empresa}` : ''

  async function gerar() {
    setErro('')
    if (!texto.trim()) return setErro('Cole o texto da vaga primeiro.')
    setGerando(true)
    try {
      const info = extrairInfo(texto)
      const empresa = info.empresa || 'Empresa'
      const cargo = info.cargo || 'Vaga'
      const resultado = analisar(mestre, { empresa, cargo, texto })
      const nova = await dados.criarCandidatura({
        empresa, cargo, link: info.link, nota: resultado.analise.nota,
        status: 'pronto pra enviar', vaga: texto.trim().slice(0, 50000), resultado,
      })
      setUltima(nova)
      aoCriar(nova)
    } catch (falha) {
      setErro((falha as Error).message)
    } finally {
      setGerando(false)
    }
  }

  return (
    <>
      {mestreVazio && (
        <div className="aviso">
          <span>Seu currículo mestre está vazio. Preencha (ou importe seu PDF) pra o robô ter o que usar.</span>
          <a className="botao pequeno" href="#mestre">Ir pro currículo mestre</a>
        </div>
      )}

      <div className="inicio">
        <section className="cartao colar">
          <h2>Cole a vaga</h2>
          <label htmlFor="texto-vaga" className="so-leitor">Texto da vaga</label>
          <textarea
            id="texto-vaga"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={'Abra a vaga no LinkedIn, Gupy ou onde for,\nselecione tudo (Ctrl + A), copie (Ctrl + C)\ne cole aqui (Ctrl + V).'}
          />
          {erro && <div className="erro" role="alert">{erro}</div>}
          <div className="linha">
            <button className="botao brilho grande" onClick={gerar} disabled={gerando}>
              {gerando ? 'Gerando…' : 'Gerar currículo'}
            </button>
          </div>
        </section>

        <div className="lateral" aria-live="polite">
          <section className="cartao">
            {ultima && <p className="vaga-titulo">{ultima.empresa} <span>· {ultima.cargo}</span></p>}
            <FolhaA4 html={pronto?.html ?? null} folhaRef={folha} vazio={ultima ? 'Montando o PDF…' : 'O currículo aparece aqui.'} />
            <div className="botoes-2">
              <button className="botao leve" disabled={!pronto} onClick={() => setVendo(true)}>Visualizar</button>
              <button className="botao" disabled={!pronto} onClick={() => folha.current && imprimir(folha.current, nomeArquivo)}>Baixar PDF</button>
            </div>
            {pronto && <p className="dica">No "Baixar PDF", escolha <strong>Salvar como PDF</strong> no destino.</p>}
          </section>

          <section className="cartao">
            <Aderencia analise={ultima?.resultado.analise ?? null} />
          </section>

          <section className="cartao">
            <Salario estimativa={ultima ? ultima.resultado.analise.salario : null} />
          </section>
        </div>
      </div>

      {vendo && pronto && ultima && (
        <Visualizador html={pronto.html} titulo={`${ultima.empresa} · ${ultima.cargo}`} nomeArquivo={nomeArquivo} aoFechar={() => setVendo(false)} />
      )}
    </>
  )
}
