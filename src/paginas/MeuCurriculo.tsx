// Editor do currículo-mestre: tudo que é verdade sobre a pessoa.
// O robô nunca escreve aqui: ele só lê, escolhe e reordena.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { Experiencia, Formacao, Mestre, Projeto } from '../lib/tipos'
import { importarMestre, mestreExemplo, mestreVazio, novoId } from '../lib/mestre'
import { lerCurriculo, lerCurriculoComIA, resumoDoImport, textoDoPdf } from '../lib/lerPdf'
import { Chips } from '../componentes/Chips'

type Props = { mestre: Mestre; aoSalvar: (m: Mestre) => Promise<void> }

// ---------- pecinhas do formulário ----------

function Texto({ rotulo, valor, aoMudar, tipo = 'text', inteiro, exemplo }: {
  rotulo: string; valor: string; aoMudar: (v: string) => void; tipo?: string; inteiro?: boolean; exemplo?: string
}) {
  const id = useId()
  return (
    <div className={`campo${inteiro ? ' campo-inteiro' : ''}`}>
      <label htmlFor={id}>{rotulo}</label>
      <input id={id} type={tipo} value={valor} placeholder={exemplo} onChange={(e) => aoMudar(e.target.value)} />
    </div>
  )
}

function Paragrafo({ rotulo, valor, aoMudar, exemplo }: { rotulo: string; valor: string; aoMudar: (v: string) => void; exemplo?: string }) {
  const id = useId()
  return (
    <div className="campo campo-inteiro">
      <label htmlFor={id}>{rotulo}</label>
      <textarea id={id} rows={3} value={valor} placeholder={exemplo} onChange={(e) => aoMudar(e.target.value)} />
    </div>
  )
}

/** Uma linha = um item. Guarda o texto cru enquanto a pessoa digita (senão o Enter some). */
function Linhas({ rotulo, valor, aoMudar, exemplo }: { rotulo: string; valor: string[]; aoMudar: (v: string[]) => void; exemplo?: string }) {
  const id = useId()
  const [cru, setCru] = useState(valor.join('\n'))
  return (
    <div className="campo campo-inteiro">
      <label htmlFor={id}>{rotulo}</label>
      <textarea
        id={id} rows={3} value={cru} placeholder={exemplo}
        onChange={(e) => { setCru(e.target.value); aoMudar(e.target.value.split('\n').map((l) => l.trim()).filter(Boolean)) }}
      />
    </div>
  )
}

function Secao({ titulo, dica, children }: { titulo: string; dica?: string; children: ReactNode }) {
  return (
    <section className="cartao">
      <h2>{titulo}</h2>
      {dica && <p className="sub">{dica}</p>}
      {children}
    </section>
  )
}

/** Botões de subir, descer e remover de um item de lista. */
function Controles<T>({ lista, i, aoMudar, nome }: { lista: T[]; i: number; aoMudar: (l: T[]) => void; nome: string }) {
  const mover = (d: number) => {
    const nova = [...lista]
    ;[nova[i], nova[i + d]] = [nova[i + d], nova[i]]
    aoMudar(nova)
  }
  return (
    <>
      <button type="button" className="botao leve pequeno" disabled={i === 0} onClick={() => mover(-1)} aria-label={`Subir ${nome}`}>↑</button>
      <button type="button" className="botao leve pequeno" disabled={i === lista.length - 1} onClick={() => mover(1)} aria-label={`Descer ${nome}`}>↓</button>
      <button type="button" className="botao perigo pequeno" onClick={() => aoMudar(lista.filter((_, j) => j !== i))} aria-label={`Remover ${nome}`}>Remover</button>
    </>
  )
}

// ---------- a página ----------

