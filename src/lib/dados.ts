// Camada de dados: as telas só falam com este arquivo, nunca direto com o banco.
//
// - Com VITE_SUPABASE_URL e a chave no .env → contas e dados de verdade no Supabase.
// - Sem isso → "modo demonstração": tudo fica no navegador (igual ao Kurio). Útil pra testar.
//
// Segurança: quem garante que cada pessoa só vê os próprios dados é o banco (RLS, em
// supabase/schema.sql), não este arquivo. A chave "publishable" pode ficar no site.

import { createClient, type AuthError } from '@supabase/supabase-js'
import type { Candidatura, Mestre } from './tipos'

export type Usuario = { id: string; email: string }
export type NovaCandidatura = Omit<Candidatura, 'id' | 'criado_em'>
export type EventoDeSessao = 'entrou' | 'saiu' | 'recuperar-senha'

export type Servico = {
  modo: 'supabase' | 'demo'
  sessaoAtual(): Promise<Usuario | null>
  aoMudarSessao(cb: (u: Usuario | null, evento: EventoDeSessao) => void): () => void
  entrar(email: string, senha: string): Promise<void>
  cadastrar(email: string, senha: string): Promise<{ precisaConfirmar: boolean }>
  sair(): Promise<void>
  esqueciSenha(email: string): Promise<void>
  trocarSenha(nova: string): Promise<void>
  /** Confere a senha e apaga a conta com tudo dentro (currículo e candidaturas). */
  apagarConta(senha: string): Promise<void>
  carregarMestre(): Promise<Mestre | null>
  salvarMestre(m: Mestre): Promise<void>
  listarCandidaturas(): Promise<Candidatura[]>
  criarCandidatura(c: NovaCandidatura): Promise<Candidatura>
  atualizarStatus(id: string, status: string): Promise<void>
  apagarCandidatura(id: string): Promise<void>
  /** Chave da sessão (pra provar ao servidor quem está pedindo). No modo demonstração é null. */
  token(): Promise<string | null>
}

// ---------- mensagens de erro em português ----------

