// Lista de candidaturas: muda status, revê o currículo daquela vaga ou apaga.
import { Fragment, useState } from 'react'
import { STATUS, type Candidatura } from '../lib/tipos'
import { dados } from '../lib/dados'
import { Resultado, classeDaNota } from '../componentes/Resultado'

type Props = {
  lista: Candidatura[] | null
  aoMudar: (lista: Candidatura[]) => void
}

const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

export function Candidaturas({ lista, aoMudar }: Props) {
  const [aberta, setAberta] = useState<string | null>(null)
  const [apagando, setApagando] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  if (!lista) return <div className="cartao vazio">Carregando…</div>

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
    <div className="cartao">
      <h1>Minhas candidaturas</h1>
      <p className="sub">{lista.length} currículo(s) gerado(s) · {enviadas} com candidatura enviada</p>
      {erro && <div className="erro" role="alert">{erro}</div>}
      {lista.length === 0 ? (
        <div className="vazio">Nenhuma candidatura ainda. Gere seu primeiro currículo em <a href="#vaga">Nova vaga</a>.</div>
      ) : (
        <div className="tabela">
          <table>
            <thead><tr><th>Data</th><th>Empresa</th><th>Cargo</th><th>Aderência</th><th>Status</th><th><span className="so-leitor">Ações</span></th></tr></thead>
            <tbody>
              {lista.map((c) => (
                <Fragment key={c.id}>
                  <tr className={aberta === c.id ? 'visto' : ''}>
                    <td>{data(c.criado_em)}</td>
                    <td>{c.link ? <a href={c.link} target="_blank" rel="noopener noreferrer">{c.empresa}</a> : c.empresa}</td>
                    <td>{c.cargo}</td>
                    <td className={classeDaNota(c.nota)}><strong>{c.nota}%</strong></td>
                    <td>
                      <select aria-label={`Status de ${c.empresa}`} value={c.status} onChange={(e) => mudarStatus(c, e.target.value)}>
                        {[...new Set([c.status, ...STATUS])].map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <div className="acoes">
                        <button className="botao leve pequeno" aria-expanded={aberta === c.id} onClick={() => setAberta(aberta === c.id ? null : c.id)}>
                          {aberta === c.id ? 'Fechar' : 'Ver currículo'}
                        </button>
                        {apagando === c.id ? (
                          <>
                            <button className="botao perigo pequeno" onClick={() => apagar(c)}>Confirmar</button>
                            <button className="botao leve pequeno" onClick={() => setApagando(null)}>Cancelar</button>
                          </>
                        ) : (
                          <button className="botao perigo pequeno" onClick={() => setApagando(c.id)}>Apagar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {aberta === c.id && (
                    <tr>
                      <td colSpan={6} style={{ padding: '16px 0' }}>
                        <Resultado empresa={c.empresa} cargo={c.cargo} curriculo={c.resultado.curriculo} analise={c.resultado.analise} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
