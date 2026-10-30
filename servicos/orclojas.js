// Painel do dono — 🏪 ORÇAMENTOS DAS LOJAS: cada orçamento de loja lançado fica separado (loja, nº, data, validade, itens e o arquivo)
// para conferir os preços. Ao lançar, os materiais que ainda não estão no app entram sozinhos no acervo da 💲 tabela, os que já estão
// ficam com o preço mais novo e todo preço vai para o 📈 histórico (precos.js). Em cada orçamento: a lista dos materiais que eram
// novos e, item a item, o menor preço já visto em outra loja.
// Usa as funções do admin.js (P) e do precos.js (AGE_PRECOS).
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null;
  var filtro = { busca: "" };
  var AREAS = { eletrica: "⚡ Elétrica", pintura: "🖌️ Pintura" };

  function semAcento(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); }
  function chaveMat(t) { return semAcento(t).replace(/\s+/g, " ").trim(); }
  function dig(t) { return String(t || "").replace(/\D/g, ""); }
  function lista() { return (P && P.S.orcLoja) || []; }
  function hoje() { return A.isoLocal(new Date()); }
  function mesmaLoja(a, b) { return (dig(a.cnpj) && dig(a.cnpj) === dig(b.cnpj)) || (!!a.loja && semAcento(a.loja) === semAcento(b.loja)); }
  // o mesmo orçamento (ou nota) já lançado: mesmo arquivo, mesma chave da NF-e, mesma loja + nº ou, sem nº, mesma loja, data, total e itens
  function mesmosItens(a, b) {
    var k = function (o) { return (o.itens || []).map(function (i) { return chaveMat(i.descricao) + "|" + Math.round((Number(i.unit) || 0) * 100); }).sort().join(";"); };
    return (a.itens || []).length === (b.itens || []).length && k(a) === k(b);
  }
  function jaLancado(d) {
    return lista().filter(function (o) {
      if (d.arquivo_hash && o.arquivo_hash === d.arquivo_hash) return true;
      if (d.chave && o.chave === d.chave) return true;
      if (!mesmaLoja(o, d)) return false;
      if (d.numero && o.numero) return o.numero === d.numero;
      return String(o.data).slice(0, 10) === String(d.data).slice(0, 10) && Math.abs((Number(o.total) || 0) - (Number(d.total) || 0)) < 0.01 && mesmosItens(o, d);
    })[0] || null;
  }
  // impressão digital do arquivo (SHA-256): o mesmo arquivo mandado de novo é reconhecido antes de ler
  function impressao(f) {
    if (!f || !window.crypto || !crypto.subtle || !f.arrayBuffer) return Promise.resolve(null);
    return f.arrayBuffer().then(function (b) { return crypto.subtle.digest("SHA-256", b); })
      .then(function (h) { return Array.prototype.map.call(new Uint8Array(h), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); })
      .catch(function () { return null; });
  }
  function htmlJa(o, ja) {
    return "<b>" + esc(o.loja || ja.loja || "Orçamento") + "</b>" + (ja.numero ? " · nº " + esc(ja.numero) : "") + ': <span class="selo critico">⛔ repetido: já lançado em ' +
      esc(A.dataSimples(String(ja.criado_em || ja.data).slice(0, 10))) + "</span> " + '<span class="peq mudo">Não foi guardado de novo.</span> <button class="peq" data-abrir>Abrir o que já está</button>';
  }
  function validadeDoTexto(t) { var m = /validade\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})/i.exec(String(t || "")); return m ? m[3] + "-" + m[2] + "-" + m[1] : null; }
  function vencido(o) { return o.validade && o.validade < hoje(); }
  // validade do orçamento da loja (vem escrita no orçamento): até essa data a loja garante os preços
  function selValidade(o) { return (vencido(o) ? "⚠ preços da loja venceram em " : "preços da loja válidos até ") + esc(A.dataSimples(o.validade)); }
  function copiar(t, msg) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { A.avisar(msg, "ok"); }, function () { window.prompt("Copie:", t); });
    else window.prompt("Copie:", t);
  }
  function novos(o) { return (o.itens || []).filter(function (i) { return i.novo; }); }

  // ---------------- tela ----------------
  function ver(c, ctx) {
    P = ctx;
    var semTab = P.S.semOrcLoja;
    c.innerHTML = '<div class="cab-secao"><h2>🏪 Orçamentos das lojas</h2><span><button class="prim" id="ol-lancar">📥 Lançar orçamento</button></span></div>' +
      '<p class="mudo peq" style="margin-top:-4px">Lance aqui o <b>orçamento de cada loja</b> (PDF, foto ou XML; pode escolher vários). Cada um fica separado para você conferir os preços. ' +
      "Os materiais que ainda não estão no app entram sozinhos no acervo da 💲 tabela e todo preço fica no 📈 histórico.</p>" +
      (semTab ? '<div class="aviso">Para guardar os orçamentos separados, rode no Supabase o <b>supabase.sql</b> atualizado (tabela <b>orcamentos_loja</b>). Até lá, os materiais vão para o acervo normalmente.</div>' : "") +
      '<input type="file" id="ol-arq" multiple accept="image/*,application/pdf,.pdf,.xml,text/xml,application/xml" class="oculto">' +
      '<div id="ol-novos"></div>' +
      '<div class="filtros"><input type="search" id="ol-busca" placeholder="🔍 Buscar loja, nº ou material" value="' + esc(filtro.busca) + '"></div><div id="ol-res"></div>';
    $("#ol-lancar").onclick = function () { $("#ol-arq").value = ""; $("#ol-arq").click(); };
    $("#ol-arq").onchange = function () { var fs = Array.prototype.slice.call(this.files || []); this.value = ""; if (fs.length) lancar(fs, $("#ol-novos")); };
    $("#ol-busca").oninput = function () { filtro.busca = this.value; listar(); };
    listar();
  }
  function listar() {
    var r = $("#ol-res"); if (!r) return;
    var b = semAcento(filtro.busca);
    var ls = lista().filter(function (o) {
      return !b || b.split(/\s+/).every(function (p) { return semAcento(o.loja + " " + (o.numero || "") + " " + (o.itens || []).map(function (i) { return i.descricao; }).join(" ")).indexOf(p) >= 0; });
    });
    if (!lista().length) { r.innerHTML = '<div class="cartao vazio">Nenhum orçamento de loja lançado ainda. Toque em 📥 Lançar orçamento.</div>'; return; }
    r.innerHTML = ls.map(function (o) {
      var nv = novos(o).length;
      return '<div class="cartao" data-ol="' + o.id + '" style="cursor:pointer"><div class="linha"><h3 style="margin:0">' + esc(o.loja || "Loja não identificada") + "</h3>" +
        '<span class="dir"><b>' + (o.total ? A.dinheiro(Number(o.total)) : "") + "</b></span></div>" +
        '<div class="peq">' + (o.numero ? "nº " + esc(o.numero) + " · " : "") + esc(A.dataSimples(o.data)) + " · " + (o.itens || []).length + " material(is)" +
        (o.area && AREAS[o.area] ? " · " + AREAS[o.area] : "") +
        (o.validade ? ' · <span class="selo ' + (vencido(o) ? "critico" : "bom") + '" title="Validade do orçamento da loja: até essa data a loja garante estes preços">' + selValidade(o) + "</span>" : "") +
        (nv ? ' · <span class="selo atencao">🆕 ' + nv + " material(is) novo(s) no app</span>" : "") + "</div>" +
        '<div class="acoes" style="margin-top:6px"><button class="peq" data-ol-abrir>Abrir</button><button class="peq perigo" data-ol-excluir>🗑 Excluir</button></div></div>';
    }).join("") || '<div class="cartao vazio">Nada com essa busca.</div>';
    $$("[data-ol]", r).forEach(function (cx) {
      var o = P.porId(lista(), cx.dataset.ol);
      cx.onclick = function () { abrir(o); };
      $("[data-ol-excluir]", cx).onclick = function (ev) { ev.stopPropagation(); excluir(o); };
    });
  }

  // ---------------- lançar ----------------
  function lancar(fs, res) {
    var CP = window.AGE_COMPRAS, PR = window.AGE_PRECOS;
    if (!CP || !PR) { A.avisar("O leitor de notas não carregou. Recarregue a página.", "erro"); return; }
    fs.reduce(function (pr, f) {
      return pr.then(function () {
        var cx = document.createElement("div"); cx.className = "cartao"; res.insertBefore(cx, res.firstChild);
        cx.innerHTML = '<span class="carregando"></span> Lendo ' + esc(f.name) + "...";
        var hash = null;
        return impressao(f).then(function (h) {
          hash = h;
          var jaArq = h && jaLancado({ arquivo_hash: h });
          if (jaArq) { cx.innerHTML = htmlJa({}, jaArq); $("[data-abrir]", cx).onclick = function () { abrir(jaArq); }; return null; }
          return CP.lerUmaNota(f, function (t) { cx.textContent = t; });
        }).then(function (rl) {
          if (!rl) return;
          var d = rl.dados || {};
          var itens = (d.itens || []).map(function (x) {
            var qtd = Number(x.qtd) || 1, unit = Number(x.unit) || (Number(x.valor) > 0 ? Math.round(x.valor / qtd * 100) / 100 : 0);
            return { descricao: String(x.item || "").replace(/\s+/g, " ").trim(), qtd: qtd, un: String(x.un || "un").toLowerCase().replace(/\.$/, ""), unit: unit,
              valor: Number(x.valor) || Math.round(qtd * unit * 100) / 100, ok: true };
          }).filter(function (x) { return x.descricao; });
          if (!itens.length) { cx.innerHTML = "<b>" + esc(f.name) + '</b>: <span class="selo critico">não achei materiais com preço</span> <span class="peq mudo">Tente o PDF original ou o XML da nota.</span>'; return; }
          return PR.nomeLoja(P.S, d).then(function (loja) {
            var o = { loja: loja, cnpj: d.cnpj || null, numero: PR.numeroOrc(rl.bruto) || d.numero || null, data: String(d.data || hoje()).slice(0, 10), validade: validadeDoTexto(rl.bruto),
              arquivo_hash: hash, chave: d.chave || null, itens: itens,
              total: d.valor || null, origem: rl.bruto && /<infNFe/i.test(rl.bruto) ? "nota" : "orcamento_loja",
              area: CP.areaPelosItens(itens.map(function (x) { return { item: x.descricao }; })) || "eletrica" };
            var ja = jaLancado(o);
            if (ja) { cx.innerHTML = htmlJa(o, ja); $("[data-abrir]", cx).onclick = function () { abrir(ja); }; return; }
            if (!/^image\//.test(f.type)) return salvar(o, itens, f, cx);
            // foto: a leitura pode errar — confere antes de salvar
            conferir(o, itens, f, cx);
          });
        }).catch(function (e) { cx.innerHTML = "<b>" + esc(f.name) + '</b>: <span class="selo critico">não consegui ler</span> ' + esc(A.msgErro(e)); });
      });
    }, Promise.resolve());
  }
  function cabecalho(o, n) {
    return "<b>" + esc(o.loja || "Loja não identificada") + "</b>" + (o.numero ? " · orçamento nº " + esc(o.numero) : "") + " · " + esc(A.dataSimples(o.data)) +
      " · " + n + " material(is)" + (o.total ? " · total " + A.dinheiro(Number(o.total)) : "");
  }
  function conferir(o, itens, f, cx) {
    cx.innerHTML = cabecalho(o, itens.length) + '<p class="peq mudo" style="margin:4px 0">Foto: confira o nome, a quantidade e o preço (a leitura pode errar) e desmarque o que não vai.</p>' +
      '<div class="tabela-caixa"><table><thead><tr><th></th><th>Material</th><th class="num">Qtd</th><th>Un</th><th class="num">Preço (un.)</th></tr></thead><tbody>' + itens.map(function (x, n) {
        return '<tr data-cf="' + n + '"><td><input type="checkbox" class="cf-ok" checked aria-label="Usar"></td><td><input class="cf-desc" maxlength="300" style="min-width:180px"></td>' +
          '<td><input class="cf-qtd" inputmode="decimal" style="width:70px"></td><td>' + esc(x.un) + '</td><td><input class="cf-unit" inputmode="decimal" style="width:100px"></td></tr>';
      }).join("") + "</tbody></table></div>" +
      '<div class="linha"><select class="cf-area">' + Object.keys(AREAS).map(function (k) { return '<option value="' + k + '"' + (k === o.area ? " selected" : "") + ">" + AREAS[k] + "</option>"; }).join("") +
      '</select><button class="prim cf-salvar">Salvar orçamento</button></div>';
    $$("tr[data-cf]", cx).forEach(function (tr) {
      var x = itens[Number(tr.dataset.cf)];
      $(".cf-desc", tr).value = x.descricao; $(".cf-qtd", tr).value = A.numero(x.qtd, 3); $(".cf-unit", tr).value = x.unit ? A.numero(x.unit, 2) : "";
      tr.oninput = tr.onchange = function () {
        x.ok = $(".cf-ok", tr).checked; x.descricao = $(".cf-desc", tr).value.trim(); x.qtd = A.lerNumero($(".cf-qtd", tr).value) || 1; x.unit = A.lerNumero($(".cf-unit", tr).value);
        x.valor = Math.round(x.qtd * x.unit * 100) / 100;
      };
    });
    $(".cf-salvar", cx).onclick = function () {
      var usar = itens.filter(function (x) { return x.ok && x.descricao; });
      if (!usar.length) { A.avisar("Marque pelo menos um material.", "erro"); return; }
      o.area = $(".cf-area", cx).value;
      if (!o.total) o.total = Math.round(usar.reduce(function (t, x) { return t + (Number(x.valor) || 0); }, 0) * 100) / 100;
      salvar(o, usar, f, cx);
    };
  }
  // guarda o arquivo, põe os materiais no acervo (e no histórico) e grava o orçamento separado
  function subir(f, data) {
    var ehImg = /^image\//.test(f.type || "");
    var pr = ehImg ? A.prepararFoto(f, [], 1600).then(function (bl) { return { bl: bl, ext: "jpg", tipo: "image/jpeg" }; })
      : Promise.resolve(/xml/i.test(f.type) || /\.xml$/i.test(f.name || "") ? { bl: f, ext: "xml", tipo: "text/xml" } : { bl: f, ext: "pdf", tipo: "application/pdf" });
    return pr.then(function (a) {
      var cam = "admin/orcamentos-loja/" + data + "-" + A.uuid() + "." + a.ext;
      return P.q(P.sb.storage.from("fotos").upload(cam, a.bl, { contentType: a.tipo })).then(function () { return cam; });
    }).catch(function () { return null; });
  }
  function salvar(o, itens, f, cx) {
    var PR = window.AGE_PRECOS;
    cx.innerHTML = cabecalho(o, itens.length) + '<div class="peq" style="margin-top:6px"><span class="carregando"></span> Salvando...</div>';
    return guardar(o, itens, f).then(function (r) {
      if (r.repetido) { cx.innerHTML = htmlJa(o, r.repetido); $("[data-abrir]", cx).onclick = function () { abrir(r.repetido); }; return; }
      var nv = r.reg ? novos(r.reg) : r.linhas.filter(function (l) { return l.situacao === "novo"; });
      cx.innerHTML = cabecalho(o, itens.length) +
        '<div class="aviso ok" style="margin-top:6px">✅ ' + (r.reg ? "Orçamento guardado. " : "") + "Acervo: <b>" + r.novos + "</b> material(is) novo(s), <b>" + r.atualizados + "</b> com preço atualizado." +
        (r.semHist ? "<br>⚠ O 📈 histórico não foi gravado: rode o <b>supabase.sql</b> no Supabase (tabela precos_historico)." : "") +
        (r.reg ? "" : "<br>⚠ O orçamento não ficou guardado separado: rode o <b>supabase.sql</b> no Supabase (tabela orcamentos_loja).") + "</div>" +
        (nv.length ? '<div class="peq" style="margin-top:6px"><b>🆕 Entraram no app:</b> ' + nv.map(function (x) { return esc(x.descricao); }).join(" · ") + "</div>" : "") +
        (r.reg ? '<div class="acoes"><button class="peq" data-abrir>Abrir o orçamento</button></div>' : PR.htmlResultado(r));
      if (r.reg) $("[data-abrir]", cx).onclick = function () { abrir(r.reg); };
      A.avisar("🏪 " + (o.loja || "Orçamento") + ": " + r.novos + " material(is) novo(s), " + r.atualizados + " atualizado(s)", "ok");
      listar();
    }).catch(function (e) { cx.innerHTML = cabecalho(o, itens.length) + '<div class="aviso erro">Não salvou: ' + esc(A.msgErro(e)) + "</div>"; });
  }
  // também usado pelo 📷 Ler orçamento da loja dentro do orçamento do cliente (admin.js)
  // o: {loja, cnpj, numero, data, validade, total, area, origem}; itens: [{descricao, qtd, un, unit, valor}]; f: arquivo (opcional)
  // devolve o resultado do acervo (guardarDaLoja) + reg (o orçamento gravado; null sem a tabela ou se já estava lançado)
  function guardar(o, itens, f) {
    var PR = window.AGE_PRECOS, S = P.S;
    var area = o.area === "pintura" ? "pintura" : "eletrica";
    return (o.arquivo_hash || !f ? Promise.resolve(o.arquivo_hash || null) : impressao(f)).then(function (h) {
      o.arquivo_hash = h;
      // repetido: não grava de novo (nem mexe no acervo)
      var ja = jaLancado(Object.assign({}, o, { itens: itens }));
      if (ja) return { linhas: [], novos: 0, atualizados: 0, repetido: ja, reg: ja };
      return PR.guardarDaLoja(P, itens, area, { loja: o.loja, cnpj: o.cnpj, data: o.data, numero: o.numero, origem: o.origem }).then(function (r) {
        if (S.semOrcLoja) { r.reg = null; return r; }
        var sit = {}; r.linhas.forEach(function (l) { sit[chaveMat(l.descricao)] = l.situacao; });
        var reg = { loja: String(o.loja || "").slice(0, 120), cnpj: o.cnpj || null, numero: o.numero || null, data: o.data || hoje(), validade: o.validade || null, area: area,
          total: o.total ? Math.round(Number(o.total) * 100) / 100 : null, arquivo_hash: o.arquivo_hash || null, chave: o.chave || null,
          itens: itens.map(function (x) {
            return { descricao: x.descricao, qtd: Number(x.qtd) || 1, un: x.un || "un", unit: Math.round((Number(x.unit) || 0) * 100) / 100,
              valor: Math.round((Number(x.valor) || (Number(x.qtd) || 1) * (Number(x.unit) || 0)) * 100) / 100, novo: sit[chaveMat(x.descricao)] === "novo" };
          }) };
        function gravar(d) { return P.q(P.sb.from("orcamentos_loja").insert(d).select().single()); }
        return (f ? subir(f, reg.data) : Promise.resolve(null)).then(function (cam) {
          reg.arquivo = cam;
          return gravar(reg).catch(function (e) {
            var m = A.msgErro(e) + " " + (e && e.message) + " " + (e && e.code);
            // o banco recusou por ser repetido (outro aparelho lançou antes): busca o que já está
            if (/23505|duplicate|duplicad/i.test(m)) {
              if (cam) P.q(P.sb.storage.from("fotos").remove([cam])).catch(function () { /* fica órfão */ });
              return P.q(P.sb.from("orcamentos_loja").select("*").order("data", { ascending: false }).limit(2000)).then(function (ls) {
                S.orcLoja = ls; var ja2 = jaLancado(reg) || { loja: reg.loja, numero: reg.numero, data: reg.data };
                r.repetido = ja2; r.reg = ja2; return null;
              });
            }
            // banco ainda sem as colunas novas (rode o supabase.sql): grava sem elas
            if (/arquivo_hash|chave/.test(m)) { delete reg.arquivo_hash; delete reg.chave; A.avisar("Rode de novo o supabase.sql no Supabase: falta a trava de orçamento repetido no banco.", "erro"); return gravar(reg); }
            throw e;
          }).then(function (n) {
            if (!n) return r;
            S.orcLoja = [n].concat(lista()).sort(function (a, b) { return String(b.data).localeCompare(String(a.data)) || String(b.criado_em).localeCompare(String(a.criado_em)); });
            r.reg = n; return r;
          }, function () { S.semOrcLoja = true; r.reg = null; return r; });
        });
      });
    });
  }

  // ---------------- abrir um orçamento ----------------
  // menor preço do mesmo material em OUTRA loja (orçamentos lançados, histórico e notas)
  function outras(o, it) {
    var PR = window.AGE_PRECOS, k = chaveMat(it.descricao), vs = [];
    lista().forEach(function (x) {
      if (x.id === o.id) return;
      (x.itens || []).forEach(function (y) { if (chaveMat(y.descricao) === k && y.unit > 0) vs.push({ loja: x.loja, data: x.data, valor: Number(y.unit) }); });
    });
    (PR ? PR.historico(P.S, it.descricao) : []).forEach(function (h) { vs.push(h); });
    vs = vs.filter(function (x) { return !(semAcento(x.loja) === semAcento(o.loja) && String(x.data).slice(0, 10) === String(o.data).slice(0, 10)); });
    return vs.sort(function (a, b) { return a.valor - b.valor; })[0] || null;
  }
  function abrir(o) {
    if (!o) return;
    var itens = o.itens || [], nv = novos(o), PR = window.AGE_PRECOS;
    var maisCaro = 0, j = A.janela(
      '<div class="peq">' + (o.numero ? "Orçamento nº <b>" + esc(o.numero) + "</b> · " : "") + "data " + esc(A.dataSimples(o.data)) +
        (o.validade ? ' · <span class="selo ' + (vencido(o) ? "critico" : "bom") + '">' + selValidade(o) + "</span>" : "") +
        (o.cnpj ? " · CNPJ " + esc(o.cnpj) : "") + (o.area && AREAS[o.area] ? " · " + AREAS[o.area] : "") + "</div>" +
      '<div class="acoes">' + (o.arquivo ? '<button class="peq" id="ol-arquivo">📄 Ver o arquivo da loja</button>' : "") +
        '<button class="peq" id="ol-orc">🧾 Usar num orçamento de cliente</button><button class="peq" id="ol-copiar">📋 Copiar a lista</button><button class="peq perigo" id="ol-apagar">🗑 Excluir</button></div>' +
      (o.validade ? '<p class="peq mudo" style="margin:0">A validade é a que a loja escreveu no orçamento: até essa data ela garante estes preços. Depois, peça um orçamento novo.</p>' : "") +
      (nv.length ? '<div class="cartao" style="margin-top:8px"><div class="linha"><h3 style="margin:0">🆕 Materiais que ainda não tinham no app (' + nv.length + ')</h3><button class="peq dir" id="ol-copiar-novos">📋 Copiar</button></div>' +
        '<p class="peq mudo" style="margin:2px 0 6px">Já foram guardados no acervo da 💲 tabela, com o preço desta loja.</p><ul style="margin:0;padding-left:18px">' +
        nv.map(function (x) { return "<li>" + esc(x.descricao) + ' <span class="peq mudo">· ' + esc(x.un) + " · " + A.dinheiro(x.unit) + "</span></li>"; }).join("") + "</ul></div>" : "") +
      '<div class="tabela-caixa" style="margin-top:8px"><table><thead><tr><th>Material</th><th class="num">Qtd</th><th>Un</th><th class="num">Preço un.</th><th class="num">Total</th><th>Outra loja</th></tr></thead><tbody>' +
      itens.map(function (x) {
        var ot = outras(o, x), dif = ot && x.unit ? Math.round((x.unit - ot.valor) / ot.valor * 100) : 0;
        if (dif > 0) maisCaro++;
        return "<tr><td>" + esc(x.descricao) + (x.novo ? ' <span class="selo atencao">🆕 novo</span>' : "") + '</td><td class="num">' + esc(A.numero(x.qtd, 3)) + "</td><td>" + esc(x.un) +
          '</td><td class="num"><b>' + A.dinheiro(x.unit) + '</b></td><td class="num">' + A.dinheiro(x.valor) + '</td><td class="peq">' +
          (ot ? esc(PR.textoPreco(ot)) + (dif ? ' <span class="selo ' + (dif > 0 ? "critico" : "bom") + '">' + (dif > 0 ? "aqui +" + dif + "%" : "aqui " + dif + "%") + "</span>" : ' <span class="selo">igual</span>') : '<span class="mudo">—</span>') + "</td></tr>";
      }).join("") + '</tbody><tfoot><tr><td colspan="4"><b>Total</b></td><td class="num"><b>' + A.dinheiro(Number(o.total) || itens.reduce(function (t, x) { return t + (Number(x.valor) || 0); }, 0)) + "</b></td><td></td></tr></tfoot></table></div>" +
      '<p class="peq mudo" id="ol-resumo"></p>',
      { titulo: "🏪 " + (o.loja || "Orçamento da loja"), larga: true });
    $("#ol-resumo", j.el).textContent = maisCaro ? "⚠ " + maisCaro + " material(is) mais caro(s) aqui do que em outra loja (em vermelho)." : "Comparado com as outras lojas e notas já lançadas (mesmo nome do material).";
    function texto(ls) { return ls.map(function (x) { return A.numero(x.qtd, 3) + " " + x.un + " | " + x.descricao + " | " + A.numero(x.unit, 2); }).join("\n"); }
    $("#ol-copiar", j.el).onclick = function () { copiar((o.loja || "") + (o.numero ? " nº " + o.numero : "") + " (" + A.dataSimples(o.data) + ")\n" + texto(itens), "Lista copiada"); };
    if ($("#ol-copiar-novos", j.el)) $("#ol-copiar-novos", j.el).onclick = function () { copiar(texto(nv), "Materiais novos copiados"); };
    if ($("#ol-arquivo", j.el)) $("#ol-arquivo", j.el).onclick = function () {
      var w = window.open("", "_blank");
      P.q(P.sb.storage.from("fotos").createSignedUrls([o.arquivo], 600)).then(function (l) { var u = l && l[0] && l[0].signedUrl; if (w) { if (u) w.location = u; else w.close(); } if (!u) A.avisar("Arquivo não encontrado.", "erro"); })
        .catch(function (e) { if (w) w.close(); P.falhou(e); });
    };
    // vira orçamento de materiais para o cliente (o 📷 Ler da nota abre já com estes itens, para pôr o acréscimo)
    $("#ol-orc", j.el).onclick = function () {
      j.fechar();
      P.orcMateriais({ area: o.area, fornecedor: o.loja, comprado_em: o.data, cnpj: o.cnpj, itens: itens.map(function (x) { return { item: x.descricao, qtd: x.qtd, un: x.un, unit: x.unit, valor: x.valor }; }) });
    };
    $("#ol-apagar", j.el).onclick = function () { excluir(o, function () { j.fechar(); }); };
  }

  // 🗑 excluir o orçamento da loja; se foi lançado por engano, pode tirar também do acervo o que entrou por ele
  function excluir(o, depois) {
    if (!o) return;
    var S = P.S, data = String(o.data).slice(0, 10);
    // materiais que entraram por este orçamento e continuam com o preço dele (não foram usados com outro preço depois)
    var doAcervo = novos(o).map(function (i) {
      return (S.precos || []).filter(function (x) { return x.fonte === "Nota" && chaveMat(x.descricao) === chaveMat(i.descricao) && Math.abs(Number(x.valor) - Number(i.unit)) < 0.005; })[0];
    }).filter(Boolean);
    var hist = (S.precosHist || []).filter(function (h) { return semAcento(h.loja) === semAcento(o.loja) && String(h.data).slice(0, 10) === data && (!o.numero || !h.documento || h.documento === o.numero); });
    var j = A.janela('<p style="margin-top:0">Excluir o orçamento de <b>' + esc(o.loja || "loja") + "</b>" + (o.numero ? " nº " + esc(o.numero) : "") + " de " + esc(A.dataSimples(data)) + "?</p>" +
      '<p class="peq mudo">Sai da lista e o arquivo da loja é apagado.</p>' +
      (doAcervo.length || hist.length ? '<label class="marca-linha" style="font-weight:400"><input type="checkbox" id="ex-acervo"> Foi lançado por engano: tirar também ' +
        (doAcervo.length ? "do 💲 acervo os <b>" + doAcervo.length + "</b> material(is) que entraram por ele" : "") + (doAcervo.length && hist.length ? " e " : "") +
        (hist.length ? "do 📈 histórico os <b>" + hist.length + "</b> preço(s) dele" : "") + "</label>" +
        '<p class="peq mudo" style="margin:2px 0 0">Sem marcar, os materiais e os preços continuam no app.</p>' : "") +
      '<div class="acoes"><button class="perigo" id="ex-ok">🗑 Excluir</button><button id="ex-nao">Cancelar</button></div>', { titulo: "🗑 Excluir orçamento da loja" });
    $("#ex-nao", j.el).onclick = function () { j.fechar(); };
    $("#ex-ok", j.el).onclick = function () {
      var b = this, tudo = $("#ex-acervo", j.el) && $("#ex-acervo", j.el).checked;
      A.ocupado(b, true, "Excluindo...");
      P.q(P.sb.from("orcamentos_loja").delete().eq("id", o.id)).then(function () {
        P.tirar(S.orcLoja, o.id);
        if (o.arquivo) P.q(P.sb.storage.from("fotos").remove([o.arquivo])).catch(function () { /* o arquivo fica órfão: sem problema */ });
        if (!tudo) return;
        var ids = doAcervo.map(function (x) { return x.id; }), hids = hist.map(function (h) { return h.id; }).filter(Boolean);
        return Promise.all([
          ids.length ? P.q(P.sb.from("precos").delete().in("id", ids)).then(function () { ids.forEach(function (id) { P.tirar(S.precos, id); }); }) : null,
          hids.length ? P.q(P.sb.from("precos_historico").delete().in("id", hids)).then(function () { S.precosHist = S.precosHist.filter(function (h) { return hids.indexOf(h.id) < 0; }); }) : null
        ]);
      }).then(function () {
        j.fechar(); if (depois) depois(); listar();
        A.avisar("🗑 Orçamento excluído" + (tudo ? " (e o que entrou por ele no acervo)" : ""), "ok");
      }).catch(function (e) { A.ocupado(b, false); P.falhou(e); });
    };
  }

  window.AGE_ORCLOJA = { ver: ver, guardar: function (ctx, o, itens, f) { P = ctx; return guardar(o, itens, f); }, jaLancado: function (ctx, o) { P = ctx; return jaLancado(o); }, validadeDoTexto: validadeDoTexto };
})();
