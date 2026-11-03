// Painel do dono — 🤝 PARCEIROS: contatos e informações de quem trabalha com a AGE (eletricista, pintor, engenheiro, TI, fornecedor...).
// Cada parceiro tem WhatsApp, telefone, e-mail, cidade e observações. Dali você manda documentos e projetos por WhatsApp ou e-mail:
// escolha os arquivos no aparelho (qualquer tipo: PDF, DWG, Word, Excel, fotos) e a mensagem; no celular o arquivo já vai anexado,
// no computador o app baixa os arquivos e abre a conversa/e-mail para você anexar.
// Usa as funções do admin.js (P).
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null;
  var filtro = { busca: "", tipo: "" }, marcados = {};
  var TIPOS = ["Eletricista", "Pintor", "Engenheiro / Arquiteto", "TI e câmeras", "Fornecedor", "Cliente parceiro", "Outro"];

  function semAcento(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); }
  function dig(t) { return String(t || "").replace(/\D/g, ""); }
  function lista() { return (P && P.S.parceiros) || []; }
  function fone(p) { return p.whatsapp || p.telefone || ""; }
  function emailOk(t) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(t || "").trim()); }
  function primeiro(p) { return String(p.nome || "").trim().split(/\s+/)[0] || ""; }
  function tamanho(n) { return n >= 1048576 ? (n / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
  function baixar(arq) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(arq); a.download = arq.name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }
  function assinatura() { var E = A.CFG.EMPRESA || {}; return (E.nome || "AGE Elétrica e Pintura") + (E.telefone ? " · " + E.telefone : ""); }
  function msgPadrao(nome, n) {
    return "Olá" + (nome ? ", " + nome : "") + "! Segue em anexo " + (n > 1 ? "os documentos" : n === 1 ? "o documento" : "o material") + " que combinamos.\nQualquer dúvida, é só chamar.\n" + assinatura();
  }

  // ---------------- tela ----------------
  function ver(c, ctx) {
    P = ctx;
    c.innerHTML = '<div class="cab-secao"><h2>🤝 Parceiros</h2><span><button class="prim" id="pa-novo">+ Novo parceiro</button> <button id="pa-tipos" title="Acrescentar, renomear ou tirar funções (Eletricista, Pintor...)">✏️ Editar funções</button> <button id="pa-env" title="Manda os mesmos documentos para os parceiros marcados">📤 Enviar para os marcados</button></span></div>' +
      '<p class="mudo peq" style="margin-top:-4px">Guarde aqui os contatos e as informações de quem trabalha com você. Em cada parceiro: <b>📲 WhatsApp</b>, <b>✉ E-mail</b> e <b>📤 Enviar documentos</b> (projetos, plantas, orçamentos, fotos).</p>' +
      (P.S.semParceiros ? '<div class="aviso">Para guardar os parceiros, rode no Supabase o <b>supabase.sql</b> atualizado (tabela <b>parceiros</b>).</div>' : "") +
      '<div class="filtros"><input type="search" id="pa-busca" placeholder="🔍 Buscar nome, empresa, cidade ou telefone" value="' + esc(filtro.busca) + '"><select id="pa-tipo" aria-label="Tipo"></select></div><div id="pa-res"></div>';
    $("#pa-busca", c).oninput = function () { filtro.busca = this.value; listar(); };
    $("#pa-tipo", c).onchange = function () { filtro.tipo = this.value; listar(); };
    $("#pa-novo", c).onclick = function () { editar({ ativo: true }); };
    $("#pa-tipos", c).onclick = function () { editarTipos(listar); };
    $("#pa-env", c).onclick = function () {
      var ps = lista().filter(function (p) { return marcados[p.id]; });
      if (!ps.length) { A.avisar("Marque os parceiros (caixinha à esquerda) que vão receber.", "erro"); return; }
      enviar(ps);
    };
    listar();
  }
  function tiposUsados() {
    var t = P && P.S.tiposParc ? P.S.tiposParc.map(function (x) { return x.nome; }) : TIPOS.slice();
    lista().forEach(function (p) { if (p.tipo && t.indexOf(p.tipo) < 0) t.push(p.tipo); });
    return t;
  }
  function listar() {
    var r = $("#pa-res"); if (!r) return;
    var sel = $("#pa-tipo");
    sel.innerHTML = '<option value="">Todos os tipos</option>' + tiposUsados().map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + "</option>"; }).join("");
    sel.value = filtro.tipo;
    var b = semAcento(filtro.busca);
    var ls = lista().filter(function (p) {
      if (filtro.tipo && p.tipo !== filtro.tipo) return false;
      return !b || b.split(/\s+/).every(function (w) { return (semAcento([p.nome, p.empresa, p.tipo, p.cidade, p.obs, p.email].join(" ")) + " " + dig(p.whatsapp) + " " + dig(p.telefone)).indexOf(w) >= 0; });
    });
    if (!lista().length) { r.innerHTML = '<div class="cartao vazio">Nenhum parceiro ainda. Toque em <b>+ Novo parceiro</b>.</div>'; return; }
    if (!ls.length) { r.innerHTML = '<div class="cartao vazio">Nada com essa busca.</div>'; return; }
    r.innerHTML = ls.map(function (p) {
      var tel = fone(p);
      return '<div class="cartao" data-pa="' + p.id + '"' + (p.ativo === false ? ' style="opacity:.6"' : "") + '><div class="linha"><label class="marca-linha" style="font-weight:400;margin:0"><input type="checkbox" data-pa-marca' + (marcados[p.id] ? " checked" : "") + ' aria-label="Marcar ' + esc(p.nome) + '"></label>' +
        '<h3 style="margin:0;flex:1">' + esc(p.nome) + (p.empresa ? ' <span class="peq mudo">· ' + esc(p.empresa) + "</span>" : "") + "</h3>" +
        (p.tipo ? '<span class="selo">' + esc(p.tipo) + "</span>" : "") + (p.ativo === false ? ' <span class="selo atencao">inativo</span>' : "") + "</div>" +
        '<div class="peq" style="margin-top:4px">' + [tel ? "📱 " + esc(tel) : "", p.email ? "✉ " + esc(p.email) : "", p.cidade ? "📍 " + esc(p.cidade) : ""].filter(Boolean).join(" · ") + "</div>" +
        (p.obs ? '<div class="peq mudo" style="margin-top:2px;white-space:pre-wrap">' + esc(String(p.obs).slice(0, 200)) + (String(p.obs).length > 200 ? "…" : "") + "</div>" : "") +
        (p.ultimo_envio ? '<div class="peq mudo">Último envio: ' + esc(A.data(p.ultimo_envio)) + "</div>" : "") +
        '<div class="acoes" style="margin-top:6px"><button class="peq zap" data-pa-zap' + (dig(tel).length >= 10 ? "" : " disabled") + '>📲 WhatsApp</button><button class="peq" data-pa-mail' + (emailOk(p.email) ? "" : " disabled") + '>✉ E-mail</button>' +
        '<button class="peq prim" data-pa-enviar>📤 Enviar documentos</button><button class="peq" data-pa-editar>✏️ Editar</button></div></div>';
    }).join("");
    $$("[data-pa]", r).forEach(function (cx) {
      var p = P.porId(lista(), cx.dataset.pa);
      $("[data-pa-marca]", cx).onchange = function () { if (this.checked) marcados[p.id] = true; else delete marcados[p.id]; };
      $("[data-pa-zap]", cx).onclick = function () { A.abrirZap(A.linkZap(fone(p), msgPadrao(primeiro(p), 0))); };
      $("[data-pa-mail]", cx).onclick = function () { location.href = "mailto:" + encodeURIComponent(p.email.trim()); };
      $("[data-pa-enviar]", cx).onclick = function () { enviar([p]); };
      $("[data-pa-editar]", cx).onclick = function () { editar(p); };
    });
  }

  // ---------------- funções (Eletricista, Pintor...) ----------------
  // função nova digitada no cadastro entra sozinha na lista (se a tabela existir)
  function guardarTipo(t) {
    t = String(t || "").trim();
    if (!t || !P.S.tiposParc) return;
    if (P.S.tiposParc.some(function (x) { return semAcento(x.nome) === semAcento(t); })) return;
    P.q(P.sb.from("parceiros_tipos").insert({ nome: t, ordem: 100 + P.S.tiposParc.length }).select().single())
      .then(function (n) { P.S.tiposParc.push(n); }).catch(function () { /* o parceiro já foi salvo; a função continua valendo nele */ });
  }
  // ✏️ acrescentar, renomear (muda também nos parceiros) e tirar funções
  function editarTipos(depois) {
    var sem = !P.S.tiposParc;
    var L = (P.S.tiposParc || TIPOS.map(function (n, i) { return { id: null, nome: n, ordem: i + 1 }; })).map(function (x) { return { id: x.id || null, orig: x.nome, nome: x.nome, novo: false }; });
    var tirados = [];
    var j = A.janela((sem ? '<div class="aviso">Para acrescentar, renomear ou tirar funções, rode no Supabase o <b>supabase.sql</b> atualizado (tabela <b>parceiros_tipos</b>).</div>' : "") +
      '<p class="peq mudo" style="margin-top:0">Se você mudar o nome de uma função, os parceiros que têm essa função mudam junto. Se tirar uma, os parceiros continuam com o que está escrito neles.</p>' +
      '<div id="ft-lista"></div><div class="acoes"><button class="peq" id="ft-mais"' + (sem ? " disabled" : "") + '>➕ Acrescentar função</button></div>' +
      '<div class="acoes"><button class="prim" id="ft-salvar"' + (sem ? " disabled" : "") + '>💾 Salvar funções</button><button id="ft-cancelar">Cancelar</button></div>', { titulo: "✏️ Funções dos parceiros" });
    function desenhar() {
      $("#ft-lista", j.el).innerHTML = L.map(function (x, n) {
        return '<div class="linha" data-ft="' + n + '" style="gap:6px;margin-bottom:6px"><input class="ft-nome" maxlength="60" style="flex:1" placeholder="Nome da função"' + (sem ? " disabled" : "") +
          '><button class="peq perigo" data-ft-tirar aria-label="Tirar a função"' + (sem ? " disabled" : "") + ">🗑</button></div>";
      }).join("") || '<p class="peq mudo">Nenhuma função. Toque em ➕ Acrescentar função.</p>';
      $$("[data-ft]", j.el).forEach(function (d) {
        var x = L[Number(d.dataset.ft)];
        $(".ft-nome", d).value = x.nome;
        $(".ft-nome", d).oninput = function () { x.nome = this.value; };
        $("[data-ft-tirar]", d).onclick = function () { L.splice(Number(d.dataset.ft), 1); if (x.id) tirados.push(x); desenhar(); };
      });
    }
    desenhar();
    $("#ft-cancelar", j.el).onclick = function () { j.fechar(); };
    $("#ft-mais", j.el).onclick = function () { L.push({ id: null, orig: "", nome: "", novo: true }); desenhar(); var u = $$(".ft-nome", j.el); u[u.length - 1].focus(); };
    $("#ft-salvar", j.el).onclick = function () {
      var b = this, nomes = L.map(function (x) { return String(x.nome).trim(); });
      if (nomes.some(function (n) { return !n; })) { A.avisar("Escreva o nome de cada função ou tire a linha vazia.", "erro"); return; }
      var sa = nomes.map(semAcento);
      if (sa.some(function (n, i) { return sa.indexOf(n) !== i; })) { A.avisar("Há duas funções com o mesmo nome.", "erro"); return; }
      A.ocupado(b, true, "Salvando...");
      var ops = [];
      tirados.forEach(function (x) { ops.push(P.q(P.sb.from("parceiros_tipos").delete().eq("id", x.id))); });
      L.forEach(function (x, n) {
        var nome = String(x.nome).trim();
        if (x.novo) ops.push(P.q(P.sb.from("parceiros_tipos").insert({ nome: nome, ordem: n + 1 })));
        else if (x.id) {
          ops.push(P.q(P.sb.from("parceiros_tipos").update({ nome: nome, ordem: n + 1 }).eq("id", x.id)));
          if (nome !== x.orig) {
            ops.push(P.q(P.sb.from("parceiros").update({ tipo: nome }).eq("tipo", x.orig)));
            lista().forEach(function (p) { if (p.tipo === x.orig) p.tipo = nome; });
          }
        }
      });
      Promise.all(ops).then(function () { return P.q(P.sb.from("parceiros_tipos").select("*").order("ordem").order("nome")); }).then(function (rs) {
        P.S.tiposParc = rs || []; j.fechar(); A.avisar("✏️ Funções salvas", "ok"); if (depois) depois();
      }).catch(function (e) { A.ocupado(b, false); P.falhou(e); });
    };
  }

  // ---------------- preenchimento automático ----------------
  function fmtFone(t) {
    var n = dig(t).replace(/^55(?=\d{10,11}$)/, "");
    return n.length === 11 ? "(" + n.slice(0, 2) + ") " + n.slice(2, 7) + "-" + n.slice(7) : n.length === 10 ? "(" + n.slice(0, 2) + ") " + n.slice(2, 6) + "-" + n.slice(6) : String(t || "");
  }
  function cepViaCep(cep8) {
    var ctl = window.AbortController ? new AbortController() : null, t = ctl ? setTimeout(function () { ctl.abort(); }, 8000) : null;
    return fetch("https://viacep.com.br/ws/" + cep8 + "/json/", ctl ? { signal: ctl.signal } : {}).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (x) { if (t) clearTimeout(t); return x && !x.erro ? x : null; }).catch(function () { if (t) clearTimeout(t); return null; });
  }
  // CNPJ ou CEP preenchem sozinhos os campos que ainda estão vazios (nunca apagam o que você já escreveu); telefones ficam no formato (31) 99999-9999
  function ligarAuto(el) {
    var aviso = $("#pa-auto", el), ultimo = "", ultimoCep = "";
    function vazio(id) { return !$(id, el).value.trim(); }
    function pôr(id, v, lista) { if (v && vazio(id)) { $(id, el).value = v; lista.push(id); } }
    function consultaCnpj() {
      var c = dig($("#pa-cnpj", el).value);
      if (c.length !== 14 || c === ultimo || !window.AGE_FORN) return;
      if (!window.AGE_FORN.cnpjValido(c)) { aviso.textContent = "⚠ CNPJ com dígito errado. Confira os números."; return; }
      ultimo = c; aviso.textContent = "🔎 Buscando o CNPJ...";
      window.AGE_FORN.consultar(c).then(function (r) {
        if (!r) { aviso.textContent = "Não achei esse CNPJ agora (ou está sem internet). Preencha à mão."; return; }
        var ok = [];
        pôr("#pa-emp", r.razao_social, ok); pôr("#pa-nome", r.nome, ok);
        pôr("#pa-zap", r.whatsapp, ok); pôr("#pa-tel", r.telefone, ok); pôr("#pa-mail", r.email, ok); pôr("#pa-cid", r.cidade, ok);
        pôr("#pa-end", [r.endereco, r.bairro].filter(Boolean).join(" - ") + (r.cep ? " - CEP " + r.cep : ""), ok);
        aviso.textContent = ok.length ? "✔ Preenchi " + ok.length + " campo(s) pelo CNPJ: " + r.razao_social + ". Confira antes de salvar." : "✔ CNPJ conferido: " + r.razao_social + ". Os campos já estavam preenchidos.";
      });
    }
    $("#pa-cnpj", el).oninput = consultaCnpj;
    $("#pa-cnpj", el).onblur = function () { var c = dig(this.value); if (c.length === 14 && window.AGE_FORN) this.value = window.AGE_FORN.fmtCnpj(c); };
    $("#pa-cep", el).oninput = function () {
      var c = dig(this.value); if (c.length > 5) this.value = c.slice(0, 5) + "-" + c.slice(5, 8);
      if (c.length !== 8 || c === ultimoCep) return;
      ultimoCep = c; aviso.textContent = "🔎 Buscando o CEP...";
      cepViaCep(c).then(function (x) {
        if (!x) { aviso.textContent = "Não achei esse CEP. Preencha o endereço à mão."; return; }
        var ok = [];
        pôr("#pa-end", [x.logradouro, x.bairro].filter(Boolean).join(" - ") + (x.logradouro ? "" : ""), ok); pôr("#pa-cid", x.localidade, ok);
        aviso.textContent = "✔ Endereço pelo CEP: " + [x.logradouro, x.bairro, x.localidade + "/" + x.uf].filter(Boolean).join(", ") + ". Falta só o número.";
      });
    };
    ["#pa-zap", "#pa-tel"].forEach(function (id) {
      $(id, el).onblur = function () { var n = dig(this.value).replace(/^55(?=\d{10,11}$)/, ""); if (n.length === 10 || n.length === 11) this.value = fmtFone(n); };
    });
  }

  // ---------------- cadastro ----------------
  function editar(p) {
    var novo = !p.id;
    var j = A.janela('<datalist id="pa-dl">' + tiposUsados().map(function (t) { return '<option value="' + esc(t) + '">'; }).join("") + "</datalist>" +
      '<label for="pa-cnpj">CNPJ (opcional: preenche o resto sozinho)</label><input id="pa-cnpj" inputmode="numeric" maxlength="20" placeholder="00.000.000/0000-00" autocomplete="off"><div id="pa-auto" class="peq mudo" aria-live="polite"></div>' +
      '<label for="pa-nome">Nome *</label><input id="pa-nome" maxlength="160" autocomplete="off">' +
      '<div class="duas"><div><label for="pa-emp">Empresa</label><input id="pa-emp" maxlength="160"></div><div><label for="pa-tp">Tipo (o que faz)</label><input id="pa-tp" list="pa-dl" maxlength="60" placeholder="Ex.: Eletricista"><button type="button" class="peq" id="pa-tp-edit" style="margin-top:4px">✏️ Editar lista de funções</button></div></div>' +
      '<div class="duas"><div><label for="pa-zap">WhatsApp (com DDD)</label><input id="pa-zap" type="tel" maxlength="40" placeholder="(31) 99999-9999"></div><div><label for="pa-tel">Telefone</label><input id="pa-tel" type="tel" maxlength="40"></div></div>' +
      '<div class="duas"><div><label for="pa-mail">E-mail</label><input id="pa-mail" type="email" maxlength="200"></div><div><label for="pa-cid">Cidade</label><input id="pa-cid" maxlength="100"></div></div>' +
      '<div class="duas"><div><label for="pa-cep">CEP (preenche o endereço)</label><input id="pa-cep" inputmode="numeric" maxlength="9" placeholder="00000-000" autocomplete="off"></div><div></div></div>' +
      '<label for="pa-end">Endereço</label><input id="pa-end" maxlength="300">' +
      '<label for="pa-obs">Informações (especialidade, valores combinados, documentos que ele pede...)</label><textarea id="pa-obs" rows="4" maxlength="3000"></textarea>' +
      '<label class="marca-linha" style="font-weight:400"><input type="checkbox" id="pa-ativo"> Parceiro ativo</label>' +
      '<div class="acoes"><button class="prim" id="pa-salvar">💾 Salvar</button>' + (novo ? "" : '<button class="perigo" id="pa-apagar">🗑 Excluir</button>') + '<button id="pa-cancelar">Cancelar</button></div>',
      { titulo: novo ? "🤝 Novo parceiro" : "🤝 " + (p.nome || "Parceiro"), larga: true, fixa: true });
    var el = j.el;
    $("#pa-nome", el).value = p.nome || ""; $("#pa-emp", el).value = p.empresa || ""; $("#pa-tp", el).value = p.tipo || ""; $("#pa-zap", el).value = p.whatsapp || "";
    $("#pa-tel", el).value = p.telefone || ""; $("#pa-mail", el).value = p.email || ""; $("#pa-cid", el).value = p.cidade || ""; $("#pa-end", el).value = p.endereco || "";
    $("#pa-obs", el).value = p.obs || ""; $("#pa-ativo", el).checked = p.ativo !== false;
    $("#pa-cnpj", el).value = p.cnpj || "";
    ligarAuto(el);
    $("#pa-cancelar", el).onclick = function () { j.fechar(); };
    $("#pa-tp-edit", el).onclick = function () {
      editarTipos(function () { $("#pa-dl", el).innerHTML = tiposUsados().map(function (t) { return '<option value="' + esc(t) + '">'; }).join(""); });
    };
    if ($("#pa-apagar", el)) $("#pa-apagar", el).onclick = function () {
      if (!A.confirmar("Excluir o parceiro “" + p.nome + "”? Os documentos que você já mandou a ele não são afetados.")) return;
      var b = this; A.ocupado(b, true, "Excluindo...");
      P.q(P.sb.from("parceiros").delete().eq("id", p.id)).then(function () { P.tirar(P.S.parceiros, p.id); delete marcados[p.id]; j.fechar(); listar(); A.avisar("🗑 Parceiro excluído", "ok"); })
        .catch(function (e) { A.ocupado(b, false); P.falhou(e); });
    };
    $("#pa-salvar", el).onclick = function () {
      var d = { nome: $("#pa-nome", el).value.trim(), empresa: $("#pa-emp", el).value.trim() || null, tipo: $("#pa-tp", el).value.trim() || null, whatsapp: $("#pa-zap", el).value.trim() || null,
        telefone: $("#pa-tel", el).value.trim() || null, email: $("#pa-mail", el).value.trim() || null, cidade: $("#pa-cid", el).value.trim() || null, endereco: $("#pa-end", el).value.trim() || null,
        obs: $("#pa-obs", el).value.trim() || null, ativo: $("#pa-ativo", el).checked };
      var cnpjDig = dig($("#pa-cnpj", el).value);
      if (cnpjDig) { if (!(window.AGE_FORN && window.AGE_FORN.cnpjValido(cnpjDig))) { A.avisar("O CNPJ está com dígito errado. Confira ou apague.", "erro"); return; } d.cnpj = window.AGE_FORN.fmtCnpj(cnpjDig); }
      else if (!novo && p.cnpj) d.cnpj = null;
      if (!d.nome) { A.avisar("Escreva o nome do parceiro.", "erro"); return; }
      if (d.email && !emailOk(d.email)) { A.avisar("O e-mail não parece certo. Confira.", "erro"); return; }
      if (d.whatsapp && dig(d.whatsapp).length < 10) { A.avisar("O WhatsApp precisa do DDD (10 ou 11 números).", "erro"); return; }
      if (P.S.semParceiros) { A.avisar("Rode o supabase.sql atualizado no Supabase (tabela parceiros) para guardar.", "erro"); return; }
      var igual = lista().filter(function (o) {
        return o.id !== p.id && ((d.cnpj && dig(o.cnpj) === dig(d.cnpj)) || (d.whatsapp && dig(o.whatsapp) === dig(d.whatsapp)) || (d.email && String(o.email || "").toLowerCase() === d.email.toLowerCase()));
      })[0];
      if (igual && !A.confirmar("Já existe o parceiro “" + igual.nome + "” com este CNPJ, WhatsApp ou e-mail. Salvar mesmo assim?")) return;
      var b = this; A.ocupado(b, true, "Salvando...");
      var pr = novo ? P.q(P.sb.from("parceiros").insert(d).select().single()) : P.q(P.sb.from("parceiros").update(d).eq("id", p.id).select().single());
      pr.then(function (n) { guardarTipo(n.tipo); P.trocar(P.S.parceiros, n); P.S.parceiros.sort(function (x, y) { return semAcento(x.nome).localeCompare(semAcento(y.nome), "pt-BR"); }); j.fechar(); listar(); A.avisar("🤝 Parceiro salvo", "ok"); })
        .catch(function (e) {
          A.ocupado(b, false);
          if (/cnpj/i.test(String(e && (e.message || e)))) { A.avisar("Rode o supabase.sql atualizado no Supabase (coluna cnpj do parceiro) para guardar o CNPJ.", "erro"); return; }
          P.falhou(e);
        });
    };
    setTimeout(function () { $("#pa-nome", el).focus(); }, 50);
  }

  // ---------------- enviar documentos e projetos ----------------
  function enviar(ps) {
    var arquivos = [];
    var um = ps.length === 1 ? ps[0] : null;
    var j = A.janela('<p style="margin-top:0">' + (um ? "Para <b>" + esc(um.nome) + "</b>" : "Para <b>" + ps.length + " parceiros</b>: " + esc(ps.map(function (p) { return p.nome; }).join(", "))) + "</p>" +
      '<label>Documentos e projetos <span class="peq mudo">(qualquer tipo: PDF, DWG, Word, Excel, fotos)</span></label>' +
      '<input type="file" id="en-arq" multiple class="oculto"><div class="acoes"><button id="en-add">📎 Escolher arquivos</button></div><div id="en-lista" class="peq"></div>' +
      '<label for="en-msg">Mensagem</label><textarea id="en-msg" rows="5" maxlength="2000"></textarea>' +
      '<div id="en-acoes"></div>' +
      '<p class="mudo peq" id="en-dica"></p>', { titulo: "📤 Enviar documentos", larga: true, fixa: true });
    var el = j.el;
    var cel = !!(navigator.share && navigator.canShare);
    function msg() { return $("#en-msg", el).value; }
    function pintar() {
      $("#en-lista", el).innerHTML = arquivos.length ? arquivos.map(function (f, n) { return '<div class="linha"><span>📄 ' + esc(f.name) + ' <span class="mudo">(' + tamanho(f.size) + ')</span></span><button class="peq dir" data-rm="' + n + '" aria-label="Tirar">✕</button></div>'; }).join("") : '<span class="mudo">Nenhum arquivo escolhido: a mensagem vai sem anexo.</span>';
      $$("[data-rm]", el).forEach(function (b) { b.onclick = function () { arquivos.splice(Number(b.dataset.rm), 1); pintar(); }; });
      var total = arquivos.reduce(function (t, f) { return t + f.size; }, 0);
      $("#en-dica", el).textContent = (total > 16 * 1048576 ? "⚠ Os arquivos somam " + tamanho(total) + ": o WhatsApp aceita até 100 MB por arquivo, mas o e-mail costuma recusar mais de 20-25 MB. " : "") +
        (cel ? "No celular, o app abre a lista de compartilhar já com os arquivos: escolha o WhatsApp ou o Gmail e o contato." : "No computador, o app baixa os arquivos e abre a conversa ou o e-mail: é só anexar (clipe 📎) o que foi baixado, na pasta Downloads.");
    }
    function acoes() {
      if (um) {
        $("#en-acoes", el).innerHTML = '<div class="acoes"><button class="zap prim" id="en-zap"' + (dig(fone(um)).length >= 10 ? "" : " disabled") + '>📲 WhatsApp</button><button id="en-mail"' + (emailOk(um.email) ? "" : " disabled") + '>✉ E-mail</button></div>' +
          ((dig(fone(um)).length < 10 || !emailOk(um.email)) ? '<p class="mudo peq">Falta ' + (dig(fone(um)).length < 10 ? "o WhatsApp" : "") + (dig(fone(um)).length < 10 && !emailOk(um.email) ? " e " : "") + (!emailOk(um.email) ? "o e-mail" : "") + " no cadastro deste parceiro.</p>" : "");
        $("#en-zap", el).onclick = function () { mandar("zap", um); };
        $("#en-mail", el).onclick = function () { mandar("mail", um); };
      } else {
        var com = ps.filter(function (p) { return emailOk(p.email); });
        $("#en-acoes", el).innerHTML = '<div class="acoes"><button id="en-mail-todos"' + (com.length ? "" : " disabled") + '>✉ E-mail para todos (' + com.length + ', cópia oculta)</button></div>' +
          ps.map(function (p, n) { return '<div class="linha" style="margin-top:4px"><span style="flex:1">' + esc(p.nome) + '</span><button class="peq zap" data-zp="' + n + '"' + (dig(fone(p)).length >= 10 ? "" : " disabled") + '>📲 WhatsApp</button></div>'; }).join("");
        $$("[data-zp]", el).forEach(function (b) { b.onclick = function () { mandar("zap", ps[Number(b.dataset.zp)]); }; });
        $("#en-mail-todos", el).onclick = function () { mandar("mail", com); };
      }
    }
    $("#en-msg", el).value = msgPadrao(um ? primeiro(um) : "", 0);
    $("#en-add", el).onclick = function () { $("#en-arq", el).value = ""; $("#en-arq", el).click(); };
    $("#en-arq", el).onchange = function () {
      Array.prototype.slice.call(this.files || []).forEach(function (f) { if (!arquivos.some(function (x) { return x.name === f.name && x.size === f.size; })) arquivos.push(f); });
      var atual = msg(), padrao0 = msgPadrao(um ? primeiro(um) : "", 0);
      if (atual === padrao0 || /^Olá.*Segue em anexo/.test(atual)) $("#en-msg", el).value = msgPadrao(um ? primeiro(um) : "", arquivos.length);
      pintar();
    };
    function registrar(alvo) {
      (Array.isArray(alvo) ? alvo : [alvo]).forEach(function (p) {
        if (P.S.semParceiros) return;
        P.q(P.sb.from("parceiros").update({ ultimo_envio: new Date().toISOString() }).eq("id", p.id).select().single()).then(function (n) { P.trocar(P.S.parceiros, n); listar(); }).catch(function () { /* o envio já foi feito */ });
      });
    }
    function mandar(canal, alvo) {
      var texto = msg().trim();
      if (!texto && !arquivos.length) { A.avisar("Escreva a mensagem ou escolha um arquivo.", "erro"); return; }
      var lista1 = Array.isArray(alvo) ? alvo : [alvo], assunto = "Documentos — " + ((A.CFG.EMPRESA || {}).nome || "AGE Elétrica e Pintura");
      var pode = false;
      try { pode = !!(arquivos.length && cel && navigator.canShare({ files: arquivos })); } catch (e) { pode = false; }
      // celular: a lista de compartilhar já leva os arquivos anexados
      if (pode) {
        navigator.share({ files: arquivos, text: texto, title: assunto }).then(function () { registrar(alvo); }, function (e) { if (!e || e.name !== "AbortError") A.avisar("Não consegui abrir o compartilhar. Tente de novo ou use o computador.", "erro"); });
        return;
      }
      // computador (ou arquivo que o celular não compartilha): baixa os arquivos e abre a conversa / e-mail
      arquivos.forEach(function (f, n) { setTimeout(function () { baixar(f); }, n * 350); });
      if (canal === "zap") A.abrirZap(A.linkZap(fone(lista1[0]), texto));
      else location.href = "mailto:" + (lista1.length === 1 ? encodeURIComponent(lista1[0].email.trim()) : "") + "?" + (lista1.length > 1 ? "bcc=" + lista1.map(function (p) { return encodeURIComponent(p.email.trim()); }).join(",") + "&" : "") +
        "subject=" + encodeURIComponent(assunto) + "&body=" + encodeURIComponent(texto);
      if (arquivos.length) A.avisar("📥 " + arquivos.length + " arquivo(s) baixado(s). Anexe-os (clipe 📎) na conversa ou no e-mail que abriu.", "ok");
      registrar(alvo);
    }
    pintar(); acoes();
  }

  window.AGE_PARC = { ver: ver };
})();
