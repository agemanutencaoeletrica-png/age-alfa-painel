// Painel do dono — serviços para PREFEITURAS (órgãos públicos):
// prefeituras, contratos (planilha de preços), ordens de serviço (OS) com nº de
// protocolo, fotos antes/depois e assinatura do fiscal, relatório fotográfico em
// PDF e planilha de medição (PDF e Excel). Usa as funções do admin.js (P).
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null;
  var sub = "os";
  var filtro = { pref: "", st: "ativas", tipo: "", busca: "" };
  var TIPO = { predio: "🏫 Prédio público", iluminacao: "💡 Iluminação pública", obra: "🏗️ Obra / reforma" };
  var TIPO_TX = { predio: "Prédio público", iluminacao: "Iluminação pública", obra: "Obra / reforma" };
  var STATUS_MED = { rascunho: "Rascunho", enviada: "Enviada à prefeitura", aprovada: "Aprovada", paga: "Paga" };
  var COR_MED = { rascunho: "", enviada: "atencao", aprovada: "bom", paga: "bom" };

  function ver(c, ctx) {
    P = ctx;
    if (P.S.semPref) {
      c.innerHTML = '<div class="cab-secao"><h2>🏛️ Prefeitura</h2></div><div class="aviso">Para usar esta área, rode de novo o arquivo <b>supabase.sql</b> no Supabase ' +
        "(SQL Editor → colar tudo → Run). Ele cria as tabelas de prefeituras, contratos e medições sem apagar nada. Depois toque em ↻.</div>";
      return;
    }
    var abas = [["os", "Ordens de serviço"], ["medicoes", "Medições"], ["licitacoes", "Licitações"], ["contratos", "Contratos"], ["documentos", "Documentos"], ["prefeituras", "Prefeituras"]];
    c.innerHTML = '<div class="cab-secao"><h2>🏛️ Prefeitura</h2></div><div class="filtros" id="pf-abas">' +
      abas.map(function (a) { return '<button class="' + (a[0] === sub ? "prim" : "") + '" data-sub="' + a[0] + '">' + a[1] + "</button>"; }).join("") +
      '</div><div id="pf-corpo"></div>';
    $$("[data-sub]", c).forEach(function (b) { b.onclick = function () { sub = b.dataset.sub; ver(c, P); }; });
    var corpo = $("#pf-corpo", c);
    ({ os: verOS, medicoes: verMedicoes, licitacoes: verLicitacoes, contratos: verContratos, documentos: verDocumentos, prefeituras: verPrefeituras })[sub](corpo, c);
  }
  function redesenhar() { if ((location.hash.slice(1) || "hoje") === "prefeitura") P.rota(); }

  // ---------- utilidades ----------
  function semAcento(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }
  function nomePref(id) { var p = P.porId(P.S.pref, id); return p ? p.nome : "—"; }
  function contratosDe(prefId) { return P.S.contr.filter(function (k) { return k.prefeitura_id === prefId; }); }
  function partesDe(obraId) { return P.S.serv.filter(function (s) { return s.obra_id === obraId; }); }
  function relsDe(obraId) {
    var ids = partesDe(obraId).map(function (s) { return s.id; });
    return P.S.rel.filter(function (r) { return ids.indexOf(r.servico_id) >= 0; });
  }
  function osConcluida(o) {
    var ps = partesDe(o.id).filter(function (s) { return s.status !== "cancelado"; });
    return ps.length > 0 && ps.every(function (s) { return s.status === "concluido"; });
  }
  function dataConclusao(o) {
    var d = partesDe(o.id).map(function (s) { return s.concluido_em; }).filter(Boolean).sort();
    return d.length ? d[d.length - 1] : null;
  }
  function medicaoDaObra(obraId, excetoId) {
    return P.S.med.filter(function (m) { return m.id !== excetoId && (m.obras || []).indexOf(obraId) >= 0; })[0] || null;
  }
  function seqMedicao(m) {
    var lista = P.S.med.filter(function (x) { return x.contrato_id === m.contrato_id; }).sort(function (a, b) { return a.numero - b.numero; });
    return lista.findIndex(function (x) { return x.id === m.id; }) + 1;
  }
  function rotuloContrato(k) { return "Contrato " + k.numero + (k.objeto ? " – " + (k.objeto.length > 50 ? k.objeto.slice(0, 50) + "…" : k.objeto) : ""); }
  function arred(v) { return Math.round((Number(v) || 0) * 100) / 100; }
  function chaveItem(i) { return i.codigo ? "c:" + semAcento(i.codigo) : "d:" + semAcento(i.descricao); }
  function totalMed(itens, bdi) {
    var bruto = itens.reduce(function (t, i) { return t + arred((Number(i.qtd) || 0) * (Number(i.valor) || 0)); }, 0);
    return { bruto: arred(bruto), bdi: arred(bruto * (Number(bdi) || 0) / 100), total: arred(bruto * (1 + (Number(bdi) || 0) / 100)) };
  }
  function medidoContrato(contratoId) {
    return arred(P.S.med.filter(function (m) { return m.contrato_id === contratoId; }).reduce(function (t, m) { return t + Number(m.total || 0); }, 0));
  }
  function provas(o) {
    var rels = relsDe(o.id);
    return {
      antes: rels.some(function (r) { return (r.fotos_antes || []).length; }),
      depois: rels.some(function (r) { return (r.fotos || []).length; }),
      assin: rels.some(function (r) { return r.assinatura; }),
      med: medicaoDaObra(o.id)
    };
  }
  function chk(ok, txt) { return '<span class="selo ' + (ok ? "bom" : "critico") + '">' + (ok ? "✔ " : "✖ ") + txt + "</span>"; }
  function baixarArquivo(blob, nome) { P.baixar(blob, nome); }
  function nomeArq(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60); }
  function entregarPdf(blob, nome, titulo) {
    var pode = P.podeCompartilharArquivo();
    var j = A.janela('<p>PDF pronto: <b>' + esc(nome) + "</b></p><div class=\"acoes\">" +
      (pode ? '<button class="prim" id="pd-comp">📤 Enviar (WhatsApp, e-mail...)</button>' : "") + '<button id="pd-baixar"' + (pode ? "" : ' class="prim"') + ">📄 Baixar</button></div>",
      { titulo: titulo });
    $("#pd-baixar", j.el).onclick = function () { baixarArquivo(blob, nome); j.fechar(); };
    if (pode) $("#pd-comp", j.el).onclick = function () {
      navigator.share({ files: [new File([blob], nome, { type: "application/pdf" })], title: titulo }).then(j.fechar, function (e) { if (!e || e.name !== "AbortError") P.falhou(e); });
    };
  }
  // texto para o PDF (a fonte padrão só tem os caracteres latinos)
  function tx(v) {
    return String(v === null || v === undefined ? "" : v).replace(/[−–—]/g, "-").replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'").replace(/•/g, "-").replace(/[  ]/g, " ").replace(/[^\x00-\xff]/g, "");
  }
  function cabecalhoPdf(doc, titulo, direita, L, R, y) {
    var E = A.CFG.EMPRESA || {};
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(20, 50, 92); doc.text(tx(E.nome || "AGE Elétrica e Pintura"), L, y);
    doc.setFontSize(12); doc.setTextColor(20, 20, 20); doc.text(tx(titulo), R, y, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    var yi = y + 5;
    [E.documento, E.telefone, E.email, E.endereco, E.cidade].filter(Boolean).forEach(function (l) { doc.text(tx(l), L, yi); yi += 4.2; });
    (direita || []).forEach(function (l, i) { doc.text(tx(l), R, y + 5 + i * 4.6, { align: "right" }); });
    y = Math.max(yi, y + 5 + (direita || []).length * 4.6) + 1;
    doc.setDrawColor(20, 50, 92); doc.setLineWidth(0.7); doc.line(L, y, R, y);
    return y + 6;
  }
  function rodapePdf(doc, texto, largura, altura) {
    var n = doc.getNumberOfPages();
    for (var pg = 1; pg <= n; pg++) {
      doc.setPage(pg); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(130);
      doc.text(tx(texto) + "  ·  página " + pg + " de " + n, largura / 2, altura - 7, { align: "center" });
    }
  }
  function caixaInfo(doc, linhas, L, R, y, rotW) {
    var ls = linhas.filter(function (l) { return l[1]; }).map(function (l) { return { r: l[0], v: doc.splitTextToSize(tx(l[1]), R - L - rotW - 6) }; });
    var alt = ls.reduce(function (s, l) { return s + l.v.length * 4.8; }, 0) + 5;
    doc.setFillColor(243, 245, 248); doc.roundedRect(L, y - 4, R - L, alt, 2, 2, "F");
    y += 1;
    ls.forEach(function (l) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(20, 20, 20); doc.text(tx(l.r), L + 3, y);
      doc.setFont("helvetica", "normal"); doc.text(l.v, L + 3 + rotW, y); y += l.v.length * 4.8;
    });
    return y + 5;
  }

  // =================================================================
  // ORDENS DE SERVIÇO
  // =================================================================
  function verOS(c) {
    var F = filtro, S = P.S;
    c.innerHTML = '<div class="cab-secao"><h3 style="margin:0">Ordens de serviço da prefeitura</h3><button class="prim dir" id="pf-nova-os">+ Nova OS</button></div>' +
      '<div class="filtros"><select id="pf-f-pref" aria-label="Prefeitura"><option value="">Todas as prefeituras</option>' +
      S.pref.map(function (p) { return '<option value="' + p.id + '">' + esc(p.nome) + "</option>"; }).join("") + "</select>" +
      '<select id="pf-f-st" aria-label="Situação"><option value="ativas">Em aberto</option><option value="concluidas">Concluídas</option>' +
      '<option value="nao_medidas">Concluídas e não medidas</option><option value="pendencias">Concluídas com pendência de prova</option><option value="todas">Todas</option></select>' +
      '<select id="pf-f-tipo" aria-label="Tipo"><option value="">Todos os tipos</option>' + Object.keys(TIPO).map(function (k) { return '<option value="' + k + '">' + TIPO[k] + "</option>"; }).join("") + "</select>" +
      '<input id="pf-f-busca" type="search" placeholder="Buscar nº da OS, local, secretaria"></div><div id="pf-lista"></div>';
    $("#pf-f-pref", c).value = F.pref; $("#pf-f-st", c).value = F.st; $("#pf-f-tipo", c).value = F.tipo; $("#pf-f-busca", c).value = F.busca;
    ["#pf-f-pref", "#pf-f-st", "#pf-f-tipo"].forEach(function (s) { $(s, c).onchange = function () { ler(); listar(); }; });
    $("#pf-f-busca", c).oninput = function () { ler(); listar(); };
    function ler() { F.pref = $("#pf-f-pref", c).value; F.st = $("#pf-f-st", c).value; F.tipo = $("#pf-f-tipo", c).value; F.busca = semAcento($("#pf-f-busca", c).value); }
    $("#pf-nova-os", c).onclick = function () { editarOS(null); };

    function listar() {
      var l = $("#pf-lista", c);
      if (!S.pref.length) {
        l.innerHTML = '<div class="cartao vazio">Comece cadastrando a prefeitura (aba <b>Prefeituras</b>) e, se tiver, o contrato com a planilha de preços (aba <b>Contratos</b>).</div>';
        return;
      }
      var lista = S.obras.filter(function (o) {
        if (!o.prefeitura_id) return false;
        if (F.pref && o.prefeitura_id !== F.pref) return false;
        if (F.tipo && o.tipo_publico !== F.tipo) return false;
        if (F.busca && semAcento([o.protocolo, o.cliente, o.secretaria, o.referencia, o.endereco, o.fiscal].join(" ")).indexOf(F.busca) < 0) return false;
        var concl = osConcluida(o), pv;
        if (F.st === "ativas") return !concl;
        if (F.st === "concluidas") return concl;
        if (F.st === "nao_medidas") return concl && !medicaoDaObra(o.id);
        if (F.st === "pendencias") { pv = provas(o); return concl && !(pv.antes && pv.depois && pv.assin); }
        return true;
      });
      if (!lista.length) { l.innerHTML = '<div class="cartao vazio">Nenhuma OS com este filtro.</div>'; return; }
      l.innerHTML = lista.map(function (o) {
        var pv = provas(o), k = P.porId(S.contr, o.contrato_id), concl = osConcluida(o);
        return '<div class="cartao"><div class="linha"><h3>' + (o.protocolo ? "OS " + esc(o.protocolo) + " · " : "") + esc(o.cliente) + "</h3>" +
          (o.tipo_publico ? '<span class="selo">' + TIPO[o.tipo_publico] + "</span>" : "") + (concl ? '<span class="selo bom">concluída</span>' : "") +
          '<span class="dir mudo peq">' + A.data(o.criado_em) + "</span></div>" +
          '<div class="peq">🏛️ ' + esc(nomePref(o.prefeitura_id)) + (o.secretaria ? " · " + esc(o.secretaria) : "") + (k ? " · Contrato " + esc(k.numero) : "") + "</div>" +
          (o.referencia ? '<div class="peq">🔖 ' + esc(o.referencia) + "</div>" : "") +
          (o.endereco ? '<div class="peq"><a href="' + A.linkEndereco(o.endereco) + '" target="_blank" rel="noopener">📍 ' + esc(o.endereco) + "</a></div>" : "") +
          (o.fiscal ? '<div class="peq mudo">Fiscal: ' + esc(o.fiscal) + (o.telefone ? " · " + esc(o.telefone) : "") + "</div>" : "") +
          '<div class="linha" style="margin-top:6px">' + chk(pv.antes, "fotos antes") + chk(pv.depois, "fotos depois") + chk(pv.assin, "assinatura do fiscal") +
          (pv.med ? '<span class="selo bom">medida (medição ' + seqMedicao(pv.med) + ")</span>" : (concl ? '<span class="selo atencao">não medida</span>' : "")) + "</div>" +
          partesDe(o.id).map(function (s) {
            return '<div class="parte ' + s.categoria + '" data-serv="' + s.id + '" role="button" tabindex="0"><div class="linha">' + A.seloCategoria(s.categoria) + A.seloStatus(s.status) +
              '<span class="peq">' + (s.funcionario_id ? "👷 " + esc(P.nomeFunc(s.funcionario_id)) : '<span class="selo critico">sem funcionário</span>') + "</span>" +
              (s.data_prevista ? '<span class="dir peq mudo">📅 ' + A.dataSimples(s.data_prevista) + "</span>" : "") + "</div>" +
              (s.descricao ? '<div class="peq" style="margin-top:4px;white-space:pre-wrap">' + esc(s.descricao.length > 200 ? s.descricao.slice(0, 200) + "…" : s.descricao) + "</div>" : "") + "</div>";
          }).join("") +
          '<div class="acoes"><button class="peq prim" data-relfoto="' + o.id + '">📄 Relatório fotográfico (PDF)</button>' +
          '<button class="peq" data-nova-parte="' + o.id + '">+ Parte</button><button class="peq" data-editar-os="' + o.id + '">Editar OS</button></div></div>';
      }).join("");
      $$("[data-serv]", l).forEach(function (d) {
        d.onclick = function () { P.abrirServico(d.dataset.serv); };
        d.onkeydown = function (ev) { if (ev.key === "Enter") P.abrirServico(d.dataset.serv); };
      });
      $$("[data-editar-os]", l).forEach(function (b) { b.onclick = function () { editarOS(b.dataset.editarOs); }; });
      $$("[data-nova-parte]", l).forEach(function (b) { b.onclick = function () { novaParte(b.dataset.novaParte); }; });
      $$("[data-relfoto]", l).forEach(function (b) { b.onclick = function () { relatorioFotografico(b.dataset.relfoto, b); }; });
    }
    listar();
  }

  function camposPartes() {
    return '<p class="peq mudo" style="margin:12px 0 0">Marque as partes da OS. Cada parte vai para o funcionário daquela área. A assinatura do fiscal já vem ligada.</p>' +
      P.formParte("eletrica", "⚡ Parte ELÉTRICA") + P.formParte("pintura", "🖌️ Parte PINTURA");
  }
  function ligarPartes(el) {
    ["eletrica", "pintura"].forEach(function (cat) {
      $("#ns-" + cat + "-assin", el).checked = true;
      $("#ns-" + cat, el).onchange = function () { $("#ns-" + cat + "-campos", el).classList.toggle("oculto", !this.checked); };
    });
  }
  function lerPartes(el, obraId) {
    return ["eletrica", "pintura"].filter(function (cat) { return $("#ns-" + cat, el).checked; }).map(function (cat) {
      return { obra_id: obraId, categoria: cat, funcionario_id: P.nulo(P.val(el, "#ns-" + cat + "-func")), data_prevista: P.nulo(P.val(el, "#ns-" + cat + "-data")),
        descricao: P.nulo(P.val(el, "#ns-" + cat + "-desc")), pede_assinatura: $("#ns-" + cat + "-assin", el).checked };
    });
  }
  function avisarEquipe(novos) {
    var zaps = novos.map(P.botaoZap).filter(Boolean);
    if (zaps.length) A.janela("<p>Avise a equipe:</p>" + zaps.map(function (z) { return '<div class="acoes">' + z + "</div>"; }).join(""), { titulo: "OS salva" });
  }

  function editarOS(id) {
    var S = P.S, o = id ? P.porId(S.obras, id) : null;
    if (!S.pref.length) { A.avisar("Cadastre a prefeitura primeiro (aba Prefeituras).", "erro"); sub = "prefeituras"; redesenhar(); return; }
    var j = A.janela(
      '<div class="duas"><div><label for="os-pref">Prefeitura *</label><select id="os-pref">' +
      S.pref.filter(function (p) { return p.ativo || (o && p.id === o.prefeitura_id); }).map(function (p) { return '<option value="' + p.id + '">' + esc(p.nome) + "</option>"; }).join("") + "</select></div>" +
      '<div><label for="os-contr">Contrato</label><select id="os-contr"></select></div></div>' +
      '<div class="duas"><div><label for="os-prot">Nº da OS / protocolo *</label><input id="os-prot" maxlength="80" placeholder="Ex.: 2026/00123"></div>' +
      '<div><label for="os-tipo">Tipo *</label><select id="os-tipo">' + Object.keys(TIPO).map(function (k) { return '<option value="' + k + '">' + TIPO[k] + "</option>"; }).join("") + "</select></div></div>" +
      '<label for="os-sec">Secretaria / órgão que pediu</label><input id="os-sec" maxlength="150" placeholder="Ex.: Secretaria de Educação">' +
      '<label for="os-local">Local / prédio *</label><input id="os-local" maxlength="200" placeholder="Ex.: E.M. Maria José · Praça Central · Rua das Flores">' +
      '<label for="os-ref">Referência</label><input id="os-ref" maxlength="200" placeholder="Ex.: poste nº 1234, bloco B, sala 3">' +
      '<label for="os-end">Endereço</label><input id="os-end" maxlength="300">' +
      '<div class="duas"><div><label for="os-fiscal">Fiscal da prefeitura</label><input id="os-fiscal" maxlength="120"></div>' +
      '<div><label for="os-tel">WhatsApp do fiscal</label><input id="os-tel" type="tel" maxlength="40"></div></div>' +
      '<label for="os-email">E-mail do fiscal / secretaria</label><input id="os-email" type="email" maxlength="200">' +
      '<label for="os-obs">Observações (o funcionário vê)</label><textarea id="os-obs" rows="2"></textarea>' +
      (o ? "" : camposPartes()) +
      '<div id="os-erro"></div><div class="acoes"><button class="prim" id="os-salvar">Salvar OS</button>' + (o ? '<button class="perigo" id="os-apagar">Apagar OS</button>' : "") + "</div>",
      { titulo: o ? "Editar OS" + (o.protocolo ? " " + o.protocolo : "") : "Nova OS da prefeitura", fixa: true });
    var el = j.el;
    function opcoesContr() {
      var pid = $("#os-pref", el).value, atual = $("#os-contr", el).value || (o ? o.contrato_id : "");
      var ks = contratosDe(pid).filter(function (k) { return k.ativo || k.id === atual; });
      $("#os-contr", el).innerHTML = '<option value="">— sem contrato —</option>' + ks.map(function (k) { return '<option value="' + k.id + '">' + esc(rotuloContrato(k)) + "</option>"; }).join("");
      if (ks.some(function (k) { return k.id === atual; })) $("#os-contr", el).value = atual;
      else if (!o && ks.length === 1) $("#os-contr", el).value = ks[0].id;
    }
    if (o) {
      $("#os-pref", el).value = o.prefeitura_id; $("#os-prot", el).value = o.protocolo || ""; $("#os-tipo", el).value = o.tipo_publico || "predio";
      $("#os-sec", el).value = o.secretaria || ""; $("#os-local", el).value = o.cliente || ""; $("#os-ref", el).value = o.referencia || "";
      $("#os-end", el).value = o.endereco || ""; $("#os-fiscal", el).value = o.fiscal || ""; $("#os-tel", el).value = o.telefone || "";
      $("#os-email", el).value = o.email || ""; $("#os-obs", el).value = o.observacoes || "";
    } else {
      if (filtro.pref) $("#os-pref", el).value = filtro.pref;
      ligarPartes(el);
    }
    opcoesContr();
    $("#os-pref", el).onchange = function () { $("#os-contr", el).value = ""; opcoesContr(); };
    $("#os-contr", el).onchange = function () {
      var k = P.porId(S.contr, this.value);
      if (k && k.secretaria && !P.val(el, "#os-sec")) $("#os-sec", el).value = k.secretaria;
    };

    $("#os-salvar", el).onclick = function () {
      var b = this, erro = function (m) { $("#os-erro", el).innerHTML = '<div class="aviso erro">' + esc(m) + "</div>"; };
      if (!P.val(el, "#os-prot")) { erro("Informe o nº da OS / protocolo."); return; }
      if (!P.val(el, "#os-local")) { erro("Informe o local / prédio."); return; }
      var dup = S.obras.filter(function (x) { return x.prefeitura_id === $("#os-pref", el).value && x.protocolo && semAcento(x.protocolo) === semAcento(P.val(el, "#os-prot")) && (!o || x.id !== o.id); })[0];
      if (dup && !A.confirmar("Já existe a OS " + dup.protocolo + " nesta prefeitura (" + dup.cliente + "). Salvar mesmo assim?")) return;
      var dados = {
        prefeitura_id: $("#os-pref", el).value, contrato_id: P.nulo($("#os-contr", el).value), protocolo: P.val(el, "#os-prot"), tipo_publico: $("#os-tipo", el).value,
        secretaria: P.nulo(P.val(el, "#os-sec")), cliente: P.val(el, "#os-local"), referencia: P.nulo(P.val(el, "#os-ref")), endereco: P.nulo(P.val(el, "#os-end")),
        fiscal: P.nulo(P.val(el, "#os-fiscal")), telefone: P.nulo(P.val(el, "#os-tel")), email: P.nulo(P.val(el, "#os-email")), observacoes: P.nulo(P.val(el, "#os-obs"))
      };
      if (!o && !["eletrica", "pintura"].some(function (cat) { return $("#ns-" + cat, el).checked; })) { erro("Marque a parte elétrica, a de pintura ou as duas."); return; }
      A.ocupado(b, true, "Salvando...");
      if (o) {
        P.q(P.sb.from("obras").update(dados).eq("id", o.id).select().single()).then(function (n) {
          P.trocar(S.obras, n); j.fechar(); A.avisar("OS salva", "ok"); redesenhar();
        }).catch(function (e) { A.ocupado(b, false); erro(A.msgErro(e)); });
        return;
      }
      var criada = el.dataset.obra ? P.porId(S.obras, el.dataset.obra) : null;
      (criada ? Promise.resolve(criada) : P.q(P.sb.from("obras").insert(dados).select().single()).then(function (n) { S.obras.unshift(n); el.dataset.obra = n.id; return n; }))
        .then(function (n) { return P.q(P.sb.from("servicos").insert(lerPartes(el, n.id)).select()); })
        .then(function (novos) {
          novos.forEach(function (s) { S.serv.unshift(s); });
          j.fechar(); A.avisar("OS salva", "ok"); redesenhar(); avisarEquipe(novos);
        }).catch(function (e) { A.ocupado(b, false); erro(A.msgErro(e)); });
    };
    if (o) $("#os-apagar", el).onclick = function () {
      if (!A.confirmar("Apagar a OS " + (o.protocolo || "") + " e todas as partes? Os registros de ponto, fotos e relatórios continuam guardados.")) return;
      P.q(P.sb.from("obras").delete().eq("id", o.id)).then(function () {
        S.serv = S.serv.filter(function (s) { return s.obra_id !== o.id; });
        P.S.serv = S.serv;
        P.tirar(S.obras, o.id); j.fechar(); A.avisar("Apagada", "ok"); redesenhar();
      }).catch(P.falhou);
    };
  }

  function novaParte(obraId) {
    var o = P.porId(P.S.obras, obraId);
    var j = A.janela('<div class="cartao" style="margin:0"><b>' + (o.protocolo ? "OS " + esc(o.protocolo) + " · " : "") + esc(o.cliente) + "</b>" +
      '<div class="peq mudo">' + esc(nomePref(o.prefeitura_id)) + "</div></div>" + camposPartes() +
      '<div id="np-erro"></div><div class="acoes"><button class="prim" id="np-salvar">Salvar</button></div>', { titulo: "Nova parte da OS", fixa: true });
    var el = j.el;
    ligarPartes(el);
    $("#np-salvar", el).onclick = function () {
      var b = this, partes = lerPartes(el, obraId);
      if (!partes.length) { $("#np-erro", el).innerHTML = '<div class="aviso erro">Marque a parte elétrica, a de pintura ou as duas.</div>'; return; }
      A.ocupado(b, true, "Salvando...");
      P.q(P.sb.from("servicos").insert(partes).select()).then(function (novos) {
        novos.forEach(function (s) { P.S.serv.unshift(s); });
        j.fechar(); A.avisar("Parte salva", "ok"); redesenhar(); avisarEquipe(novos);
      }).catch(function (e) { A.ocupado(b, false); P.falhou(e); });
    };
  }

  // ---------- Relatório fotográfico da OS (PDF) ----------
  // Foto do Storage -> JPEG reduzido (data URL) para entrar no PDF.
  function imagemParaPdf(url, max) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error("foto"); return r.blob(); }).then(function (blob) {
      return (window.createImageBitmap ? createImageBitmap(blob) : new Promise(function (ok, falha) {
        var im = new Image(); im.onload = function () { ok(im); }; im.onerror = falha; im.src = URL.createObjectURL(blob);
      }));
    }).then(function (img) {
      var w = img.width, h = img.height, k = Math.min(1, max / Math.max(w, h));
      var cv = document.createElement("canvas"); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
      var cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
      return { dados: cv.toDataURL("image/jpeg", 0.82), w: cv.width, h: cv.height };
    });
  }
  function carregarFotos(caminhos) {
    if (!caminhos.length) return Promise.resolve({});
    return P.q(P.sb.storage.from("fotos").createSignedUrls(caminhos, 900)).then(function (lista) {
      var mapa = {};
      return Promise.all((lista || []).map(function (x) {
        if (!x.signedUrl) return null;
        return imagemParaPdf(x.signedUrl, 1100).then(function (im) { mapa[x.path] = im; }, function () { /* foto que não abriu fica de fora */ });
      })).then(function () { return mapa; });
    });
  }

  function relatorioFotografico(obraId, botao) {
    var S = P.S, o = P.porId(S.obras, obraId), partes = partesDe(obraId), ids = partes.map(function (s) { return s.id; });
    if (!ids.length) { A.avisar("Esta OS não tem partes.", "erro"); return; }
    A.ocupado(botao, true, "Montando PDF...");
    var rels, pts;
    Promise.all([
      P.q(P.sb.from("relatorios").select("*").in("servico_id", ids).order("criado_em")),
      P.q(P.sb.from("pontos").select("*").in("servico_id", ids).order("criado_em")),
      P.carregarJsPdf()
    ]).then(function (r) {
      rels = r[0]; pts = r[1];
      var cam = [];
      rels.forEach(function (x) { cam = cam.concat(x.fotos_antes || [], x.fotos || [], x.assinatura ? [x.assinatura] : []); });
      return carregarFotos(cam).then(function (fotos) { return montar(r[2], fotos); });
    }).then(function (blob) {
      A.ocupado(botao, false);
      entregarPdf(blob, "Relatorio-fotografico-OS-" + (nomeArq(o.protocolo) || nomeArq(o.cliente)) + ".pdf", "Relatório fotográfico");
    }).catch(function (e) { A.ocupado(botao, false); P.falhou(e); });

    function montar(JsPDF, fotos) {
      var doc = new JsPDF({ unit: "mm", format: "a4" }), L = 15, R = 195, y = 18, pref = P.porId(S.pref, o.prefeitura_id) || {}, k = P.porId(S.contr, o.contrato_id);
      function espaco(alt) { if (y + alt > 280) { doc.addPage(); y = 18; return true; } return false; }
      function titulo(t) { espaco(14); doc.setFont("helvetica", "bold"); doc.setFontSize(11.5); doc.setTextColor(20, 50, 92); doc.text(tx(t), L, y); y += 6; doc.setTextColor(20, 20, 20); }
      function texto(t, tam) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(tam || 9.5);
        var ls = doc.splitTextToSize(tx(t), R - L); espaco(ls.length * 4.5); doc.text(ls, L, y); y += ls.length * 4.5 + 1;
      }
      y = cabecalhoPdf(doc, "RELATÓRIO FOTOGRÁFICO", ["OS / protocolo: " + (o.protocolo || "-"), "Emitido em " + A.data(new Date())], L, R, y);
      y = caixaInfo(doc, [["Prefeitura:", pref.nome + (pref.cnpj ? " - CNPJ " + pref.cnpj : "")], ["Contrato:", k ? k.numero + (k.processo ? " (proc. " + k.processo + ")" : "") : ""],
        ["Secretaria:", o.secretaria], ["Tipo:", TIPO_TX[o.tipo_publico]], ["Local:", o.cliente], ["Referência:", o.referencia], ["Endereço:", o.endereco], ["Fiscal:", o.fiscal]], L, R, y, 24);

      titulo("Execução");
      partes.forEach(function (s) {
        texto(A.CATEG[s.categoria].nome + " - " + A.STATUS[s.status] + " - responsável: " + P.nomeFunc(s.funcionario_id) +
          (s.concluido_em ? " - concluído em " + A.dataHora(s.concluido_em) : "") + (s.descricao ? "\nSolicitado: " + s.descricao : ""));
      });
      var ch = pts.filter(function (p) { return p.tipo === "chegada"; }), sa = pts.filter(function (p) { return p.tipo === "saida"; });
      if (ch.length || sa.length) {
        var gps = function (p) { return p.lat !== null ? " (GPS " + Number(p.lat).toFixed(5) + ", " + Number(p.lng).toFixed(5) + ")" : " (sem GPS)"; };
        texto((ch.length ? "Chegada da equipe: " + A.dataHora(ch[0].criado_em) + gps(ch[0]) : "") + (sa.length ? (ch.length ? "\n" : "") + "Saída: " + A.dataHora(sa[sa.length - 1].criado_em) + gps(sa[sa.length - 1]) : ""));
      }
      var descr = rels.filter(function (r) { return r.tipo_servico || r.descricao; });
      if (descr.length) {
        titulo("Serviços executados");
        descr.forEach(function (r) { texto(A.dataHora(r.criado_em) + " - " + [r.tipo_servico, r.descricao].filter(Boolean).join(": ")); });
      }
      // quantidades lançadas pela equipe
      var soma = {};
      rels.forEach(function (r) { (r.materiais || []).forEach(function (m) {
        var c = semAcento(m.item) + "|" + (m.un || ""); soma[c] = soma[c] || { item: m.item, un: m.un, qtd: 0 }; soma[c].qtd += Number(m.qtd) || 0;
      }); });
      var qs = Object.keys(soma).map(function (c) { return soma[c]; });
      if (qs.length) {
        titulo("Quantidades executadas / materiais");
        qs.forEach(function (m) {
          espaco(5); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
          var d = doc.splitTextToSize(tx(m.item), 140); doc.text(d, L + 1, y);
          doc.text(tx(A.numero(m.qtd, 3) + " " + (m.un || "")), R - 1, y, { align: "right" }); y += d.length * 4.4 + 1;
          doc.setDrawColor(225); doc.setLineWidth(0.2); doc.line(L, y - 2.4, R, y - 2.4); y += 1;
        });
      }
      function grade(nome, lista) {
        var fs = lista.filter(function (f) { return fotos[f.c]; });
        espaco(fs.length ? 100 : 14);  // o título não fica sozinho no pé da página
        titulo(nome + " (" + fs.length + ")");
        if (!fs.length) { texto("Nenhuma foto.", 9); return; }
        var cw = (R - L - 6) / 2, maxH = 78;
        for (var i = 0; i < fs.length; i += 2) {
          var par = fs.slice(i, i + 2).map(function (f) { var im = fotos[f.c], k2 = Math.min(cw / im.w, maxH / im.h); return { f: f, im: im, w: im.w * k2, h: im.h * k2 }; });
          var alt = Math.max.apply(null, par.map(function (p) { return p.h; })) + 7;
          espaco(alt);
          par.forEach(function (p, n) {
            var x = L + n * (cw + 6) + (cw - p.w) / 2;
            doc.addImage(p.im.dados, "JPEG", x, y, p.w, p.h);
            doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(90);
            doc.text(tx(p.f.leg), L + n * (cw + 6) + cw / 2, y + p.h + 4, { align: "center" }); doc.setTextColor(20, 20, 20);
          });
          y += alt + 2;
        }
      }
      var antes = [], depois = [];
      rels.forEach(function (r) {
        (r.fotos_antes || []).forEach(function (f) { antes.push({ c: f, leg: "Antes - " + A.dataHora(r.criado_em) + " - " + P.nomeFunc(r.funcionario_id) }); });
        (r.fotos || []).forEach(function (f) { depois.push({ c: f, leg: "Depois - " + A.dataHora(r.criado_em) + " - " + P.nomeFunc(r.funcionario_id) }); });
      });
      grade("Fotos ANTES do serviço", antes);
      grade("Fotos DEPOIS do serviço", depois);

      // assinaturas
      var ra = rels.filter(function (r) { return r.assinatura && fotos[r.assinatura]; }).pop();
      espaco(48); y += 6;
      titulo("Aceite");
      var yl = y + 26;
      if (ra) {
        var im = fotos[ra.assinatura], k3 = Math.min(80 / im.w, 30 / im.h);
        doc.addImage(im.dados, "JPEG", 115 + (80 - im.w * k3) / 2, yl - im.h * k3 - 1, im.w * k3, im.h * k3);
      }
      doc.setDrawColor(60); doc.setLineWidth(0.3); doc.line(L, yl, 95, yl); doc.line(115, yl, R, yl);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text(tx((A.CFG.EMPRESA || {}).nome || "AGE Elétrica e Pintura"), 55, yl + 4.5, { align: "center" });
      doc.text(tx("Fiscal: " + (ra ? ra.assinado_por + " - " + A.dataHora(ra.assinado_em) : (o.fiscal || ""))), 155, yl + 4.5, { align: "center" });
      if (ra) { doc.setFontSize(7.5); doc.setTextColor(110); doc.text("assinado no local, na tela do celular", 155, yl + 8.5, { align: "center" }); }

      rodapePdf(doc, "Relatório fotográfico - OS " + (o.protocolo || "") + " - " + (pref.nome || ""), 210, 297);
      doc.setProperties({ title: tx("Relatório fotográfico OS " + (o.protocolo || "")), author: tx((A.CFG.EMPRESA || {}).nome || "AGE Elétrica e Pintura") });
      return doc.output("blob");
    }
  }

  // =================================================================
  // MEDIÇÕES
  // =================================================================
  function verMedicoes(c) {
    var S = P.S;
    var ks = S.contr.slice().sort(function (a, b) { return nomePref(a.prefeitura_id).localeCompare(nomePref(b.prefeitura_id)) || String(a.numero).localeCompare(String(b.numero)); });
    c.innerHTML = '<div class="cab-secao"><h3 style="margin:0">Planilhas de medição</h3><button class="prim dir" id="pf-nova-med">+ Nova medição</button></div>' +
      (!ks.length ? '<div class="cartao vazio">Cadastre um contrato com a planilha de preços (aba <b>Contratos</b>) para fazer a medição.</div>' :
        ks.map(function (k) {
          var meds = S.med.filter(function (m) { return m.contrato_id === k.id; }).sort(function (a, b) { return b.numero - a.numero; });
          var medido = medidoContrato(k.id), pend = S.obras.filter(function (o) { return o.contrato_id === k.id && osConcluida(o) && !medicaoDaObra(o.id); }).length;
          return '<div class="cartao"><div class="linha"><h3>' + esc(nomePref(k.prefeitura_id)) + " · Contrato " + esc(k.numero) + "</h3>" +
            (pend ? '<span class="selo atencao">' + pend + " OS concluída(s) sem medição</span>" : "") +
            '<button class="peq dir" data-med-nova="' + k.id + '">+ Medição</button></div>' +
            '<div class="peq mudo">Medido: ' + A.dinheiro(medido) + (k.valor_total ? " de " + A.dinheiro(k.valor_total) + " · saldo " + A.dinheiro(Number(k.valor_total) - medido) : "") + "</div>" +
            (meds.length ? '<div class="tabela-caixa" style="margin-top:8px"><table><thead><tr><th>Medição</th><th>Período</th><th class="esconde-cel">OS</th><th>Situação</th><th class="num">Total</th></tr></thead><tbody>' +
              meds.map(function (m) {
                return '<tr class="clic" data-med="' + m.id + '" style="cursor:pointer"><td>' + seqMedicao(m) + "ª</td><td>" + (m.periodo_inicio ? A.dataSimples(m.periodo_inicio) : "") +
                  (m.periodo_fim ? " a " + A.dataSimples(m.periodo_fim) : "") + '</td><td class="esconde-cel">' + (m.obras || []).length + '</td><td><span class="selo ' + COR_MED[m.status] + '">' +
                  STATUS_MED[m.status] + '</span></td><td class="num">' + A.dinheiro(m.total) + "</td></tr>";
              }).join("") + "</tbody></table></div>" : '<div class="mudo peq" style="margin-top:6px">Nenhuma medição ainda.</div>') + "</div>";
        }).join(""));
    $("#pf-nova-med", c).onclick = function () {
      if (!S.contr.length) { A.avisar("Cadastre o contrato primeiro.", "erro"); return; }
      if (S.contr.length === 1) { editarMedicao(null, S.contr[0].id); return; }
      var j = A.janela('<label for="nm-k">Contrato</label><select id="nm-k">' + ks.map(function (k) { return '<option value="' + k.id + '">' + esc(nomePref(k.prefeitura_id) + " · " + rotuloContrato(k)) + "</option>"; }).join("") +
        '</select><div class="acoes"><button class="prim" id="nm-ok">Continuar</button></div>', { titulo: "Nova medição" });
      $("#nm-ok", j.el).onclick = function () { var id = $("#nm-k", j.el).value; j.fechar(); editarMedicao(null, id); };
    };
    $$("[data-med-nova]", c).forEach(function (b) { b.onclick = function () { editarMedicao(null, b.dataset.medNova); }; });
    $$("[data-med]", c).forEach(function (t) { t.onclick = function () { editarMedicao(P.porId(S.med, t.dataset.med)); }; });
  }

  function editarMedicao(med, contratoId) {
    var S = P.S, k = P.porId(S.contr, med ? med.contrato_id : contratoId), pref = P.porId(S.pref, k.prefeitura_id) || {};
    var hoje = new Date(), ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    var M = med ? JSON.parse(JSON.stringify(med)) : { id: null, numero: null, contrato_id: k.id, periodo_inicio: A.isoLocal(ini), periodo_fim: A.isoLocal(hoje),
      obras: [], itens: [], bdi: Number(k.bdi) || 0, status: "rascunho", observacoes: "" };
    M.itens = (M.itens || []).map(function (i) { return Object.assign({ codigo: "", descricao: "", un: "un", qtd: 0, valor: 0 }, i); });
    var itensK = k.itens || [];
    function itemK(i) { var c = chaveItem(i); return itensK.filter(function (x) { return chaveItem(x) === c; })[0] || null; }
    function anteriores() {
      var acc = {};
      S.med.filter(function (m) { return m.contrato_id === k.id && m.id !== M.id && (!M.numero || m.numero < M.numero); }).forEach(function (m) {
        (m.itens || []).forEach(function (i) { var c = chaveItem(i); acc[c] = (acc[c] || 0) + (Number(i.qtd) || 0); });
      });
      return acc;
    }
    var ANT = anteriores();
    var titulo = med ? seqMedicao(med) + "ª medição · Contrato " + k.numero : "Nova medição · Contrato " + k.numero;
    var j = A.janela(
      '<div class="peq mudo">' + esc(pref.nome || "") + (k.objeto ? " · " + esc(k.objeto) : "") + "</div>" +
      '<div class="duas"><div><label for="md-de">Período de</label><input type="date" id="md-de"></div><div><label for="md-ate">até</label><input type="date" id="md-ate"></div></div>' +
      '<h3 style="margin-top:14px">OS desta medição</h3><div id="md-os"></div>' +
      '<div class="linha" style="margin-top:6px"><button class="peq" id="md-marcar">☑ Marcar as concluídas no período</button>' +
      '<button class="peq prim" id="md-puxar">⬇ Puxar quantidades dos relatórios</button></div>' +
      '<h3 style="margin-top:14px">Itens medidos</h3><div id="md-itens"></div>' +
      '<div class="linha" style="margin-top:8px">' + (itensK.length ? '<select id="md-add-k" style="flex:1 1 220px"><option value="">+ Item do contrato...</option>' +
        itensK.map(function (i, n) { return '<option value="' + n + '">' + esc((i.codigo ? i.codigo + " · " : "") + i.descricao) + "</option>"; }).join("") + "</select>" : "") +
      '<button class="peq" id="md-add-livre">+ Item fora do contrato</button></div>' +
      '<div class="duas"><div><label for="md-bdi">BDI (%)</label><input id="md-bdi" inputmode="decimal"></div><div><label for="md-st">Situação</label><select id="md-st">' +
      Object.keys(STATUS_MED).map(function (s) { return '<option value="' + s + '">' + STATUS_MED[s] + "</option>"; }).join("") + "</select></div></div>" +
      '<div class="cartao" style="margin-top:10px" id="md-tot"></div>' +
      '<label for="md-obs">Observações</label><textarea id="md-obs" rows="2"></textarea>' +
      '<div class="acoes"><button class="prim" id="md-salvar">Salvar</button><button id="md-pdf">📄 PDF da medição</button><button id="md-csv">📊 Planilha (Excel)</button>' +
      (M.id ? '<button class="perigo" id="md-apagar">Apagar</button>' : "") + "</div>",
      { titulo: titulo, larga: true, fixa: true });
    var el = j.el;
    $("#md-de", el).value = M.periodo_inicio || ""; $("#md-ate", el).value = M.periodo_fim || ""; $("#md-bdi", el).value = A.numero(M.bdi);
    $("#md-st", el).value = M.status; $("#md-obs", el).value = M.observacoes || "";

    function obrasDoContrato() { return S.obras.filter(function (o) { return o.contrato_id === k.id; }); }
    function desenharOS() {
      var lista = obrasDoContrato().filter(function (o) { return M.obras.indexOf(o.id) >= 0 || !medicaoDaObra(o.id, M.id); });
      $("#md-os", el).innerHTML = lista.length ? lista.map(function (o) {
        var dc = dataConclusao(o), concl = osConcluida(o), pv = provas(o);
        return '<label class="marca-linha" style="font-weight:400;align-items:flex-start"><input type="checkbox" data-os="' + o.id + '"' + (M.obras.indexOf(o.id) >= 0 ? " checked" : "") + "> <span>" +
          "<b>" + (o.protocolo ? "OS " + esc(o.protocolo) + " · " : "") + esc(o.cliente) + "</b> " +
          (concl ? '<span class="selo bom">concluída ' + (dc ? A.data(dc) : "") + "</span>" : '<span class="selo atencao">em aberto</span>') +
          (!(pv.antes && pv.depois && pv.assin) ? ' <span class="selo critico">falta prova</span>' : "") + "</span></label>";
      }).join("") : '<div class="mudo peq">Nenhuma OS deste contrato disponível (as já medidas em outra medição não aparecem).</div>';
      $$("[data-os]", el).forEach(function (cb) {
        cb.onchange = function () {
          var i = M.obras.indexOf(cb.dataset.os);
          if (cb.checked && i < 0) M.obras.push(cb.dataset.os);
          if (!cb.checked && i >= 0) M.obras.splice(i, 1);
        };
      });
    }
    function marcarPeriodo() {
      var de = $("#md-de", el).value, ate = $("#md-ate", el).value;
      obrasDoContrato().forEach(function (o) {
        var dc = dataConclusao(o), d = dc ? A.isoLocal(new Date(dc)) : null;
        if (osConcluida(o) && !medicaoDaObra(o.id, M.id) && d && (!de || d >= de) && (!ate || d <= ate) && M.obras.indexOf(o.id) < 0) M.obras.push(o.id);
      });
      desenharOS();
    }
    if (!med) marcarPeriodo(); else desenharOS();
    $("#md-marcar", el).onclick = marcarPeriodo;

    $("#md-puxar", el).onclick = function () {
      if (!M.obras.length) { A.avisar("Marque as OS desta medição.", "erro"); return; }
      if (M.itens.some(function (i) { return Number(i.qtd); }) && !A.confirmar("Trocar as quantidades atuais pelas lançadas nos relatórios da equipe?")) return;
      var soma = {}, ordem = [];
      M.obras.forEach(function (oid) {
        relsDe(oid).forEach(function (r) {
          (r.materiais || []).forEach(function (m) {
            if (!m.item) return;
            var ik = itensK.filter(function (x) { return semAcento(x.descricao) === semAcento(m.item) || (x.codigo && semAcento(x.codigo) === semAcento(m.item)); })[0];
            var base = ik ? { codigo: ik.codigo || "", descricao: ik.descricao, un: ik.un || m.un || "un", valor: Number(ik.valor) || 0 } : { codigo: "", descricao: m.item, un: m.un || "un", valor: 0 };
            var c = chaveItem(base);
            if (!soma[c]) { soma[c] = Object.assign(base, { qtd: 0, fora: !ik }); ordem.push(c); }
            soma[c].qtd += Number(m.qtd) || 0;
          });
        });
      });
      if (!ordem.length) { A.avisar("Os relatórios dessas OS não têm quantidades lançadas.", "erro"); return; }
      M.itens = ordem.map(function (c) { var i = soma[c]; i.qtd = Math.round(i.qtd * 1000) / 1000; delete i.fora; return i; });
      var fora = ordem.filter(function (c) { return !itemK(soma[c]); }).length;
      desenharItens();
      A.avisar(ordem.length + " itens puxados" + (fora ? " · " + fora + " fora do contrato (confira o preço)" : ""), fora ? "erro" : "ok");
    };

    function desenharItens() {
      $("#md-itens", el).innerHTML = M.itens.length ? M.itens.map(function (i, n) {
        var ik = itemK(i), ant = ANT[chaveItem(i)] || 0;
        return '<div class="item-orc" data-i="' + n + '"><div class="l1" style="grid-template-columns:90px 1fr"><input class="i-cod" maxlength="40" placeholder="Código" aria-label="Código">' +
          '<input class="i-desc" maxlength="300" placeholder="Descrição" aria-label="Descrição"></div>' +
          '<div class="l2"><label>Qtd medida<input class="i-qtd" inputmode="decimal"></label><label>Un<input class="i-un" maxlength="12"></label>' +
          '<label>Preço un. (R$)<input class="i-valor" inputmode="decimal"></label><div class="i-sub forte"></div><button class="peq i-tirar" aria-label="Remover item">✕</button></div>' +
          '<div class="mini mudo" style="margin-top:4px">' + (ik ? "Contratado: " + A.numero(ik.qtd || 0, 3) + " · medido antes: " + A.numero(ant, 3) +
            ' · <span class="i-saldo"></span>' : '<span class="selo atencao">fora do contrato</span>' + (ant ? " · medido antes: " + A.numero(ant, 3) : "")) + "</div></div>";
      }).join("") : '<div class="mudo peq">Nenhum item. Use “Puxar quantidades dos relatórios” ou adicione os itens.</div>';
      $$("#md-itens .item-orc", el).forEach(function (d) {
        var i = M.itens[Number(d.dataset.i)];
        $(".i-cod", d).value = i.codigo || ""; $(".i-desc", d).value = i.descricao || ""; $(".i-qtd", d).value = A.numero(i.qtd, 3);
        $(".i-un", d).value = i.un || ""; $(".i-valor", d).value = i.valor ? A.numero(i.valor) : "";
        d.oninput = function () {
          i.codigo = $(".i-cod", d).value.trim(); i.descricao = $(".i-desc", d).value; i.qtd = A.lerNumero($(".i-qtd", d).value);
          i.un = $(".i-un", d).value.trim(); i.valor = A.lerNumero($(".i-valor", d).value);
          totais();
        };
        $(".i-tirar", d).onclick = function () { M.itens.splice(Number(d.dataset.i), 1); desenharItens(); };
      });
      totais();
    }
    function totais() {
      M.bdi = A.lerNumero($("#md-bdi", el).value);
      M.itens.forEach(function (i, n) {
        var d = $('#md-itens .item-orc[data-i="' + n + '"]', el);
        if (!d) return;
        $(".i-sub", d).textContent = A.dinheiro(arred((Number(i.qtd) || 0) * (Number(i.valor) || 0)));
        var ik = itemK(i), sd = $(".i-saldo", d);
        if (ik && sd) {
          var saldo = (Number(ik.qtd) || 0) - (ANT[chaveItem(i)] || 0) - (Number(i.qtd) || 0);
          sd.textContent = "saldo após esta: " + A.numero(saldo, 3);
          sd.style.color = saldo < 0 && Number(ik.qtd) ? "var(--critico)" : "";
        }
      });
      var t = totalMed(M.itens, M.bdi), medidoAntes = medidoContrato(k.id) - (M.id ? Number((P.porId(S.med, M.id) || {}).total || 0) : 0);
      $("#md-tot", el).innerHTML = '<div class="linha"><span>Soma dos itens</span><span class="dir">' + A.dinheiro(t.bruto) + "</span></div>" +
        (M.bdi ? '<div class="linha"><span>BDI ' + A.numero(M.bdi) + '%</span><span class="dir">' + A.dinheiro(t.bdi) + "</span></div>" : "") +
        '<div class="linha forte" style="font-size:18px;margin-top:4px"><span>Total desta medição</span><span class="dir">' + A.dinheiro(t.total) + "</span></div>" +
        (k.valor_total ? '<div class="linha mudo peq"><span>Saldo do contrato depois desta</span><span class="dir">' + A.dinheiro(Number(k.valor_total) - medidoAntes - t.total) + "</span></div>" : "");
    }
    $("#md-bdi", el).oninput = totais;
    if ($("#md-add-k", el)) $("#md-add-k", el).onchange = function () {
      var ik = itensK[Number(this.value)];
      this.value = "";
      if (!ik) return;
      M.itens.push({ codigo: ik.codigo || "", descricao: ik.descricao, un: ik.un || "un", qtd: 0, valor: Number(ik.valor) || 0 });
      desenharItens(); var q2 = $$(".i-qtd", el); if (q2.length) q2[q2.length - 1].focus();
    };
    $("#md-add-livre", el).onclick = function () { M.itens.push({ codigo: "", descricao: "", un: "un", qtd: 0, valor: 0 }); desenharItens(); var d2 = $$(".i-desc", el); if (d2.length) d2[d2.length - 1].focus(); };
    desenharItens();

    function salvar() {
      M.periodo_inicio = $("#md-de", el).value || null; M.periodo_fim = $("#md-ate", el).value || null;
      M.bdi = A.lerNumero($("#md-bdi", el).value); M.status = $("#md-st", el).value; M.observacoes = P.val(el, "#md-obs");
      if (M.periodo_inicio && M.periodo_fim && M.periodo_inicio > M.periodo_fim) return Promise.reject(new Error("O período está invertido."));
      var itens = M.itens.filter(function (i) { return String(i.descricao || "").trim(); }).map(function (i) {
        return { codigo: String(i.codigo || "").trim(), descricao: String(i.descricao).trim(), un: i.un || "un", qtd: Number(i.qtd) || 0, valor: arred(i.valor) };
      });
      var dados = { contrato_id: k.id, periodo_inicio: M.periodo_inicio, periodo_fim: M.periodo_fim, obras: M.obras, itens: itens, bdi: arred(M.bdi),
        total: totalMed(itens, M.bdi).total, status: M.status, observacoes: P.nulo(M.observacoes) };
      var p = M.id ? P.sb.from("medicoes").update(dados).eq("id", M.id).select().single() : P.sb.from("medicoes").insert(dados).select().single();
      return P.q(p).then(function (n) {
        P.trocar(S.med, n); S.med.sort(function (a, b) { return b.numero - a.numero; });
        M = Object.assign(M, n); M.itens = n.itens.slice();
        var h = el.closest(".modal").querySelector(".cab h2"); h.textContent = seqMedicao(n) + "ª medição · Contrato " + k.numero;
        desenharItens();
        return n;
      });
    }
    $("#md-salvar", el).onclick = function () {
      var b = this; A.ocupado(b, true, "Salvando...");
      salvar().then(function () { A.ocupado(b, false); A.avisar("Medição salva", "ok"); redesenhar(); }).catch(function (e) { A.ocupado(b, false); P.falhou(e); });
    };
    $("#md-pdf", el).onclick = function () {
      var b = this; A.ocupado(b, true, "Gerando PDF...");
      salvar().then(function (n) { return P.carregarJsPdf().then(function (JsPDF) { return pdfMedicao(JsPDF, n, k, pref); }).then(function (blob) {
        A.ocupado(b, false); redesenhar();
        entregarPdf(blob, "Medicao-" + seqMedicao(n) + "-Contrato-" + nomeArq(k.numero) + ".pdf", "Medição");
      }); }).catch(function (e) { A.ocupado(b, false); P.falhou(e); });
    };
    $("#md-csv", el).onclick = function () {
      salvar().then(function (n) { csvMedicao(n, k, pref); redesenhar(); }).catch(P.falhou);
    };
    if (M.id) $("#md-apagar", el).onclick = function () {
      if (!A.confirmar("Apagar esta medição? As OS dela voltam a ficar “não medidas”.")) return;
      P.q(P.sb.from("medicoes").delete().eq("id", M.id)).then(function () { P.tirar(S.med, M.id); j.fechar(); A.avisar("Apagada", "ok"); redesenhar(); }).catch(P.falhou);
    };
  }

  // linhas da medição com contratado / acumulado
  function linhasMedicao(m, k) {
    var ant = {};
    P.S.med.filter(function (x) { return x.contrato_id === k.id && x.numero < m.numero; }).forEach(function (x) {
      (x.itens || []).forEach(function (i) { var c = chaveItem(i); ant[c] = (ant[c] || 0) + (Number(i.qtd) || 0); });
    });
    return m.itens.map(function (i) {
      var c = chaveItem(i), ik = (k.itens || []).filter(function (x) { return chaveItem(x) === c; })[0], a = ant[c] || 0, q = Number(i.qtd) || 0;
      return { codigo: i.codigo || "", descricao: i.descricao, un: i.un, contratado: ik ? Number(ik.qtd) || 0 : null, anterior: a, atual: q, acumulado: a + q,
        saldo: ik ? (Number(ik.qtd) || 0) - a - q : null, valor: Number(i.valor) || 0, subtotal: arred(q * (Number(i.valor) || 0)) };
    });
  }

  function pdfMedicao(JsPDF, m, k, pref) {
    var doc = new JsPDF({ unit: "mm", format: "a4", orientation: "landscape" }), L = 12, R = 285, y = 16, seq = seqMedicao(m);
    var linhas = linhasMedicao(m, k), t = totalMed(m.itens, m.bdi);
    function espaco(alt) { if (y + alt > 192) { doc.addPage(); y = 16; cab(); return true; } return false; }
    var col = [[L + 1, "ITEM", "left"], [L + 20, "DESCRIÇÃO", "left"], [130, "UN", "left"], [158, "CONTRAT.", "right"], [180, "ACUM. ANT.", "right"],
      [203, "ESTA MED.", "right"], [225, "ACUMULADO", "right"], [246, "SALDO", "right"], [264, "PREÇO UN.", "right"], [R - 1, "VALOR", "right"]];
    function cab() {
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(90);
      col.forEach(function (c2) { doc.text(tx(c2[1]), c2[0], y, { align: c2[2] }); });
      y += 2; doc.setDrawColor(200); doc.setLineWidth(0.3); doc.line(L, y, R, y); y += 4; doc.setTextColor(20, 20, 20);
    }
    y = cabecalhoPdf(doc, "BOLETIM DE MEDIÇÃO Nº " + seq, ["Período: " + (m.periodo_inicio ? A.dataSimples(m.periodo_inicio) : "-") + " a " + (m.periodo_fim ? A.dataSimples(m.periodo_fim) : "-"),
      "Emitido em " + A.data(new Date())], L, R, y);
    y = caixaInfo(doc, [["Contratante:", (pref.nome || "") + (pref.cnpj ? " - CNPJ " + pref.cnpj : "")], ["Contrato:", k.numero + (k.processo ? " - processo/licitação " + k.processo : "")],
      ["Objeto:", k.objeto], ["Secretaria:", k.secretaria], ["Vigência:", (k.inicio ? A.dataSimples(k.inicio) : "") + (k.fim ? " a " + A.dataSimples(k.fim) : "")]], L, R, y, 26);
    cab();
    linhas.forEach(function (l) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
      var d = doc.splitTextToSize(tx(l.descricao), 106), alt = d.length * 3.9 + 2.2;
      espaco(alt);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
      doc.text(tx(l.codigo), L + 1, y); doc.text(d, L + 20, y); doc.text(tx(l.un), 130, y);
      var nn = function (v) { return v === null ? "-" : tx(A.numero(v, 3)); };
      doc.text(nn(l.contratado), 158, y, { align: "right" }); doc.text(nn(l.anterior), 180, y, { align: "right" });
      doc.setFont("helvetica", "bold"); doc.text(nn(l.atual), 203, y, { align: "right" }); doc.setFont("helvetica", "normal");
      doc.text(nn(l.acumulado), 225, y, { align: "right" });
      if (l.saldo !== null && l.saldo < 0) doc.setTextColor(180, 30, 30);
      doc.text(nn(l.saldo), 246, y, { align: "right" }); doc.setTextColor(20, 20, 20);
      doc.text(tx(A.dinheiro(l.valor)), 264, y, { align: "right" }); doc.text(tx(A.dinheiro(l.subtotal)), R - 1, y, { align: "right" });
      y += alt - 2.2; doc.setDrawColor(225); doc.setLineWidth(0.2); doc.line(L, y - 1.4, R, y - 1.4); y += 3;
    });
    espaco(30); y += 2;
    var xt = 200;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    doc.text("Soma dos itens", xt, y); doc.text(tx(A.dinheiro(t.bruto)), R - 1, y, { align: "right" }); y += 5;
    if (Number(m.bdi)) { doc.text(tx("BDI " + A.numero(m.bdi) + "%"), xt, y); doc.text(tx(A.dinheiro(t.bdi)), R - 1, y, { align: "right" }); y += 5; }
    doc.setDrawColor(20, 50, 92); doc.setLineWidth(0.5); doc.line(xt, y - 2.5, R, y - 2.5); y += 2;
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("TOTAL DESTA MEDIÇÃO", xt, y); doc.text(tx(A.dinheiro(m.total)), R - 1, y, { align: "right" }); y += 6;
    var acum = arred(P.S.med.filter(function (x) { return x.contrato_id === k.id && x.numero <= m.numero; }).reduce(function (s, x) { return s + Number(x.total || 0); }, 0));
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text("Acumulado medido no contrato", xt, y); doc.text(tx(A.dinheiro(acum)), R - 1, y, { align: "right" }); y += 4.6;
    if (k.valor_total) { doc.text("Saldo do contrato", xt, y); doc.text(tx(A.dinheiro(Number(k.valor_total) - acum)), R - 1, y, { align: "right" }); y += 4.6; }
    // OS incluídas
    var oss = (m.obras || []).map(function (id) { return P.porId(P.S.obras, id); }).filter(Boolean);
    if (oss.length) {
      espaco(12); y += 3;
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(20, 50, 92); doc.text("Ordens de serviço incluídas", L, y); y += 5; doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
      oss.forEach(function (o) {
        var dc = dataConclusao(o), ls = doc.splitTextToSize(tx((o.protocolo ? "OS " + o.protocolo + " - " : "") + o.cliente + (o.referencia ? " (" + o.referencia + ")" : "") +
          (o.secretaria ? " - " + o.secretaria : "") + (dc ? " - concluída em " + A.data(dc) : "")), R - L);
        espaco(ls.length * 3.9); doc.text(ls, L, y); y += ls.length * 3.9 + 0.6;
      });
    }
    if (m.observacoes) {
      var lo = doc.splitTextToSize(tx(m.observacoes), R - L); espaco(8 + lo.length * 4); y += 3;
      doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.text("Observações:", L, y); y += 4.5;
      doc.setFont("helvetica", "normal"); doc.text(lo, L, y); y += lo.length * 4;
    }
    if (espaco(28)) y += 8; else y += 18;
    doc.setDrawColor(60); doc.setLineWidth(0.3);
    [[L, 95, (A.CFG.EMPRESA || {}).nome || "AGE Elétrica e Pintura"], [110, 193, "Fiscal do contrato"], [208, R, "Gestor / Secretaria"]].forEach(function (a) {
      doc.line(a[0], y, a[1], y); doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(tx(a[2]), (a[0] + a[1]) / 2, y + 4.5, { align: "center" });
    });
    rodapePdf(doc, "Boletim de medição nº " + seq + " - Contrato " + k.numero + " - " + (pref.nome || ""), 297, 210);
    doc.setProperties({ title: tx("Medição " + seq + " - Contrato " + k.numero), author: tx((A.CFG.EMPRESA || {}).nome || "AGE Elétrica e Pintura") });
    return doc.output("blob");
  }

  function csvMedicao(m, k, pref) {
    var cel = function (v) { v = String(v === null || v === undefined ? "" : v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var num = function (v, c) { return v === null ? "" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: c || 0, maximumFractionDigits: c === 2 ? 2 : 3, useGrouping: false }); };
    var seq = seqMedicao(m), t = totalMed(m.itens, m.bdi);
    var L = [["Boletim de medição nº " + seq], ["Contratante", pref.nome || ""], ["Contrato", k.numero], ["Objeto", k.objeto || ""],
      ["Período", (m.periodo_inicio ? A.dataSimples(m.periodo_inicio) : "") + " a " + (m.periodo_fim ? A.dataSimples(m.periodo_fim) : "")], [],
      ["Item", "Descrição", "Un", "Qtd contratada", "Acumulado anterior", "Esta medição", "Acumulado", "Saldo", "Preço unitário", "Valor"]];
    linhasMedicao(m, k).forEach(function (l) {
      L.push([l.codigo, l.descricao, l.un, num(l.contratado), num(l.anterior), num(l.atual), num(l.acumulado), num(l.saldo), num(l.valor, 2), num(l.subtotal, 2)]);
    });
    L.push([]); L.push(["", "Soma dos itens", "", "", "", "", "", "", "", num(t.bruto, 2)]);
    if (Number(m.bdi)) L.push(["", "BDI " + A.numero(m.bdi) + "%", "", "", "", "", "", "", "", num(t.bdi, 2)]);
    L.push(["", "TOTAL DESTA MEDIÇÃO", "", "", "", "", "", "", "", num(m.total, 2)]);
    var csv = "﻿" + L.map(function (l) { return l.map(cel).join(";"); }).join("\r\n");
    baixarArquivo(new Blob([csv], { type: "text/csv;charset=utf-8" }), "Medicao-" + seq + "-Contrato-" + nomeArq(k.numero) + ".csv");
    A.avisar("Planilha baixada (abre no Excel)", "ok");
  }

  // =================================================================
  // CONTRATOS
  // =================================================================
  function verContratos(c) {
    var S = P.S;
    c.innerHTML = '<div class="cab-secao"><h3 style="margin:0">Contratos e planilha de preços</h3><button class="prim dir" id="pf-novo-k">+ Novo contrato</button></div>' +
      (S.contr.length ? S.contr.map(function (k) {
        var medido = medidoContrato(k.id), nOS = S.obras.filter(function (o) { return o.contrato_id === k.id; }).length;
        var vence = k.fim && k.fim < A.isoLocal(new Date());
        return '<div class="cartao clic" data-k="' + k.id + '" style="cursor:pointer' + (k.ativo ? "" : ";opacity:.6") + '"><div class="linha"><h3>Contrato ' + esc(k.numero) + "</h3>" +
          '<span class="selo">🏛️ ' + esc(nomePref(k.prefeitura_id)) + "</span>" + (k.ativo ? "" : '<span class="selo critico">encerrado</span>') +
          (vence && k.ativo ? '<span class="selo atencao">vigência terminou</span>' : "") + "</div>" +
          (k.objeto ? '<div class="peq">' + esc(k.objeto) + "</div>" : "") +
          '<div class="peq mudo">' + (k.inicio || k.fim ? "Vigência " + (k.inicio ? A.dataSimples(k.inicio) : "?") + " a " + (k.fim ? A.dataSimples(k.fim) : "?") + " · " : "") +
          (k.itens || []).length + " itens · " + nOS + " OS · medido " + A.dinheiro(medido) + (k.valor_total ? " de " + A.dinheiro(k.valor_total) : "") + "</div></div>";
      }).join("") : '<div class="cartao vazio">Nenhum contrato. Cadastre o contrato (ou ata de registro de preços) com a planilha de itens e preços unitários.</div>');
    $("#pf-novo-k", c).onclick = function () { editarContrato(null); };
    $$("[data-k]", c).forEach(function (d) { d.onclick = function () { editarContrato(d.dataset.k); }; });
  }

  // Lê a planilha colada do Excel: código | descrição | unidade | quantidade | preço unitário
  function lerPlanilha(texto) {
    var itens = [], ignoradas = 0;
    String(texto || "").split(/\r?\n/).forEach(function (linha) {
      if (!linha.trim()) return;
      var c = (linha.indexOf("\t") >= 0 ? linha.split("\t") : linha.split(";")).map(function (x) { return x.replace(/^"|"$/g, "").trim(); });
      // formato brasileiro do Excel: "1.000" = mil; "85,90" = 85.9
      var num = function (v) {
        v = String(v || "").replace(/R\$\s*/i, "").replace(/\s/g, "");
        if (/^-?\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, "");
        return A.lerNumero(v);
      };
      if (c.length < 5 || !c[1] || /^descri/i.test(semAcento(c[1]))) { ignoradas++; return; }
      itens.push({ codigo: c[0], descricao: c[1], un: c[2] || "un", qtd: num(c[3]), valor: arred(num(c[4])) });
    });
    return { itens: itens, ignoradas: ignoradas };
  }
  function planilhaTexto(itens) {
    return (itens || []).map(function (i) {
      return [i.codigo || "", i.descricao, i.un || "", A.numero(i.qtd || 0, 3).replace(/\./g, ""), A.numero(i.valor || 0).replace(/\./g, "")].join("\t");
    }).join("\n");
  }

  function editarContrato(id) {
    var S = P.S, k = id ? P.porId(S.contr, id) : null;
    if (!S.pref.length) { A.avisar("Cadastre a prefeitura primeiro.", "erro"); sub = "prefeituras"; redesenhar(); return; }
    var j = A.janela(
      '<div class="duas"><div><label for="kc-pref">Prefeitura *</label><select id="kc-pref">' + S.pref.map(function (p) { return '<option value="' + p.id + '">' + esc(p.nome) + "</option>"; }).join("") +
      '</select></div><div><label for="kc-num">Nº do contrato / ata *</label><input id="kc-num" maxlength="80" placeholder="Ex.: 045/2026"></div></div>' +
      '<div class="duas"><div><label for="kc-proc">Processo / licitação</label><input id="kc-proc" maxlength="120" placeholder="Ex.: Pregão 12/2026"></div>' +
      '<div><label for="kc-sec">Secretaria</label><input id="kc-sec" maxlength="150"></div></div>' +
      '<label for="kc-obj">Objeto</label><textarea id="kc-obj" rows="2" maxlength="1000" placeholder="Ex.: Manutenção elétrica e pintura de prédios públicos"></textarea>' +
      '<div class="duas"><div><label for="kc-ini">Início</label><input type="date" id="kc-ini"></div><div><label for="kc-fim">Fim</label><input type="date" id="kc-fim"></div></div>' +
      '<div class="duas"><div><label for="kc-valor">Valor total do contrato (R$)</label><input id="kc-valor" inputmode="decimal"></div>' +
      '<div><label for="kc-bdi">BDI (%)</label><input id="kc-bdi" inputmode="decimal" placeholder="0"></div></div>' +
      '<label for="kc-itens">Planilha de itens</label><p class="mudo peq" style="margin:0 0 4px">Copie do Excel e cole aqui as colunas, nesta ordem: <b>código · descrição · unidade · quantidade contratada · preço unitário</b> (uma linha por item). ' +
      "O funcionário vê só a descrição (sem preço) para lançar as quantidades.</p>" +
      '<textarea id="kc-itens" rows="7" style="font-family:monospace;font-size:13px;white-space:pre" placeholder="1.1\tTroca de lâmpada LED 100W\tun\t500\t85,90"></textarea>' +
      '<div id="kc-prev" class="peq"></div>' +
      '<label for="kc-obs">Observações</label><textarea id="kc-obs" rows="2"></textarea>' +
      (k ? '<label class="marca-linha"><input type="checkbox" id="kc-ativo"> Contrato ativo</label>' : "") +
      '<div id="kc-erro"></div><div class="acoes"><button class="prim" id="kc-salvar">Salvar</button>' + (k ? '<button class="perigo" id="kc-apagar">Apagar</button>' : "") + "</div>",
      { titulo: k ? "Contrato " + k.numero : "Novo contrato", larga: true, fixa: true });
    var el = j.el;
    if (k) {
      $("#kc-pref", el).value = k.prefeitura_id; $("#kc-num", el).value = k.numero; $("#kc-proc", el).value = k.processo || ""; $("#kc-sec", el).value = k.secretaria || "";
      $("#kc-obj", el).value = k.objeto || ""; $("#kc-ini", el).value = k.inicio || ""; $("#kc-fim", el).value = k.fim || "";
      $("#kc-valor", el).value = k.valor_total ? A.numero(k.valor_total) : ""; $("#kc-bdi", el).value = k.bdi ? A.numero(k.bdi) : "";
      $("#kc-itens", el).value = planilhaTexto(k.itens); $("#kc-obs", el).value = k.observacoes || ""; $("#kc-ativo", el).checked = k.ativo;
    } else if (filtro.pref) $("#kc-pref", el).value = filtro.pref;
    function previa() {
      var r = lerPlanilha($("#kc-itens", el).value), tot = r.itens.reduce(function (s, i) { return s + i.qtd * i.valor; }, 0);
      $("#kc-prev", el).innerHTML = r.itens.length ? '<div class="tabela-caixa" style="max-height:220px;overflow:auto;margin-top:6px"><table><thead><tr><th>Código</th><th>Descrição</th><th>Un</th><th class="num">Qtd</th><th class="num">Preço un.</th></tr></thead><tbody>' +
        r.itens.map(function (i) { return "<tr><td>" + esc(i.codigo) + "</td><td>" + esc(i.descricao) + "</td><td>" + esc(i.un) + '</td><td class="num">' + A.numero(i.qtd, 3) + '</td><td class="num">' + A.dinheiro(i.valor) + "</td></tr>"; }).join("") +
        "</tbody></table></div>" + '<div class="mudo" style="margin-top:4px">' + r.itens.length + " itens · total da planilha " + A.dinheiro(tot) + (r.ignoradas ? " · " + r.ignoradas + " linha(s) ignorada(s) (cabeçalho ou faltando coluna)" : "") + "</div>" :
        (r.ignoradas ? '<div class="aviso">Nenhum item reconhecido. Confira se são 5 colunas: código, descrição, unidade, quantidade e preço.</div>' : "");
      return r;
    }
    $("#kc-itens", el).oninput = previa;
    previa();
    $("#kc-salvar", el).onclick = function () {
      var b = this, erro = function (m) { $("#kc-erro", el).innerHTML = '<div class="aviso erro">' + esc(m) + "</div>"; };
      if (!P.val(el, "#kc-num")) { erro("Informe o nº do contrato."); return; }
      var r = previa();
      var dados = { prefeitura_id: $("#kc-pref", el).value, numero: P.val(el, "#kc-num"), processo: P.nulo(P.val(el, "#kc-proc")), secretaria: P.nulo(P.val(el, "#kc-sec")),
        objeto: P.nulo(P.val(el, "#kc-obj")), inicio: $("#kc-ini", el).value || null, fim: $("#kc-fim", el).value || null,
        valor_total: P.val(el, "#kc-valor") ? arred(A.lerNumero(P.val(el, "#kc-valor"))) : null, bdi: arred(A.lerNumero(P.val(el, "#kc-bdi"))),
        itens: r.itens, observacoes: P.nulo(P.val(el, "#kc-obs")) };
      if (k) dados.ativo = $("#kc-ativo", el).checked;
      A.ocupado(b, true, "Salvando...");
      var p = k ? P.sb.from("contratos").update(dados).eq("id", k.id).select().single() : P.sb.from("contratos").insert(dados).select().single();
      P.q(p).then(function (n) { P.trocar(S.contr, n); j.fechar(); A.avisar("Contrato salvo", "ok"); redesenhar(); })
        .catch(function (e) { A.ocupado(b, false); erro(A.msgErro(e)); });
    };
    if (k) $("#kc-apagar", el).onclick = function () {
      var nm = S.med.filter(function (m) { return m.contrato_id === k.id; }).length;
      if (!A.confirmar("Apagar o contrato " + k.numero + "?" + (nm ? " ATENÇÃO: as " + nm + " medição(ões) dele também serão apagadas." : "") + " As OS continuam, sem contrato.")) return;
      P.q(P.sb.from("contratos").delete().eq("id", k.id)).then(function () {
        P.tirar(S.contr, k.id);
        S.med = S.med.filter(function (m) { return m.contrato_id !== k.id; }); P.S.med = S.med;
        S.obras.forEach(function (o) { if (o.contrato_id === k.id) o.contrato_id = null; });
        j.fechar(); A.avisar("Apagado", "ok"); redesenhar();
      }).catch(P.falhou);
    };
  }

  // =================================================================
  // PREFEITURAS
  // =================================================================
  function verPrefeituras(c) {
    var S = P.S;
    c.innerHTML = '<div class="cab-secao"><h3 style="margin:0">Prefeituras / órgãos</h3><button class="prim dir" id="pf-nova-p">+ Nova prefeitura</button></div>' +
      (S.pref.length ? S.pref.map(function (p) {
        var nOS = S.obras.filter(function (o) { return o.prefeitura_id === p.id; }).length, nK = contratosDe(p.id).length;
        return '<div class="cartao clic" data-p="' + p.id + '" style="cursor:pointer' + (p.ativo ? "" : ";opacity:.6") + '"><div class="linha"><h3>🏛️ ' + esc(p.nome) + "</h3>" +
          (p.ativo ? "" : '<span class="selo critico">inativa</span>') + '<span class="dir peq mudo">' + nK + " contrato(s) · " + nOS + " OS</span></div>" +
          '<div class="peq mudo">' + esc([p.cnpj ? "CNPJ " + p.cnpj : "", [p.cidade, p.uf].filter(Boolean).join("/"), p.contato, p.telefone, p.email].filter(Boolean).join(" · ")) + "</div></div>";
      }).join("") : '<div class="cartao vazio">Cadastre as prefeituras (ou outros órgãos públicos) que contratam a AGE.</div>');
    $("#pf-nova-p", c).onclick = function () { editarPrefeitura(null); };
    $$("[data-p]", c).forEach(function (d) { d.onclick = function () { editarPrefeitura(d.dataset.p); }; });
  }

  function editarPrefeitura(id) {
    var S = P.S, p = id ? P.porId(S.pref, id) : null;
    var j = A.janela('<label for="pp-nome">Nome *</label><input id="pp-nome" maxlength="150" placeholder="Ex.: Prefeitura Municipal de Contagem">' +
      '<div class="duas"><div><label for="pp-cnpj">CNPJ</label><input id="pp-cnpj" maxlength="20"></div><div><label for="pp-cid">Cidade / UF</label>' +
      '<div class="linha" style="flex-wrap:nowrap"><input id="pp-cid" maxlength="80"><input id="pp-uf" maxlength="2" style="width:60px" placeholder="UF"></div></div></div>' +
      '<label for="pp-end">Endereço</label><input id="pp-end" maxlength="300">' +
      '<div class="duas"><div><label for="pp-cont">Contato (gestor / setor)</label><input id="pp-cont" maxlength="120"></div><div><label for="pp-tel">Telefone</label><input id="pp-tel" type="tel" maxlength="40"></div></div>' +
      '<label for="pp-email">E-mail</label><input id="pp-email" type="email" maxlength="200">' +
      (p ? '<label class="marca-linha"><input type="checkbox" id="pp-ativo"> Ativa</label>' : "") +
      '<div id="pp-erro"></div><div class="acoes"><button class="prim" id="pp-salvar">Salvar</button>' + (p ? '<button class="perigo" id="pp-apagar">Apagar</button>' : "") + "</div>",
      { titulo: p ? p.nome : "Nova prefeitura" });
    var el = j.el;
    if (p) {
      $("#pp-nome", el).value = p.nome; $("#pp-cnpj", el).value = p.cnpj || ""; $("#pp-cid", el).value = p.cidade || ""; $("#pp-uf", el).value = p.uf || "";
      $("#pp-end", el).value = p.endereco || ""; $("#pp-cont", el).value = p.contato || ""; $("#pp-tel", el).value = p.telefone || ""; $("#pp-email", el).value = p.email || "";
      $("#pp-ativo", el).checked = p.ativo;
    } else $("#pp-uf", el).value = "MG";
    $("#pp-salvar", el).onclick = function () {
      var b = this;
      if (!P.val(el, "#pp-nome")) { $("#pp-erro", el).innerHTML = '<div class="aviso erro">Informe o nome.</div>'; return; }
      var dados = { nome: P.val(el, "#pp-nome"), cnpj: P.nulo(P.val(el, "#pp-cnpj")), cidade: P.nulo(P.val(el, "#pp-cid")), uf: P.nulo(P.val(el, "#pp-uf").toUpperCase()),
        endereco: P.nulo(P.val(el, "#pp-end")), contato: P.nulo(P.val(el, "#pp-cont")), telefone: P.nulo(P.val(el, "#pp-tel")), email: P.nulo(P.val(el, "#pp-email")) };
      if (p) dados.ativo = $("#pp-ativo", el).checked;
      A.ocupado(b, true, "Salvando...");
      var q = p ? P.sb.from("prefeituras").update(dados).eq("id", p.id).select().single() : P.sb.from("prefeituras").insert(dados).select().single();
      P.q(q).then(function (n) {
        P.trocar(S.pref, n); S.pref.sort(function (a, c2) { return a.nome.localeCompare(c2.nome); });
        j.fechar(); A.avisar("Salvo", "ok"); redesenhar();
      }).catch(function (e) { A.ocupado(b, false); P.falhou(e); });
    };
    if (p) $("#pp-apagar", el).onclick = function () {
      var nK = contratosDe(p.id).length;
      if (!A.confirmar("Apagar " + p.nome + "?" + (nK ? " ATENÇÃO: os " + nK + " contrato(s) e as medições também serão apagados." : "") + " As OS continuam guardadas. Para só esconder, desmarque “Ativa”.")) return;
      P.q(P.sb.from("prefeituras").delete().eq("id", p.id)).then(function () {
        var ks = contratosDe(p.id).map(function (k) { return k.id; });
        P.tirar(S.pref, p.id);
        S.contr = S.contr.filter(function (k) { return k.prefeitura_id !== p.id; }); P.S.contr = S.contr;
        S.med = S.med.filter(function (m) { return ks.indexOf(m.contrato_id) < 0; }); P.S.med = S.med;
        S.obras.forEach(function (o) { if (o.prefeitura_id === p.id) { o.prefeitura_id = null; o.contrato_id = null; } });
        j.fechar(); A.avisar("Apagada", "ok"); redesenhar();
      }).catch(P.falhou);
    };
  }

