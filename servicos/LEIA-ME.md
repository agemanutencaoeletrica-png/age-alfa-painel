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
   **Assinatura do responsável (só quando você liberar):** vem **desligada** em todo serviço — o funcionário não vê
   quadro nem botão de assinatura, e ninguém aborda o gerente da loja para assinar. Para um cliente avulso que deve
   assinar, marque no serviço **✍️ Liberar assinatura do responsável neste serviço** (na criação ou depois, em
   Serviços → abrir a parte). Só nesses serviços, ao marcar **Serviço concluído**, o cliente assina com o dedo na tela
   e o funcionário escreve o nome. No painel a assinatura aparece no relatório, com nome, data e hora. Se o responsável
   não estiver, o funcionário marca “Responsável não está no local” e o relatório aparece como **sem assinatura**.
   (Nas OS da prefeitura a assinatura do fiscal já vem ligada; dá para desligar do mesmo jeito.)
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

### 📣 Divulgar nas redes sociais
1. No cliente/serviço marque **📣 Cliente autorizou divulgar fotos deste serviço nas redes sociais** (em Novo serviço, em
   Serviços → Editar, ou na OS da prefeitura). Se não estiver marcado, o app pergunta antes de divulgar.
2. **Relatórios** → abra o relatório com fotos → **📣 Divulgar**. Escolha 1 foto ou 2 (**antes e depois**), confira o título e
   a legenda e toque **🖼 Montar imagem**. A imagem sai no formato do Instagram (1080x1350) com o nome e o telefone da AGE;
   o carimbo das fotos (GPS, nome do funcionário e do cliente) é cortado e o endereço não aparece.
3. **📤 Postar** (no celular) abre a lista de apps: Instagram, Facebook, WhatsApp/Status, Telegram, TikTok... A legenda já
   vai copiada: cole no post se ela não aparecer. No computador: **⬇ Baixar imagem** e cole a legenda.

### Veículos (placa e KM)
1. **🚗 Veículos** → *+ Veículo*: placa e modelo de cada carro da empresa.
2. No app do funcionário aparece o botão **🚗 Veículo: registrar KM**. Ao **pegar o carro** ele escolhe a placa, marca
   **Início**, escreve o KM do painel e tira a **foto do painel** (sai carimbada com placa, KM, hora e GPS). Ao
   **devolver**, faz o mesmo com **Fim**. O app já sugere o carro e o momento certo; o KM final menor que o inicial é recusado.
3. No painel: a aba **Hoje** mostra, em cada funcionário, o carro, o KM de início e de fim e os **km rodados**; a aba
   **🚗 Veículos** mostra o histórico por período, veículo e funcionário, com as fotos do painel, o mapa (GPS) e a
   planilha para Excel. Os lugares visitados aparecem no **Ponto** (chegada e saída com GPS).
4. Carro vendido ou parado: abra o veículo e desmarque **Ativo** (o histórico fica guardado).

### Mandar serviços pelo celular (dono e outra pessoa)
O painel funciona no celular igual ao notebook. No **Chrome do celular** abra
`https://agemanutencaoeletrica-png.github.io/age-alfa-painel/servicos/`, entre com e-mail e senha e use
menu ⋮ → **Instalar app** (ou *Adicionar à tela inicial*). Para **outra pessoa** também mandar serviços, crie um login
para ela: Supabase → **Authentication → Users → Add user → Create new user** (e-mail dela, senha, *Auto Confirm User*) e,
no **SQL Editor**, rode `insert into public.admins (email) values ('email-dela@...') on conflict do nothing;`.
Ela passa a ver tudo o que você vê (inclusive orçamentos). Para tirar o acesso: no **SQL Editor** rode
`delete from public.admins where lower(email) = lower('email-dela@...');` (corta na hora) e apague o usuário em Authentication → Users.
Só vale como admin o login com e-mail **confirmado** (por isso o *Auto Confirm User*).

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
- **Esqueci a senha** → no Supabase, **SQL Editor** → **+**, troque `NovaSenha123` e o e-mail e rode (vale na hora, sem e-mail e sem limite de tentativas):
  `update auth.users set encrypted_password = extensions.crypt('NovaSenha123', extensions.gen_salt('bf')) where email = 'seu-email@exemplo.com';`
