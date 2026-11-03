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
    c.innerHTML = '<div class="cab-secao"><h2>🤝 Parceiros</h2><span><button class="prim" id="pa-novo">+ Novo parceiro</button> <button id="pa-env" title="Manda os mesmos documentos para os parceiros marcados">📤 Enviar para os marcados</button></span></div>' +
      '<p class="mudo peq" style="margin-top:-4px">Guarde aqui os contatos e as informações de quem trabalha com você. Em cada parceiro: <b>📲 WhatsApp</b>, <b>✉ E-mail</b> e <b>📤 Enviar documentos</b> (projetos, plantas, orçamentos, fotos).</p>' +
      (P.S.semParceiros ? '<div class="aviso">Para guardar os parceiros, rode no Supabase o <b>supabase.sql</b> atualizado (tabela <b>parceiros</b>).</div>' : "") +
      '<div class="filtros"><input type="search" id="pa-busca" placeholder="🔍 Buscar nome, empresa, cidade ou telefone" value="' + esc(filtro.busca) + '"><select id="pa-tipo" aria-label="Tipo"></select></div><div id="pa-res"></div>';
    $("#pa-busca", c).oninput = function () { filtro.busca = this.value; listar(); };
    $("#pa-tipo", c).onchange = function () { filtro.tipo = this.value; listar(); };
    $("#pa-novo", c).onclick = function () { editar({ ativo: true }); };
    $("#pa-env", c).onclick = function () {
      var ps = lista().filter(function (p) { return marcados[p.id]; });
      if (!ps.length) { A.avisar("Marque os parceiros (caixinha à esquerda) que vão receber.", "erro"); return; }
      enviar(ps);
    };
    listar();
  }
  function tiposUsados() {
    var t = TIPOS.slice();
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

  // ---------------- cadastro ----------------
  function editar(p) {
    var novo = !p.id;
    var j = A.janela('<datalist id="pa-dl">' + tiposUsados().map(function (t) { return '<option value="' + esc(t) + '">'; }).join("") + "</datalist>" +
      '<label for="pa-nome">Nome *</label><input id="pa-nome" maxlength="160" autocomplete="off">' +
      '<div class="duas"><div><label for="pa-emp">Empresa</label><input id="pa-emp" maxlength="160"></div><div><label for="pa-tp">Tipo (o que faz)</label><input id="pa-tp" list="pa-dl" maxlength="60" placeholder="Ex.: Eletricista"></div></div>' +
      '<div class="duas"><div><label for="pa-zap">WhatsApp (com DDD)</label><input id="pa-zap" type="tel" maxlength="40" placeholder="(31) 99999-9999"></div><div><label for="pa-tel">Telefone</label><input id="pa-tel" type="tel" maxlength="40"></div></div>' +
      '<div class="duas"><div><label for="pa-mail">E-mail</label><input id="pa-mail" type="email" maxlength="200"></div><div><label for="pa-cid">Cidade</label><input id="pa-cid" maxlength="100"></div></div>' +
      '<label for="pa-end">Endereço</label><input id="pa-end" maxlength="300">' +
      '<label for="pa-obs">Informações (especialidade, valores combinados, documentos que ele pede...)</label><textarea id="pa-obs" rows="4" maxlength="3000"></textarea>' +
      '<label class="marca-linha" style="font-weight:400"><input type="checkbox" id="pa-ativo"> Parceiro ativo</label>' +
      '<div class="acoes"><button class="prim" id="pa-salvar">💾 Salvar</button>' + (novo ? "" : '<button class="perigo" id="pa-apagar">🗑 Excluir</button>') + '<button id="pa-cancelar">Cancelar</button></div>',
      { titulo: novo ? "🤝 Novo parceiro" : "🤝 " + (p.nome || "Parceiro"), larga: true, fixa: true });
    var el = j.el;
    $("#pa-nome", el).value = p.nome || ""; $("#pa-emp", el).value = p.empresa || ""; $("#pa-tp", el).value = p.tipo || ""; $("#pa-zap", el).value = p.whatsapp || "";
    $("#pa-tel", el).value = p.telefone || ""; $("#pa-mail", el).value = p.email || ""; $("#pa-cid", el).value = p.cidade || ""; $("#pa-end", el).value = p.endereco || "";
    $("#pa-obs", el).value = p.obs || ""; $("#pa-ativo", el).checked = p.ativo !== false;
    $("#pa-cancelar", el).onclick = function () { j.fechar(); };
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
      if (!d.nome) { A.avisar("Escreva o nome do parceiro.", "erro"); return; }
      if (d.email && !emailOk(d.email)) { A.avisar("O e-mail não parece certo. Confira.", "erro"); return; }
      if (d.whatsapp && dig(d.whatsapp).length < 10) { A.avisar("O WhatsApp precisa do DDD (10 ou 11 números).", "erro"); return; }
      if (P.S.semParceiros) { A.avisar("Rode o supabase.sql atualizado no Supabase (tabela parceiros) para guardar.", "erro"); return; }
      var igual = lista().filter(function (o) {
        return o.id !== p.id && ((d.whatsapp && dig(o.whatsapp) === dig(d.whatsapp)) || (d.email && String(o.email || "").toLowerCase() === d.email.toLowerCase()));
      })[0];
      if (igual && !A.confirmar("Já existe o parceiro “" + igual.nome + "” com este WhatsApp ou e-mail. Salvar mesmo assim?")) return;
      var b = this; A.ocupado(b, true, "Salvando...");
      var pr = novo ? P.q(P.sb.from("parceiros").insert(d).select().single()) : P.q(P.sb.from("parceiros").update(d).eq("id", p.id).select().single());
      pr.then(function (n) { P.trocar(P.S.parceiros, n); P.S.parceiros.sort(function (x, y) { return semAcento(x.nome).localeCompare(semAcento(y.nome), "pt-BR"); }); j.fechar(); listar(); A.avisar("🤝 Parceiro salvo", "ok"); })
        .catch(function (e) { A.ocupado(b, false); P.falhou(e); });
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
