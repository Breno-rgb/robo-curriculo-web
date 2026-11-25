// A caixa "Quanto pedir": estimativa de salário pra vaga (fica abaixo da aderência).
import type { Estimativa } from '../lib/salario'
import { formatarReais } from '../lib/salario'

export function Salario({ estimativa }: { estimativa: Estimativa | null | undefined }) {
  if (!estimativa) {
    return (
      <div>
        <h3>Quanto pedir</h3>
        <div className="salario-valor apagado">R$ –</div>
        <p className="dica">Aparece aqui uma estimativa de salário pra vaga.</p>
      </div>
    )
  }

  if (estimativa.tipo === 'sem-referencia') {
    return (
      <div>
        <h3>Quanto pedir</h3>
        <p className="dica" style={{ marginTop: 0 }}>{estimativa.detalhes[0]}</p>
        {estimativa.busca && (
          <a className="botao leve pequeno" href={estimativa.busca} target="_blank" rel="noopener noreferrer" style={{ marginTop: 10 }}>
            Pesquisar salário desse cargo ↗
          </a>
        )}
      </div>
    )
  }

  const { faixa, sugestao } = estimativa
  return (
    <div>
      <h3>{estimativa.tipo === 'informado' ? 'Salário da vaga' : 'Quanto pedir (estimativa)'}</h3>
      {sugestao !== undefined && <div className="salario-valor">{formatarReais(sugestao)}</div>}
      {faixa && faixa.min !== faixa.max && (
        <p className="salario-faixa">Faixa: {formatarReais(faixa.min)} – {formatarReais(faixa.max)} <span>por mês</span></p>
      )}
      <ul className="salario-detalhes">{estimativa.detalhes.map((d) => <li key={d}>{d}</li>)}</ul>
      <p className="dica salario-fonte">
        {estimativa.tipo === 'estimado' && 'Estimativa de mercado, não garantia. '}Fonte: {estimativa.fonte}.
      </p>
      {estimativa.busca && (
        <a className="botao leve pequeno" href={estimativa.busca} target="_blank" rel="noopener noreferrer" style={{ marginTop: 10 }}>
          Conferir no Google ↗
        </a>
      )}
    </div>
  )
}
