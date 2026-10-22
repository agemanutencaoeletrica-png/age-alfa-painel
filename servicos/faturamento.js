// Painel do dono — 💼 NOTAS E RESULTADO: notas fiscais de serviço emitidas aos clientes (a receber / recebido) e o
// resultado de cada obra/cliente: quanto entrou (notas) menos o que saiu em material, mão de obra e despesas avulsas.
// A obra/cliente é a mesma das Compras ("Para onde foi") e dos Pagamentos ("Obra / cliente"): uma obra do app ou um nome (ex.: DEVA).
// Usa as funções do admin.js (P).
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null;
  var filtro = { aba: "notas", periodo: "ano", busca: "", sit: "" };

  function dinheiro(v) { return A.dinheiro(Number(v) || 0); }
  function num2(v) { return v || v === 0 ? Number(v).toFixed(2).replace(".", ",") : ""; }
  function semAcento(t) { return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function norm(t) { return semAcento(t).replace(/\(.*?\)/g, " ").replace(/[^a-z0-9]+/g, " ").replace(/\b(ltda|me|epp|eireli|sa|s a)\b/g, " ").replace(/\s+/g, " ").trim(); }

  // ---------------- obra / cliente (centro de custo) ----------------
  function rotuloObra(o) { return o.cliente + (o.chamado ? " · chamado " + o.chamado : ""); }
  function obraPorTexto(t) { t = String(t || "").trim(); return t ? (P.S.obras || []).filter(function (o) { return rotuloObra(o) === t; })[0] || null : null; }
  // texto digitado -> { obra_id, destino }
  function resolver(t) { var o = obraPorTexto(t); return o ? { obra_id: o.id, destino: null } : { obra_id: null, destino: String(t || "").trim() || null }; }
  function rotuloDe(x) { var o = x && x.obra_id ? P.porId(P.S.obras, x.obra_id) : null; return o ? rotuloObra(o) : (x && x.destino) || ""; }
  // chave do resultado: a obra do app, ou o nome escrito (sem diferença de maiúscula/acento/parênteses: "DEVA IVECO (contagem)" = "Deva Iveco")
  function chave(x) { var o = x && x.obra_id ? P.porId(P.S.obras, x.obra_id) : null; if (o) return "o:" + o.id; var n = norm(x && x.destino); return n ? "d:" + n : ""; }
  function opcoes() {
    var v = {};
    (P.S.obras || []).slice().sort(function (a, b) { return String(b.criado_em).localeCompare(String(a.criado_em)); }).slice(0, 400).forEach(function (o) { v[rotuloObra(o)] = 1; });
    [].concat(P.S.compras || [], P.S.pag || [], P.S.receitas || []).forEach(function (x) { if (x.destino) v[x.destino] = 1; });
    return Object.keys(v);
  }
  function datalist(id) { return '<datalist id="' + id + '">' + opcoes().map(function (t) { return '<option value="' + esc(t) + '">'; }).join("") + "</datalist>"; }

  // ---------------- leitura da nota fiscal de serviço (NFS-e: foto, PDF ou XML) ----------------
  function lerNFSe(texto) {
    var t = String(texto || "").replace(/\r/g, ""), r = {};
    if (/<\s*(?:\w+:)?(?:CompNfse|Nfse|InfNfse|ValorServicos)\b/i.test(t)) {   // XML (padrão ABRASF)
      var tag = function (n) { var m = t.match(new RegExp("<\\s*(?:\\w+:)?" + n + "\\b[^>]*>([^<]*)<", "i")); return m ? m[1].trim() : ""; };
      r.valor = Number(tag("ValorLiquidoNfse") || tag("ValorServicos")) || null;
      r.numero = tag("Numero") ? String(Number(tag("Numero")) || tag("Numero")) : "";
      r.data = (tag("DataEmissao") || tag("DataEmissaoRps")).slice(0, 10);
      var mt = t.match(/<\s*(?:\w+:)?(?:Tomador|TomadorServico)\b[\s\S]*?<\s*(?:\w+:)?RazaoSocial\b[^>]*>([^<]*)</i);
      r.tomador = mt ? mt[1].trim() : "";
      r.descricao = tag("Discriminacao").slice(0, 300);
      return r;
    }
    var ls = t.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
    var vals = function (x) { return (String(x).match(/\d{1,3}(?:\.\d{3})*,\d{2}(?![\d\/])/g) || []).map(A.lerNumero).filter(function (n) { return n > 0; }); };
    var rot = /valor\s+l[ií]quido(?:\s+da\s+nota)?|valor\s+(?:total\s+)?(?:do|dos)\s+servi[cç]os?|valor\s+total\s+da\s+nota|valor\s+da\s+nota|total\s+da\s+nota|valor\s+total/i;
    var achou = null;
    ls.forEach(function (x, i) {
      if (achou !== null || !rot.test(x)) return;
      var v = vals(x.slice(x.search(rot)));
      if (!v.length && ls[i + 1]) v = vals(ls[i + 1]);
      if (v.length) achou = v[v.length - 1];
    });
    if (achou === null) { var tod = vals(t); if (tod.length) { achou = Math.max.apply(null, tod); r.valorIncerto = true; } }
    r.valor = achou;
    var mn = t.match(/n[uú]mero\s+da\s+(?:nfs-?e|nota)[^\d]{0,14}(\d{1,15})/i) || t.match(/nfs-?e\s*(?:n[º°o.]|n[uú]mero)?\s*:?\s*(\d{1,15})/i) || t.match(/\bn[º°o]\s*:?\s*(\d{2,15})/i);
    if (mn) r.numero = String(Number(mn[1]));
    var reD = /(\d{2})\/(\d{2})\/(\d{4})/g, md, ds = [];
    while ((md = reD.exec(t))) { var mes = Number(md[2]), dia = Number(md[1]), ano = Number(md[3]); if (ano >= 2020 && mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) ds.push({ iso: md[3] + "-" + md[2] + "-" + md[1], em: /emiss|compet/i.test(t.slice(Math.max(0, md.index - 50), md.index)) }); }
    var dE = ds.filter(function (x) { return x.em; })[0] || ds[0];
    if (dE) r.data = dE.iso;
    // tomador: o nome depois de "TOMADOR" (a razão social), sem os rótulos
    var iT = -1;
    for (var i = 0; i < ls.length; i++) if (/tomador/i.test(ls[i])) { iT = i; break; }
    if (iT >= 0) for (var k = iT; k < Math.min(ls.length, iT + 6) && !r.tomador; k++) {
      var x2 = ls[k].replace(/.*?(?:raz[aã]o\s+social|nome(?:\s*\/\s*raz[aã]o\s+social)?)\s*:?\s*/i, k === iT && !/raz[aã]o|nome/i.test(ls[k]) ? "\u0000" : "");
      if (x2.indexOf("\u0000") >= 0) continue;
      x2 = x2.replace(/\b(cpf|cnpj|inscri|endere|munic|telefone|e-?mail)\b.*$/i, "").trim();
      if (/[A-Za-zÀ-ú]{3,}\s+[A-Za-zÀ-ú]{2,}/.test(x2) && !/tomador|prestador/i.test(x2)) r.tomador = x2.slice(0, 120);
    }
    var mdesc = t.match(/discrimina[cç][aã]o\s+(?:dos\s+)?servi[cç]os?\s*:?\s*\n?([^\n]{5,300})/i);
    if (mdesc) r.descricao = mdesc[1].trim();
    return r;
  }
  // tomador da nota -> obra/cliente já usado (pela 1ª palavra forte do nome: "DEVA VEICULOS LTDA" -> "DEVA IVECO (contagem)")
  function sugerirObra(tomador) {
    var pal = norm(tomador).split(" ").filter(function (w) { return w.length >= 4 && !/^(comercio|comercial|servicos|industria|empresa|brasil|distribuidora|veiculos|supermercados?)$/.test(w); });
    if (!pal.length) return "";
    return opcoes().filter(function (o) { var n = norm(o); return pal.some(function (w) { return (" " + n + " ").indexOf(" " + w + " ") >= 0; }); })[0] || "";
  }

  // ---------------- tela ----------------
  function periodo() {
    var h = new Date(), ini, fim = null;
    if (filtro.periodo === "mes") ini = new Date(h.getFullYear(), h.getMonth(), 1);
    else if (filtro.periodo === "mespassado") { ini = new Date(h.getFullYear(), h.getMonth() - 1, 1); fim = new Date(h.getFullYear(), h.getMonth(), 1); }
    else if (filtro.periodo === "ano") ini = new Date(h.getFullYear(), 0, 1);
    else ini = new Date(2000, 0, 1);
    return { de: A.isoLocal(ini), ate: fim ? A.isoLocal(fim) : "9999-12-31" };
  }
  function ver(c, ctx) {
    P = ctx;
    if (P.S.semReceitas) {
      c.innerHTML = '<div class="cab-secao"><h2>💼 Notas e resultado</h2></div><div class="aviso">Para usar esta parte, rode no Supabase o bloco <b>“Notas de serviço”</b> do <b>supabase.sql</b> e depois <code>notify pgrst, \'reload schema\';</code>' +
        (P.S.erroReceitas ? '<div class="peq mudo" style="margin-top:6px">Erro do banco: ' + esc(P.S.erroReceitas) + "</div>" : "") + "</div>";
      return;
    }
    c.innerHTML = '<div class="cab-secao"><h2>💼 Notas e resultado</h2><span><button class="prim" id="ft-arq-b">📷 Nota de serviço</button> <button id="ft-mao">➕ Lançar à mão</button></span></div>' +
      '<input type="file" id="ft-arq" accept="image/*,application/pdf,.xml,text/xml,application/xml" class="oculto">' +
      '<p class="mudo peq" style="margin-top:-4px">Lance a nota fiscal de serviço que você emitiu (foto, PDF ou XML da prefeitura). Em <b>Resultado por obra</b>: o que entrou menos material, mão de obra e despesas avulsas.</p>' +
      '<div class="filtros">' + [["notas", "🧾 Notas de serviço"], ["resultado", "📊 Resultado por obra"]].map(function (x) { return '<button class="' + (filtro.aba === x[0] ? "prim" : "") + '" data-ftaba="' + x[0] + '">' + x[1] + "</button>"; }).join("") + "</div>" +
      '<div class="filtros"><select id="ft-per" aria-label="Período"><option value="mes">Este mês</option><option value="mespassado">Mês passado</option><option value="ano">Este ano</option><option value="tudo">Tudo</option></select>' +
      (filtro.aba === "notas" ? '<select id="ft-sit" aria-label="Situação"><option value="">Todas</option><option value="areceber">⏳ A receber</option><option value="recebido">✅ Recebidas</option></select>' : "") +
      '<input type="search" id="ft-busca" placeholder="Buscar cliente, obra, nº da nota..."></div><div id="ft-res"></div>';
    $("#ft-per").value = filtro.periodo; if ($("#ft-sit")) $("#ft-sit").value = filtro.sit; $("#ft-busca").value = filtro.busca;
    $$("[data-ftaba]", c).forEach(function (b) { b.onclick = function () { filtro.aba = b.dataset.ftaba; ver(c, P); }; });
    $("#ft-per").onchange = function () { filtro.periodo = this.value; desenhar(); };
    if ($("#ft-sit")) $("#ft-sit").onchange = function () { filtro.sit = this.value; desenhar(); };
    $("#ft-busca").oninput = function () { filtro.busca = this.value; desenhar(); };
    $("#ft-arq-b").onclick = function () { $("#ft-arq").value = ""; $("#ft-arq").click(); };
    $("#ft-arq").onchange = function () { if (this.files[0]) receber(this.files[0], function () { ver(c, P); }); };
    $("#ft-mao").onclick = function () { formulario({}, function () { ver(c, P); }); };
    if (P.atualizarAbas) P.atualizarAbas();
    desenhar();
    function desenhar() { if (filtro.aba === "resultado") resultado($("#ft-res"), function () { ver(c, P); }); else notas($("#ft-res"), function () { ver(c, P); }); }
  }
  function notas(r, mudou) {
    var pr = periodo(), b = semAcento(filtro.busca);
    var ns = P.S.receitas.filter(function (n) {
      if (n.emitida_em < pr.de || n.emitida_em >= pr.ate) return false;
      if (filtro.sit === "areceber" && n.recebido) return false;
      if (filtro.sit === "recebido" && !n.recebido) return false;
      return !b || semAcento([rotuloDe(n), n.cliente, n.numero_nota, n.descricao].join(" ")).indexOf(b) >= 0;
    }).sort(function (a, c) { return c.emitida_em.localeCompare(a.emitida_em); });
    var tot = ns.reduce(function (t, n) { return t + Number(n.valor); }, 0), rec = ns.filter(function (n) { return n.recebido; }).reduce(function (t, n) { return t + Number(n.valor); }, 0);
    r.innerHTML = '<div class="grade"><div class="ladrilho" style="border-left:4px solid var(--prim)"><div class="r">Notas emitidas</div><div class="v" style="font-size:1.3em">' + dinheiro(tot) + '</div><div class="d">' + ns.length + " nota" + (ns.length === 1 ? "" : "s") + "</div></div>" +
      '<div class="ladrilho" style="border-left:4px solid var(--bom)"><div class="r">✅ Recebido</div><div class="v" style="font-size:1.3em">' + dinheiro(rec) + "</div></div>" +
      '<div class="ladrilho" style="border-left:4px solid var(--critico)"><div class="r">⏳ A receber</div><div class="v" style="font-size:1.3em">' + dinheiro(tot - rec) + "</div></div></div>" +
      (ns.length ? '<div class="tabela-caixa"><table><thead><tr><th>Emissão</th><th>Nº</th><th>Cliente / obra</th><th>Serviço</th><th>Situação</th><th class="num">Valor</th><th></th></tr></thead><tbody>' +
        ns.map(function (n) {
          return "<tr><td>" + esc(A.dataSimples(n.emitida_em)) + "</td><td>" + esc(n.numero_nota || "—") + "</td><td><b>" + esc(rotuloDe(n) || n.cliente || "—") + "</b>" + (n.cliente && n.cliente !== rotuloDe(n) ? '<div class="peq mudo">' + esc(n.cliente) + "</div>" : "") +
            '</td><td class="peq">' + esc(String(n.descricao || "").slice(0, 120)) + "</td><td>" +
            (n.recebido ? '<span class="selo bom">✅ recebido' + (n.recebido_em ? " " + esc(A.dataSimples(n.recebido_em)) : "") + "</span>" : '<span class="selo atencao">⏳ a receber</span> <button class="peq" data-ft-rec="' + n.id + '">✔ Recebi</button>') +
            '</td><td class="num"><b>' + dinheiro(n.valor) + "</b></td><td>" + (n.arquivo ? '<button class="peq" data-ft-arq="' + n.id + '">🧾</button> ' : "") + '<button class="peq" data-ft-ed="' + n.id + '">Editar</button></td></tr>';
        }).join("") + '<tr><td colspan="5"><b>Total</b></td><td class="num"><b>' + dinheiro(tot) + "</b></td><td></td></tr></tbody></table></div>"
        : '<div class="cartao vazio">Nenhuma nota de serviço neste período. Toque em 📷 Nota de serviço ou ➕ Lançar à mão.</div>');
    $$("[data-ft-ed]", r).forEach(function (bt) { bt.onclick = function () { formulario({ nota: P.porId(P.S.receitas, bt.dataset.ftEd) }, mudou); }; });
    $$("[data-ft-rec]", r).forEach(function (bt) {
      bt.onclick = function () {
        P.q(P.sb.from("receitas").update({ recebido: true, recebido_em: A.isoLocal(new Date()) }).eq("id", bt.dataset.ftRec).select().single())
          .then(function (n) { P.trocar(P.S.receitas, n); A.avisar("✅ Recebido: " + dinheiro(n.valor), "ok"); mudou(); }).catch(P.falhou);
      };
    });
    $$("[data-ft-arq]", r).forEach(function (bt) { bt.onclick = function () { abrirArquivo(P.porId(P.S.receitas, bt.dataset.ftArq).arquivo); }; });
  }
  function abrirArquivo(cam) {
    var w = window.open("", "_blank");
    P.q(P.sb.storage.from("fotos").createSignedUrls([cam], 600)).then(function (l) { var u = l && l[0] && l[0].signedUrl; if (w) { if (u) w.location = u; else w.close(); } if (!u) A.avisar("Arquivo não encontrado.", "erro"); })
      .catch(function (e) { if (w) w.close(); P.falhou(e); });
  }

  // ---------------- receber arquivo e formulário ----------------
  function receber(f, depois) {
    var j = A.janela('<div class="peq" id="ft-st">📖 Lendo a nota de serviço...</div>', { titulo: "🧾 Nota de serviço" });
    window.AGE_PAG.lerArquivo(f).then(function (r) {
      j.fechar();
      var d = lerNFSe(r.texto);
      formulario({ lida: d, arquivo: f, bruto: r.texto }, depois);
    }).catch(function () { j.fechar(); formulario({ arquivo: f, erro: true }, depois); });
  }
  function formulario(op, depois) {
    var n0 = op.nota || null, d = op.lida || {};
    var obraTxt = n0 ? rotuloDe(n0) : sugerirObra(d.tomador);
    var j = A.janela(
      (op.erro ? '<div class="aviso erro">Não consegui ler o arquivo. Preencha à mão.</div>' : "") +
      (op.lida && (d.valorIncerto || !d.valor) ? '<div class="aviso">⚠️ Não achei o valor da nota com clareza: <b>confira o valor</b>.</div>' : "") +
      (op.lida && d.tomador ? '<div class="peq mudo">Tomador na nota: <b>' + esc(d.tomador) + "</b></div>" : "") +
      (op.bruto ? '<details class="peq" style="margin:4px 0"><summary>🔍 ver o texto que o app leu</summary><pre style="white-space:pre-wrap;max-height:200px;overflow:auto;font-size:11px">' + esc(String(op.bruto).slice(0, 5000)) + "</pre></details>" : "") +
      '<label for="ft-obra">Cliente / obra (o mesmo de “Para onde foi” nas compras)</label><input id="ft-obra" list="ft-dl" maxlength="200" placeholder="Ex.: DEVA IVECO (contagem)">' + datalist("ft-dl") +
      '<div class="duas"><div><label for="ft-num">Nº da nota</label><input id="ft-num" maxlength="30" inputmode="numeric"></div><div><label for="ft-data">Emissão</label><input type="date" id="ft-data"></div></div>' +
      '<label for="ft-valor">Valor da nota (R$)</label><input id="ft-valor" inputmode="decimal">' +
      '<label for="ft-desc">Serviço</label><input id="ft-desc" maxlength="300" placeholder="Ex.: pintura das faixas amarelas e demarcações de combate a incêndio">' +
      '<div class="duas"><div><label class="marca-linha" style="margin-top:28px"><input type="checkbox" id="ft-rec"> ✅ Já recebi</label></div><div id="ft-rec-c"><label for="ft-rec-em">Recebido em</label><input type="date" id="ft-rec-em"></div></div>' +
      '<div id="ft-erro"></div><div class="acoes"><button class="prim" id="ft-salvar">Salvar</button>' + (n0 ? '<button class="perigo" id="ft-apagar">Apagar</button>' : "") + "</div>",
      { titulo: n0 ? "🧾 Nota de serviço" : "🧾 Nova nota de serviço", larga: true });
    var el = j.el;
    $("#ft-obra", el).value = obraTxt || (n0 ? n0.cliente || "" : "");
    $("#ft-num", el).value = n0 ? n0.numero_nota || "" : d.numero || "";
    $("#ft-data", el).value = n0 ? n0.emitida_em : d.data || A.isoLocal(new Date());
    $("#ft-valor", el).value = num2(n0 ? n0.valor : d.valor);
    $("#ft-desc", el).value = n0 ? n0.descricao || "" : d.descricao || "";
    $("#ft-rec", el).checked = n0 ? !!n0.recebido : false;
    $("#ft-rec-em", el).value = n0 && n0.recebido_em ? n0.recebido_em : A.isoLocal(new Date());
    var verRec = function () { $("#ft-rec-c", el).classList.toggle("oculto", !$("#ft-rec", el).checked); };
    $("#ft-rec", el).onchange = verRec; verRec();
    $("#ft-salvar", el).onclick = function () {
      var b = this, v = A.lerNumero($("#ft-valor", el).value), txt = $("#ft-obra", el).value.trim();
      var erro = !txt ? "Informe o cliente / obra." : !(v > 0) ? "Informe o valor da nota." : !$("#ft-data", el).value ? "Informe a data de emissão." : "";
      if (erro) { $("#ft-erro", el).innerHTML = '<div class="aviso erro">' + erro + "</div>"; return; }
      var rs = resolver(txt), rec = $("#ft-rec", el).checked;
      var dados = { obra_id: rs.obra_id, destino: rs.destino, cliente: (n0 && n0.cliente) || d.tomador || txt, numero_nota: $("#ft-num", el).value.trim() || null, emitida_em: $("#ft-data", el).value,
        valor: v, descricao: $("#ft-desc", el).value.trim() || null, recebido: rec, recebido_em: rec ? $("#ft-rec-em", el).value || A.isoLocal(new Date()) : null };
      // mesma nota lançada duas vezes (mesmo número e valor)
      var rep = dados.numero_nota && P.S.receitas.filter(function (x) { return x.id !== (n0 && n0.id) && x.numero_nota === dados.numero_nota && Math.abs(Number(x.valor) - v) < 0.01; })[0];
      if (rep && b.dataset.confirmou !== "1") { $("#ft-erro", el).innerHTML = '<div class="aviso erro">⚠️ A nota nº ' + esc(rep.numero_nota) + " de " + dinheiro(rep.valor) + " já foi lançada (" + esc(rotuloDe(rep)) + ").</div>"; b.dataset.confirmou = "1"; b.textContent = "Salvar mesmo assim"; return; }
      A.ocupado(b, true, "Salvando...");
      var f = op.arquivo, pArq = !f ? Promise.resolve(null) : (/^image\//.test(f.type) ? A.prepararFoto(f, [], 1800).then(function (bl) { return { bl: bl, ext: "jpg", tipo: "image/jpeg" }; })
        : Promise.resolve({ bl: f, ext: /pdf/.test(f.type) ? "pdf" : "xml", tipo: f.type || "application/octet-stream" })).then(function (a) {
          var cam = "admin/receitas/" + dados.emitida_em + "-" + A.uuid() + "." + a.ext;
          return P.q(P.sb.storage.from("fotos").upload(cam, a.bl, { contentType: a.tipo })).then(function () { return cam; });
        }).catch(function () { return null; });   // sem o arquivo, a nota é salva do mesmo jeito
      pArq.then(function (cam) {
        if (cam) dados.arquivo = cam;
        return P.q(n0 ? P.sb.from("receitas").update(dados).eq("id", n0.id).select().single() : P.sb.from("receitas").insert(dados).select().single());
      }).then(function (n) {
        P.trocar(P.S.receitas, n); j.fechar();
        if (n.emitida_em < periodo().de) filtro.periodo = "tudo";
        A.avisar("🧾 Nota de serviço salva: " + rotuloDe(n) + " · " + dinheiro(n.valor), "ok");
        if (depois) depois();
      }).catch(function (e) { A.ocupado(b, false); $("#ft-erro", el).innerHTML = '<div class="aviso erro">' + esc(A.msgErro(e)) + "</div>"; });
    };
    if ($("#ft-apagar", el)) $("#ft-apagar", el).onclick = function () {
      if (!A.confirmar("Apagar esta nota de serviço?")) return;
      P.q(P.sb.from("receitas").delete().eq("id", n0.id)).then(function () { P.tirar(P.S.receitas, n0.id); j.fechar(); if (depois) depois(); }).catch(P.falhou);
    };
  }

  // ---------------- resultado por obra ----------------
  function montar() {
    var pr = periodo(), g = {};
    var grupo = function (k, nome) { return g[k] = g[k] || { k: k, nome: nome, notas: [], compras: [], desp: [], pags: [], recebido: 0, notasV: 0, mat: 0, mo: 0, av: 0, portal: 0 }; };
    var nomeK = function (x) { return rotuloDe(x) || "Sem obra definida"; };
    P.S.receitas.forEach(function (n) { if (n.emitida_em < pr.de || n.emitida_em >= pr.ate) return; var x = grupo(chave(n) || "-", nomeK(n)); x.notas.push(n); x.notasV += Number(n.valor); if (n.recebido) x.recebido += Number(n.valor); });
    (P.S.compras || []).forEach(function (c) {
      if (c.comprado_em < pr.de || c.comprado_em >= pr.ate) return;
      var x = grupo(chave(c) || "-", nomeK(c));
      if (c.tipo === "despesa") { x.desp.push(c); x.av += Number(c.valor); } else { x.compras.push(c); x.mat += Number(c.valor); }
    });
    (P.S.pag || []).forEach(function (p) {
      var dt = A.isoLocal(new Date(p.pago_em));
      if (dt < pr.de || dt >= pr.ate) return;
      var x = grupo(chave(p) || "-", nomeK(p)); x.pags.push(p); x.mo += Number(p.valor);
    });
    // chamados com valor no portal (Supermercados BH) e sem nota de serviço lançada: o valor do chamado conta como entrada
    Object.keys(g).forEach(function (k) {
      var x = g[k];
      if (/^o:/.test(k) && !x.notas.length) { var o = P.porId(P.S.obras, k.slice(2)); if (o && o.portal && Number(o.portal.valor) > 0) x.portal = Number(o.portal.valor); }
      x.entrada = x.notasV || x.portal; x.gastos = x.mat + x.mo + x.av; x.lucro = x.entrada - x.gastos; x.margem = x.entrada ? x.lucro / x.entrada * 100 : null;
    });
    return Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return (a.k === "-") - (b.k === "-") || b.entrada - a.entrada || b.gastos - a.gastos; });
  }
  function pct(v) { return v === null ? "—" : (Math.round(v * 10) / 10).toString().replace(".", ",") + "%"; }
  function resultado(r, mudou) {
    var b = semAcento(filtro.busca), ls = montar().filter(function (x) { return !b || semAcento(x.nome).indexOf(b) >= 0; });
    var T = ls.filter(function (x) { return x.k !== "-"; }).reduce(function (t, x) { t.e += x.entrada; t.m += x.mat; t.o += x.mo; t.a += x.av; return t; }, { e: 0, m: 0, o: 0, a: 0 });
    var sem = ls.filter(function (x) { return x.k === "-"; })[0];
    r.innerHTML = (ls.length ? '<div class="tabela-caixa"><table><thead><tr><th>Obra / cliente</th><th class="num">Notas (entrada)</th><th class="num">🧱 Materiais</th><th class="num">👷 Mão de obra</th><th class="num">⛽ Avulsos</th><th class="num">Resultado</th><th class="num">Margem</th><th></th></tr></thead><tbody>' +
      ls.map(function (x, i) {
        return "<tr" + (x.k === "-" ? ' class="mudo"' : "") + "><td><b>" + esc(x.nome) + "</b>" + (x.portal && !x.notasV ? '<div class="peq mudo">valor do chamado no portal</div>' : x.notasV && x.recebido < x.notasV ? '<div class="peq"><span class="selo atencao">a receber ' + dinheiro(x.notasV - x.recebido) + "</span></div>" : "") +
          '</td><td class="num">' + (x.entrada ? dinheiro(x.entrada) : "—") + '</td><td class="num">' + dinheiro(x.mat) + '</td><td class="num">' + dinheiro(x.mo) + '</td><td class="num">' + dinheiro(x.av) +
          '</td><td class="num"><b style="color:var(--' + (x.lucro < 0 ? "critico" : "bom") + ')">' + (x.entrada ? dinheiro(x.lucro) : "—") + '</b></td><td class="num">' + (x.entrada ? pct(x.margem) : "—") +
          '</td><td><button class="peq" data-ft-res="' + i + '">Ver</button></td></tr>';
      }).join("") +
      '<tr><td><b>Total (com obra)</b></td><td class="num"><b>' + dinheiro(T.e) + '</b></td><td class="num">' + dinheiro(T.m) + '</td><td class="num">' + dinheiro(T.o) + '</td><td class="num">' + dinheiro(T.a) +
      '</td><td class="num"><b>' + dinheiro(T.e - T.m - T.o - T.a) + '</b></td><td class="num">' + (T.e ? pct((T.e - T.m - T.o - T.a) / T.e * 100) : "—") + "</td><td></td></tr></tbody></table></div>" +
      (sem ? '<div class="aviso">⚠️ ' + dinheiro(sem.gastos + sem.notasV) + ' estão <b>sem obra definida</b> (compras sem “Para onde foi” ou pagamentos sem “Obra / cliente”). Toque em <b>Ver</b> na linha e informe a obra para entrarem no resultado certo.</div>' : "") +
      '<div class="acoes"><button id="ft-csv">⬇ Planilha (CSV)</button></div>'
      : '<div class="cartao vazio">Nada neste período. Lance notas de serviço aqui, as compras em 🧾 Compras (com “Para onde foi”) e os pagamentos da equipe com a obra.</div>');
    $$("[data-ft-res]", r).forEach(function (bt) { bt.onclick = function () { detalhe(ls[Number(bt.dataset.ftRes)], mudou); }; });
    if ($("#ft-csv", r)) $("#ft-csv", r).onclick = function () { baixarCsv(ls); };
  }
  function textoResultado(x) {
    return "*" + ((A.CFG.EMPRESA || {}).nome || "AGE") + " — Resultado: " + x.nome + "*\n" +
      (x.notasV ? "🧾 Notas de serviço: " + dinheiro(x.notasV) + (x.recebido < x.notasV ? " (recebido " + dinheiro(x.recebido) + ")" : "") : x.portal ? "🧾 Valor do chamado: " + dinheiro(x.portal) : "🧾 Notas de serviço: —") +
      "\n🧱 Materiais: " + dinheiro(x.mat) + "\n👷 Mão de obra: " + dinheiro(x.mo) + "\n⛽ Avulsos (gasolina, lanche e outros): " + dinheiro(x.av) +
      "\nTotal de gastos: " + dinheiro(x.gastos) + (x.entrada ? "\n*Resultado: " + dinheiro(x.lucro) + " (" + pct(x.margem) + ")*" : "");
  }
  function detalhe(x, mudou) {
    var linha = function (dt, txt, v, extra) { return "<tr><td>" + esc(A.dataSimples(dt)) + "</td><td>" + txt + '</td><td class="num">' + dinheiro(v) + "</td><td>" + (extra || "") + "</td></tr>"; };
    var obraSel = function (tab, id) { return x.k === "-" ? '<button class="peq" data-ft-obra="' + tab + ":" + id + '">📍 Informar obra</button>' : ""; };
    var sec = function (tit, v, linhas) { return linhas.length ? '<h3 style="margin:12px 0 4px">' + tit + " · " + dinheiro(v) + '</h3><div class="tabela-caixa"><table><tbody>' + linhas.join("") + "</tbody></table></div>" : ""; };
    var j = A.janela('<div class="grade">' +
      [["🧾 Entrada", x.entrada, "prim"], ["🧱 Materiais", x.mat, "pintura"], ["👷 Mão de obra", x.mo, "eletrica"], ["⛽ Avulsos", x.av, "atencao"], ["Resultado" + (x.entrada ? " (" + pct(x.margem) + ")" : ""), x.lucro, x.lucro < 0 ? "critico" : "bom"]].map(function (y) {
        return '<div class="ladrilho" style="border-left:4px solid var(--' + y[2] + ')"><div class="r">' + y[0] + '</div><div class="v" style="font-size:1.2em">' + dinheiro(y[1]) + "</div></div>";
      }).join("") + "</div>" +
      sec("🧾 Notas de serviço", x.notasV, x.notas.map(function (n) { return linha(n.emitida_em, "Nota " + esc(n.numero_nota || "s/ nº") + (n.descricao ? " · " + esc(n.descricao.slice(0, 80)) : "") + (n.recebido ? ' <span class="selo bom">recebida</span>' : ' <span class="selo atencao">a receber</span>'), n.valor); })) +
      (x.portal && !x.notasV ? '<div class="peq mudo" style="margin-top:8px">Entrada pelo valor do chamado no portal: ' + dinheiro(x.portal) + "</div>" : "") +
      sec("🧱 Materiais", x.mat, x.compras.map(function (c) { return linha(c.comprado_em, esc(c.fornecedor || "Loja") + (c.itens && c.itens.length ? '<div class="peq mudo">' + esc(c.itens.map(function (y) { return y.item; }).join(", ").slice(0, 120)) + "</div>" : ""), c.valor, obraSel("compras", c.id)); })) +
      sec("👷 Mão de obra", x.mo, x.pags.map(function (p) { return linha(A.isoLocal(new Date(p.pago_em)), esc(P.nomeFunc(p.funcionario_id) || p.favorecido || "—") + (p.descricao ? " · " + esc(p.descricao) : ""), p.valor, obraSel("pagamentos", p.id)); })) +
      sec("⛽ Avulsos", x.av, x.desp.map(function (c) { return linha(c.comprado_em, esc(c.fornecedor || "") + " " + esc(c.descricao || ""), c.valor, obraSel("compras", c.id)); })) +
      (x.k !== "-" ? '<div class="acoes"><button class="prim" id="ft-comp">📤 Compartilhar resultado</button></div>' : ""), { titulo: "📊 " + x.nome, larga: true });
    var el = j.el;
    if ($("#ft-comp", el)) $("#ft-comp", el).onclick = function () { A.compartilhar({ titulo: "Resultado " + x.nome, texto: textoResultado(x) }); };
    $$("[data-ft-obra]", el).forEach(function (bt) {
      bt.onclick = function () {
        var p = bt.dataset.ftObra.split(":"), t = window.prompt("Obra / cliente deste lançamento (ex.: " + (opcoes()[0] || "DEVA") + "):", "");
        if (!t) return;
        var rs = resolver(t), lista = p[0] === "compras" ? P.S.compras : P.S.pag;
        P.q(P.sb.from(p[0]).update(rs).eq("id", p[1]).select().single()).then(function (n) { P.trocar(lista, n); j.fechar(); A.avisar("📍 Obra informada: " + t, "ok"); if (mudou) mudou(); }).catch(P.falhou);
      };
    });
  }
  function baixarCsv(ls) {
    var cel = function (x) { x = String(x === null || x === undefined ? "" : x); return /[;"\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
    var r2 = function (v) { return Number(v || 0).toFixed(2).replace(".", ","); };
    var linhas = [["Obra / cliente", "Notas de serviço (R$)", "Recebido (R$)", "Valor do chamado (R$)", "Materiais (R$)", "Mão de obra (R$)", "Avulsos (R$)", "Total de gastos (R$)", "Resultado (R$)", "Margem (%)"]];
    ls.forEach(function (x) { linhas.push([x.nome, r2(x.notasV), r2(x.recebido), r2(x.portal), r2(x.mat), r2(x.mo), r2(x.av), r2(x.gastos), x.entrada ? r2(x.lucro) : "", x.margem === null ? "" : r2(x.margem)]); });
    var csv = "\ufeff" + linhas.map(function (l) { return l.map(cel).join(";"); }).join("\r\n");
    P.baixar(new Blob([csv], { type: "text/csv;charset=utf-8" }), "resultado-obras-" + A.isoLocal(new Date()) + ".csv");
  }

  window.AGE_FAT = { ver: ver, lerNFSe: lerNFSe, resolver: function (ctx, t) { P = ctx; return resolver(t); }, rotuloDe: function (ctx, x) { P = ctx; return rotuloDe(x); },
    datalist: function (ctx, id) { P = ctx; return datalist(id); }, aReceber: function (S) { return (S.receitas || []).filter(function (n) { return !n.recebido; }); } };
})();
