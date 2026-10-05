# App de Serviços — AGE Elétrica e Pintura

Dois endereços:

| Quem | Página | O que faz |
|---|---|---|
| **Você (dono)** | `servicos/index.html` | Entra com e-mail e senha. Cadastra equipe, cria serviços (partes de **elétrica** e **pintura** separadas), vê o **cartão de ponto** com fotos e GPS, lê os relatórios e faz os **orçamentos** (só você vê valores). |
| **Funcionário** | `servicos/funcionario.html#t=...` | Abre pelo link pessoal que você manda no WhatsApp. Vê só os serviços dele, registra **chegada**, **foto do serviço** e **saída** (foto + GPS) e envia **relatório com materiais**. Nunca vê preços. |

Custo: **R$ 0** no plano gratuito do Supabase (banco + fotos) e do GitHub Pages (site).
O plano grátis guarda 1 GB de fotos (≈ 6.000 fotos de ponto) e pausa o projeto se ficar
**7 dias sem nenhum acesso** — com uso diário isso não acontece.

---

## Instalação (uma vez, ~15 minutos)

### 1. Criar o banco no Supabase
1. Entre em <https://supabase.com> → **Start your project** → crie a conta (pode ser com o GitHub).
2. **New project** → nome `age-servicos`, crie uma senha do banco (guarde), região **South America (São Paulo)**.
3. Espere o projeto ficar pronto (1–2 min).

### 2. Criar as tabelas
1. No menu da esquerda: **SQL Editor** → **New query**.
2. Copie **todo** o conteúdo do arquivo `servicos/supabase.sql`, cole e clique **Run**.
   Deve aparecer *Success*.

### 3. Ligar o app ao banco
1. No Supabase: **Project Settings** → **API** (ou **Data API**).
2. Copie a **Project URL** e a chave **anon public**.
3. No GitHub, abra `servicos/config.js` → lápis (editar) → cole em `SUPABASE_URL` e `SUPABASE_ANON_KEY`.
   Preencha também os dados da empresa (CNPJ, telefone...) que saem no orçamento impresso → **Commit changes**.

> A chave *anon* é pública por natureza. **Nunca** cole a chave `service_role`.

### 4. Criar o seu login de administrador
1. Supabase → **Authentication** → **Users** → **Add user** → **Create new user**:
   seu e-mail e uma senha forte, marque **Auto Confirm User**.
2. **Authentication** → **Sign In / Providers** (ou *Settings*) → **desligue "Allow new users to sign up"**
   (assim ninguém mais cria conta).
3. Volte no **SQL Editor** e rode (com o seu e-mail):
   ```sql
   insert into public.admins (email) values ('seu-email@exemplo.com') on conflict do nothing;
   ```

### 5. Publicar o site (GitHub Pages)
1. No GitHub: repositório → **Settings** → **Pages**.
2. *Source*: **Deploy from a branch** → branch **main**, pasta **/(root)** → **Save**.
3. Em 1–2 minutos o painel fica em:
   `https://agemanutencaoeletrica-png.github.io/age-alfa-painel/servicos/`

> O site precisa estar em **https** (o GitHub Pages já é) — sem isso o celular não libera câmera nem GPS.

---

## Uso no dia a dia

1. **Equipe** → *+ Novo funcionário* (nome, WhatsApp, área) → **📲 Enviar link**.
   O funcionário abre o link e usa *Adicionar à tela inicial* para virar um ícone de app.
2. **Serviços** → *+ Novo serviço* → dados do cliente → marque **Parte ELÉTRICA** e/ou
   **Parte PINTURA**, escolha o funcionário de cada parte → salvar → **Avisar no WhatsApp**.
3. O funcionário, na obra: **📍 Chegada** → tira a foto → enviar. Durante o serviço: **📷 Foto do serviço**.
   No fim: **📝 Relatório e materiais** (o que fez, medidas, lista de materiais, fotos, "concluído")
   e **🏁 Saída**.
4. Você acompanha em **Hoje** (quem chegou, horas, fotos) e em **Ponto** (período, total de horas,
   planilha CSV que abre no Excel).
5. **Relatórios** → abrir → **💲 Gerar orçamento**: os materiais que o funcionário pediu já entram
   como itens; você só coloca os preços, a mão de obra e o desconto → **Imprimir / PDF** ou **WhatsApp do cliente**.

### Segurança e controle do ponto
- A **hora** de cada registro é a do servidor, não a do celular (não dá para adiantar o relógio).
- Toda foto sai **carimbada** com tipo, nome, data/hora e coordenadas; no ponto o app pede foto tirada na hora e recusa foto antiga da galeria (quando o celular informa a data do arquivo).
- Registro **sem GPS** é aceito (para não travar o funcionário), mas aparece em **vermelho** para você.
- Foto enviada muito depois de tirada (internet ruim) aparece marcada com o horário real da foto.
- Funcionário perdeu o celular ou saiu da empresa: **Equipe → Editar → Gerar novo link** ou desmarque **Ativo**.
  O link antigo para de funcionar na hora. Os registros dele continuam guardados.
- As fotos ficam em pasta **privada**: o funcionário consegue enviar, mas não consegue ver nem apagar.

### Dúvidas comuns
- **"Este e-mail não está autorizado"** → faltou o passo 4.3 (ou o e-mail está diferente).
- **"Falta configurar"** → faltou o passo 3.
- **Funcionário diz que o GPS não funciona** → no celular, ligar *Localização*; no navegador, permitir localização para o site.
- **Esqueci a senha** → Supabase → Authentication → Users → seu usuário → *Send password recovery*.