- **Trocar a senha** (já dentro do painel) → botão **⚙** no topo → **Trocar minha senha** (pede a senha atual).
- **Trava com digital/rosto** → botão **⚙** no topo → **Ativar trava com digital**. Vale só para aquele aparelho; ao abrir o painel
  (ou voltar para ele depois de 2 minutos) ele pede a digital. Se falhar, dá para entrar com e-mail e senha.


## 📋 Chamados do Supermercados BH (BH 360)
Na aba **Serviços → 📋 Chamados BH** fica uma **caixa de chamados**:
1. Cole quantas vezes quiser: **cada página** de *Meus chamados* e de *Ordens de serviço* (selecione a tabela, Ctrl+C) e a tela **Detalhes** de um chamado.
   Tudo entra na caixa **sem repetir** (mesmo nº = mesmo chamado; os detalhes completam a descrição). A caixa fica guardada neste computador até você lançar.
2. Confira: ficam **desmarcados** os já **orçados/feitos** (situação Orçada, Finalizada, Executada, Concluída, Cancelada) e os de **outro prestador**;
   aparecem como **já lançado** os que já estão no app. **Loja não cadastrada também entra** (como "Centro P623"); cadastre a loja depois para entrar nas rotas.
3. Clique em **Lançar**. Os serviços entram sem funcionário; direcione na aba Serviços ou monte a rota.

## ✅ Executados
Aba **✅ Executados**: serviços concluídos agrupados pelo **dia da execução** (mais recente primeiro), com loja/cliente, nº do chamado,
funcionário, horário, o que foi feito e as **fotos de antes e depois** do relatório. Filtros: período, área, funcionário e busca.
Quando o serviço de uma loja é concluído, ela **sai da rota** no app do funcionário; no painel, a rota salva mostra a loja riscada (✔ x de y feitas).

## 🧾 Visita de orçamento
No relatório, o funcionário marca **"Foi só a visita para o orçamento"** quando o serviço ainda não foi feito (vem marcado
sozinho quando a descrição diz "fazer orçamento" ou "orçar"). O serviço fica **Orçamento feito (aguardando aprovação)**:
sai da lista do funcionário e da rota, **não** vai para Executados e aparece no Hoje e no filtro da aba Serviços.
Quando o cliente aprovar, abra o serviço, volte a situação para **Aberto** e escolha o funcionário.

## Chamados da mesma loja
Na caixa de chamados e na aba Serviços, os chamados da mesma loja ficam juntos. Ao escolher o funcionário de um chamado,
os outros chamados abertos da mesma loja e da mesma área que estão **sem funcionário** vão para ele também
(os que já têm outro funcionário não mudam), e a mensagem do WhatsApp lista todos.

## Situação do chamado no portal (Detalhes)
Cole na caixa as abas da tela **Detalhes** do chamado (Histórico, Ordens de serviço, Requisições de compra), uma de cada vez ou juntas.
O app lê a **OS da AGE** e a situação dela (pendente, orçada, aprovada, executada, reprovada), o **valor negociado**, as
**requisições de compra** e se a loja **reprovou** a execução (com nota e motivo). Ao atualizar, o serviço mostra a etapa
(ex.: "🔧 aprovado: executar", "💲 R$ 800,00"); o reprovado volta para **Aberto** e aparece em vermelho no Hoje.
Reclamação da loja no histórico ("não veio ninguém", "continua apagada"...) gera **alerta vermelho** ao colar, no serviço e no Hoje.
Antes de finalizar no portal, o serviço avisa se falta **registro de chegada** ou **foto de depois**.

## Pendências, revisão e atualização automática
- Colar os **Detalhes** de um chamado que já está no app **atualiza na hora** (sem botão): descrição, etapa, reprovação/reclamação.
- Se o chamado é de **outro prestador** (vale a última OS que ainda vale), sai da caixa com o aviso "não pertence à AGE";
  se já estava lançado, o serviço é **cancelado** sozinho.
