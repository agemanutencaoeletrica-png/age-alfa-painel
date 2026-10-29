# Planos e próximos passos (AGE)

Anotações combinadas com o dono para retomar depois. Quando ele pedir, ler este arquivo e lembrar.

## Ordem combinada
1. **Criar tudo e deixar funcionando** (AGE, Anuncia Aí, AGE Conecta e o AGEstor).
2. **Captar clientes** (primeiras empresas testando, depois pagantes).
3. **Só então lançar na Play Store** (quando o dono pedir: "me lembre da Play Store").

## 📱 Play Store (guardado em 29/10/2026 — fazer só quando o dono pedir)
- Os apps já são PWA: viram app da Play Store com **TWA (Trusted Web Activity)**, sem reescrever.
  Atualizações no site aparecem no app na hora, sem mandar versão nova para a loja.
- **Conta Google Play Console:** taxa única de US$ 25 (https://play.google.com/console/signup).
  - Pessoa física: mais rápida, mas conta pessoal nova exige **teste fechado com 12+ pessoas por 14 dias**.
  - Empresa (CNPJ): precisa do número **D-U-N-S** (grátis, Dun & Bradstreet), sem o teste de 12 pessoas.
- **Domínio próprio** para cada app (o arquivo de verificação `/.well-known/assetlinks.json` precisa ficar na raiz):
  ex.: `anuncia.ageeletrica.com.br`, `app.ageeletrica.com.br`, `agestor.com.br` (CNAME no Wix → GitHub Pages, como o `pintura`).
- **Página da loja:** ícone 512, prints, descrição curta/longa e **política de privacidade** em link público.
- **Gerar o app:** PWABuilder (https://www.pwabuilder.com) → endereço do site → Package for Android → enviar o `.aab` no Play Console.
- ⚠️ **Cobrança:** assinatura de serviço digital vendida dentro do app deve usar o **faturamento do Google Play (15%)**.
  Saída comum: no app da loja a empresa entra e testa; o pagamento é feito no site (Mercado Pago).
  **Conferir a política em vigor no Brasil antes de publicar.**
- Apps da AGE (painel/funcionário) não cobram: podem ir como app normal ou **privado** só para a equipe.
- Ordem sugerida: **Anuncia Aí** primeiro (traz clientes); depois AGE e AGEstor.

## 🛠️ AGEstor (nome escolhido) — o gestor da sua empresa de serviços
- Produto para outras empresas de manutenção/elétrica/pintura, a partir do app da AGE (que continua funcionando igual).
- **Dono cria:** repositório `agestor` no GitHub (público) + dar acesso ao app Claude; projeto `agestor` no Supabase (São Paulo).
- **Base:** várias empresas no mesmo sistema (cada uma só vê os próprios dados; AGE = primeira cliente), cadastro sozinho,
  cobrança Mercado Pago (reaproveitar o Anuncia Aí), LGPD (termos, privacidade, exportar/apagar, backup).
- **Cada empresa configura sem mexer no código:** marca (logo, cores, CNPJ, frase do orçamento), áreas ligadas/desligadas,
  ramos e tabela de serviços/materiais, orçamento/PDF (garantia, laudos), campos próprios, equipe (cargos, diária, fechamento),
  nomes na tela (ex.: "Chamado" → "Ordem de serviço").
- **Primeira versão:** serviços/OS + app do funcionário, orçamentos, equipe e pagamentos, compras com leitura de nota.
  Depois: prefeitura/licitações (extra pago), prospecção, veículos, rotas. Portal Supermercados BH fica só na AGE.
- **Preço sugerido:** Básico R$ 79 (3 usuários) · Profissional R$ 149 (10) · Empresa R$ 249 (ilimitado + prefeitura); anual com 2 meses grátis.
- **Primeiros clientes:** 5 empresas beta (2 meses grátis), lista de espera do Anuncia Aí (aba ✨ Interessados), AGE Conecta.

## 🏷️ Marcas
- **AGE Conecta** — rede de empresas do Anuncia Aí ("Empresas que se indicam e crescem juntas").
- **AGEstor** — app de gestão.
- Registrar no **INPI** (classes 9, 35 e 42) no nome de quem será o dono final; conferir domínio no Registro.br.
- Se abrir **CNPJ próprio** depois: trocar a conta do Mercado Pago (chave no Supabase), termos/privacidade, transferir domínio e marca.

## Pendências do dono (lembrar)
- Contrato junto com o orçamento: responder (1) quem compra o material, (2) dias de garantia (mín. 90), (3) foro (Ibirité/MG?).
- Renovação automática do domínio ageeletrica.com.br (Wix/BC Marketing ou Elaine; vence 08/04/2027).
- Equipe: há dois cadastros "AntonioCarlos da costa Henriques" — desativar o de teste.
