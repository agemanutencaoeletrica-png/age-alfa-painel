// Painel do dono — 🧾 COMPRAS de material (notas e cupons):
// foto/PDF da nota (lida no aparelho: valor, data, loja e itens) ou lançamento à mão, com os
// materiais, para onde foram (obra/loja), o tipo de serviço e a área. Os totais de ⚡ elétrica e
// 🖌️ pintura são somados na hora. Usa as funções do admin.js (P) e o leitor do pagamentos.js.
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null;
  var filtro = { periodo: "mes", area: "", busca: "", de: "", ate: "" };
  var AREAS = { eletrica: "⚡ Elétrica", pintura: "🖌️ Pintura", dividir: "➗ Elétrica e pintura" };
  var TIPOS = {
    eletrica: ["Instalação de tomadas e interruptores", "Troca de disjuntor", "Montagem de quadro de distribuição", "Instalação de iluminação",
      "Passagem de fiação", "Manutenção corretiva", "Instalação de ventilador", "Aterramento", "Padrão de entrada"],
    pintura: ["Pintura interna", "Pintura externa", "Massa corrida", "Textura / grafiato", "Pintura de portões e grades", "Impermeabilização",
      "Pintura de piso / demarcação", "Estrutura metálica", "Fachada"]
  };
  var UN = ["un", "m", "m²", "rolo", "L", "galão", "lata", "balde", "kg", "cx", "pç", "pct", "par"];

  function semAcento(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function dinheiro(v) { return A.dinheiro(Number(v) || 0); }
  function num2(v) { return v || v === 0 ? Number(v).toFixed(2).replace(".", ",") : ""; }

  // ---------------- leitura da nota / cupom ----------------
  var DIN = /\d{1,3}(?:\.\d{3})*,\d{2}/;
  function lerNota(texto) {
    var t = String(texto || "").replace(/\r/g, ""), ls = t.split("\n").map(function (x) { return x.trim(); }).filter(Boolean), r = { itens: [] };
    // valores em reais (sem pegar pedaço de CNPJ "17.134,491/0001-66")
    var valores = function (x) { return (x.match(/\d{1,3}(?:\.\d{3})*,\d{2}(?![\d\/])/g) || []).map(A.lerNumero); };
    // total: rótulo forte ("TOTAL DA NOTA", "TOTAL A PAGAR") aceita o número na linha vizinha (DANFE: rótulos numa linha,
    // números na de baixo); rótulo fraco ("VALOR TOTAL", "TOTAL") só com o número na mesma linha; depois a fatura/parcela
    var forteT = /total\s+da\s+nota|total\s+a\s+pagar|valor\s+a\s+pagar|valor\s+pago/i;
    var fracoT = /valor\s+total(?!\s+dos?\s+(?:produtos|servi))|total\s+(?:geral|r\$)|^\W*total\b(?!\s+(?:bruto|de\s+itens|dos))/i;
    var achou = null, pos = function (v) { return v.filter(function (n) { return n > 0; }); };
    ls.forEach(function (x, i) {
      var v;
      if (forteT.test(x)) {
        v = pos(valores(x.slice(x.search(forteT))));
        [i + 1, i - 1, i + 2].forEach(function (k) { if (!v.length && ls[k]) v = pos(valores(ls[k])); });
        if (v.length) achou = v[v.length - 1];
      } else if (achou === null && fracoT.test(x)) {
        v = pos(valores(x.slice(x.search(fracoT))));
        if (v.length) r.valorFraco = v[v.length - 1];
      }
    });
    if (achou === null && r.valorFraco) achou = r.valorFraco;
    delete r.valorFraco;
    if (achou === null) { var mf = t.match(/(?:fatura|parcela|vencimento|duplicata)[^\n]*?valor[^\d\n]{0,12}(\d{1,3}(?:\.\d{3})*,\d{2})(?![\d\/])/i); if (mf) achou = A.lerNumero(mf[1]); }
    if (achou !== null) r.valor = achou;
    else { var todos = valores(t); if (todos.length) { r.valor = Math.max.apply(null, todos); r.valorIncerto = true; } }
    // data: só datas possíveis (o "12.741/2012" da lei vira "12/41/2012" na foto); a de "Emissão" tem preferência
    var datas = [], reD = /(\d{2})\/(\d{2})\/(\d{4}|\d{2})\b/g, md2;
    while ((md2 = reD.exec(t))) {
      var ano = md2[3].length === 2 ? 2000 + Number(md2[3]) : Number(md2[3]), mes = Number(md2[2]), dia = Number(md2[1]);
      if (ano >= 2020 && ano <= new Date().getFullYear() + 1 && mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31)
        datas.push({ iso: ano + "-" + md2[2] + "-" + md2[1], emissao: /emiss/i.test(t.slice(Math.max(0, md2.index - 40), md2.index)) });
    }
    var dEm = datas.filter(function (x) { return x.emissao; })[0] || datas[0];
    if (dEm) r.data = dEm.iso;
    // loja: a linha com o nome antes do CNPJ (ou a primeira linha com letras)
    var iC = -1;
    for (var i = 0; i < ls.length; i++) if (/cnpj/i.test(ls[i])) { iC = i; break; }
    // tira da linha o que não é nome (título da nota, CEP, telefone, endereço) e o pedaço solto no fim ("LIDER TINTAS L")
    var limparNome = function (x) {
      return x.replace(/\b(documento auxiliar|nota fiscal|danfe|nfc-?e|consulta|chave de acesso|0\s*-\s*entrada|1\s*-\s*sa[ií]da)\b.*$/i, "")
        .replace(/\b(cep|fone|tel|telefone|cnpj|ie|rua|r\.|av\.?|avenida|rodovia)\b.*$/i, "").replace(/[^A-Za-zÀ-ú0-9&.' -]/g, " ")
        .replace(/\s+\S$/, "").replace(/\s+/g, " ").trim();
    };
    var cand = ls.slice(0, iC > 0 ? iC + 1 : Math.min(10, ls.length)).map(limparNome).filter(function (x) {
      return /[A-Za-zÀ-ú]{3,}\s+[A-Za-zÀ-ú]{2,}/.test(x) && !/age solu|destinat|remetente|protocolo|emitente|identifica|natureza/i.test(x);
    });
    // de preferência a linha com cara de razão social (LTDA, EIRELI...; depois COMÉRCIO, TINTAS, MATERIAIS...)
    var forte = /\b(ltda|eireli|epp)\b|\bs\.a\.|\bs\/a\b|\bme\s*$/i;
    var razao = cand.filter(function (x) { return forte.test(x); })[0] ||
      cand.filter(function (x) { return /\b(comercio|comercial|materiais|tintas|eletric\w*|constru\w*|home|deposito|ferragens|distribuidora)\b/i.test(x); })[0];
    // sem razão social reconhecível: melhor deixar em branco (você escolhe na lista) do que gravar um nome errado
    var limpo = function (x) { var sem = x.replace(/\s/g, ""); return sem.length && (sem.match(/[A-Za-zÀ-ú]/g) || []).length / sem.length >= 0.85; };
    var endereco = /\b(contagem|horizonte|betim|ibirit\w*|industrial|bairro|centro|mg|sp|rj|loja\s*\d+|n[ºo°]\s*\d)\b|\d{3,}/i;
    var f0 = razao || cand.slice(0, 3).filter(function (x) { return limpo(x) && !endereco.test(x) && (x.match(/[A-Za-zÀ-ú]{4,}/g) || []).length >= 2 && x.split(/\s+/).length <= 5; })[0];
    // nome dentro de uma linha suja: "COMERCIAL MARTINS", "CASA DO ELETRICISTA", "LIDER TINTAS"...
    var mk = !forte.test(f0 || "") && (f0 || "").match(/\b(?:COMERCIAL|COMERCIO|DEP[OÓ]SITO|CASA|MATERIAIS|DISTRIBUIDORA|FERRAGENS|[A-ZÀ-Ú]{3,}\s+TINTAS|TINTAS)(?:\s+(?:D[AEO]S?\s+)?[A-ZÀ-Ú]{3,}){0,2}/);
    if (mk) f0 = mk[0];
    if (f0) {
      var mr = forte.test(f0) && f0.match(/[A-ZÀ-Ú0-9&.' -]*?\b(?:LTDA|EIRELI|EPP|S\.A\.|S\/A|ME)\b\.?/i);
      r.fornecedor = (mr ? mr[0] : f0).replace(/\s+/g, " ").trim().slice(0, 120);
    }
    var mcnpj = t.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
    if (mcnpj) r.cnpj = mcnpj[0];
    // itens: "001 CABO FLEX 2,5MM 1 UN 189,90" (código, descrição, quantidade, unidade ... valor)
    // item em 2 linhas (cupom NFC-e): "604 PRO-TECH EPOXI AMARELO" / "2,00 UN 330,44 660,88"
    ls.forEach(function (x, i) {
      // a foto do cupom traz sujeira em volta: pega o nome em MAIÚSCULAS depois do código e, na linha de baixo, "qtd UN unitário total"
      var md1 = x.match(/(?:^|\s)\d{3,6}\s+[|—–-]?\s*([A-ZÀ-Ú][A-ZÀ-Ú0-9 ,.\/"'-]{5,}[A-ZÀ-Ú0-9"])/), prox = ls[i + 1] || "";
      var mq = md1 && !/\d,\d{2}/.test(x) && !/total|subtotal|desconto|pagamento|cart[aã]o/i.test(x) && prox.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(UN|GL|L|M|KG|CX|PC|PCT|RL|LT|LATA|BD|PAR)\b.*?(\d{1,3}(?:\.\d{3})*,\d{2})\s+.*?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
      if (mq) {
        var q = mq[1].indexOf(",") < 0 && mq[1].indexOf(".") < 0 && mq[1].length >= 3 && /00$/.test(mq[1]) ? Number(mq[1]) / 100 : A.lerNumero(mq[1]);
        r.itens.push({ item: md1[1].replace(/\s+/g, " ").trim().slice(0, 120), qtd: q, un: /^g/i.test(mq[2]) ? "galão" : "un", valor: A.lerNumero(mq[4]) });
      }
    });
    // DANFE: "00000069 IT R SUPERMAC 200 5 LTS 34029090 000 5101 UN 1,0000 52,300000 52,30 ..." (código, descrição, NCM ... unidade, qtd, unitário, total)
    ls.forEach(function (x, i) {
      var md = x.match(/^\W*\d{3,14}\s+([A-Za-zÀ-ú].*?)\s+\d{8}(?!\d).*?\b(UN|UND|PC|PCT|M|MT|KG|CX|RL|LT|L|GL|LATA|BD|PAR)\b\W*(\d+[.,]\d+)\W+(\d+[.,]\d+)\W+(\d{1,3}(?:\.\d{3})*,\d{2})(?!\d)/i);
      if (md) { r.itens.push({ item: md[1].replace(/\s+/g, " ").slice(0, 120), qtd: A.lerNumero(md[3]), un: md[2].toLowerCase().replace("und", "un"), valor: A.lerNumero(md[5]) }); ls[i] = ""; }
    });
    // "002637 1,00 UN ESMALTE CORALIT 3,6L AMARELO 49,90 49,90" (código, quantidade, unidade, descrição, unitário, total)
    ls.forEach(function (x) {
      var m3 = x.match(/^\W*\d{3,8}\s+(\d+(?:[.,]\d+)?)\s*(UN|UND|PC|PÇ|PCT|M|MT|KG|CX|RL|LT|L|GL|LATA|BD|PAR)\s+([A-Za-zÀ-ú].*?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/i);
      if (m3) { r.itens.push({ item: m3[3].replace(/\s+/g, " ").slice(0, 120), qtd: A.lerNumero(m3[1]), un: m3[2].toLowerCase().replace("und", "un"), valor: A.lerNumero(m3[5]) }); x = ""; }
    });
    ls.forEach(function (x) {
      // a quantidade é a última "N UN" antes do preço ("100M" no nome do cabo não é a quantidade)
      var mi = x.match(/^(?:\d{1,4}\s+)?(?:\d{4,14}\s+)?([A-Za-zÀ-ú][^\n]*)\s+(\d+(?:[.,]\d+)?)\s*(UN|UND|PC|PÇ|PCT|M|MT|M2|KG|CX|RL|LT|L|GL|LATA|BD|PAR)\s+(?:[^\n]*?\s)?(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/i);
      if (mi && !/total|subtotal|desconto|troco|pagamento|cart[aã]o|dinheiro/i.test(x))
        r.itens.push({ item: mi[1].replace(/\s+/g, " ").slice(0, 120), qtd: A.lerNumero(mi[2]), un: mi[3].toLowerCase().replace("und", "un").replace("mt", "m"), valor: A.lerNumero(mi[4]) });
    });
    return r;
  }
  // área sugerida pelos materiais da nota
  function areaPelosItens(itens, texto) {
    var t = semAcento((itens || []).map(function (x) { return x.item; }).join(" ") + " " + (texto || ""));
    var e = (t.match(/cabo|fio |disjunt|tomada|interrupt|lampad|lumin|eletrodut|conduite|quadro|reator|led|refletor|conector|fita isol/g) || []).length;
    var p = (t.match(/tinta|massa|selador|lixa|rolo|pincel|thinner|aguarras|esmalte|verniz|textura|fita crepe|impermeab|primer|fundo/g) || []).length;
    return p > e ? "pintura" : e > p ? "eletrica" : "";
  }

  // ---------------- receber notas (Compartilhar, arquivos) ----------------
  function receber(rc, ctx) {
    P = ctx;
    if (P.S.semCompras) { A.avisar("Rode de novo o supabase.sql no Supabase para usar as compras.", "erro"); return; }
    var fila = (rc.arquivos || []).slice(0, 10);
    if (!fila.length) { formulario({ texto: rc.texto ? lerNota(rc.texto) : {} }); return; }
    var j = A.janela('<div class="peq" id="cn-st">📖 Lendo a nota... (a 1ª vez demora um pouco)</div>', { titulo: "🧾 Nota de compra" });
    var lidas = [];
    fila.reduce(function (pr, f, i) {
      return pr.then(function () {
        $("#cn-st", j.el).textContent = "📖 Lendo a nota " + (i + 1) + " de " + fila.length + "...";
        return window.AGE_PAG.lerArquivo(f).then(function (r) { lidas.push({ dados: lerNota(r.texto), imagem: r.imagem || f, bruto: r.texto }); },
          function () { lidas.push({ dados: {}, imagem: /^image\//.test(f.type) ? f : null, erro: true }); });
      });
    }, Promise.resolve()).then(function () {
      j.fechar();
      var proxima = function () { var x = lidas.shift(); if (x) formulario({ texto: x.dados, imagem: x.imagem, bruto: x.bruto, erro: x.erro, depois: proxima, falta: lidas.length }); };
      proxima();
    });
  }

  // ---------------- formulário (nova ou editar) ----------------
  function rotuloObra(o) { return o.cliente + (o.chamado ? " · chamado " + o.chamado : ""); }
  function obraPorRotulo(t) { t = String(t || "").trim(); return P.S.obras.filter(function (o) { return rotuloObra(o) === t; })[0] || null; }
  function formulario(op) {
    var c0 = op.compra || null, d = op.texto || {};
    // loja já conhecida pelo CNPJ da nota
    if (!c0 && d.cnpj) {
      var dg = d.cnpj.replace(/\D/g, ""), ant = P.S.compras.filter(function (x) { return x.cnpj && x.cnpj.replace(/\D/g, "") === dg && x.fornecedor; })[0];
      if (ant) d.fornecedor = ant.fornecedor;
    }
    var lojasCompra = {}; P.S.compras.forEach(function (x) { if (x.fornecedor) lojasCompra[x.fornecedor] = 1; });
    var it = c0 ? (c0.itens || []).map(function (x) { return Object.assign({}, x); }) : (d.itens || []).map(function (x) { return Object.assign({}, x); });
    var area = c0 ? c0.area : (areaPelosItens(it, op.bruto) || "eletrica");
    var obra = c0 && c0.obra_id ? P.porId(P.S.obras, c0.obra_id) : null;
    var obras = P.S.obras.slice().sort(function (a, b) { return String(b.criado_em).localeCompare(String(a.criado_em)); }).slice(0, 400);
    var j = A.janela(
      (op.imagem ? '<img alt="Nota" src="' + URL.createObjectURL(op.imagem) + '" style="max-height:160px;max-width:100%;display:block;margin-bottom:6px;border-radius:6px">' : "") +
      (op.erro ? '<div class="aviso erro">Não consegui ler a nota. Preencha à mão.</div>' : "") +
      (!op.erro && op.imagem && (d.valorIncerto || !d.valor) ? '<div class="aviso">⚠️ Não achei o “TOTAL” com clareza na foto: <b>confira o valor total</b> antes de salvar.</div>' : "") +
      (op.falta ? '<div class="peq mudo">Depois desta: mais ' + op.falta + " nota" + (op.falta > 1 ? "s" : "") + ".</div>" : "") +
      '<div class="duas"><div><label for="cn-data">Data da compra</label><input type="date" id="cn-data"></div>' +
      '<div><label for="cn-valor">Valor total (R$)</label><input id="cn-valor" inputmode="decimal" placeholder="soma dos materiais, se vazio"></div></div>' +
      '<label for="cn-forn">Onde comprou (loja / fornecedor)</label><input id="cn-forn" list="cn-dl-forn" maxlength="120" placeholder="Ex.: Leroy Merlin, Casa do Eletricista...">' +
      '<datalist id="cn-dl-forn">' + Object.keys(lojasCompra).sort().map(function (f) { return '<option value="' + esc(f) + '">'; }).join("") + "</datalist>" +
      "<label>Área</label><div class=\"filtros\" id=\"cn-areas\">" + Object.keys(AREAS).map(function (k) { return '<button type="button" data-area="' + k + '">' + AREAS[k] + "</button>"; }).join("") + "</div>" +
      '<label for="cn-dest">Para onde foi o material (obra / loja)</label><input id="cn-dest" list="cn-dl-obras" maxlength="200" placeholder="Digite a loja, o cliente ou o nº do chamado (ou deixe: estoque)">' +
      '<datalist id="cn-dl-obras">' + obras.map(function (o) { return '<option value="' + esc(rotuloObra(o)) + '">'; }).join("") + "</datalist>" +
      '<label for="cn-tipo">Tipo de serviço</label><input id="cn-tipo" list="cn-dl-tipos" maxlength="200"><datalist id="cn-dl-tipos"></datalist>' +
      '<label>Materiais</label><div id="cn-itens"></div><button class="peq" type="button" id="cn-mais">+ Material</button> <span class="peq mudo" id="cn-soma"></span>' +
      '<label for="cn-obs">Observação</label><input id="cn-obs" maxlength="300">' +
      '<div id="cn-erro"></div><div class="acoes"><button class="prim" id="cn-salvar">Salvar compra</button>' + (c0 ? '<button class="perigo" id="cn-apagar">Apagar</button>' : "") +
      (op.depois && op.falta ? '<button id="cn-pular">Pular esta</button>' : "") + "</div>",
      { titulo: c0 ? "🧾 Compra" : "🧾 Nova compra", larga: true, fixa: true });
    var el = j.el;
    $("#cn-data", el).value = c0 ? c0.comprado_em : d.data || A.isoLocal(new Date());
    $("#cn-valor", el).value = num2(c0 ? c0.valor : d.valor);
    $("#cn-forn", el).value = c0 ? c0.fornecedor || "" : d.fornecedor || "";
    $("#cn-dest", el).value = obra ? rotuloObra(obra) : c0 ? c0.destino || "" : "";
    $("#cn-tipo", el).value = c0 ? c0.tipo_servico || "" : "";
    $("#cn-obs", el).value = c0 ? c0.descricao || "" : "";
    function marcarArea() {
      $$("[data-area]", el).forEach(function (b) { b.className = b.dataset.area === area ? "prim" : ""; });
      var tipos = area === "dividir" ? TIPOS.eletrica.concat(TIPOS.pintura) : TIPOS[area];
      $("#cn-dl-tipos", el).innerHTML = tipos.map(function (t) { return '<option value="' + esc(t) + '">'; }).join("");
      desenharItens();
    }
    $$("[data-area]", el).forEach(function (b) { b.onclick = function () { area = b.dataset.area; marcarArea(); }; });
    function desenharItens() {
      $("#cn-itens", el).innerHTML = it.map(function (x, i) {
        return '<div class="linha" style="gap:4px;flex-wrap:wrap;margin:3px 0" data-li="' + i + '">' +
          '<input data-c="item" placeholder="Material" value="' + esc(x.item || "") + '" style="flex:3 1 160px">' +
          '<input data-c="qtd" inputmode="decimal" placeholder="Qtd" value="' + esc(x.qtd ? A.numero(x.qtd) : "") + '" style="flex:0 1 60px">' +
          '<select data-c="un" style="flex:0 1 70px">' + UN.map(function (u) { return '<option' + ((x.un || "un") === u ? " selected" : "") + ">" + u + "</option>"; }).join("") + "</select>" +
          '<input data-c="valor" inputmode="decimal" placeholder="R$" value="' + esc(num2(x.valor)) + '" style="flex:0 1 80px">' +
          (area === "dividir" ? '<select data-c="area" style="flex:0 1 110px"><option value="eletrica"' + (x.area !== "pintura" ? " selected" : "") + '>⚡ Elétrica</option><option value="pintura"' + (x.area === "pintura" ? " selected" : "") + ">🖌️ Pintura</option></select>" : "") +
          '<button class="peq" type="button" data-rm="' + i + '">✕</button></div>';
      }).join("");
      $$("[data-li]", el).forEach(function (l) {
        var x = it[Number(l.dataset.li)];
        $$("[data-c]", l).forEach(function (inp) {
          inp.oninput = inp.onchange = function () { var k = inp.dataset.c; x[k] = k === "qtd" || k === "valor" ? A.lerNumero(inp.value) : inp.value; somar(); };
        });
      });
      $$("[data-rm]", el).forEach(function (b) { b.onclick = function () { it.splice(Number(b.dataset.rm), 1); desenharItens(); }; });
      somar();
    }
    function somar() {
      var s = it.reduce(function (t, x) { return t + (Number(x.valor) || 0); }, 0);
      $("#cn-soma", el).textContent = s ? "Soma dos materiais: " + dinheiro(s) : "";
    }
    $("#cn-mais", el).onclick = function () { it.push({ un: "un", area: area === "pintura" ? "pintura" : "eletrica" }); desenharItens(); };
    marcarArea();
    if (!it.length) { it.push({ un: "un" }); desenharItens(); }
    if ($("#cn-pular", el)) $("#cn-pular", el).onclick = function () { j.fechar(); op.depois(); };
    if ($("#cn-apagar", el)) $("#cn-apagar", el).onclick = function () {
      if (!A.confirmar("Apagar esta compra?")) return;
      P.q(P.sb.from("compras").delete().eq("id", c0.id)).then(function () { P.tirar(P.S.compras, c0.id); j.fechar(); P.rota(); }).catch(P.falhou);
    };
    $("#cn-salvar", el).onclick = function () {
      var b = this, itens = it.filter(function (x) { return String(x.item || "").trim(); }).map(function (x) {
        var y = { item: String(x.item).trim(), qtd: Number(x.qtd) || null, un: x.un || "un", valor: Number(x.valor) || null };
        if (area === "dividir") y.area = x.area === "pintura" ? "pintura" : "eletrica";
        return y;
      });
      var soma = itens.reduce(function (t, x) { return t + (x.valor || 0); }, 0), valor = A.lerNumero($("#cn-valor", el).value) || soma;
      var erro = !(valor > 0) ? "Informe o valor total (ou o valor dos materiais)." : !$("#cn-data", el).value ? "Informe a data." :
        area === "dividir" && !itens.some(function (x) { return x.valor; }) ? "Para dividir entre elétrica e pintura, informe o valor de cada material." : "";
      if (erro) { $("#cn-erro", el).innerHTML = '<div class="aviso erro">' + erro + "</div>"; return; }
      var ob = obraPorRotulo($("#cn-dest", el).value);
      var dados = { comprado_em: $("#cn-data", el).value, valor: valor, fornecedor: $("#cn-forn", el).value.trim() || null, area: area,
        obra_id: ob ? ob.id : null, destino: ob ? null : ($("#cn-dest", el).value.trim() || null), tipo_servico: $("#cn-tipo", el).value.trim() || null,
        itens: itens, descricao: $("#cn-obs", el).value.trim() || null };
      if (!c0 && d.cnpj) dados.cnpj = d.cnpj;
      A.ocupado(b, true, "Salvando...");
      var pNota = !op.imagem ? Promise.resolve(null) : A.prepararFoto(op.imagem, [], 1600).then(function (bl) {
        var cam = "admin/compras/" + dados.comprado_em + "-" + A.uuid() + ".jpg";
        return P.q(P.sb.storage.from("fotos").upload(cam, bl, { contentType: "image/jpeg" })).then(function () { return cam; });
      }).catch(function () { return null; });   // sem a foto, a compra ainda é salva
      pNota.then(function (cam) {
        if (cam) dados.nota = cam;
        return P.q(c0 ? P.sb.from("compras").update(dados).eq("id", c0.id).select().single() : P.sb.from("compras").insert(dados).select().single());
      }).then(function (n) {
        P.trocar(P.S.compras, n); j.fechar();
        A.avisar("🧾 Compra salva: " + dinheiro(n.valor), "ok");
        if (location.hash !== "#compras") location.hash = "#compras"; else P.rota();
        if (op.depois) op.depois();
      }).catch(function (e) { A.ocupado(b, false); $("#cn-erro", el).innerHTML = '<div class="aviso erro">' + esc(A.msgErro(e)) + "</div>"; });
    };
  }

  // ---------------- totais e lista ----------------
  // quanto de uma compra é de cada área (dividida: pelos materiais; o que sobra do total vai para a maior)
  function porArea(c) {
    var r = { eletrica: 0, pintura: 0 }, v = Number(c.valor) || 0;
    if (c.area !== "dividir") { r[c.area === "pintura" ? "pintura" : "eletrica"] = v; return r; }
    (c.itens || []).forEach(function (x) { r[x.area === "pintura" ? "pintura" : "eletrica"] += Number(x.valor) || 0; });
    var resto = v - r.eletrica - r.pintura;
    if (Math.abs(resto) >= 0.005) r[r.pintura > r.eletrica ? "pintura" : "eletrica"] += resto;
    return r;
  }
  function periodo() {
    var h = new Date(), dia = 864e5, de, ate;
    if (filtro.periodo === "mes") { de = new Date(h.getFullYear(), h.getMonth(), 1); ate = new Date(h.getFullYear(), h.getMonth() + 1, 1); }
    else if (filtro.periodo === "mespassado") { de = new Date(h.getFullYear(), h.getMonth() - 1, 1); ate = new Date(h.getFullYear(), h.getMonth(), 1); }
    else if (filtro.periodo === "3meses") { de = new Date(h.getFullYear(), h.getMonth() - 2, 1); ate = new Date(h.getFullYear(), h.getMonth() + 1, 1); }
    else if (filtro.periodo === "ano") { de = new Date(h.getFullYear(), 0, 1); ate = new Date(h.getFullYear() + 1, 0, 1); }
    else if (filtro.periodo === "tudo") { de = new Date(2000, 0, 1); ate = new Date(2100, 0, 1); }
    else { de = filtro.de ? new Date(filtro.de + "T00:00:00") : new Date(2000, 0, 1); ate = filtro.ate ? new Date(new Date(filtro.ate + "T00:00:00").getTime() + dia) : new Date(2100, 0, 1); }
    return { de: A.isoLocal(de), ate: A.isoLocal(ate) };
  }
  function destinoDe(c) { var o = c.obra_id ? P.porId(P.S.obras, c.obra_id) : null; return o ? rotuloObra(o) : c.destino || "Estoque / sem destino"; }
  function lista() {
    var pr = periodo(), b = semAcento(filtro.busca);
    return P.S.compras.filter(function (c) {
      if (c.comprado_em < pr.de || c.comprado_em >= pr.ate) return false;
      if (filtro.area && !(porArea(c)[filtro.area] > 0)) return false;
      if (b && semAcento([c.fornecedor, destinoDe(c), c.tipo_servico, c.descricao, (c.itens || []).map(function (x) { return x.item; }).join(" ")].join(" ")).indexOf(b) < 0) return false;
      return true;
    }).sort(function (a, b2) { return b2.comprado_em.localeCompare(a.comprado_em) || String(b2.criado_em).localeCompare(String(a.criado_em)); });
  }
  function totais(cs) {
    var t = { eletrica: 0, pintura: 0 };
    cs.forEach(function (c) { var r = porArea(c); t.eletrica += r.eletrica; t.pintura += r.pintura; });
    return t;
  }

  function ver(c, ctx) {
    P = ctx;
    if (P.S.semCompras) {
      c.innerHTML = '<div class="cab-secao"><h2>🧾 Compras</h2></div><div class="aviso">Para usar esta área, rode de novo o arquivo <b>supabase.sql</b> no Supabase ' +
        "(SQL Editor → colar tudo → Run) e depois <code>notify pgrst, 'reload schema';</code> Ele cria a tabela de compras sem apagar nada. Depois toque em ↻." +
        (P.S.erroCompras ? '<div class="peq mudo" style="margin-top:6px">Erro do banco: ' + esc(P.S.erroCompras) + "</div>" : "") + "</div>";
      return;
    }
    c.innerHTML = '<div class="cab-secao"><h2>🧾 Compras de material</h2><span><button class="prim" id="cp-nota">📷 Nota / cupom</button> <button id="cp-mao">➕ Lançar à mão</button></span></div>' +
      '<input type="file" id="cp-arq" accept="image/*,application/pdf" multiple class="oculto">' +
      '<p class="mudo peq" style="margin-top:-4px">Tire a foto da nota (ou no celular: Compartilhar → AGE Painel). O app lê valor, data, loja e itens; você completa o destino e o tipo de serviço.</p>' +
      '<div class="filtros"><select id="cp-per" aria-label="Período"><option value="mes">Este mês</option><option value="mespassado">Mês passado</option><option value="3meses">Últimos 3 meses</option>' +
      '<option value="ano">Este ano</option><option value="tudo">Tudo</option><option value="datas">Escolher datas</option></select>' +
      '<select id="cp-area" aria-label="Área"><option value="">Elétrica e pintura</option><option value="eletrica">⚡ Só elétrica</option><option value="pintura">🖌️ Só pintura</option></select>' +
      '<input type="date" id="cp-de" class="' + (filtro.periodo === "datas" ? "" : "oculto") + '" aria-label="De"><input type="date" id="cp-ate" class="' + (filtro.periodo === "datas" ? "" : "oculto") + '" aria-label="Até">' +
      '<input type="search" id="cp-busca" placeholder="Buscar loja, obra, material..."></div><div id="cp-res"></div>';
    $("#cp-per").value = filtro.periodo; $("#cp-area").value = filtro.area; $("#cp-de").value = filtro.de; $("#cp-ate").value = filtro.ate; $("#cp-busca").value = filtro.busca;
    ["#cp-per", "#cp-area", "#cp-de", "#cp-ate"].forEach(function (id) {
      $(id).onchange = function () { filtro.periodo = $("#cp-per").value; filtro.area = $("#cp-area").value; filtro.de = $("#cp-de").value; filtro.ate = $("#cp-ate").value; ver(c, P); };
    });
    $("#cp-busca").oninput = function () { filtro.busca = this.value; listar(); };
    $("#cp-nota").onclick = function () { $("#cp-arq").value = ""; $("#cp-arq").click(); };
    $("#cp-arq").onchange = function () { if (this.files.length) receber({ arquivos: Array.prototype.slice.call(this.files) }, P); };
    $("#cp-mao").onclick = function () { formulario({}); };
    listar();
    function listar() {
      var cs = lista(), t = totais(cs), r = $("#cp-res");
      var lad = function (rot, v, cor) { return '<div class="ladrilho" style="border-left:4px solid var(--' + cor + ')"><div class="r">' + rot + '</div><div class="v" style="font-size:1.3em">' + dinheiro(v) + "</div></div>"; };
      var h = '<div class="grade">' + (filtro.area !== "pintura" ? lad("⚡ Elétrica", t.eletrica, "eletrica") : "") + (filtro.area !== "eletrica" ? lad("🖌️ Pintura", t.pintura, "pintura") : "") +
        (filtro.area ? "" : lad("Total", t.eletrica + t.pintura, "prim")) + "</div>";
      if (!cs.length) { r.innerHTML = h + '<div class="cartao vazio">Nenhuma compra neste período.</div>'; return; }
      // por destino (obra/loja), com elétrica e pintura
      var dest = {};
      cs.forEach(function (x) { var k = destinoDe(x), a = porArea(x); dest[k] = dest[k] || { e: 0, p: 0 }; dest[k].e += a.eletrica; dest[k].p += a.pintura; });
      h += '<div class="cartao"><h3 style="margin:0 0 6px">Por destino</h3><div class="tabela-caixa"><table><thead><tr><th>Obra / loja</th><th class="num">⚡ Elétrica</th><th class="num">🖌️ Pintura</th><th class="num">Total</th></tr></thead><tbody>' +
        Object.keys(dest).sort(function (a, b) { return (dest[b].e + dest[b].p) - (dest[a].e + dest[a].p); }).map(function (k) {
          return "<tr><td>" + esc(k) + '</td><td class="num">' + dinheiro(dest[k].e) + '</td><td class="num">' + dinheiro(dest[k].p) + '</td><td class="num"><b>' + dinheiro(dest[k].e + dest[k].p) + "</b></td></tr>";
        }).join("") + '</tbody></table></div><div class="acoes"><button id="cp-csv">⬇ Planilha (CSV)</button><button id="cp-comp">📤 Compartilhar resumo</button></div></div>';
      h += '<div class="tabela-caixa"><table><thead><tr><th>Data</th><th>Onde comprou</th><th>Área</th><th>Destino</th><th>Tipo de serviço</th><th>Materiais</th><th class="num">Valor</th><th></th></tr></thead><tbody>' +
        cs.map(function (x) {
          var a = porArea(x);
          return "<tr><td>" + esc(A.dataSimples(x.comprado_em)) + "</td><td>" + esc(x.fornecedor || "—") + "</td><td>" +
            (x.area === "dividir" ? '<span class="peq">⚡ ' + dinheiro(a.eletrica) + "<br>🖌️ " + dinheiro(a.pintura) + "</span>" : A.seloCategoria(x.area === "pintura" ? "pintura" : "eletrica")) +
            "</td><td>" + esc(destinoDe(x)) + "</td><td>" + esc(x.tipo_servico || "") + '</td><td class="peq">' +
            esc((x.itens || []).map(function (y) { return (y.qtd ? A.numero(y.qtd) + " " + (y.un || "") + " " : "") + y.item; }).join("; ").slice(0, 140)) +
            (x.descricao ? '<div class="mudo">' + esc(x.descricao) + "</div>" : "") + '</td><td class="num"><b>' + dinheiro(x.valor) + "</b></td><td>" +
            (x.nota ? '<button class="peq" data-cp-nota="' + x.id + '">🧾</button> ' : "") + '<button class="peq" data-cp-ed="' + x.id + '">Editar</button></td></tr>';
        }).join("") + "</tbody></table></div>";
      r.innerHTML = h;
      $("#cp-csv").onclick = function () { baixarCsv(cs); };
      $("#cp-comp").onclick = function () { A.compartilhar({ titulo: "Compras de material", texto: textoResumo(cs, t, dest) }); };
      $$("[data-cp-ed]", r).forEach(function (b) { b.onclick = function () { formulario({ compra: P.porId(P.S.compras, b.dataset.cpEd) }); }; });
      $$("[data-cp-nota]", r).forEach(function (b) {
        b.onclick = function () {
          var x = P.porId(P.S.compras, b.dataset.cpNota);
          P.infoFoto[x.nota] = "Nota · " + esc(x.fornecedor || "") + " · " + dinheiro(x.valor) + " · " + A.dataSimples(x.comprado_em);
          var jj = A.janela('<div class="fotos">' + P.htmlFoto(x.nota, "nota") + "</div>", { titulo: "🧾 Nota" });
          P.hidratarFotos(jj.el);
        };
      });
    }
  }
  function textoResumo(cs, t, dest) {
    var pr = periodo(), fim = new Date(new Date(pr.ate + "T12:00:00").getTime() - 864e5);
    return "*" + ((A.CFG.EMPRESA || {}).nome || "AGE") + " — Compras de material*\n" + (filtro.periodo !== "tudo" ? A.dataSimples(pr.de) + " a " + A.data(fim) + "\n" : "") +
      "\n⚡ Elétrica: " + dinheiro(t.eletrica) + "\n🖌️ Pintura: " + dinheiro(t.pintura) + "\n*Total: " + dinheiro(t.eletrica + t.pintura) + "*\n\nPor destino:\n" +
      Object.keys(dest).map(function (k) { return "• " + k + ": " + dinheiro(dest[k].e + dest[k].p) + (dest[k].e && dest[k].p ? " (⚡ " + dinheiro(dest[k].e) + " · 🖌️ " + dinheiro(dest[k].p) + ")" : ""); }).join("\n") +
      "\n\n" + cs.length + " compra" + (cs.length > 1 ? "s" : "") + " no período.";
  }
  function baixarCsv(cs) {
    var cel = function (x) { x = String(x === null || x === undefined ? "" : x); return /[;"\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
    var r2 = function (v) { return Number(v || 0).toFixed(2).replace(".", ","); };
    var linhas = [["Data", "Onde comprou", "Área", "Elétrica (R$)", "Pintura (R$)", "Valor total (R$)", "Destino", "Tipo de serviço", "Materiais", "Observação"]];
    cs.forEach(function (x) {
      var a = porArea(x);
      linhas.push([A.dataSimples(x.comprado_em), x.fornecedor || "", (AREAS[x.area] || "").replace(/^\S+\s/, ""), r2(a.eletrica), r2(a.pintura), r2(x.valor), destinoDe(x), x.tipo_servico || "",
        (x.itens || []).map(function (y) { return (y.qtd ? A.numero(y.qtd) + " " + (y.un || "") + " " : "") + y.item + (y.valor ? " (" + r2(y.valor) + ")" : ""); }).join("; "), x.descricao || ""]);
    });
    var csv = "﻿" + linhas.map(function (l) { return l.map(cel).join(";"); }).join("\r\n");
    P.baixar(new Blob([csv], { type: "text/csv;charset=utf-8" }), "compras-" + A.isoLocal(new Date()) + ".csv");
  }

  window.AGE_COMPRAS = { ver: ver, receber: receber, lerNota: lerNota, porArea: porArea };
})();
