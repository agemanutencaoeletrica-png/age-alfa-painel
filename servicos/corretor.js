// Corretor de português do AGE: acentos, erros comuns de digitação, espaços e pontuação.
// Funciona sem internet e sem mandar o texto para fora. Não mexe em nomes, números, e-mails e endereços de internet.
// Não corrige concordância e crase (isso exige entender a frase): o app confere o que é seguro corrigir sozinho.
(function () {
  "use strict";
  var BASE = {
    eletrica: "elétrica", eletricas: "elétricas", eletrico: "elétrico", eletricos: "elétricos", eletricista: "eletricista",
    bifasica: "bifásica", bifasico: "bifásico", trifasica: "trifásica", trifasico: "trifásico", monofasica: "monofásica", monofasico: "monofásico",
    distribuicao: "distribuição", distribicao: "distribuição", distribiçao: "distribuição", distribição: "distribuição", distribuiçao: "distribuição",
    instalacao: "instalação", instalaçao: "instalação", istalacao: "instalação", istalação: "instalação", istalarção: "instalação", instalarção: "instalação",
    instalacoes: "instalações", istalar: "instalar", adequarçao: "adequação", adequarção: "adequação", adequaçao: "adequação", adequacao: "adequação", espostos: "expostos", esposto: "exposto", espostas: "expostas", indentificar: "identificar", indentificacao: "identificação", identificacao: "identificação", vistoria: "vistoria", instalacão: "instalação", lancar: "lançar", lancamento: "lançamento", manutencao: "manutenção", manutençao: "manutenção", iluminacao: "iluminação", iluminaçao: "iluminação",
    fixacao: "fixação", fixaçao: "fixação", fixaçar: "fixar", conexao: "conexão", conexoes: "conexões", extensao: "extensão", tensao: "tensão",
    potencia: "potência", saida: "saída", saidas: "saídas", padrao: "padrão", medicao: "medição", protecao: "proteção", ligacao: "ligação", ligacoes: "ligações",
    alimentacao: "alimentação", substituicao: "substituição", substituiçao: "substituição", adequacao: "adequação", revisao: "revisão",
    conteiner: "contêiner", conteineres: "contêineres", container: "contêiner", metalica: "metálica", metalicas: "metálicas", metalico: "metálico",
    galpao: "galpão", galpoes: "galpões", industria: "indústria", industrial: "industrial", epoxi: "epóxi", epoxy: "epóxi",
    demarcacao: "demarcação", sinalizacao: "sinalização", impermeabilizacao: "impermeabilização", pintura: "pintura", demaos: "demãos", demao: "demão",
    servico: "serviço", servicos: "serviços", mao: "mão", area: "área", areas: "áreas", agua: "água", calcada: "calçada",
    eletrocalha: "eletrocalha", eletroduto: "eletroduto", disjuntor: "disjuntor", diferencial: "diferencial", aterramento: "aterramento",
    refletor: "refletor", refletores: "refletores", lampada: "lâmpada", lampadas: "lâmpadas", luminaria: "luminária", luminarias: "luminárias",
    tomadas: "tomadas", interruptor: "interruptor", chuveiro: "chuveiro", chuveiros: "chuveiros", poste: "poste", postes: "postes",
    rapido: "rápido", tecnico: "técnico", tecnica: "técnica", eletronico: "eletrônico", automatico: "automático", automatica: "automática",
    cabeamento: "cabeamento", subterraneo: "subterrâneo", subterranea: "subterrânea", aereo: "aéreo", aerea: "aérea",
    nessecario: "necessário", nessecaria: "necessária", nescessario: "necessário", nescessaria: "necessária", necessario: "necessário", necessaria: "necessária",
    solucao: "solução", solucoes: "soluções", constatacao: "constatação", tefon: "teflon", teflom: "teflon", curvasde: "curvas de", ceramica: "cerâmica",
    receptaculo: "receptáculo", receptaculos: "receptáculos", identificacao: "identificação", aterramento: "aterramento", policarbonato: "policarbonato"
  };
  // palavras que mais aparecem nos orçamentos, laudos e relatórios (sem acento ou com o erro mais comum)
  var EXTRA = {
    comado: "comando", comandos: "comandos", comadno: "comando", fotocelula: "fotocélula", fotocelulas: "fotocélulas", celula: "célula", celulas: "células",
    camera: "câmera", cameras: "câmeras", seguranca: "segurança", orcamento: "orçamento", orcamentos: "orçamentos", voce: "você", voces: "vocês", tambem: "também",
    nao: "não", sao: "são", cao: "cão", pao: "pão", ja: "já", apos: "após", alem: "além", porem: "porém", entao: "então", util: "útil", unico: "único", unica: "única",
    basico: "básico", basica: "básica", pratico: "prático", pratica: "prática", mecanica: "mecânica", mecanico: "mecânico", hidraulica: "hidráulica", hidraulico: "hidráulico",
    numero: "número", numeros: "números", minimo: "mínimo", maximo: "máximo", ultimo: "último", ultima: "última", proximo: "próximo", proxima: "próxima", codigo: "código",
    periodo: "período", veiculo: "veículo", veiculos: "veículos", obrigatorio: "obrigatório", obrigatoria: "obrigatória", rodape: "rodapé", rodapes: "rodapés",
    condominio: "condomínio", condominios: "condomínios", predio: "prédio", predios: "prédios", escritorio: "escritório", escritorios: "escritórios", armazem: "armazém",
    acrilica: "acrílica", acrilico: "acrílico", oque: "o que", porisso: "por isso", excessao: "exceção", excecao: "exceção", visivel: "visível", possivel: "possível",
    movel: "móvel", moveis: "móveis", imovel: "imóvel", imoveis: "imóveis", facil: "fácil", dificil: "difícil", agil: "ágil", fragil: "frágil", util: "útil",
    maquina: "máquina", maquinas: "máquinas", camara: "câmara", ate: "ate", tecnologia: "tecnologia", garantia: "garantia", interfone: "interfone", interfones: "interfones",
    portao: "portão", portoes: "portões", botao: "botão", botoes: "botões", fiacao: "fiação", lampadas: "lâmpadas", iluminacao: "iluminação", ventilacao: "ventilação",
    residencia: "residência", residencias: "residências", emergencia: "emergência", assistencia: "assistência", manutencao: "manutenção", preventiva: "preventiva",
    eletronica: "eletrônica", eletronicas: "eletrônicas", eletronicos: "eletrônicos", termico: "térmico", termica: "térmica", magnetico: "magnético", magnetica: "magnética",
    aluminio: "alumínio", aco: "aço", plastico: "plástico", plastica: "plástica", analogico: "analógico", telefonico: "telefônico", especifico: "específico", especifica: "específica",
    economico: "econômico", economica: "econômica", publico: "público", publica: "pública", mecanicas: "mecânicas", hidraulicas: "hidráulicas", tecnicos: "técnicos", tecnicas: "técnicas",
    nivel: "nível", niveis: "níveis", acao: "ação", acoes: "ações", corretiva: "corretiva", visita: "visita", vistoria: "vistoria", fechadura: "fechadura", porteiro: "porteiro", visor: "visor", botoeira: "botoeira"
  };
  var DIC = {};
  Object.keys(BASE).forEach(function (k) { DIC[k] = BASE[k]; });
  Object.keys(EXTRA).forEach(function (k) { if (!(k in DIC) || DIC[k] === k) DIC[k] = EXTRA[k]; });
  delete DIC.ate;   // "ate" pode ser o verbo; sem acento fica como está

  // regras gerais (só para palavras com 4 ou mais letras, para não mexer em siglas)
  var REGRAS = [
    [/^([a-zà-ÿ]{2,})coes$/, "$1ções"], [/^([a-zà-ÿ]{2,})cao$/, "$1ção"], [/^([a-zà-ÿ]{2,})soes$/, "$1sões"], [/^([a-zà-ÿ]{2,})sao$/, "$1são"],
    [/^([a-zà-ÿ]{2,})goes$/, "$1gões"], [/^([a-zà-ÿ]{2,})toes$/, "$1tões"], [/^([a-zà-ÿ]{2,})ao$/, "$1ão"], [/^([a-zà-ÿ]{2,})oes$/, "$1ões"],
    [/^([a-zà-ÿ]{3,})encia(s?)$/, "$1ência$2"], [/^([a-zà-ÿ]{3,})ancia(s?)$/, "$1ância$2"],
    [/^([a-zà-ÿ]{2,})ivel$/, "$1ível"], [/^([a-zà-ÿ]{2,})iveis$/, "$1íveis"], [/^([a-zà-ÿ]{2,})avel$/, "$1ável"], [/^([a-zà-ÿ]{2,})aveis$/, "$1áveis"]
  ];
  // palavras que terminam assim mesmo, sem acento (não mexer)
  var INTOCAVEIS = { ao: 1, aos: 1, vao: 1, novel: 1, pavel: 1, gravel: 1, motel: 1, hotel: 1, papel: 1, pastel: 1, cruel: 1, fiel: 1, mel: 1, cacao: 1, macao: 1, dao: 1, tao: 1, kao: 1 };

  function caso(orig, novo) {
    if (orig.length > 1 && orig === orig.toUpperCase()) return novo.toLocaleUpperCase("pt-BR");
    if (orig.charAt(0) === orig.charAt(0).toUpperCase() && orig.charAt(0) !== orig.charAt(0).toLowerCase()) return novo.charAt(0).toLocaleUpperCase("pt-BR") + novo.slice(1);
    return novo;
  }
  function corrigirPalavra(w) {
    var b = w.toLowerCase();
    if (INTOCAVEIS[b]) return w;
    var novo = DIC[b];
    if (novo === undefined && b.length >= 4) {
      for (var i = 0; i < REGRAS.length; i++) if (REGRAS[i][0].test(b)) { novo = b.replace(REGRAS[i][0], REGRAS[i][1]); break; }
    }
    if (novo === undefined || novo === b) return w;
    return caso(w, novo);
  }
  // corrige palavra a palavra mantendo MAIÚSCULAS / Primeira maiúscula; devolve o texto e a lista do que mudou
  function corrigir(t, op) {
    var feitas = [], original = String(t === null || t === undefined ? "" : t);
    var novo = original.replace(/(https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+)|([A-Za-zÀ-ÿ]+)/g, function (m, url, w) {
      if (url) return m;
      if (w === w.toUpperCase() && w.length <= 3 && !(w.toLowerCase() in DIC)) return w;   // siglas curtas (NBR, LED, DVR)
      var r = corrigirPalavra(w);
      if (r !== w) feitas.push(w + " → " + r);
      return r;
    });
    // frases
    var antes = novo;
    novo = novo.replace(/\bafim de\b/gi, function (m) { return caso(m, "a fim de"); })
      .replace(/\bhaja visto\b/gi, function (m) { return caso(m, "haja vista"); })
      .replace(/\bcontatad([oa]s?) que\b/gi, function (m, f) { return caso(m, "constatad" + f + " que"); });
    if (novo !== antes) feitas.push("frase corrigida");
    // espaços e pontuação (sem mexer em números como 2,5 nem em endereços de internet)
    antes = novo;
    novo = novo.replace(/([^\s])[ \t]{2,}(?=\S)/g, "$1 ")
      .replace(/[ \t]+([,;!?])(?=\s|$|[A-Za-zÀ-ÿ])/g, "$1").replace(/[ \t]+(:)(?=\s|$)/g, "$1")
      .replace(/([A-Za-zÀ-ÿ]),(?=[A-Za-zÀ-ÿ])/g, "$1, ").replace(/([A-Za-zÀ-ÿ]);(?=[A-Za-zÀ-ÿ])/g, "$1; ")
      .replace(/\b(de|da|do|das|dos|em|no|na|nos|nas|para|com|que|um|uma|os|as|se|por)[ \t]+\1\b/gi, "$1");
    if (novo !== antes) feitas.push("espaços e pontuação");
    // primeira letra do campo e de cada linha em maiúscula (sem mexer em tópicos • - ✓)
    if (op && op.maiuscula) {
      antes = novo;
      novo = novo.replace(/(^|\n)([ \t]*[•\-–✓✔*]?[ \t]*)([a-zà-ÿ])/g, function (m, a, b, c) { return a + b + c.toLocaleUpperCase("pt-BR"); });
      if (novo !== antes) feitas.push("letra maiúscula no começo");
    }
    return { texto: novo, feitas: feitas };
  }

  // corrige ao sair do campo; avisa o que mudou e mantém o cursor/rascunho do app em dia (dispara "input")
  function ligar(inp, aviso) {
    if (!inp || inp.dataset.corretor) return;
    inp.dataset.corretor = "1";
    inp.setAttribute("spellcheck", "true"); inp.setAttribute("lang", "pt-BR");
    inp.addEventListener("blur", function () {
      var r = corrigir(this.value, { maiuscula: true });
      if (r.texto === this.value) return;
      this.value = r.texto;
      this.dispatchEvent(new Event("input", { bubbles: true }));
      if (aviso && r.feitas.length) aviso("✍ Corrigido: " + r.feitas.slice(0, 6).join(", ") + (r.feitas.length > 6 ? " e mais " + (r.feitas.length - 6) : ""), "ok");
    });
  }
  // liga a correção, ao sair do campo, em todos os campos que combinam com o seletor (inclusive os que o app desenha depois)
  function automatico(seletor, aviso) {
    if (typeof document === "undefined") return;
    document.addEventListener("focusout", function (ev) {
      var t = ev.target;
      if (!t || !t.matches || !t.matches(seletor) || t.readOnly || t.disabled) return;
      var r = corrigir(t.value, { maiuscula: true });
      if (r.texto === t.value) return;
      t.value = r.texto;
      t.dispatchEvent(new Event("input", { bubbles: true }));
      if (aviso && r.feitas.length) aviso("✍ Corrigido: " + r.feitas.slice(0, 6).join(", ") + (r.feitas.length > 6 ? " e mais " + (r.feitas.length - 6) : ""), "ok");
    });
  }
  var API = { corrigir: corrigir, ligar: ligar, automatico: automatico, dicionario: DIC };
  if (typeof window !== "undefined") window.AGE_CORR = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})();
