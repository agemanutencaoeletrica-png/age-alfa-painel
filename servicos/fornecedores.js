// Painel do dono — 🏪 FORNECEDORES (lojas onde compra): CNPJ, endereço, telefone, WhatsApp e e-mail.
// Os dados vêm da nota (CNPJ da chave de acesso ou do texto), do cadastro público do CNPJ (BrasilAPI, dados da Receita)
// e do que você corrige à mão. Ficam guardados pelo CNPJ: na próxima nota da mesma loja o nome já vem certo.
// Usa as funções do admin.js (P).
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;

  function dig(x) { return String(x || "").replace(/\D/g, ""); }
  function semAcento(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function chaveNome(n) { return semAcento(n).replace(/[^a-z0-9]+/g, " ").replace(/\b(ltda|me|epp|eireli|sa|s a)\b/g, " ").replace(/\s+/g, " ").trim(); }
  function fmtCnpj(c) { c = dig(c); return c.length === 14 ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : c; }
  function fmtFone(t) {
    var n = dig(t).replace(/^55(?=\d{10,11}$)/, "");
    return n.length === 11 ? "(" + n.slice(0, 2) + ") " + n.slice(2, 7) + "-" + n.slice(7) : n.length === 10 ? "(" + n.slice(0, 2) + ") " + n.slice(2, 6) + "-" + n.slice(6) : String(t || "");
  }
  function ehCelular(t) { var n = dig(t).replace(/^55(?=\d{11}$)/, ""); return n.length === 11 && n[2] === "9"; }
  // CNPJ com os dígitos verificadores certos (a foto troca números: só vale se conferir)
  function cnpjValido(c) {
    c = dig(c);
    if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
    var dv = function (n) { var s = 0, p = n - 7; for (var i = 0; i < n; i++) { s += Number(c[i]) * p--; if (p < 2) p = 9; } var r = s % 11; return r < 2 ? 0 : 11 - r; };
    return dv(12) === Number(c[12]) && dv(13) === Number(c[13]);
  }
  function cnpjProprio() { return dig(((A.CFG.EMPRESA || {}).documento || "")); }
  function enderecoCompleto(f) {
    return [f.endereco, f.bairro, [f.cidade, f.uf].filter(Boolean).join(" - "), f.cep ? "CEP " + f.cep : ""].filter(Boolean).join(", ");
  }

  // fornecedor já guardado: pelo CNPJ ou pelo nome
  function achar(S, cnpj, nome) {
    var ls = S.forn || [], c = dig(cnpj), k = chaveNome(nome);
    return (c && ls.filter(function (f) { return dig(f.cnpj) === c; })[0]) || (k && ls.filter(function (f) { return chaveNome(f.nome) === k || chaveNome(f.razao_social) === k; })[0]) || null;
  }

  // cadastro público do CNPJ (BrasilAPI, gratuito, dados da Receita): razão social, endereço, telefone, e-mail
  function consultar(cnpj) {
    var c = dig(cnpj);
    if (!cnpjValido(c)) return Promise.resolve(null);
    var ctl = window.AbortController ? new AbortController() : null, t = ctl ? setTimeout(function () { ctl.abort(); }, 8000) : null;
    return fetch("https://brasilapi.com.br/api/cnpj/v1/" + c, ctl ? { signal: ctl.signal } : {}).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (t) clearTimeout(t);
        if (!j || !j.razao_social) return null;
        var rua = [j.descricao_tipo_de_logradouro && !new RegExp("^" + j.descricao_tipo_de_logradouro, "i").test(j.logradouro || "") ? j.descricao_tipo_de_logradouro : "", j.logradouro].filter(Boolean).join(" ");
        var tel = [j.ddd_telefone_1, j.ddd_telefone_2].map(dig).filter(function (x) { return x.length >= 10; });
        return {
          cnpj: c, nome: String(j.nome_fantasia || j.razao_social).trim(), razao_social: String(j.razao_social).trim(),
          endereco: rua ? rua + (j.numero ? ", " + j.numero : "") + (j.complemento ? " - " + j.complemento : "") : "", bairro: j.bairro || "", cidade: j.municipio || "", uf: j.uf || "",
          cep: dig(j.cep).replace(/^(\d{5})(\d{3})$/, "$1-$2"), telefone: tel[0] ? fmtFone(tel[0]) : "", whatsapp: tel.filter(ehCelular).map(fmtFone)[0] || "",
          email: String(j.email || "").toLowerCase()
        };
      }).catch(function () { if (t) clearTimeout(t); return null; });
  }

  // do texto da nota: o CNPJ da loja (o primeiro válido que não é o da AGE, de preferência antes do "Destinatário"),
  // telefone e e-mail que aparecem na parte da loja
  function doTexto(texto) {
    var t = String(texto || ""), proprio = cnpjProprio(), iD = t.search(/destinat/i), r = {};
    var parteLoja = iD > 0 ? t.slice(0, iD) : t.slice(0, 1500);
    var re = /\d{2}[.,\s]?\d{3}[.,\s]?\d{3}\s?\/\s?\d{4}\s?-?\s?\d{2}/g, m, achados = [];
    while ((m = re.exec(t))) { var c = dig(m[0]); if (cnpjValido(c) && c !== proprio) achados.push({ c: c, antes: m.index < iD || iD < 0 }); }
    var ac = achados.filter(function (x) { return x.antes; })[0] || achados[0];
    if (ac) r.cnpj = fmtCnpj(ac.c);
    var mt = parteLoja.match(/(?:fone|tel\w*|whats\w*|zap)[^\d\n]{0,8}(\(?\d{2}\)?\s?\d{4,5}[\s.-]?\d{4})/i);
    if (mt) { r.telefone = fmtFone(mt[1]); if (ehCelular(mt[1])) r.whatsapp = r.telefone; }
    var me = parteLoja.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/);
    if (me && me[0].toLowerCase() !== String((A.CFG.EMPRESA || {}).email || "").toLowerCase()) r.email = me[0].toLowerCase();
    return r;
  }

  // ---------------- campos "Dados da loja" no formulário da nota ----------------
  var CAMPOS = [["cnpj", "CNPJ", "00.000.000/0000-00"], ["telefone", "Telefone", "(31) 3333-4444"], ["whatsapp", "WhatsApp", "(31) 98888-7777"],
    ["email", "E-mail", "vendas@loja.com.br"], ["endereco", "Endereço", "Rua, número"], ["bairro", "Bairro", ""], ["cidade", "Cidade", ""], ["uf", "UF", "MG"], ["cep", "CEP", ""]];
  function htmlCampos(f, aberto) {
    f = f || {};
    var tem = CAMPOS.some(function (c) { return f[c[0]]; });
    return '<details id="fo-dados" class="cartao" style="margin:8px 0;padding:8px 10px"' + (aberto || tem ? " open" : "") + '><summary><b>🏪 Dados da loja</b> <span class="peq mudo">' +
      esc([f.cnpj ? "CNPJ " + fmtCnpj(f.cnpj) : "", f.telefone, f.email].filter(Boolean).join(" · ") || "CNPJ, telefone, WhatsApp, e-mail e endereço") + "</span></summary>" +
      (f.razao_social ? '<div class="peq mudo" style="margin:4px 0">Razão social: <b>' + esc(f.razao_social) + "</b></div>" : "") + '<input type="hidden" data-fo="razao_social" value="' + esc(f.razao_social || "") + '">' +
      '<div class="duas">' + CAMPOS.map(function (c) {
        return '<div><label>' + c[1] + (c[0] === "cnpj" ? ' <button type="button" class="peq" id="fo-buscar" title="Buscar os dados da loja no cadastro do CNPJ">🔎 Buscar</button>' : "") + '</label><input data-fo="' + c[0] + '" maxlength="160" placeholder="' + esc(c[2]) + '" value="' + esc(c[0] === "cnpj" ? fmtCnpj(f.cnpj) : f[c[0]] || "") + '"' + (c[0] === "email" ? ' type="email"' : c[0] === "endereco" ? "" : ' inputmode="' + (/cnpj|telefone|whatsapp|cep/.test(c[0]) ? "numeric" : "text") + '"') + "></div>";
      }).join("") + "</div><div class=\"peq mudo\" id=\"fo-st\"></div></details>";
  }
  function lerCampos(el) {
    var f = {};
    $$("[data-fo]", el).forEach(function (i) { f[i.dataset.fo] = i.value.trim(); });
    f.cnpj = dig(f.cnpj);
    return f;
  }
  function preencher(el, f, soVazios) {
    $$("[data-fo]", el).forEach(function (i) { var v = f[i.dataset.fo]; if (v && (!soVazios || !i.value.trim())) i.value = i.dataset.fo === "cnpj" ? fmtCnpj(v) : v; });
  }
  // botão 🔎 Buscar: completa pelo CNPJ (e o nome da loja, se estiver vazio)
  function ligarCampos(el, campoNome) {
    var b = $("#fo-buscar", el);
    if (!b) return;
    b.onclick = function () {
      var c = dig($('[data-fo="cnpj"]', el).value), st = $("#fo-st", el);
      if (!cnpjValido(c)) { st.textContent = "CNPJ incompleto ou com número errado: confira na nota."; return; }
      st.textContent = "🔎 Buscando no cadastro do CNPJ...";
      consultar(c).then(function (f) {
        if (!f) { st.textContent = "Não achei esse CNPJ (ou sem internet). Preencha à mão."; return; }
        preencher(el, f, false);
        if (campoNome && !campoNome.value.trim()) campoNome.value = f.nome;
        st.innerHTML = "✔ Dados do cadastro do CNPJ: <b>" + esc(f.razao_social) + "</b>";
      });
    };
  }

  // grava/atualiza o fornecedor (pelo CNPJ ou pelo nome); só preenche o que veio (não apaga o que você já tinha)
  function salvar(P, f, nome) {
    if (P.S.semForn || !nome) return Promise.resolve(null);
    f = Object.assign({}, f || {}); f.cnpj = dig(f.cnpj) || null;
    var ant = achar(P.S, f.cnpj, nome), dados = {};
    ["cnpj", "razao_social", "endereco", "bairro", "cidade", "uf", "cep", "telefone", "whatsapp", "email"].forEach(function (k) { if (f[k] && (!ant || f[k] !== ant[k])) dados[k] = f[k]; });
    if (!ant && !Object.keys(dados).length) return Promise.resolve(null);   // nada para guardar além do nome
    if (ant && !Object.keys(dados).length) return Promise.resolve(ant);
    dados.atualizado_em = new Date().toISOString();
    var pr = ant ? P.sb.from("fornecedores").update(dados).eq("id", ant.id).select().single() : P.sb.from("fornecedores").insert(Object.assign({ nome: nome }, dados)).select().single();
    return P.q(pr).then(function (n) { P.trocar(P.S.forn, n); return n; }).catch(function () { return null; });   // sem a tabela, a compra é salva do mesmo jeito
  }

  // ---------------- aba 🏪 Fornecedores (dentro de Compras) ----------------
  function ver(r, P, busca, compras, mudou) {
    if (P.S.semForn) {
      r.innerHTML = '<div class="aviso">Para guardar os dados das lojas, rode de novo o <b>supabase.sql</b> no Supabase (ou só o bloco “Fornecedores”) e depois <code>notify pgrst, \'reload schema\';</code>' +
        (P.S.erroForn ? '<div class="peq mudo" style="margin-top:6px">Erro do banco: ' + esc(P.S.erroForn) + "</div>" : "") + "</div>";
      return;
    }
    // todas as lojas: as cadastradas e as que só aparecem nas notas
    var mapa = {};
    P.S.forn.forEach(function (f) { mapa["id:" + f.id] = { f: f, n: 0, total: 0, aPagar: 0, ult: "" }; });
    compras.forEach(function (c) {
      if (!c.fornecedor && !c.cnpj) return;
      var f = achar(P.S, c.cnpj, c.fornecedor), k = f ? "id:" + f.id : "nome:" + chaveNome(c.fornecedor || c.cnpj);
      var g = mapa[k] = mapa[k] || { f: { nome: c.fornecedor || fmtCnpj(c.cnpj), cnpj: dig(c.cnpj) }, n: 0, total: 0, aPagar: 0, ult: "", novo: true };
      g.n++; g.total += Number(c.valor) || 0; if (c.pago === false) g.aPagar += Number(c.valor) || 0; if (c.comprado_em > g.ult) g.ult = c.comprado_em;
      if (g.novo && !g.f.cnpj && c.cnpj) g.f.cnpj = dig(c.cnpj);
    });
    var b = semAcento(busca), ls = Object.keys(mapa).map(function (k) { return mapa[k]; }).filter(function (g) {
      return !b || semAcento([g.f.nome, g.f.razao_social, g.f.cnpj, g.f.cidade, g.f.bairro, g.f.telefone].join(" ")).indexOf(b) >= 0;
    }).sort(function (a, c) { return c.total - a.total || String(a.f.nome).localeCompare(String(c.f.nome)); });
    r.innerHTML = '<div class="acoes" style="margin-top:0"><button class="prim" id="fo-novo">➕ Novo fornecedor</button></div>' +
      (ls.length ? ls.map(function (g, i) {
        var f = g.f, end = enderecoCompleto(f);
        return '<div class="cartao"><div class="linha"><h3 style="margin:0">' + esc(f.nome) + "</h3>" + (g.aPagar ? '<span class="selo critico">a pagar ' + A.dinheiro(g.aPagar) + "</span>" : "") +
          '<span class="dir"><button class="peq" data-fo-ed="' + i + '">' + (g.novo ? "➕ Completar dados" : "Editar") + "</button></span></div>" +
          '<div class="peq mudo">' + esc([f.razao_social && f.razao_social !== f.nome ? f.razao_social : "", f.cnpj ? "CNPJ " + fmtCnpj(f.cnpj) : ""].filter(Boolean).join(" · ")) + "</div>" +
          (end ? '<div class="peq">📍 <a href="' + A.linkEndereco(end) + '" target="_blank" rel="noopener">' + esc(end) + "</a></div>" : "") +
          '<div class="peq" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:4px">' +
          (f.telefone ? '<a href="tel:' + dig(f.telefone) + '">📞 ' + esc(f.telefone) + "</a>" : "") +
          (f.whatsapp ? '<a href="' + A.linkZap(f.whatsapp, "Olá! Aqui é da " + ((A.CFG.EMPRESA || {}).nome || "AGE") + ".") + '" target="_blank" rel="noopener">💬 WhatsApp ' + esc(f.whatsapp) + "</a>" : "") +
          (f.email ? '<a href="mailto:' + esc(f.email) + '">✉️ ' + esc(f.email) + "</a>" : "") +
          (!f.telefone && !f.whatsapp && !f.email && !end ? '<span class="mudo">sem contato guardado</span>' : "") + "</div>" +
          (g.n ? '<div class="peq mudo" style="margin-top:4px">' + g.n + (g.n > 1 ? " notas" : " nota") + " · " + A.dinheiro(g.total) + (g.ult ? " · última " + A.dataSimples(g.ult) : "") + "</div>" : "") +
          (f.obs ? '<div class="peq mudo">' + esc(f.obs) + "</div>" : "") + "</div>";
      }).join("") : '<div class="cartao vazio">Nenhum fornecedor ainda. Lance uma nota ou toque em ➕ Novo fornecedor.</div>');
    $("#fo-novo", r).onclick = function () { editar(P, null, mudou); };
    $$("[data-fo-ed]", r).forEach(function (bt) { bt.onclick = function () { var g = ls[Number(bt.dataset.foEd)]; editar(P, g.novo ? Object.assign({ novo: true }, g.f) : g.f, mudou); }; });
  }
  function editar(P, f0, mudou) {
    var novo = !f0 || f0.novo, f = f0 || {};
    var j = A.janela('<label for="fo-nome">Nome da loja (como aparece no app)</label><input id="fo-nome" maxlength="120" value="' + esc(f.nome || "") + '">' +
      htmlCampos(f, true) + '<label for="fo-obs">Observação</label><input id="fo-obs" maxlength="300" placeholder="Ex.: vendedor Thiago, entrega grátis acima de R$ 300" value="' + esc(f.obs || "") + '">' +
      '<div id="fo-erro"></div><div class="acoes"><button class="prim" id="fo-salvar">Salvar</button>' + (!novo ? '<button class="perigo" id="fo-apagar">Apagar</button>' : "") + "</div>",
      { titulo: novo ? "🏪 Fornecedor" : "🏪 " + (f.nome || "Fornecedor"), larga: true });
    var el = j.el;
    ligarCampos(el, $("#fo-nome", el));
    // CNPJ conhecido e nada mais guardado: busca sozinho no cadastro
    if (f.cnpj && novo && !f.telefone && !f.endereco) $("#fo-buscar", el).click();
    $("#fo-salvar", el).onclick = function () {
      var b = this, d = lerCampos(el), nome = $("#fo-nome", el).value.trim();
      if (!nome) { $("#fo-erro", el).innerHTML = '<div class="aviso erro">Informe o nome da loja.</div>'; return; }
      if (d.cnpj && !cnpjValido(d.cnpj)) { $("#fo-erro", el).innerHTML = '<div class="aviso erro">CNPJ com número errado: confira.</div>'; return; }
      var dados = { nome: nome, cnpj: d.cnpj || null, razao_social: d.razao_social || null, endereco: d.endereco || null, bairro: d.bairro || null, cidade: d.cidade || null, uf: d.uf || null,
        cep: d.cep || null, telefone: d.telefone || null, whatsapp: d.whatsapp || null, email: d.email || null, obs: $("#fo-obs", el).value.trim() || null, atualizado_em: new Date().toISOString() };
      var outro = d.cnpj && (P.S.forn || []).filter(function (x) { return dig(x.cnpj) === d.cnpj && x.id !== f.id; })[0];
      if (outro) { $("#fo-erro", el).innerHTML = '<div class="aviso erro">Esse CNPJ já está em “' + esc(outro.nome) + "”.</div>"; return; }
      A.ocupado(b, true, "Salvando...");
      var nomeAntigo = f.nome;
      P.q(novo ? P.sb.from("fornecedores").insert(dados).select().single() : P.sb.from("fornecedores").update(dados).eq("id", f.id).select().single()).then(function (n) {
        P.trocar(P.S.forn, n);
        // nome trocado: as notas dessa loja passam a usar o nome novo
        var notas = P.S.compras.filter(function (c) { return nomeAntigo && c.fornecedor === nomeAntigo && nomeAntigo !== nome; });
        return Promise.all(notas.map(function (c) {
          return P.q(P.sb.from("compras").update({ fornecedor: nome }).eq("id", c.id).select().single()).then(function (x) { P.trocar(P.S.compras, x); }).catch(function () {});
        }));
      }).then(function () { j.fechar(); A.avisar("🏪 Fornecedor salvo", "ok"); if (mudou) mudou(); })
        .catch(function (e) { A.ocupado(b, false); $("#fo-erro", el).innerHTML = '<div class="aviso erro">' + esc(A.msgErro(e)) + "</div>"; });
    };
    if ($("#fo-apagar", el)) $("#fo-apagar", el).onclick = function () {
      if (!window.confirm("Apagar os dados de " + f.nome + "? As notas continuam.")) return;
      P.q(P.sb.from("fornecedores").delete().eq("id", f.id)).then(function () { P.tirar(P.S.forn, f.id); j.fechar(); if (mudou) mudou(); }).catch(P.falhou);
    };
  }

  window.AGE_FORN = { achar: achar, consultar: consultar, doTexto: doTexto, htmlCampos: htmlCampos, lerCampos: lerCampos, preencher: preencher, ligarCampos: ligarCampos,
    salvar: salvar, ver: ver, cnpjValido: cnpjValido, fmtCnpj: fmtCnpj };
})();