- **📌 Pendências** (tela Hoje e no serviço): OS pendente sem funcionário, visita feita sem orçamento lançado, aprovado sem
  funcionário, executado no app e não finalizado no portal, cancelado no portal, não é da AGE. Somem sozinhas quando você
  cola os Detalhes novos ou muda o serviço no app.
- **🔍 Revisão**: lista os chamados lançados que nunca foram conferidos no portal (cole os Detalhes de cada um).

## Finalizados e atualização automática
- Cole a lista **Ordens de serviço** do portal (cada página): o app lê nº da OS, nº do chamado, centro, valor negociado e
  situação. Chamado **já no app** e **Finalizado** no portal: o serviço vira **concluído** sozinho e guarda o valor.
  Finalizados que nunca entraram no app: botão **📥 Registrar finalizados no histórico** (entram concluídos).
- Aba **✅ Executados**: filtro **Finalizados no portal / Falta finalizar no portal** e total do valor negociado.
- O painel se **atualiza sozinho** a cada minuto e ao voltar para a aba (não atualiza com uma janela aberta ou
  enquanto você digita). O app do funcionário, a cada 2 minutos.

## 📤 Compartilhar e 📥 receber (WhatsApp e outros apps)
- **Enviar:** botão **📤 Compartilhar** no serviço, no relatório (com as fotos) e nas rotas salvas do painel, e em cada serviço
  no app do funcionário. Abre a lista do celular (WhatsApp, Telegram, e-mail...). O link pessoal do funcionário não vai junto.
- **Receber (Android, app instalado na tela inicial):** no WhatsApp, toque em Compartilhar → **AGE Ponto** (funcionário) para
  anexar fotos/texto ao relatório de um serviço (marcadas "recebida por compartilhamento"), ou → **AGE Painel** para colocar
  o texto na caixa de chamados ou criar um serviço. Depois de atualizar o app, reinstale o ícone se ele não aparecer na lista.

## 💰 Pagamentos da equipe (Pix e dinheiro)
1. Em **Equipe**, cadastre a **Chave Pix** de cada funcionário (telefone, CPF, e-mail ou chave aleatória).
2. No app do banco, abra o comprovante e toque em **Compartilhar → AGE Painel** (pode mandar vários), ou na aba
   **💰 Pagamentos** toque em **📥 Comprovante Pix** e escolha as imagens/PDFs. O app lê valor, data, horário e quem
   recebeu, e separa por funcionário (pela chave Pix, CPF, telefone ou nome). Confira e salve. O mesmo Pix não entra duas vezes.
3. Pagamento em **dinheiro**: parte **💵 Dinheiro (espécie)** → **Novo pagamento em dinheiro**.
4. Relatório: por período e funcionário, separado **por semana** (seg a dom) com total de cada um, Pix e dinheiro;
   ⬇ planilha (CSV) e 📤 compartilhar. Precisa rodar o **supabase.sql** de novo (cria a tabela de pagamentos).

## 🧾 Compras de material (notas e cupons)
Aba **🧾 Compras**: **📷 Nota / cupom** (foto ou PDF; no celular, Compartilhar → AGE Painel → 🧾) ou **➕ Lançar à mão**.
O app lê o valor total, a data, a loja e os itens (cupom NFC-e, DANFE, pré-venda; foto deitada também); quando não acha o
"TOTAL" com clareza, avisa para conferir. Você completa: **área** (⚡ elétrica, 🖌️ pintura ou ➗ as duas, dividindo pelos
materiais), **para onde foi** (obra/loja/chamado ou estoque), **tipo de serviço** e os materiais. Os totais de elétrica e pintura,
o total geral e o resumo **por destino** são somados na hora; ⬇ planilha e 📤 compartilhar. A loja é lembrada pelo CNPJ.
Precisa rodar o **supabase.sql** de novo (cria a tabela de compras).
- Partes da aba Compras: **Tudo · 🧱 Material de obra · ⛽ Despesas avulsas** (combustível, manutenção de veículo, lanche,
  pedágio, ferramentas; com o veículo) **· 💳 A pagar** (boleto/a prazo, com vencimento e botão ✔ Pago).
  Resumo **por loja**: tudo somado, com o que falta pagar em cada uma.

## 🏪 Orçamentos das lojas (acervo de materiais e 📈 histórico de preços)

