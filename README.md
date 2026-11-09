# Funil CRM (versão funcional)

O mesmo visual do protótipo, agora com login da equipe, banco de dados na nuvem (Supabase) e recebimento real de leads do site.

## Arquivos

- `index.html` — o CRM (abre direto no navegador)
- `config.js` — **você preenche** com os dados do seu Supabase
- `supabase/schema.sql` — cria as tabelas e as regras de segurança
- `supabase/functions/lead-webhook/index.ts` — recebe os leads do formulário do site

## Passo a passo (cerca de 15 minutos)

### 1. Criar o projeto
1. Entre em https://supabase.com e crie uma conta gratuita.
2. Clique em **New project**, dê um nome (ex.: `funil-crm`), escolha uma senha para o banco e a região **São Paulo**.

### 2. Criar as tabelas
1. No menu lateral: **SQL Editor** → **New query**.
2. Abra `supabase/schema.sql`, copie tudo, cole e clique em **Run**.

### 3. Criar os usuários da equipe
1. **Authentication** → **Users** → **Add user** → **Create new user**.
2. Informe e-mail e senha de cada pessoa e marque **Auto Confirm User**.
3. Em **Authentication → Sign In / Providers → Email**, desative **Allow new users to sign up** para ninguém de fora criar conta.

### 4. Ligar o CRM ao Supabase
1. **Project Settings → API**: copie **Project URL** e a chave **anon public**.
2. Cole os dois em `config.js`.

### 5. Publicar a função que recebe leads do site
1. **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nome: `lead-webhook`. Cole o conteúdo de `supabase/functions/lead-webhook/index.ts`.
3. Em **Settings** da função, **desative "Verify JWT"** (o site envia a chave de API do CRM, não um login) e faça o **Deploy**.

> Pelo terminal: `supabase functions deploy lead-webhook --no-verify-jwt`.

### 6. Usar
- Abra `index.html` no navegador e entre com o e-mail e a senha criados.
- Em **Ajustes**, cadastre os nomes da equipe (o rodízio de leads usa essa lista).
- Em **Integração**, copie o código do formulário e cole no seu site. Use **Enviar lead de teste** para conferir.
- Para a equipe acessar de qualquer lugar, publique esta pasta em um host de sites estáticos (Netlify, Vercel, Cloudflare Pages ou GitHub Pages).

## O que é real agora

| Recurso | Como funciona |
|---|---|
| Login | E-mail e senha pelo Supabase Auth |
| Leads, tarefas, equipe, notas, histórico | Salvos no banco, compartilhados entre todos os logados |
| Atualização ao vivo | Lead que chega do site aparece sem recarregar |
| Formulário do site | POST para a função `lead-webhook` com a chave de API; cria o lead em “Novo lead”, distribui em rodízio e cria a tarefa de primeiro contato |
| Chave de API | Gerada no banco; “Gerar nova chave” invalida a anterior |

## Limites conhecidos

- Todos os usuários logados veem e editam tudo (não há perfis de permissão).
- A chave de API fica visível no código do formulário do site, como no protótipo. Se vazar, gere outra em **Integração**.
- Não há limite de envios por IP no webhook. Se começar a receber spam, ative o rate limit/captcha.
- As etapas do funil são fixas.
- Não testei contra um projeto Supabase real: faltavam suas credenciais. Se algo falhar nos passos acima, me envie a mensagem de erro.
