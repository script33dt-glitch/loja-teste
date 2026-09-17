# Casa Ateliê — versão HTML/CSS/JS puro (sem Lovable, sem framework)

Site estático, sem build, sem npm no front-end. Reaproveita o mesmo banco
Supabase que a Lovable já tinha criado (schema, produtos, categorias,
permissões admin/cliente) — só o front-end mudou.

## O que eu mudei no banco (Supabase) pra isso funcionar

Rodei direto no projeto Supabase (`vrrrzsqxhhgatawxbyfv`), então já está
valendo, não precisa fazer nada aqui:

1. O bucket de imagens `produtos` estava privado e sem nenhuma política —
   corrigi para público (leitura) com escrita restrita a admin.
2. Adicionei uma política que permite qualquer cliente virar admin **apenas
   se ainda não existir nenhum admin na loja** (é o botão "Tornar-se
   administrador" em Minha conta).

## Estrutura

```
index.html          catalogo.html      produto.html
carrinho.html        checkout.html      pedido.html
auth.html            minha-conta.html
admin/index.html     admin/produtos.html
admin/categorias.html admin/pedidos.html
assets/css/style.css
assets/js/supabase-client.js   (chave pública do Supabase — pode ficar no código)
assets/js/utils.js             (formatação + carrinho via localStorage)
assets/js/admin-guard.js
api/create-checkout.js         (função serverless — Node, roda na Vercel)
api/confirm-payment.js         (função serverless — Node, roda na Vercel)
package.json                   (dependência @supabase/supabase-js p/ as functions)
```

## Por que existem 2 arquivos em /api

Criar um pedido e confirmar pagamento via Stripe exige a `service_role key`
do Supabase e a chave secreta da Stripe — **nenhuma das duas pode aparecer em
código que roda no navegador**. Essas 2 funções (ainda em JavaScript, sem
framework) são o único lugar onde isso acontece. Tudo o resto (catálogo,
carrinho, login, CRUD de admin, upload de imagem) fala direto com o Supabase
do navegador, protegido pelas políticas RLS do banco.

## Variáveis de ambiente (configurar na Vercel, não em arquivo)

- `SUPABASE_URL` = `https://vrrrzsqxhhgatawxbyfv.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` → pegue em supabase.com → esse projeto →
  Settings → API → **service_role key**. Nunca coloque isso em um arquivo
  `.html` ou `.js` do front-end, nem em repositório público sem
  `.gitignore`/secret manager.
- `STRIPE_SECRET_KEY` → sua chave `sk_test_...` (opcional; sem ela o
  checkout roda em modo demonstração/simulado)

## Deploy

1. Crie um repositório novo no GitHub (esse aqui não tem nenhuma ligação
   com o projeto da Lovable — é um projeto separado do zero) e suba estes
   arquivos.
2. Importe o repositório na Vercel. Como não tem framework, ela detecta como
   projeto estático + funções serverless automaticamente — não precisa de
   configuração especial.
3. Adicione as 3 variáveis de ambiente acima nas configurações do projeto
   na Vercel.
4. Deploy.

## Testar localmente antes de subir

Abrir os arquivos `.html` direto no navegador (`file://`) funciona para
navegar pelo catálogo, mas **o checkout vai falhar** porque não existe
`/api/...` rodando sem servidor. Para testar tudo local, instale a CLI da
Vercel e rode:

```
npm install -g vercel
vercel dev
```

## Checklist antes de apresentar pro cliente

- Criar conta → navegar catálogo → adicionar ao carrinho → checkout →
  confirmação
- Minha conta → "Tornar-se administrador" (só funciona uma vez)
- Cadastrar 1-2 produtos com imagem no painel admin
- Testar em aba anônima, com uma segunda conta sem a role admin, que
  `/admin/index.html` não deixa fazer nada de admin (a tela pode até abrir
  visualmente por um instante, mas toda leitura/escrita tem que falhar —
  é isso que garante a proteção de verdade, não a tela em si)