- Aba **🏪 Orçamentos das lojas** → **📥 Lançar orçamento**: escolha o PDF (ou vários), a foto ou o XML da nota. O PDF e o XML
  **salvam sozinhos**; a foto passa antes pela conferência (a leitura de foto pode errar).
- **Cada orçamento fica separado** (loja pelo CNPJ, nº, data, validade, total, itens e o arquivo da loja).
- **✍️ Lançar à mão**: digite loja, nº, data e os itens (➕ acrescenta linha, ✕ tira). Quando o app **não acha os materiais**
  num arquivo, aparece **✍️ Digitar os itens**, já com a loja, o total lido e o arquivo guardado junto.
- **✏️ Editar** (dentro do orçamento): corrige loja, nº, data e itens; os preços corrigidos vão para o acervo e o 📈 histórico.
- Foto/print de **pedido de balcão** ("DOCUMENTO NÃO FISCAL": `código - descrição qtd unitário R$total`) é lido; print muito pequeno
  pode vir com o nome aproximado — corrija na conferência antes de salvar.
- **Validade**: é a que a loja escreveu no orçamento (até essa data ela garante os preços). Vencida fica em vermelho.
- **🗑 Excluir** em cada cartão (e dentro do orçamento). Se foi lançado por engano, marque para tirar também do acervo os materiais
  que entraram por ele (só os que ainda estão com o preço dele) e os preços dele no 📈 histórico.
- **⛔ Não aceita repetido**: o mesmo arquivo, a mesma chave da NF-e, a mesma loja + nº ou (sem nº) a mesma loja, data, total e itens.
  O banco também trava (dois aparelhos ao mesmo tempo). No orçamento do cliente os itens entram, mas o orçamento da loja não é guardado de novo.
- Os materiais que **ainda não estão no app** entram sozinhos no acervo da 💲 tabela e aparecem na lista **🆕 Materiais que ainda não
  tinham no app** (com 📋 Copiar). O que já está fica com o **preço mais novo** (orçamento mais antigo vai só para o histórico).
- Ao abrir um orçamento: cada item com o **menor preço visto em outra loja** (vermelho = aqui está mais caro), ver o arquivo da loja,
  **🧾 Usar num orçamento de cliente** (abre o orçamento de materiais com os itens para pôr o acréscimo), copiar a lista e apagar.
- Todo preço fica no **📈 histórico** (loja, nº e data); em 💲 Preços, ao abrir um material, aparecem todos e o **menor**.
- No **orçamento do cliente**, o 📷 Ler nota ou orçamento da loja também guarda o orçamento da loja aqui e mostra o último preço de cada material.
- A comparação entre lojas é pelo **nome igual** do material (cada loja escreve de um jeito).
- Precisa rodar uma vez o **supabase.sql** atualizado (tabelas `orcamentos_loja` e `precos_historico`). Sem elas, o acervo salva do mesmo jeito e o app avisa.

## ✍ Corretor de português
O app corrige o texto **ao sair do campo** (toque fora) e mostra o que mudou ("✍ Corrigido: ..."): **acentos** (instalacao → instalação, portao → portão, nao → não), erros comuns de
digitação (comado → comando, nessecario → necessário, afim de → a fim de, contatado que → constatado que), **espaços e vírgulas** fora do lugar, palavra repetida ("de de") e **letra
maiúscula** no começo do campo e de cada linha.
- Vale para: itens, laudo (vistoria e solução), observações, forma de pagamento e prazo do orçamento, propostas prontas, "O que fazer" e observações dos serviços, legenda do post de
  divulgação, relatório e observações do funcionário. **Não mexe** no nome do cliente, endereço, números, medidas (2,5 mm), siglas (NBR, LED), e-mails e sites.
- Funciona **sem internet** e o texto não sai do aparelho. Ele **não** corrige concordância ("2 fotocélula" → "2 fotocélulas") nem crase: isso precisa de uma revisão de verdade; confira o que
  é de cliente antes de enviar. Notou uma palavra que ele deixa passar? Me avise para entrar na lista.

