// Currículos realizados: um por vaga, com nota, status, visualizar/baixar e apagar.
import { useState } from 'react'
import { STATUS, type Candidatura } from '../lib/tipos'
import { dados } from '../lib/dados'
import { classeDaNota } from '../componentes/Aderencia'
import { Visualizador, useCurriculoPronto } from '../componentes/Folha'

type Props = { lista: Candidatura[] | null; nome: string; cor?: string; aoMudar: (lista: Candidatura[]) => void }

const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

export function Realizados({ lista, nome, cor, aoMudar }: Props) {
  const [vendo, setVendo] = useState<Candidatura | null>(null)
  const [apagando, setApagando] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const pronto = useCurriculoPronto(vendo?.resultado.curriculo ?? null, cor)

  if (!lista) return <div className="vazio">Carregando…</div>

  async function mudarStatus(c: Candidatura, status: string) {
    setErro('')
    const antes = lista!
    aoMudar(antes.map((x) => (x.id === c.id ? { ...x, status } : x))) // muda na hora (otimista)
    try { await dados.atualizarStatus(c.id, status) } catch (falha) { aoMudar(antes); setErro((falha as Error).message) }
  }

  async function apagar(c: Candidatura) {
    setErro('')
    try {
      await dados.apagarCandidatura(c.id)
      aoMudar(lista!.filter((x) => x.id !== c.id))
      setApagando(null)
    } catch (falha) { setErro((falha as Error).message) }
  }

  const enviadas = lista.filter((c) => c.status !== 'pronto pra enviar').length

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Currículos realizados</h1>
          <p className="sub">{lista.length} gerado(s) · {enviadas} com candidatura enviada</p>
        </div>
      </div>
      {erro && <div className="erro" role="alert">{erro}</div>}

      {lista.length === 0 ? (
        <div className="cartao vazio">Nenhum currículo ainda. <a href="#">Gere o primeiro</a> colando uma vaga.</div>
      ) : (
        <div className="lista-realizados">
          {lista.map((c) => (
            <article className="realizado" key={c.id}>
              <div className={`pct ${classeDaNota(c.nota)}`}>{c.nota}%</div>
              <div className="info">
                <strong>{c.empresa} · {c.cargo}</strong>
                <span>{data(c.criado_em)}{c.link && <> · <a href={c.link} target="_blank" rel="noopener noreferrer">ver vaga</a></>}</span>
              </div>
              <select aria-label={`Status de ${c.empresa}`} value={c.status} onChange={(e) => mudarStatus(c, e.target.value)}>
                {[...new Set([c.status, ...STATUS])].map((s) => <option key={s}>{s}</option>)}
              </select>
              <div className="acoes">
                <button className="botao leve pequeno" onClick={() => setVendo(c)}>Visualizar</button>
                {apagando === c.id ? (
                  <>
                    <button className="botao perigo-cheio pequeno" onClick={() => apagar(c)}>Confirmar</button>
                    <button className="botao leve pequeno" onClick={() => setApagando(null)}>Cancelar</button>
                  </>
                ) : (
                  <button className="botao perigo pequeno" onClick={() => setApagando(c.id)}>Apagar</button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {vendo && pronto && (
        <Visualizador
          html={pronto.html}
          titulo={`${vendo.empresa} · ${vendo.cargo} · ${vendo.nota}%`}
          nomeArquivo={`Curriculo - ${nome || 'curriculo'} - ${vendo.empresa}`}
          aoFechar={() => setVendo(null)}
        />
      )}
    </>
  )
}
