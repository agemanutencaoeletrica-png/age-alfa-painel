// Painel do dono — 📅 AGENDA: calendário futurista com relógio ao vivo, feriados e os compromissos do dia.
// Mostra os seus compromissos (visitas, reuniões, prazos...) e, sozinhos, os serviços com data prevista e os vencimentos de impostos.
// O relógio do topo e o calendário se atualizam sozinhos (segundo a segundo, na virada do dia e a cada minuto buscando novidades).
// Tabela: agenda_eventos.
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null, ev = [], semTabela = false, mes = null, sel = null, raiz = null, busca = null, vista = "mes";
  var AVISOS = [["", "Não avisar"], ["0", "Na hora"], ["30", "30 min antes"], ["60", "1 hora antes"], ["120", "2 horas antes"], ["1440", "1 dia antes"]];
  var TIPOS = { visita: ["🏠", "Visita"], reuniao: ["🤝", "Reunião"], servico: ["🔧", "Serviço"], prazo: ["⏰", "Prazo"], lembrete: ["🔔", "Lembrete"], outro: ["📌", "Outro"] };
  var MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  var DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"], DIAS_L = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

  function p2(n) { return ("0" + n).slice(-2); }
  function iso(d) { return A.isoLocal(d); }
  function deIso(s) { var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/); return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])); }
  function semT(e) { return /does not exist|schema cache|PGRST205|42P01/i.test(String((e && (e.message || e.code)) || e)); }
  function run(b) { return Promise.resolve(b).then(function (r) { if (r && r.error) throw r.error; return r; }); }
  function dataLonga(d) { return DIAS_L[d.getDay()] + ", " + d.getDate() + " de " + MESES[d.getMonth()].toLowerCase() + " de " + d.getFullYear(); }

  // ---------- relógio ao vivo (topo do app e painel da agenda) ----------
  var rel = { ligado: false, dia: "", min: "" };
  function relogio() {
    function tick() {
      var d = new Date(), hh = p2(d.getHours()) + ":" + p2(d.getMinutes()) + ":" + p2(d.getSeconds());
      $$("[data-rel=hora]").forEach(function (e) { if (e.textContent !== hh) e.textContent = hh; });
      var dt = DIAS[d.getDay()] + ", " + p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + "/" + d.getFullYear();
      $$("[data-rel=data]").forEach(function (e) { if (e.textContent !== dt) e.textContent = dt; });
      var dia = iso(d), min = hh.slice(0, 5);
      if (rel.dia && dia !== rel.dia) document.dispatchEvent(new CustomEvent("age-dia"));
      if (rel.min && min !== rel.min) document.dispatchEvent(new CustomEvent("age-minuto"));
      rel.dia = dia; rel.min = min;
    }
    tick();
    if (rel.ligado) return;
    rel.ligado = true;
    setInterval(tick, 1000);
  }

  // ---------- feriados nacionais ----------
  function pascoa(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
      h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mm = Math.floor((h + l - 7 * m + 114) / 31), dd = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, mm - 1, dd);
  }
  var cacheF = {};
  function feriados(y) {
    if (cacheF[y]) return cacheF[y];
    var f = {}, P0 = pascoa(y);
    function add(d, n) { f[iso(d)] = n; }
    function mov(dias) { var d = new Date(P0); d.setDate(d.getDate() + dias); return d; }
    [[0, 1, "Confraternização Universal"], [3, 21, "Tiradentes"], [4, 1, "Dia do Trabalho"], [8, 7, "Independência"], [9, 12, "N. Sra. Aparecida"], [10, 2, "Finados"], [10, 15, "Proclamação da República"], [10, 20, "Consciência Negra"], [11, 25, "Natal"]]
      .forEach(function (x) { add(new Date(y, x[0], x[1]), x[2]); });
    add(mov(-48), "Carnaval (ponto facultativo)"); add(mov(-47), "Carnaval (ponto facultativo)"); add(mov(-2), "Sexta-feira Santa"); add(mov(60), "Corpus Christi (ponto facultativo)");
    cacheF[y] = f; return f;
  }

  // ---------- dados ----------
  function carregar(depois) {
    run(P.sb.from("agenda_eventos").select("*").order("data").order("hora_ini").limit(5000)).then(function (r) { ev = r.data || []; semTabela = false; })
      .catch(function (e) { ev = []; semTabela = semT(e); if (!semTabela && !busca) { busca = 1; A.avisar(A.msgErro ? A.msgErro(e) : e.message, "erro"); } })
      .then(depois);
  }
  function itensDo(dIso) {
    var out = [];
    ev.forEach(function (e) { if (e.data === dIso) out.push({ src: "ev", e: e, hora: String(e.hora_ini || "").slice(0, 5), fim: String(e.hora_fim || "").slice(0, 5), titulo: e.titulo, tipo: e.tipo, onde: e.onde, feito: e.feito, aviso: e.avisar_min }); });
    ((P.S.serv) || []).forEach(function (s) {
      if (s.data_prevista === dIso && s.status !== "concluido" && s.status !== "cancelado") {
        var o = P.porId(P.S.obras, s.obra_id);
        out.push({ src: "serv", s: s, hora: "", titulo: (o ? o.cliente : "Serviço") + (s.descricao ? " — " + s.descricao : ""), tipo: "servico", onde: o && o.endereco });
      }
    });
    ((P.S.impParcelas) || []).forEach(function (p) {
      if (p.vencimento === dIso && !p.pago_em) {
        var d = ((P.S.impDividas) || []).filter(function (x) { return x.id === p.parcelamento_id; })[0];
        out.push({ src: "imp", hora: "", titulo: "Vence: " + (d ? d.nome : "imposto") + " · " + A.dinheiro(p.valor), tipo: "prazo" });
      }
    });
    out.sort(function (a, b) { return (a.hora || "") < (b.hora || "") ? -1 : (a.hora || "") > (b.hora || "") ? 1 : 0; });
    return out;
  }
  function proximo() {
    var agora = new Date(), hoje = iso(agora), hh = p2(agora.getHours()) + ":" + p2(agora.getMinutes());
    for (var i = 0; i < 60; i++) {
      var d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + i), di = iso(d);
      var it = itensDo(di).filter(function (x) { return x.src !== "ev" || !x.feito; }).filter(function (x) { return di !== hoje || !x.hora || x.hora >= hh; })[0];
      if (it) return { d: d, di: di, it: it };
    }
    return null;
  }

  // ---------- tela ----------
  function ver(c, ctx) {
    P = ctx; raiz = c; busca = null;
    var h = new Date(); mes = new Date(h.getFullYear(), h.getMonth(), 1); sel = iso(h);
    c.innerHTML = '<div class="cab-secao"><h2>📅 Agenda</h2></div><div class="cartao vazio">Carregando...</div>';
    carregar(function () { desenhar(); iniciarAuto(); });
  }
  var auto = false;
  function vivo() { return raiz && document.body.contains(raiz) && $("#ag-grade", raiz); }
  function iniciarAuto() {
    if (auto) return; auto = true;
    function atualizar(recarregar) {
      if (!vivo() || $(".fundo-modal")) return;
      if (recarregar) carregar(function () { if (vivo() && !$(".fundo-modal")) desenhar(); }); else desenhar();
    }
    document.addEventListener("age-dia", function () { if (!vivo()) return; var h = new Date(); mes = new Date(h.getFullYear(), h.getMonth(), 1); sel = iso(h); atualizar(true); });
    var n = 0;
    document.addEventListener("age-minuto", function () { if (!vivo()) return; var pr = $("#ag-prox", raiz); if (pr) pr.innerHTML = htmlProximo(); if (++n % 2 === 0) atualizar(true); });   // a cada 2 min busca novidades
    document.addEventListener("visibilitychange", function () { if (!document.hidden) atualizar(true); });
  }
  function htmlProximo() {
    var x = proximo();
    if (!x) return '<span class="mudo">Nenhum compromisso nos próximos 60 dias.</span>';
    var quando = x.di === iso(new Date()) ? "Hoje" : DIAS[x.d.getDay()] + ", " + p2(x.d.getDate()) + "/" + p2(x.d.getMonth() + 1);
    return "Próximo: <b>" + esc(TIPOS[x.it.tipo] ? TIPOS[x.it.tipo][0] : "📌") + " " + esc(x.it.titulo) + "</b> · " + esc(quando) + (x.it.hora ? " às " + esc(x.it.hora) : "");
  }
  function semanaDe(di) { var d = deIso(di); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()); }
  function rotuloSemana(a) {
    var b = new Date(a.getFullYear(), a.getMonth(), a.getDate() + 6), m1 = MESES[a.getMonth()].slice(0, 3).toLowerCase(), m2 = MESES[b.getMonth()].slice(0, 3).toLowerCase();
    return a.getDate() + (a.getMonth() === b.getMonth() ? "" : " " + m1) + " – " + b.getDate() + " " + m2 + " " + b.getFullYear();
  }
  function desenhar() {
    if (!raiz) return;
    var y = mes.getFullYear(), m = mes.getMonth(), hoje = iso(new Date()), ini = new Date(y, m, 1 - new Date(y, m, 1).getDay()), fer = {}, dsel = deIso(sel), sem = vista === "sem";
    [y - 1, y, y + 1].forEach(function (a) { var f = feriados(a); Object.keys(f).forEach(function (k) { fer[k] = f[k]; }); });
    var corpo = "", rotulo = MESES[m] + " " + y;
    if (!sem) {
      var cel = "";
      for (var i = 0; i < 42; i++) {
        var d = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + i), di = iso(d), L = itensDo(di), dots = L.slice(0, 4).map(function (x) { return '<i class="pt t-' + esc(x.tipo) + '"></i>'; }).join("");
        cel += '<button class="ag-dia' + (d.getMonth() !== m ? " fora" : "") + (di === hoje ? " hoje" : "") + (di === sel ? " sel" : "") + (fer[di] ? " fer" : "") + (d.getDay() === 0 || d.getDay() === 6 ? " fds" : "") + '" data-d="' + di + '" title="' + esc(fer[di] || "") + '"><span class="n">' + d.getDate() + "</span><span class=\"pts\">" + dots + (L.length > 4 ? '<em>+' + (L.length - 4) + "</em>" : "") + "</span></button>";
      }
      corpo = '<div class="ag-sem">' + DIAS.map(function (x) { return "<div>" + x + "</div>"; }).join("") + '</div><div class="ag-grade" id="ag-grade">' + cel + "</div>";
    } else {
      var a0 = semanaDe(sel), cols = "";
      rotulo = rotuloSemana(a0);
      for (var k = 0; k < 7; k++) {
        var dk = new Date(a0.getFullYear(), a0.getMonth(), a0.getDate() + k), dik = iso(dk), Lk = itensDo(dik);
        cols += '<div class="ag-col' + (dik === hoje ? " hoje" : "") + (fer[dik] ? " fer" : "") + (dik === sel ? " sel" : "") + '"><div class="ag-ch"><span><b>' + DIAS[dk.getDay()] + '</b> <span class="n">' + dk.getDate() + "</span></span>" +
          '<button class="peq" data-novo="' + dik + '"' + (semTabela ? " disabled" : "") + ' aria-label="Novo compromisso neste dia">+</button></div>' + (fer[dik] ? '<div class="ag-fer">🎌 ' + esc(fer[dik]) + "</div>" : "") +
          (Lk.length ? Lk.map(function (x) {
            var at = x.src === "ev" ? ' data-ed="' + esc(x.e.id) + '"' : ' data-abrir="' + (x.src === "serv" ? "s:" + esc(x.s.id) : "i") + '"';
            return '<div class="ag-ci t-' + esc(x.tipo) + (x.feito ? " feito" : "") + '"' + at + ' role="button" tabindex="0"><span class="h">' + (x.hora ? esc(x.hora) : "dia todo") + "</span> " + (TIPOS[x.tipo] || TIPOS.outro)[0] + " " + esc(x.titulo) + (x.aviso !== null && x.aviso !== undefined && x.src === "ev" ? " 🔔" : "") + "</div>";
          }).join("") : '<div class="ag-vz">—</div>') + "</div>";
      }
      corpo = '<div class="ag-semana" id="ag-grade">' + cols + "</div>";
    }
    raiz.innerHTML = '<div class="cab-secao"><h2>📅 Agenda</h2><span><button class="prim" id="ag-novo"' + (semTabela ? " disabled" : "") + ">+ Novo compromisso</button></span></div>" +
      (semTabela ? '<div class="aviso">Para criar compromissos, rode no Supabase o <b>agenda.sql</b> (tabela <b>agenda_eventos</b>) e atualize o app. Enquanto isso a agenda já mostra os serviços com data prevista e os vencimentos de impostos.</div>' : "") +
      '<div class="ag"><div class="ag-hud"><div><div class="ag-rel" data-rel="hora"></div><div class="ag-data" data-rel="data"></div></div><div class="ag-prox" id="ag-prox">' + htmlProximo() + "</div></div>" +
      '<div class="ag-vistas"><button data-vista="mes" class="' + (!sem ? "on" : "") + '">Mês</button><button data-vista="sem" class="' + (sem ? "on" : "") + '">Semana</button></div>' +
      '<div class="ag-nav"><button data-nav="-1" aria-label="' + (sem ? "Semana anterior" : "Mês anterior") + '">‹</button><div class="ag-mes">' + esc(rotulo) + '</div><button data-nav="1" aria-label="' + (sem ? "Próxima semana" : "Próximo mês") + '">›</button><button data-nav="0" class="ag-hj">Hoje</button></div>' +
      corpo + '<div class="ag-leg">' + Object.keys(TIPOS).map(function (k) { return '<span><i class="pt t-' + k + '"></i>' + TIPOS[k][1] + "</span>"; }).join("") + "<span>🔔 aviso no Telegram</span></div></div>" +
      (sem ? "" : '<div class="cartao"><div class="linha" style="justify-content:space-between"><h3 style="margin:0">' + esc(dataLonga(dsel)) + "</h3><button class=\"peq\" id=\"ag-novo2\"" + (semTabela ? " disabled" : "") + ">+ Neste dia</button></div>" +
        (fer[sel] ? '<p class="peq" style="color:var(--atencao,#b7791f);margin:6px 0 0">🎌 ' + esc(fer[sel]) + "</p>" : "") + '<div id="ag-dia-lista">' + htmlDia(sel) + "</div></div>");
    relogio();
    $$("[data-d]", raiz).forEach(function (b) { b.onclick = function () { sel = b.dataset.d; var d = deIso(sel); mes = new Date(d.getFullYear(), d.getMonth(), 1); desenhar(); }; });
    $$("[data-vista]", raiz).forEach(function (b) { b.onclick = function () { vista = b.dataset.vista; desenhar(); }; });
    $$("[data-nav]", raiz).forEach(function (b) {
      b.onclick = function () {
        var n = Number(b.dataset.nav), h = new Date();
        if (n === 0) { mes = new Date(h.getFullYear(), h.getMonth(), 1); sel = iso(h); }
        else if (vista === "sem") { var d = deIso(sel); sel = iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * n)); var d2 = deIso(sel); mes = new Date(d2.getFullYear(), d2.getMonth(), 1); }
        else mes = new Date(mes.getFullYear(), mes.getMonth() + n, 1);
        desenhar();
      };
    });
    $("#ag-novo", raiz).onclick = function () { editar(null, sel); };
    if ($("#ag-novo2", raiz)) $("#ag-novo2", raiz).onclick = function () { editar(null, sel); };
    $$("[data-novo]", raiz).forEach(function (b) { b.onclick = function () { editar(null, b.dataset.novo); }; });
    $$(".ag-ci", raiz).forEach(function (el) { el.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); el.click(); } }; });
    ligarDia();
  }
  function htmlDia(di) {
    var L = itensDo(di);
    if (!L.length) return '<p class="mudo" style="margin:8px 0 0">Nada marcado para este dia.</p>';
    return L.map(function (x, i) {
      var t = TIPOS[x.tipo] || TIPOS.outro;
      return '<div class="ag-it t-' + esc(x.tipo) + (x.feito ? " feito" : "") + '"><div class="h">' + (x.hora ? esc(x.hora) + (x.fim ? "<small>" + esc(x.fim) + "</small>" : "") : "<small>dia todo</small>") + '</div><div class="c"><b>' + t[0] + " " + esc(x.titulo) + "</b>" +
        (x.onde ? '<div class="peq mudo">📍 ' + esc(x.onde) + "</div>" : "") + (x.src === "ev" && x.e.obs ? '<div class="peq mudo" style="white-space:pre-wrap">' + esc(x.e.obs) + "</div>" : "") +
        (x.src !== "ev" ? '<div class="peq mudo">' + (x.src === "serv" ? "automático · serviço com data prevista" : "automático · imposto a vencer") + "</div>" : "") + '</div><div class="a">' +
        (x.src === "ev" ? '<button class="peq" data-feito="' + esc(x.e.id) + '" title="Marcar como feito">' + (x.feito ? "↩" : "✓") + '</button><button class="peq" data-ed="' + esc(x.e.id) + '">Editar</button>' :
          '<button class="peq" data-abrir="' + (x.src === "serv" ? "s:" + esc(x.s.id) : "i") + '">Abrir</button>') + "</div></div>";
    }).join("");
  }
  function ligarDia() {
    $$("[data-ed]", raiz).forEach(function (b) { b.onclick = function () { editar(ev.filter(function (e) { return e.id === b.dataset.ed; })[0]); }; });
    $$("[data-feito]", raiz).forEach(function (b) {
      b.onclick = function () {
        var e = ev.filter(function (x) { return x.id === b.dataset.feito; })[0]; if (!e) return;
        run(P.sb.from("agenda_eventos").update({ feito: !e.feito }).eq("id", e.id)).then(function () { e.feito = !e.feito; desenhar(); }).catch(function (er) { A.avisar(A.msgErro ? A.msgErro(er) : er.message, "erro"); });
      };
    });
    $$("[data-abrir]", raiz).forEach(function (b) { b.onclick = function () { var v = b.dataset.abrir; if (v.charAt(0) === "s") P.abrirServico(v.slice(2)); else location.hash = "#impostos"; }; });
  }
  function editar(e, dia) {
    var novo = !e; e = e || { tipo: "visita", data: dia || sel, hora_ini: "", hora_fim: "", titulo: "", onde: "", obs: "", funcionario_id: "", avisar_min: 60 };
    var j = A.janela('<div class="ag-f"><label>O quê<input class="a-tit" maxlength="200" value="' + esc(e.titulo) + '" placeholder="Ex.: Visita técnica com as lojas de tinta"></label>' +
      '<div class="linha" style="gap:8px"><label style="flex:1;min-width:140px">Tipo<select class="a-tipo">' + Object.keys(TIPOS).map(function (k) { return '<option value="' + k + '"' + (k === e.tipo ? " selected" : "") + ">" + TIPOS[k][0] + " " + TIPOS[k][1] + "</option>"; }).join("") + '</select></label>' +
      '<label style="flex:1;min-width:150px">Dia<input class="a-data" type="date" value="' + esc(e.data) + '"></label>' +
      '<label style="width:120px">Início<input class="a-ini" type="time" value="' + esc(String(e.hora_ini || "").slice(0, 5)) + '"></label><label style="width:120px">Fim<input class="a-fim" type="time" value="' + esc(String(e.hora_fim || "").slice(0, 5)) + '"></label></div>' +
      '<label>🔔 Avisar no Telegram<select class="a-av">' + AVISOS.map(function (x) { return '<option value="' + x[0] + '"' + (String(e.avisar_min === null || e.avisar_min === undefined ? "" : e.avisar_min) === x[0] ? " selected" : "") + ">" + x[1] + "</option>"; }).join("") + '</select><span class="peq mudo">Sem horário, o aviso vale para as 8h do dia. Os avisos chegam em até 30 minutos do horário combinado.</span></label>' +
      '<label>Onde<input class="a-onde" maxlength="200" value="' + esc(e.onde || "") + '" placeholder="Endereço ou local"></label>' +
      '<label>Responsável (opcional)<select class="a-func"><option value="">—</option>' + ((P.S.func) || []).filter(function (f) { return f.ativo !== false; }).map(function (f) { return '<option value="' + esc(f.id) + '"' + (f.id === e.funcionario_id ? " selected" : "") + ">" + esc(f.nome) + "</option>"; }).join("") + "</select></label>" +
      '<label>Observação<textarea class="a-obs" rows="3" maxlength="2000">' + esc(e.obs || "") + '</textarea></label></div>' +
      '<div class="acoes"><button class="prim" id="a-ok">💾 Salvar</button>' + (novo ? "" : '<button class="perigo" id="a-del">Apagar</button>') + '<button id="a-x">Cancelar</button></div>', { titulo: novo ? "📅 Novo compromisso" : "📅 Editar compromisso" });
    $("#a-x", j.el).onclick = function () { j.fechar(); };
    $("#a-ok", j.el).onclick = function () {
      var v = { titulo: $(".a-tit", j.el).value.trim(), tipo: $(".a-tipo", j.el).value, data: $(".a-data", j.el).value, hora_ini: $(".a-ini", j.el).value || null, hora_fim: $(".a-fim", j.el).value || null,
        avisar_min: $(".a-av", j.el).value === "" ? null : Number($(".a-av", j.el).value), lembrete_enviado: null, onde: $(".a-onde", j.el).value.trim() || null, funcionario_id: $(".a-func", j.el).value || null, obs: $(".a-obs", j.el).value.trim() || null };
      if (!v.titulo) { A.avisar("Escreva o que é o compromisso.", "erro"); return; }
      if (!v.data) { A.avisar("Escolha o dia.", "erro"); return; }
      if (v.hora_ini && v.hora_fim && v.hora_fim < v.hora_ini) { A.avisar("O fim não pode ser antes do início.", "erro"); return; }
      var op = novo ? P.sb.from("agenda_eventos").insert(v).select() : P.sb.from("agenda_eventos").update(v).eq("id", e.id).select();
      run(op).then(function (r) {
        if (novo) ev.push((r.data || [v])[0]); else Object.keys(v).forEach(function (k) { e[k] = v[k]; });
        sel = v.data; var d = deIso(sel); mes = new Date(d.getFullYear(), d.getMonth(), 1); j.fechar(); desenhar(); A.avisar("Compromisso salvo", "ok");
      }).catch(function (er) { A.avisar(/avisar_min|lembrete_enviado/.test(String(er && er.message)) ? "Rode o agenda.sql atualizado no Supabase (novas colunas do aviso)." : (A.msgErro ? A.msgErro(er) : er.message), "erro"); });
    };
    if (!novo) $("#a-del", j.el).onclick = function () {
      if (!A.confirmar("Apagar “" + e.titulo + "”?")) return;
      run(P.sb.from("agenda_eventos").delete().eq("id", e.id)).then(function () { ev = ev.filter(function (x) { return x.id !== e.id; }); j.fechar(); desenhar(); }).catch(function (er) { A.avisar(A.msgErro ? A.msgErro(er) : er.message, "erro"); });
    };
  }

  window.AGE_AGENDA = { ver: ver, relogio: relogio, feriados: feriados, pascoa: pascoa };
})();
