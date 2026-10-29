// Listas iniciais de MATERIAIS da 💲 Tabela de preços (elétrica e pintura), para o orçamento de materiais.
// Vêm sem preço ("a definir"): o preço de material muda muito de loja para loja e de mês para mês.
// O dono carrega uma vez, preenche os preços que usa e edita quando mudar. Itens novos escritos nos
// orçamentos também entram sozinhos (grupo "Materiais (dos orçamentos)").
(function () {
  "use strict";
  // [descrição, unidade]
  function grupo(nome, linhas) { return linhas.map(function (l) { return { grupo: "Materiais – " + nome, descricao: l[0], un: l[1] || "un", valor: null }; }); }
  // mesma peça em várias medidas: serie("Cabo flexível", "mm²", ["1,5", "2,5"], "m")
  function serie(base, sufixo, medidas, un) { return medidas.map(function (m) { return [base + " " + m + (sufixo || ""), un]; }); }
  function cat() { return [].concat.apply([], arguments); }

  var eletrica = cat(
    grupo("Fios e cabos", cat(
      serie("Cabo flexível 750 V", " mm²", ["1,5", "2,5", "4", "6", "10", "16"], "m"),
      serie("Cabo flexível 1 kV (HEPR/EPR)", " mm²", ["2,5", "4", "6", "10", "16", "25", "35", "50", "70", "95", "120"], "m"),
      serie("Cabo PP", " mm²", ["2x1,5", "2x2,5", "3x1,5", "3x2,5", "3x4", "3x6", "4x2,5", "4x4", "4x6", "4x10"], "m"),
      serie("Cabo de cobre nu", " mm²", ["16", "25", "35", "50"], "m"),
      serie("Cabo de alumínio multiplexado", "", ["duplex 10 mm²", "duplex 16 mm²", "triplex 16 mm²", "quadruplex 16 mm²", "quadruplex 25 mm²", "quadruplex 35 mm²"], "m"),
      [["Cabo de rede UTP Cat5e", "m"], ["Cabo de rede UTP Cat6", "m"], ["Cabo coaxial RG6", "m"], ["Cabo telefônico CCI 2 pares", "m"],
       ["Cabo de alarme / CFTV 4 vias", "m"], ["Cabo paralelo (cordão) 2x1,5 mm²", "m"], ["Cabo PP para chuveiro 3x6 mm²", "m"]]
    )),
    grupo("Eletrodutos e conexões", cat(
      serie("Eletroduto PVC rígido roscável", "", ["3/4\"", "1\"", "1 1/4\"", "1 1/2\"", "2\"", "3\""], "barra"),
      serie("Eletroduto PVC corrugado (flexível)", "", ["3/4\"", "1\"", "1 1/4\""], "m"),
      serie("Eletroduto galvanizado leve", "", ["3/4\"", "1\"", "1 1/4\"", "1 1/2\"", "2\""], "barra"),
      serie("Eletroduto PEAD corrugado (Kanaflex)", "", ["1 1/4\"", "1 1/2\"", "2\"", "3\""], "m"),
      serie("Curva para eletroduto PVC 90°", "", ["3/4\"", "1\"", "1 1/4\"", "2\""], "un"),
      serie("Curva para eletroduto galvanizado 90°", "", ["3/4\"", "1\"", "1 1/4\"", "2\""], "un"),
      serie("Luva para eletroduto", "", ["3/4\"", "1\"", "1 1/4\"", "2\""], "un"),
      serie("Bucha e arruela para eletroduto", "", ["3/4\"", "1\"", "1 1/4\"", "2\""], "par"),
      serie("Abraçadeira tipo D com cunha", "", ["3/4\"", "1\"", "1 1/4\"", "2\""], "un"),
      serie("Abraçadeira tipo U (copo)", "", ["3/4\"", "1\"", "1 1/4\"", "2\""], "un"),
      serie("Abraçadeira PVC para eletroduto", "", ["3/4\"", "1\""], "un"),
      serie("Eletroduto PVC rígido (por metro)", "", ["3/4\"", "1\""], "m"),
      serie("Unidut reto", "", ["3/4\"", "1\""], "un"), serie("Unidut cônico", "", ["3/4\"", "1\""], "un"),
      [["Sealtubo (conduíte metálico flexível) 3/4\"", "m"], ["Sealtubo (conduíte metálico flexível) 1\"", "m"], ["Box reto para sealtubo 3/4\"", "un"], ["Box curvo para sealtubo 3/4\"", "un"]]
    )),
    grupo("Eletrocalhas, perfilados e leitos", cat(
      serie("Eletrocalha lisa perfurada galvanizada", "", ["50x50 mm", "100x50 mm", "150x50 mm", "200x50 mm", "200x100 mm", "300x100 mm"], "barra"),
      [["Tampa para eletrocalha 100 mm", "barra"], ["Tampa para eletrocalha 200 mm", "barra"], ["Curva horizontal 90° para eletrocalha", "un"], ["Curva vertical para eletrocalha", "un"],
       ["Tê horizontal para eletrocalha", "un"], ["Emenda para eletrocalha", "un"], ["Saída de eletrocalha para eletroduto", "un"],
       ["Perfilado perfurado 38x38 mm (3 m)", "barra"], ["Perfilado liso 38x38 mm (3 m)", "barra"], ["Emenda interna para perfilado", "un"], ["Curva / tê para perfilado", "un"],
       ["Leito para cabos 300 mm", "barra"], ["Leito para cabos 500 mm", "barra"], ["Suspensão / mão francesa para eletrocalha", "un"],
       ["Vergalhão rosca total 1/4\"", "barra"], ["Vergalhão rosca total 3/8\"", "barra"], ["Porca e arruela 1/4\"", "un"], ["Porca e arruela 3/8\"", "un"],
       ["Gancho / tirante para teto", "un"], ["Parafuso cabeça lentilha (eletrocalha)", "cento"], ["Canaleta PVC com adesivo 20x10 mm", "barra"],
       ["Canaleta PVC 50x20 mm", "barra"], ["Canaleta de piso / rodapé", "barra"], ["Moldura / canaleta sistema X", "barra"]]
    )),
    grupo("Caixas e conduletes", [
      ["Caixa 4x2 PVC embutir", "un"], ["Caixa 4x4 PVC embutir", "un"], ["Caixa octogonal 4x4 (teto)", "un"], ["Caixa 4x2 sobrepor", "un"], ["Caixa 4x4 sobrepor", "un"],
      ["Caixa para drywall 4x2", "un"], ["Caixa de passagem PVC 10x10 cm", "un"], ["Caixa de passagem PVC 15x15 cm", "un"], ["Caixa de passagem PVC 20x20 cm", "un"],
      ["Caixa de passagem metálica 20x20 cm", "un"], ["Caixa de passagem metálica 30x30 cm", "un"], ["Caixa de passagem de piso / alvenaria 30x30 cm", "un"],
      ["Caixa hermética IP65 (sobrepor)", "un"], ["Condulete de alumínio 3/4\" (LL, LB, LR, T, X)", "un"], ["Condulete de alumínio 1\" (LL, LB, LR, T, X)", "un"],
      ["Condulete PVC 3/4\"", "un"], ["Tampa cega para condulete", "un"], ["Tampa para condulete com tomada", "un"], ["Tampa para condulete com interruptor", "un"]
    ]),
    grupo("Tomadas e interruptores", [
      ["Tomada 2P+T 10 A (completa)", "un"], ["Tomada 2P+T 20 A (completa)", "un"], ["Tomada dupla 2P+T 10 A", "un"], ["Tomada tripla 2P+T 10 A", "un"],
      ["Interruptor simples (1 tecla)", "un"], ["Interruptor 2 teclas", "un"], ["Interruptor 3 teclas", "un"], ["Interruptor paralelo (three-way)", "un"],
      ["Interruptor intermediário (four-way)", "un"], ["Interruptor + tomada (conjugado)", "un"], ["Pulsador de campainha", "un"], ["Dimmer", "un"],
      ["Tomada USB", "un"], ["Tomada de rede RJ45 (keystone)", "un"], ["Tomada de TV / coaxial", "un"], ["Tomada de telefone RJ11", "un"],
      ["Placa 4x2 cega", "un"], ["Placa 4x4 cega", "un"], ["Suporte 4x2", "un"], ["Suporte 4x4", "un"],
      ["Tomada industrial 2P+T 16 A (sobrepor)", "un"], ["Tomada industrial 3P+T 32 A (sobrepor)", "un"], ["Plugue industrial 3P+T 32 A", "un"], ["Plugue 2P+T 10 A", "un"],
      ["Tomada de sobrepor (sistema X)", "un"], ["Extensão / filtro de linha", "un"],
      ["Tomada simples 20 A (sem placa)", "un"], ["Interruptor duplo (2 teclas simples)", "un"], ["Interruptor paralelo + interruptor simples (conjugado)", "un"],
      ["Interruptor 2 paralelos (conjugado)", "un"], ["Rabicho (plugue) macho 10 A tipo extensão", "un"], ["Rabicho (tomada) fêmea 10 A tipo extensão", "un"]
    ]),
    grupo("Quadros e proteção", cat(
      [["Quadro de distribuição PVC embutir 12 disjuntores", "un"], ["Quadro de distribuição PVC sobrepor 10/12 disjuntores DIN", "un"], ["Quadro de distribuição PVC embutir 24 disjuntores", "un"], ["Quadro de distribuição metálico sobrepor 12/18 disjuntores", "un"],
       ["Quadro de distribuição metálico 24/32 disjuntores (com barramento)", "un"], ["Quadro de comando metálico 40x40x20 cm", "un"], ["Quadro de comando metálico 60x50x20 cm", "un"],
       ["Caixa para medidor (padrão concessionária)", "un"]],
      serie("Disjuntor monopolar DIN", " A", ["2", "4", "6", "10", "16", "20", "25", "32", "40", "50", "63"], "un"),
      serie("Disjuntor bipolar DIN", " A", ["16", "20", "25", "32", "40", "50", "63"], "un"),
      serie("Disjuntor tripolar DIN", " A", ["16", "20", "25", "32", "40", "50", "63"], "un"),
      serie("Disjuntor tripolar caixa moldada", " A", ["100", "125", "160", "200", "250"], "un"),
      [["Interruptor DR bipolar 25 A 30 mA", "un"], ["Interruptor DR bipolar 40 A 30 mA", "un"], ["Interruptor DR tetrapolar 40 A 30 mA", "un"], ["Interruptor DR tetrapolar 63 A 30 mA", "un"],
       ["DPS 275 V 20 kA", "un"], ["DPS 275 V 40 kA", "un"], ["Barramento pente monopolar", "un"], ["Barramento pente bipolar / tripolar", "un"],
       ["Barramento de neutro", "un"], ["Barramento de terra", "un"], ["Trilho DIN 35 mm", "barra"], ["Tampa / espelho para quadro", "un"],
       ["Chave seccionadora", "un"], ["Contator 9 A", "un"], ["Contator 25 A", "un"], ["Relé térmico", "un"], ["Relé de tempo / temporizador", "un"],
       ["Relé fotoelétrico / fotocélula", "un"], ["Minuteria", "un"], ["Botoeira liga/desliga", "un"], ["Sinaleiro LED 22 mm", "un"], ["Fusível NH", "un"], ["Base para fusível NH", "un"]]
    )),
    grupo("Iluminação", [
      ["Lâmpada LED bulbo 9 W", "un"], ["Lâmpada LED bulbo 12 W", "un"], ["Lâmpada LED bulbo 15 W", "un"], ["Lâmpada LED bulbo 20 W", "un"], ["Lâmpada LED alta potência 40/50 W", "un"],
      ["Lâmpada LED tubular T8 9 W (60 cm)", "un"], ["Lâmpada LED tubular T8 18 W (120 cm)", "un"], ["Luminária para tubular T8 2x18 W", "un"], ["Luminária LED linear sobrepor 36 W", "un"],
      ["Painel LED embutir 18 W", "un"], ["Painel LED embutir 24 W", "un"], ["Painel LED sobrepor 18 W", "un"], ["Painel LED 60x60 cm 40 W", "un"],
      ["Plafon LED sobrepor 18/24 W", "un"], ["Spot LED embutir", "un"], ["Fita LED (rolo 5 m)", "un"], ["Fonte para fita LED 12 V", "un"],
      ["Refletor LED 30 W", "un"], ["Refletor LED 50 W", "un"], ["Refletor LED 100 W", "un"], ["Refletor LED 150 W", "un"], ["Refletor LED 200 W", "un"], ["Refletor LED 300/400 W", "un"],
      ["Luminária LED industrial high bay 100 W (UFO)", "un"], ["Luminária LED industrial high bay 150/200 W", "un"], ["Luminária pública LED 100 W (poste)", "un"],
      ["Luminária de emergência LED (30/60 LEDs)", "un"], ["Bloco autônomo de emergência 2 faróis", "un"], ["Placa de saída de emergência LED", "un"],
      ["Arandela / luminária de parede", "un"], ["Luminária tartaruga / blindada", "un"], ["Sensor de presença de teto", "un"], ["Sensor de presença de parede", "un"],
      ["Soquete E27", "un"], ["Reator / driver para LED", "un"], ["Braço para luminária pública", "un"],
      ["Plafon com receptáculo de cerâmica (porcelana) E27", "un"], ["Receptáculo (bocal) de porcelana E27", "un"],
      ["Luminária LED 1,20 m (calha com tubular) para depósito / galpão", "un"], ["Lâmpada LED bulbo (comum)", "un"]
    ]),
    grupo("Aterramento e SPDA", [
      ["Haste de aterramento cobreada 5/8\" x 2,40 m", "un"], ["Haste de aterramento cobreada 5/8\" x 3,00 m", "un"], ["Conector para haste (grampo)", "un"],
      ["Caixa de inspeção de aterramento PVC", "un"], ["Caixa de inspeção de aterramento de concreto/ferro fundido", "un"], ["Barra de equipotencialização (BEP)", "un"],
      ["Terminal / sapata de compressão", "un"], ["Solda exotérmica (cartucho)", "un"], ["Captor Franklin", "un"], ["Mastro para SPDA", "un"],
      ["Cordoalha de alumínio / barra chata (SPDA)", "m"], ["Suporte isolador para descida (SPDA)", "un"], ["Conector de medição (SPDA)", "un"], ["Tubo de proteção para descida (SPDA)", "un"]
    ]),
    grupo("Rede aérea e postes", [
      ["Poste de concreto padrão (entrada de energia)", "un"], ["Poste de aço galvanizado 7 m", "un"], ["Poste de eucalipto tratado", "un"],
      ["Isolador roldana de porcelana", "un"], ["Isolador de disco / suspensão", "un"], ["Armação secundária 1 estribo", "un"], ["Armação secundária 3 estribos", "un"],
      ["Cinta / abraçadeira para poste", "un"], ["Parafuso de máquina para poste", "un"], ["Alça pré-formada", "un"], ["Conector perfurante", "un"],
      ["Conector cunha / tipo H", "un"], ["Cabo de aço / cordoalha de estai", "m"], ["Isolador para estai", "un"], ["Ferragem de ancoragem (gancho olhal)", "un"]
    ]),
    grupo("Conexões e acabamentos", [
      ["Terminal tubular (ilhós) 1,5/2,5 mm²", "cento"], ["Terminal tubular (ilhós) 4/6 mm²", "cento"], ["Terminal olhal / pino de compressão", "cento"],
      ["Conector de emenda tipo Wago (2/3/5 vias)", "un"], ["Conector torção (cone)", "cento"], ["Conector split bolt", "un"], ["Borne / régua de bornes", "un"],
      ["Fita isolante 19 mm x 20 m", "un"], ["Fita de autofusão", "un"], ["Fita isolante colorida (identificação)", "un"], ["Espaguete termorretrátil", "m"],
      ["Abraçadeira de nylon 200 mm", "cento"], ["Abraçadeira de nylon 300/400 mm", "cento"], ["Base adesiva para abraçadeira", "cento"], ["Anilha / identificador de cabos", "cento"],
      ["Bucha de nylon 6 com parafuso", "cento"], ["Bucha de nylon 8 com parafuso", "cento"], ["Chumbador / parabolt 3/8\"", "un"], ["Fita perfurada galvanizada", "m"],
      ["Prensa-cabo", "un"], ["Massa de calafetar / vedação", "un"], ["Espuma expansiva", "un"],
      ["Prensa-cabo 1/2\"", "un"], ["Prensa-cabo 3/4\"", "un"], ["Prensa-cabo 1\"", "un"], ["Parafuso com bucha S6", "un"], ["Parafuso com bucha S8", "un"],
      ["Conector sindal (barra de conectores) 6 mm²", "un"], ["Conector sindal (barra de conectores) 10 mm²", "un"], ["Conector sindal (barra de conectores) 16 mm²", "un"],
      ["Fita veda-rosca (teflon)", "un"], ["Fita isolante grande 19 mm x 20 m", "un"], ["Kit de terminais elétricos (sortidos)", "kit"]
    ]),
    grupo("Equipamentos e pontos", [
      ["Chuveiro elétrico 220 V", "un"], ["Chuveiro elétrico 127 V", "un"], ["Cano alongador (extensor) de PVC para chuveiro", "un"], ["Resistência para chuveiro", "un"], ["Ventilador de teto", "un"], ["Exaustor", "un"], ["Campainha", "un"],
      ["Interfone / porteiro eletrônico", "un"], ["Fechadura elétrica", "un"], ["Rack / patch panel", "un"], ["Switch de rede", "un"],
      ["Motor de portão", "un"], ["Bomba d'água (ligação elétrica)", "un"], ["Automático de boia", "un"]
    ]),
    grupo("Comando de motores e bombas", cat(
      [["Caixa de comando IP65 em policarbonato (botoeira)", "un"], ["Botão pulsador LIGA verde 22 mm", "un"], ["Botão pulsador DESLIGA vermelho 22 mm", "un"],
       ["Botão de emergência (cogumelo) 22 mm", "un"], ["Chave seletora 3 posições MANUAL / 0 / AUTOMÁTICO 22 mm", "un"], ["Chave seletora 2 posições 22 mm", "un"],
       ["Sinaleiro LED vermelho 220 V 22 mm", "un"], ["Sinaleiro LED verde 220 V 22 mm", "un"], ["Sinaleiro LED amarelo 220 V 22 mm", "un"],
       ["Painel de comando completo (montado)", "un"], ["Quadro de comando metálico 40x30x20 cm", "un"], ["Placa de montagem para quadro de comando", "un"],
       ["Canaleta plástica recortada para painel 30x50 mm", "barra"], ["Borne de passagem para trilho DIN (SAK) 2,5/4 mm²", "un"], ["Borne terra para trilho DIN", "un"],
       ["Poste final / tampa para borne", "un"], ["Kit de identificação de componentes (plaquetas)", "kit"], ["Anilhas numeradas para fios de comando", "cento"]],
      serie("Disjuntor-motor regulável", " A", ["1,6–2,5", "2,5–4", "4–6,3", "6–10", "9–14", "13–18", "17–23", "20–25", "24–32"], "un"),
      serie("Contator tripolar", " A", ["12", "18", "32", "40", "50", "65"], "un"),
      [["Contato auxiliar para contator", "un"], ["Relé de falta de fase", "un"], ["Relé de nível (controle de bomba)", "un"], ["Chave boia elétrica", "un"],
       ["Soft-starter", "un"], ["Inversor de frequência", "un"], ["Fusível de comando com base", "un"]]
    )),
    grupo("Câmeras e CFTV", [
      ["Câmera bullet HD 1080p (analógica HDCVI/AHD)", "un"], ["Câmera dome HD 1080p (analógica HDCVI/AHD)", "un"], ["Câmera bullet IP 2 MP PoE", "un"],
      ["Câmera dome IP 2 MP PoE", "un"], ["Câmera IP 4 MP PoE", "un"], ["Câmera IP 8 MP (4K) PoE", "un"], ["Câmera full color / visão noturna colorida", "un"],
      ["Câmera speed dome PTZ", "un"], ["Câmera Wi-Fi (interna)", "un"], ["Câmera Wi-Fi (externa)", "un"], ["Câmera com áudio / microfone", "un"],
      ["DVR 4 canais", "un"], ["DVR 8 canais", "un"], ["DVR 16 canais", "un"], ["NVR 4 canais PoE", "un"], ["NVR 8 canais PoE", "un"], ["NVR 16 canais", "un"],
      ["HD para CFTV 1 TB (Purple / SkyHawk)", "un"], ["HD para CFTV 2 TB", "un"], ["HD para CFTV 4 TB", "un"], ["Cartão de memória microSD 64/128 GB", "un"],
      ["Fonte colmeia 12 V 10 A", "un"], ["Fonte colmeia 12 V 20 A", "un"], ["Fonte 12 V 1 A individual", "un"], ["Nobreak para DVR/NVR", "un"],
      ["Switch PoE 4 portas", "un"], ["Switch PoE 8 portas", "un"], ["Switch PoE 16 portas", "un"], ["Injetor PoE", "un"],
      ["Balun (conversor) passivo HD", "par"], ["Conector BNC de mola / crimpar", "un"], ["Conector P4 macho / fêmea", "un"], ["Conector RJ45 Cat5e/Cat6", "cento"],
      ["Cabo coaxial bipolar 4 mm (CFTV)", "m"], ["Cabo coaxial bipolar 4 mm (rolo 100 m)", "rolo"], ["Cabo UTP Cat5e externo (CFTV)", "m"], ["Cabo UTP Cat6 externo", "m"],
      ["Caixa de passagem para câmera (CFTV)", "un"], ["Suporte para câmera bullet", "un"], ["Suporte para câmera dome (poste/parede)", "un"],
      ["Suporte / abraçadeira de poste para câmera", "un"], ["Rack de parede 5U / 8U", "un"], ["Monitor para CFTV 19 a 21 pol.", "un"], ["Cabo HDMI", "un"],
      ["Mouse / cabo de rede para DVR", "un"], ["Placa de aviso \"Área monitorada\"", "un"], ["Antena / roteador Wi-Fi", "un"]
    ])
  );

  var pintura = cat(
    grupo("Tintas para paredes", [
      ["Tinta acrílica premium fosca (lata 18 L)", "lata"], ["Tinta acrílica premium fosca (galão 3,6 L)", "galão"], ["Tinta acrílica standard (lata 18 L)", "lata"],
      ["Tinta acrílica econômica (lata 18 L)", "lata"], ["Tinta acrílica acetinada (lata 18 L)", "lata"], ["Tinta acrílica semibrilho (lata 18 L)", "lata"],
      ["Tinta látex PVA (lata 18 L)", "lata"], ["Tinta para teto / gesso (lata 18 L)", "lata"], ["Tinta acrílica lavável (lata 18 L)", "lata"],
      ["Tinta elastomérica para fachada (lata 18 L)", "lata"], ["Tinta emborrachada / impermeabilizante (lata 18 L)", "lata"], ["Tinta para piso / quadras (lata 18 L)", "lata"],
      ["Tinta para piso / quadras (galão 3,6 L)", "galão"], ["Tinta antimofo (lata 18 L)", "lata"], ["Tinta de demarcação viária (lata 18 L)", "lata"],
      ["Tinta de demarcação viária (galão 3,6 L)", "galão"], ["Microesferas de vidro (demarcação)", "kg"], ["Textura acrílica (balde 25 kg)", "un"],
      ["Grafiato (balde 25 kg)", "un"], ["Cimento queimado / efeito decorativo", "un"], ["Pigmento / corante (bisnaga)", "un"]
    ]),
    grupo("Fundos, seladores e massas", [
      ["Selador acrílico (lata 18 L)", "lata"], ["Fundo preparador de paredes (lata 18 L)", "lata"], ["Fundo preparador de paredes (galão 3,6 L)", "galão"],
      ["Selador para madeira", "galão"], ["Massa corrida PVA (lata 25 kg)", "un"], ["Massa acrílica (lata 25 kg)", "un"], ["Massa acrílica (galão 3,6 L)", "galão"],
      ["Massa para madeira", "un"], ["Gesso em pó (saco 20/40 kg)", "un"], ["Massa para drywall (balde)", "un"], ["Fita para drywall (telada / papel)", "un"],
      ["Fundo para gesso / drywall", "galão"], ["Cal hidratada (saco 20 kg)", "un"], ["Argamassa / reboco pronto (saco)", "un"], ["Primer epóxi (galão)", "galão"]
    ]),
    grupo("Metais e anticorrosivos", [
      ["Fundo zarcão / anticorrosivo (galão 3,6 L)", "galão"], ["Fundo zarcão / anticorrosivo (lata 18 L)", "lata"], ["Fundo para galvanizado (galão)", "galão"],
      ["Primer epóxi para metal (kit)", "kit"], ["Esmalte sintético brilhante (galão 3,6 L)", "galão"], ["Esmalte sintético brilhante (lata 18 L)", "lata"],
      ["Esmalte sintético acetinado (galão 3,6 L)", "galão"], ["Esmalte à base d'água (galão 3,6 L)", "galão"], ["Esmalte industrial (alquídico) (galão 3,6 L)", "galão"],
      ["Tinta epóxi industrial (kit)", "kit"], ["Tinta poliuretano (PU) industrial (kit)", "kit"], ["Tinta para altas temperaturas", "un"],
      ["Tinta spray", "un"], ["Removedor de ferrugem / convertedor", "un"], ["Desengraxante", "lata"]
    ]),
    grupo("Pisos, epóxi e impermeabilização", [
      ["Epóxi autonivelante (kit)", "kit"], ["Tinta epóxi para piso (kit)", "kit"], ["Primer epóxi para piso (kit)", "kit"], ["Verniz / poliuretano para piso", "kit"],
      ["Endurecedor / catalisador", "un"], ["Areia de quartzo (antiderrapante)", "kg"], ["Manta líquida acrílica (balde 18 L)", "lata"],
      ["Manta asfáltica", "m²"], ["Impermeabilizante cimentício (caixa / saco)", "un"], ["Tela de poliéster para impermeabilização", "m²"],
      ["Selante PU para juntas (sachê / tubo)", "un"], ["Fita de demarcação adesiva para piso", "un"]
    ]),
    grupo("Madeira e vernizes", [
      ["Verniz marítimo (galão)", "galão"], ["Verniz copal (galão)", "galão"], ["Stain / impregnante para madeira (galão)", "galão"], ["Seladora nitrocelulose", "galão"],
      ["Cupinicida", "lata"], ["Óleo para madeira", "lata"]
    ]),
    grupo("Solventes e diluentes", [
      ["Aguarrás (5 L)", "un"], ["Thinner (5 L)", "un"], ["Diluente para epóxi", "lata"], ["Removedor de tinta (pastoso)", "un"], ["Água sanitária / limpeza de mofo", "lata"], ["Detergente / limpador pesado", "lata"]
    ]),
    grupo("Ferramentas e consumíveis", [
      ["Rolo de lã 23 cm", "un"], ["Rolo de espuma 9/15 cm", "un"], ["Rolo de textura", "un"], ["Rolo para epóxi (antigota)", "un"], ["Suporte / garfo para rolo", "un"],
      ["Cabo extensor para rolo", "un"], ["Bandeja para pintura", "un"], ["Trincha 1\"", "un"], ["Trincha 2\"", "un"], ["Trincha 3\"", "un"], ["Pincel / brocha", "un"],
      ["Espátula", "un"], ["Desempenadeira de aço", "un"], ["Desempenadeira de PVC", "un"], ["Lixa d'água / ferro (folha)", "un"], ["Lixa para parede (folha)", "un"],
      ["Disco de lixa para lixadeira", "un"], ["Disco flap / desbaste", "un"], ["Escova de aço", "un"], ["Fita crepe 18 mm", "un"], ["Fita crepe 48 mm", "un"],
      ["Lona plástica (proteção)", "m²"], ["Papelão / papel de proteção de piso", "m²"], ["Filme stretch / plástico bolha", "un"], ["Estopa", "kg"],
      ["Balde", "un"], ["Peneira para tinta", "un"], ["Mexedor de tinta", "un"], ["Pistola de pintura / airless (bico)", "un"]
    ]),
    grupo("Trabalho em altura e acesso por corda", [
      ["Corda semiestática 11 mm", "m"], ["Mosquetão de aço (trava rosca)", "un"], ["Descensor autoblocante", "un"], ["Trava-quedas para corda", "un"],
      ["Cinto paraquedista", "un"], ["Talabarte duplo", "un"], ["Cadeira suspensa (cadeirinha)", "un"], ["Fita de ancoragem", "un"],
      ["Protetor de corda", "un"], ["Capacete com jugular", "un"], ["Luvas", "par"], ["Óculos de proteção", "un"], ["Máscara PFF2 / respirador", "un"], ["Andaime (locação)", "dia"]
    ]),
    grupo("Limpeza de vidros e fachadas", [
      ["Detergente neutro para vidros (5 L)", "un"], ["Limpa-vidros concentrado", "lata"], ["Rodo para vidro 35/45 cm", "un"], ["Lavador de vidro (luva)", "un"],
      ["Raspador de vidro / lâmina", "un"], ["Pano de microfibra", "un"], ["Balde para limpeza em altura", "un"], ["Removedor de cimento / calcário", "lata"]
    ])
  );

  window.AGE_MATERIAIS_BASE = {
    eletrica: { nome: "lista de materiais elétricos", fonte: "Materiais AGE", itens: eletrica },
    pintura: { nome: "lista de materiais de pintura", fonte: "Materiais AGE", itens: pintura }
  };
})();
