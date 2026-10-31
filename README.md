# Designemjunco — Gestão de vendas

Aplicativo em GitHub Pages, com login e banco Supabase, quatro lojas e dois vendedores por unidade.

## Atualizar

O código-fonte está em `source/`. Execute `npm install` e `npm run build` nessa pasta. Copie o conteúdo de `source/dist/` para a raiz do repositório, preservando `source/` e este README.

## Autenticação

No projeto Supabase Designemjunco, configure Site URL e Redirect URLs com `https://wesleyneey.github.io/designemjunco/`. Configure o SMTP para os endereços da equipe antes de usar cadastros e recuperação de senha em produção.

As migrações em `source/supabase/migrations/` já foram aplicadas. Não execute novamente. Não existe promoção automática do primeiro usuário a administrador. Cada loja só pode acessar os próprios registros, e o administrador vê as quatro lojas. O painel atualiza automaticamente a cada 15 segundos. O navegador contém apenas a chave publicável; os registros são protegidos por RLS.
