# Robô de Currículo (versão online)

Cada pessoa cria uma conta, cadastra o próprio **currículo-mestre** (tudo que é verdade sobre ela) e, pra cada vaga colada, recebe:

- um **currículo de 1 página** adaptado à vaga, pronto pra salvar em PDF (legível por sistemas de triagem/ATS, links clicáveis);
- **nota de aderência**, o que a vaga pede e a pessoa ainda não tem, e alertas (nível pleno/sênior, anos de experiência, inglês, presencial);
- uma **mensagem pronta pro recrutador**;
- um histórico de **candidaturas** com status (enviado, entrevista, recusado...).

O robô só **escolhe e reordena** o que está no currículo-mestre. Nunca inventa tecnologia, cargo ou tempo de experiência.

## Stack

| Peça | Por que |
| --- | --- |
| React 19 + TypeScript | Interface e tipos dos dados |
| Vite | Build e servidor de desenvolvimento |
| Supabase | Contas (Auth) e banco Postgres com RLS: cada pessoa só vê os próprios dados |
| CSS puro | Estilo sem dependências |
| Impressão do navegador | O PDF sai do próprio navegador ("Salvar como PDF"), sem servidor |

A análise da vaga roda **no navegador**, sem IA e sem custo.

## Rodar no seu PC

```bash
npm install
npm run dev
```

Sem o `.env`, o app abre em **modo demonstração**: contas e dados ficam só no navegador. Serve pra testar.

## Configurar o Supabase (contas de verdade)

1. Crie um projeto em [supabase.com](https://supabase.com) (plano grátis).
2. **SQL Editor → New query**: cole o conteúdo de `supabase/schema.sql` e clique em **Run**. Isso cria as tabelas e as regras de segurança (RLS).
3. **Project Settings → API**: copie a **Project URL** e a chave **publishable** (ou "anon public").
4. Copie `.env.example` para `.env` e cole os dois valores.
5. **Authentication → Sign In / Providers → Email**: desligue **Confirm email** por enquanto.
   O e-mail padrão do Supabase só envia para os membros do seu time, então sem um SMTP próprio (Resend, Brevo...) outras pessoas não receberiam o link de confirmação. Pelo mesmo motivo, "Esqueci a senha" só funciona com SMTP configurado.

Nunca use a chave **secret / service_role** no site. A publishable pode ficar pública porque quem protege os dados é o RLS.

## Publicar na Vercel

1. Suba este projeto pro GitHub (o `.env` não sobe, está no `.gitignore`).
2. Na Vercel: **Add New → Project →** escolha o repositório. Framework: Vite (detecta sozinho).
3. Em **Environment Variables**, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` com os mesmos valores do `.env`.
4. **Deploy**.
5. No Supabase, **Authentication → URL Configuration**: em **Site URL**, coloque o endereço que a Vercel deu (ex.: `https://robo-curriculo.vercel.app`).

## Mapa dos arquivos

| Arquivo | O que faz |
| --- | --- |
| `src/App.tsx` | Tela de entrada ou app logado; menu (Currículo mestre, Currículos realizados, Perfil, Sair) |
| `src/paginas/Entrar.tsx` | Entrar, criar conta, recuperar senha |
| `src/paginas/Inicio.tsx` | Cola a vaga → gera. Do lado: PDF (Visualizar/Baixar) e aderência |
| `src/paginas/MeuCurriculo.tsx` | Currículo mestre: formulário, "Gerar exemplo" e "Importar currículo (PDF)" |
| `src/paginas/Realizados.tsx` | Currículos gerados, com status, visualizar e apagar |
| `src/paginas/Perfil.tsx` | Trocar senha, cópia de segurança (.json) e apagar conta (pede a senha) |
| `src/componentes/Folha.tsx` | A folha A4 (prévia) e o "Visualizar" em tela cheia |
| `src/componentes/Aderencia.tsx` | A caixa da nota, pontos fortes e o que falta |
| `src/lib/analise.ts` | O cérebro: lê a vaga (de qualquer área), calcula a nota e monta o currículo |
| `src/lib/salario.ts` | Estimativa de salário ("Quanto pedir") |
| `src/lib/lerPdf.ts` | Lê o PDF do currículo (pdf.js) e preenche o currículo mestre |
| `src/lib/curriculoHtml.ts` | O desenho do currículo (A4) |
| `src/lib/pdf.ts` | Faz caber em 1 página e abre a impressão |
| `src/lib/dados.ts` | Fala com o Supabase (ou com o navegador no modo demonstração) |
| `supabase/schema.sql` | Tabelas, regras de segurança (RLS) e a função de apagar conta |

## Quanto pedir (estimativa de salário)

Fica abaixo da aderência. É uma referência, não garantia:

1. Se a vaga informa o salário, mostra o valor da vaga (ignora VR, VT e outros benefícios).
2. Vagas de tecnologia: faixa por área (front, back, full-stack), nível e regime (CLT/PJ), da [tabela de cargos e salários TI 2026 da Nerdin](https://www.nerdin.com.br/plano_de_cargos_e_salarios_ti.php).
3. Outras profissões: piso, média e teto de contratação CLT do Novo CAGED, via [salario.com.br](https://www.salario.com.br/tabela-salarial/) (nov/2026), mais algumas médias nacionais.
4. Cargo fora das tabelas: o app avisa e oferece uma busca, em vez de chutar.

Os valores ficam em `src/lib/salario.ts` e precisam de atualização de tempos em tempos.

## Importar currículo em PDF

Sem IA: o app lê o texto do PDF, procura os títulos de seção (Experiência, Formação, Projetos...), e-mail, telefone, links e as tecnologias que conhece. Funciona melhor com PDF de texto (não escaneado). A pessoa sempre confere antes de salvar.

## Apagar conta

O Perfil pede a senha (o app entra de novo com ela pra confirmar) e chama a função `apagar_minha_conta()` do banco, que só consegue apagar quem está logado. O currículo e os currículos gerados somem junto.

## Cabe em 1 página

Se não couber, o app vai enxugando nesta ordem: letra 4% menor → 3 projetos → tira a experiência marcada como "opcional" → menos bullets → letra menor. O que foi feito aparece embaixo do botão de baixar.

## Limitações

- O PDF sai pela janela de impressão do navegador. Funciona melhor no computador (Chrome/Edge).
- A análise é por palavras-chave, não entende sinônimos que não estejam no catálogo de `analise.ts`.
