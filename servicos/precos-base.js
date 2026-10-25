// Listas iniciais da 💲 Tabela de preços (o dono carrega uma vez e depois edita à vontade no painel).
// Elétrica: os tipos de serviço mais comuns; só têm valor os que o dono informou — os outros ficam "a definir".
// Pintura: "Sugestão de preços de pintura 2026" da ABRAPP (Associação Brasileira dos Pintores Profissionais),
// mão de obra sem material. Valor = média; mínimo/máximo para obra simples/difícil (ver as dicas na tela).
(function () {
  "use strict";
  var ate = " (até 3 m de altura)", acima = " (acima de 3 m)";
  // [descrição, unidade, valor, mínimo, máximo]
  function grupo(nome, linhas) { return linhas.map(function (l) { return { grupo: nome, descricao: l[0], un: l[1], valor: l[2], valor_min: l[3], valor_max: l[4] }; }); }
  // mesmo serviço com preço até 3 m e acima de 3 m de altura
  function alt(desc, un, a, b) { return [[desc + ate, un].concat(a), [desc + acima, un].concat(b)]; }
  function cat() { return [].concat.apply([], arguments); }

  var eletrica = cat(
    grupo("Tomadas e interruptores", [
      ["Instalação de tomada", "un", 35], ["Instalação de tomada 20 A", "un", null], ["Instalação de tomada industrial (3P+T)", "un", null],
      ["Instalação de tomada de piso", "un", null], ["Troca de tomada", "un", null], ["Instalação de interruptor simples", "un", null],
      ["Instalação de interruptor paralelo (three-way)", "un", null], ["Troca de interruptor", "un", null], ["Instalação de caixa 4x2 / 4x4 em alvenaria", "un", null]
    ]),
    grupo("Infraestrutura", [
      ["Infra com tubo (eletroduto) 3/4\"", "m", 5], ["Infra com eletrocalha", "m", 10], ["Infra com tubo (eletroduto) 1\"", "m", null],
      ["Infra com perfilado", "m", null], ["Infra com canaleta aparente", "m", null], ["Eletroduto embutido (rasgo em alvenaria)", "m", null],
      ["Leito para cabos", "m", null], ["Instalação de caixa de passagem / condulete", "un", null]
    ]),
    grupo("Circuitos e cabos", [
      ["Circuito elétrico (passagem de cabos)", "m", 3], ["Passagem de cabo PP", "m", null], ["Lançamento de cabo de alimentação (quadro)", "m", null],
      ["Cabo de rede / lógica", "m", null], ["Identificação de circuitos", "un", null]
    ]),
    grupo("Quadros e proteção", [
      ["Montagem de quadro de distribuição", "un", null], ["Troca de quadro de distribuição", "un", null], ["Instalação / troca de disjuntor", "un", null],
      ["Instalação de DR", "un", null], ["Instalação de DPS", "un", null], ["Organização de quadro (pentear e identificar)", "un", null]
    ]),
    grupo("Iluminação", [
      ["Instalação de luminária / plafon", "un", null], ["Instalação de luminária LED tubular", "un", null], ["Instalação de refletor LED", "un", null],
      ["Instalação de luminária de emergência", "un", null], ["Troca de lâmpada", "un", null], ["Troca de reator / driver", "un", null],
      ["Instalação de sensor de presença", "un", null], ["Instalação de fotocélula / relé fotoelétrico", "un", null], ["Iluminação de poste / área externa", "un", null]
    ]),
    grupo("Equipamentos", [
      ["Instalação de chuveiro", "un", null], ["Troca de resistência de chuveiro", "un", null], ["Instalação de ventilador de teto", "un", null],
      ["Instalação de exaustor", "un", null], ["Ponto elétrico para ar-condicionado", "un", null], ["Instalação de campainha / interfone", "un", null],
      ["Ligação de motor / portão automático", "un", null]
    ]),
    grupo("Entrada e aterramento", [
      ["Padrão de entrada monofásico", "un", null], ["Padrão de entrada bifásico", "un", null], ["Padrão de entrada trifásico", "un", null],
      ["Aterramento com haste", "un", null]
    ]),
    grupo("Serviços gerais", [
      ["Visita técnica / orçamento", "un", null], ["Diária de eletricista", "dia", null], ["Diária de ajudante", "dia", null],
      ["Hora técnica", "h", null], ["Localização de curto / pane", "un", null], ["Medição e teste de isolamento / laudo", "un", null]
    ])
  );

  var pintura = cat(
    grupo("Diárias, lavagens e limpeza", [
      ["Diária ajudante – serviço básico 8h", "dia", 124.49, 104.84, 144.15],
      ["Diária pintor profissional – serviços gerais 8h", "dia", 216.22, 170.36, 262.09],
      ["Diária pintor profissional líder 8h", "dia", 248.99, 209.67, 288.30],
      ["Diária pintor ajudante cordeiro/cadeirinha 8h", "dia", 235.88, 196.57, 275.19],
      ["Diária pintor profissional cordeiro/cadeirinha 8h", "dia", 301.40, 262.09, 340.72],
      ["Diária proprietário c/ ferramentas, equipamentos e certificados", "dia", 353.82, 288.30, 419.34],
      ["Lavagem de tijolinho para aplicação de silicone" + ate, "m²", 5.52, 3.88, 7.16],
      ["Lavagem de calha – telhado simples" + ate, "m", 14.74, 11.89, 17.59],
      ["Lavagem de calha – sobrado" + acima, "m", 23.30, 17.47, 29.12],
      ["Lavagem de pingadeiras para muros", "m", 10.19, 7.16, 13.23],
      ["Lavagem de caixa d'água – telhado baixo" + ate, "un", 232.85, 174.61, 291.09],
      ["Lavagem de caixa d'água – telhado alto" + acima, "un", 349.21, 262.09, 436.33],
      ["Lavagem de telhado com lavadora pressurizada" + ate, "m²", 14.56, 10.19, 18.93],
      ["Lavagem de telhado com lavadora pressurizada" + acima, "m²", 18.87, 14.44, 23.30],
      ["Lavagem de parede – sujeiras em geral" + ate, "m²", 4.85, 3.28, 6.43],
      ["Lavagem de parede – sujeiras em geral" + acima, "m²", 12.32, 7.16, 17.47],
      ["Lavagem de piso simples – mangueira", "m²", 5.56, 4.27, 6.85],
      ["Lavagem de piso – máquina com água pressurizada", "m²", 9.16, 7.30, 11.01],
      ["Deslocamento até a obra (por km)", "km", 8.68, 5.82, 11.53]
    ]),
    // limpeza de vidros e pintura de fachada em altura com acesso por corda (cadeira suspensa / alpinismo industrial, NR-35)
    // a ABRAPP não tem preço de limpeza: ficam "a definir"; as diárias de cordeiro são as da tabela
    grupo("Acesso por corda (cadeirinha / alpinismo industrial)", [
      ["Limpeza de vidros / vidraças com acesso por corda", "m²", null],
      ["Limpeza de fachada (ACM, pele de vidro, revestimento) com acesso por corda", "m²", null],
      ["Pintura de fachada com acesso por corda – 2 demãos (lavagem não inclusa)", "m²", null],
      ["Lavagem de fachada com lavadora pressurizada por corda", "m²", null],
      ["Diária cordeiro – pintor/limpador profissional na cadeirinha 8h", "dia", 301.40, 262.09, 340.72],
      ["Diária cordeiro – ajudante na cadeirinha 8h", "dia", 235.88, 196.57, 275.19],
      ["Montagem de ancoragem e isolamento da área (por queda)", "un", null]
    ]),
    grupo("Serviços diversos", [
      ["Resinar telhas em geral 2 demãos (resina acrílica, lavagem inclusa)", "m²", 25.12, 19.66, 30.58],
      ["Resinar telhas em geral 3 demãos (resina acrílica, lavagem inclusa)", "m²", 32.09, 24.87, 39.31],
      ["Resinar telhas de fibrocimento ou amianto (pouco madeiramento)", "m²", 37.86, 29.12, 46.59],
      ["Pintura de calha – telhado simples" + ate, "m", 32.64, 24.75, 40.53],
      ["Pintura de calha – sobrado" + acima, "m", 40.77, 30.58, 50.96],
      ["Pintura de pingadeiras para muros", "m", 19.72, 11.89, 27.54],
      ["Porcelanato líquido – epóxi alta espessura industrial (fundo + acabamento)", "m²", 305.47, 232.73, 378.21],
      ["Porcelanato líquido – epóxi 3D e artístico (fundo + acabamento + adesivo)", "m²", 436.39, 363.65, 509.13],
      ["Acerto com cimento em parede – grandes correções" + ate, "m²", 19.66, 11.77, 27.54],
      ["Fissuras – selante para trincas" + ate, "m", 12.26, 10.07, 14.44],
      ["Trincas – tela e massa" + ate, "m", 24.02, 18.93, 29.12]
    ].concat(
      alt("Aplicação de papel de parede comum (por rolo)", "rolo", [98.16, 79.96, 116.36], [149.12, 123.64, 174.61]),
      alt("Aplicação de papel de parede importado (por rolo)", "rolo", [134.50, 109.08, 159.92], [196.39, 174.61, 218.17]),
      [["Aplicação de papel de parede líquido importado" + ate, "m²", 112.72, 79.96, 145.48],
       ["Pintura de piscina PU – repintura simples 2 demãos", "m²", 196.57, 157.25, 235.88],
       ["Pintura de piscina PU – pintura completa 3 demãos", "m²", 262.09, 222.78, 301.40]]
    )),
    grupo("Impermeabilização", [].concat(
      alt("Fachada – tinta impermeabilizante elástica 2 demãos (lavagem não inclusa)", "m²", [20.20, 14.44, 25.97], [28.58, 20.87, 36.28]),
      alt("Fachada – tinta impermeabilizante elástica 3 demãos (lavagem não inclusa)", "m²", [22.14, 15.77, 28.51], [28.58, 20.87, 36.28]),
      [["Rodapé – massa corrida: umidade ascendente, pouca umidade", "m²", 30.21, 17.23, 43.20],
       ["Rodapé – argamassa: umidade ascendente, muita umidade", "m²", 78.87, 60.67, 97.07],
       ["Telhado – manta líquida fria emborrachada flexível 3 demãos (lavagem inclusa)", "m²", 37.86, 29.12, 46.59],
       ["Telhado – manta asfáltica (maçarico, só profissional especializado)", "m²", 78.87, 60.67, 97.07],
       ["Telhado – fita aluminizada, colagem a frio", "m", 37.86, 29.12, 46.59],
       ["Laje – manta líquida fria emborrachada flexível 3 demãos (lavagem inclusa)", "m²", 37.86, 29.12, 46.59],
       ["Piscina – manta líquida (lavagem inclusa)", "m²", 37.86, 29.12, 46.59],
       ["Piscina – argamassa: umidade ascendente, muita umidade", "m²", 78.87, 60.67, 97.07],
       ["Calhetões de alvenaria – manta líquida (lavagem inclusa)", "m²", 37.86, 29.12, 46.59],
       ["Baldrame – pintura asfáltica (membrana para alicerces, baldrames e muros)", "m²", 9.53, 7.28, 11.77],
       ["Baldrame – argamassa: tratamento de umidade ascendente", "m²", 44.90, 36.40, 53.39],
       ["Baldrame – fita asfáltica aplicada a frio + primer", "m", 37.86, 29.12, 46.59],
       ["Baldrame – manta asfáltica (maçarico, só profissional especializado)", "m²", 78.87, 60.67, 97.07]],
      alt("Selante PU ou silicone acético para juntas", "m", [5.76, 4.25, 7.28], [7.46, 5.46, 9.46])
    )),
    grupo("Alvenarias e paredes", [].concat(
      alt("Látex acrílico econômico fosco 2 demãos", "m²", [14.86, 10.31, 19.41], [17.59, 12.98, 22.20]),
      alt("Látex acrílico econômico fosco 3 demãos", "m²", [20.20, 14.44, 25.97], [24.93, 17.47, 32.40]),
      alt("Látex acrílico standard fosco 2 demãos", "m²", [16.26, 11.65, 20.87], [18.50, 14.20, 22.81]),
      alt("Látex acrílico standard fosco 3 demãos", "m²", [22.27, 15.65, 28.88], [26.51, 19.17, 33.85]),
      alt("Látex acrílico premium fosco 3 demãos", "m²", [20.20, 14.44, 25.97], [28.58, 20.87, 36.28]),
      alt("Látex acrílico premium acetinado 3 demãos", "m²", [25.58, 19.05, 32.11], [29.91, 22.08, 37.74]),
      alt("Látex acrílico premium semibrilho 3 demãos", "m²", [28.21, 20.38, 36.04], [29.00, 21.72, 36.28]),
      [["Demão adicional de qualquer tinta" + ate, "m²", 14.86, 10.31, 19.41],
       ["Muros já limpos – 1 demão de cal" + ate, "m²", 11.41, 9.46, 13.35],
       ["Parede gesso 3D (massa + pintura)" + ate, "m²", 79.29, 58.24, 100.35],
       ["Pintura em chapisco, grafiato, parede porosa" + ate, "m²", 29.79, 20.38, 39.19],
       ["Fundo preparador (gruda partes soltas)" + ate, "m²", 9.53, 7.28, 11.77],
       ["Fundo selador acrílico (parede nova sem pintura)" + ate, "m²", 9.53, 7.28, 11.77],
       ["Descascar / remover tinta e textura antiga" + ate, "m²", 7.64, 6.43, 8.86],
       ["Remoção de pintura com lixamento" + ate, "m²", 9.10, 7.77, 10.44],
       ["Remoção de pintura com produto químico" + ate, "m²", 10.37, 9.10, 11.65],
       ["Verniz acrílico – resina protetora / liqui-brilho para parede e concreto" + ate, "m²", 11.41, 10.31, 12.50],
       ["Silicone (acquela) em tijolos / tijolinho baiano" + ate, "m²", 11.41, 10.31, 12.50]]
    )),
    grupo("Massas e preenchimentos", [].concat(
      alt("Massa corrida – gesso/superfície boa/repintura (já selada) 2 demãos", "m²", [16.99, 10.44, 23.54], [19.05, 11.89, 26.21]),
      alt("Massa corrida – gesso/superfície boa/repintura (já selada) 3 demãos", "m²", [23.30, 13.10, 33.49], [26.09, 15.53, 36.64]),
      alt("Massa corrida – reboco/superfície irregular (já selada) 2 demãos", "m²", [18.99, 11.77, 26.21], [23.48, 13.10, 33.85]),
      alt("Massa corrida – reboco/superfície irregular (já selada) 3 demãos", "m²", [26.21, 14.56, 37.86], [29.49, 15.77, 43.20]),
      alt("Massa acrílica – gesso/superfície boa/repintura (já selada) 2 demãos", "m²", [24.88, 15.35, 34.40], [27.67, 16.69, 38.65]),
      alt("Massa acrílica – gesso/superfície boa/repintura (já selada) 3 demãos", "m²", [31.37, 18.26, 44.47], [34.22, 19.72, 48.72]),
      alt("Massa acrílica – reboco/superfície irregular (já selada) 2 demãos", "m²", [26.21, 16.69, 35.74], [29.55, 18.02, 41.08]),
      alt("Massa acrílica – reboco/superfície irregular (já selada) 3 demãos", "m²", [32.46, 19.48, 45.44], [35.80, 20.93, 50.66])
    )),
    grupo("Efeitos decorativos", [
      ["Cimento queimado fosco", "m²", 78.63, 52.42, 104.84], ["Cimento queimado polido", "m²", 111.69, 72.68, 150.70],
      ["Cimento queimado fosco para piso", "m²", 91.71, 61.14, 122.28], ["Cimento queimado polido para piso", "m²", 130.28, 84.78, 175.78],
      ["Mármore tradicional", "m²", 119.28, 78.63, 159.92], ["Marmorato / marmorização personalizada", "m²", 147.67, 91.73, 203.61],
      ["Granito, mesclado, marroquino", "m²", 176.06, 104.84, 247.29], ["Marmorizado com tinta / gel envelhecedor", "m²", 83.66, 65.52, 101.80],
      ["Aço corten em alvenaria", "m²", 153.05, 101.12, 204.98], ["Madeira lisa em alvenaria", "m²", 83.60, 50.84, 116.36],
      ["Madeira rústica em alvenaria", "m²", 94.52, 72.68, 116.36], ["Madeira esculpida em alvenaria", "m²", 130.92, 87.24, 174.61],
      ["Madeira esculpida (demolição) em alvenaria", "m²", 152.76, 116.36, 189.17], ["Trapeado / linho / jeans", "m²", 54.60, 43.68, 65.52],
      ["Pátina comum", "m²", 65.46, 43.68, 87.24], ["Pátina demolição + variações", "m²", 76.38, 50.96, 101.80],
      ["Pátina alta resistência", "m²", 90.94, 65.52, 116.36], ["Aço corten em pergolados", "m", 90.94, 65.52, 116.36],
      ["Madeira lisa em pergolados", "m", 101.86, 72.68, 131.05]
    ]),
    grupo("Texturas", [].concat(
      alt("Textura grossa – rústica, grafiato + selar ou pintar", "m²", [28.58, 19.66, 37.49], [38.16, 24.15, 52.18]),
      [["Textura grossa – rústica, grafiato + gel envelhecedor" + ate, "m²", 33.85, 22.08, 45.62]],
      alt("Textura média – rolada/de rolo/design, superfície nova", "m²", [21.48, 16.99, 25.97], [27.42, 20.99, 33.85]),
      alt("Textura média – rolada/de rolo/design, superfície com problema", "m²", [29.24, 20.99, 37.49], [36.22, 28.88, 43.56]),
      alt("Textura projetada + selar", "m²", [36.04, 25.97, 46.11], [41.98, 31.79, 52.18]),
      [["Textura projetada + pintura ou gel envelhecedor" + ate, "m²", 46.99, 36.35, 57.64]],
      alt("Textura riscado/granfino + selar e pintar", "m²", [26.88, 14.56, 39.19], [38.59, 20.38, 56.79]),
      [["Textura riscado/granfino + gel envelhecedor" + ate, "m²", 33.37, 18.81, 47.93],
       ["Textura média personalizada + gel envelhecedor" + ate, "m²", 39.13, 23.05, 55.21]],
      alt("Textura lisa – rolada/de rolo + selar ou pintar", "m²", [21.78, 14.56, 29.00], [28.33, 16.02, 40.65]),
      [["Textura lisa personalizada + gel envelhecedor" + ate, "m²", 39.25, 23.30, 55.21],
       ["Remoção de textura em geral" + ate, "m²", 20.38, 17.47, 23.30],
       ["Remoção de textura em geral" + acima, "m²", 17.47, 14.56, 20.38]],
      alt("Textura projetada Fulget", "m²", [65.52, 52.42, 78.63], [75.35, 65.52, 85.18]),
      alt("Pedras naturais – cristal, lamato, arenito, cristaline, grafiato, granfino, quartzo", "m²", [81.50, 65.52, 97.48], [91.73, 78.63, 104.84]),
      [["Velvet (Tintas Coral)", "m²", 145.73, 116.36, 175.09], ["Nuage (Tintas Coral)", "m²", 127.53, 79.96, 175.09],
       ["Pietra (Ibratin)", "m²", 110.66, 79.96, 141.36], ["Perlato (Ibratin)", "m²", 110.66, 79.96, 141.36],
       ["Bronzato (Ibratin)", "m²", 138.72, 109.08, 168.36], ["Cristalinne (Ibratin)", "m²", 65.83, 50.84, 80.81],
       ["Stelatto (Ibratin)", "m²", 98.16, 79.96, 116.36], ["Stucco fosco (Ibratin)", "m²", 69.04, 50.84, 87.24],
       ["Stucco veneziano (Ibratin)", "m²", 98.16, 79.96, 116.36],
       ["Pintura 3D simples com tinta (lisa, sem gesso)", "m²", 69.04, 50.84, 87.24], ["Pintura 3D complexa com tinta (lisa, sem gesso)", "m²", 116.36, 87.24, 145.48],
       ["Placa gesso 3D – somente pintura", "m²", 72.68, 58.12, 87.24], ["Placa gesso 3D – tratamento + pintura fosco", "m²", 116.42, 101.80, 131.05],
       ["Placa gesso 3D – tratamento + pintura com brilho", "m²", 145.48, 131.05, 159.92], ["Placa gesso 3D – aplicação + tratamento + pintura", "m²", 196.39, 174.61, 218.17],
       ["Placa gesso 3D – venda e aplicação + tratamento + pintura", "m²", 320.15, 262.09, 378.21]]
    )),
    grupo("Esmaltes, verniz e epóxi", [].concat(
      alt("Esmalte sintético – metal e madeira lisa 2 demãos", "m²", [21.78, 16.02, 27.54], [26.33, 20.63, 32.03]),
      alt("Esmalte sintético – metal e madeira detalhada 3 demãos", "m²", [28.70, 22.20, 35.19], [32.28, 25.97, 38.59]),
      [["Esmalte sintético – telhas metálicas galvanizadas 2 demãos" + ate, "m²", 21.78, 16.02, 27.54],
       ["Fundo para metal – zarcão / primer em geral", "m²", 13.89, 11.65, 16.14],
       ["Esmalte sintético – madeiras 2 demãos", "m²", 20.26, 15.77, 24.75], ["Esmalte sintético – madeiras 3 demãos", "m²", 23.24, 18.93, 27.54],
       ["Fundo para madeira – fundo nivelador / fundo branco", "m²", 16.87, 13.23, 20.51],
       ["Verniz comum – marítimo, filtro solar, copal (rígido), fundo + tinta", "m²", 36.34, 26.09, 46.59],
       ["Verniz super premium – Cetol, Solgard, alta performance (flexível), fundo + tinta", "m²", 41.38, 30.58, 52.18],
       ["Stain – impregnante de madeira", "m²", 29.12, 20.38, 37.86], ["Seladora para madeira – proteção simples para obras", "m²", 24.81, 17.47, 32.15],
       ["Azulejo – pintura epóxi", "m²", 42.89, 32.03, 53.75], ["Azulejo – nivelamento com massa", "m²", 39.37, 29.12, 49.63]],
      alt("Esmalte epóxi base solvente 3 demãos", "m²", [27.67, 21.72, 33.61], [34.10, 24.63, 43.56]),
      alt("Esmalte epóxi base água 3 demãos", "m²", [20.99, 16.02, 25.97], [24.81, 18.93, 30.70])
    )),
    grupo("Treliças e vigas U (esmalte ou fundo sintético)", [
      ["Vigas em U pequena – na altura do chão / sem instalar", "m²", 20.78, 15.73, 25.84], ["Vigas em U média – na altura do chão / sem instalar", "m²", 23.03, 17.98, 28.09],
      ["Vigas em U grande – na altura do chão / sem instalar", "m²", 25.28, 20.22, 30.33], ["Vigas em U pequena – no alto / já instalada", "m²", 24.16, 19.10, 29.21],
      ["Vigas em U média – no alto / já instalada", "m²", 26.40, 21.35, 31.46], ["Vigas em U grande – no alto / já instalada", "m²", 28.65, 23.59, 33.71],
      ["Treliça pequena – na altura do chão / sem instalar", "m²", 20.78, 15.73, 25.84], ["Treliça média – na altura do chão / sem instalar", "m²", 23.03, 17.98, 28.09],
      ["Treliça grande – na altura do chão / sem instalar", "m²", 25.28, 20.22, 30.33], ["Treliça pequena – no alto / já instalada", "m²", 24.16, 19.10, 29.21],
      ["Treliça média – no alto / já instalada", "m²", 26.40, 21.35, 31.46], ["Treliça grande – no alto / já instalada", "m²", 28.65, 23.59, 33.71]
    ]),
    grupo("Madeira e metal – imobiliário (manutenção leve)", [
      ["Janelas e venezianas – nova / repintura", "un", 225.45, 167.08, 283.81], ["Janelas e venezianas – com grades", "un", 312.57, 239.89, 385.25],
      ["Janelas e venezianas – restauração", "un", 400.05, 283.81, 516.29], ["Porta lisa – boa condição", "un", 188.98, 138.20, 239.76],
      ["Porta lisa – restauração", "un", 283.69, 196.57, 370.81], ["Porta de madeira detalhada – boas condições", "un", 250.99, 196.57, 305.41],
      ["Porta de madeira detalhada – restauração", "un", 403.69, 283.81, 523.57],
      ["Portão pequeno – novo já com primer, somente pintura", "un", 231.76, 196.57, 266.94], ["Portão pequeno – repintura simples (lixar + pintura)", "un", 285.14, 242.68, 327.61],
      ["Portão pequeno – novo sem primer (primer + pintura)", "un", 364.01, 303.35, 424.68], ["Portão pequeno – restauração (massa + primer + pintura)", "un", 606.69, 485.35, 728.03],
      ["Portão grande – novo já com primer, somente pintura", "un", 424.68, 364.01, 485.35], ["Portão grande – repintura simples (lixar + pintura)", "un", 485.35, 424.68, 546.02],
      ["Portão grande – novo sem primer (primer + pintura)", "un", 788.70, 728.03, 849.37], ["Portão grande – restauração (massa + primer + pintura)", "un", 970.70, 849.37, 1092.04]
    ]),
    grupo("Madeira e metal – automotivo e moveleiro (manutenção pesada)", [
      ["Portão pequeno (esmalte automotivo) – novo já com primer, somente pintura", "un", 474.43, 439.24, 509.62],
      ["Portão pequeno (esmalte automotivo) – repintura simples", "un", 527.82, 485.35, 570.29],
      ["Portão pequeno (esmalte automotivo) – novo sem primer (primer + pintura)", "un", 606.69, 546.02, 667.36],
      ["Portão pequeno (esmalte automotivo) – restauração (remoção + massa + primer + pintura)", "un", 849.37, 728.03, 970.70],
      ["Portão grande (esmalte automotivo) – novo já com primer, somente pintura", "un", 667.36, 606.69, 728.03],
      ["Portão grande (esmalte automotivo) – repintura simples", "un", 728.03, 667.36, 788.70],
      ["Portão grande (esmalte automotivo) – novo sem primer (primer + pintura)", "un", 970.70, 970.70, 970.70],
      ["Portão grande (esmalte automotivo) – restauração (remoção + massa + primer + pintura)", "un", 1213.38, 1092.04, 1334.72],
      ["Porta simples – laqueação PU (poliuretano)", "un", 836.44, 625.50, 1047.39], ["Porta dupla – laqueação PU (poliuretano)", "un", 1192.75, 785.54, 1599.96],
      ["Janela simples – laqueação PU (poliuretano)", "un", 829.10, 538.26, 1119.95], ["Janela dupla – laqueação PU (poliuretano)", "un", 945.65, 698.54, 1192.75],
      ["Porta simples – laca nitrocelulose (Duco)", "un", 805.02, 708.25, 901.78], ["Porta dupla – laca nitrocelulose (Duco)", "un", 1163.87, 974.95, 1352.80],
      ["Janela simples – laca nitrocelulose (Duco)", "un", 678.83, 552.94, 804.71], ["Janela dupla – laca nitrocelulose (Duco)", "un", 1059.58, 780.93, 1338.24],
      ["Adicional: descascar / remover tinta e textura antiga" + ate, "m²", 6.80, 6.43, 8.86],
      ["Adicional: remoção de pintura com lixamento" + ate, "m²", 8.10, 7.77, 10.44],
      ["Adicional: remoção de pintura com produto químico" + ate, "m²", 9.23, 9.10, 11.65],
      ["Adicional: aplicar camada adicional de verniz", "un", 20.20, 14.44, 25.97]
    ]),
    grupo("Piso e demarcação", [
      ["Demarcação de tubulações (água e gás)", "m", 12.38, 7.28, 17.47], ["Demarcação de vaga de garagem", "m", 12.98, 7.77, 18.20],
      ["Demarcação de vaga de moto", "un", 128.19, 116.36, 140.02], ["Demarcação de carga e descarga", "un", 147.37, 116.48, 178.25],
      ["Linha de cruzamento", "un", 248.99, 209.67, 288.30], ["Linha tracejada", "m", 8.13, 6.31, 9.95],
      ["Pintura de rodapé", "m", 12.38, 7.28, 17.47], ["Pintura de meio-fio", "m", 12.38, 7.28, 17.47],
      ["Faixa de demarcação de parede (estacionamento)", "m", 12.38, 7.28, 17.47],
      ["Piso liso – tinta acrílica, pintura simples 2 demãos", "m²", 17.47, 12.86, 22.08], ["Piso liso – tinta acrílica, pintura completa 3 demãos", "m²", 28.39, 17.47, 39.31],
      ["Piso antiderrapante – tinta acrílica, pintura completa 3 demãos", "m²", 35.00, 20.00, 50.00], ["Pintura de faixas de quadras", "m", 12.38, 7.28, 17.47],
      ["Piso – tinta epóxi comum/baixa espessura (manutenção leve)", "m²", 67.65, 46.59, 88.70],
      ["Piso – correção com massa epóxi / cimento / massa acrílica", "m²", 29.49, 24.02, 34.95],
      ["Sinalização vertical em placa de aço galvanizada", "un", 89.79, 68.19, 111.39], ["Demarcação de vaga de ambulância", "un", 159.98, 101.80, 218.17],
      ["Demarcação de faixa de pedestre (até 3 m)", "un", 128.19, 116.36, 140.02], ["Demarcação de cadeirante", "un", 115.70, 87.24, 144.15],
      ["Demarcação de deficiente ou idoso", "un", 106.66, 87.24, 126.07], ["Demarcação de PARE", "un", 106.66, 87.24, 126.07],
      ["Demarcação de setas indicativas (até 3,50 x 0,40 m)", "un", 89.79, 68.19, 111.39], ["Demarcação de extintores e hidrantes (até 1 m)", "un", 89.79, 68.19, 111.39],
      ["Demarcação de elevadores (círculo até 40 cm)", "un", 89.79, 68.19, 111.39], ["Demarcação de bombeiros (círculo até 40 cm)", "un", 89.79, 68.19, 111.39],
      ["Demarcação de círculo com números de vagas", "un", 43.50, 36.40, 50.60]
    ]),
    grupo("Combos com massa corrida (alvenaria)", [].concat(
      alt("1 selador + 2 massa corrida + 2 acrílico econômico fosco", "m²", [35.11, 27.98, 42.24], [36.68, 28.87, 44.49]),
      alt("1 selador + 2 massa corrida + 3 acrílico econômico fosco", "m²", [37.19, 30.00, 44.38], [38.65, 30.90, 46.40]),
      alt("1 selador + 3 massa corrida + 2 acrílico econômico fosco", "m²", [37.36, 30.22, 44.49], [38.93, 31.12, 46.74]),
      alt("1 selador + 3 massa corrida + 3 acrílico econômico fosco", "m²", [39.43, 32.24, 46.63], [46.51, 44.38, 48.65]),
      alt("1 selador + 2 massa corrida + 2 acrílico standard fosco", "m²", [37.36, 30.22, 44.49], [39.38, 32.02, 46.74]),
      alt("1 selador + 2 massa corrida + 3 acrílico standard fosco", "m²", [40.61, 32.92, 48.31], [40.73, 33.71, 47.75]),
      alt("1 selador + 3 massa corrida + 2 acrílico standard fosco", "m²", [39.60, 32.47, 46.74], [41.63, 34.27, 48.98]),
      alt("1 selador + 3 massa corrida + 3 acrílico standard fosco", "m²", [42.58, 35.17, 50.00], [43.42, 35.95, 50.89]),
      alt("1 selador + 2 massa corrida + 2 acrílico premium fosco", "m²", [39.60, 32.47, 46.74], [41.06, 33.37, 48.76]),
      alt("1 selador + 2 massa corrida + 3 acrílico premium fosco", "m²", [43.99, 35.50, 52.47], [45.73, 36.74, 54.71]),
      alt("1 selador + 3 massa corrida + 2 acrílico premium fosco", "m²", [41.85, 34.72, 48.98], [43.31, 35.61, 51.01]),
      alt("1 selador + 3 massa corrida + 3 acrílico premium fosco", "m²", [46.20, 37.75, 54.66], [47.97, 38.99, 56.96]),
      alt("1 selador + 2 massa corrida + 2 acrílico premium acetinado", "m²", [42.83, 34.82, 50.84], [44.72, 36.63, 52.80]),
      alt("1 selador + 2 massa corrida + 3 acrílico premium acetinado", "m²", [46.40, 38.20, 54.60], [48.87, 39.88, 57.86]),
      alt("1 selador + 3 massa corrida + 2 acrílico premium acetinado", "m²", [45.05, 37.08, 53.03], [46.96, 38.87, 55.05]),
      alt("1 selador + 3 massa corrida + 3 acrílico premium acetinado", "m²", [50.33, 40.45, 60.22], [49.71, 42.13, 57.30]),
      alt("1 selador + 2 massa corrida + 2 acrílico premium semibrilho", "m²", [45.73, 37.64, 53.82], [48.54, 39.32, 57.75]),
      alt("1 selador + 2 massa corrida + 3 acrílico premium semibrilho", "m²", [48.03, 40.11, 55.95], [51.12, 42.13, 60.11]),
      alt("1 selador + 3 massa corrida + 2 acrílico premium semibrilho", "m²", [47.97, 39.88, 56.06], [50.78, 41.57, 59.99]),
      alt("1 selador + 3 massa corrida + 3 acrílico premium semibrilho", "m²", [50.28, 42.36, 58.20], [53.37, 44.38, 62.35])
    )),
    // na tabela da ABRAPP estas folhas trazem "acima de 3 m" antes de "até 3 m" (valores copiados como estão lá)
    grupo("Combos com massa acrílica (alvenaria)", [].concat(
      alt("1 selador + 2 massa acrílica + 2 acrílico standard fosco", "m²", [43.32, 35.22, 51.41], [41.09, 33.24, 48.94]),
      alt("1 selador + 2 massa acrílica + 3 acrílico standard fosco", "m²", [44.80, 37.08, 52.52], [44.68, 36.21, 53.14]),
      alt("1 selador + 3 massa acrílica + 2 acrílico standard fosco", "m²", [45.79, 37.69, 53.88], [43.56, 35.72, 51.41]),
      alt("1 selador + 3 massa acrílica + 3 acrílico standard fosco", "m²", [47.77, 39.55, 55.98], [46.84, 38.68, 55.00]),
      alt("1 selador + 2 massa acrílica + 2 acrílico premium fosco", "m²", [45.17, 36.70, 53.64], [43.56, 35.72, 51.41]),
      alt("1 selador + 2 massa acrílica + 3 acrílico premium fosco", "m²", [50.30, 40.41, 60.19], [48.38, 39.05, 57.71]),
      alt("1 selador + 3 massa acrílica + 2 acrílico premium fosco", "m²", [47.64, 39.18, 56.11], [46.04, 38.19, 53.88]),
      alt("1 selador + 3 massa acrílica + 3 acrílico premium fosco", "m²", [52.77, 42.88, 62.66], [50.82, 41.52, 60.12]),
      alt("1 selador + 2 massa acrílica + 2 acrílico premium acetinado", "m²", [49.19, 40.29, 58.08], [47.12, 38.31, 55.92]),
      alt("1 selador + 2 massa acrílica + 3 acrílico premium acetinado", "m²", [53.76, 43.87, 63.65], [51.04, 42.02, 60.06]),
      alt("1 selador + 3 massa acrílica + 2 acrílico premium acetinado", "m²", [51.66, 42.76, 60.56], [49.56, 40.78, 58.33]),
      alt("1 selador + 3 massa acrílica + 3 acrílico premium acetinado", "m²", [54.69, 46.34, 63.03], [55.37, 44.49, 66.24]),
      alt("1 selador + 2 massa acrílica + 2 acrílico premium semibrilho", "m²", [53.39, 43.25, 63.52], [50.30, 41.40, 59.20]),
      alt("1 selador + 2 massa acrílica + 3 acrílico premium semibrilho", "m²", [56.23, 46.34, 66.12], [52.83, 44.12, 61.55]),
      alt("1 selador + 3 massa acrílica + 2 acrílico premium semibrilho", "m²", [55.86, 45.73, 65.99], [52.77, 43.87, 61.67]),
      alt("1 selador + 3 massa acrílica + 3 acrílico premium semibrilho", "m²", [58.70, 48.82, 68.59], [55.30, 46.59, 64.02])
    )),
    // as 4 últimas linhas da folha 19 vêm com o texto cortado na tabela (o acabamento não aparece): confira e renomeie
    grupo("Drywall", [
      ["Drywall – somente repintura (já pintado)", "m²", 15.29, 8.74, 21.84],
      ["Drywall – lixar emendas + 1 fundo + 2 demãos acabamento fosco", "m²", 24.75, 13.10, 36.40],
      ["Drywall – lixar emendas + 1 fundo + massa corrida nas emendas + 2 demãos acabamento", "m²", 31.24, 18.81, 43.68],
      ["Drywall – lixar emendas + 1 fundo + massa corrida geral + 2 demãos acabamento fosco", "m²", 42.23, 26.21, 58.24],
      ["Drywall – lixar emendas + 1 fundo + massa corrida nas emendas + 2 demãos acabamento (opção 2: conferir acabamento)", "m²", 37.07, 26.21, 47.93],
      ["Drywall – lixar emendas + 1 fundo + massa corrida geral + 2 demãos acabamento (opção 2: conferir acabamento)", "m²", 47.99, 33.49, 62.49],
      ["Drywall – lixar emendas + 1 fundo + massa corrida nas emendas + 2 demãos acabamento (opção 3: conferir acabamento)", "m²", 48.66, 30.58, 66.74],
      ["Drywall – lixar emendas + 1 fundo + massa corrida geral + 2 demãos acabamento (opção 3: conferir acabamento)", "m²", 48.05, 37.86, 58.24]
    ])
  );

  window.AGE_PRECOS_BASE = {
    eletrica: { nome: "Lista de serviços elétricos", fonte: "AGE", itens: eletrica },
    pintura: { nome: "Tabela ABRAPP de pintura 2026 (mão de obra, sem material)", fonte: "ABRAPP 2026", itens: pintura }
  };
})();
