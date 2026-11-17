// A caixa da nota: porcentagem de aderência, pontos fortes, o que falta e a mensagem pro recrutador.
import { useState } from 'react'
import type { Analise } from '../lib/tipos'

export const classeDaNota = (n: number) => (n >= 70 ? 'bom' : n >= 40 ? 'medio' : 'fraco')

export function Aderencia({ analise }: { analise: Analise | null }) {
  const [copiado, setCopiado] = useState(false)

  if (!analise) {
    return (
      <div>
        <h3>Aderência à vaga</h3>
        <div className="nota"><div className="nota-num" style={{ color: 'var(--borda-forte)' }}>–%</div><div className="barra" /></div>
        <p className="dica">Cole uma vaga e clique em gerar.</p>
      </div>
    )
  }

  const classe = classeDaNota(analise.nota)
  // "Lacunas" sem o texto padrão de quando não falta nada
  const falta = analise.lacunas.filter((l) => !l.startsWith('Nenhum requisito') && !l.startsWith('O robô não reconheceu'))
  const semSinais = analise.lacunas.find((l) => l.startsWith('O robô não reconheceu'))

  async function copiar() {
    try {
      await navigator.clipboard.writeText(analise!.mensagem)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch { /* navegador bloqueou a área de transferência */ }
  }

  return (
    <div>
      <h3>Aderência à vaga</h3>
      <div className="nota" aria-label={`Aderência ${analise.nota} de 100`}>
        <div className={`nota-num ${classe}`}>{analise.nota}%</div>
        <div className="barra"><div className={`fundo-${classe}`} style={{ width: `${analise.nota}%` }} /></div>
      </div>

      {semSinais && <p className="dica">{semSinais}</p>}

      <div className="bloco">
        <h3>Pontos fortes</h3>
        <ul>{analise.pontos_fortes.map((p) => <li key={p}>{p}</li>)}</ul>
      </div>

      {falta.length > 0 && (
        <div className="bloco">
          <h3>Ainda falta</h3>
          <div className="chips-lista">
            {falta.map((f) => <span className="chip-fixo" key={f}>{f.replace(/^(Requisito|Diferencial \(não obrigatório\)): /, '').replace(/ \(não está no seu currículo\)$/, '')}{f.startsWith('Diferencial') ? ' (bônus)' : ''}</span>)}
          </div>
        </div>
      )}

      {analise.alertas.length > 0 && (
        <div className="bloco alertas"><ul>{analise.alertas.map((a) => <li key={a}>{a}</li>)}</ul></div>
      )}

      <div className="linha">
        <button className="botao leve pequeno" onClick={copiar}>{copiado ? 'Mensagem copiada!' : 'Copiar mensagem pro recrutador'}</button>
      </div>
    </div>
  )
}
