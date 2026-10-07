# App de Serviços — AGE Elétrica e Pintura

Dois endereços:

| Quem | Página | O que faz |
|---|---|---|
| **Você (dono)** | `servicos/index.html` | Entra com e-mail e senha. Cadastra equipe, cria serviços (partes de **elétrica** e **pintura** separadas), vê o **cartão de ponto** com fotos e GPS, lê os relatórios, faz os **orçamentos** (só você vê valores) e cuida das **OS de prefeituras** (fotos antes/depois, assinatura do fiscal, relatório fotográfico e medição). |
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
   **Serviço que não estava cadastrado** (o cliente pediu na hora): o próprio funcionário toca em
   **➕ Serviço não cadastrado** no app, informa o nº da loja (o endereço entra sozinho) ou o cliente, e o que
   vai fazer. No painel ele aparece marcado **“criado pela equipe”**, com aviso na aba **Hoje** e o filtro
   **Criados pela equipe** em Serviços.
   **Assinatura do responsável (liga quando precisar):** no serviço, marque **✍️ Pedir assinatura do responsável
   ao concluir**. Nesses serviços, ao marcar **Serviço concluído** no relatório, o gerente da loja (ou o cliente)
   assina com o dedo na tela e o funcionário escreve o nome. Nos outros, a assinatura fica desligada (o funcionário
   ainda pode coletar se quiser, pelo botão “Coletar assinatura (opcional)”). No painel a assinatura aparece no relatório, com nome,
   data e hora. Se o responsável não estiver, o funcionário marca “Responsável não está no local” e o relatório
   aparece como **sem assinatura**.
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
2. **Lojas → ⬆ Atualizar lojas (Word ou planilha)** → escolha o documento **DADOS DAS LOJAS** do jeito que ele é
   (Word `.doc` ou `.docx`). O app lê o documento e, **antes de gravar**, mostra:
   - 🆕 lojas novas · ✏️ lojas com dados alterados (com o “antes → depois”) · ✔ lojas sem mudança;
   - ❓ lojas que não estão mais no documento (só desativa se você marcar).

   **Sempre que chegar uma versão nova do documento, é só repetir este passo.** Nada é duplicado (as lojas são
   reconhecidas pelo CNPJ ou pelo número), e loja que mudou de endereço é localizada de novo no mapa.
   O documento precisa manter o modelo atual: empresa e nº da loja na 1ª linha, endereço com “Nº”, “B:” e CEP
   na 2ª, CNPJ na 3ª, e uma linha em branco entre as lojas. Também aceita a planilha `lojas-supermercados-bh.csv`.
   As lojas **não ficam no GitHub** (o repositório é público): ficam só no seu banco de dados.
3. Depois de atualizar, o app oferece **📍 Localizar no mapa** (só as lojas que ainda não estão no mapa): procura cada loja pelo endereço (se não achar, pelo CEP,
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

### Serviços para prefeituras (aba 🏛️ Prefeitura)
Para OS de prefeituras e outros órgãos públicos: prédios públicos, iluminação pública e obras/reformas.
**É uma área separada:** as OS da prefeitura ficam só nesta aba (não se misturam com os clientes particulares e as lojas da aba
Serviços). A aba **Hoje** mostra o quadro **🏛️ Prefeitura** com as OS em aberto, **Relatórios** tem o filtro *Só prefeitura* /
*Só particulares*, e no app do funcionário elas aparecem na seção própria **🏛️ Serviços da prefeitura**.
**Antes de usar, rode de novo o `supabase.sql`** (cria as tabelas de prefeituras, contratos e medições sem apagar nada).

1. **Prefeituras** → *+ Nova prefeitura* (nome, CNPJ, cidade, contato). Cadastre quantas precisar.
2. **Contratos** → *+ Novo contrato* (ou ata de registro de preços): nº, processo/licitação, objeto, vigência,
   valor total e BDI. Na **planilha de itens**, copie do Excel e cole as 5 colunas nesta ordem:
   **código · descrição · unidade · quantidade contratada · preço unitário**. O app mostra a prévia antes de salvar.
   O funcionário vê só a descrição dos itens (nunca o preço) para lançar as quantidades.
3. **Ordens de serviço** → *+ Nova OS*: prefeitura, contrato, **nº da OS/protocolo**, tipo (prédio público,
   iluminação pública, obra/reforma), secretaria, local, referência (nº do poste, sala, bloco), endereço e **fiscal**.
   Marque as partes (elétrica/pintura) e o funcionário de cada uma — a assinatura do fiscal já vem ligada. Avise pelo WhatsApp.
4. **No app do funcionário** a OS aparece com a prefeitura, o nº e o fiscal. No relatório ele tira as
   **fotos de ANTES** (no começo — pode mandar um relatório só com elas) e as **fotos de DEPOIS**, lança as quantidades
   escolhendo os itens do contrato e, ao concluir, colhe a **assinatura do fiscal** na tela. As fotos saem carimbadas com
   ANTES/DEPOIS, nº da OS, data/hora e GPS. **Sem foto de antes e de depois a OS não pode ser concluída.**
5. Na lista de OS você vê o que falta em cada uma (✔/✖ fotos antes, fotos depois, assinatura do fiscal, medida ou não)
   e gera o **📄 Relatório fotográfico (PDF)**: dados da OS, execução (chegada/saída com GPS), serviços, quantidades,
   fotos antes e depois e a assinatura do fiscal.
6. **Medições** → *+ Medição* no contrato: escolha o período, as OS concluídas já vêm marcadas, toque
   **⬇ Puxar quantidades dos relatórios** (entra com o preço do contrato), confira e ajuste. O app calcula BDI,
   acumulado anterior, saldo de cada item e saldo do contrato. Gera o **PDF do boletim de medição** (com campos de
   assinatura da AGE, fiscal e gestor) e a **planilha para Excel**. Uma OS medida não entra em outra medição.

### Licitações (Prefeitura → Licitações e Documentos)
1. **Documentos** → *Cadastrar a lista padrão* (contrato social, CNDs, FGTS, trabalhista, balanço, CREA/CFT, atestados...).
   Abra cada um e coloque **até quando vale** e, se quiser, o link do arquivo (Google Drive). A aba **Hoje** avisa
   quando um documento venceu ou vence em até 15 dias.
2. **Licitações** → *+ Nova licitação*: órgão, modalidade, nº do edital, objeto, link do edital, **data de abertura**,
   visita técnica, prazo para dúvidas e valor estimado. Toque **📅 Pôr na agenda** para lembrar no celular.
   A aba **Hoje** avisa as licitações que abrem nos próximos 7 dias.
3. **Checklist de documentos**: marque o que já está separado (a validade de cada um aparece ao lado) e inclua o que
   o edital pedir a mais.
4. **Proposta**: cole a planilha do Excel (código · descrição · unidade · quantidade · preço **sem** BDI) e informe o BDI.
   O app calcula o preço unitário com BDI, o valor global e quanto fica abaixo (ou acima) do estimado.
   **📄 Proposta em PDF** gera a proposta de preços com validade, prazo, declaração e campo de assinatura.
5. Resultado: mude a situação. Se **ganhou**, toque **🏆 Ganhou: criar o contrato** — o contrato já nasce com os itens e
   os preços da proposta (com o BDI incluído), pronto para as OS e as medições.

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