## 🔍 Modelos de laudo técnico (no orçamento)
No orçamento, em **🔍 Laudo técnico**, o campo **📑 Usar um modelo de laudo...** traz o texto pronto de **vistoria** e **solução**; edite à vontade para o cliente.
- **Modelos prontos** (não mudam): rede principal e chuveiro, **portão automático** (motor bifásico, 2 fotocélulas, fechadura automática, interfone com visor, botoeira
  e acionamento remoto), **câmeras de segurança (CFTV)**, **interfone** e **TI** (rede e computadores).
- **💾 Salvar como modelo** guarda o laudo que você escreveu com o nome que escolher e ele passa a aparecer na lista de todos os orçamentos. Escolheu um modelo seu,
  editou e quer **atualizá-lo**? Salve com o **mesmo nome**: o app pergunta e atualiza (não cria outro). **🗑 Apagar modelo** tira da lista (os orçamentos já feitos não mudam).
- Precisa da tabela `modelos_laudo` (já está no `supabase.sql`); sem ela o modelo fica só no aparelho.

## 📑 Propostas prontas (orçamentos técnicos que você já escreveu)
Aba **📑 Propostas prontas** do painel: um lugar para **guardar, editar e reusar** os orçamentos técnicos (como os da DEVA: pintura, lavagem, lava-jato).
- **📥 Importar proposta (PDF)** (pode escolher vários; também lê foto): o app separa **cliente, CNPJ, telefone, endereço, data, serviço, o que será feito,
  itens com valores e condições**. Confira os campos, corrija o que precisar e **💾 Salvar**. **✍️ Escrever à mão** abre a mesma ficha em branco.
- Proposta com mais de um serviço (ex.: "1. Lavagem… Valor do serviço: R$ 700,00 / 2. Pintura… R$ 1.100,00") vira **um item por serviço**.
- **📝 Usar no orçamento**: abre o **orçamento do app já preenchido** (cliente, itens e valores, o texto do serviço no 🔍 laudo técnico — "vistoria" e "solução" — e as
  condições nas observações). Daí em diante é o orçamento de sempre: ajusta, salva e gera o **PDF igual aos outros orçamentos**, ou manda pelo WhatsApp.
- O **mesmo arquivo não entra duas vezes** (nem a mesma proposta: cliente, serviço, data e valor iguais). **🗑 Excluir** apaga a proposta e o arquivo guardado;
  os orçamentos que já usaram a proposta não mudam.
- No orçamento (e na proposta), o campo **Área** tem agora **Manutenção**, **TI**, **Câmeras** e **Interfones**, além de Elétrica, Pintura e Elétrica e pintura.
  O botão **✏️ Áreas**, ao lado do campo, deixa você **acrescentar** áreas novas (ex.: Segurança eletrônica), **renomear** e **tirar**. Elétrica, Pintura e
  Elétrica e pintura são fixas (a lista de preços depende delas). Tirar uma área que já foi usada não muda os orçamentos antigos, só a área sai da lista.
- Precisa rodar uma vez o **supabase.sql** atualizado (tabelas `propostas` e `areas_orcamento`). Sem a tabela das áreas, valem Manutenção, TI, Câmeras e Interfones, mas
  não dá para editar.

## 📊 Fechamento mensal dos chamados (Supermercados BH)
Aba **✅ Executados → 📊 Fechamento mensal**: cada chamado concluído no mês com data, chamado, loja, serviço realizado, OS,
situação no portal e **valor**; total do mês, o que falta finalizar e o que está sem valor. **📋 Colar do portal**: cole as
páginas de **Ordens de serviço** (valores) e **Finalizados** (data de encerramento) e o app atualiza tudo. 💲 corrige um valor à mão.
- **Nota repetida não entra:** pela **chave de acesso** (44 números da NF-e/NFC-e, conferida pelo dígito verificador) ou pelo
  **número da nota + CNPJ** da loja. Mesma loja, valor e data: o app avisa e só salva se você confirmar (outra compra igual).
- **Materiais da nota:** o app lê cada material com **quantidade, valor unitário e total** (DANFE, cupom, pré-venda) e confere
  a soma com o total da nota. Digitando à mão, quantidade × unitário dá o total sozinho.
- **📊 Comparar preços:** cada material com o preço unitário em cada loja e data, o mais barato marcado e a diferença em %.
