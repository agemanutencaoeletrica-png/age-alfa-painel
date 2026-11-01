// Painel do dono — 📑 PROPOSTAS PRONTAS: orçamentos técnicos já escritos (cliente, texto do serviço, itens e valores).
// Cada proposta fica separada para guardar e editar; "Usar no orçamento" abre o orçamento do app já preenchido, e o PDF sai igual aos outros orçamentos.
// O PDF da proposta (ou foto) é lido e separado nos campos; tudo pode ser corrigido ou digitado à mão. O mesmo arquivo não entra duas vezes.
// Usa as funções do admin.js (P).
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null;
  var filtro = { busca: "" };
  // áreas do orçamento do app (as fixas + as que o dono acrescentou em ✏️ Áreas)
  function areas() { var a = Object.assign({ "": "—" }, P.areas()); return a; }
  function nomeArea(k) { var a = areas(); return a[k] || String(k || "").replace(/_/g, " "); }
  var UNS = ["serv", "un", "m", "m²", "pç", "dia", "h", "vb"];
  var PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  var MESES = { janeiro: 1, fevereiro: 2, "março": 3, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };

  function semAcento(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); }
  function hoje() { return A.isoLocal(new Date()); }
  function lista() { return (P && P.S.propostas) || []; }
  function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function dig(t) { return String(t || "").replace(/\D/g, ""); }

  // ---------------- leitura do arquivo ----------------
  function impressao(f) {
    if (!f || !window.crypto || !crypto.subtle || !f.arrayBuffer) return Promise.resolve(null);
    return f.arrayBuffer().then(function (b) { return crypto.subtle.digest("SHA-256", b); })
      .then(function (h) { return Array.prototype.map.call(new Uint8Array(h), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); })
      .catch(function () { return null; });
  }
  function carregarPdfjs() {
    if (window.pdfjsLib) return Promise.resolve();
    return new Promise(function (ok, erro) {
      var s = document.createElement("script"); s.src = PDFJS + "pdf.min.js";
      s.onload = function () { window.pdfjsLib ? ok() : erro(new Error("O leitor de PDF não carregou.")); };
      s.onerror = function () { erro(new Error("Sem internet para carregar o leitor de PDF.")); };
      document.head.appendChild(s);
    }).then(function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js"; });
  }
  // texto das páginas (até 8), uma linha por altura na página
  function textoPdf(f) {
    return carregarPdfjs().then(function () { return f.arrayBuffer(); })
      .then(function (buf) { return window.pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise; })
      .then(function (doc) {
        var n = Math.min(doc.numPages, 8), pg = [];
        for (var i = 1; i <= n; i++) pg.push(i);
        return pg.reduce(function (pr, i) {
          return pr.then(function (acc) {
            return doc.getPage(i).then(function (p) { return p.getTextContent(); }).then(function (tc) {
              var linhas = [], ultY = null;
              tc.items.forEach(function (it) {
                var y = Math.round(it.transform[5]);
                if (ultY === null || Math.abs(y - ultY) > 3) linhas.push(it.str); else linhas[linhas.length - 1] += " " + it.str;
                ultY = y;
              });
              return acc.concat(linhas);
            });
          });
        }, Promise.resolve([])).then(function (ls) { return ls.join("\n"); });
      });
  }
  function textoDoArquivo(f) {
    if (/pdf/.test(f.type || "") || /\.pdf$/i.test(f.name || "")) return textoPdf(f);
    if (/^image\//.test(f.type || "") && window.AGE_PAG && window.AGE_PAG.lerArquivo) return window.AGE_PAG.lerArquivo(f).then(function (r) { return r.texto || ""; });
    return f.text();
  }

  // ---------------- separar o texto nos campos ----------------
  function dataDoTexto(t) {
    var m = /(\d{1,2})\s+de\s+([a-zçã]+)\s+de\s+(\d{4})/i.exec(t);
    if (m && MESES[semAcento(m[2])]) return m[3] + "-" + ("0" + MESES[semAcento(m[2])]).slice(-2) + "-" + ("0" + m[1]).slice(-2);
    m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(t);
    return m ? m[3] + "-" + m[2] + "-" + m[1] : null;
  }
  function numeroBR(t) { var s = String(t).replace(/[^\d.,]/g, ""); if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", "."); var n = parseFloat(s); return isFinite(n) ? n : 0; }
  function limpaLinhas(ls) { return ls.map(function (l) { return String(l).replace(/\s+/g, " ").trim(); }); }
  // junta linhas de um mesmo parágrafo (a linha que não começa com • ou número continua a anterior) e separa os tópicos
  function paragrafos(ls) {
    var out = [];
    ls.forEach(function (l) {
      if (!l) { out.push(""); return; }
      if (/^[•\-–✓✔*]/.test(l) || !out.length || out[out.length - 1] === "") out.push(l);
      else out[out.length - 1] += " " + l;
    });
    return out.filter(function (l, i, a) { return l || (i > 0 && a[i - 1]); }).join("\n").replace(/[ \t]+([,;.:!?])/g, "$1").trim();
  }
  // nome de empresa/pessoa em MAIÚSCULAS vira "Deva Veículos Ltda. – Betim"
  function nomeBR(t) {
    t = String(t || "").trim();
    if (!t || t !== t.toUpperCase() || !/[A-ZÀ-Ú]{3}/.test(t)) return t;
    return t.toLowerCase().replace(/(^|[\s–-])([a-zà-ú])/g, function (m, a, b) { return a + b.toUpperCase(); })
      .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, function (w, x, i) { return i === 0 ? w : w.toLowerCase(); }).replace(/\bS\.a\./g, "S.A.");
  }
  function bonito(t) { t = String(t || "").trim(); return t && t === t.toUpperCase() && /[A-ZÀ-Ú]{3}/.test(t) ? t.charAt(0) + t.slice(1).toLowerCase() : t; }

  // devolve { titulo, cliente, documento, telefone, endereco, data, introducao, escopo, itens, total, condicoes }
  function ler(texto) {
    var L = limpaLinhas(String(texto || "").split(/\r?\n/));
    var u = function (re) { for (var i = 0; i < L.length; i++) if (re.test(L[i])) return i; return -1; };
    var iCli = u(/^CLIENTE\b/i), iServ = u(/^SERVI[ÇC]O(S)?\s*:?/i);
    var r = { titulo: "", cliente: "", documento: "", telefone: "", endereco: "", data: null, introducao: "", escopo: "", itens: [], total: 0, condicoes: "" };
    // data
    for (var d = 0; d < L.length && !r.data; d++) if (/\bdata\b/i.test(L[d]) || /\d+\s+de\s+[a-zçã]+\s+de\s+\d{4}/i.test(L[d])) r.data = dataDoTexto(L[d]);
    // cliente: entre "CLIENTE" e "SERVIÇO"
    if (iCli >= 0) {
      var fim = iServ > iCli ? iServ : Math.min(L.length, iCli + 12), bl = L.slice(iCli + 1, fim).filter(Boolean), end = [];
      bl.forEach(function (l, n) {
        var m;
        if ((m = /CNPJ\s*:?\s*([\d./-]{11,18})/i.exec(l)) && !r.documento) r.documento = m[1];
        else if ((m = /CPF\s*:?\s*([\d.-]{11,14})/i.exec(l)) && !r.documento) r.documento = m[1];
        else if ((m = /Telefone\s*:?\s*(.+)$/i.exec(l)) && !r.telefone) r.telefone = m[1].trim();
        else if (/^Inscri[çc][ãa]o/i.test(l)) { /* IE/IM não vão para o orçamento */ }
        else if (n === 0 && !r.cliente) r.cliente = nomeBR(l);
        else end.push(l.replace(/^Endere[çc]o\s*:?\s*/i, ""));
      });
      r.endereco = end.join(", ");
    }
    // título (SERVIÇO: ... até a linha em branco)
    if (iServ >= 0) {
      var t = [L[iServ].replace(/^SERVI[ÇC]O(S)?\s*:?\s*/i, "")];
      for (var k = iServ + 1; k < L.length && L[k] && !/^Prezados/i.test(L[k]) && !/^(PROCEDIMENTO|OBJETIVO|VALOR|CONDI)/i.test(L[k]) && t.length < 3; k++) t.push(L[k]);
      r.titulo = bonito(t.join(" ").trim());
    }
    // título quando o documento é "ORÇAMENTO DE SERVIÇOS — LAVA-JATO DE CAMINHÕES" (sem linha SERVIÇO:)
    if (!r.titulo) { var iT = u(/^ORÇAMENTO\s+(DE|T[ÉE]CNICO)/i); if (iT >= 0) r.titulo = bonito(L[iT].replace(/^ORÇAMENTO\s+(DE\s+SERVI[ÇC]OS|T[ÉE]CNICO(\s*\/\s*LAUDO\s+T[ÉE]CNICO)?)\s*[—–-]?\s*/i, "") || L[iT]); }
    var ini = Math.max(iServ, iCli) + 1, corpo = L.slice(ini > 0 ? ini : 0);
    // blocos pelas palavras de cabeçalho
    var iPrez = corpo.findIndex(function (l) { return /^Prezados/i.test(l); });
    var iProc = corpo.findIndex(function (l) { return /^PROCEDIMENTO/i.test(l); });
    var iObj = corpo.findIndex(function (l) { return /^OBJETIVO/i.test(l); });
    var iVal = corpo.findIndex(function (l) { return /^VALOR\s+TOTAL/i.test(l); });
    var iCond = corpo.findIndex(function (l) { return /^(CONDI[ÇC][ÃA]O|CONDI[ÇC][ÕO]ES|OBSERVA[ÇC][ÃA]O)\b/i.test(l); });
    var iFimDoc = corpo.findIndex(function (l) { return /^(Atenciosamente|_{5,})/i.test(l); });
    var corte = function (a, ate) { return a < 0 ? [] : corpo.slice(a + 1, ate.filter(function (x) { return x > a; }).sort(function (p, q) { return p - q; })[0] || corpo.length); };
    var cab = [iProc, iObj, iVal, iCond, iFimDoc];
    // itens numerados com "Valor do serviço: R$ ..." (propostas com mais de um serviço)
    var secoes = [], cur = null;
    corpo.forEach(function (l) {
      var m;
      if ((m = /^(\d+)\s*[.)]\s+(.+)$/.exec(l)) && !/^VALOR/i.test(m[2])) { cur = { titulo: bonito(m[2]), linhas: [], valor: 0 }; secoes.push(cur); }
      else if (cur && (m = /Valor\s+do\s+servi[çc]o\s*:?\s*R\$\s*([\d.,]+)/i.exec(l))) { cur.valor = numeroBR(m[1]); cur = null; }
      else if (cur && l) cur.linhas.push(l);
    });
    secoes = secoes.filter(function (s) { return s.valor > 0; });
    // total
    var iTot = corpo.findIndex(function (l) { return /^VALOR\s+TOTAL|TOTAL\s+DOS\s+SERVI[ÇC]OS/i.test(l); });
    for (var q = iTot; iTot >= 0 && q < Math.min(corpo.length, iTot + 6); q++) { var mm = /R\$\s*([\d.]+,\d{2})/.exec(corpo[q]); if (mm) { r.total = numeroBR(mm[1]); break; } }
    // introdução: do "Prezados" até o primeiro tópico/cabeçalho; "OBJETIVO" acrescenta
    var corteIntro = [iProc, iObj, iVal, iFimDoc].concat(corpo.map(function (l, i) { return /^[•\-–✓✔*]|^\d+\s*[.)]\s+/.test(l) ? i : -1; }).filter(function (x) { return x >= 0; }));
    var introL = iPrez >= 0 ? [corpo[iPrez].replace(/^Prezados\s*,?\s*/i, "")].concat(corte(iPrez, corteIntro)) : [];
    introL = introL.map(function (l, i) { return i === 0 && l ? l.charAt(0).toUpperCase() + l.slice(1) : l; });
    var objL = corte(iObj, cab);
    r.introducao = [paragrafos(introL), paragrafos(objL) ? "Objetivo: " + paragrafos(objL) : ""].filter(Boolean).join("\n\n");
    // escopo: procedimento técnico (ou, sem ele, os tópicos • do corpo)
    if (secoes.length) {
      r.escopo = secoes.map(function (s) { return s.titulo + "\n" + paragrafos(s.linhas); }).join("\n\n");
      r.itens = secoes.map(function (s) { return { descricao: s.titulo, qtd: 1, un: "serv", valor: s.valor }; });
      if (!r.total) r.total = r2(r.itens.reduce(function (t, i) { return t + i.valor; }, 0));
    } else {
      var escL = iProc >= 0 ? corte(iProc, cab) : corpo.filter(function (l, i) { return /^[•\-–✓✔*]/.test(l) && (iVal < 0 || i < iVal); });
      r.escopo = paragrafos(escL);
      if (r.total > 0) r.itens = [{ descricao: r.titulo || "Serviço", qtd: 1, un: "serv", valor: r.total }];
    }
    // condições: depois de "CONDIÇÃO"/"OBSERVAÇÃO" até a assinatura; se não houver o cabeçalho, o parágrafo "O valor ..." depois do total
    var condL = iCond >= 0 ? corte(iCond, [iFimDoc]) : [];
    if (!condL.length && iVal >= 0) condL = corpo.slice(iVal + 1, iFimDoc > iVal ? iFimDoc : corpo.length).filter(function (l) { return !/^R\$|^\(.*\)$|^[A-ZÀ-Ú\s\$.,\d()]+$/.test(l) || /\s/.test(l) && !/^\(/.test(l) && !/^R\$/.test(l) && /[a-zà-ú]/.test(l); });
    r.condicoes = paragrafos(condL.filter(function (l) { return !/^(Atenciosamente|AGE\s|CNPJ|E-mail)/i.test(l); }));
    return r;
  }

  // ---------------- tela ----------------
  function ver(c, ctx) {
    P = ctx;
    var semTab = P.S.semPropostas;
    c.innerHTML = '<div class="cab-secao"><h2>📑 Propostas prontas</h2><span><button class="prim" id="pp-lancar">📥 Importar proposta (PDF)</button> <button id="pp-mao">✍️ Escrever à mão</button></span></div>' +
      '<p class="mudo peq" style="margin-top:-4px">Guarde aqui os <b>orçamentos técnicos que você já escreveu</b> (PDF ou foto; pode escolher vários). O app separa cliente, serviço, valores e condições; você confere e edita. ' +
      "Em cada proposta, <b>📝 Usar no orçamento</b> abre o orçamento do app já preenchido, e o PDF sai igual aos outros orçamentos. O mesmo arquivo não entra duas vezes.</p>" +
      (semTab ? '<div class="aviso">Para guardar as propostas, rode no Supabase o <b>supabase.sql</b> atualizado (tabela <b>propostas</b>).</div>' : "") +
      '<input type="file" id="pp-arq" multiple accept="application/pdf,.pdf,image/*,text/plain,.txt" class="oculto">' +
      '<div id="pp-novos"></div>' +
      '<div class="filtros"><input type="search" id="pp-busca" placeholder="🔍 Buscar cliente, serviço ou texto" value="' + esc(filtro.busca) + '"></div><div id="pp-res"></div>';
    $("#pp-lancar").onclick = function () { $("#pp-arq").value = ""; $("#pp-arq").click(); };
    $("#pp-arq").onchange = function () { var fs = Array.prototype.slice.call(this.files || []); this.value = ""; if (fs.length) lancar(fs, $("#pp-novos")); };
    $("#pp-busca").oninput = function () { filtro.busca = this.value; listar(); };
    $("#pp-mao").onclick = function () { editar({ titulo: "", data: hoje(), itens: [] }, null); };
    listar();
  }
  function listar() {
    var r = $("#pp-res"); if (!r) return;
    var b = semAcento(filtro.busca);
    var ls = lista().filter(function (o) {
      return !b || b.split(/\s+/).every(function (p) { return semAcento([o.cliente, o.titulo, o.introducao, o.escopo, o.condicoes, (o.itens || []).map(function (i) { return i.descricao; }).join(" ")].join(" ")).indexOf(p) >= 0; });
    });
    if (!lista().length) { r.innerHTML = '<div class="cartao vazio">Nenhuma proposta guardada ainda. Toque em 📥 Importar proposta (PDF) ou ✍️ Escrever à mão.</div>'; return; }
    r.innerHTML = ls.map(function (o) {
      return '<div class="cartao" data-pp="' + o.id + '" style="cursor:pointer"><div class="linha"><h3 style="margin:0">' + esc(o.titulo || "Proposta sem título") + "</h3>" +
        '<span class="dir"><b>' + (Number(o.total) ? A.dinheiro(Number(o.total)) : "") + "</b></span></div>" +
        '<div class="peq">' + esc(o.cliente || "Cliente não informado") + " · " + esc(A.dataSimples(String(o.data).slice(0, 10))) + " · " + (o.itens || []).length + " item(ns)" +
        (o.categoria ? " · " + esc(nomeArea(o.categoria)) : "") + "</div>" +
        '<div class="acoes" style="margin-top:6px"><button class="peq prim" data-pp-usar>📝 Usar no orçamento</button><button class="peq" data-pp-editar>✏️ Editar</button><button class="peq perigo" data-pp-excluir>🗑 Excluir</button></div></div>';
    }).join("") || '<div class="cartao vazio">Nada com essa busca.</div>';
    $$("[data-pp]", r).forEach(function (cx) {
      var o = P.porId(lista(), cx.dataset.pp);
      cx.onclick = function () { editar(o, null); };
      $("[data-pp-usar]", cx).onclick = function (ev) { ev.stopPropagation(); usar(o); };
      $("[data-pp-editar]", cx).onclick = function (ev) { ev.stopPropagation(); editar(o, null); };
      $("[data-pp-excluir]", cx).onclick = function (ev) { ev.stopPropagation(); excluir(o); };
    });
  }

  // ---------------- importar ----------------
  function repetida(d) {
    return lista().filter(function (o) {
      if (d.arquivo_hash && o.arquivo_hash === d.arquivo_hash) return true;
      return !d.arquivo_hash && semAcento(o.titulo) === semAcento(d.titulo) && semAcento(o.cliente) === semAcento(d.cliente) && Math.abs((Number(o.total) || 0) - (Number(d.total) || 0)) < 0.01 &&
        String(o.data).slice(0, 10) === String(d.data).slice(0, 10);
    })[0] || null;
  }
  function lancar(fs, res) {
    fs.reduce(function (pr, f) {
      return pr.then(function () {
        var cx = document.createElement("div"); cx.className = "cartao"; res.insertBefore(cx, res.firstChild);
        cx.innerHTML = '<span class="carregando"></span> Lendo ' + esc(f.name) + "...";
        var hash = null;
        return impressao(f).then(function (h) {
          hash = h;
          var ja = h && repetida({ arquivo_hash: h });
          if (ja) { cx.innerHTML = htmlJa(f.name, ja); $("[data-abrir]", cx).onclick = function () { editar(ja, null); }; return null; }
          return textoDoArquivo(f);
        }).then(function (texto) {
          if (texto === null || texto === undefined) return;
          var d = ler(texto);
          d.arquivo_hash = hash;
          if (!d.data) d.data = hoje();
          var ja = repetida(d);
          if (ja) { cx.innerHTML = htmlJa(f.name, ja); $("[data-abrir]", cx).onclick = function () { editar(ja, null); }; return; }
          cx.innerHTML = "<b>" + esc(f.name) + "</b>: " + (d.titulo || d.itens.length ? "lido. Confira os campos abaixo e salve." : '<span class="selo atencao">não consegui separar tudo</span> Preencha o que faltar.');
          editar(d, f, cx);
        });
      }).catch(function (e) { A.avisar(A.msgErro(e), "erro"); });
    }, Promise.resolve());
  }
  function htmlJa(nome, ja) {
    return "<b>" + esc(nome) + '</b>: <span class="selo critico">⛔ repetida: já guardada em ' + esc(A.dataSimples(String(ja.criado_em || ja.data).slice(0, 10))) + "</span> " +
      '<span class="peq mudo">(' + esc(ja.titulo || "proposta") + ') Não foi guardada de novo.</span> <button class="peq" data-abrir>Abrir a que já está</button>';
  }

  // ---------------- editar ----------------
  // o: proposta (nova, lida do arquivo, ou já guardada com id); f: arquivo novo (opcional); cx: caixa na tela (senão abre numa janela)
  function editar(o, f, cx) {
    var L = (o.itens || []).map(function (i) { return { descricao: i.descricao || "", qtd: Number(i.qtd) || 1, un: i.un || "serv", valor: Number(i.valor) || 0 }; });
    if (!L.length) L.push({ descricao: "", qtd: 1, un: "serv", valor: 0 });
    var j = null, el = cx;
    if (!el) { j = A.janela("", { titulo: o.id ? "📑 Proposta" : "📑 Nova proposta", larga: true, fixa: true }); el = j.el; }
    function desenhar() {
      el.innerHTML = '<div class="duas"><div><label>Serviço (título)</label><input class="pp-tit" maxlength="300" placeholder="Ex.: Pintura da oficina"></div>' +
        '<div><label>Data</label><input class="pp-data" type="date"></div></div>' +
        '<div class="duas"><div><label>Cliente</label><input class="pp-cli" maxlength="160"></div><div><label>CNPJ / CPF</label><input class="pp-doc" maxlength="20"></div></div>' +
        '<div class="duas"><div><label>Telefone</label><input class="pp-tel" maxlength="40"></div><div><label>E-mail</label><input class="pp-email" type="email" maxlength="120"></div></div>' +
        '<label>Endereço</label><input class="pp-end" maxlength="300">' +
        '<div class="duas"><div><label>Área</label><div class="linha" style="gap:6px"><select class="pp-cat" style="flex:1"></select><button type="button" class="peq" data-pp-areas title="Acrescentar, renomear ou tirar áreas (TI, Câmeras...)">✏️ Áreas</button></div></div><div></div></div>' +
        '<label>Apresentação e objetivo <span class="peq mudo">(vai no laudo, em "vistoria")</span></label><textarea class="pp-intro" rows="4" maxlength="5000"></textarea>' +
        '<label>O que será feito <span class="peq mudo">(procedimento; vai no laudo, em "solução". Linhas com • viram tópicos)</span></label><textarea class="pp-esc" rows="7" maxlength="8000"></textarea>' +
        '<div class="tabela-caixa" style="margin-top:8px"><table><thead><tr><th>Item / serviço</th><th class="num">Qtd</th><th>Un</th><th class="num">Valor (un.)</th><th class="num">Total</th><th></th></tr></thead><tbody>' +
        L.map(function (x, n) {
          return '<tr data-it="' + n + '"><td><input class="it-desc" maxlength="300" style="min-width:200px" placeholder="Ex.: Pintura de 60 m² com duas demãos"></td><td><input class="it-qtd" inputmode="decimal" style="width:70px"></td>' +
            "<td><select class=\"it-un\">" + UNS.concat(UNS.indexOf(x.un) < 0 ? [x.un] : []).map(function (u) { return "<option>" + esc(u) + "</option>"; }).join("") + "</select></td>" +
            '<td><input class="it-val" inputmode="decimal" style="width:110px" placeholder="0,00"></td><td class="num it-tot"></td><td><button class="peq" data-it-tirar aria-label="Tirar a linha">✕</button></td></tr>';
        }).join("") + "</tbody></table></div>" +
        '<div class="acoes"><button class="peq" data-it-mais>➕ Adicionar item</button><span class="dir peq pp-soma"></span></div>' +
        '<label>Condições e observações <span class="peq mudo">(vão nas observações do orçamento)</span></label><textarea class="pp-cond" rows="4" maxlength="5000"></textarea>' +
        '<div class="acoes"><button class="prim" data-pp-salvar>💾 Salvar proposta</button><button data-pp-salvar-usar>📝 Salvar e usar no orçamento</button>' +
        (o.id ? '<button class="perigo" data-pp-apagar>🗑 Excluir</button>' : "") + (j ? "" : '<button data-pp-cancelar>Cancelar</button>') + "</div>" +
        '<p class="peq mudo" id="pp-aviso"></p>';
      $(".pp-tit", el).value = o.titulo || ""; $(".pp-data", el).value = String(o.data || hoje()).slice(0, 10); $(".pp-cli", el).value = o.cliente || ""; $(".pp-doc", el).value = o.documento || "";
      $(".pp-tel", el).value = o.telefone || ""; $(".pp-email", el).value = o.email || ""; $(".pp-end", el).value = o.endereco || ""; montarAreasSel(o.categoria || "");
      $(".pp-intro", el).value = o.introducao || ""; $(".pp-esc", el).value = o.escopo || ""; $(".pp-cond", el).value = o.condicoes || "";
      $$("tr[data-it]", el).forEach(function (tr) {
        var x = L[Number(tr.dataset.it)];
        $(".it-desc", tr).value = x.descricao; $(".it-qtd", tr).value = A.numero(x.qtd, 3); $(".it-un", tr).value = x.un; $(".it-val", tr).value = x.valor ? Number(x.valor).toFixed(2).replace(".", ",") : "";
        tr.oninput = tr.onchange = function () { x.descricao = $(".it-desc", tr).value; x.qtd = A.lerNumero($(".it-qtd", tr).value) || 0; x.un = $(".it-un", tr).value; x.valor = A.lerNumero($(".it-val", tr).value) || 0; somar(); };
        $("[data-it-tirar]", tr).onclick = function () { lerTopo(); L.splice(Number(tr.dataset.it), 1); if (!L.length) L.push({ descricao: "", qtd: 1, un: "serv", valor: 0 }); desenhar(); };
      });
      $("[data-it-mais]", el).onclick = function () { lerTopo(); L.push({ descricao: "", qtd: 1, un: "serv", valor: 0 }); desenhar(); var u = $$(".it-desc", el); u[u.length - 1].focus(); };
      $("[data-pp-areas]", el).onclick = function () { lerTopo(); P.editarAreas(function () { montarAreasSel($(".pp-cat", el).value); }); };
      $("[data-pp-salvar]", el).onclick = function () { gravar(this, false); };
      $("[data-pp-salvar-usar]", el).onclick = function () { gravar(this, true); };
      if ($("[data-pp-apagar]", el)) $("[data-pp-apagar]", el).onclick = function () { if (j) j.fechar(); excluir(o); };
      if ($("[data-pp-cancelar]", el)) $("[data-pp-cancelar]", el).onclick = function () { el.remove(); };
      somar();
    }
    function montarAreasSel(v) {
      var sel = $(".pp-cat", el), a = areas();
      sel.innerHTML = Object.keys(a).map(function (k) { return '<option value="' + esc(k) + '">' + esc(a[k]) + "</option>"; }).join("");
      if (v && !a[v]) sel.insertAdjacentHTML("beforeend", '<option value="' + esc(v) + '">' + esc(nomeArea(v)) + "</option>");
      sel.value = v || "";
    }
    function lerTopo() {
      o.titulo = $(".pp-tit", el).value.trim(); o.data = $(".pp-data", el).value || hoje(); o.cliente = $(".pp-cli", el).value.trim(); o.documento = $(".pp-doc", el).value.trim();
      o.telefone = $(".pp-tel", el).value.trim(); o.email = $(".pp-email", el).value.trim(); o.endereco = $(".pp-end", el).value.trim(); o.categoria = $(".pp-cat", el).value;
      o.introducao = $(".pp-intro", el).value.trim(); o.escopo = $(".pp-esc", el).value.trim(); o.condicoes = $(".pp-cond", el).value.trim();
    }
    function soma() { return r2(L.reduce(function (t, x) { return t + (Number(x.qtd) || 0) * (Number(x.valor) || 0); }, 0)); }
    function somar() {
      $$("tr[data-it]", el).forEach(function (tr) { var x = L[Number(tr.dataset.it)]; $(".it-tot", tr).textContent = x.qtd && x.valor ? A.dinheiro(r2(x.qtd * x.valor)) : "—"; });
      var sm = soma(), dif = o.total && Math.abs(sm - Number(o.total)) > 0.05;
      $(".pp-soma", el).innerHTML = "Total: <b>" + A.dinheiro(sm) + "</b>" + (dif ? ' <span class="selo atencao">total lido no documento ' + A.dinheiro(Number(o.total)) + "</span>" : "");
    }
    function gravar(b, depoisUsar) {
      lerTopo();
      var itens = L.filter(function (x) { return String(x.descricao).trim(); }).map(function (x) { return { descricao: String(x.descricao).replace(/\s+/g, " ").trim(), qtd: Number(x.qtd) || 1, un: x.un || "serv", valor: r2(x.valor) }; });
      if (!o.titulo && !itens.length) { A.avisar("Escreva o serviço ou pelo menos um item.", "erro"); return; }
      var reg = { titulo: o.titulo, cliente: o.cliente || null, documento: o.documento || null, telefone: o.telefone || null, email: o.email || null, endereco: o.endereco || null,
        categoria: o.categoria || null, data: o.data, introducao: o.introducao || null, escopo: o.escopo || null, itens: itens,
        total: r2(itens.reduce(function (t, x) { return t + x.qtd * x.valor; }, 0)) || null, condicoes: o.condicoes || null };
      if (P.S.semPropostas) { A.avisar("Rode o supabase.sql atualizado no Supabase (tabela propostas) para guardar.", "erro"); if (depoisUsar) usar(reg); return; }
      var ja = repetida(Object.assign({ arquivo_hash: o.arquivo_hash || null }, reg));
      if (ja && ja.id !== o.id) { A.avisar("Já existe uma proposta igual (mesmo cliente, serviço, data e valor).", "erro"); return; }
      A.ocupado(b, true, "Salvando...");
      var sobe = !o.id && f ? subir(f, reg.data) : Promise.resolve(null);
      sobe.then(function (cam) {
        if (cam) reg.arquivo = cam;
        if (!o.id && o.arquivo_hash) reg.arquivo_hash = o.arquivo_hash;
        var pr = o.id ? P.q(P.sb.from("propostas").update(reg).eq("id", o.id).select().single()) : P.q(P.sb.from("propostas").insert(reg).select().single());
        return pr.catch(function (e) {
          if (cam) P.q(P.sb.storage.from("fotos").remove([cam])).catch(function () { /* fica órfão */ });
          if (/23505|duplicate|duplicad/i.test(A.msgErro(e) + " " + (e && e.message) + " " + (e && e.code))) throw new Error("Este arquivo já foi guardado antes.");
          throw e;
        });
      }).then(function (n) {
        P.trocar(P.S.propostas, n);
        A.avisar("📑 Proposta salva", "ok");
        if (j) j.fechar(); else if (cx) cx.innerHTML = "<b>" + esc(n.titulo || "Proposta") + '</b>: <span class="selo bom">guardada</span> <button class="peq" data-abrir>Abrir</button>';
        if (cx && $("[data-abrir]", cx)) $("[data-abrir]", cx).onclick = function () { editar(n, null); };
        listar();
        if (depoisUsar) usar(n);
      }).catch(function (e) { A.ocupado(b, false); P.falhou(e); });
    }
    desenhar();
  }
  function subir(f, data) {
    var ehImg = /^image\//.test(f.type || "");
    var pr = ehImg ? A.prepararFoto(f, [], 1600).then(function (bl) { return { bl: bl, ext: "jpg", tipo: "image/jpeg" }; })
      : Promise.resolve(/pdf/.test(f.type || "") || /\.pdf$/i.test(f.name || "") ? { bl: f, ext: "pdf", tipo: "application/pdf" } : null);
    return pr.then(function (a) {
      if (!a) return null;
      var cam = "admin/propostas/" + data + "-" + A.uuid() + "." + a.ext;
      return P.q(P.sb.storage.from("fotos").upload(cam, a.bl, { contentType: a.tipo })).then(function () { return cam; });
    }).catch(function () { return null; });
  }

  // ---------------- usar no orçamento do app ----------------
  function usar(o) {
    if (!o) return;
    var itens = (o.itens || []).filter(function (i) { return i.descricao; }).map(function (i) { return { tipo: "servico", descricao: i.descricao, qtd: Number(i.qtd) || 1, un: i.un || "serv", valor: Number(i.valor) || 0 }; });
    if (!itens.length && Number(o.total) > 0) itens.push({ tipo: "servico", descricao: o.titulo || "Serviço", qtd: 1, un: "serv", valor: Number(o.total) });
    var base = { cliente: o.cliente || "", telefone: o.telefone || "", email: o.email || "", endereco: o.endereco || "", documento: o.documento || "", categoria: o.categoria || "",
      itens: itens, observacoes: o.condicoes || "", laudo: (o.introducao || o.escopo) ? { vistoria: o.introducao || "", solucao: o.escopo || "" } : null };
    // título do serviço: sem campo próprio no orçamento, entra no começo das observações
    if (o.titulo) base.observacoes = "Serviço: " + o.titulo + (base.observacoes ? "\n" + base.observacoes : "");
    P.novoOrcamento(base);
    A.avisar("📝 Proposta carregada no orçamento. Confira cliente, itens e valores.", "ok");
  }

  // ---------------- excluir ----------------
  function excluir(o) {
    if (!o) return;
    var j = A.janela('<p style="margin-top:0">Excluir a proposta <b>' + esc(o.titulo || "sem título") + "</b>" + (o.cliente ? " de " + esc(o.cliente) : "") + "?</p>" +
      '<p class="peq mudo">Sai da lista e o arquivo guardado é apagado. Os orçamentos que já usaram esta proposta não mudam.</p>' +
      '<div class="acoes"><button class="perigo" id="ex-ok">🗑 Excluir</button><button id="ex-nao">Cancelar</button></div>', { titulo: "🗑 Excluir proposta" });
    $("#ex-nao", j.el).onclick = function () { j.fechar(); };
    $("#ex-ok", j.el).onclick = function () {
      var b = this; A.ocupado(b, true, "Excluindo...");
      P.q(P.sb.from("propostas").delete().eq("id", o.id)).then(function () {
        P.tirar(P.S.propostas, o.id);
        if (o.arquivo) P.q(P.sb.storage.from("fotos").remove([o.arquivo])).catch(function () { /* o arquivo fica órfão: sem problema */ });
        j.fechar(); listar(); A.avisar("🗑 Proposta excluída", "ok");
      }).catch(function (e) { A.ocupado(b, false); P.falhou(e); });
    };
  }

  window.AGE_PROP = { ver: ver, ler: ler, usar: function (ctx, o) { P = ctx; usar(o); }, lista: function (ctx) { P = ctx; return lista(); } };
})();
