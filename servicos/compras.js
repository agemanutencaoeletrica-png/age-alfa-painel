// Painel do dono — 🧾 COMPRAS: material (notas e cupons) e DESPESAS AVULSAS (combustível, oficina, lanche...).
// Foto/PDF da nota (lida no aparelho: valor, data, loja, itens e forma de pagamento) ou lançamento à mão.
// Material: área (⚡ elétrica, 🖌️ pintura ou dividida), destino (obra/loja) e tipo de serviço. Totais por área,
// por loja (com o que falta pagar) e por destino somados na hora. Usa as funções do admin.js (P) e o leitor do pagamentos.js.
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null;
  var filtro = { periodo: "mes", area: "", busca: "", de: "", ate: "", tipo: "" };
  var AREAS = { eletrica: "⚡ Elétrica", pintura: "🖌️ Pintura", dividir: "➗ Elétrica e pintura" };
  var AREAS_D = { geral: "Geral", eletrica: "⚡ Elétrica", pintura: "🖌️ Pintura" };
  var CATS = { combustivel: "⛽ Combustível", veiculo: "🔧 Manutenção de veículo", alimentacao: "🍔 Lanche / alimentação", pedagio: "🅿️ Pedágio / estacionamento",
    ferramentas: "🛠️ Ferramentas / EPI", outros: "📦 Outros" };
  var FORMAS = { pix: "Pix", dinheiro: "Dinheiro", cartao: "Cartão", boleto: "Boleto / a prazo", outro: "Outro" };
  var TIPOS = {
    eletrica: ["Instalação de tomadas e interruptores", "Troca de disjuntor", "Montagem de quadro de distribuição", "Instalação de iluminação",
      "Passagem de fiação", "Manutenção corretiva", "Instalação de ventilador", "Aterramento", "Padrão de entrada"],
    pintura: ["Pintura interna", "Pintura externa", "Massa corrida", "Textura / grafiato", "Pintura de portões e grades", "Impermeabilização",
      "Pintura de piso / demarcação", "Piso epóxi", "Estrutura metálica", "Fachada"]
  };
  var UN = ["un", "m", "m²", "rolo", "L", "galão", "lata", "balde", "kg", "cx", "pç", "pct", "par"];

  function semAcento(t) { return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function dinheiro(v) { return A.dinheiro(Number(v) || 0); }
  function num2(v) { return v || v === 0 ? Number(v).toFixed(2).replace(".", ",") : ""; }
  function ehDespesa(c) { return c.tipo === "despesa"; }

  // ---------------- leitura da nota / cupom ----------------
  var DIN = /\d{1,3}(?:\.\d{3})*,\d{2}/;
  function lerNota(texto) {
    var t = String(texto || "").replace(/\r/g, ""), ls = t.split("\n").map(function (x) { return x.trim(); }).filter(Boolean), r = { itens: [] };
    // valores em reais (sem pegar pedaço de CNPJ "17.134,491/0001-66")
    var valores = function (x) { return (x.match(/\d{1,3}(?:\.\d{3})*,\d{2}(?![\d\/])/g) || []).map(A.lerNumero); };
    // total: rótulo forte ("TOTAL DA NOTA", "TOTAL A PAGAR") aceita o número na linha vizinha (DANFE: rótulos numa linha,
    // números na de baixo); rótulo fraco ("VALOR TOTAL", "TOTAL") só com o número na mesma linha; depois a fatura/parcela
    var forteT = /total\s*da\s*nota|total\s+a\s+pagar|valor\s+a\s+pagar|valor\s+pago/i;
    var fracoT = /valor\s+total(?!\s+dos?\s+(?:produtos|servi))|total\s+(?:geral|r\$)|^\W*total\b(?!\s+(?:bruto|de\s+itens|dos))|\btotal\s*:?\s*(?:r\$\s*)?(?:\d{1,3}(?:\.\d{3})*,\d{2}|\d{1,4}\.\d{2})(?![\d,.])\D{0,4}$/i;
    var achou = null, pos = function (v) { return v.filter(function (n) { return n > 0; }); };
    // junto do rótulo do total a foto costuma trocar 5 por S e a vírgula por ponto ("s4.00" = 54,00)
    var valoresT = function (x) {
      return valores(x.replace(/(^|[\s:|;=-])[sS](?=\d[.,]\d{2}(?!\d))/g, function (m, a1) { return a1 + "5"; })
        .replace(/(^|[^\d.,\/])(\d{1,4})\.(\d{2})(?![\d.,\/])/g, function (m, a1, n, c) { return a1 + n + "," + c; }));
    };
    ls.forEach(function (x, i) {
      var v;
      if (forteT.test(x)) {
        v = pos(valoresT(x.slice(x.search(forteT))));
        var naLinha = v.length > 0;
        [i + 1, i - 1, i + 2].forEach(function (k) { if (!v.length && ls[k]) v = pos(valoresT(ls[k])); });
        if (v.length) { achou = v[v.length - 1]; r.naLinha = naLinha; }
      } else if (achou === null && fracoT.test(x)) {
        v = pos(valoresT(x.slice(x.search(fracoT))));
        if (v.length) { r.valorFraco = v[v.length - 1]; r.naLinha = true; }
      }
    });
    if (achou === null && r.valorFraco) achou = r.valorFraco;
    delete r.valorFraco;
    if (achou === null) { var mf = t.match(/(?:fatura|parcela|vencimento|duplicata)[^\n]*?valor[^\d\n]{0,12}(\d{1,3}(?:\.\d{3})*,\d{2})(?![\d\/])/i); if (mf) achou = A.lerNumero(mf[1]); }
    if (achou !== null) r.valor = achou;
    else { var todos = valoresT(t); if (todos.length) { r.valor = Math.max.apply(null, todos); r.valorIncerto = true; } }   // aceita "219.68" (ponto no lugar da vírgula)
    // data: só datas possíveis (o "12.741/2012" da lei vira "12/41/2012" na foto); a de "Emissão" tem preferência
    var datas = [], reD = /(\d{2})\/(\d{2})\/(\d{4}|\d{2})\b/g, md2;
    while ((md2 = reD.exec(t))) {
      var ano = md2[3].length === 2 ? 2000 + Number(md2[3]) : Number(md2[3]), mes = Number(md2[2]), dia = Number(md2[1]);
      if (ano >= 2020 && ano <= new Date().getFullYear() + 1 && mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31)
        datas.push({ iso: ano + "-" + md2[2] + "-" + md2[1], emissao: /emiss/i.test(t.slice(Math.max(0, md2.index - 40), md2.index)) });
    }
    // a foto às vezes lê "2026" como "2020": havendo datas recentes (último ano), as antigas não contam
    var lim = A.isoLocal(new Date(Date.now() - 400 * 864e5)), recentes = datas.filter(function (x) { return x.iso >= lim; });
    if (recentes.length) datas = recentes;
    else {
      // só datas antigas: "2020" pode ser "2026" com o 6 lido como 0 — troca o último número do ano pelo do ano atual se a data ficar recente
      var hoje = A.isoLocal(new Date()), anoH = String(new Date().getFullYear());
      var corrigidas = datas.map(function (x) { var c = anoH.slice(0, 3) + anoH[3] + x.iso.slice(4); return c <= hoje && c >= lim && x.iso.slice(0, 3) === anoH.slice(0, 3) ? { iso: c, emissao: x.emissao } : null; }).filter(Boolean);
      if (corrigidas.length) { datas = corrigidas; r.dataCorrigida = true; }
    }
    var dEm = datas.filter(function (x) { return x.emissao; })[0] || datas[0];
    if (dEm) r.data = dEm.iso; else r.semData = true;
    // loja: a linha com o nome antes do CNPJ (ou a primeira linha com letras)
    var iC = -1, proprio = String((A.CFG.EMPRESA || {}).documento || "").replace(/\D/g, "");
    for (var i = 0; i < ls.length; i++) if (/cnpj/i.test(ls[i])) { iC = i; break; }
    // tira da linha o que não é nome (título da nota, CEP, telefone, endereço) e o pedaço solto no fim ("LIDER TINTAS L")
    var limparNome = function (x) {
      return x.replace(/\b(documento auxiliar|nota fiscal|danfe|nfc-?e|consulta|chave de acesso|0\s*-\s*entrada|1\s*-\s*sa[ií]da)\b.*$/i, "")
        .replace(/\b(cep|fone|tel|telefone|cnpj|ie|rua|r\.|av\.?|avenida|rodovia)\b.*$/i, "").replace(/[^A-Za-zÀ-ú0-9&.' -]/g, " ")
        .replace(/\s+\S$/, "").replace(/\s+/g, " ").trim();
    };
    var cand = ls.slice(0, iC > 0 ? iC + 1 : Math.min(10, ls.length)).map(limparNome).filter(function (x) {
      return /[A-Za-zÀ-ú]{3,}\s+[A-Za-zÀ-ú]{2,}/.test(x) && !/age solu|destinat|remetente|protocolo|emitente|identifica|natureza|^\W*endere[cç]o|manuten[a-zà-ú]*\s+e?\s*eletric|eletricas e civil/i.test(x) &&
        !(proprio && x.replace(/\D/g, "").indexOf(proprio) >= 0);   // a linha da AGE (destinatário) não é a loja
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
      // sujeira antes do nome na foto ("Bugs. Na Rodol Ltda"): sai palavra terminada em pontuação e pedaço de 2 letras
      var wf = (mr ? mr[0] : f0).replace(/\s+/g, " ").trim().split(" ");
      while (wf.length > 2 && (/[.:;,!]$/.test(wf[0]) || /^[A-ZÀ-Ú][a-zà-ú]$/.test(wf[0]) || /^[a-zà-ú]{1,3}$/.test(wf[0]))) wf.shift();
      r.fornecedor = wf.join(" ").slice(0, 120);
    }
    // CNPJ da loja (válido e que não é o da AGE, que aparece como destinatário), telefone e e-mail da loja
    if (window.AGE_FORN) {
      var lj = window.AGE_FORN.doTexto(t);
      if (lj.cnpj) r.cnpj = lj.cnpj;
      if (lj.telefone || lj.email) r.loja = { telefone: lj.telefone || "", whatsapp: lj.whatsapp || "", email: lj.email || "" };
    } else { var mcnpj = t.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/); if (mcnpj) r.cnpj = mcnpj[0]; }
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
    // a foto traz sujeira nas colunas ("|", "[", "="); a coluna do total às vezes some: total = quantidade × unitário
    ls.forEach(function (x, i) {
      var l = x.replace(/[|\[\]“”"=_]/g, " ").replace(/\s+/g, " ").trim();
      var md = l.match(/^\W*\d{3,14}\s+([A-Za-zÀ-ú].*?)\s+\d{8}(?!\d)(.*)$/);
      var mu = md && md[2].match(/\b(UN|UND|PC|PCT|M|MT|KG|CX|RL|LT|L|GL|LATA|BD|PAR)\b(.*)$/i);
      var ns = mu ? (mu[2].match(/\d{1,3}(?:\.\d{3})*,\d{2,6}/g) || []).map(A.lerNumero) : [];
      if (ns.length < 2 || !(ns[0] > 0) || !(ns[1] > 0)) return;
      var qtd = ns[0], unit = ns[1], tot = null;
      for (var k = 2; k < ns.length && tot === null; k++) if (Math.abs(ns[k] - qtd * unit) < 0.05) tot = ns[k];
      if (tot === null) tot = Math.round(qtd * unit * 100) / 100;
      r.itens.push({ item: md[1].replace(/\s+/g, " ").trim().slice(0, 120), qtd: qtd, un: mu[1].toLowerCase().replace("und", "un"), unit: unit, valor: tot });
      ls[i] = "";
    });
    // "002637 1,00 UN ESMALTE CORALIT 3,6L AMARELO 49,90 49,90" (código, quantidade, unidade, descrição, unitário, total)
    ls.forEach(function (x, i) {
      var m3 = x.match(/^\W*\d{3,8}\s+(\d+(?:[.,]\d+)?)\s*(UN|UND|PC|PÇ|PCT|M|MT|KG|CX|RL|LT|L|GL|LATA|BD|PAR)\s+([A-Za-zÀ-ú].*?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/i);
      if (m3) { r.itens.push({ item: m3[3].replace(/\s+/g, " ").slice(0, 120), qtd: A.lerNumero(m3[1]), un: m3[2].toLowerCase().replace("und", "un"), valor: A.lerNumero(m3[5]) }); x = ""; return; }
      // o mesmo formato com a foto ruim (pré-venda): "003462 400 UN ROLOANTIGOTASCM oo 21,90 Bro" — a vírgula da quantidade sumiu (400 = 4,00),
      // sujeira depois do nome e o total ilegível ("21 80", "Bro"): o total vale se bater com qtd × unitário, senão é calculado
      var m4 = x.match(/^\W*(?=[0-9A-Za-z]*\d[0-9A-Za-z]*\d)[0-9A-Za-z]{4,8}\s+(?:[—–-]+\s+)?(\d{1,4}(?:[.,]\d{1,3})?)\s*(UN|UND|PC|PÇ|PCT|M|MT|KG|CX|RL|LT|GL|LATA|BD|PAR)\b\.?\s+([A-ZÀ-Ú0-9].*)$/);
      if (!m4) return;
      var q4 = /[.,]/.test(m4[1]) ? A.lerNumero(m4[1]) : m4[1].length >= 3 && /00$/.test(m4[1]) ? Number(m4[1]) / 100 : Number(m4[1]);
      // preço unitário: o 1º valor depois do nome (a foto troca a vírgula por ponto: "12.90"); pode faltar (fica para você completar)
      var mp4 = m4[3].match(/(?:^|\s)(\d{1,3}(?:\.\d{3})*,\d{2}|\d{1,4}\.\d{2})(?![\d,.])/), u4 = mp4 ? A.lerNumero(mp4[1].replace(/^(\d{1,4})\.(\d{2})$/, "$1,$2")) : null;
      var antes4 = mp4 ? m4[3].slice(0, mp4.index) : m4[3], depois4 = mp4 ? m4[3].slice(mp4.index + mp4[0].length) : "";
      var w4 = antes4.replace(/[|"'“”]/g, " ").split(/\s+/), d4 = [];
      for (var k4 = 0; k4 < w4.length; k4++) { if (!w4[k4]) continue; if (/[a-zà-ú]/.test(w4[k4]) || /[—–_]/.test(w4[k4]) || !/[A-ZÀ-Ú0-9]/.test(w4[k4])) break; d4.push(w4[k4]); }
      var mt4 = depois4.match(/(\d{1,3}(?:\.\d{3})*)[ ,.](\d{2})(?!\d)/), t4 = mt4 ? A.lerNumero(mt4[1] + "," + mt4[2]) : null;
      if (u4 > 0 && !(t4 && Math.abs(t4 - q4 * u4) < 0.05)) t4 = Math.round(q4 * u4 * 100) / 100;
      if (!(u4 > 0)) { u4 = null; t4 = null; }
      while (d4.length > 1 && /^\d{1,2}[º°.]*$/.test(d4[d4.length - 1])) d4.pop();   // número solto no fim ("TRINCHA396-2 1º.")
      // total do item na linha vizinha (foto torta): confirma qtd × unitário ou corrige a quantidade lida errado ("700" no lugar de "100")
      if (u4 > 0 && !(mt4 && Math.abs(A.lerNumero(mt4[1] + "," + mt4[2]) - q4 * u4) < 0.05)) {
        var viz = [ls[i - 1], ls[i + 1]].filter(function (z) { return z && !/^\W*(?=[0-9A-Za-z]*\d[0-9A-Za-z]*\d)[0-9A-Za-z]{4,8}\s+\d/.test(z) && !/[A-Za-zÀ-ú]{4,}/.test(z); })
          .map(function (z) { return (z.match(/\d{1,4}[ ,.]\d{2}(?!\d)/g) || []).map(function (n) { return A.lerNumero(n.replace(/[ .](\d{2})$/, ",$1")); }); });
        var tv = [].concat.apply([], viz), ok4 = tv.some(function (n) { return Math.abs(n - q4 * u4) < 0.05; });
        if (!ok4) { var q5 = tv.map(function (n) { return n / u4; }).filter(function (qq) { return qq >= 1 && qq <= 999 && Math.abs(qq - Math.round(qq)) < 0.01 && String(Math.round(qq)).length === String(Math.round(q4)).length; })[0];
          if (q5) { q4 = Math.round(q5); t4 = Math.round(q4 * u4 * 100) / 100; } }
      }
      if (d4.length && q4 > 0 && q4 <= 999) r.itens.push({ item: d4.join(" ").slice(0, 120), qtd: q4, un: m4[2].toLowerCase().replace("und", "un"), unit: u4, valor: t4 });
    });
    ls.forEach(function (x) {
      // a quantidade é a última "N UN" antes do preço ("100M" no nome do cabo não é a quantidade)
      var mi = x.match(/^(?:\d{1,4}\s+)?(?:\d{4,14}\s+)?([A-Za-zÀ-ú][^\n]*)\s+(\d+(?:[.,]\d+)?)\s*(UN|UND|PC|PÇ|PCT|M|MT|M2|KG|CX|RL|LT|L|GL|LATA|BD|PAR)\s+(?:[^\n]*?\s)?(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/i);
      if (mi && !/total|subtotal|desconto|troco|pagamento|cart[aã]o|dinheiro/i.test(x))
        r.itens.push({ item: mi[1].replace(/\s+/g, " ").slice(0, 120), qtd: A.lerNumero(mi[2]), un: mi[3].toLowerCase().replace("und", "un").replace("mt", "m"), valor: A.lerNumero(mi[4]) });
    });
    // forma de pagamento: Pix, dinheiro, cartão (parcelas) ou boleto/a prazo (fica "a pagar")
    // (o quadro "Duplicatas / Vencimento" existe em toda DANFE: não quer dizer boleto)
    var sa = semAcento(t), mp = sa.match(/cart[a-z]*\s+de\s+credito[\s,.:-]*(\d{1,2})\s*x|credito[\s,.:-]*(\d{1,2})\s*x/);
    if (mp || /cart[a-z]*\s+(de\s+)?(credito|debito)|\(pos\)|cartao/.test(sa)) { r.forma = "cartao"; if (mp) r.parcelas = Number(mp[1] || mp[2]); }
    else if (/boleto|a prazo|faturad[ao] para/.test(sa) && !/\bpix\b/.test(sa)) { r.forma = "boleto"; r.pago = false; }
    else if (/\bpix\b/.test(sa)) r.forma = "pix";
    else if (/dinheiro|\bem especie\b|especie\s*[:-]?\s*r?\$?\s*\d/.test(sa.replace(/especie\s+volumes?/g, ""))) r.forma = "dinheiro";   // "ESPÉCIE VOLUMES" da DANFE é do transporte
    // despesa avulsa (posto, oficina, lanchonete...): categoria sugerida
    r.categoria = categoriaPeloTexto(sa);
    // nenhum formato reconhecido: qualquer linha com unidade (UN, PC, GL...) seguida de pelo menos 2 valores é um material;
    // a descrição é o que vem antes (sem o código, NCM, CST, CFOP) ou a linha de cima, se a de cima for só o nome
    // material que não faz sentido (quantidade que é o CFOP "5102", cabeçalho da tabela...) sai da lista
    var palavras = function (d) { return (String(d).match(/[A-Za-zÀ-ú]{3,}/g) || []).filter(function (w) { return /[aeiouáéíóúâêôãõ]/i.test(w); }).length; };
    var semFim = function (d) { var w = String(d).split(" "); while (w.length && /^[\dOIlS.\/-]{3,}$/.test(w[w.length - 1]) && (w[w.length - 1].match(/\d/g) || []).length >= 2) w.pop(); return w.join(" "); };
    var CAB = /total|subtotal|desconto|valor|base de c|imposto|icms|frete|quant|descri|\bcod\b|codigo|código|produto|unid/i;
    r.itens = r.itens.filter(function (x) { return x.qtd > 0 && x.qtd <= 999 && palavras(x.item) >= 1 && !CAB.test(x.item); })
      .map(function (x) { x.item = semFim(x.item); return x; });
    if (!r.itens.length) ls.forEach(function (x, i) {
      var l = String(x || "").replace(/[|\[\]“”"=_{}]/g, " ").replace(/\s+/g, " ").trim();
      var mu = l.match(/^(.*?)\b(UN|UND|UNID|PC|PÇ|PCT|M|MT|KG|CX|RL|LT|GL|LATA|BD|PAR)\b\.?\s*(.*)$/i);
      if (!mu) return;
      var ns = (mu[3].match(/\d{1,3}(?:\.\d{3})*,\d{2,6}/g) || []).map(A.lerNumero);
      if (ns.length < 2 || !(ns[0] > 0) || !(ns[1] > 0) || ns[0] > 9999) return;
      if (/\d,\d{2}\s*$/.test(mu[1])) return;   // "1,00 UN ESMALTE..." (quantidade antes da unidade) é outro formato
      var desc = semFim(mu[1].replace(/^\W*\d{2,14}\s+/, "").trim()).replace(/(\s+\d{1,4})+\s*$/, "").trim();
      if (palavras(desc) < 2 && ls[i - 1] && !/\d,\d{2}/.test(ls[i - 1])) desc = semFim(String(ls[i - 1]).replace(/[|\[\]“”"=_]/g, " ").replace(/^\W*\d{2,14}\s+/, "").replace(/\s+/g, " ").trim());
      if (palavras(desc) < 2 || CAB.test(desc)) return;
      var qtd = ns[0], unit = ns[1], tot = null;
      for (var k = 2; k < ns.length && tot === null; k++) if (Math.abs(ns[k] - qtd * unit) < 0.05) tot = ns[k];
      if (tot === null) tot = Math.round(qtd * unit * 100) / 100;
      r.itens.push({ item: desc.slice(0, 120), qtd: qtd, un: mu[2].toLowerCase().replace(/und|unid/, "un").replace("mt", "m"), unit: unit, valor: tot });
    });
    // descrição limpa: sem o código do produto no começo ("ODOUO069" = 00000069 lido torto), sem NCM/CST/CFOP e sem traços soltos
    var ehCodigo = function (w) { return w.length >= 5 && (w.match(/\d/g) || []).length >= 2 && (w.match(/[\dOoUIl]/g) || []).length / w.length >= 0.8; };
    r.itens.forEach(function (x) {
      var d = String(x.item || "").replace(/[\s\/|;:—–-]*\d{8}(?!\d).*$/, "").replace(/\s[—–*]+(?=\s|$)/g, " ").replace(/\s+/g, " ").trim();
      var w = d.split(" ");
      while (w.length > 1 && ehCodigo(w[0].replace(/\W/g, ""))) w.shift();
      d = w.join(" ").replace(/^[\s—–*;:.,|\/-]+|[\s—–*;:,|\/-]+$/g, "").trim();
      if (palavras(d) >= 1) x.item = d;
    });
    // unitário que faltou e conferência: se a soma dos materiais bate com o total, o valor está certo
    r.itens.forEach(function (x) { if (!x.unit && x.qtd > 0 && x.valor) x.unit = Math.round(x.valor / x.qtd * 100) / 100; });
    var somaIt = r.itens.reduce(function (s2, x) { return s2 + (Number(x.valor) || 0); }, 0);
    if (r.valorIncerto && r.itens.length >= 2 && !r.itens.some(function (x) { return !(Number(x.valor) > 0); }) && Math.abs(somaIt - r.valor) < 0.05) delete r.valorIncerto;   // 1 item só pode ser o próprio “maior valor”
    var semPreco = r.itens.filter(function (x) { return !(Number(x.valor) > 0); }).length;
    if (!r.valor && somaIt && !semPreco) { r.valor = Math.round(somaIt * 100) / 100; r.valorIncerto = true; }
    // total menor que os materiais não existe (a foto pegou outro número, ex.: o ICMS): fica com o valor que mais aparece
    // entre a soma dos materiais e 50% acima (impostos/frete), de preferência o da fatura; e pede para conferir
    // DANFE: o "VALOR TOTAL DOS PRODUTOS" também é piso (o total pode ter desconto, mas não é 1,70 numa nota de 52,30)
    var vProd = 0;
    ls.forEach(function (x, i) {
      if (vProd || !/total\s*dos\s*produtos/i.test(x)) return;
      var v1 = pos(valoresT(x.slice(x.search(/total\s*dos\s*produtos/i))));
      if (!v1.length && ls[i + 1]) v1 = pos(valoresT(ls[i + 1]));
      if (v1.length) vProd = v1[v1.length - 1];
    });
    var piso = Math.max(somaIt, vProd * 0.9);
    // total na mesma linha do rótulo e repetido na nota ("TOTAL 219,68" e "Crédito 2x R$ 219,68"): é ele; o material é que foi lido errado
    var repete = r.valor && valoresT(t).filter(function (v) { return Math.abs(v - r.valor) < 0.005; }).length >= 2;
    if (r.naLinha && repete && !vProd) { piso = 0; r.totalFirme = true; }
    delete r.naLinha;
    if (piso && r.valor && r.valor < piso - 0.05) {
      var base = Math.max(somaIt, vProd), cont = {}, mx = base * 1.5 + 0.05;
      valoresT(t).forEach(function (v) { if (v >= piso - 0.05 && v <= mx) cont[v] = (cont[v] || 0) + 1; });
      var reF = /(?:fatura|parcela|vencimento|duplicata)[^\n]*?valor[^\d\n]{0,12}(\d{1,3}(?:\.\d{3})*,\d{2})(?![\d\/])/gi, mf2;
      while ((mf2 = reF.exec(t))) { var vf = A.lerNumero(mf2[1]); if (vf >= piso - 0.05 && vf <= mx) cont[vf] = (cont[vf] || 0) + 10; }
      var melhorV = Object.keys(cont).map(Number).sort(function (a2, b2) { return cont[b2] - cont[a2] || a2 - b2; })[0];
      r.valor = melhorV || Math.round(base * 100) / 100; r.valorIncerto = true;
    }
    // chave de acesso da NF-e/NFC-e (44 números, pode vir quebrada em grupos ou linhas): só vale se o dígito verificador conferir
    var junto = t.replace(/(\d)[ \t]*\n[ \t]*(\d)/g, "$1 $2"), mc2, reC = /\d[\d .]{42,80}\d/g;
    while (!r.chave && (mc2 = reC.exec(junto))) {
      var dd = mc2[0].replace(/\D/g, "");
      for (var k = 0; k + 44 <= dd.length && !r.chave; k++) if (chaveValida(dd.substr(k, 44))) r.chave = dd.substr(k, 44);
    }
    if (r.chave) {
      // a chave traz o CNPJ da loja e o número da nota (mais confiáveis que a leitura do resto da foto)
      var cj = r.chave.substr(6, 14);
      r.cnpj = cj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
      r.numero = String(Number(r.chave.substr(25, 9)));
    } else {
      var mn = t.match(/\bN(?:[ºo°]|\.|[uú]mero:?)\s*([\d.]{3,15})/i);
      if (mn) r.numero = String(Number(mn[1].replace(/\D/g, "")));
    }
    return r;
  }
  function chaveValida(c) {
    if (!/^\d{44}$/.test(c) || !/^(55|65)$/.test(c.substr(20, 2))) return false;   // modelo 55 (NF-e) ou 65 (NFC-e)
    var soma = 0, peso = 2;
    for (var i = 42; i >= 0; i--) { soma += Number(c[i]) * peso; peso = peso === 9 ? 2 : peso + 1; }
    var resto = soma % 11, dv = resto < 2 ? 0 : 11 - resto;
    return dv === Number(c[43]);
  }
  // nota já lançada? Certa: mesma chave de acesso, ou mesmo número de nota da mesma loja. Provável: mesma loja, valor e data.
  function repetida(x, c0) {
    var outras = P.S.compras.filter(function (c) { return !c0 || c.id !== c0.id; });
    var dg = function (v) { return String(v || "").replace(/\D/g, ""); };
    // nome da loja sem LTDA/ME/EIRELI... ("LIDER TINTAS" = "Lider Tintas LTDA")
    var nm = function (v) { return semAcento(v).replace(/[^a-z0-9]+/g, " ").replace(/\b(ltda|me|epp|eireli|sa|s a|comercio de|com)\b/g, " ").replace(/\s+/g, " ").trim(); };
    var mesmaLoja = function (a, b2) { a = nm(a); b2 = nm(b2); return a === b2 || (a.length >= 5 && b2.length >= 5 && (a.indexOf(b2) >= 0 || b2.indexOf(a) >= 0)); };
    var c1 = x.chave && outras.filter(function (c) { return c.chave === x.chave; })[0];
    if (c1) return { certa: true, c: c1, motivo: "mesma chave de acesso da nota" };
    c1 = x.numero_nota && x.cnpj && outras.filter(function (c) { return c.numero_nota === x.numero_nota && dg(c.cnpj) === dg(x.cnpj); })[0];
    if (c1) return { certa: true, c: c1, motivo: "mesmo número de nota da mesma loja" };
    c1 = x.valor && x.comprado_em && outras.filter(function (c) {
      if (c.comprado_em !== x.comprado_em || Math.abs(Number(c.valor) - Number(x.valor)) >= 0.005) return false;
      return !x.fornecedor || !c.fornecedor || mesmaLoja(c.fornecedor, x.fornecedor) || (x.cnpj && dg(c.cnpj) === dg(x.cnpj));
    })[0];
    return c1 ? { certa: false, c: c1, motivo: "mesma loja, mesmo valor e mesma data" } : null;
  }
  function textoRepetida(rp) {
    return "<b>" + (rp.certa ? "⛔ Esta nota já foi lançada" : "⚠️ Parece repetida") + "</b> (" + esc(rp.motivo) + "): " + esc(rp.c.fornecedor || "loja não informada") + " · " +
      dinheiro(rp.c.valor) + " · " + esc(A.dataSimples(rp.c.comprado_em)) + (rp.certa ? ". Não vou lançar de novo." : ". Se for outra compra igual, toque em salvar de novo.") +
      '<div class="acoes" style="margin-top:6px"><button type="button" class="peq" data-cp-rep="' + esc(rp.c.id) + '">📂 Abrir a nota já lançada</button></div>';
  }
  function categoriaPeloTexto(sa) {
    if (/gasolina|etanol|diesel|combustiv|\bposto\b|ipiranga|petrobras|shell|ale combust/.test(sa)) return "combustivel";
    if (/oficina|pneu|oleo lubrif|troca de oleo|mecanic|auto ?pecas|borracharia|alinhamento|balanceamento/.test(sa)) return "veiculo";
    if (/lanche|lanchonete|restaurante|padaria|refeic|marmit|pizzaria|churrasc/.test(sa)) return "alimentacao";
    if (/pedagio|estacionamento/.test(sa)) return "pedagio";
    return "";
  }
  // área sugerida pelos materiais da nota
  function areaPelosItens(itens, texto) {
    var t = semAcento((itens || []).map(function (x) { return x.item; }).join(" ") + " " + (texto || ""));
    var e = (t.match(/cabo|fio |disjunt|tomada|interrupt|lampad|lumin|eletrodut|conduite|quadro|reator|led|refletor|conector|fita isol/g) || []).length;
    var p = (t.match(/tinta|massa|selador|lixa|rolo|pincel|thinner|aguarras|esmalte|verniz|textura|fita crepe|impermeab|primer|fundo|epox|trincha|demarca/g) || []).length;
    return p > e ? "pintura" : e > p ? "eletrica" : "";
  }


  // ---------------- uma nota: XML (exato), PDF digital (exato) ou foto (OCR, com 2ª leitura da tabela) ----------------
  function somaItens(d) { return (d.itens || []).reduce(function (t, x) { return t + (Number(x.valor) || 0); }, 0); }
  function incompletos(d) { return (d.itens || []).filter(function (x) { return !(Number(x.valor) > 0); }).length; }   // materiais sem preço
  function fecha(d) { return !!(d && d.itens && d.itens.length && !incompletos(d) && d.valor && (!d.valorIncerto || d.itens.length >= 2) && Math.abs(somaItens(d) - d.valor) < 0.05); }
  // total lido da foto menor que a soma dos materiais (ou igual a um item só): fica com a soma e pede conferência
  function corrigeTotal(d) {
    var soma = Math.round(somaItens(d) * 100) / 100;
    if (!soma || (d.itens || []).length < 2 || d.totalFirme || incompletos(d)) return;   // soma sem todos os preços não é o total
    var umItem = d.itens.some(function (x) { return Math.abs((Number(x.valor) || 0) - d.valor) < 0.05; });
    if (!d.valor || d.valorIncerto || umItem || d.valor < soma * 0.95) { d.valor = soma; d.valorIncerto = true; d.valorSoma = true; }
  }
  function lerUmaNota(f, status) {
    return window.AGE_PAG.lerArquivo(f).then(function (r) {
      var d = r.xml ? lerXml(r.texto) : null;
      if (d) return { dados: d, imagem: null, bruto: "" };
      d = lerNota(r.texto);
      if (!/^image\//.test(f.type) || fecha(d)) { if (!fecha(d)) corrigeTotal(d); return { dados: d, imagem: r.imagem || f, bruto: r.texto }; }
      // a soma dos materiais não fecha com o total: lê a tabela de novo de outros jeitos e fica com a leitura que fecha
      var melhor = d, bruto = r.texto, tentativas = [{ psm: "6", endireitar: true }, { psm: "6", cinza: true }, { psm: "4" }, { psm: "3" }];
      return tentativas.reduce(function (pr, op, n) {
        return pr.then(function () {
          if (fecha(melhor)) return;
          if (status) status("🔎 Conferindo os materiais (" + (n + 2) + "ª leitura)...");
          return window.AGE_PAG.lerArquivo(f, Object.assign({ giro: r.giro }, op)).then(function (r2) {
            var d2 = lerNota(r2.texto);
            if (fecha(Object.assign({}, d2, { valor: d.valor || d2.valor })) || d2.itens.length > melhor.itens.length) {
              melhor = Object.assign({}, d2, d, { itens: d2.itens });
              ["data", "fornecedor", "cnpj", "chave", "numero", "forma", "parcelas"].forEach(function (k) { if (!melhor[k] && d2[k]) melhor[k] = d2[k]; });
              if (!melhor.valor) melhor.valor = d2.valor;
              bruto = r.texto + "\n\n----- 2ª leitura -----\n" + r2.texto;
            }
            // total incerto na leitura escolhida, mas achado com rótulo nesta: fica com o desta
            if ((melhor.valorIncerto || !melhor.valor) && d2.valor && !d2.valorIncerto && d2.valor >= Math.max(somaItens(melhor), somaItens(d2)) - 0.05) { melhor = Object.assign({}, melhor, { valor: d2.valor }); delete melhor.valorIncerto; delete melhor.valorSoma; }
          }).catch(function () { /* fica com a 1ª leitura */ });
        });
      }, Promise.resolve()).then(function () {
        if (fecha(melhor)) delete melhor.valorIncerto;
        else corrigeTotal(melhor);
        return { dados: melhor, imagem: r.imagem || f, bruto: bruto };
      });
    });
  }
  // XML da NF-e/NFC-e (vem no e-mail da loja): tudo exato, sem leitura de foto
  function lerXml(txt) {
    var doc;
    try { doc = new DOMParser().parseFromString(txt, "application/xml"); } catch (e) { return null; }
    var inf = doc.getElementsByTagName("infNFe")[0];
    if (!inf) return null;
    var g = function (el, tag) { var x = el && el.getElementsByTagName(tag)[0]; return x ? x.textContent.trim() : ""; };
    var emit = inf.getElementsByTagName("emit")[0], tot = inf.getElementsByTagName("ICMSTot")[0] || inf, cj = g(emit, "CNPJ");
    var tPag = g(inf.getElementsByTagName("pag")[0], "tPag");
    var r = { fornecedor: g(emit, "xFant") || g(emit, "xNome"), cnpj: cj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"),
      data: (g(inf, "dhEmi") || g(inf, "dEmi")).slice(0, 10), valor: Number(g(tot, "vNF")) || null, chave: (inf.getAttribute("Id") || "").replace(/\D/g, "") || null,
      numero: String(Number(g(inf.getElementsByTagName("ide")[0], "nNF"))), forma: { "01": "dinheiro", "03": "cartao", "04": "cartao", "15": "boleto", "17": "pix" }[tPag] || "",
      itens: Array.prototype.map.call(inf.getElementsByTagName("det"), function (dt) {
        return { item: g(dt, "xProd"), qtd: Number(g(dt, "qCom")) || null, un: (g(dt, "uCom") || "un").toLowerCase(), unit: Math.round(Number(g(dt, "vUnCom")) * 100) / 100 || null, valor: Number(g(dt, "vProd")) || null };
      }) };
    var en = emit && emit.getElementsByTagName("enderEmit")[0];
    if (en) r.loja = { razao_social: g(emit, "xNome"), endereco: [g(en, "xLgr"), g(en, "nro")].filter(Boolean).join(", ") + (g(en, "xCpl") ? " - " + g(en, "xCpl") : ""),
      bairro: g(en, "xBairro"), cidade: g(en, "xMun"), uf: g(en, "UF"), cep: g(en, "CEP").replace(/^(\d{5})(\d{3})$/, "$1-$2"), telefone: g(en, "fone"), email: g(emit, "email") };
    if (r.forma === "boleto") r.pago = false;
    var cartao = inf.getElementsByTagName("dup").length;
    if (r.forma === "cartao" && cartao > 1) r.parcelas = cartao;
    r.categoria = categoriaPeloTexto(semAcento(r.fornecedor + " " + r.itens.map(function (x) { return x.item; }).join(" ")));
    return r;
  }

  // loja da nota pelo CNPJ: a já guardada (nome certo, mesmo com a foto ruim) ou o cadastro público do CNPJ
  function completarLoja(d) {
    if (!d || !d.cnpj || !window.AGE_FORN) return Promise.resolve(d);
    var F = window.AGE_FORN, f = F.achar(P.S, d.cnpj, null);
    var junta = function (base) { d.loja = Object.assign({}, base, d.loja || {}, { cnpj: d.cnpj }); Object.keys(base).forEach(function (k) { if (base[k] && !d.loja[k]) d.loja[k] = base[k]; }); };
    if (f) { d.fornecedor = f.nome; junta(f); return Promise.resolve(d); }
    var ant = P.S.compras.filter(function (x) { return x.cnpj && x.cnpj.replace(/\D/g, "") === d.cnpj.replace(/\D/g, "") && x.fornecedor; })[0];
    return F.consultar(d.cnpj).then(function (c) {
      if (c) { d.fornecedor = ant ? ant.fornecedor : c.nome; junta(c); }
      else if (ant) d.fornecedor = ant.fornecedor;
      return d;
    });
  }

  // ---------------- receber notas (Compartilhar, arquivos) ----------------
  function receber(rc, ctx) {
    P = ctx;
    if (P.S.semCompras) { A.avisar("Rode de novo o supabase.sql no Supabase para usar as compras.", "erro"); return; }
    var fila = (rc.arquivos || []).slice(0, 10);
    if (!fila.length) { var dt = rc.texto ? lerNota(rc.texto) : {}; completarLoja(dt).then(function () { formulario({ texto: dt, bruto: rc.texto || "", tipo: rc.tipo }); }); return; }
    var j = A.janela('<div class="peq" id="cn-st">📖 Lendo a nota... (a 1ª vez demora um pouco)</div>', { titulo: "🧾 Nota" });
    var lidas = [];
    fila.reduce(function (pr, f, i) {
      return pr.then(function () {
        $("#cn-st", j.el).textContent = "📖 Lendo a nota " + (i + 1) + " de " + fila.length + "...";
        return lerUmaNota(f, function (t) { $("#cn-st", j.el).textContent = t; }).then(function (x) {
          $("#cn-st", j.el).textContent = "🏪 Conferindo os dados da loja...";
          return completarLoja(x.dados).then(function () { lidas.push(x); });
        },
          function () { lidas.push({ dados: {}, imagem: /^image\//.test(f.type) ? f : null, erro: true }); });
      });
    }, Promise.resolve()).then(function () {
      j.fechar();
      var proxima = function () { var x = lidas.shift(); if (x) formulario({ texto: x.dados, imagem: x.imagem, bruto: x.bruto, erro: x.erro, tipo: rc.tipo, depois: proxima, falta: lidas.length }); };
      proxima();
    });
  }

  // ---------------- formulário (nova ou editar) ----------------
  function rotuloObra(o) { return o.cliente + (o.chamado ? " · chamado " + o.chamado : ""); }
  function obraPorRotulo(t) { t = String(t || "").trim(); return P.S.obras.filter(function (o) { return rotuloObra(o) === t; })[0] || null; }
  // materiais já comprados: o último preço pago (de preferência na mesma loja) e a unidade
  function materiaisComprados(loja) {
    var nm = function (v) { return semAcento(v).replace(/[^a-z0-9]+/g, " ").trim(); }, l = nm(loja), m = {};
    P.S.compras.slice().sort(function (a, b) { return String(a.comprado_em).localeCompare(String(b.comprado_em)); }).forEach(function (c) {
      (c.itens || []).forEach(function (x) {
        var k = nm(x.item), unit = Number(x.unit) || (Number(x.qtd) > 0 && Number(x.valor) > 0 ? Math.round(x.valor / x.qtd * 100) / 100 : 0);
        if (!k || !(unit > 0)) return;
        var y = { item: String(x.item).trim(), un: x.un || "un", unit: unit, data: c.comprado_em, loja: c.fornecedor || "" };
        // a compra mais nova vale; a da mesma loja vale mais que a de outra
        if (!m[k] || !l || nm(c.fornecedor) === l || nm(m[k].loja) !== l) m[k] = y;
      });
    });
    return m;
  }
  // rascunho do lançamento à mão: guardado neste aparelho enquanto você digita (internet caiu, janela fechou...)
  var CHAVE_RASC = "age_rascunho_compra";
  function lerRascunho() { try { var r = JSON.parse(localStorage.getItem(CHAVE_RASC) || "null"); return r && Date.now() - r.em < 14 * 864e5 ? r : null; } catch (e) { return null; } }
  function apagarRascunho() { try { localStorage.removeItem(CHAVE_RASC); } catch (e) { /* sem armazenamento */ } }

  function formulario(op) {
    var c0 = op.compra || null, d = op.texto || {};
    var aMao = !c0 && !op.imagem && !op.texto, rasc = aMao ? lerRascunho() : null;
    if (!c0 && d.cnpj && !d.loja) {   // loja já conhecida pelo CNPJ da nota
      var dg = d.cnpj.replace(/\D/g, ""), ant = P.S.compras.filter(function (x) { return x.cnpj && x.cnpj.replace(/\D/g, "") === dg && x.fornecedor; })[0];
      if (ant) d.fornecedor = ant.fornecedor;
    }
    var F = window.AGE_FORN;
    // sem CNPJ lido (foto ruim), mas o nome é de uma loja já guardada: usa o nome e os dados dela
    var fNome = !c0 && F && !d.cnpj && d.fornecedor ? F.achar(P.S, null, d.fornecedor) : null;
    // loja não reconhecida, mas o nome de uma loja já usada aparece no texto da foto (cabeçalho impresso, mesmo quebrado: "DO BRAGA")
    if (!c0 && !d.fornecedor && !d.cnpj && op.bruto) {
      var txtN = " " + semAcento(op.bruto).replace(/[^a-z0-9]+/g, " ") + " ", GEN = /^(comercial|comercio|deposito|materiais|material|construcao|ltda|casa|loja|tintas|ferragens|distribuidora|eletrica|eletricos|center|home)$/;
      var nomes = {}; P.S.compras.forEach(function (x) { if (x.fornecedor) nomes[x.fornecedor] = 1; }); (P.S.forn || []).forEach(function (x) { nomes[x.nome] = 1; });
      var achadoN = Object.keys(nomes).filter(function (n) {
        var w = semAcento(n).replace(/[^a-z0-9]+/g, " ").split(" ").filter(function (p) { return p.length >= 4 && !GEN.test(p); });
        return w.length && w.every(function (p) { return txtN.indexOf(" " + p + " ") >= 0; });
      })[0];
      if (achadoN) { d.fornecedor = achadoN; fNome = F ? F.achar(P.S, null, achadoN) : null; }
    }
    if (fNome) { d.fornecedor = fNome.nome; d.loja = Object.assign({}, fNome, d.loja || {}); if (fNome.cnpj) d.cnpj = F.fmtCnpj(fNome.cnpj); }
    var loja0 = c0 ? Object.assign({}, F ? F.achar(P.S, c0.cnpj, c0.fornecedor) : null, c0.cnpj ? { cnpj: c0.cnpj } : {}) : Object.assign({}, d.loja || {}, d.cnpj ? { cnpj: d.cnpj } : {});
    var lojasCompra = {}; P.S.compras.forEach(function (x) { if (x.fornecedor) lojasCompra[x.fornecedor] = 1; }); (P.S.forn || []).forEach(function (x) { lojasCompra[x.nome] = 1; });
    var it = c0 ? (c0.itens || []).map(function (x) { return Object.assign({}, x); }) : (d.itens || []).map(function (x) { return Object.assign({}, x); });
    var areaSug = areaPelosItens(it, op.bruto);
    // despesa avulsa: escolhida na parte "Despesas", ou nota de posto/oficina/lanchonete sem material de obra
    var tipo = c0 ? (c0.tipo || "material") : op.tipo || (d.categoria && !areaSug ? "despesa" : "material");
    var area = c0 ? c0.area : tipo === "despesa" ? "geral" : (areaSug || "eletrica");
    var cat = c0 ? c0.categoria || "outros" : d.categoria || "outros";
    var obra = c0 && c0.obra_id ? P.porId(P.S.obras, c0.obra_id) : null;
    var obras = P.S.obras.slice().sort(function (a, b) { return String(b.criado_em).localeCompare(String(a.criado_em)); }).slice(0, 400);
    var veics = (P.S.veic || []).filter(function (v) { return v.ativo !== false; });
    var j = A.janela(
      (rasc ? '<div class="aviso" id="cn-rasc">📝 Você tem um lançamento <b>não salvo</b> de ' + esc(A.dataHora(new Date(rasc.em))) +
        (rasc.campos["cn-forn"] ? " · " + esc(rasc.campos["cn-forn"]) : "") + " · " + (rasc.it || []).filter(function (x) { return x.item; }).length + " material(is)" +
        '<div class="peq">Escolha antes de digitar: enquanto este aviso estiver aqui, o que você digitar agora não fica guardado.</div><div class="acoes" style="margin-top:6px"><button class="prim peq" id="cn-rasc-ok">↩️ Continuar de onde parei</button><button class="peq" id="cn-rasc-x">Descartar</button></div></div>' : "") +
      (op.imagem ? '<img alt="Nota" src="' + URL.createObjectURL(op.imagem) + '" style="max-height:160px;max-width:100%;display:block;margin-bottom:6px;border-radius:6px">' : "") +
      (op.erro ? '<div class="aviso erro">Não consegui ler a nota. Preencha à mão.</div>' : "") +
      (!c0 && op.imagem && !op.erro && !d.valor && !(d.itens || []).length ? '<div class="aviso">✍️ Parece nota <b>escrita à mão</b> (ou foto ilegível): o app só lê texto impresso. Preencha a data, o valor e os materiais à mão — a foto fica guardada junto.</div>' : "") +
      (!op.erro && op.imagem && (d.valorIncerto || !d.valor) ? '<div class="aviso">⚠️ ' + (d.valorSoma ? "O “TOTAL” da foto não bateu com os materiais: usei a <b>soma dos materiais</b>. <b>Confira o valor total</b> antes de salvar." : "Não achei o “TOTAL” com clareza na foto: <b>confira o valor total</b> antes de salvar.") + '</div>' : "") +
      (function () {
        var rp0 = !c0 && repetida({ chave: d.chave, numero_nota: d.numero, cnpj: d.cnpj, fornecedor: d.fornecedor, comprado_em: d.data, valor: d.valor }, null);
        return rp0 ? '<div class="aviso erro" id="cn-rep0">' + textoRepetida(rp0) + "</div>" : "";
      })() +
      (!c0 && op.imagem && !op.erro && d.semData ? '<div class="aviso">⚠️ Não achei a <b>data da compra</b> na foto: confira a data antes de salvar.</div>' : "") +
      (!c0 && d.dataCorrigida ? '<div class="aviso">⚠️ O ano da data saiu errado na foto (ex.: 2020): usei o ano atual. <b>Confira a data</b>.</div>' : "") +
      (op.falta ? '<div class="peq mudo">Depois desta: mais ' + op.falta + " nota" + (op.falta > 1 ? "s" : "") + ".</div>" : "") +
      (op.bruto ? '<details class="peq" style="margin:4px 0"><summary>🔍 ver o texto que o app leu da foto</summary><pre style="white-space:pre-wrap;max-height:220px;overflow:auto;font-size:11px">' + esc(String(op.bruto).slice(0, 6000)) + "</pre></details>" : "") +
      '<div class="filtros" id="cn-tipos"><button type="button" data-tipo="material">🧱 Material de obra</button><button type="button" data-tipo="despesa">⛽ Despesa avulsa</button></div>' +
      '<label for="cn-forn">Onde comprou (loja / posto / fornecedor)</label><input id="cn-forn" list="cn-dl-forn" maxlength="120" placeholder="Ex.: Leroy Merlin, Posto Ipiranga...">' +
      '<datalist id="cn-dl-forn">' + Object.keys(lojasCompra).sort().map(function (f) { return '<option value="' + esc(f) + '">'; }).join("") + "</datalist>" +
      (F && !P.S.semForn ? F.htmlCampos(loja0) : "") +
      '<div class="duas"><div><label for="cn-data">Data da compra</label><input type="date" id="cn-data"></div>' +
      '<div><label for="cn-valor">Valor total (R$)</label><input id="cn-valor" inputmode="decimal" placeholder="soma dos itens, se vazio"></div></div>' +
      '<div class="duas"><div><label for="cn-forma">Pagamento</label><select id="cn-forma">' + Object.keys(FORMAS).map(function (k) { return '<option value="' + k + '">' + FORMAS[k] + "</option>"; }).join("") + "</select></div>" +
      '<div><label class="marca-linha" style="margin-top:28px"><input type="checkbox" id="cn-pago"> ✔ Já pago</label></div></div>' +
      '<div id="cn-venc-c" class="oculto"><label for="cn-venc">Vencimento (a pagar)</label><input type="date" id="cn-venc"></div>' +
      '<div id="cn-desp" class="oculto"><label for="cn-cat">Tipo de despesa</label><select id="cn-cat">' + Object.keys(CATS).map(function (k) { return '<option value="' + k + '">' + CATS[k] + "</option>"; }).join("") + "</select>" +
      (veics.length ? '<label for="cn-veic">Veículo</label><select id="cn-veic"><option value="">—</option>' + veics.map(function (v) { return '<option value="' + v.id + '">' + esc(v.placa + (v.modelo ? " · " + v.modelo : "")) + "</option>"; }).join("") + "</select>" : "") + "</div>" +
      "<label>Área</label><div class=\"filtros\" id=\"cn-areas\"></div>" +
      '<label for="cn-dest">Para onde foi (obra / loja / cliente)</label><input id="cn-dest" list="cn-dl-obras" maxlength="200" placeholder="Digite a loja, o cliente (ex.: DEVA) ou o nº do chamado">' +
      '<datalist id="cn-dl-obras">' + obras.map(function (o) { return '<option value="' + esc(rotuloObra(o)) + '">'; }).join("") + "</datalist>" +
      '<div id="cn-mat"><label for="cn-tipo">Tipo de serviço</label><input id="cn-tipo" list="cn-dl-tipos" maxlength="200"><datalist id="cn-dl-tipos"></datalist>' +
      '<label>Materiais</label><datalist id="cn-dl-mat"></datalist><div id="cn-itens"></div><button class="peq" type="button" id="cn-mais">+ Material</button> <span class="peq mudo" id="cn-soma"></span></div>' +
      '<label for="cn-obs">Observação</label><input id="cn-obs" maxlength="300" placeholder="Ex.: gasolina da semana, troca de óleo, lanche da equipe">' +
      '<div id="cn-erro"></div><div class="acoes"><button class="prim" id="cn-salvar">Salvar</button>' + (c0 ? '<button class="perigo" id="cn-apagar">Apagar</button>' : "") +
      (op.depois && op.falta ? '<button id="cn-pular">Pular esta</button>' : "") + "</div>",
      { titulo: c0 ? "🧾 Compra / despesa" : "🧾 Nova compra / despesa", larga: true, fixa: true });
    var el = j.el;
    // nota repetida: abre a que já está lançada (e a lista passa a mostrar o mês dela) para comparar os valores
    el.addEventListener("click", function (ev) {
      var bt = ev.target.closest("[data-cp-rep]"); if (!bt) return;
      var c = P.porId(P.S.compras, bt.dataset.cpRep); if (!c) return;
      j.fechar();
      filtro.periodo = "datas"; filtro.de = String(c.comprado_em).slice(0, 8) + "01"; filtro.ate = ""; filtro.tipo = ""; filtro.area = "";
      if (location.hash !== "#compras") location.hash = "#compras"; else P.rota();
      formulario({ compra: c });
    });
    $("#cn-data", el).value = c0 ? c0.comprado_em : d.data || A.isoLocal(new Date());
    $("#cn-valor", el).value = num2(c0 ? c0.valor : d.valor);
    $("#cn-forn", el).value = c0 ? c0.fornecedor || "" : d.fornecedor || "";
    $("#cn-dest", el).value = obra ? rotuloObra(obra) : c0 ? c0.destino || "" : "";
    $("#cn-tipo", el).value = c0 ? c0.tipo_servico || "" : "";
    $("#cn-obs", el).value = c0 ? c0.descricao || "" : d.parcelas > 1 ? "Cartão em " + d.parcelas + "x" : "";
    $("#cn-forma", el).value = c0 ? c0.forma_pagamento || "outro" : d.forma || "pix";
    $("#cn-pago", el).checked = c0 ? c0.pago !== false : d.pago !== false;
    $("#cn-venc", el).value = c0 && c0.vencimento ? c0.vencimento : "";
    $("#cn-cat", el).value = cat;
    if (F && $("#fo-dados", el)) {
      F.ligarCampos(el, $("#cn-forn", el));
      // escolheu uma loja já guardada: completa os dados dela
      $("#cn-forn", el).addEventListener("change", function () { var f = F.achar(P.S, null, this.value); if (f) F.preencher(el, f, true); });
    }
    if ($("#cn-veic", el) && c0) $("#cn-veic", el).value = c0.veiculo_id || "";
    function verPago() { $("#cn-venc-c", el).classList.toggle("oculto", $("#cn-pago", el).checked); }
    $("#cn-pago", el).onchange = verPago;
    $("#cn-forma", el).onchange = function () { if (this.value === "boleto") { $("#cn-pago", el).checked = false; verPago(); } };
    verPago();
    function marcarTipo() {
      $$("[data-tipo]", el).forEach(function (b) { b.className = b.dataset.tipo === tipo ? "prim" : ""; });
      $("#cn-desp", el).classList.toggle("oculto", tipo !== "despesa");
      $("#cn-mat", el).classList.toggle("oculto", tipo === "despesa");
      var ops = tipo === "despesa" ? AREAS_D : AREAS;
      if (!ops[area]) area = tipo === "despesa" ? "geral" : (areaSug || "eletrica");
      $("#cn-areas", el).innerHTML = Object.keys(ops).map(function (k) { return '<button type="button" data-area="' + k + '">' + ops[k] + "</button>"; }).join("");
      $$("[data-area]", el).forEach(function (b) { b.onclick = function () { area = b.dataset.area; marcarArea(); }; });
      marcarArea();
    }
    $$("[data-tipo]", el).forEach(function (b) { b.onclick = function () { tipo = b.dataset.tipo; marcarTipo(); }; });
    function marcarArea() {
      $$("[data-area]", el).forEach(function (b) { b.className = b.dataset.area === area ? "prim" : ""; });
      var tipos = area === "dividir" || area === "geral" ? TIPOS.eletrica.concat(TIPOS.pintura) : TIPOS[area];
      $("#cn-dl-tipos", el).innerHTML = tipos.map(function (t) { return '<option value="' + esc(t) + '">'; }).join("");
      desenharItens();
    }
    function listaMateriais() {
      var m = materiaisComprados($("#cn-forn", el).value);
      $("#cn-dl-mat", el).innerHTML = Object.keys(m).sort().slice(0, 600).map(function (k) {
        var y = m[k]; return '<option value="' + esc(y.item) + '">' + esc(y.un + " · " + dinheiro(y.unit) + (y.loja ? " · " + y.loja : "")) + "</option>";
      }).join("");
    }
    function desenharItens() {
      listaMateriais();
      $("#cn-itens", el).innerHTML = it.map(function (x, i) {
        return '<div class="linha" style="gap:4px;flex-wrap:wrap;margin:3px 0" data-li="' + i + '">' +
          '<input data-c="item" list="cn-dl-mat" placeholder="Material" value="' + esc(x.item || "") + '" style="flex:3 1 160px">' +
          '<input data-c="qtd" inputmode="decimal" placeholder="Qtd" value="' + esc(x.qtd ? A.numero(x.qtd) : "") + '" style="flex:0 1 60px">' +
          '<select data-c="un" style="flex:0 1 70px">' + UN.map(function (u) { return '<option' + ((x.un || "un") === u ? " selected" : "") + ">" + u + "</option>"; }).join("") + "</select>" +
          '<input data-c="unit" inputmode="decimal" placeholder="Unit. R$" title="Valor unitário" value="' + esc(num2(x.unit)) + '" style="flex:0 1 80px">' +
          '<input data-c="valor" inputmode="decimal" placeholder="Total R$" title="Valor total do item" value="' + esc(num2(x.valor)) + '" style="flex:0 1 85px">' +
          (area === "dividir" ? '<select data-c="area" style="flex:0 1 110px"><option value="eletrica"' + (x.area !== "pintura" ? " selected" : "") + '>⚡ Elétrica</option><option value="pintura"' + (x.area === "pintura" ? " selected" : "") + ">🖌️ Pintura</option></select>" : "") +
          '<button class="peq" type="button" data-rm="' + i + '">✕</button></div>';
      }).join("");
      $$("[data-li]", el).forEach(function (l) {
        var x = it[Number(l.dataset.li)];
        $$("[data-c]", l).forEach(function (inp) {
          inp.oninput = inp.onchange = function () {
            var k = inp.dataset.c;
            x[k] = k === "qtd" || k === "valor" || k === "unit" ? A.lerNumero(inp.value) : inp.value;
            // material já comprado antes: a unidade e o último preço pago entram sozinhos (se o preço ainda está vazio)
            if (k === "item" && !(x.unit > 0) && !(x.valor > 0)) {
              var ant = materiaisComprados($("#cn-forn", el).value)[semAcento(inp.value).replace(/[^a-z0-9]+/g, " ").trim()];
              if (ant) {
                x.un = ant.un; x.unit = ant.unit;
                var su = $('[data-c="un"]', l);
                if (su && !Array.prototype.some.call(su.options, function (o) { return o.value === ant.un; })) su.insertAdjacentHTML("beforeend", "<option>" + esc(ant.un) + "</option>");
                if (su) su.value = ant.un;
                $('[data-c="unit"]', l).value = num2(ant.unit);
                if (x.qtd > 0) { x.valor = Math.round(x.qtd * x.unit * 100) / 100; $('[data-c="valor"]', l).value = num2(x.valor); }
                inp.title = "Último preço: " + dinheiro(ant.unit) + " em " + A.dataSimples(ant.data) + (ant.loja ? " (" + ant.loja + ")" : "");
              }
            }
            // quantidade × unitário = total (e o unitário sai do total, se for ele que você digitou)
            if ((k === "qtd" || k === "unit") && x.qtd > 0 && x.unit > 0) { x.valor = Math.round(x.qtd * x.unit * 100) / 100; $('[data-c="valor"]', l).value = num2(x.valor); }
            else if (k === "valor" && x.qtd > 0 && x.valor > 0) { x.unit = Math.round(x.valor / x.qtd * 100) / 100; $('[data-c="unit"]', l).value = num2(x.unit); }
            somar();
          };
        });
      });
      $$("[data-rm]", el).forEach(function (b) { b.onclick = function () { it.splice(Number(b.dataset.rm), 1); desenharItens(); }; });
      somar();
    }
    function somar() {
      var s = it.reduce(function (t, x) { return t + (Number(x.valor) || 0); }, 0);
      // a soma não bate com o total da nota: algum material foi lido errado (ou faltou) — avisa em vermelho
      var tv = A.lerNumero($("#cn-valor", el).value), dif = s && tv > 0 && Math.abs(s - tv) >= 0.05;
      var falta = it.filter(function (x) { return String(x.item || "").trim() && !(Number(x.valor) > 0); }).length;
      $("#cn-soma", el).innerHTML = s ? "Soma dos materiais: " + dinheiro(s) +
        (falta ? ' <span class="selo atencao">falta o preço de ' + falta + (falta === 1 ? " material" : " materiais") + "</span>" : "") +
        (dif ? ' <span class="selo critico">≠ total ' + dinheiro(tv) + ": confira quantidades e valores</span>" : tv > 0 && !falta ? ' <span class="selo bom">✔ bate com o total</span>' : "") : "";
    }
    $("#cn-valor", el).addEventListener("input", somar);
    $("#cn-mais", el).onclick = function () { it.push({ un: "un", area: area === "pintura" ? "pintura" : "eletrica" }); desenharItens(); };
    if (!it.length) it.push({ un: "un" });
    marcarTipo();
    $("#cn-forn", el).addEventListener("change", listaMateriais);
    var CAMPOS = ["cn-forn", "cn-data", "cn-valor", "cn-forma", "cn-pago", "cn-venc", "cn-cat", "cn-dest", "cn-tipo", "cn-obs"];
    if (aMao) {
      var guardar = function () {
        if ($("#cn-rasc", el)) return;   // ainda não escolheu continuar/descartar o rascunho antigo: não apaga ele
        var campos = {};
        CAMPOS.forEach(function (id) { var e = $("#" + id, el); if (e) campos[id] = e.type === "checkbox" ? e.checked : e.value; });
        var temAlgo = campos["cn-forn"] || campos["cn-valor"] || campos["cn-obs"] || it.some(function (x) { return x.item || x.valor; });
        try { if (temAlgo) localStorage.setItem(CHAVE_RASC, JSON.stringify({ em: Date.now(), tipo: tipo, area: area, it: it, campos: campos })); } catch (e) { /* sem armazenamento */ }
      };
      el.addEventListener("input", guardar); el.addEventListener("change", guardar); el.addEventListener("click", function (ev) { if (ev.target.closest("[data-tipo],[data-area],[data-rm],#cn-mais")) setTimeout(guardar, 0); });
    }
    if (rasc) {
      $("#cn-rasc-ok", el).onclick = function () {
        CAMPOS.forEach(function (id) { var e = $("#" + id, el); if (e && rasc.campos[id] !== undefined) { if (e.type === "checkbox") e.checked = !!rasc.campos[id]; else e.value = rasc.campos[id]; } });
        verPago(); tipo = rasc.tipo || tipo; area = rasc.area || area;
        it = (rasc.it || []).map(function (x) { return Object.assign({}, x); }); if (!it.length) it.push({ un: "un" });
        marcarTipo(); $("#cn-rasc", el).remove(); A.avisar("↩️ Lançamento recuperado", "ok");
      };
      $("#cn-rasc-x", el).onclick = function () { if (!A.confirmar("Descartar o lançamento não salvo?")) return; apagarRascunho(); $("#cn-rasc", el).remove(); };
    }
    if ($("#cn-pular", el)) $("#cn-pular", el).onclick = function () { j.fechar(); op.depois(); };
    if ($("#cn-apagar", el)) $("#cn-apagar", el).onclick = function () {
      if (!A.confirmar("Apagar este lançamento?")) return;
      P.q(P.sb.from("compras").delete().eq("id", c0.id)).then(function () { P.tirar(P.S.compras, c0.id); j.fechar(); P.rota(); }).catch(P.falhou);
    };
    $("#cn-salvar", el).onclick = function () {
      var b = this, itens = tipo === "despesa" ? [] : it.filter(function (x) { return String(x.item || "").trim(); }).map(function (x) {
        var y = { item: String(x.item).trim(), qtd: Number(x.qtd) || null, un: x.un || "un", unit: Number(x.unit) || (x.qtd > 0 && x.valor ? Math.round(x.valor / x.qtd * 100) / 100 : null), valor: Number(x.valor) || null };
        if (area === "dividir") y.area = x.area === "pintura" ? "pintura" : "eletrica";
        return y;
      });
      var soma = itens.reduce(function (t, x) { return t + (x.valor || 0); }, 0), valor = A.lerNumero($("#cn-valor", el).value) || soma;
      var pago = $("#cn-pago", el).checked;
      var erro = !(valor > 0) ? "Informe o valor total" + (tipo === "despesa" ? "." : " (ou o valor dos materiais).") : !$("#cn-data", el).value ? "Informe a data." :
        area === "dividir" && !itens.some(function (x) { return x.valor; }) ? "Para dividir entre elétrica e pintura, informe o valor de cada material." : "";
      if (erro) { $("#cn-erro", el).innerHTML = '<div class="aviso erro">' + erro + "</div>"; return; }
      var ob = obraPorRotulo($("#cn-dest", el).value);
      var dados = { comprado_em: $("#cn-data", el).value, valor: valor, fornecedor: $("#cn-forn", el).value.trim() || null, area: area, tipo: tipo,
        categoria: tipo === "despesa" ? $("#cn-cat", el).value : null, veiculo_id: tipo === "despesa" && $("#cn-veic", el) ? $("#cn-veic", el).value || null : null,
        obra_id: ob ? ob.id : null, destino: ob ? null : ($("#cn-dest", el).value.trim() || null), tipo_servico: tipo === "despesa" ? null : $("#cn-tipo", el).value.trim() || null,
        itens: itens, descricao: $("#cn-obs", el).value.trim() || null, forma_pagamento: $("#cn-forma", el).value, pago: pago,
        vencimento: pago ? null : $("#cn-venc", el).value || null };
      var loja = F && $("#fo-dados", el) ? F.lerCampos(el) : null;
      if (loja && loja.cnpj) dados.cnpj = F.fmtCnpj(loja.cnpj);
      else if (!c0 && d.cnpj) dados.cnpj = d.cnpj;
      if (!c0 && d.chave) dados.chave = d.chave;
      if (!c0 && d.numero) dados.numero_nota = d.numero;
      // não lança nota repetida (a "provável" passa se você confirmar tocando em salvar de novo)
      var rp = repetida(c0 ? Object.assign({}, c0, dados) : dados, c0);
      if (rp && (rp.certa || b.dataset.confirmou !== "1")) {
        $("#cn-erro", el).innerHTML = '<div class="aviso erro">' + textoRepetida(rp) + "</div>";
        if (!rp.certa) { b.dataset.confirmou = "1"; b.textContent = "Salvar mesmo assim (não é repetida)"; }
        return;
      }
      A.ocupado(b, true, "Salvando...");
      var pNota = !op.imagem ? Promise.resolve(null) : A.prepararFoto(op.imagem, [], 1600).then(function (bl) {
        var cam = "admin/compras/" + dados.comprado_em + "-" + A.uuid() + ".jpg";
        return P.q(P.sb.storage.from("fotos").upload(cam, bl, { contentType: "image/jpeg" })).then(function () { return cam; });
      }).catch(function () { return null; });   // sem a foto, o lançamento ainda é salvo
      pNota.then(function (cam) {
        if (cam) dados.nota = cam;
        return P.q(c0 ? P.sb.from("compras").update(dados).eq("id", c0.id).select().single() : P.sb.from("compras").insert(dados).select().single());
      }).then(function (n) {
        // guarda os dados da loja (CNPJ, telefone, WhatsApp, e-mail, endereço) para as próximas notas
        return loja && n.fornecedor ? F.salvar(P, loja, n.fornecedor).then(function () { return n; }) : n;
      }).then(function (n) {
        // marcou "Já pago" numa nota que estava a pagar: registra a data da quitação
        return c0 && c0.pago === false && n.pago ? quitar(n.id, P).catch(function () { return n; }) : n;
      }).then(function (n) {
        P.trocar(P.S.compras, n); j.fechar();
        if (aMao) apagarRascunho();
        // nota de outro mês: o filtro passa a mostrar desde a data dela (senão parece que não salvou)
        var pr = periodo();
        if (filtro.tipo !== "apagar" && (n.comprado_em < pr.de || n.comprado_em >= pr.ate)) { filtro.periodo = "datas"; filtro.de = n.comprado_em.slice(0, 8) + "01"; filtro.ate = ""; }
        A.avisar("🧾 Salvo: " + (n.fornecedor ? n.fornecedor + " · " : "") + dinheiro(n.valor) + " (" + A.dataSimples(n.comprado_em) + ")", "ok");
        if (location.hash !== "#compras") location.hash = "#compras"; else P.rota();
        if (op.depois) op.depois();
      }).catch(function (e) { A.ocupado(b, false); $("#cn-erro", el).innerHTML = '<div class="aviso erro">' + esc(A.msgErro(e)) + "</div>"; });
    };
  }

  // ---------------- totais e lista ----------------
  // quanto de um lançamento é de cada área (dividido: pelos materiais; o que sobra do total vai para a maior)
  function porArea(c) {
    var r = { eletrica: 0, pintura: 0, geral: 0 }, v = Number(c.valor) || 0;
    if (c.area !== "dividir") { r[r.hasOwnProperty(c.area) ? c.area : "eletrica"] = v; return r; }
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
  function destinoDe(c) { var o = c.obra_id ? P.porId(P.S.obras, c.obra_id) : null; return o ? rotuloObra(o) : c.destino || (ehDespesa(c) ? "—" : "Estoque / sem destino"); }
  function lojaDe(c) { return c.fornecedor || "Loja não informada"; }
  function veicDe(c) { var v = c.veiculo_id ? P.porId(P.S.veic || [], c.veiculo_id) : null; return v ? v.placa + (v.modelo ? " · " + v.modelo : "") : ""; }
  function lista() {
    var pr = periodo(), b = semAcento(filtro.busca);
    return P.S.compras.filter(function (c) {
      // a pagar aparece em qualquer período (o que importa é não esquecer de pagar)
      if (filtro.tipo === "apagar") { if (c.pago !== false) return false; }
      else {
        if (c.comprado_em < pr.de || c.comprado_em >= pr.ate) return false;
        if (filtro.tipo === "material" && ehDespesa(c)) return false;
        if (filtro.tipo === "despesa" && !ehDespesa(c)) return false;
      }
      if (filtro.area && !(porArea(c)[filtro.area] > 0)) return false;
      if (b && semAcento([c.fornecedor, destinoDe(c), c.tipo_servico, c.descricao, CATS[c.categoria], veicDe(c), (c.itens || []).map(function (x) { return x.item; }).join(" ")].join(" ")).indexOf(b) < 0) return false;
      return true;
    }).sort(function (a, b2) { return b2.comprado_em.localeCompare(a.comprado_em) || String(b2.criado_em).localeCompare(String(a.criado_em)); });
  }
  function totais(cs) {
    var t = { eletrica: 0, pintura: 0, despesas: 0, aPagar: 0, total: 0 };
    cs.forEach(function (c) {
      var v = Number(c.valor) || 0;
      t.total += v;
      if (c.pago === false) t.aPagar += v;
      if (ehDespesa(c)) { t.despesas += v; return; }
      var r = porArea(c); t.eletrica += r.eletrica; t.pintura += r.pintura;
    });
    return t;
  }
  // agrupa pelo nome sem diferença de maiúscula/acento ("CASA DO ELETRICISTA" = "Casa do Eletricista")
  function agrupar(cs, chave) {
    var g = {};
    cs.forEach(function (c) {
      var nome = chave(c), k = semAcento(nome).replace(/[^a-z0-9]+/g, " ").replace(/\b(ltda|me|epp|eireli|sa|s a)\b/g, " ").replace(/\s+/g, " ").trim();
      g[k] = g[k] || { nome: nome, n: 0, total: 0, aPagar: 0, venc: "", datas: [] }; g[k].n++; g[k].total += Number(c.valor) || 0;
      if (c.comprado_em && g[k].datas.indexOf(c.comprado_em) < 0) g[k].datas.push(c.comprado_em);
      if (c.pago === false) { g[k].aPagar += Number(c.valor) || 0; if (c.vencimento && (!g[k].venc || c.vencimento < g[k].venc)) g[k].venc = c.vencimento; } });
    return Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.total - a.total; });
  }

  // datas das compras (as da nota): "19/10/2026" ou "19/10, 22/10 e 25/10/2026"
  function textoDatas(ds) {
    ds = ds.slice().sort();
    if (!ds.length) return "—";
    if (ds.length === 1) return A.dataSimples(ds[0]);
    var mesmoAno = ds.every(function (x) { return x.slice(0, 4) === ds[0].slice(0, 4); });
    var curta = function (x, ult) { return mesmoAno && !ult ? A.dataSimples(x).slice(0, 5) : A.dataSimples(x); };
    var vis = ds.length > 4 ? ds.slice(0, 2).concat(ds.slice(-1)) : ds;
    return vis.map(function (x, i) { return curta(x, i === vis.length - 1); }).join(ds.length > 4 ? " … " : ", ").replace(/, ([^,]*)$/, " e $1");
  }
  function ver(c, ctx) {
    P = ctx;
    if (P.S.semCompras) {
      c.innerHTML = '<div class="cab-secao"><h2>🧾 Compras</h2></div><div class="aviso">Para usar esta área, rode de novo o arquivo <b>supabase.sql</b> no Supabase ' +
        "(SQL Editor → colar tudo → Run) e depois <code>notify pgrst, 'reload schema';</code> Ele cria a tabela de compras sem apagar nada. Depois toque em ↻." +
        (P.S.erroCompras ? '<div class="peq mudo" style="margin-top:6px">Erro do banco: ' + esc(P.S.erroCompras) + "</div>" : "") + "</div>";
      return;
    }
    var desp = filtro.tipo === "despesa";
    c.innerHTML = '<div class="cab-secao"><h2>🧾 Compras e despesas</h2><span><button class="prim" id="cp-nota">📷 Nota / cupom</button> <button id="cp-mao">➕ ' + (desp ? "Despesa avulsa" : "Lançar à mão") + '</button> <button id="cp-reler" title="Ler de novo as fotos das notas já lançadas com a leitura nova">🔄 Atualizar antigas</button></span></div>' +
      '<input type="file" id="cp-arq" accept="image/*,application/pdf,.xml,text/xml,application/xml" multiple class="oculto">' +
      '<div class="filtros" id="cp-tipos">' + [["", "Tudo"], ["material", "🧱 Material de obra"], ["despesa", "⛽ Despesas avulsas"], ["apagar", "💳 A pagar"], ["precos", "📊 Comparar preços"], ["fornec", "🏪 Fornecedores"]].map(function (x) {
        return '<button class="' + (filtro.tipo === x[0] ? "prim" : "") + '" data-ctipo="' + x[0] + '">' + x[1] + "</button>";
      }).join("") + "</div>" +
      '<p class="mudo peq" style="margin-top:-4px">Foto da nota, PDF ou o <b>XML</b> do e-mail da loja (o XML e o PDF trazem os materiais exatos). No celular: Compartilhar → AGE Painel. Você completa o resto.</p>' +
      '<div class="filtros"><select id="cp-per" aria-label="Período"' + (filtro.tipo === "apagar" ? " disabled" : "") + '><option value="mes">Este mês</option><option value="mespassado">Mês passado</option><option value="3meses">Últimos 3 meses</option>' +
      '<option value="ano">Este ano</option><option value="tudo">Tudo</option><option value="datas">Escolher datas</option></select>' +
      '<select id="cp-area" aria-label="Área"><option value="">Todas as áreas</option><option value="eletrica">⚡ Só elétrica</option><option value="pintura">🖌️ Só pintura</option><option value="geral">Geral</option></select>' +
      '<input type="date" id="cp-de" class="' + (filtro.periodo === "datas" ? "" : "oculto") + '" aria-label="De"><input type="date" id="cp-ate" class="' + (filtro.periodo === "datas" ? "" : "oculto") + '" aria-label="Até">' +
      '<input type="search" id="cp-busca" placeholder="Buscar loja, obra, material, placa..."></div><div id="cp-res"></div>';
    $("#cp-per").value = filtro.periodo; $("#cp-area").value = filtro.area; $("#cp-de").value = filtro.de; $("#cp-ate").value = filtro.ate; $("#cp-busca").value = filtro.busca;
    $$("[data-ctipo]", c).forEach(function (b) { b.onclick = function () { filtro.tipo = b.dataset.ctipo; ver(c, P); }; });
    ["#cp-per", "#cp-area", "#cp-de", "#cp-ate"].forEach(function (id) {
      $(id).onchange = function () { filtro.periodo = $("#cp-per").value; filtro.area = $("#cp-area").value; filtro.de = $("#cp-de").value; filtro.ate = $("#cp-ate").value; ver(c, P); };
    });
    $("#cp-busca").oninput = function () { filtro.busca = this.value; listar(); };
    $("#cp-nota").onclick = function () { $("#cp-arq").value = ""; $("#cp-arq").click(); };
    $("#cp-arq").onchange = function () { if (this.files.length) receber({ arquivos: Array.prototype.slice.call(this.files), tipo: desp ? "despesa" : "" }, P); };
    $("#cp-mao").onclick = function () { formulario({ tipo: desp ? "despesa" : "" }); };
    $("#cp-reler").onclick = function () { atualizarAntigas(function () { if (P.atualizarAbas) P.atualizarAbas(); ver(c, P); }); };
    listar();
    // depois de quitar: a nota passa para paga, o alerta e o contador da aba se atualizam
    function depoisDeQuitar() { if (P.atualizarAbas) P.atualizarAbas(); listar(); }
    function listar() {
      if (filtro.tipo === "precos") { precos($("#cp-res")); return; }
      if (filtro.tipo === "fornec") { window.AGE_FORN.ver($("#cp-res"), P, filtro.busca, P.S.compras, listar); return; }
      var cs = lista(), t = totais(cs), r = $("#cp-res");
      var lad = function (rot, v, cor, id) { return '<div class="ladrilho"' + (id ? ' id="' + id + '" role="button" style="cursor:pointer;' : ' style="') + 'border-left:4px solid var(--' + cor + ')"><div class="r">' + rot + '</div><div class="v" style="font-size:1.3em">' + dinheiro(v) + "</div></div>"; };
      var h = htmlAlerta(P.S) + '<div class="grade">' +
        (filtro.tipo !== "despesa" && filtro.area !== "pintura" && filtro.area !== "geral" ? lad("⚡ Material elétrica", t.eletrica, "eletrica") : "") +
        (filtro.tipo !== "despesa" && filtro.area !== "eletrica" && filtro.area !== "geral" ? lad("🖌️ Material pintura", t.pintura, "pintura") : "") +
        (filtro.tipo !== "material" ? lad("⛽ Despesas avulsas", t.despesas, "atencao") : "") +
        lad("Total", t.total, "prim") + (t.aPagar ? lad("💳 A pagar", t.aPagar, "critico", "cp-lad-pagar") : "") + "</div>";
      if (!cs.length) { r.innerHTML = h + '<div class="cartao vazio">' + (filtro.tipo === "apagar" ? "✅ Nenhuma nota a pagar: tudo quitado." : "Nada lançado neste período.") + "</div>"; ligarAlerta(r, P, depoisDeQuitar); return; }
      // por loja: tudo somado, com o que falta pagar
      var lojas = agrupar(cs, lojaDe);
      h += '<div class="cartao"><h3 style="margin:0 0 6px">🏪 Por loja</h3><div class="tabela-caixa"><table><thead><tr><th>Loja</th><th>Data da compra</th><th class="num">Notas</th><th class="num">Total</th><th class="num">A pagar</th></tr></thead><tbody>' +
        lojas.map(function (x) {
          return "<tr><td><b>" + esc(x.nome) + '</b></td><td class="peq">' + esc(textoDatas(x.datas)) + '</td><td class="num">' + x.n + '</td><td class="num"><b>' + dinheiro(x.total) + '</b></td><td class="num">' +
            (x.aPagar ? '<span class="selo critico">' + dinheiro(x.aPagar) + "</span>" + (x.venc ? '<div class="peq mudo">vence ' + esc(A.dataSimples(x.venc)) + "</div>" : "") : "—") + "</td></tr>";
        }).join("") + '<tr><td><b>Total</b></td><td></td><td class="num">' + cs.length + '</td><td class="num"><b>' + dinheiro(t.total) + '</b></td><td class="num"><b>' + (t.aPagar ? dinheiro(t.aPagar) : "—") + "</b></td></tr>" +
        "</tbody></table></div>" +
        '<div class="acoes"><button id="cp-csv">⬇ Planilha (CSV)</button><button id="cp-comp">📤 Compartilhar resumo</button></div></div>';
      var mats = cs.filter(function (x) { return !ehDespesa(x); }), desps = cs.filter(ehDespesa);
      if (mats.length) {
        var dest = {};
        mats.forEach(function (x) { var k = destinoDe(x), a = porArea(x); dest[k] = dest[k] || { e: 0, p: 0, datas: [] }; dest[k].e += a.eletrica; dest[k].p += a.pintura; if (dest[k].datas.indexOf(x.comprado_em) < 0) dest[k].datas.push(x.comprado_em); });
        h += '<div class="cartao"><h3 style="margin:0 0 6px">📍 Material por destino</h3><div class="tabela-caixa"><table><thead><tr><th>Obra / loja / cliente</th><th>Data da compra</th><th class="num">⚡ Elétrica</th><th class="num">🖌️ Pintura</th><th class="num">Total</th></tr></thead><tbody>' +
          Object.keys(dest).sort(function (a, b) { return (dest[b].e + dest[b].p) - (dest[a].e + dest[a].p); }).map(function (k) {
            return "<tr><td>" + esc(k) + '</td><td class="peq">' + esc(textoDatas(dest[k].datas)) + '</td><td class="num">' + dinheiro(dest[k].e) + '</td><td class="num">' + dinheiro(dest[k].p) + '</td><td class="num"><b>' + dinheiro(dest[k].e + dest[k].p) + "</b></td></tr>";
          }).join("") + "</tbody></table></div></div>";
      }
      if (desps.length) {
        var cats = agrupar(desps, function (x) { return CATS[x.categoria] || CATS.outros; }), vs = agrupar(desps.filter(function (x) { return x.veiculo_id; }), veicDe);
        h += '<div class="cartao"><h3 style="margin:0 0 6px">⛽ Despesas avulsas por tipo</h3><div class="tabela-caixa"><table><tbody>' +
          cats.map(function (x) { return "<tr><td>" + esc(x.nome) + '</td><td class="num">' + x.n + '</td><td class="num"><b>' + dinheiro(x.total) + "</b></td></tr>"; }).join("") + "</tbody></table></div>" +
          (vs.length ? '<div class="peq" style="margin-top:6px"><b>Por veículo:</b> ' + vs.map(function (x) { return esc(x.nome) + " " + dinheiro(x.total); }).join(" · ") + "</div>" : "") + "</div>";
      }
      h += '<div class="tabela-caixa"><table><thead><tr><th>Data</th><th>Loja</th><th>Tipo / área</th><th>Destino</th><th>O quê</th><th>Pagamento</th><th class="num">Valor</th><th></th></tr></thead><tbody>' +
        cs.map(function (x) {
          var a = porArea(x), d2 = ehDespesa(x);
          return "<tr><td>" + esc(A.dataSimples(x.comprado_em)) + "</td><td><b>" + esc(lojaDe(x)) + "</b></td><td>" +
            (d2 ? esc(CATS[x.categoria] || CATS.outros) + (veicDe(x) ? '<div class="peq mudo">🚗 ' + esc(veicDe(x)) + "</div>" : "") :
              x.area === "dividir" ? '<span class="peq">⚡ ' + dinheiro(a.eletrica) + "<br>🖌️ " + dinheiro(a.pintura) + "</span>" : A.seloCategoria(x.area === "pintura" ? "pintura" : "eletrica")) +
            "</td><td>" + esc(destinoDe(x)) + (x.tipo_servico ? '<div class="peq mudo">' + esc(x.tipo_servico) + "</div>" : "") + '</td><td class="peq">' +
            esc((x.itens || []).map(function (y) { return (y.qtd ? A.numero(y.qtd) + " " + (y.un || "") + " " : "") + y.item + (y.unit ? " (" + dinheiro(y.unit) + ")" : ""); }).join("; ").slice(0, 180)) +
            (x.descricao ? '<div class="mudo">' + esc(x.descricao) + "</div>" : "") + "</td><td>" + esc(FORMAS[x.forma_pagamento] || "") +
            (x.pago === false ? '<div><span class="selo ' + situacao(x).cor + '">⏳ ' + esc(situacao(x).txt) + '</span> <button class="peq" data-quitar="' + x.id + '">✔ Quitei</button></div>' :
              '<div><span class="selo bom">✅ pago' + (x.pago_em ? " " + esc(A.dataSimples(String(x.pago_em).slice(0, 10))) : "") + "</span></div>") +
            '</td><td class="num"><b>' + dinheiro(x.valor) + "</b></td><td>" +
            (x.nota ? '<button class="peq" data-cp-nota="' + x.id + '">🧾</button> ' : "") + '<button class="peq" data-cp-ed="' + x.id + '">Editar</button></td></tr>';
        }).join("") + "</tbody></table></div>";
      r.innerHTML = h;
      if ($("#cp-lad-pagar")) $("#cp-lad-pagar").onclick = function () { filtro.tipo = "apagar"; ver(c, P); };
      $("#cp-csv").onclick = function () { baixarCsv(cs); };
      $("#cp-comp").onclick = function () { A.compartilhar({ titulo: "Compras e despesas", texto: textoResumo(cs, t, lojas) }); };
      $$("[data-cp-ed]", r).forEach(function (b) { b.onclick = function () { formulario({ compra: P.porId(P.S.compras, b.dataset.cpEd) }); }; });
      ligarAlerta(r, P, depoisDeQuitar);
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
  // 📊 comparar preços: cada material (pelo nome) com o preço unitário em cada loja e data; o mais barato em verde
  function chaveMaterial(n) { return semAcento(n).replace(/[^a-z0-9,]+/g, " ").replace(/\s+/g, " ").trim(); }
  function precos(r) {
    var b = semAcento(filtro.busca), g = {};
    P.S.compras.forEach(function (c) {
      if (ehDespesa(c)) return;
      (c.itens || []).forEach(function (x) {
        var u = Number(x.unit) || (x.qtd > 0 && x.valor ? x.valor / x.qtd : 0);
        if (!x.item || !(u > 0)) return;
        var k = chaveMaterial(x.item);
        if (b && k.indexOf(b) < 0 && semAcento(c.fornecedor).indexOf(b) < 0) return;
        (g[k] = g[k] || { nome: x.item, linhas: [] }).linhas.push({ loja: lojaDe(c), data: c.comprado_em, unit: u, qtd: x.qtd, un: x.un || "un", compra: c });
      });
    });
    var ks = Object.keys(g).sort(function (a, b2) { return g[b2].linhas.length - g[a].linhas.length || a.localeCompare(b2); });
    if (!ks.length) { r.innerHTML = '<div class="cartao vazio">Nenhum material com preço ainda. Lance as notas: os materiais, a quantidade e o valor unitário entram sozinhos.</div>'; return; }
    r.innerHTML = '<p class="mudo peq">Preço unitário de cada material em cada compra (todos os períodos). Use a busca para achar um material ou uma loja.</p>' +
      ks.map(function (k) {
        var ls = g[k].linhas.sort(function (a, b2) { return a.unit - b2.unit || b2.data.localeCompare(a.data); });
        var min = ls[0].unit, max = ls[ls.length - 1].unit;
        return '<div class="cartao"><div class="linha"><h3 style="margin:0">' + esc(g[k].nome) + '</h3><span class="dir peq mudo">' + ls.length + " compra" + (ls.length > 1 ? "s" : "") +
          (max > min ? " · diferença de <b>" + Math.round((max - min) / min * 100) + "%</b>" : "") + "</span></div>" +
          '<div class="tabela-caixa"><table><thead><tr><th>Loja</th><th>Data</th><th class="num">Qtd</th><th class="num">Unitário</th></tr></thead><tbody>' +
          ls.map(function (x, i) {
            return "<tr><td>" + (i === 0 && ls.length > 1 ? '<span class="selo bom">mais barato</span> ' : "") + esc(x.loja) + "</td><td>" + esc(A.dataSimples(x.data)) + '</td><td class="num">' +
              (x.qtd ? esc(A.numero(x.qtd) + " " + x.un) : "") + '</td><td class="num"><b>' + dinheiro(x.unit) + "</b></td></tr>";
          }).join("") + "</tbody></table></div></div>";
      }).join("");
  }
  function textoResumo(cs, t, lojas) {
    var pr = periodo(), fim = new Date(new Date(pr.ate + "T12:00:00").getTime() - 864e5);
    return "*" + ((A.CFG.EMPRESA || {}).nome || "AGE") + " — Compras e despesas*\n" + (filtro.tipo === "apagar" ? "Contas a pagar\n" : filtro.periodo !== "tudo" ? A.dataSimples(pr.de) + " a " + A.data(fim) + "\n" : "") +
      "\n⚡ Material elétrica: " + dinheiro(t.eletrica) + "\n🖌️ Material pintura: " + dinheiro(t.pintura) + "\n⛽ Despesas avulsas: " + dinheiro(t.despesas) +
      "\n*Total: " + dinheiro(t.total) + "*" + (t.aPagar ? "\n💳 A pagar: " + dinheiro(t.aPagar) : "") + "\n\nPor loja:\n" +
      lojas.map(function (x) { return "• " + x.nome + " (" + textoDatas(x.datas) + "): " + dinheiro(x.total) + (x.aPagar ? " (a pagar " + dinheiro(x.aPagar) + (x.venc ? ", vence " + A.dataSimples(x.venc) : "") + ")" : ""); }).join("\n");
  }
  function baixarCsv(cs) {
    var cel = function (x) { x = String(x === null || x === undefined ? "" : x); return /[;"\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
    var r2 = function (v) { return Number(v || 0).toFixed(2).replace(".", ","); };
    var linhas = [["Data", "Loja", "Tipo", "Área / categoria", "Elétrica (R$)", "Pintura (R$)", "Valor total (R$)", "Pagamento", "Situação", "Vencimento", "Destino", "Tipo de serviço", "Veículo", "Itens", "Observação"]];
    cs.forEach(function (x) {
      var a = porArea(x), d2 = ehDespesa(x);
      linhas.push([A.dataSimples(x.comprado_em), lojaDe(x), d2 ? "Despesa avulsa" : "Material", d2 ? (CATS[x.categoria] || "").replace(/^\S+\s/, "") : (AREAS[x.area] || "").replace(/^\S+\s/, ""),
        d2 ? "" : r2(a.eletrica), d2 ? "" : r2(a.pintura), r2(x.valor), FORMAS[x.forma_pagamento] || "", x.pago === false ? "A pagar" : "Pago", x.vencimento ? A.dataSimples(x.vencimento) : "",
        destinoDe(x), x.tipo_servico || "", veicDe(x),
        (x.itens || []).map(function (y) { return (y.qtd ? A.numero(y.qtd) + " " + (y.un || "") + " " : "") + y.item + (y.valor ? " (" + r2(y.valor) + ")" : ""); }).join("; "), x.descricao || ""]);
    });
    var csv = "﻿" + linhas.map(function (l) { return l.map(cel).join(";"); }).join("\r\n");
    P.baixar(new Blob([csv], { type: "text/csv;charset=utf-8" }), "compras-" + A.isoLocal(new Date()) + ".csv");
  }



  // ---------------- 🔄 atualizar notas antigas: lê de novo a foto (e o CNPJ) e mostra o que mudaria; só grava o que você marcar ----------------
  function fotoDaNota(cam) {
    return P.q(P.sb.storage.from("fotos").createSignedUrls([cam], 600)).then(function (l) {
      var u = l && l[0] && l[0].signedUrl;
      if (!u) throw new Error("foto não encontrada");
      return fetch(u);
    }).then(function (r) { return r.blob(); }).then(function (b) { return new File([b], "nota.jpg", { type: /^image\//.test(b.type) ? b.type : "image/jpeg" }); });
  }
  function nomeIgual(a, b) { var k = function (x) { return semAcento(x).replace(/[^a-z0-9]+/g, " ").replace(/\b(ltda|me|epp|eireli|sa|s a)\b/g, " ").replace(/\s+/g, " ").trim(); }; return k(a) === k(b); }
  // o que a leitura nova muda na nota salva: [{k, rot, de, para, marcado}]
  function mudancas(c, d) {
    var m = [], F = window.AGE_FORN, viaCnpj = !!(d.cnpj && d.loja && (d.loja.razao_social || d.loja.id));
    if (d.fornecedor && !nomeIgual(d.fornecedor, c.fornecedor)) m.push({ k: "fornecedor", rot: "Loja", de: c.fornecedor || "—", para: d.fornecedor, marcado: viaCnpj || !c.fornecedor });
    if (d.cnpj && (!c.cnpj || c.cnpj.replace(/\D/g, "") !== d.cnpj.replace(/\D/g, ""))) m.push({ k: "cnpj", rot: "CNPJ", de: c.cnpj || "—", para: F ? F.fmtCnpj(d.cnpj) : d.cnpj, marcado: !c.cnpj });
    if (d.valor && Math.abs(d.valor - Number(c.valor)) >= 0.01) m.push({ k: "valor", rot: "Valor", de: dinheiro(c.valor), para: d.valor, txt: dinheiro(d.valor) + (d.valorIncerto ? " (confira)" : ""),
      marcado: !d.valorIncerto || Number(c.valor) < somaItens(d) - 0.05 });   // o antigo menor que os próprios materiais estava errado
    if (d.data && !d.semData && d.data !== c.comprado_em) m.push({ k: "comprado_em", rot: "Data", de: A.dataSimples(c.comprado_em), para: d.data, txt: A.dataSimples(d.data), marcado: true });
    if (!(c.itens || []).length && (d.itens || []).length) m.push({ k: "itens", rot: "Materiais", de: "—", para: d.itens, txt: d.itens.map(function (x) { return (x.qtd ? A.numero(x.qtd) + " " + (x.un || "") + " " : "") + x.item + (x.valor ? " " + dinheiro(x.valor) : ""); }).join("; "), marcado: true });
    if (d.chave && !c.chave) m.push({ k: "chave", rot: "Chave da NF-e", de: "—", para: d.chave, marcado: true });
    if (d.numero && !c.numero_nota) m.push({ k: "numero_nota", rot: "Nº da nota", de: "—", para: d.numero, marcado: true });
    if (d.loja && F && !P.S.semForn) {
      var f = F.achar(P.S, d.cnpj, d.fornecedor || c.fornecedor), novos = ["telefone", "whatsapp", "email", "endereco", "cidade"].filter(function (k) { return d.loja[k] && (!f || !f[k]); });
      if (novos.length) m.push({ k: "_loja", rot: "Dados da loja", de: "—", para: d.loja, txt: [d.loja.telefone, d.loja.email, [d.loja.endereco, d.loja.cidade].filter(Boolean).join(" - ")].filter(Boolean).join(" · "), marcado: true });
    }
    return m;
  }
  function atualizarAntigas(depois) {
    var fila = P.S.compras.filter(function (c) { return c.nota || c.cnpj; }).slice();
    var j = A.janela('<p class="peq">O app lê de novo a <b>foto</b> de cada nota já lançada (e busca a loja pelo <b>CNPJ</b>) com a leitura nova, e mostra o que mudaria. ' +
      "Nada é gravado sem você marcar. Cada foto leva uns 30 segundos; pode parar quando quiser e aplicar o que já apareceu.</p>" +
      '<div class="peq"><b>' + fila.length + "</b> nota" + (fila.length === 1 ? "" : "s") + " com foto ou CNPJ.</div>" +
      '<div class="acoes"><button class="prim" id="ra-ir"' + (fila.length ? "" : " disabled") + '>🔄 Começar</button><button id="ra-parar" class="oculto">⏸ Parar</button></div>' +
      '<div id="ra-st" class="peq"></div><div id="ra-lista"></div><div id="ra-erro"></div>' +
      '<div class="acoes oculto" id="ra-fim"><button class="prim" id="ra-aplicar">✔ Aplicar o que está marcado</button></div>', { titulo: "🔄 Atualizar notas antigas", larga: true, fixa: true });
    var el = j.el, parar = false, achados = [];
    function desenhar() {
      $("#ra-lista", el).innerHTML = achados.map(function (a, i) {
        return '<div class="cartao"><div class="peq"><b>' + esc(a.c.fornecedor || "Loja não informada") + "</b> · " + esc(A.dataSimples(a.c.comprado_em)) + " · " + dinheiro(a.c.valor) + "</div>" +
          a.m.map(function (x, k) {
            return '<label class="marca-linha peq"><input type="checkbox" data-ra="' + i + ":" + k + '"' + (x.marcado ? " checked" : "") + "> " + esc(x.rot) + ": " +
              (x.de !== "—" ? '<s class="mudo">' + esc(x.de) + "</s> → " : "") + "<b>" + esc(x.txt || x.para) + "</b></label>";
          }).join("") + "</div>";
      }).join("") || "";
      $$("[data-ra]", el).forEach(function (cb) { cb.onchange = function () { var p = cb.dataset.ra.split(":"); achados[p[0]].m[p[1]].marcado = cb.checked; }; });
      $("#ra-fim", el).classList.toggle("oculto", !achados.length);
    }
    $("#ra-parar", el).onclick = function () { parar = true; this.disabled = true; this.textContent = "Parando depois desta..."; };
    $("#ra-ir", el).onclick = function () {
      this.classList.add("oculto"); $("#ra-parar", el).classList.remove("oculto");
      var feitas = 0, iguais = 0, falhas = 0;
      fila.reduce(function (pr, c, i) {
        return pr.then(function () {
          if (parar) return;
          $("#ra-st", el).textContent = "📖 Lendo a nota " + (i + 1) + " de " + fila.length + " (" + (c.fornecedor || A.dataSimples(c.comprado_em)) + ")...";
          var pd = c.nota ? fotoDaNota(c.nota).then(function (f) { return lerUmaNota(f, function (t) { $("#ra-st", el).textContent = t + " — nota " + (i + 1) + " de " + fila.length; }); }).then(function (x) { return x.dados || {}; })
            : Promise.resolve({ cnpj: c.cnpj });
          return pd.then(function (d) {
            if (!d.cnpj && c.cnpj) d.cnpj = c.cnpj;
            return completarLoja(d);
          }).then(function (d) {
            feitas++;
            var m = mudancas(c, d);
            if (m.length) { achados.push({ c: c, m: m }); desenhar(); } else iguais++;
          }).catch(function () { falhas++; });
        });
      }, Promise.resolve()).then(function () {
        $("#ra-parar", el).classList.add("oculto");
        $("#ra-st", el).innerHTML = "✔ " + feitas + " lida" + (feitas === 1 ? "" : "s") + (parar ? " (parou)" : "") + ": <b>" + achados.length + "</b> com mudança, " + iguais + " sem mudança" + (falhas ? ", " + falhas + " sem foto legível" : "") + ".";
      });
    };
    $("#ra-aplicar", el).onclick = function () {
      var b = this, F = window.AGE_FORN, n = 0;
      A.ocupado(b, true, "Gravando...");
      achados.reduce(function (pr, a) {
        return pr.then(function () {
          var up = {}, loja = null;
          a.m.forEach(function (x) { if (!x.marcado) return; if (x.k === "_loja") loja = x.para; else up[x.k] = x.para; });
          var nome = up.fornecedor || a.c.fornecedor;
          var grava = !Object.keys(up).length ? Promise.resolve(a.c) : P.q(P.sb.from("compras").update(up).eq("id", a.c.id).select().single())
            .catch(function () { delete up.chave; return Object.keys(up).length ? P.q(P.sb.from("compras").update(up).eq("id", a.c.id).select().single()) : a.c; });   // chave já usada em outra nota (repetida)
          return grava.then(function (x) {
            if (x !== a.c) { P.trocar(P.S.compras, x); n++; }
            var cn = up.cnpj || a.c.cnpj;
            if (F && nome && (loja || cn)) return F.salvar(P, Object.assign({}, loja || {}, { cnpj: cn }), nome);
          });
        });
      }, Promise.resolve()).then(function () { j.fechar(); A.avisar("🔄 " + n + " nota" + (n === 1 ? " atualizada" : "s atualizadas"), "ok"); if (depois) depois(); })
        .catch(function (e) { A.ocupado(b, false); $("#ra-erro", el).innerHTML = '<div class="aviso erro">' + esc(A.msgErro(e)) + "</div>"; });
    };
  }

  // ---------------- notas não quitadas: alerta até marcar como paga ----------------
  function diasPara(iso) { return Math.round((new Date(iso + "T12:00:00") - new Date(A.isoLocal(new Date()) + "T12:00:00")) / 864e5); }
  function situacao(c) {
    if (!c.vencimento) return { txt: "não quitada · sem vencimento", cor: "atencao", ordem: 2 };
    var d = diasPara(c.vencimento);
    if (d < 0) return { txt: "VENCIDA há " + (-d) + (d === -1 ? " dia" : " dias"), cor: "critico", ordem: 0, urgente: true };
    if (d === 0) return { txt: "vence HOJE", cor: "critico", ordem: 0, urgente: true };
    if (d <= 3) return { txt: "vence em " + d + (d === 1 ? " dia" : " dias"), cor: "atencao", ordem: 1, urgente: true };
    return { txt: "vence " + A.dataSimples(c.vencimento), cor: "atencao", ordem: 3 };
  }
  function naoQuitadas(S) {
    return (S.compras || []).filter(function (c) { return c.pago === false; }).sort(function (a, b) {
      return situacao(a).ordem - situacao(b).ordem || String(a.vencimento || "9").localeCompare(String(b.vencimento || "9")) || String(a.comprado_em).localeCompare(String(b.comprado_em));
    });
  }
  // quadro vermelho com cada nota não quitada e o botão para quitar (some sozinho quando não sobra nenhuma)
  function htmlAlerta(S) {
    var ns = naoQuitadas(S);
    if (!ns.length) return "";
    var total = ns.reduce(function (t, c) { return t + (Number(c.valor) || 0); }, 0), urg = ns.filter(function (c) { return situacao(c).urgente; }).length;
    return '<div class="cartao" data-alerta-pagar style="margin-bottom:12px;border-left:4px solid var(--critico)"><h3 style="margin:0 0 6px">💳 ' + ns.length +
      (ns.length === 1 ? " nota não quitada" : " notas não quitadas") + " · " + dinheiro(total) + (urg ? ' <span class="selo critico">' + urg + (urg === 1 ? " vencida / vencendo" : " vencidas / vencendo") + "</span>" : "") + "</h3>" +
      ns.slice(0, 12).map(function (c) {
        var st = situacao(c);
        return '<div class="peq" style="margin:4px 0;display:flex;flex-wrap:wrap;gap:6px;align-items:center"><span class="selo ' + st.cor + '">' + esc(st.txt) + "</span> <b>" + esc(c.fornecedor || "Loja não informada") + "</b> · " +
          dinheiro(c.valor) + ' <span class="mudo">(compra ' + esc(A.dataSimples(c.comprado_em)) + (FORMAS[c.forma_pagamento] ? " · " + esc(FORMAS[c.forma_pagamento]) : "") + ')</span> <button class="peq" data-quitar="' + c.id + '">✔ Quitei</button></div>';
      }).join("") + (ns.length > 12 ? '<div class="peq mudo">… e mais ' + (ns.length - 12) + ' em <a href="#compras" data-ver-apagar>💳 A pagar</a>.</div>' : "") +
      '<div class="mudo peq" style="margin-top:6px">Toque em ✔ Quitei quando pagar (ou mande o comprovante: o app reconhece a nota e marca como paga).</div></div>';
  }
  // marca como paga; a data do pagamento vai em pago_em (se o banco ainda não tem a coluna, salva só o "pago")
  function quitar(id, ctx, quando) {
    P = ctx || P;
    var em = quando ? new Date(quando).toISOString() : new Date().toISOString();
    return P.q(P.sb.from("compras").update({ pago: true, pago_em: em }).eq("id", id).select().single())
      .catch(function () { return P.q(P.sb.from("compras").update({ pago: true }).eq("id", id).select().single()); })
      .then(function (n) { P.trocar(P.S.compras, n); return n; });
  }
  function ligarAlerta(el, ctx, depois) {
    P = ctx;
    $$("[data-quitar]", el).forEach(function (b) {
      b.onclick = function () {
        A.ocupado(b, true, "...");
        quitar(b.dataset.quitar, P).then(function (n) {
          A.avisar("✔ Nota quitada: " + (n.fornecedor || "") + " · " + dinheiro(n.valor) + " — agora está como paga", "ok");
          if (depois) depois(); else P.rota();
        }).catch(function (e) { A.ocupado(b, false); P.falhou(e); });
      };
    });
    $$("[data-ver-apagar]", el).forEach(function (a) { a.onclick = function () { filtro.tipo = "apagar"; }; });
  }
  // comprovante de pagamento (Pix/boleto) que bate com uma nota não quitada: mesmo valor e a loja parecida (ou a única com esse valor)
  function notaDoComprovante(it, S) {
    if (!(it.valor > 0)) return null;
    var ns = naoQuitadas(S).filter(function (c) { return Math.abs((Number(c.valor) || 0) - it.valor) < 0.01; });
    if (!ns.length) return null;
    var nome = semAcento(it.favorecido || "").replace(/[^a-z0-9]+/g, " "), dig = String((it.chave || "") + " " + (it.texto || "")).replace(/\D/g, "");
    var porLoja = ns.filter(function (c) {
      if (c.cnpj && dig.indexOf(String(c.cnpj).replace(/\D/g, "")) >= 0) return true;
      var pal = semAcento(c.fornecedor || "").replace(/[^a-z0-9]+/g, " ").split(" ").filter(function (w) { return w.length >= 4 && !/^(ltda|comercio|comercial|materiais|material|construcao|eireli)$/.test(w); });
      return pal.some(function (w) { return nome.indexOf(w) >= 0; });
    });
    return porLoja[0] || (ns.length === 1 ? ns[0] : null);
  }

  window.AGE_COMPRAS = { ver: ver, receber: receber, lerNota: lerNota, porArea: porArea, naoQuitadas: naoQuitadas, htmlAlerta: htmlAlerta, ligarAlerta: ligarAlerta, quitar: quitar, notaDoComprovante: notaDoComprovante, situacao: situacao };
})();
