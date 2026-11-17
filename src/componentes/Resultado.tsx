// Mostra o resultado de uma vaga: nota, o que falta, mensagem pro recrutador e o PDF.
import { useId, useState } from 'react'
import type { Analise, CurriculoMontado } from '../lib/tipos'
import { Folha } from './Folha'

export const classeDaNota = (n: number) => (n >= 70 ? 'bom' : n >= 40 ? 'medio' : 'fraco')

type Props = { empresa: string; cargo: string; curriculo: CurriculoMontado; analise: Analise }

export function Resultado({ empresa, cargo, curriculo, analise }: Props) {
  const id = useId()
  const [copiado, setCopiado] = useState(false)
  const classe = classeDaNota(analise.nota)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(analise.mensagem)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch { /* navegador bloqueou: a pessoa copia na mão */ }
  }

  return (
    <div>
      <h2>{empresa} — {cargo}</h2>
      <div className="nota" aria-label={`Aderência ${analise.nota} de 100`}>
        <div className={`nota-num ${classe}`}>{analise.nota}%</div>
        <div className="barra"><div className={`fundo-${classe}`} style={{ width: `${analise.nota}%` }} /></div>
      </div>
      <p className="dica">Título usado: {curriculo.titulo || '—'} · Projetos: {curriculo.projetos.map((p) => p.nome).join(', ') || 'nenhum'}</p>

      {analise.alertas.length > 0 && (
        <div className="bloco alertas">
          <h3>Antes de enviar</h3>
          <ul>{analise.alertas.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      )}
      <div className="bloco">
        <h3>Pontos fortes</h3>
        <ul>{analise.pontos_fortes.map((a) => <li key={a}>{a}</li>)}</ul>
      </div>
      <div className="bloco">
        <h3>O que a vaga pede e você ainda não tem</h3>
        <ul>{analise.lacunas.map((a) => <li key={a}>{a}</li>)}</ul>
      </div>
      {analise.faltando.length > 0 && (
        <div className="bloco">
          <h3>Palavras da vaga que não estão no currículo</h3>
          <div className="chips-lista">{analise.faltando.map((f) => <span className="chip-fixo" key={f}>{f}</span>)}</div>
        </div>
      )}

      <div className="bloco">
        <h3 id={`${id}-msg`}>Mensagem pro recrutador</h3>
        <textarea aria-labelledby={`${id}-msg`} readOnly value={analise.mensagem} rows={5} />
        <div className="linha" style={{ marginTop: 8 }}>
          <button className="botao leve pequeno" onClick={copiar}>{copiado ? 'Copiada!' : 'Copiar mensagem'}</button>
        </div>
      </div>

      <Folha curriculo={curriculo} nomeArquivo={`Curriculo - ${curriculo.nome} - ${empresa}`} />
    </div>
  )
}