// =================================================================
  // LICITAÇÕES (participação da AGE) e DOCUMENTOS de habilitação
  // =================================================================
  var MODALIDADE = { pregao_eletronico: "Pregão eletrônico", pregao_presencial: "Pregão presencial", concorrencia: "Concorrência",
    tomada_precos: "Tomada de preços", convite: "Convite", dispensa: "Dispensa / cotação", credenciamento: "Credenciamento", outra: "Outra" };
  var STATUS_LIC = { analise: "Em análise", participar: "Vamos participar", enviada: "Proposta enviada", ganhou: "Ganhou",
    perdeu: "Perdeu", desistiu: "Desistiu", cancelada: "Cancelada / deserta" };
  var COR_LIC = { analise: "", participar: "atencao", enviada: "atencao", ganhou: "bom", perdeu: "critico", desistiu: "", cancelada: "" };
  var LIC_ATIVA = ["analise", "participar", "enviada"];
  var DOCS_PADRAO = ["Contrato social e alterações", "Cartão CNPJ", "Documento do sócio / representante", "CND Federal (Receita e PGFN)",
    "CND Estadual", "CND Municipal", "CRF - FGTS", "CNDT - Trabalhista", "Certidão negativa de falência", "Balanço patrimonial",
    "Registro no CREA / CFT", "Atestado de capacidade técnica", "Inscrição municipal / estadual"];
  var DIA = 86400000;

  function diasAte(data) { return Math.floor((A.inicioDia(new Date(data)) - A.inicioDia(new Date())) / DIA); }
  function dataHoraLocal(v) { if (!v) return ""; var d = new Date(v); return A.isoLocal(d) + "T" + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
  function lerDataHora(v) { return v ? new Date(v).toISOString() : null; }
  function quando(v) {
    if (!v) return "";
    var n = diasAte(v);
    return n < 0 ? "já foi (" + A.dataHora(v) + ")" : n === 0 ? "HOJE às " + A.hora(v) : n === 1 ? "amanhã às " + A.hora(v) : "em " + n + " dias (" + A.dataHora(v) + ")";
  }
  // proposta: preço unitário com BDI (arredondado), total = soma das linhas
  function linhasProposta(itens, bdi) {
    return (itens || []).map(function (i) {
      var pu = arred((Number(i.valor) || 0) * (1 + (Number(bdi) || 0) / 100));
      return { codigo: i.codigo || "", descricao: i.descricao, un: i.un, qtd: Number(i.qtd) || 0, pu: pu, total: arred((Number(i.qtd) || 0) * pu) };
    });
  }
  function totalProposta(itens, bdi) { return arred(linhasProposta(itens, bdi).reduce(function (t, l) { return t + l.total; }, 0)); }
  function docPorNome(nome) {
    var n = semAcento(nome);
    return P.S.docs.filter(function (d) { return semAcento(d.nome) === n; })[0] || null;
  }
  function seloValidade(d) {
    if (!d || !d.validade) return d ? '<span class="selo">sem validade</span>' : "";
    var n = diasAte(d.validade + "T12:00:00");
    if (n < 0) return '<span class="selo critico">vencido em ' + A.dataSimples(d.validade) + "</span>";
    if (n <= 30) return '<span class="selo atencao">vence em ' + n + " dia(s)</span>";
    return '<span class="selo bom">válido até ' + A.dataSimples(d.validade) + "</span>";
  }
  function linkAgenda(l) {
    var ini = new Date(l.abertura), fim = new Date(ini.getTime() + 3600000);
    var f = function (d) { return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); };
    return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent("Licitação " + (l.numero || "") + " - " + l.orgao) +
      "&dates=" + f(ini) + "/" + f(fim) + "&details=" + encodeURIComponent((l.objeto || "") + (l.link ? "\n" + l.link : ""));
  }

  // avisos para a aba Hoje do painel
  function avisosHoje(S) {
    if (S.semPref) return "";
    var h = "";
    var prox = (S.lic || []).filter(function (l) { return LIC_ATIVA.indexOf(l.status) >= 0 && l.abertura && diasAte(l.abertura) >= 0 && diasAte(l.abertura) <= 7; })
      .sort(function (a, b) { return new Date(a.abertura) - new Date(b.abertura); });
    if (prox.length) h += '<div class="aviso">📑 <b>Licitações chegando:</b> ' + prox.map(function (l) {
      return esc(l.orgao + (l.numero ? " " + l.numero : "")) + " — abre " + esc(quando(l.abertura));
    }).join("; ") + '. Veja em <a href="#prefeitura">Prefeitura → Licitações</a>.</div>';
    var venc = (S.docs || []).filter(function (d) { return d.validade && diasAte(d.validade + "T12:00:00") <= 15; });
    if (venc.length) h += '<div class="aviso erro">📄 <b>Documentos vencidos ou vencendo:</b> ' + venc.map(function (d) {
      var n = diasAte(d.validade + "T12:00:00"); return esc(d.nome) + (n < 0 ? " (vencido)" : " (vence em " + n + " dia(s))");
    }).join(", ") + '. Renove e atualize em <a href="#prefeitura">Prefeitura → Documentos</a>.</div>';
    return h;
  }

  function verLicitacoes(c) {
    var S = P.S;
    c.innerHTML = '<div class="cab-secao"><h3 style="margin:0">Licitações</h3><button class="prim dir" id="pf-nova-lic">+ Nova licitação</button></div>' +
      '<div class="filtros"><select id="lc-f" aria-label="Situação"><option value="ativas">Em andamento</option><option value="encerradas">Encerradas</option><option value="todas">Todas</option></select></div><div id="lc-lista"></div>';
    $("#lc-f", c).value = filtro.lic || "ativas";
    $("#lc-f", c).onchange = function () { filtro.lic = this.value; listar(); };
    $("#pf-nova-lic", c).onclick = function () { editarLicitacao(null); };
    function listar() {
      var f = filtro.lic || "ativas";
      var lista = S.lic.filter(function (l) { var at = LIC_ATIVA.indexOf(l.status) >= 0; return f === "todas" || (f === "ativas") === at; })
        .sort(function (a, b) {
          var aa = LIC_ATIVA.indexOf(a.status) >= 0, ab = LIC_ATIVA.indexOf(b.status) >= 0;
          if (aa !== ab) return aa ? -1 : 1;
          var x = a.abertura ? new Date(a.abertura).getTime() : 9e15, y = b.abertura ? new Date(b.abertura).getTime() : 9e15;
          return aa ? x - y : y - x;
        });
      var l = $("#lc-lista", c);
      if (!lista.length) { l.innerHTML = '<div class="cartao vazio">' + (f === "ativas" ? "Nenhuma licitação em andamento. Cadastre o edital que a AGE vai disputar." : "Nada aqui.") + "</div>"; return; }
      l.innerHTML = lista.map(function (x) {
        var docs = x.documentos || [], okd = docs.filter(function (d) { return d.ok; }).length, ativa = LIC_ATIVA.indexOf(x.status) >= 0;
        var n = x.abertura ? diasAte(x.abertura) : null;
        return '<div class="cartao clic" data-lic="' + x.id + '" style="cursor:pointer"><div class="linha"><h3>' + esc(x.orgao) + "</h3>" +
          '<span class="selo ' + COR_LIC[x.status] + '">' + STATUS_LIC[x.status] + "</span>" +
          (ativa && n !== null && n >= 0 && n <= 3 ? '<span class="selo critico">abre ' + (n === 0 ? "HOJE" : n === 1 ? "amanhã" : "em " + n + " dias") + "</span>" : "") + "</div>" +
          '<div class="peq">' + esc([MODALIDADE[x.modalidade], x.numero].filter(Boolean).join(" nº ")) + (x.objeto ? " · " + esc(x.objeto.length > 120 ? x.objeto.slice(0, 120) + "…" : x.objeto) : "") + "</div>" +
          '<div class="peq mudo">' + (x.abertura ? "📅 Abertura " + esc(quando(x.abertura)) : "Sem data de abertura") +
          (x.visita && ativa && diasAte(x.visita) >= 0 ? " · visita técnica " + esc(quando(x.visita)) : "") + "</div>" +
          '<div class="linha" style="margin-top:6px">' + (docs.length ? '<span class="selo ' + (okd === docs.length ? "bom" : "atencao") + '">documentos ' + okd + "/" + docs.length + "</span>" : "") +
          (x.proposta ? '<span class="selo">proposta ' + A.dinheiro(x.proposta) + "</span>" : "") +
          (x.valor_estimado ? '<span class="peq mudo">estimado ' + A.dinheiro(x.valor_estimado) + "</span>" : "") +
          (x.contrato_id ? '<span class="selo bom">contrato criado</span>' : "") + "</div></div>";
      }).join("");
      $$("[data-lic]", l).forEach(function (d) { d.onclick = function () { editarLicitacao(d.dataset.lic); }; });
    }
    listar();
  }

  function editarLicitacao(id) {
    var S = P.S, x = id ? P.porId(S.lic, id) : null;
    var docs = x ? JSON.parse(JSON.stringify(x.documentos || [])) :
      DOCS_PADRAO.concat(S.docs.map(function (d) { return d.nome; })).filter(function (n, i, a) {
        return a.findIndex(function (m) { return semAcento(m) === semAcento(n); }) === i;
      }).map(function (n) { return { nome: n, ok: false }; });
    var j = A.janela(
      '<div class="duas"><div><label for="lc-orgao">Órgão *</label><input id="lc-orgao" list="lc-dl-pref" maxlength="200" placeholder="Ex.: Prefeitura Municipal de Contagem">' +
      '<datalist id="lc-dl-pref">' + S.pref.map(function (p) { return '<option value="' + esc(p.nome) + '">'; }).join("") + "</datalist></div>" +
      '<div><label for="lc-mod">Modalidade</label><select id="lc-mod"><option value="">—</option>' + Object.keys(MODALIDADE).map(function (m) { return '<option value="' + m + '">' + MODALIDADE[m] + "</option>"; }).join("") + "</select></div></div>" +
      '<div class="duas"><div><label for="lc-num">Nº do edital / processo</label><input id="lc-num" maxlength="120"></div>' +
      '<div><label for="lc-st">Situação</label><select id="lc-st">' + Object.keys(STATUS_LIC).map(function (m) { return '<option value="' + m + '">' + STATUS_LIC[m] + "</option>"; }).join("") + "</select></div></div>" +
      '<label for="lc-obj">Objeto</label><textarea id="lc-obj" rows="2" maxlength="2000"></textarea>' +
      '<label for="lc-link">Link do edital / portal</label><input id="lc-link" type="url" maxlength="500" placeholder="https://...">' +
      '<div class="duas"><div><label for="lc-ab">Abertura das propostas</label><input type="datetime-local" id="lc-ab"></div>' +
      '<div><label for="lc-vis">Visita técnica</label><input type="datetime-local" id="lc-vis"></div></div>' +
      '<div class="duas"><div><label for="lc-duv">Prazo para dúvidas / impugnação</label><input type="datetime-local" id="lc-duv"></div>' +
      '<div><label for="lc-est">Valor estimado pelo órgão (R$)</label><input id="lc-est" inputmode="decimal"></div></div>' +
      '<h3 style="margin-top:14px">Documentos de habilitação</h3><p class="mudo peq" style="margin:0 0 4px">Marque o que já está separado. A validade vem da aba <b>Documentos</b>.</p>' +
      '<div id="lc-docs"></div><div class="linha" style="margin-top:6px;flex-wrap:nowrap"><input id="lc-doc-novo" maxlength="150" placeholder="Outro documento exigido no edital"><button class="peq" id="lc-doc-add">+ Incluir</button></div>' +
      '<h3 style="margin-top:14px">Proposta de preços</h3><p class="mudo peq" style="margin:0 0 4px">Cole do Excel: <b>código · descrição · unidade · quantidade · preço unitário (sem BDI)</b>.</p>' +
      '<textarea id="lc-itens" rows="6" style="font-family:monospace;font-size:13px;white-space:pre"></textarea>' +
      '<div class="duas"><div><label for="lc-bdi">BDI (%)</label><input id="lc-bdi" inputmode="decimal" placeholder="0"></div>' +
      '<div><label for="lc-prop">Valor da proposta (R$)</label><input id="lc-prop" inputmode="decimal" placeholder="sai da planilha"></div></div>' +
      '<div id="lc-prev" class="peq"></div>' +
      '<div class="duas"><div><label for="lc-val">Validade da proposta (dias)</label><input id="lc-val" type="number" min="1" max="365"></div>' +
      '<div><label for="lc-prazo">Prazo de execução</label><input id="lc-prazo" maxlength="200" placeholder="Ex.: 12 meses"></div></div>' +
      '<label for="lc-res">Resultado (vencedor, valor, colocação)</label><input id="lc-res" maxlength="300">' +
      '<label for="lc-obs">Observações</label><textarea id="lc-obs" rows="2"></textarea>' +
      '<div id="lc-erro"></div><div class="acoes"><button class="prim" id="lc-salvar">Salvar</button><button id="lc-pdf">📄 Proposta em PDF</button>' +
      '<a class="botao oculto" id="lc-agenda" target="_blank" rel="noopener">📅 Pôr na agenda</a><a class="botao oculto" id="lc-edital" target="_blank" rel="noopener">🔗 Abrir edital</a></div>' +
      '<div class="acoes" style="margin-top:8px"><button class="bom oculto" id="lc-ganhou">🏆 Ganhou: criar o contrato</button>' + (x ? '<button class="perigo" id="lc-apagar">Apagar</button>' : "") + "</div>",
      { titulo: x ? "Licitação " + (x.numero || "") : "Nova licitação", larga: true, fixa: true });
    var el = j.el;
    if (x) {
      $("#lc-orgao", el).value = x.orgao; $("#lc-mod", el).value = x.modalidade || ""; $("#lc-num", el).value = x.numero || ""; $("#lc-st", el).value = x.status;
      $("#lc-obj", el).value = x.objeto || ""; $("#lc-link", el).value = x.link || ""; $("#lc-ab", el).value = dataHoraLocal(x.abertura);
      $("#lc-vis", el).value = dataHoraLocal(x.visita); $("#lc-duv", el).value = dataHoraLocal(x.prazo_duvidas);
      $("#lc-est", el).value = x.valor_estimado ? A.numero(x.valor_estimado) : ""; $("#lc-itens", el).value = planilhaTexto(x.itens);
      $("#lc-bdi", el).value = x.bdi ? A.numero(x.bdi) : ""; $("#lc-prop", el).value = x.proposta && !(x.itens || []).length ? A.numero(x.proposta) : "";
      $("#lc-val", el).value = x.validade_dias || 60; $("#lc-prazo", el).value = x.prazo_execucao || ""; $("#lc-res", el).value = x.resultado || ""; $("#lc-obs", el).value = x.observacoes || "";
    } else $("#lc-val", el).value = 60;

    function desenharDocs() {
      $("#lc-docs", el).innerHTML = docs.map(function (d, i) {
        return '<div class="linha" style="padding:4px 0;border-bottom:1px solid var(--borda)"><label class="marca-linha" style="margin:0;font-weight:400;flex:1"><input type="checkbox" data-doc="' + i + '"' + (d.ok ? " checked" : "") + "> " + esc(d.nome) + "</label>" +
          seloValidade(docPorNome(d.nome)) + '<button class="peq texto" data-doc-tirar="' + i + '" aria-label="Tirar documento">✕</button></div>';
      }).join("");
      $$("[data-doc]", el).forEach(function (cb) { cb.onchange = function () { docs[Number(cb.dataset.doc)].ok = cb.checked; }; });
      $$("[data-doc-tirar]", el).forEach(function (b) { b.onclick = function () { docs.splice(Number(b.dataset.docTirar), 1); desenharDocs(); }; });
    }
    desenharDocs();
    $("#lc-doc-add", el).onclick = function () { var n = P.val(el, "#lc-doc-novo"); if (!n) return; docs.push({ nome: n, ok: false }); $("#lc-doc-novo", el).value = ""; desenharDocs(); };

    function calc() {
      var r = lerPlanilha($("#lc-itens", el).value), bdi = A.lerNumero($("#lc-bdi", el).value);
      var total = r.itens.length ? totalProposta(r.itens, bdi) : A.lerNumero($("#lc-prop", el).value), est = A.lerNumero($("#lc-est", el).value);
      $("#lc-prop", el).disabled = r.itens.length > 0;
      if (r.itens.length) $("#lc-prop", el).value = A.numero(total);
      $("#lc-prev", el).innerHTML = (r.itens.length ? r.itens.length + " itens" + (bdi ? " · preços com BDI de " + A.numero(bdi) + "%" : "") + " · " : "") +
        (total ? "<b>Proposta: " + A.dinheiro(total) + "</b>" : "") +
        (total && est ? " · " + (total <= est ? A.numero((1 - total / est) * 100, 1) + "% abaixo do estimado" : '<span style="color:var(--critico)">' + A.numero((total / est - 1) * 100, 1) + "% ACIMA do estimado</span>") : "") +
        (r.ignoradas ? ' · <span class="mudo">' + r.ignoradas + " linha(s) ignorada(s)</span>" : "");
      return { itens: r.itens, bdi: bdi, total: total };
    }
    ["#lc-itens", "#lc-bdi", "#lc-prop", "#lc-est"].forEach(function (s2) { $(s2, el).oninput = calc; });
    calc();
    function botoes() {
      var ab = $("#lc-ab", el).value, ln = P.val(el, "#lc-link");
      $("#lc-agenda", el).classList.toggle("oculto", !ab);
      if (ab) $("#lc-agenda", el).href = linkAgenda({ abertura: new Date(ab), numero: P.val(el, "#lc-num"), orgao: P.val(el, "#lc-orgao"), objeto: P.val(el, "#lc-obj"), link: ln });
      $("#lc-edital", el).classList.toggle("oculto", !/^https?:\/\//i.test(ln));
      if (/^https?:\/\//i.test(ln)) $("#lc-edital", el).href = ln;
      $("#lc-ganhou", el).classList.toggle("oculto", !($("#lc-st", el).value === "ganhou" && !(x && x.contrato_id)));
    }
    ["#lc-ab", "#lc-link", "#lc-st", "#lc-num", "#lc-orgao"].forEach(function (s2) { $(s2, el).addEventListener("input", botoes); $(s2, el).addEventListener("change", botoes); });
    botoes();

    function salvar() {
      if (!P.val(el, "#lc-orgao")) return Promise.reject(new Error("Informe o órgão."));
      var cc = calc(), orgao = P.val(el, "#lc-orgao");
      var pf = S.pref.filter(function (p) { return semAcento(p.nome) === semAcento(orgao); })[0];
      var dados = { orgao: orgao, prefeitura_id: pf ? pf.id : (x ? x.prefeitura_id : null), modalidade: P.nulo($("#lc-mod", el).value), numero: P.nulo(P.val(el, "#lc-num")),
        status: $("#lc-st", el).value, objeto: P.nulo(P.val(el, "#lc-obj")), link: P.nulo(P.val(el, "#lc-link")),
        abertura: lerDataHora($("#lc-ab", el).value), visita: lerDataHora($("#lc-vis", el).value), prazo_duvidas: lerDataHora($("#lc-duv", el).value),
        valor_estimado: P.val(el, "#lc-est") ? arred(A.lerNumero(P.val(el, "#lc-est"))) : null, itens: cc.itens, bdi: arred(cc.bdi), proposta: cc.total ? arred(cc.total) : null,
        validade_dias: Math.max(1, parseInt($("#lc-val", el).value, 10) || 60), prazo_execucao: P.nulo(P.val(el, "#lc-prazo")),
        documentos: docs, resultado: P.nulo(P.val(el, "#lc-res")), observacoes: P.nulo(P.val(el, "#lc-obs")) };
      var q = x ? P.sb.from("licitacoes").update(dados).eq("id", x.id).select().single() : P.sb.from("licitacoes").insert(dados).select().single();
      return P.q(q).then(function (n) { P.trocar(S.lic, n); x = n; el.closest(".modal").querySelector(".cab h2").textContent = "Licitação " + (n.numero || ""); botoes(); return n; });
    }
    $("#lc-salvar", el).onclick = function () {
      var b = this; A.ocupado(b, true, "Salvando...");
      salvar().then(function () { A.ocupado(b, false); A.avisar("Licitação salva", "ok"); redesenhar(); })
        .catch(function (e) { A.ocupado(b, false); $("#lc-erro", el).innerHTML = '<div class="aviso erro">' + esc(A.msgErro(e)) + "</div>"; });
    };
    $("#lc-pdf", el).onclick = function () {
      var b = this;
      if (!lerPlanilha($("#lc-itens", el).value).itens.length) { A.avisar("Cole a planilha da proposta para gerar o PDF.", "erro"); return; }
      A.ocupado(b, true, "Gerando PDF...");
      salvar().then(function (n) { return P.carregarJsPdf().then(function (JsPDF) { return pdfProposta(JsPDF, n); }).then(function (blob) {
        A.ocupado(b, false); redesenhar();
        entregarPdf(blob, "Proposta-" + (nomeArq(n.numero) || "licitacao") + "-" + nomeArq(n.orgao) + ".pdf", "Proposta de preços");
      }); }).catch(function (e) { A.ocupado(b, false); P.falhou(e); });
    };
    $("#lc-ganhou", el).onclick = function () {
      var b = this;
      var num = window.prompt("Nº do contrato assinado com o órgão:", P.val(el, "#lc-num"));
      if (num === null) return;
      A.ocupado(b, true, "Criando contrato...");
      salvar().then(function (n) {
        var pf = P.porId(S.pref, n.prefeitura_id);
        var pPref = pf ? Promise.resolve(pf) : P.q(P.sb.from("prefeituras").insert({ nome: n.orgao }).select().single()).then(function (np) {
          P.trocar(S.pref, np); S.pref.sort(function (a, c2) { return a.nome.localeCompare(c2.nome); }); return np;
        });
        return pPref.then(function (p2) {
          // os preços do contrato já levam o BDI da proposta (a medição não aplica de novo)
          var itens = linhasProposta(n.itens, n.bdi).map(function (l) { return { codigo: l.codigo, descricao: l.descricao, un: l.un, qtd: l.qtd, valor: l.pu }; });
          return P.q(P.sb.from("contratos").insert({ prefeitura_id: p2.id, numero: String(num).trim() || n.numero || "a definir",
            processo: [MODALIDADE[n.modalidade], n.numero].filter(Boolean).join(" ") || null, objeto: n.objeto, valor_total: n.proposta, bdi: 0, itens: itens,
            observacoes: "Criado da licitação " + (n.numero || "") + (Number(n.bdi) ? " (preços já com BDI de " + A.numero(n.bdi) + "%)" : "") }).select().single())
            .then(function (k) {
              P.trocar(S.contr, k);
              return P.q(P.sb.from("licitacoes").update({ contrato_id: k.id, prefeitura_id: p2.id }).eq("id", n.id).select().single()).then(function (n2) { P.trocar(S.lic, n2); return k; });
            });
        });
      }).then(function (k) {
        j.fechar(); sub = "contratos"; redesenhar(); A.avisar("Contrato criado. Confira as datas de vigência.", "ok"); editarContrato(k.id);
      }).catch(function (e) { A.ocupado(b, false); P.falhou(e); });
    };
    if (x) $("#lc-apagar", el).onclick = function () {
      if (!A.confirmar("Apagar esta licitação?")) return;
      P.q(P.sb.from("licitacoes").delete().eq("id", x.id)).then(function () { P.tirar(S.lic, x.id); j.fechar(); A.avisar("Apagada", "ok"); redesenhar(); }).catch(P.falhou);
    };
  }

  function pdfProposta(JsPDF, l) {
    var doc = new JsPDF({ unit: "mm", format: "a4" }), L = 15, R = 195, y = 18, E = A.CFG.EMPRESA || {}, linhas = linhasProposta(l.itens, l.bdi);
    function cab() {
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(90);
      doc.text("ITEM", L + 1, y); doc.text("DESCRIÇÃO", L + 17, y); doc.text("UN", 120, y); doc.text("QTD", 145, y, { align: "right" });
      doc.text("PREÇO UN.", 168, y, { align: "right" }); doc.text("TOTAL", R - 1, y, { align: "right" });
      y += 2; doc.setDrawColor(200); doc.setLineWidth(0.3); doc.line(L, y, R, y); y += 4; doc.setTextColor(20, 20, 20);
    }
    function espaco(alt) { if (y + alt > 278) { doc.addPage(); y = 18; cab(); return true; } return false; }
    y = cabecalhoPdf(doc, "PROPOSTA DE PREÇOS", ["Data: " + A.data(new Date())], L, R, y);
    y = caixaInfo(doc, [["Ao órgão:", l.orgao], ["Licitação:", [MODALIDADE[l.modalidade], l.numero].filter(Boolean).join(" nº ")], ["Objeto:", l.objeto]], L, R, y, 22);
    cab();
    linhas.forEach(function (i) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.8);
      var d = doc.splitTextToSize(tx(i.descricao), 98), alt = d.length * 4 + 2.2;
      espaco(alt);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.8);
      doc.text(tx(i.codigo), L + 1, y); doc.text(d, L + 17, y); doc.text(tx(i.un), 120, y);
      doc.text(tx(A.numero(i.qtd, 3)), 145, y, { align: "right" }); doc.text(tx(A.dinheiro(i.pu)), 168, y, { align: "right" }); doc.text(tx(A.dinheiro(i.total)), R - 1, y, { align: "right" });
      y += alt - 2.2; doc.setDrawColor(225); doc.setLineWidth(0.2); doc.line(L, y - 1.4, R, y - 1.4); y += 3;
    });
    espaco(14); y += 2;
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("VALOR GLOBAL DA PROPOSTA", 100, y); doc.text(tx(A.dinheiro(totalProposta(l.itens, l.bdi))), R - 1, y, { align: "right" }); y += 9;
    var cond = ["Validade da proposta: " + (l.validade_dias || 60) + " dias a contar da data de abertura."];
    if (l.prazo_execucao) cond.push("Prazo de execução: " + l.prazo_execucao + ".");
    if (Number(l.bdi)) cond.push("Preços unitários com BDI de " + A.numero(l.bdi) + "% incluído.");
    cond.push("Declaramos que nos preços propostos estão incluídos todos os custos diretos e indiretos, tributos, encargos sociais e trabalhistas, materiais, mão de obra, equipamentos e demais despesas necessárias à execução do objeto.");
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    cond.forEach(function (t) { var ls = doc.splitTextToSize(tx(t), R - L); espaco(ls.length * 4.6 + 2); doc.text(ls, L, y); y += ls.length * 4.6 + 2; });
    if (espaco(36)) y += 6; else y += 10;
    doc.text(tx((E.cidade ? E.cidade + ", " : "") + new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) + "."), L, y); y += 22;
    doc.setDrawColor(60); doc.setLineWidth(0.3); doc.line(60, y, 150, y);
    doc.text(tx(E.nome || "AGE Elétrica e Pintura"), 105, y + 4.5, { align: "center" });
    doc.setFontSize(8.5); doc.text(tx("Representante legal" + (E.documento ? " - " + E.documento : "")), 105, y + 9, { align: "center" });
    rodapePdf(doc, "Proposta de preços - " + l.orgao + (l.numero ? " - " + l.numero : ""), 210, 297);
    doc.setProperties({ title: tx("Proposta " + (l.numero || "") + " - " + l.orgao), author: tx(E.nome || "AGE Elétrica e Pintura") });
    return doc.output("blob");
  }

  function verDocumentos(c) {
    var S = P.S;
    var lista = S.docs.slice().sort(function (a, b) { return (a.validade || "9999") < (b.validade || "9999") ? -1 : (a.validade || "9999") > (b.validade || "9999") ? 1 : a.nome.localeCompare(b.nome); });
    c.innerHTML = '<div class="cab-secao"><h3 style="margin:0">Documentos de habilitação</h3><button class="prim dir" id="dc-novo">+ Documento</button></div>' +
      '<p class="mudo peq" style="margin-top:-4px">Certidões e documentos pedidos nas licitações. Cadastre a validade: o painel avisa na aba Hoje quando faltar 15 dias.</p>' +
      (lista.length ? lista.map(function (d) {
        return '<div class="cartao clic" data-doc-id="' + d.id + '" style="cursor:pointer"><div class="linha"><b>' + esc(d.nome) + "</b>" + seloValidade(d) +
          (d.link ? '<a class="dir peq" href="' + esc(d.link) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">🔗 abrir</a>' : "") + "</div>" +
          (d.observacao ? '<div class="peq mudo">' + esc(d.observacao) + "</div>" : "") + "</div>";
      }).join("") : '<div class="cartao vazio">Nenhum documento cadastrado.<div class="acoes" style="justify-content:center"><button class="prim" id="dc-padrao">Cadastrar a lista padrão (' + DOCS_PADRAO.length + " documentos)</button></div></div>");
    $("#dc-novo", c).onclick = function () { editarDocumento(null); };
    if ($("#dc-padrao", c)) $("#dc-padrao", c).onclick = function () {
      var b = this; A.ocupado(b, true, "Cadastrando...");
      P.q(P.sb.from("documentos").insert(DOCS_PADRAO.map(function (n) { return { nome: n }; })).select()).then(function (ns) {
        ns.forEach(function (n) { S.docs.push(n); }); A.avisar("Lista criada. Abra cada documento e coloque a validade.", "ok"); redesenhar();
      }).catch(function (e) { A.ocupado(b, false); P.falhou(e); });
    };
    $$("[data-doc-id]", c).forEach(function (d) { d.onclick = function () { editarDocumento(d.dataset.docId); }; });
  }

  function editarDocumento(id) {
    var S = P.S, d = id ? P.porId(S.docs, id) : null;
    var j = A.janela('<label for="dc-nome">Documento *</label><input id="dc-nome" maxlength="150" placeholder="Ex.: CND Federal">' +
      '<label for="dc-val">Válido até</label><input type="date" id="dc-val">' +
      '<label for="dc-link">Link do arquivo (Google Drive, site do órgão...)</label><input id="dc-link" type="url" maxlength="500" placeholder="https://...">' +
      '<label for="dc-obs">Observação</label><input id="dc-obs" maxlength="300" placeholder="Ex.: emitir em receita.fazenda.gov.br">' +
      '<div class="acoes"><button class="prim" id="dc-salvar">Salvar</button>' + (d ? '<button class="perigo" id="dc-apagar">Apagar</button>' : "") + "</div>",
      { titulo: d ? d.nome : "Novo documento" });
    var el = j.el;
    if (d) { $("#dc-nome", el).value = d.nome; $("#dc-val", el).value = d.validade || ""; $("#dc-link", el).value = d.link || ""; $("#dc-obs", el).value = d.observacao || ""; }
    $("#dc-salvar", el).onclick = function () {
      var b = this;
      if (!P.val(el, "#dc-nome")) { A.avisar("Informe o documento.", "erro"); return; }
      var dados = { nome: P.val(el, "#dc-nome"), validade: $("#dc-val", el).value || null, link: P.nulo(P.val(el, "#dc-link")), observacao: P.nulo(P.val(el, "#dc-obs")) };
      A.ocupado(b, true, "Salvando...");
      var q = d ? P.sb.from("documentos").update(dados).eq("id", d.id).select().single() : P.sb.from("documentos").insert(dados).select().single();
      P.q(q).then(function (n) { P.trocar(S.docs, n); j.fechar(); A.avisar("Salvo", "ok"); redesenhar(); }).catch(function (e) { A.ocupado(b, false); P.falhou(e); });
    };
    if (d) $("#dc-apagar", el).onclick = function () {
      if (!A.confirmar("Apagar " + d.nome + "?")) return;
      P.q(P.sb.from("documentos").delete().eq("id", d.id)).then(function () { P.tirar(S.docs, d.id); j.fechar(); A.avisar("Apagado", "ok"); redesenhar(); }).catch(P.falhou);
    };
  }

  window.AGE_PREF = { ver: ver, avisosHoje: avisosHoje, lerPlanilha: lerPlanilha, totalMed: totalMed, totalProposta: totalProposta };
})();