function traduzir(erro: AuthError | { message: string } | null): never {
  const m = erro?.message ?? 'Algo deu errado.'
  const mapa: [RegExp, string][] = [
    [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
    [/already registered|already exists/i, 'Esse e-mail já tem conta. Tente entrar.'],
    [/email not confirmed/i, 'Confirme seu e-mail pelo link que enviamos antes de entrar.'],
    [/at least (\d+) characters/i, 'A senha precisa ter pelo menos 6 caracteres.'],
    [/rate limit|too many/i, 'Muitas tentativas seguidas. Espere um pouco e tente de novo.'],
    [/invalid.*email|unable to validate email/i, 'E-mail inválido.'],
    [/failed to fetch|network/i, 'Sem conexão com o servidor. Confira sua internet.'],
    [/jwt expired|session.*missing/i, 'Sua sessão expirou. Entre de novo.'],
  ]
  throw new Error(mapa.find(([re]) => re.test(m))?.[1] ?? m)
}

// ---------- Supabase (de verdade) ----------

function criarSupabase(url: string, chave: string): Servico {
  const sb = createClient(url, chave)
  const usuario = (u: { id: string; email?: string } | null | undefined): Usuario | null => (u ? { id: u.id, email: u.email ?? '' } : null)

  async function idAtual() {
    const { data } = await sb.auth.getSession()
    const id = data.session?.user.id
    if (!id) throw new Error('Sua sessão expirou. Entre de novo.')
    return id
  }

  return {
    modo: 'supabase',
    async token() {
      const { data } = await sb.auth.getSession()
      return data.session?.access_token ?? null
    },
    async sessaoAtual() {
      const { data } = await sb.auth.getSession()
      return usuario(data.session?.user)
    },
    aoMudarSessao(cb) {
      const { data } = sb.auth.onAuthStateChange((evento, sessao) => {
        if (evento === 'PASSWORD_RECOVERY') cb(usuario(sessao?.user), 'recuperar-senha')
        else if (evento === 'SIGNED_OUT') cb(null, 'saiu')
        else if (evento === 'SIGNED_IN') cb(usuario(sessao?.user), 'entrou')
      })
      return () => data.subscription.unsubscribe()
    },
    async entrar(email, senha) {
      const { error } = await sb.auth.signInWithPassword({ email, password: senha })
      if (error) traduzir(error)
    },
    async cadastrar(email, senha) {
      const { data, error } = await sb.auth.signUp({ email, password: senha, options: { emailRedirectTo: window.location.origin } })
      if (error) traduzir(error)
      // Com "Confirm email" ligado no Supabase, a conta só entra depois do link.
      return { precisaConfirmar: !data.session }
    },
    async sair() {
      await sb.auth.signOut()
    },
    async esqueciSenha(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
      if (error) traduzir(error)
    },
    async trocarSenha(nova) {
      const { error } = await sb.auth.updateUser({ password: nova })
      if (error) traduzir(error)
    },
    async apagarConta(senha) {
      const { data } = await sb.auth.getSession()
      const email = data.session?.user.email
      if (!email) throw new Error('Sua sessão expirou. Entre de novo.')
      // Confirma que é a pessoa mesmo: entra de novo com a senha digitada.
      const { error: erroSenha } = await sb.auth.signInWithPassword({ email, password: senha })
      if (erroSenha) throw new Error('Senha incorreta.')
      // Função do banco (supabase/schema.sql) que apaga o próprio usuário; o resto vai junto (cascade).
      const { error } = await sb.rpc('apagar_minha_conta')
      if (error) traduzir(error)
      await sb.auth.signOut()
    },
    async carregarMestre() {
      const { data, error } = await sb.from('curriculos').select('dados').eq('user_id', await idAtual()).maybeSingle()
      if (error) traduzir(error)
      return (data?.dados as Mestre | undefined) ?? null
    },
    async salvarMestre(m) {
      const { error } = await sb.from('curriculos').upsert({ user_id: await idAtual(), dados: m, atualizado_em: new Date().toISOString() })
      if (error) traduzir(error)
    },
    async listarCandidaturas() {
      const { data, error } = await sb.from('candidaturas').select('*').order('criado_em', { ascending: false })
      if (error) traduzir(error)
      return (data ?? []) as Candidatura[]
    },
    async criarCandidatura(c) {
      const { data, error } = await sb.from('candidaturas').insert({ ...c, user_id: await idAtual() }).select().single()
      if (error) traduzir(error)
      return data as Candidatura
    },
    async atualizarStatus(id, status) {
      const { error } = await sb.from('candidaturas').update({ status }).eq('id', id)
      if (error) traduzir(error)
    },
    async apagarCandidatura(id) {
      const { error } = await sb.from('candidaturas').delete().eq('id', id)
      if (error) traduzir(error)
    },
  }
}

// ---------- Modo demonstração (tudo no navegador) ----------

type BancoDemo = {
  usuarios: { id: string; email: string; senhaHash: string }[]
  sessao: string | null
  mestres: Record<string, Mestre>
  candidaturas: (Candidatura & { user_id: string })[]
}

const CHAVE_DEMO = 'robo-curriculo-demo-v1'

function lerDemo(): BancoDemo {
  try {
    const salvo = localStorage.getItem(CHAVE_DEMO)
    if (salvo) return JSON.parse(salvo) as BancoDemo
  } catch { /* sem localStorage: começa vazio */ }
  return { usuarios: [], sessao: null, mestres: {}, candidaturas: [] }
}

async function hash(texto: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function criarDemo(): Servico {
  const banco = lerDemo()
  const salvar = () => {
    try { localStorage.setItem(CHAVE_DEMO, JSON.stringify(banco)) } catch { /* aba anônima: fica só na memória */ }
  }
  const ouvintes = new Set<(u: Usuario | null, e: EventoDeSessao) => void>()
  const atual = (): Usuario | null => {
    const u = banco.usuarios.find((x) => x.id === banco.sessao)
    return u ? { id: u.id, email: u.email } : null
  }
  const exigir = () => {
    const u = atual()
    if (!u) throw new Error('Sua sessão expirou. Entre de novo.')
    return u.id
  }
  const avisar = (e: EventoDeSessao) => ouvintes.forEach((cb) => cb(atual(), e))
  const normEmail = (e: string) => e.trim().toLowerCase()

  return {
    modo: 'demo',
    async token() { return null },
    async sessaoAtual() { return atual() },
    aoMudarSessao(cb) { ouvintes.add(cb); return () => ouvintes.delete(cb) },
    async entrar(email, senha) {
      const u = banco.usuarios.find((x) => x.email === normEmail(email))
      if (!u || u.senhaHash !== (await hash(u.id + senha))) throw new Error('E-mail ou senha incorretos.')
      banco.sessao = u.id; salvar(); avisar('entrou')
    },
    async cadastrar(email, senha) {
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('E-mail inválido.')
      if (senha.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.')
      if (banco.usuarios.some((x) => x.email === normEmail(email))) throw new Error('Esse e-mail já tem conta. Tente entrar.')
      const id = crypto.randomUUID()
      banco.usuarios.push({ id, email: normEmail(email), senhaHash: await hash(id + senha) })
      banco.sessao = id; salvar(); avisar('entrou')
      return { precisaConfirmar: false }
    },
    async sair() { banco.sessao = null; salvar(); avisar('saiu') },
    async esqueciSenha() { throw new Error('No modo demonstração não dá pra recuperar senha. Crie outra conta.') },
    async trocarSenha(nova) {
      const id = exigir()
      const u = banco.usuarios.find((x) => x.id === id)!
      u.senhaHash = await hash(id + nova); salvar()
    },
    async apagarConta(senha) {
      const id = exigir()
      const u = banco.usuarios.find((x) => x.id === id)!
      if (u.senhaHash !== (await hash(id + senha))) throw new Error('Senha incorreta.')
      banco.usuarios = banco.usuarios.filter((x) => x.id !== id)
      delete banco.mestres[id]
      banco.candidaturas = banco.candidaturas.filter((c) => c.user_id !== id)
      banco.sessao = null; salvar(); avisar('saiu')
    },
    async carregarMestre() { return banco.mestres[exigir()] ?? null },
    async salvarMestre(m) { banco.mestres[exigir()] = m; salvar() },
    async listarCandidaturas() {
      const id = exigir()
      return banco.candidaturas.filter((c) => c.user_id === id).sort((a, b) => b.criado_em.localeCompare(a.criado_em))
    },
    async criarCandidatura(c) {
      const nova = { ...c, id: crypto.randomUUID(), criado_em: new Date().toISOString(), user_id: exigir() }
      banco.candidaturas.push(nova); salvar()
      return nova
    },
    async atualizarStatus(id, status) {
      const c = banco.candidaturas.find((x) => x.id === id && x.user_id === exigir())
      if (c) { c.status = status; salvar() }
    },
    async apagarCandidatura(id) {
      const dono = exigir()
      banco.candidaturas = banco.candidaturas.filter((x) => !(x.id === id && x.user_id === dono)); salvar()
    },
  }
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const chave = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined

export const dados: Servico = url && chave ? criarSupabase(url, chave) : criarDemo()
