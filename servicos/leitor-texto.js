// Lê um texto colado ou compartilhado (lista de materiais, escopo dos serviços, vistoria e solução) e separa
// cada coisa no campo certo do orçamento: itens (material ou mão de obra, com quantidade e unidade), o título
// e o laudo técnico. Aceita listas com "- 01 Caixa...;", "24 metros de eletroduto", "50 MTS de cabo de 6mm",
// "Cabo 1,5 mm² (aproximadamente 30 m)", tabela "ITEM  DESCRIÇÃO  QUANTIDADE" e linhas quebradas no meio.
(function () {
  "use strict";
  function semAcento(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function num(v) { return Number(String(v).replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")) || 0; }
  // unidades que vêm logo depois da quantidade ("24 metros de", "50 MTS de", "3 pç")
  var UN = { m: "m", mt: "m", mts: "m", metro: "m", metros: "m", un: "un", und: "un", unid: "un", unidade: "un", unidades: "un",
    "pç": "pç", "pçs": "pç", pc: "pç", pcs: "pç", peca: "pç", pecas: "pç", "peça": "pç", "peças": "pç", kg: "kg", l: "L", litro: "L", litros: "L", "m²": "m²", m2: "m²" };
  // embalagens: só valem como unidade quando vêm com "de" ("2 rolos de fita")
  var EMB = { rolo: "rolo", rolos: "rolo", barra: "barra", barras: "barra", lata: "lata", latas: "lata", "galão": "galão", galao: "galão", "galões": "galão", galoes: "galão",
    balde: "balde", baldes: "balde", cx: "cx", cento: "cento", centos: "cento" };
  var CAB_MAT = /^(lista de materia\w*|materia(l|is)( \w+)*|orcamento (estimado )?de materia\w*|relacao de materia\w*)$/;
  var CAB_SERV = /^(escopo( dos| de)? servicos?|escopo|servicos?( a (serem )?(executados?|realizados?))?|mao de obra|descricao dos servicos|execucao)$/;
  var CAB_GRUPO = /^(painel|eletrica|parte eletrica|hidraulica|iluminacao|fixacao|cabos|cabeamento|quadros?|tomadas|infraestrutura|comando|protecao|aterramento|acabamento)$/;
  var CAB_VIST = /^(vistoria( tecnica)?|laudo( tecnico)?|diagnostico|constatacao|situacao (encontrada|atual)|problemas? encontrados?)$/;
  var CAB_SOL = /^(solucao|solucoes|solucao (proposta|tecnica)|recomendac\w*|correc\w*|servico recomendado)$/;

  function capitaliza(t) { return t ? t.charAt(0).toLocaleUpperCase("pt-BR") + t.slice(1) : t; }
  function limparDesc(d) {
    d = String(d || "")
      .replace(/(\d),\s+(\d)/g, "$1,$2")                     // "2, 5mm" → "2,5mm"
      .replace(/mm\s+mm\b/gi, "mm")
      .replace(/(\d)\s*(v|a|w|kw|kva|cv)\b/gi, function (m0, d, u) { return d + " " + (u.length === 1 ? u.toUpperCase() : u.toLowerCase() === "cv" ? "CV" : u.toLowerCase() === "kva" ? "kVA" : "kW"); })
      .replace(/(["”])de\b/g, "$1 de")                       // 3/4"de PVC
      .replace(/\b(curvas?|luvas?|caixas?|cabos?|fitas?|tomadas?|buchas?)de\b/gi, "$1 de")
      .replace(/\s*[-–]\s*$/, "").replace(/\s+/g, " ").trim();
    // bitola de cabo/fio em mm²
    if (/\b(cabos?|fios?|cord[aã]o)\b/i.test(d)) d = d.replace(/(\d+(?:,\d+)?)\s*mm(?:2|²)?(?![²\w])/gi, "$1 mm²");
    return capitaliza(d);
  }
  // "Cabo de comando 1,5 mm² (aproximadamente 30 m)" → 30 m
  var QTD_PAR = /\(\s*(?:aprox\w*\.?|cerca de|±|~)?\s*(\d+(?:[.,]\d+)?)\s*(metros?|mts?|m|un|unid\w*|pç|peças?)\s*\)/i;

  function lerItem(l, tabela, tipo) {
    var it = { tipo: tipo, descricao: "", qtd: 1, un: tipo === "servico" ? "serv" : "un", valor: 0, semQtd: true };
    var cel = l.indexOf("\t") >= 0 ? l.split("\t").map(function (x) { return x.trim(); }).filter(Boolean) : null;
    var resto = l;
    // tabela: "01 <tab> Luminárias LED 1,20 m <tab> 66" (nº do item, descrição, quantidade)
    if (tabela && cel && cel.length >= 3 && /^\d+$/.test(cel[0]) && /^\d+(?:[.,]\d+)?\.?$/.test(cel[cel.length - 1])) {
      it.qtd = num(cel[cel.length - 1].replace(/\.$/, "")); it.semQtd = false;
      resto = cel.slice(1, -1).filter(function (x) { return /[A-Za-zÀ-ú]/.test(x); })[0] || cel[1];
      var unCel = cel.slice(1, -1).filter(function (x) { return UN[semAcento(x)] || UN[x.toLowerCase()]; })[0];
      if (unCel) it.un = UN[semAcento(unCel)] || UN[unCel.toLowerCase()];
    } else if (tabela) {
      var mt = /^(\d{1,3})[\s.)-]+(.+?)\s+(\d+(?:[.,]\d+)?)\.?$/.exec(l);
      if (mt) { it.qtd = num(mt[3]); it.semQtd = false; resto = mt[2]; }
    }
    // preço no fim da linha, só com R$ ou separado por | ("10 | Fita isolante | R$ 7,90")
    if (it.semQtd || cel) {
      var mp = /(?:\||R\$)\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})\s*(?:\|?\s*(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2})?\s*\|?\s*$/.exec(resto);
      if (mp) { it.valor = num(mp[1]); resto = resto.slice(0, mp.index); }
      resto = resto.replace(/\|/g, " ").trim();
    }
    if (it.semQtd) {
      // quantidade no começo: "01 Caixa", "24 metros de eletroduto", "1cano de pvc", "2 rolos de fita"
      var mq = /^(\d+(?:[.,]\d+)?)(?!\s*(?:mm|cv|kva|kw|w|v|a|x\d)\b)(?![\d\/,.]|\s*["”°%])\s*(?:x\s+)?(.*)$/i.exec(resto);
      if (mq && mq[2] && /[A-Za-zÀ-ú]/.test(mq[2])) {
        var q = num(mq[1]);
        if (q > 0 && q <= 99999) {
          it.qtd = q; it.semQtd = false; resto = mq[2];
          var mu = /^([A-Za-zÀ-ú²2]+)\.?\s+(?:de\s+)?(.+)$/.exec(resto);
          if (mu && UN[semAcento(mu[1])]) { it.un = UN[semAcento(mu[1])]; resto = mu[2]; }
          else if (mu && EMB[semAcento(mu[1])] && /^(\S+)\s+de\s+/i.test(resto)) { it.un = EMB[semAcento(mu[1])]; resto = resto.replace(/^\S+\s+de\s+/i, ""); }
          else if (it.un === "serv") it.un = "un";
        }
      }
    }
    var mpar = QTD_PAR.exec(resto);
    if (mpar && it.semQtd) { it.qtd = num(mpar[1]); it.un = UN[semAcento(mpar[2])] || "m"; it.semQtd = false; resto = resto.replace(QTD_PAR, " "); }
    if (tipo === "servico") it.semQtd = false;   // serviço sem quantidade: 1 serviço
    it.descricao = limparDesc(resto.replace(/^de\s+/i, ""));
    return it.descricao.length >= 2 && /[A-Za-zÀ-ú]{2,}/.test(it.descricao) ? it : null;
  }

  function ler(texto) {
    var r = { itens: [], titulo: "", laudo: { vistoria: "", solucao: "" } };
    var t = String(texto || "").replace(/\r/g, "").replace(/ /g, " ")
      .replace(/([^\s])\.(?=[A-ZÀ-Ú][A-Za-zÀ-ú]{2,})/g, "$1.\n");   // textos colados um atrás do outro ("Parafusos.Material elétrico")
    // linha quebrada no meio ("100 MTS de cabo de" + "2, 5mm (azul)")
    var ls = [];
    t.split("\n").forEach(function (x) {
      x = x.replace(/\s+$/, "");
      if (ls.length && x.trim() && /\b(de|da|do|das|dos|com|para|em)$/i.test(ls[ls.length - 1].trim())) ls[ls.length - 1] = ls[ls.length - 1].trim() + " " + x.trim();
      else ls.push(x);
    });
    var tipo = "material", tabela = false, laudo = "", grupo = "", vistoItem = false;
    var marcador = /^[\s\-–—•*✓✔➢►▪·]+/;
    function proxima(n) { for (var k = n + 1; k < ls.length; k++) if (ls[k].trim()) return ls[k].trim(); return ""; }
    ls.forEach(function (bruto, n) {
      var l = bruto.trim();
      if (!l) return;
      var temMarca = marcador.test(l), limpo = l.replace(marcador, "").replace(/[;,.:]+$/, "").trim(), sa = semAcento(limpo).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
      if (!limpo) return;
      // vistoria e solução (laudo técnico)
      if (CAB_VIST.test(sa)) { laudo = "vistoria"; return; }
      if (CAB_SOL.test(sa)) { laudo = "solucao"; return; }
      if (CAB_MAT.test(sa) || CAB_SERV.test(sa)) laudo = "";
      if (laudo) { r.laudo[laudo] += (temMarca ? "• " : "") + l.replace(marcador, "").trim() + "\n"; return; }
      if (CAB_SERV.test(sa)) { tipo = "servico"; tabela = false; grupo = ""; return; }
      if (CAB_MAT.test(sa)) { tipo = "material"; tabela = false; grupo = ""; return; }
      if (/^item\b.*\bdescri/.test(sa) || (/^(qtd|quant)/.test(sa) && /descri/.test(sa))) { tabela = true; return; }
      if (!vistoItem && n < 3 && /^age\b/.test(sa)) return;   // nome da empresa no topo
      if (CAB_GRUPO.test(sa)) { grupo = limpo; return; }
      // título em MAIÚSCULAS antes dos itens ("CAIXA DE ACIONAMENTO DA BOMBA – MOTOR TRIFÁSICO 10 CV")
      if (!temMarca && !vistoItem && !r.titulo && limpo.length >= 10 && limpo === limpo.toLocaleUpperCase("pt-BR") && /[A-ZÀ-Ú]{3,}.*\s.*[A-ZÀ-Ú]{3,}/.test(limpo) && !/^\d/.test(limpo)) { r.titulo = limpo; return; }
      // subtítulo: linha que termina em ":" ou abre uma lista com marcadores ("Caixa de acionamento local" + "- 01 ...")
      var prox = proxima(n);
      if (/:$/.test(l) || (!temMarca && !/^\d/.test(limpo) && marcador.test(prox) && !/^\d/.test(l) && limpo.split(/\s+/).length <= 8 && !tabela)) { grupo = limpo; return; }
      // "Painel" + "De comando 400×300×200" = "Painel de comando 400×300×200"
      if (grupo && /^d[aeo]s?\s/i.test(limpo) && !temMarca) limpo = grupo + " " + limpo.charAt(0).toLowerCase() + limpo.slice(1);
      var it = lerItem(tabela ? bruto.replace(marcador, "").trim().replace(/[;:]+$/, "") : limpo, tabela, tipo);
      if (it) { r.itens.push(it); vistoItem = true; }
    });
    r.laudo.vistoria = r.laudo.vistoria.trim(); r.laudo.solucao = r.laudo.solucao.trim();
    // o mesmo item duas vezes (texto colado repetido): marca a 2ª para você decidir
    var vistos = {};
    r.itens.forEach(function (x) { var k = semAcento(x.descricao) + "|" + x.qtd + "|" + x.un; if (vistos[k]) x.repetido = true; vistos[k] = 1; });
    return r;
  }

  window.AGE_LERTXT = { ler: ler };
})();
