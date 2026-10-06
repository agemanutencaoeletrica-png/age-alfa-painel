# App de Serviços — AGE Elétrica e Pintura

Dois endereços:

| Quem | Página | O que faz |
|---|---|---|
| **Você (dono)** | `servicos/index.html` | Entra com e-mail e senha. Cadastra equipe, cria serviços (partes de **elétrica** e **pintura** separadas), vê o **cartão de ponto** com fotos e GPS, lê os relatórios e faz os **orçamentos** (só você vê valores). |
| **Funcionário** | `servicos/funcionario.html#t=...` | Abre pelo link pessoal que você manda no WhatsApp. Vê só os serviços dele, registra **chegada**, **foto do serviço** e **saída** (foto + GPS) e envia **relatório com materiais**. Nunca vê preços. |

**Separado do AGE BOT:** este app não usa nada do bot — banco de dados, login, arquivos e
endereço próprios (tudo dentro da pasta `servicos/`). O bot e o `index.html` da raiz não são alterados.

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

## Instalar como aplicativo

Não precisa de Play Store: o app instala direto pelo navegador e ganha ícone próprio.

- **Android (dono e funcionários):** abra o endereço no **Chrome** → toque em **📲 Instalar** no topo
  (ou menu ⋮ → **Instalar app** / *Adicionar à tela inicial*). O funcionário faz isso depois de abrir o link
  pessoal; o app instalado já entra direto na conta dele.
- **Notebook (Windows/Mac):** abra o painel no **Chrome** ou **Edge** → botão **📲 Instalar app** no topo
  (ou o ícone de instalar na barra de endereço). Ele abre em janela própria, como programa, e fica no menu Iniciar.
- O app se atualiza sozinho quando o sistema é atualizado. Sem internet ele abre, mas só registra/salva com internet.

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
   como itens; você só coloca os preços, a mão de obra e o desconto. Para mandar ao cliente:
   - **📤 Enviar PDF** (Android e Windows): abre a lista de apps → escolha WhatsApp, Gmail, Outlook... e o PDF vai anexado.
   - **📲 WhatsApp do cliente**: abre a conversa com o número do cliente já com o resumo e o total.
   - **✉ E-mail do cliente**: baixa o PDF e abre o e-mail já preenchido (destinatário, assunto e texto); é só anexar o PDF.
   - **📄 Baixar PDF** / **🖨 Imprimir**.

### Lojas e rotas (lojas próximas no mesmo dia)
1. **Rode de novo o `supabase.sql`** (SQL Editor → colar tudo → Run). Ele cria as tabelas de lojas e rotas sem apagar nada.
2. **Lojas → ⬆ Importar planilha** → escolha `lojas-supermercados-bh.csv` (434 lojas, CDs e postos da rede, tirados
   do documento DADOS DAS LOJAS). O arquivo **não fica no GitHub** (o repositório é público): guarde-o com você.
   Importar de novo atualiza as lojas pelo CNPJ/número, sem duplicar.
3. Depois de importar, o app oferece **📍 Localizar no mapa**: procura cada loja pelo endereço (se não achar, pelo CEP,
   bairro e por último a cidade). É grátis e devagar de propósito (1 consulta por segundo): 434 lojas levam ~10 a 20 min,
   e pode pausar e continuar. Lojas marcadas “só cidade”/“bairro” ficam com local aproximado.
4. Para acertar o local de uma loja: abra a loja → cole o link do Google Maps (ou as coordenadas) ou, estando na loja,
   toque **📍 Estou na loja: usar meu GPS**. E sozinho: quando o funcionário registra **chegada** com GPS bom num serviço
   ligado à loja, o local da loja é corrigido automaticamente.
5. Ao criar um serviço, escolha a loja no campo **Loja da rede** (preenche cliente e endereço e liga o serviço à loja).
6. **Rotas → 🧭 Montar rota**:
   - *Saindo de*: sua localização, a base (opcional, `BASE` no `config.js`) ou uma loja;
   - *Quais lojas*: as com serviço aberto, as que você escolher (filtro por cidade/região) ou todas num raio de X km;
   - *Máximo de lojas por dia* e *Só junta no mesmo dia lojas a até X km* (padrão 40 km): lojas longe umas das outras
     **nunca** caem no mesmo dia; cada dia sai na melhor ordem (menos quilômetros).
   - Cada dia mostra o mapa, a ordem, os km estimados, o botão **Google Maps** (com todas as paradas) e
     **💾 Salvar / enviar ao funcionário**: a rota vai para o app dele (botões *Ir* e *Waze* em cada loja) e pelo WhatsApp.

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
