// Painel do dono — 🧾 ASSISTENTE DE NOTA FISCAL (NFS-e)
// Monta os dados da nota a partir do orçamento (tomador pelo CNPJ, serviço, valor, ISS do município, retenção) e deixa tudo pronto
// para copiar no emissor oficial (Emissor Nacional). O app NÃO emite a nota por conta própria: a emissão é feita no portal com o
// login/certificado da empresa. Depois de emitida, "Registrar a nota emitida" lança a nota no resultado (impostos, DAS, recebimentos).
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var CHAVE = "age_nfse_cod_v1", BASE = { "BELO HORIZONTE/MG": "31.01.01", "BETIM/MG": "07.02.01" };
  var EMISSOR = "https://www.nfse.gov.br/EmissorNacional/";
  function semAc(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function chaveMun(m) { return semAc(m).toUpperCase().replace(/\s+/g, " ").replace(/\s*\/\s*/, "/").trim(); }
  function tabCod() { var o = {}; try { o = JSON.parse(localStorage.getItem(CHAVE) || "{}") || {}; } catch (e) { o = {}; } return Object.assign({}, BASE, o); }
  function codDe(m) { var k = chaveMun(m); return k ? (tabCod()[k] || "") : ""; }
  function guardarCod(m, c) { var k = chaveMun(m); if (!k || !c) return; try { var o = JSON.parse(localStorage.getItem(CHAVE) || "{}") || {}; o[k] = c; localStorage.setItem(CHAVE, JSON.stringify(o)); } catch (e) { /* sem armazenamento */ } }
  function reais(v) { return Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function copiar(t, msg) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { A.avisar(msg || "Copiado", "ok"); }, function () { window.prompt("Copie:", t); });
    else window.prompt("Copie:", t);
  }

  // d: { cliente, documento, endereco, municipio, descricao, valor, iss, numeroOrc }
  function abrir(P, d) {
    var iss0 = Number(d.iss) || 0, mun0 = d.municipio || "";
    var campo = function (id, rot, valor, extra) {
      return '<div class="linha" style="align-items:flex-end;gap:6px"><div style="flex:1"><label for="nf-' + id + '">' + rot + '</label>' +
        (extra === "area" ? '<textarea id="nf-' + id + '" rows="4" maxlength="2000"></textarea>' : '<input id="nf-' + id + '" ' + (extra || "") + ">") + '</div><button class="peq" data-cp="' + id + '" type="button">📋 Copiar</button></div>';
    };
    var j = A.janela(
      '<div class="aviso">⚠️ O app <b>não emite</b> a nota sozinho. Ele deixa os dados prontos: copie campo por campo no <b>Emissor Nacional</b> (login gov.br / certificado da AGE). Depois de emitir, volte e toque em <b>Registrar a nota emitida</b>.</div>' +
      '<h3>Tomador (cliente)</h3>' + campo("cnpj", "CNPJ / CPF do cliente", "", 'inputmode="numeric" maxlength="20"') + campo("nome", "Razão social / nome", "", 'maxlength="200"') +
      campo("end", "Endereço", "", 'maxlength="300"') +
      '<h3>Serviço</h3><div class="duas"><div><label for="nf-mun">Município do cliente (local da prestação)</label><input id="nf-mun" maxlength="80" placeholder="Ex.: Belo Horizonte/MG"></div>' +
      '<div><label for="nf-data">Competência / emissão</label><input type="date" id="nf-data"></div></div>' +
      campo("cod", "Código do serviço (lista da prefeitura)", "", 'maxlength="30" placeholder="Ex.: 31.01.01"') +
      '<p class="mudo peq" id="nf-cod-msg" style="margin:0"></p>' +
      campo("desc", "Descrição do serviço (discriminação)", "", "area") +
      '<h3>Valores</h3><div class="duas"><div><label for="nf-valor">Valor do serviço (R$) — o total do orçamento</label><input id="nf-valor" inputmode="decimal"></div>' +
      '<div><label for="nf-iss">ISS do município (%)</label><input id="nf-iss" inputmode="decimal"></div></div>' +
      '<label class="marca-linha"><input type="checkbox" id="nf-ret" checked> ISS retido pelo cliente (o cliente desconta e recolhe o ISS)</label>' +
      '<div class="cartao" id="nf-res" style="margin-top:8px"></div>' +
      '<div class="acoes"><button class="prim" id="nf-tudo" type="button">📋 Copiar tudo</button><a class="botao" id="nf-portal" target="_blank" rel="noopener" href="' + EMISSOR + '">🌐 Abrir o Emissor Nacional</a></div>' +
      '<div class="acoes"><button id="nf-reg" type="button">✅ Registrar a nota emitida</button></div>' +
      '<p class="mudo peq">Percentuais e código são conferência: confirme com o contador antes de emitir.</p>', { titulo: "🧾 Nota fiscal", larga: true });
    var el = j.el;
    $("#nf-cnpj", el).value = d.documento || ""; $("#nf-nome", el).value = d.cliente || ""; $("#nf-end", el).value = d.endereco || "";
    $("#nf-mun", el).value = mun0; $("#nf-data", el).value = A.isoLocal(new Date()); $("#nf-desc", el).value = d.descricao || "";
    $("#nf-valor", el).value = reais(d.valor); $("#nf-iss", el).value = iss0 ? reais(iss0) : "";
    function achaCod() {
      var c = codDe($("#nf-mun", el).value);
      if (c && !$("#nf-cod", el).value.trim()) $("#nf-cod", el).value = c;
      $("#nf-cod-msg", el).textContent = c ? "Código usado nas suas notas deste município: " + c + " (editável; fica guardado)." : ($("#nf-mun", el).value.trim() ? "Não tenho o código deste município: digite (fica guardado)." : "");
    }
    function valores() {
      var v = A.lerNumero($("#nf-valor", el).value) || 0, p = A.lerNumero($("#nf-iss", el).value) || 0, ret = $("#nf-ret", el).checked;
      var iss = Math.round(v * p) / 100, liq = ret ? Math.round((v - iss) * 100) / 100 : v;
      return { v: v, p: p, ret: ret, iss: iss, liq: liq };
    }
    function resumo() {
      var x = valores(), das = window.AGE_FAT && window.AGE_FAT.dasPct ? window.AGE_FAT.dasPct() : null;
      $("#nf-res", el).innerHTML = '<div class="linha"><span>Valor da nota (bruto)</span><b class="dir">' + A.dinheiro(x.v) + "</b></div>" +
        '<div class="linha"><span>ISS ' + reais(x.p) + "%" + (x.ret ? " (retido pelo cliente)" : " (a AGE paga)") + '</span><span class="dir">' + A.dinheiro(x.iss) + "</span></div>" +
        (x.ret ? '<div class="linha"><span>Líquido que o cliente paga</span><b class="dir">' + A.dinheiro(x.liq) + "</b></div>" : "") +
        (das && x.ret ? '<div class="mudo peq" style="margin-top:4px">DAS estimado do Simples (sem a parte do ISS, que o cliente retém): ' + reais(das.pct) + "% = " + A.dinheiro(Math.round(x.v * das.pct) / 100) + ", estimativa.</div>" : "");
    }
    ["#nf-valor", "#nf-iss"].forEach(function (k) { $(k, el).addEventListener("input", resumo); });
    $("#nf-ret", el).addEventListener("change", resumo);
    $("#nf-mun", el).addEventListener("blur", achaCod);
    $("#nf-cod", el).addEventListener("blur", function () { guardarCod($("#nf-mun", el).value, this.value.trim()); });
    achaCod(); resumo();
    $$("[data-cp]", el).forEach(function (b) { b.onclick = function () { copiar($("#nf-" + b.dataset.cp, el).value, "Copiado"); }; });
    $("#nf-tudo", el).onclick = function () {
      var x = valores();
      copiar(["Tomador: " + $("#nf-nome", el).value + " — CNPJ/CPF " + $("#nf-cnpj", el).value, "Endereço: " + $("#nf-end", el).value, "Município: " + $("#nf-mun", el).value,
        "Código do serviço: " + $("#nf-cod", el).value, "Competência: " + A.data($("#nf-data", el).value + "T12:00:00"), "Descrição: " + $("#nf-desc", el).value,
        "Valor: R$ " + reais(x.v), "ISS: " + reais(x.p) + "% = R$ " + reais(x.iss) + (x.ret ? " (retido)" : "")].join("\n"), "Dados da nota copiados");
    };
    $("#nf-reg", el).onclick = function () {
      var x = valores();
      if (!(x.v > 0)) { A.avisar("Informe o valor da nota.", "erro"); return; }
      if (!window.AGE_FAT || !window.AGE_FAT.lancar) { A.avisar("Abra Notas e resultado para registrar a nota.", "erro"); return; }
      var ret = x.ret && x.iss > 0 ? { iss: x.iss } : {};
      j.fechar();
      window.AGE_FAT.lancar(P, { tomador: $("#nf-nome", el).value.trim(), cnpj: String($("#nf-cnpj", el).value || "").replace(/\D/g, ""), bruto: x.v, valor: x.liq, retencoes: ret, data: $("#nf-data", el).value }, function () { if (P.recarregar) P.recarregar(); });
    };
  }

  window.AGE_NFSE = { abrir: abrir, codDe: codDe };
})();
