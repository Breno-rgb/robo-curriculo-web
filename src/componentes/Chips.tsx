// Campo de "etiquetas": digita e aperta Enter (ou vírgula) pra adicionar; × remove.
import { useId, useState } from 'react'

type Props = { rotulo: string; valor: string[]; aoMudar: (v: string[]) => void; exemplo?: string }

export function Chips({ rotulo, valor, aoMudar, exemplo }: Props) {
  const id = useId()
  const [texto, setTexto] = useState('')

  function adicionar(bruto: string) {
    const novos = bruto.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)
    const semRepetir = novos.filter((n) => !valor.some((v) => v.toLowerCase() === n.toLowerCase()))
    if (semRepetir.length) aoMudar([...valor, ...semRepetir])
    setTexto('')
  }

  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <div className="chips">
        {valor.map((v) => (
          <span className="chip" key={v}>
            {v}
            <button type="button" aria-label={`Remover ${v}`} onClick={() => aoMudar(valor.filter((x) => x !== v))}>×</button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          value={texto}
          placeholder={valor.length ? 'Adicionar…' : exemplo ?? 'Digite e aperte Enter'}
          onChange={(e) => (e.target.value.includes(',') ? adicionar(e.target.value) : setTexto(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); adicionar(texto) }
            if (e.key === 'Backspace' && !texto && valor.length) aoMudar(valor.slice(0, -1))
          }}
          onBlur={() => texto.trim() && adicionar(texto)}
        />
      </div>
    </div>
  )
}