export function MeuCurriculo({ mestre, aoSalvar }: Props) {
  const [m, setM] = useState<Mestre>(mestre)
  const [versao, setVersao] = useState(0) // muda quando o currículo é trocado inteiro (importar/exemplo)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [lendoPdf, setLendoPdf] = useState(false)
  // Qual botão está pedindo confirmação agora (os dois apagam o que está preenchido).
  const [confirmando, setConfirmando] = useState<'exemplo' | 'limpar' | null>(null)
  const arquivo = useRef<HTMLInputElement>(null)
  const arquivoJson = useRef<HTMLInputElement>(null)

  const alterado = JSON.stringify(m) !== JSON.stringify(mestre)
  const semIds = (x: Mestre) => JSON.stringify({ ...x, grupos: x.grupos.map((g) => g.itens) })
  const vazio = semIds(m) === semIds(mestreVazio())

  // Avisa antes de fechar a aba com alteração não salva.
  useEffect(() => {
    if (!alterado) return
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [alterado])

  const muda = <K extends keyof Mestre>(chave: K, valor: Mestre[K]) => { setM((x) => ({ ...x, [chave]: valor })); setMsg(null) }
  const contato = (chave: keyof Mestre['contatos']) => (v: string) => muda('contatos', { ...m.contatos, [chave]: v })
  const titulo = (chave: keyof Mestre['titulos']) => (v: string) => muda('titulos', { ...m.titulos, [chave]: v })
  const trocarTudo = (novo: Mestre) => { setM(novo); setVersao((v) => v + 1); setMsg(null) }

  function editarItem<T extends { id: string }>(chave: 'experiencias' | 'projetos' | 'formacao', id: string, parcial: Partial<T>) {
    muda(chave, (m[chave] as unknown as T[]).map((x) => (x.id === id ? { ...x, ...parcial } : x)) as never)
  }

  async function salvar() {
    setSalvando(true); setMsg(null)
    try {
      await aoSalvar(m)
      setMsg({ tipo: 'ok', texto: 'Currículo salvo.' })
    } catch (falha) {
      setMsg({ tipo: 'erro', texto: (falha as Error).message })
    } finally {
      setSalvando(false)
    }
  }

  // Lê o PDF do currículo e preenche. Primeiro tenta com IA (organiza bem qualquer modelo de currículo);
  // se a IA não estiver disponível, usa o leitor sem IA. Nada é salvo antes da pessoa conferir.
  async function importarPdf(f: File | undefined) {
    if (arquivo.current) arquivo.current.value = ''
    if (!f) return
    setLendoPdf(true); setMsg(null)
    try {
      const linhas = await textoDoPdf(f)
      if (linhas.length < 3) throw new Error('Não deu pra ler texto nesse PDF (ele pode ser uma imagem escaneada).')
      const comIA = await lerCurriculoComIA(linhas)
      const lido = { ...(comIA ?? lerCurriculo(linhas)), cor: m.cor }
      trocarTudo(lido)
      setMsg({
        tipo: 'ok',
        texto: `Lemos: ${resumoDoImport(lido) || 'pouca coisa'}. Confira e clique em Salvar.${comIA ? '' : ' (Leitura sem IA: confira com atenção.)'}`,
      })
    } catch (falha) {
      const texto = (falha as Error).message
      setMsg({ tipo: 'erro', texto: /^(Não|Muita|Entre|A IA)/.test(texto) ? texto : 'Não consegui ler esse PDF. Tente outro arquivo.' })
    } finally {
      setLendoPdf(false)
    }
  }

  // Arquivo .json: o jeito mais preciso (cada informação já vem no lugar certo).
  async function importarJson(f: File | undefined) {
    if (arquivoJson.current) arquivoJson.current.value = ''
    if (!f) return
    setMsg(null)
    try {
      const lido = { ...importarMestre(await f.text()), cor: m.cor }
      trocarTudo(lido)
      setMsg({ tipo: 'ok', texto: `Lemos: ${resumoDoImport(lido) || 'pouca coisa'}. Confira e clique em Salvar.` })
    } catch (falha) {
      setMsg({ tipo: 'erro', texto: falha instanceof SyntaxError ? 'Esse arquivo não é um JSON válido.' : (falha as Error).message })
    }
  }

  // Modelo em branco pra preencher (ou pedir pra uma IA preencher com o seu currículo).
  function baixarModelo() {
    const blob = new Blob([JSON.stringify(mestreExemplo(), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'modelo-curriculo-mestre.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function gerarExemplo() {
    if (!vazio && confirmando !== 'exemplo') return setConfirmando('exemplo')
    setConfirmando(null)
    trocarTudo(mestreExemplo())
    setMsg({ tipo: 'ok', texto: 'Exemplo preenchido. Troque pelos seus dados e salve.' })
  }

  // Esvazia o formulário. Só vale de verdade depois do "Salvar" (antes disso, "Desfazer" volta tudo).
  function limparTudo() {
    if (confirmando !== 'limpar') return setConfirmando('limpar')
    setConfirmando(null)
    trocarTudo(mestreVazio())
    setMsg({ tipo: 'ok', texto: 'Tudo limpo. Clique em Salvar pra confirmar (ou Desfazer pra voltar).' })
  }

  const novoProjeto = (): Projeto => ({ id: novoId(), nome: '', link: '', codigo: '', stack: [], descricao: '', destaques: [], palavras: [], fixo: false })
  const novaExperiencia = (): Experiencia => ({ id: novoId(), cargo: '', local: '', periodo: '', bullets: [], opcional: false })
  const novaFormacao = (): Formacao => ({ id: novoId(), curso: '', instituicao: '', periodo: '' })

  return (
    <div key={versao}>
      <div className="cabecalho-pagina">
        <div>
          <h1>Currículo mestre</h1>
          <p className="sub">Tudo que é verdade sobre você. Pra cada vaga, o robô escolhe o que combina. Nenhum campo é obrigatório.</p>
        </div>
        <div className="ferramentas">
          <button type="button" className="botao leve" onClick={() => arquivo.current?.click()} disabled={lendoPdf}>
            {lendoPdf ? 'Lendo o PDF…' : 'Importar PDF'}
          </button>
          <input ref={arquivo} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => importarPdf(e.target.files?.[0])} />
          <button type="button" className="botao leve" onClick={() => arquivoJson.current?.click()} disabled={lendoPdf}>Importar JSON</button>
          <input ref={arquivoJson} type="file" accept="application/json,.json" hidden onChange={(e) => importarJson(e.target.files?.[0])} />
          {confirmando === 'exemplo' ? (
            <>
              <span className="dica" style={{ margin: 0, alignSelf: 'center' }}>Substituir o que está preenchido?</span>
              <button type="button" className="botao perigo-cheio" onClick={gerarExemplo}>Confirmar</button>
              <button type="button" className="botao leve" onClick={() => setConfirmando(null)}>Cancelar</button>
            </>
          ) : confirmando === 'limpar' ? (
            <>
              <span className="dica" style={{ margin: 0, alignSelf: 'center' }}>Apagar tudo que está preenchido?</span>
              <button type="button" className="botao perigo-cheio" onClick={limparTudo}>Confirmar</button>
              <button type="button" className="botao leve" onClick={() => setConfirmando(null)}>Cancelar</button>
            </>
          ) : (
            <>
              {!vazio && <button type="button" className="botao perigo" onClick={limparTudo}>Limpar tudo</button>}
              <button type="button" className="botao brilho" onClick={gerarExemplo}>✦ Gerar exemplo</button>
            </>
          )}
        </div>
      </div>

      <p className="dica-caixa">
        <span aria-hidden="true">💡</span>
        <span>
          <strong>Dica:</strong> importar em <strong>JSON</strong> é o jeito mais preciso, porque cada informação já vem no lugar certo.
          Já tem uma cópia? Ela fica em <a href="#perfil">Perfil → Cópia de segurança</a>. Não tem?{' '}
          <button type="button" className="link-botao" onClick={baixarModelo}>Baixe o modelo</button> e preencha,
          ou use <strong>Importar PDF</strong> que o robô organiza pra você.
        </span>
      </p>

      <Secao titulo="Dados pessoais">
        <div className="campos">
          <Texto rotulo="Nome completo" valor={m.nome} aoMudar={(v) => muda('nome', v)} />
          <Texto rotulo="Título padrão" valor={m.titulo_padrao} aoMudar={(v) => muda('titulo_padrao', v)} exemplo="Desenvolvedor Web · Estudante de ADS" />
          <Texto rotulo="Cidade" valor={m.contatos.cidade} aoMudar={contato('cidade')} exemplo="São Paulo – SP" />
          <Texto rotulo="Telefone" valor={m.contatos.telefone} aoMudar={contato('telefone')} tipo="tel" />
          <Texto rotulo="E-mail" valor={m.contatos.email} aoMudar={contato('email')} tipo="email" />
          <Texto rotulo="LinkedIn" valor={m.contatos.linkedin} aoMudar={contato('linkedin')} exemplo="linkedin.com/in/seu-nome" />
          <Texto rotulo="GitHub" valor={m.contatos.github} aoMudar={contato('github')} exemplo="github.com/seu-usuario" />
          <Texto rotulo="Portfólio" valor={m.contatos.portfolio} aoMudar={contato('portfolio')} exemplo="seu-usuario.github.io" />
        </div>
      </Secao>

      <Secao titulo="Resumo" dica="2 ou 3 frases. O robô acrescenta, no fim, as tecnologias da vaga que você tem.">
        <Paragrafo rotulo="Resumo" valor={m.resumo_base} aoMudar={(v) => muda('resumo_base', v)} />
      </Secao>

      <Secao titulo="Competências técnicas" dica="Separe em grupos. As que a vaga pedir aparecem em negrito e na frente.">
        {m.grupos.map((g, i) => (
          <div className="item-editavel" key={g.id}>
            <div className="item-topo">
              <strong>{g.nome || 'Grupo sem nome'}</strong>
              <Controles lista={m.grupos} i={i} aoMudar={(l) => muda('grupos', l)} nome={`grupo ${g.nome}`} />
            </div>
            <div className="campos">
              <Texto rotulo="Nome do grupo" valor={g.nome} aoMudar={(v) => muda('grupos', m.grupos.map((x) => (x.id === g.id ? { ...x, nome: v } : x)))} />
              <div className="campo-inteiro">
                <Chips rotulo="Competências" valor={g.itens} exemplo="React, TypeScript…" aoMudar={(v) => muda('grupos', m.grupos.map((x) => (x.id === g.id ? { ...x, itens: v } : x)))} />
              </div>
            </div>
          </div>
        ))}
        <div className="linha"><button type="button" className="botao leve" onClick={() => muda('grupos', [...m.grupos, { id: novoId(), nome: '', itens: [] }])}>+ Grupo</button></div>
      </Secao>

      <Secao titulo="Projetos" dica="Marque como fixo o seu melhor projeto: ele sempre entra, em primeiro. Os outros entram conforme a vaga.">
        {m.projetos.map((p, i) => (
          <div className="item-editavel" key={p.id}>
            <div className="item-topo">
              <strong>{p.nome || 'Projeto sem nome'}</strong>
              <Controles lista={m.projetos} i={i} aoMudar={(l) => muda('projetos', l)} nome={`projeto ${p.nome}`} />
            </div>
            <div className="campos">
              <Texto rotulo="Nome" valor={p.nome} aoMudar={(v) => editarItem<Projeto>('projetos', p.id, { nome: v })} />
              <Texto rotulo="Link do site" valor={p.link} aoMudar={(v) => editarItem<Projeto>('projetos', p.id, { link: v })} />
              <Texto rotulo="Link do código" valor={p.codigo} aoMudar={(v) => editarItem<Projeto>('projetos', p.id, { codigo: v })} />
              <div className="campo-inteiro"><Chips rotulo="Tecnologias" valor={p.stack} aoMudar={(v) => editarItem<Projeto>('projetos', p.id, { stack: v })} /></div>
              <Paragrafo rotulo="Descrição" valor={p.descricao} aoMudar={(v) => editarItem<Projeto>('projetos', p.id, { descricao: v })} />
              <Linhas rotulo="Destaques (um por linha, opcional)" valor={p.destaques} aoMudar={(v) => editarItem<Projeto>('projetos', p.id, { destaques: v })} />
              <div className="campo-inteiro"><Chips rotulo="Temas (ajudam a achar vagas parecidas)" valor={p.palavras} exemplo="e-commerce, login, testes…" aoMudar={(v) => editarItem<Projeto>('projetos', p.id, { palavras: v })} /></div>
              <label className="marcar"><input type="checkbox" checked={p.fixo} onChange={(e) => editarItem<Projeto>('projetos', p.id, { fixo: e.target.checked })} /> Fixo (sempre entra, em primeiro)</label>
            </div>
          </div>
        ))}
        <div className="linha"><button type="button" className="botao leve" onClick={() => muda('projetos', [...m.projetos, novoProjeto()])}>+ Projeto</button></div>
      </Secao>

      <Secao titulo="Experiência" dica="Em ordem, da mais recente pra mais antiga. Marque como opcional a que pode sair quando faltar espaço.">
        {m.experiencias.map((e, i) => (
          <div className="item-editavel" key={e.id}>
            <div className="item-topo">
              <strong>{e.cargo || 'Experiência sem cargo'}</strong>
              <Controles lista={m.experiencias} i={i} aoMudar={(l) => muda('experiencias', l)} nome={`experiência ${e.cargo}`} />
            </div>
            <div className="campos">
              <Texto rotulo="Cargo" valor={e.cargo} aoMudar={(v) => editarItem<Experiencia>('experiencias', e.id, { cargo: v })} />
              <Texto rotulo="Empresa / local" valor={e.local} aoMudar={(v) => editarItem<Experiencia>('experiencias', e.id, { local: v })} />
              <Texto rotulo="Período" valor={e.periodo} aoMudar={(v) => editarItem<Experiencia>('experiencias', e.id, { periodo: v })} exemplo="2024 – atual" />
              <Linhas rotulo="O que você fez (um por linha)" valor={e.bullets} aoMudar={(v) => editarItem<Experiencia>('experiencias', e.id, { bullets: v })} />
              <label className="marcar"><input type="checkbox" checked={e.opcional} onChange={(ev) => editarItem<Experiencia>('experiencias', e.id, { opcional: ev.target.checked })} /> Opcional (sai primeiro se não couber em 1 página)</label>
            </div>
          </div>
        ))}
        <div className="linha"><button type="button" className="botao leve" onClick={() => muda('experiencias', [...m.experiencias, novaExperiencia()])}>+ Experiência</button></div>
      </Secao>

      <Secao titulo="Formação">
        {m.formacao.map((f, i) => (
          <div className="item-editavel" key={f.id}>
            <div className="item-topo">
              <strong>{f.curso || 'Curso sem nome'}</strong>
              <Controles lista={m.formacao} i={i} aoMudar={(l) => muda('formacao', l)} nome={`formação ${f.curso}`} />
            </div>
            <div className="campos">
              <Texto rotulo="Curso" valor={f.curso} aoMudar={(v) => editarItem<Formacao>('formacao', f.id, { curso: v })} />
              <Texto rotulo="Instituição" valor={f.instituicao} aoMudar={(v) => editarItem<Formacao>('formacao', f.id, { instituicao: v })} />
              <Texto rotulo="Período" valor={f.periodo} aoMudar={(v) => editarItem<Formacao>('formacao', f.id, { periodo: v })} exemplo="2025 – 2027 (previsão)" />
            </div>
          </div>
        ))}
        <div className="linha"><button type="button" className="botao leve" onClick={() => muda('formacao', [...m.formacao, novaFormacao()])}>+ Formação</button></div>
      </Secao>

      <Secao titulo="Outros">
        <div className="campos">
          <div className="campo-inteiro"><Chips rotulo="Competências comportamentais" valor={m.comportamentais} exemplo="Comunicação, trabalho em equipe…" aoMudar={(v) => muda('comportamentais', v)} /></div>
          <div className="campo-inteiro"><Chips rotulo="Idiomas (com nível)" valor={m.idiomas} exemplo="Inglês — intermediário" aoMudar={(v) => muda('idiomas', v)} /></div>
        </div>
      </Secao>

      <Secao titulo="Opções avançadas">
        <details className="avancado">
        <summary>Títulos diferentes por tipo de vaga</summary>
        <p className="sub">Quando a vaga for desse tipo, o robô usa este título no lugar do padrão. Só coloque o que for verdade.</p>
        <div className="campos">
          <Texto rotulo="Vaga de front-end" valor={m.titulos.front} aoMudar={titulo('front')} exemplo="Desenvolvedor Front-end" />
          <Texto rotulo="Vaga full-stack" valor={m.titulos.full} aoMudar={titulo('full')} />
          <Texto rotulo="Vaga de back-end" valor={m.titulos.back} aoMudar={titulo('back')} />
          <Texto rotulo="Vaga de estágio" valor={m.titulos.estagio} aoMudar={titulo('estagio')} exemplo="Estudante de ADS · Desenvolvedor Web" />
        </div>
        </details>
      </Secao>

      {(alterado || msg) && (
        <div className="barra-salvar" role="region" aria-label="Salvar alterações">
          {msg && <span className={msg.tipo === 'ok' ? 'bom' : 'fraco'} role="status">{msg.texto}</span>}
          {alterado && (
            <>
              <button type="button" className="botao leve" onClick={() => trocarTudo(mestre)} disabled={salvando}>Desfazer</button>
              <button type="button" className="botao" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
