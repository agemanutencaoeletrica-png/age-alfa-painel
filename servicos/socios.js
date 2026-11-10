// Painel do dono — 👔 SÓCIOS: serviços fechados por cada sócio, a parte dele, e os repasses (Pix/extrato) já feitos a ele ou a contas ligadas (ex.: esposa).
// Fica SEPARADO dos pagamentos da equipe: repasse a sócio não é custo de obra e não entra no "Resultado por obra" (só no 💵 Caixa de Notas e resultado).
// Usa as funções do admin.js (P).
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null;

  function din(v) { return A.dinheiro(Number(v) || 0); }
  function dig(t) { return String(t || "").replace(/\D/g, ""); }
  function semAcento(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function letras(n) { return semAcento(n).replace(/\b(da|de|do|dos|das|e)\b/g, " ").replace(/[^a-z]/g, ""); }
  function r2(v) { return Math.round((Number(v) || 0) * 100) / 100; }
  function dataBr(iso) { var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + "/" + m[2] + "/" + m[1] : String(iso || ""); }
  function horaBr(iso) { var d = new Date(iso); return isNaN(d) ? "" : ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
  function dataLocal(iso) { return A.isoLocal(new Date(iso)); }
  function lista() { return (P && P.S.socios) || []; }
  function servicosDe(s) { return ((P && P.S.socServ) || []).filter(function (x) { return x.socio_id === s.id; }).sort(function (a, b) { return a.data < b.data ? 1 : -1; }); }
  function repassesDe(s) { return ((P && P.S.socRep) || []).filter(function (x) { return x.socio_id === s.id; }).sort(function (a, b) { return a.pago_em < b.pago_em ? 1 : -1; }); }
  function pc(sv, s) { return sv.percentual != null && sv.percentual !== "" ? Number(sv.percentual) : Number(s.percentual) || 0; }
  function parte(sv, s) { return r2(Number(sv.valor) * pc(sv, s) / 100); }
  function totais(s) {
    var t = { fechados: 0, parte: 0, repassado: 0, aportes: 0, saldo: 0 };
    servicosDe(s).forEach(function (x) { t.fechados += Number(x.valor); t.parte += parte(x, s); });
    repassesDe(s).forEach(function (x) { if (x.tipo === "aporte") t.aportes += Number(x.valor); else t.repassado += Number(x.valor); });
    t.fechados = r2(t.fechados); t.parte = r2(t.parte); t.repassado = r2(t.repassado); t.aportes = r2(t.aportes);
    t.saldo = r2(t.parte - t.repassado + t.aportes);   // o que ainda falta repassar ao sócio (negativo = já repassou a mais)
    return t;
  }
  // quem recebeu o Pix é este sócio? (CPF dele, de uma conta ligada, ou o nome completo)
  function achar(nome, docs, cortado) {
    var ds = (docs || []).map(dig).filter(function (d) { return d.length >= 11; }), n = letras(nome);
    return lista().filter(function (s) { return s.ativo !== false; }).filter(function (s) {
      var contas = [{ nome: s.nome, doc: s.doc }].concat(s.relacionados || []);
      return contas.some(function (c) { var cd = dig(c.doc); return (cd.length >= 11 && ds.some(function (d) { return d === cd; })) || (n.length >= 10 && letras(c.nome) === n) || (cortado && ds.length === 0 && n.length >= 9 && letras(c.nome).indexOf(n) === 0); });
    })[0] || null;
  }
  // este nome/CPF é de um FUNCIONÁRIO da equipe? (CPF na chave Pix, ou nome completo igual / começo do nome cortado)
  function funcionarioDe(nome, docs, cortado) {
    var ds = (docs || []).map(dig).filter(function (d) { return d.length >= 11; }), n = letras(nome);
    return ((P && P.S.func) || []).filter(function (f) {
      var pd = dig(f.pix);
      return (pd.length >= 11 && ds.some(function (d) { return d === pd; })) || (n.length >= 10 && letras(f.nome) === n) || (cortado && ds.length === 0 && n.length >= 9 && letras(f.nome).indexOf(n) === 0);
    })[0] || null;
  }
  function paraTexto(rel) { return (rel || []).map(function (x) { return x.nome + (x.doc ? "; " + x.doc : ""); }).join("\n"); }
  function deTexto(t) {
    return String(t || "").split("\n").map(function (l) { l = l.trim(); if (!l) return null; var p = l.split(/[;|]/); return { nome: p[0].trim().slice(0, 160), doc: (p[1] || "").trim().slice(0, 30) }; }).filter(function (x) { return x && x.nome; });
  }

  // ---------------- tela ----------------
  function ver(c, ctx) {
    P = ctx;
    c.innerHTML = '<div class="cab-secao"><h2>👔 Sócios</h2><span><button class="prim" id="so-novo">+ Novo sócio</button></span></div>' +
      '<p class="mudo peq" style="margin-top:-4px">Lance os <b>serviços fechados</b> por cada sócio e os <b>repasses</b> a ele (Pix, comprovante ou extrato). O app mostra a parte dele, o que já foi repassado e o <b>saldo</b>. Isso fica <b>separado</b> dos pagamentos da equipe e não altera o resultado das obras.</p>' +
      (P.S.semSocios ? '<div class="aviso">Para usar esta área, rode no Supabase o <b>supabase.sql</b> atualizado (tabelas <b>socios</b>, <b>socio_servicos</b> e <b>socio_repasses</b>) e atualize o app.</div>' : "") +
      '<div id="so-res"></div>';
    $("#so-novo", c).onclick = function () { if (P.S.semSocios) { A.avisar("Rode o supabase.sql atualizado no Supabase primeiro.", "erro"); return; } editarSocio({}); };
    desenhar();
  }
  function desenhar() {
    var r = $("#so-res"); if (!r) return;
    var ls = lista();
    if (!ls.length) { r.innerHTML = '<div class="cartao vazio">Nenhum sócio ainda. Toque em <b>+ Novo sócio</b>.</div>'; return; }
    r.innerHTML = ls.map(function (s) {
      var t = totais(s), sv = servicosDe(s), todosRp = repassesDe(s), rp = todosRp.filter(function (x) { return x.tipo !== "aporte"; }), ap = todosRp.filter(function (x) { return x.tipo === "aporte"; });
      var tile = function (rot, v, cor) { return '<div class="ladrilho" style="border-left:4px solid var(--' + cor + ')"><div class="r">' + rot + '</div><div class="v" style="font-size:1.15em">' + din(v) + "</div></div>"; };
      return '<div class="cartao" data-so="' + esc(s.id) + '"><div class="linha" style="gap:8px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:220px"><b style="font-size:1.1em">' + esc(s.nome) + "</b> " +
        '<span class="selo">' + esc(String(s.percentual).replace(".", ",")) + "% dos serviços fechados</span>" + (s.ativo === false ? ' <span class="selo">inativo</span>' : "") +
        '<div class="peq mudo">' + (s.doc ? "CPF " + esc(s.doc) : "") + ((s.relacionados || []).length ? " · também conta: " + esc((s.relacionados || []).map(function (x) { return x.nome; }).join(", ")) : "") + "</div></div>" +
        '<button class="peq" data-so-edit>✏ Editar</button></div>' +
        '<div class="grade" style="margin:8px 0">' + tile("Serviços fechados", t.fechados, "prim") + tile("Parte do sócio", t.parte, "atencao") + tile("Já repassado", t.repassado, "bom") + (t.aportes ? tile("Pagou pela empresa", t.aportes, "pintura") : "") +
        tile(t.saldo >= 0 ? "Falta repassar" : "Repassado a mais", Math.abs(t.saldo), t.saldo > 0 ? "critico" : "bom") + "</div>" +
        '<div class="acoes"><button class="prim peq" data-so-serv>➕ Serviço fechado</button><button class="peq" data-so-pix>📥 Comprovante Pix</button><button class="peq" data-so-ext>🏦 Extrato do banco</button><button class="peq" data-so-rep>✍ Repasse à mão</button></div>' +
        '<details style="margin-top:6px"' + (sv.length ? " open" : "") + "><summary><b>Serviços fechados (" + sv.length + ")</b></summary>" + (sv.length ? '<div class="tabela-caixa"><table><thead><tr><th>Data</th><th>Cliente / serviço</th><th class="num">Valor</th><th class="num">Parte</th><th></th></tr></thead><tbody>' +
          sv.map(function (x) { var nt = x.receita_id ? (P.S.receitas || []).filter(function (n) { return n.id === x.receita_id; })[0] : null;
            return "<tr><td>" + dataBr(x.data) + "</td><td>" + esc(x.cliente || "") + (x.descricao ? '<div class="peq mudo">' + esc(x.descricao) + "</div>" : "") + (nt ? '<div class="peq">🧾 nota ' + esc(nt.numero_nota || "s/ nº") + (nt.recebido ? " · ✅ recebida" : " · ⏳ a receber") + "</div>" : "") + '</td><td class="num">' + din(x.valor) + '</td><td class="num">' + din(parte(x, s)) + ' <span class="peq mudo">' + String(pc(x, s)).replace(".", ",") + '%</span></td><td><button class="peq" data-so-sv="' + esc(x.id) + '">✏</button></td></tr>'; }).join("") + "</tbody></table></div>" : '<p class="peq mudo">Nenhum serviço lançado.</p>') + "</details>" +
        '<details' + (rp.length ? " open" : "") + "><summary><b>💸 Repasses ao sócio (" + rp.length + ')</b> <span class="peq mudo">a empresa pagou a ele ou à conta ligada</span></summary>' + (rp.length ? '<div class="tabela-caixa"><table><thead><tr><th>Data</th><th>Quem recebeu</th><th class="num">Valor</th><th></th></tr></thead><tbody>' +
          rp.map(function (x) { return "<tr><td>" + dataBr(dataLocal(x.pago_em)) + ' <span class="peq mudo">' + esc(horaBr(x.pago_em)) + "</span></td><td>" + esc(x.favorecido || "") + (x.descricao ? '<div class="peq mudo">' + esc(x.descricao) + "</div>" : "") +
            (x.comprovante ? ' <button class="peq" data-so-foto="' + esc(x.comprovante) + '">🖼</button>' : "") + '</td><td class="num">' + din(x.valor) + '</td><td><button class="peq" data-so-rp="' + esc(x.id) + '">✏</button></td></tr>'; }).join("") + "</tbody></table></div>" : '<p class="peq mudo">Nenhum repasse lançado.</p>') + "</details>" +
        '<details' + (ap.length ? " open" : "") + ' style="margin-top:6px"><summary><b>🧾 Pagos pelo sócio pela empresa (' + ap.length + ')</b> <span class="peq mudo">ele adiantou com o dinheiro dele</span></summary>' + (ap.length ? '<div class="tabela-caixa"><table><thead><tr><th>Data</th><th>Pago a</th><th class="num">Valor</th><th></th></tr></thead><tbody>' +
          ap.map(function (x) { var fu = funcionarioDe(x.favorecido, [], false);
            return "<tr><td>" + dataBr(dataLocal(x.pago_em)) + ' <span class="peq mudo">' + esc(horaBr(x.pago_em)) + "</span></td><td>" + (fu ? '<span class="selo">👷 funcionário</span> ' : "") + esc(x.favorecido || "") + (x.descricao ? '<div class="peq mudo">' + esc(x.descricao) + "</div>" : "") +
              (x.comprovante ? ' <button class="peq" data-so-foto="' + esc(x.comprovante) + '">🖼</button>' : "") + '</td><td class="num">' + din(x.valor) + '</td><td><button class="peq" data-so-rp="' + esc(x.id) + '">✏</button></td></tr>'; }).join("") + '</tbody></table></div><p class="peq mudo" style="margin:4px 0 0">Isto <b>não é repasse ao sócio</b>: é só o registro de que ele pagou do bolso o que era da empresa (a empresa deve esse valor a ele). O pagamento em si fica em <b>Pagamentos</b> (equipe) ou em <b>Compras</b>.</p>' : '<p class="peq mudo">Nada lançado.</p>') + "</details></div>";
    }).join("");
    $$("[data-so]", r).forEach(function (el) {
      var s = lista().filter(function (x) { return x.id === el.dataset.so; })[0];
      $("[data-so-edit]", el).onclick = function () { editarSocio(s); };
      $("[data-so-serv]", el).onclick = function () { editarServico({}, s); };
      $("[data-so-rep]", el).onclick = function () { editarRepasse({}, s); };
      $("[data-so-pix]", el).onclick = function () { escolherComprovantes(s); };
      $("[data-so-ext]", el).onclick = function () { window.AGE_PAG.escolherExtrato(P); };
      $$("[data-so-sv]", el).forEach(function (b) { b.onclick = function () { editarServico(P.porId(P.S.socServ, b.dataset.soSv), s); }; });
      $$("[data-so-rp]", el).forEach(function (b) { b.onclick = function () { editarRepasse(P.porId(P.S.socRep, b.dataset.soRp), s); }; });
      $$("[data-so-foto]", el).forEach(function (b) {
        b.onclick = function () { P.q(P.sb.storage.from("fotos").createSignedUrl(b.dataset.soFoto, 600)).then(function (u) { window.open(u.signedUrl, "_blank", "noopener"); }).catch(P.falhou); };
      });
    });
  }

  // ---------------- cadastro do sócio ----------------
  function editarSocio(s) {
    var novo = !s.id;
    var j = A.janela('<label for="so-nome">Nome *</label><input id="so-nome" maxlength="160" autocomplete="off">' +
      '<div class="duas"><div><label for="so-doc">CPF</label><input id="so-doc" inputmode="numeric" maxlength="20" placeholder="000.000.000-00"></div><div><label for="so-pc">Parte do sócio nos serviços fechados (%)</label><input id="so-pc" inputmode="decimal" placeholder="Ex.: 30"></div></div>' +
      '<label for="so-rel">Outras contas que contam para este sócio (uma por linha: Nome; CPF) — ex.: esposa</label><textarea id="so-rel" rows="3" placeholder="Iva Barboza dos Santos; 055.736.566-00"></textarea>' +
      '<label for="so-obs">Anotações</label><textarea id="so-obs" rows="2" maxlength="2000"></textarea>' +
      '<label class="marca-linha" style="font-weight:400"><input type="checkbox" id="so-ativo"> Sócio ativo</label>' +
      '<div class="acoes"><button class="prim" id="so-salvar">💾 Salvar</button>' + (novo ? "" : '<button class="perigo" id="so-apagar">🗑 Excluir</button>') + '<button id="so-cancelar">Cancelar</button></div>',
      { titulo: novo ? "👔 Novo sócio" : "👔 " + (s.nome || "Sócio"), larga: true, fixa: true });
    var el = j.el;
    $("#so-nome", el).value = s.nome || ""; $("#so-doc", el).value = s.doc || ""; $("#so-pc", el).value = s.percentual != null ? String(s.percentual).replace(".", ",") : "";
    $("#so-rel", el).value = paraTexto(s.relacionados); $("#so-obs", el).value = s.obs || ""; $("#so-ativo", el).checked = s.ativo !== false;
    $("#so-cancelar", el).onclick = function () { j.fechar(); };
    if ($("#so-apagar", el)) $("#so-apagar", el).onclick = function () {
      if (!A.confirmar("Excluir o sócio “" + s.nome + "”? Os serviços fechados e os repasses dele também saem. Isso não vai para a lixeira.")) return;
      var b = this; A.ocupado(b, true, "Excluindo...");
      P.q(P.sb.from("socios").delete().eq("id", s.id)).then(function () {
        P.tirar(P.S.socios, s.id); P.S.socServ = P.S.socServ.filter(function (x) { return x.socio_id !== s.id; }); P.S.socRep = P.S.socRep.filter(function (x) { return x.socio_id !== s.id; });
        j.fechar(); desenhar(); A.avisar("Sócio excluído", "ok");
      }).catch(function (e) { A.ocupado(b, false); P.falhou(e); });
    };
    $("#so-salvar", el).onclick = function () {
      var d = { nome: $("#so-nome", el).value.trim(), doc: $("#so-doc", el).value.trim() || null, percentual: A.lerNumero($("#so-pc", el).value) || 0, relacionados: deTexto($("#so-rel", el).value), obs: $("#so-obs", el).value.trim() || null, ativo: $("#so-ativo", el).checked };
      if (!d.nome) { A.avisar("Escreva o nome do sócio.", "erro"); return; }
      if (d.percentual < 0 || d.percentual > 100) { A.avisar("A parte do sócio tem de ficar entre 0 e 100%.", "erro"); return; }
      var b = this; A.ocupado(b, true, "Salvando...");
      P.q(novo ? P.sb.from("socios").insert(d).select().single() : P.sb.from("socios").update(d).eq("id", s.id).select().single()).then(function (n) {
        P.trocar(P.S.socios, n); j.fechar(); desenhar(); A.avisar("👔 Sócio salvo", "ok");
      }).catch(function (e) { A.ocupado(b, false); P.falhou(e); });
    };
    setTimeout(function () { $("#so-nome", el).focus(); }, 50);
  }

  // ---------------- serviço fechado ----------------
  function editarServico(sv, s) {
    var novo = !sv.id;
    var notas = (P.S.receitas || []).slice().sort(function (a, b) { return a.emitida_em < b.emitida_em ? 1 : -1; });
    var j = A.janela('<div class="duas"><div><label for="sv-data">Data do serviço *</label><input id="sv-data" type="date"></div><div><label for="sv-valor">Valor do serviço fechado (R$) *</label><input id="sv-valor" inputmode="decimal"></div></div>' +
      '<label for="sv-cli">Cliente</label><input id="sv-cli" maxlength="200" autocomplete="off">' +
      '<label for="sv-desc">Serviço</label><textarea id="sv-desc" rows="2" maxlength="1000"></textarea>' +
      '<div class="duas"><div><label for="sv-pc">Parte do sócio (%) — vazio = ' + String(s.percentual).replace(".", ",") + '%</label><input id="sv-pc" inputmode="decimal"></div>' +
      '<div><label for="sv-nota">Nota de serviço ligada (opcional)</label><select id="sv-nota"><option value="">— nenhuma —</option>' + notas.map(function (n) { return '<option value="' + n.id + '">Nota ' + esc(n.numero_nota || "s/ nº") + " · " + esc(n.cliente || "") + " · " + din(n.valor_bruto || n.valor) + (n.recebido ? " · recebida" : " · a receber") + "</option>"; }).join("") + "</select></div></div>" +
      '<div id="sv-prev" class="peq mudo"></div>' +
      '<div class="acoes"><button class="prim" id="sv-salvar">💾 Salvar</button>' + (novo ? "" : '<button class="perigo" id="sv-apagar">🗑 Excluir</button>') + '<button id="sv-cancelar">Cancelar</button></div>',
      { titulo: (novo ? "➕ Serviço fechado" : "✏ Serviço fechado") + " · " + s.nome, larga: true, fixa: true });
    var el = j.el;
    $("#sv-data", el).value = sv.data || A.isoLocal(new Date()); $("#sv-valor", el).value = sv.valor != null ? String(sv.valor).replace(".", ",") : "";
    $("#sv-cli", el).value = sv.cliente || ""; $("#sv-desc", el).value = sv.descricao || ""; $("#sv-pc", el).value = sv.percentual != null ? String(sv.percentual).replace(".", ",") : ""; $("#sv-nota", el).value = sv.receita_id || "";
    function prev() { var v = A.lerNumero($("#sv-valor", el).value), p2 = $("#sv-pc", el).value.trim() === "" ? Number(s.percentual) || 0 : A.lerNumero($("#sv-pc", el).value); $("#sv-prev", el).textContent = v > 0 ? "Parte do sócio neste serviço: " + din(r2(v * p2 / 100)) + " (" + String(p2).replace(".", ",") + "%)" : ""; }
    $("#sv-valor", el).oninput = prev; $("#sv-pc", el).oninput = prev; prev();
    $("#sv-cancelar", el).onclick = function () { j.fechar(); };
    if ($("#sv-apagar", el)) $("#sv-apagar", el).onclick = function () {
      if (!A.confirmar("Excluir este serviço fechado?")) return;
      var b = this; A.ocupado(b, true, "Excluindo...");
      P.q(P.sb.from("socio_servicos").delete().eq("id", sv.id)).then(function () { P.tirar(P.S.socServ, sv.id); j.fechar(); desenhar(); A.avisar("Excluído", "ok"); }).catch(function (e) { A.ocupado(b, false); P.falhou(e); });
    };
    $("#sv-salvar", el).onclick = function () {
      var v = A.lerNumero($("#sv-valor", el).value), pcT = $("#sv-pc", el).value.trim();
      var d = { socio_id: s.id, data: $("#sv-data", el).value, valor: v, cliente: $("#sv-cli", el).value.trim() || null, descricao: $("#sv-desc", el).value.trim() || null, percentual: pcT === "" ? null : A.lerNumero(pcT), receita_id: $("#sv-nota", el).value || null };
      if (!d.data) { A.avisar("Informe a data.", "erro"); return; }
      if (!(v > 0)) { A.avisar("Informe o valor do serviço.", "erro"); return; }
      if (d.percentual != null && (d.percentual < 0 || d.percentual > 100)) { A.avisar("A parte tem de ficar entre 0 e 100%.", "erro"); return; }
      var b = this; A.ocupado(b, true, "Salvando...");
      P.q(novo ? P.sb.from("socio_servicos").insert(d).select().single() : P.sb.from("socio_servicos").update(d).eq("id", sv.id).select().single()).then(function (n) {
        P.trocar(P.S.socServ, n); j.fechar(); desenhar(); A.avisar("➕ Serviço salvo", "ok");
      }).catch(function (e) { A.ocupado(b, false); P.falhou(e); });
    };
    setTimeout(function () { $("#sv-valor", el).focus(); }, 50);
  }

  // ---------------- repasse (à mão ou por comprovante) ----------------
  function paraIso(data, hora) { return new Date(data + "T" + (hora || "12:00") + ":00").toISOString(); }
  function editarRepasse(rp, s) {
    var novo = !rp.id, base = rp.pago_em ? new Date(rp.pago_em) : new Date();
    var j = A.janela('<div class="duas"><div><label for="rp-data">Data *</label><input id="rp-data" type="date"></div><div><label for="rp-hora">Hora</label><input id="rp-hora" type="time"></div></div>' +
      '<div class="duas"><div><label for="rp-valor">Valor (R$) *</label><input id="rp-valor" inputmode="decimal"></div><div><label for="rp-tipo">Tipo</label><select id="rp-tipo"><option value="repasse">💸 Repasse: a empresa pagou ao sócio</option><option value="aporte">🧾 O sócio pagou algo da empresa com o dinheiro dele</option></select></div></div>' +
      '<label for="rp-fav">Quem recebeu / para quem foi</label><input id="rp-fav" maxlength="200" autocomplete="off">' +
      '<label for="rp-desc">Observação</label><input id="rp-desc" maxlength="1000">' +
      '<div class="acoes"><button class="prim" id="rp-salvar">💾 Salvar</button>' + (novo ? "" : '<button class="perigo" id="rp-apagar">🗑 Excluir</button>') + '<button id="rp-cancelar">Cancelar</button></div>',
      { titulo: (novo ? "✍ Repasse" : "✏ Repasse") + " · " + s.nome, larga: true, fixa: true });
    var el = j.el;
    $("#rp-data", el).value = A.isoLocal(base); $("#rp-hora", el).value = ("0" + base.getHours()).slice(-2) + ":" + ("0" + base.getMinutes()).slice(-2);
    $("#rp-valor", el).value = rp.valor != null ? String(rp.valor).replace(".", ",") : ""; $("#rp-tipo", el).value = rp.tipo || "repasse"; $("#rp-fav", el).value = rp.favorecido || ""; $("#rp-desc", el).value = rp.descricao || "";
    $("#rp-cancelar", el).onclick = function () { j.fechar(); };
    if ($("#rp-apagar", el)) $("#rp-apagar", el).onclick = function () {
      if (!A.confirmar("Excluir este repasse?")) return;
      var b = this; A.ocupado(b, true, "Excluindo...");
      P.q(P.sb.from("socio_repasses").delete().eq("id", rp.id)).then(function () { P.tirar(P.S.socRep, rp.id); j.fechar(); desenhar(); A.avisar("Excluído", "ok"); }).catch(function (e) { A.ocupado(b, false); P.falhou(e); });
    };
    $("#rp-salvar", el).onclick = function () {
      var v = A.lerNumero($("#rp-valor", el).value);
      if (!$("#rp-data", el).value) { A.avisar("Informe a data.", "erro"); return; }
      if (!(v > 0)) { A.avisar("Informe o valor.", "erro"); return; }
      var fu0 = $("#rp-tipo", el).value !== "aporte" ? funcionarioDe($("#rp-fav", el).value, [], false) : null;
      if (fu0) { A.avisar(fu0.nome + " é FUNCIONÁRIO: lance em Pagamentos (equipe), e não como repasse ao sócio. Se o sócio pagou do bolso, escolha o tipo \"O sócio pagou algo da empresa\".", "erro"); return; }
      var d = { socio_id: s.id, pago_em: paraIso($("#rp-data", el).value, $("#rp-hora", el).value), valor: v, tipo: $("#rp-tipo", el).value, favorecido: $("#rp-fav", el).value.trim() || null, descricao: $("#rp-desc", el).value.trim() || null };
      var b = this; A.ocupado(b, true, "Salvando...");
      P.q(novo ? P.sb.from("socio_repasses").insert(d).select().single() : P.sb.from("socio_repasses").update(d).eq("id", rp.id).select().single()).then(function (n) {
        P.trocar(P.S.socRep, n); j.fechar(); desenhar(); A.avisar("💸 Repasse salvo", "ok");
      }).catch(function (e) { A.ocupado(b, false); P.falhou(e); });
    };
    setTimeout(function () { $("#rp-valor", el).focus(); }, 50);
  }

  // foto/PDF do comprovante Pix: o app lê valor, data, hora, ID e quem recebeu; você confere e ele lança como repasse
  function escolherComprovantes(s) {
    var inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*,application/pdf,.pdf"; inp.multiple = true; inp.style.display = "none";
    document.body.appendChild(inp);
    inp.onchange = function () { var fs = Array.prototype.slice.call(inp.files); inp.remove(); if (fs.length) lerComprovantes(s, fs.slice(0, 20)); };
    inp.click();
  }
  function lerComprovantes(s, fs) {
    var j = A.janela('<div id="cp-st" class="peq">📖 Lendo os comprovantes...</div><div id="cp-res"></div>', { titulo: "📥 Comprovantes · " + s.nome, larga: true, fixa: true, semRascunho: true });
    var el = j.el, itens = [], vistos = {};
    fs.reduce(function (pr, f, i) {
      return pr.then(function () {
        $("#cp-st", el).textContent = "📖 Lendo " + (i + 1) + " de " + fs.length + "...";
        return window.AGE_PAG.lerArquivo(f).then(function (r) {
          var x = window.AGE_PAG.lerPix(r.texto || "");
          itens.push({ f: f, img: r.imagem || (/^image\//.test(f.type) ? f : null), x: x });
        }).catch(function () { itens.push({ f: f, img: null, x: {}, erro: true }); });
      });
    }, Promise.resolve()).then(function () {
      itens.forEach(function (it) {
        var x = it.x || {};
        it.ok = x.valor > 0 && !!x.data;
        var rep = (P.S.socRep || []).filter(function (r) { return (x.id && r.id_transacao === x.id) || (it.ok && Math.abs(Number(r.valor) - x.valor) < 0.005 && dataLocal(r.pago_em) === x.data && (!x.hora || horaBr(r.pago_em) === x.hora)); })[0];
        it.ja = !!rep;
        var chave = x.id || (x.data + "|" + x.valor + "|" + (x.hora || ""));
        if (vistos[chave]) it.rep = true; else vistos[chave] = 1;
      });
      $("#cp-st", el).innerHTML = "<b>" + itens.length + "</b> comprovante(s) lido(s). Confira e lance.";
      $("#cp-res", el).innerHTML = '<div class="tabela-caixa"><table><thead><tr><th></th><th>Data e hora</th><th class="num">Valor</th><th>Quem recebeu</th><th>Tipo</th></tr></thead><tbody>' +
        itens.map(function (it, i) {
          var x = it.x || {}, pode = it.ok && !it.ja && !it.rep;
          return "<tr" + (pode ? "" : ' class="mudo"') + '><td><input type="checkbox" class="cp-uso" data-i="' + i + '"' + (pode ? " checked" : " disabled") + "></td><td>" + (it.ok ? dataBr(x.data) + " " + esc(x.hora || "") : "—") + '</td><td class="num">' + (x.valor ? din(x.valor) : "—") + "</td><td>" + esc(x.favorecido || "") +
            (it.erro || !it.ok ? '<div class="peq" style="color:var(--critico)">⚠️ não consegui ler valor/data: lance à mão</div>' : "") + (it.ja ? '<div class="peq">⛔ já lançado</div>' : "") + (it.rep ? '<div class="peq">⛔ repetido nesta seleção</div>' : "") + '</td><td><select class="cp-tipo" data-i="' + i + '"><option value="repasse">Repasse</option><option value="aporte">Sócio pagou pela empresa</option></select></td></tr>';
        }).join("") + '</tbody></table></div><div class="acoes"><button class="prim" id="cp-ok">✔ Lançar os marcados</button><button id="cp-fim">Fechar</button></div><div id="cp-msg" class="peq"></div>';
      $("#cp-fim", el).onclick = function () { j.fechar(); };
      $("#cp-ok", el).onclick = function () {
        var b = this, sel = [];
        $$(".cp-uso", el).forEach(function (cb) { if (cb.checked) sel.push({ it: itens[Number(cb.dataset.i)], tipo: $(".cp-tipo[data-i='" + cb.dataset.i + "']", el).value }); });
        if (!sel.length) { A.avisar("Marque o que vai lançar.", "erro"); return; }
        var errF = sel.map(function (q2) { return q2.tipo !== "aporte" ? funcionarioDe(q2.it.x.favorecido, [q2.it.x.cpf, q2.it.x.chave], false) : null; }).filter(Boolean)[0];
        if (errF) { A.avisar(errF.nome + " é FUNCIONÁRIO: lance em Pagamentos (equipe). Aqui só entra repasse ao sócio (ou o que o sócio pagou do bolso).", "erro"); return; }
        A.ocupado(b, true, "Lançando...");
        var n = 0, total = 0;
        sel.reduce(function (pr, q2) {
          return pr.then(function () {
            var x = q2.it.x;
            var pF = !q2.it.img ? Promise.resolve(null) : A.prepararFoto(q2.it.img, [], 1600).then(function (bl) {
              var cam = "admin/socios/" + x.data + "-" + A.uuid() + ".jpg";
              return P.q(P.sb.storage.from("fotos").upload(cam, bl, { contentType: "image/jpeg" })).then(function () { return cam; });
            }).catch(function () { return null; });
            return pF.then(function (cam) {
              var d = { socio_id: s.id, pago_em: paraIso(x.data, x.hora), valor: x.valor, tipo: q2.tipo, favorecido: x.favorecido || null, id_transacao: x.id || null, comprovante: cam, descricao: "Comprovante Pix" };
              return P.q(P.sb.from("socio_repasses").insert(d).select().single()).then(function (r) { P.S.socRep.unshift(r); n++; total += Number(r.valor); });
            });
          });
        }, Promise.resolve()).then(function () { A.avisar("✅ " + n + " lançamento(s): " + din(total), "ok"); j.fechar(); desenhar(); })
          .catch(function (e) { A.ocupado(b, false); $("#cp-msg", el).innerHTML = '<div class="aviso erro">' + esc(A.msgErro(e)) + (n ? " (já foram lançados " + n + ")" : "") + "</div>"; });
      };
    });
  }

  window.AGE_SOC = { usar: function (ctx) { P = ctx; }, ver: ver, achar: achar, funcionarioDe: funcionarioDe, totais: totais, lista: lista, repassesDe: repassesDe };
})();
