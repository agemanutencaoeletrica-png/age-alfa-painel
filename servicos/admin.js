// Painel do dono: serviços, ponto, relatórios, orçamentos e equipe.
// Só entra quem tem login E está na tabela "admins" (ver supabase.sql).
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var app = $("#app");
  var sb = null;
  var S = { func: [], obras: [], serv: [], rel: [], orc: [] };
  var urls = {};        // caminho da foto -> { url, vence }
  var infoFoto = {};    // caminho da foto -> html com detalhes (hora, GPS...)
  var filtroServ = { cat: "", st: "ativos", func: "", busca: "" };
  var filtroPonto = null;
  var filtroRel = "nao_lidos";
  var ABAS = [["hoje", "Hoje"], ["servicos", "Serviços"], ["ponto", "Ponto"], ["relatorios", "Relatórios"], ["orcamentos", "Orçamentos"], ["equipe", "Equipe"]];
  var STATUS_ORC = { rascunho: "Rascunho", enviado: "Enviado", aprovado: "Aprovado", recusado: "Recusado" };
  var COR_ORC = { rascunho: "", enviado: "atencao", aprovado: "bom", recusado: "critico" };
  var CAT_ORC = { eletrica: "Elétrica", pintura: "Pintura", eletrica_pintura: "Elétrica e pintura" };
  var UNIDADES = ["un", "m", "m²", "rolo", "L", "galão", "lata", "balde", "kg", "cx", "pç", "par", "serv", "h", "dia", "vb"];

  // ---------- utilidades ----------
  function q(p) { return p.then(function (r) { if (r.error) throw r.error; return r.data; }); }
  function falhou(e) {
    var m = A.msgErro(e);
    A.avisar(m, "erro");
    if (/sessão expirou/.test(m)) telaLogin();
  }
  function porId(lista, id) { for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i]; return null; }
  function trocar(lista, item) { var i = lista.findIndex(function (x) { return x.id === item.id; }); if (i >= 0) lista[i] = item; else lista.unshift(item); }
  function tirar(lista, id) { var i = lista.findIndex(function (x) { return x.id === id; }); if (i >= 0) lista.splice(i, 1); }
  function nomeFunc(id) { var f = porId(S.func, id); return f ? f.nome : "—"; }
  function carregando() { return '<div class="vazio"><span class="carregando"></span> Carregando...</div>'; }
  function val(el, sel) { var x = $(sel, el); return x ? x.value.trim() : ""; }
  function nulo(t) { return t === "" ? null : t; }
  function linkFunc(f) { return new URL("funcionario.html", location.href).href.split("#")[0].split("?")[0] + "#t=" + f.token; }
  function novoToken() {
    var b = crypto.getRandomValues(new Uint8Array(16));
    return Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join("");
  }
  function copiar(texto) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(texto).then(function () { A.avisar("Link copiado", "ok"); }, function () { window.prompt("Copie o link:", texto); });
    }
    window.prompt("Copie o link:", texto);
    return Promise.resolve();
  }

  // Horas trabalhadas: soma cada período chegada -> saída. Se ainda não saiu, conta até "ate".
  function calcHoras(pontos, ate) {
    var total = 0, inicio = null;
    pontos.slice().sort(function (a, b) { return new Date(a.criado_em) - new Date(b.criado_em); }).forEach(function (p) {
      var t = new Date(p.criado_em).getTime();
      if (p.tipo === "chegada" && inicio === null) inicio = t;
      else if (p.tipo === "saida" && inicio !== null) { total += t - inicio; inicio = null; }
    });
    var emAberto = inicio !== null;
    if (emAberto && ate) total += Math.max(0, ate - inicio);
    return { total: total, emAberto: emAberto };
  }

  // ---------- fotos (pasta privada; links temporários de 1 hora) ----------
  function htmlFoto(caminho, etiqueta) {
    return '<button class="foto" data-foto="' + esc(caminho) + '" aria-label="Ver foto"><img alt=""><span class="et">' + esc(etiqueta || "") + "</span></button>";
  }
  function registrarInfoPonto(p) {
    var s = p.servico_id ? porId(S.serv, p.servico_id) : null, o = s ? porId(S.obras, s.obra_id) : null;
    var h = "<b>" + esc(A.TIPO_PONTO[p.tipo]) + "</b> · " + esc(nomeFunc(p.funcionario_id)) + "<br>" + A.dataHora(p.criado_em) + " (hora do servidor)";
    if (o) h += "<br>" + A.seloCategoria(s.categoria) + " " + esc(o.cliente);
    h += "<br>" + (p.lat !== null ? '<a href="' + A.linkMapa(p.lat, p.lng) + '" target="_blank" rel="noopener">📍 Ver no mapa</a> <span class="mudo peq">(precisão ±' +
      Math.round(p.precisao || 0) + " m)</span>" : '<span class="selo critico">sem GPS</span>');
    var dif = p.capturado_em ? Math.abs(new Date(p.criado_em) - new Date(p.capturado_em)) / 60000 : 0;
    if (dif > 10) h += '<br><span class="selo atencao">foto tirada às ' + A.hora(p.capturado_em) + ", enviada " + Math.round(dif) + " min depois</span>";
    if (p.observacao) h += '<p style="white-space:pre-wrap">' + esc(p.observacao) + "</p>";
    infoFoto[p.foto] = h;
  }
  function hidratarFotos(raiz) {
    var botoes = $$("[data-foto]", raiz);
    if (!botoes.length) return;
    var agora = Date.now(), faltam = [];
    botoes.forEach(function (b) {
      var c = b.dataset.foto;
      if ((!urls[c] || urls[c].vence < agora) && faltam.indexOf(c) < 0) faltam.push(c);
      b.onclick = function () { abrirFoto(c); };
    });
    var pronto = faltam.length ? q(sb.storage.from("fotos").createSignedUrls(faltam, 3600)).then(function (lista) {
      (lista || []).forEach(function (x) { if (x.signedUrl) urls[x.path] = { url: x.signedUrl, vence: agora + 55 * 60000 }; });
    }) : Promise.resolve();
    pronto.then(function () {
      botoes.forEach(function (b) { var u = urls[b.dataset.foto]; if (u) $("img", b).src = u.url; });
    }).catch(falhou);
  }
  function abrirFoto(caminho) {
    var u = urls[caminho];
    var j = A.janela((u ? '<a href="' + esc(u.url) + '" target="_blank" rel="noopener"><img class="foto-grande" alt="Foto" src="' + esc(u.url) + '"></a>' : '<div class="vazio">Foto indisponível.</div>') +
      '<div style="margin-top:10px">' + (infoFoto[caminho] || "") + "</div>", { titulo: "Foto", larga: true });
    return j;
  }

  // ---------- entrada ----------
  function iniciar() {
    if (!A.configurado()) { A.telaSemConfig(app); return; }
    try { sb = A.cliente(); } catch (e) { app.innerHTML = '<div class="entrada"><div class="aviso erro">' + esc(A.msgErro(e)) + "</div></div>"; return; }
    sb.auth.onAuthStateChange(function (ev) { if (ev === "SIGNED_OUT") telaLogin(); });
    sb.auth.getSession().then(function (r) {
      if (r.data && r.data.session) verificarAdmin(); else telaLogin();
    }).catch(function () { telaLogin(); });
  }

  function telaLogin(msg) {
    window.removeEventListener("hashchange", rota);
    app.innerHTML = '<div class="entrada"><div class="marca-g">AGE</div><h2 style="text-align:center;margin-bottom:14px">Painel AGE Elétrica e Pintura</h2>' +
      '<form class="cartao" id="f-login"><label for="l-email">E-mail</label><input id="l-email" type="email" autocomplete="username" required>' +
      '<label for="l-senha">Senha</label><input id="l-senha" type="password" autocomplete="current-password" required>' +
      '<div id="l-msg">' + (msg ? '<div class="aviso erro">' + esc(msg) + "</div>" : "") + "</div>" +
      '<div class="acoes"><button class="prim" type="submit">Entrar</button></div></form></div>';
    $("#f-login").onsubmit = function (ev) {
      ev.preventDefault();
      var b = $("button", this);
      A.ocupado(b, true, "Entrando...");
      sb.auth.signInWithPassword({ email: $("#l-email").value.trim(), password: $("#l-senha").value }).then(function (r) {
        if (r.error) throw r.error;
        return verificarAdmin();
      }).catch(function (e) {
        A.ocupado(b, false);
        var m = A.msgErro(e);
        if (/Invalid login/i.test(m)) m = "E-mail ou senha errados.";
        $("#l-msg").innerHTML = '<div class="aviso erro">' + esc(m) + "</div>";
      });
    };
  }

  function verificarAdmin() {
    app.innerHTML = carregando();
    return q(sb.rpc("eh_admin")).then(function (ok) {
      if (!ok) {
        return sb.auth.signOut().then(function () {
          telaLogin("Este e-mail entrou, mas não está autorizado como administrador. Veja o passo 4 do LEIA-ME.md.");
        });
      }
      return carregarBase().then(montar);
    }).catch(function (e) { telaLogin(A.msgErro(e)); });
  }

  function carregarBase() {
    return Promise.all([
      q(sb.from("funcionarios").select("*").order("nome")),
      q(sb.from("obras").select("*").order("criado_em", { ascending: false })),
      q(sb.from("servicos").select("*").order("criado_em", { ascending: false })),
      q(sb.from("relatorios").select("*").order("criado_em", { ascending: false }).limit(500)),
      q(sb.from("orcamentos").select("*").order("numero", { ascending: false }).limit(500))
    ]).then(function (r) { S.func = r[0]; S.obras = r[1]; S.serv = r[2]; S.rel = r[3]; S.orc = r[4]; });
  }

  function montar() {
    app.innerHTML = '<div class="topo"><div class="marca">AGE</div><div><div class="nome">AGE Elétrica e Pintura</div><div class="sub">Painel do responsável</div></div>' +
      '<div class="dir"><button class="leve peq" id="b-recarregar" aria-label="Atualizar">↻</button><button class="leve peq" id="b-sair">Sair</button></div></div>' +
      '<nav class="abas" id="abas"></nav><main id="conteudo"></main>';
    $("#b-sair").onclick = function () { sb.auth.signOut(); };
    $("#b-recarregar").onclick = function () {
      carregarBase().then(function () { rota(); A.avisar("Atualizado"); }).catch(falhou);
    };
    window.removeEventListener("hashchange", rota);
    window.addEventListener("hashchange", rota);
    rota();
  }

  function desenharAbas(atual) {
    var novos = S.rel.filter(function (r) { return !r.lido; }).length;
    $("#abas").innerHTML = ABAS.map(function (a) {
      return '<a href="#' + a[0] + '" class="' + (a[0] === atual ? "ativa" : "") + '">' + a[1] +
        (a[0] === "relatorios" && novos ? '<span class="cont">' + novos + "</span>" : "") + "</a>";
    }).join("");
  }

  function rota() {
    var aba = location.hash.slice(1) || "hoje";
    if (!ABAS.some(function (a) { return a[0] === aba; })) aba = "hoje";
    desenharAbas(aba);
    var c = $("#conteudo");
    if (!c) return;
    window.scrollTo(0, 0);
    ({ hoje: verHoje, servicos: verServicos, ponto: verPonto, relatorios: verRelatorios, orcamentos: verOrcamentos, equipe: verEquipe })[aba](c);
  }

  // =================================================================
  // HOJE
  // =================================================================
  function verHoje(c) {
    c.innerHTML = carregando();
    var ini = A.inicioDia(new Date());
    q(sb.from("pontos").select("*").gte("criado_em", ini.toISOString()).order("criado_em")).then(function (pts) {
      var ativos = S.serv.filter(function (s) { return s.status === "aberto" || s.status === "em_andamento"; });
      var abE = ativos.filter(function (s) { return s.categoria === "eletrica"; }).length;
      var abP = ativos.filter(function (s) { return s.categoria === "pintura"; }).length;
      var novos = S.rel.filter(function (r) { return !r.lido; }).length;
      var aguard = S.orc.filter(function (o) { return o.status === "enviado"; });
      var h = '<div class="grade">' +
        '<div class="ladrilho"><div class="r">⚡ Elétrica</div><div class="v">' + abE + '</div><div class="d">serviços ativos</div></div>' +
        '<div class="ladrilho"><div class="r">🖌️ Pintura</div><div class="v">' + abP + '</div><div class="d">serviços ativos</div></div>' +
        '<div class="ladrilho"><div class="r">Relatórios</div><div class="v">' + novos + '</div><div class="d">novos para ler</div></div>' +
        '<div class="ladrilho"><div class="r">Orçamentos</div><div class="v">' + aguard.length + '</div><div class="d">' +
        A.dinheiro(aguard.reduce(function (t, o) { return t + Number(o.total); }, 0)) + " aguardando cliente</div></div></div>";
      h += '<div class="cab-secao"><h2>Equipe hoje</h2><span class="mudo peq">' + A.data(new Date()) + "</span></div>";
      var equipe = S.func.filter(function (f) { return f.ativo || pts.some(function (p) { return p.funcionario_id === f.id; }); });
      if (!equipe.length) h += '<div class="cartao vazio">Cadastre sua equipe na aba <a href="#equipe">Equipe</a>.</div>';
      equipe.forEach(function (f) {
        var meus = pts.filter(function (p) { return p.funcionario_id === f.id; });
        var hr = calcHoras(meus, Date.now()), ult = meus[meus.length - 1];
        var chegada = meus.filter(function (p) { return p.tipo === "chegada"; })[0];
        var est = !meus.length ? '<span class="selo atencao">não registrou chegada</span>' :
          ult.tipo === "saida" ? '<span class="selo">saiu às ' + A.hora(ult.criado_em) + "</span>" : '<span class="selo bom">trabalhando</span>';
        var s = ult && ult.servico_id ? porId(S.serv, ult.servico_id) : null, o = s ? porId(S.obras, s.obra_id) : null;
        meus.forEach(registrarInfoPonto);
        h += '<div class="cartao"><div class="linha"><h3>' + esc(f.nome) + "</h3>" + est +
          (meus.some(function (p) { return p.lat === null; }) ? '<span class="selo critico">sem GPS</span>' : "") +
          '<span class="dir forte">' + (meus.length ? A.duracao(hr.total) + (hr.emAberto ? " até agora" : "") : "") + "</span></div>" +
          (chegada ? '<div class="peq mudo">Chegada ' + A.hora(chegada.criado_em) + (o ? " · último local: " + esc(o.cliente) : "") + "</div>" : "") +
          (meus.length ? '<div class="fotos">' + meus.map(function (p) { return htmlFoto(p.foto, A.TIPO_PONTO[p.tipo] + " " + A.hora(p.criado_em)); }).join("") + "</div>" : "") +
          "</div>";
      });
      c.innerHTML = h;
      hidratarFotos(c);
    }).catch(function (e) { c.innerHTML = '<div class="aviso erro">' + esc(A.msgErro(e)) + "</div>"; });
  }

  // =================================================================
  // SERVIÇOS (obra/cliente com partes de elétrica e pintura)
  // =================================================================
  function opcoesFunc(cat, atual) {
    var h = '<option value="">— definir depois —</option>';
    S.func.filter(function (f) { return (f.ativo && (!cat || f.area === cat || f.area === "ambos")) || f.id === atual; }).forEach(function (f) {
      h += '<option value="' + f.id + '"' + (f.id === atual ? " selected" : "") + ">" + esc(f.nome) + (f.ativo ? "" : " (desativado)") + "</option>";
    });
    return h;
  }

  function verServicos(c) {
    var F = filtroServ;
    var h = '<div class="cab-secao"><h2>Serviços</h2><button class="prim" id="b-novo-serv">+ Novo serviço</button></div>' +
      '<div class="filtros"><select id="fs-cat" aria-label="Categoria"><option value="">Elétrica e pintura</option><option value="eletrica">⚡ Só elétrica</option><option value="pintura">🖌️ Só pintura</option></select>' +
      '<select id="fs-st" aria-label="Situação"><option value="ativos">Abertos e em andamento</option><option value="aberto">Abertos</option><option value="em_andamento">Em andamento</option>' +
      '<option value="concluido">Concluídos</option><option value="cancelado">Cancelados</option><option value="todos">Todos</option></select>' +
      '<select id="fs-func" aria-label="Funcionário"><option value="">Todos os funcionários</option><option value="-">Sem funcionário</option>' +
      S.func.map(function (f) { return '<option value="' + f.id + '">' + esc(f.nome) + "</option>"; }).join("") + "</select>" +
      '<input id="fs-busca" type="search" placeholder="Buscar cliente ou endereço"></div><div id="lista-serv"></div>';
    c.innerHTML = h;
    $("#fs-cat").value = F.cat; $("#fs-st").value = F.st; $("#fs-func").value = F.func; $("#fs-busca").value = F.busca;
    ["#fs-cat", "#fs-st", "#fs-func"].forEach(function (s) { $(s).onchange = function () { lerFiltro(); listar(); }; });
    $("#fs-busca").oninput = function () { lerFiltro(); listar(); };
    $("#b-novo-serv").onclick = function () { novoServico(null); };
    function lerFiltro() { F.cat = $("#fs-cat").value; F.st = $("#fs-st").value; F.func = $("#fs-func").value; F.busca = $("#fs-busca").value.trim().toLowerCase(); }

    function passa(s) {
      if (F.cat && s.categoria !== F.cat) return false;
      if (F.st === "ativos" && !(s.status === "aberto" || s.status === "em_andamento")) return false;
      if (F.st !== "ativos" && F.st !== "todos" && s.status !== F.st) return false;
      if (F.func === "-" && s.funcionario_id) return false;
      if (F.func && F.func !== "-" && s.funcionario_id !== F.func) return false;
      return true;
    }
    function listar() {
      var obras = S.obras.filter(function (o) {
        if (F.busca && ((o.cliente || "") + " " + (o.endereco || "") + " " + (o.telefone || "")).toLowerCase().indexOf(F.busca) < 0) return false;
        var partes = S.serv.filter(function (s) { return s.obra_id === o.id; });
        if (!partes.length) return F.st === "todos" && !F.cat && !F.func;
        return partes.some(passa);
      });
      var l = $("#lista-serv");
      if (!obras.length) { l.innerHTML = '<div class="cartao vazio">Nenhum serviço com este filtro.</div>'; return; }
      l.innerHTML = obras.map(function (o) {
        var partes = S.serv.filter(function (s) { return s.obra_id === o.id && passa(s); });
        return '<div class="cartao"><div class="linha"><h3>' + esc(o.cliente) + "</h3>" +
          '<span class="dir"><button class="peq" data-parte="' + o.id + '">+ Parte</button> <button class="peq" data-orc-obra="' + o.id + '">💲 Orçamento</button> ' +
          '<button class="peq" data-obra="' + o.id + '">Editar</button></span></div>' +
          (o.endereco ? '<div class="peq"><a href="' + A.linkEndereco(o.endereco) + '" target="_blank" rel="noopener">📍 ' + esc(o.endereco) + "</a></div>" : "") +
          (o.telefone ? '<div class="peq mudo">📞 ' + esc(o.telefone) + "</div>" : "") +
          partes.map(function (s) {
            return '<div class="parte ' + s.categoria + '" data-serv="' + s.id + '" role="button" tabindex="0"><div class="linha">' + A.seloCategoria(s.categoria) + A.seloStatus(s.status) +
              '<span class="peq">' + (s.funcionario_id ? "👷 " + esc(nomeFunc(s.funcionario_id)) : '<span class="selo critico">sem funcionário</span>') + "</span>" +
              (s.data_prevista ? '<span class="dir peq mudo">📅 ' + A.dataSimples(s.data_prevista) + "</span>" : "") + "</div>" +
              (s.descricao ? '<div class="peq" style="margin-top:4px;white-space:pre-wrap">' + esc(s.descricao.length > 220 ? s.descricao.slice(0, 220) + "…" : s.descricao) + "</div>" : "") +
              "</div>";
          }).join("") + "</div>";
      }).join("");
      $$("[data-serv]", l).forEach(function (d) {
        d.onclick = function () { abrirServico(d.dataset.serv); };
        d.onkeydown = function (ev) { if (ev.key === "Enter") abrirServico(d.dataset.serv); };
      });
      $$("[data-parte]", l).forEach(function (b) { b.onclick = function () { novoServico(b.dataset.parte); }; });
      $$("[data-obra]", l).forEach(function (b) { b.onclick = function () { editarObra(b.dataset.obra); }; });
      $$("[data-orc-obra]", l).forEach(function (b) { b.onclick = function () { orcamentoDaObra(b.dataset.orcObra); }; });
    }
    listar();
  }

  function msgServico(s) {
    var o = porId(S.obras, s.obra_id), f = porId(S.func, s.funcionario_id);
    var t = "*AGE Elétrica e Pintura*\nServiço de " + (A.CATEG[s.categoria].icone + " *" + A.CATEG[s.categoria].nome.toUpperCase()) + "*\n\n" +
      "Cliente: " + o.cliente + "\n" + (o.endereco ? "Endereço: " + o.endereco + "\n" : "") + (o.telefone ? "Telefone: " + o.telefone + "\n" : "") +
      (s.data_prevista ? "Data: " + A.dataSimples(s.data_prevista) + "\n" : "") + (s.descricao ? "\nO que fazer:\n" + s.descricao + "\n" : "");
    if (f) t += "\nRegistre a chegada, as fotos do serviço e a saída pelo seu link:\n" + linkFunc(f);
    return t;
  }
  function botaoZap(s) {
    var f = porId(S.func, s.funcionario_id);
    if (!f) return "";
    if (!f.telefone) return '<span class="mudo peq">Cadastre o telefone de ' + esc(f.nome) + " para avisar pelo WhatsApp.</span>";
    return '<a class="botao zap" target="_blank" rel="noopener" href="' + esc(A.linkZap(f.telefone, msgServico(s))) + '">📲 Avisar ' + esc(f.nome.split(" ")[0]) + " no WhatsApp</a>";
  }

  function formParte(cat, rotulo) {
    return '<div class="cartao" style="margin:10px 0 0;border-left:4px solid var(--' + cat + ')">' +
      '<label class="marca-linha" style="margin:0"><input type="checkbox" id="ns-' + cat + '"> ' + rotulo + "</label>" +
      '<div id="ns-' + cat + '-campos" class="oculto"><div class="duas"><div><label for="ns-' + cat + '-func">Funcionário</label><select id="ns-' + cat + '-func">' + opcoesFunc(cat, null) + "</select></div>" +
      '<div><label for="ns-' + cat + '-data">Data prevista</label><input type="date" id="ns-' + cat + '-data"></div></div>' +
      '<label for="ns-' + cat + '-desc">O que fazer</label><textarea id="ns-' + cat + '-desc" rows="3"></textarea></div></div>';
  }

  function novoServico(obraId) {
    var obra = obraId ? porId(S.obras, obraId) : null;
    var j = A.janela(
      (obra ? '<div class="cartao" style="margin:0"><b>' + esc(obra.cliente) + "</b><div class=\"peq mudo\">" + esc(obra.endereco || "") + "</div></div>" :
        '<label for="ns-cli">Cliente *</label><input id="ns-cli" maxlength="200" required>' +
        '<div class="duas"><div><label for="ns-tel">Telefone do cliente</label><input id="ns-tel" type="tel" maxlength="40"></div>' +
        '<div><label for="ns-end">Endereço</label><input id="ns-end" maxlength="300"></div></div>' +
        '<label for="ns-obs">Observações (o funcionário vê)</label><textarea id="ns-obs" rows="2" placeholder="Ex.: chave com o porteiro, cachorro no quintal"></textarea>') +
      '<p class="peq mudo" style="margin:12px 0 0">Marque as partes do serviço. Cada parte vai para o funcionário daquela área.</p>' +
      formParte("eletrica", "⚡ Parte ELÉTRICA") + formParte("pintura", "🖌️ Parte PINTURA") +
      '<div id="ns-erro"></div><div class="acoes"><button class="prim" id="ns-salvar">Salvar serviço</button></div>',
      { titulo: obra ? "Nova parte do serviço" : "Novo serviço", fixa: true });
    var el = j.el;
    ["eletrica", "pintura"].forEach(function (cat) {
      $("#ns-" + cat, el).onchange = function () { $("#ns-" + cat + "-campos", el).classList.toggle("oculto", !this.checked); };
    });
    $("#ns-salvar", el).onclick = function () {
      var b = this, erro = $("#ns-erro", el);
      var cats = ["eletrica", "pintura"].filter(function (cat) { return $("#ns-" + cat, el).checked; });
      if (!obra && !val(el, "#ns-cli")) { erro.innerHTML = '<div class="aviso erro">Informe o cliente.</div>'; return; }
      if (!cats.length) { erro.innerHTML = '<div class="aviso erro">Marque a parte elétrica, a de pintura ou as duas.</div>'; return; }
      A.ocupado(b, true, "Salvando...");
      var pObra = obra ? Promise.resolve(obra) : q(sb.from("obras").insert({
        cliente: val(el, "#ns-cli"), telefone: nulo(val(el, "#ns-tel")), endereco: nulo(val(el, "#ns-end")), observacoes: nulo(val(el, "#ns-obs"))
      }).select().single()).then(function (o) { S.obras.unshift(o); obra = o; return o; });
      pObra.then(function (o) {
        return q(sb.from("servicos").insert(cats.map(function (cat) {
          return { obra_id: o.id, categoria: cat, funcionario_id: nulo(val(el, "#ns-" + cat + "-func")),
            data_prevista: nulo(val(el, "#ns-" + cat + "-data")), descricao: nulo(val(el, "#ns-" + cat + "-desc")) };
        })).select());
      }).then(function (novos) {
        novos.forEach(function (s) { S.serv.unshift(s); });
        j.fechar();
        A.avisar("Serviço salvo", "ok");
        rota();
        var zaps = novos.map(botaoZap).filter(Boolean);
        if (zaps.length) A.janela("<p>Avise a equipe:</p>" + zaps.map(function (z) { return '<div class="acoes">' + z + "</div>"; }).join(""), { titulo: "Serviço salvo" });
      }).catch(function (e) {
        // se a obra foi criada e as partes falharam, a próxima tentativa usa a mesma obra
        A.ocupado(b, false);
        erro.innerHTML = '<div class="aviso erro">' + esc(A.msgErro(e)) + "</div>";
      });
    };
  }

  function editarObra(id) {
    var o = porId(S.obras, id);
    var j = A.janela('<label for="eo-cli">Cliente *</label><input id="eo-cli" maxlength="200" value="' + esc(o.cliente) + '">' +
      '<div class="duas"><div><label for="eo-tel">Telefone</label><input id="eo-tel" type="tel" maxlength="40" value="' + esc(o.telefone || "") + '"></div>' +
      '<div><label for="eo-end">Endereço</label><input id="eo-end" maxlength="300" value="' + esc(o.endereco || "") + '"></div></div>' +
      '<label for="eo-obs">Observações (o funcionário vê)</label><textarea id="eo-obs" rows="3">' + esc(o.observacoes || "") + "</textarea>" +
      '<div class="acoes"><button class="prim" id="eo-salvar">Salvar</button><button class="perigo" id="eo-apagar">Apagar cliente e partes</button></div>',
      { titulo: "Cliente / obra" });
    var el = j.el;
    $("#eo-salvar", el).onclick = function () {
      if (!val(el, "#eo-cli")) { A.avisar("Informe o cliente.", "erro"); return; }
      var b = this; A.ocupado(b, true, "Salvando...");
      q(sb.from("obras").update({ cliente: val(el, "#eo-cli"), telefone: nulo(val(el, "#eo-tel")), endereco: nulo(val(el, "#eo-end")), observacoes: nulo(val(el, "#eo-obs")) })
        .eq("id", id).select().single()).then(function (n) { trocar(S.obras, n); j.fechar(); A.avisar("Salvo", "ok"); rota(); })
        .catch(function (e) { A.ocupado(b, false); falhou(e); });
    };
    $("#eo-apagar", el).onclick = function () {
      if (!A.confirmar("Apagar " + o.cliente + " e todas as partes do serviço? Os registros de ponto e as fotos continuam guardados.")) return;
      q(sb.from("obras").delete().eq("id", id)).then(function () {
        S.serv = S.serv.filter(function (s) { return s.obra_id !== id; });
        tirar(S.obras, id); j.fechar(); A.avisar("Apagado", "ok"); rota();
      }).catch(falhou);
    };
  }

  function abrirServico(id) {
    var s = porId(S.serv, id), o = porId(S.obras, s.obra_id);
    var j = A.janela(
      '<div class="linha">' + A.seloCategoria(s.categoria) + A.seloStatus(s.status) + '<span class="dir mudo peq">criado ' + A.data(s.criado_em) + "</span></div>" +
      "<h3 style=\"margin-top:8px\">" + esc(o.cliente) + "</h3>" +
      (o.endereco ? '<div class="peq"><a href="' + A.linkEndereco(o.endereco) + '" target="_blank" rel="noopener">📍 ' + esc(o.endereco) + "</a></div>" : "") +
      '<div class="duas"><div><label for="es-func">Funcionário</label><select id="es-func">' + opcoesFunc(s.categoria, s.funcionario_id) + "</select></div>" +
      '<div><label for="es-data">Data prevista</label><input type="date" id="es-data" value="' + esc(s.data_prevista || "") + '"></div></div>' +
      '<label for="es-st">Situação</label><select id="es-st">' + Object.keys(A.STATUS).map(function (k) {
        return '<option value="' + k + '"' + (k === s.status ? " selected" : "") + ">" + A.STATUS[k] + "</option>";
      }).join("") + "</select>" +
      '<label for="es-desc">O que fazer</label><textarea id="es-desc" rows="4">' + esc(s.descricao || "") + "</textarea>" +
      '<div class="acoes"><button class="prim" id="es-salvar">Salvar</button><span id="es-zap">' + botaoZap(s) + '</span><button class="perigo" id="es-apagar">Apagar parte</button></div>' +
      '<hr class="sep"><h3>Registros de ponto neste serviço</h3><div id="es-pontos">' + carregando() + "</div>" +
      '<hr class="sep"><h3>Relatórios</h3><div id="es-rels"></div>',
      { titulo: "Serviço de " + A.CATEG[s.categoria].nome, larga: true });
    var el = j.el;

    var rels = S.rel.filter(function (r) { return r.servico_id === id; });
    $("#es-rels", el).innerHTML = rels.length ? rels.map(htmlCartaoRel).join("") : '<div class="mudo peq">Nenhum relatório ainda.</div>';
    $$("[data-rel]", el).forEach(function (d) { d.onclick = function () { abrirRelatorio(d.dataset.rel); }; });

    q(sb.from("pontos").select("*").eq("servico_id", id).order("criado_em")).then(function (pts) {
      pts.forEach(registrarInfoPonto);
      $("#es-pontos", el).innerHTML = pts.length ? '<div class="fotos">' + pts.map(function (p) {
        return htmlFoto(p.foto, A.TIPO_PONTO[p.tipo] + " " + A.data(p.criado_em).slice(0, 5) + " " + A.hora(p.criado_em));
      }).join("") + "</div>" : '<div class="mudo peq">Nenhum registro ainda.</div>';
      hidratarFotos($("#es-pontos", el));
    }).catch(function (e) { $("#es-pontos", el).innerHTML = '<div class="aviso erro">' + esc(A.msgErro(e)) + "</div>"; });

    $("#es-salvar", el).onclick = function () {
      var b = this, st = $("#es-st", el).value;
      var dados = { funcionario_id: nulo($("#es-func", el).value), data_prevista: nulo($("#es-data", el).value), status: st, descricao: nulo(val(el, "#es-desc")) };
      if (st === "concluido" && s.status !== "concluido") dados.concluido_em = new Date().toISOString();
      if (st !== "concluido") dados.concluido_em = null;
      var trocouFunc = dados.funcionario_id && dados.funcionario_id !== s.funcionario_id;
      A.ocupado(b, true, "Salvando...");
      q(sb.from("servicos").update(dados).eq("id", id).select().single()).then(function (n) {
        trocar(S.serv, n); s = n;
        A.ocupado(b, false);
        A.avisar("Salvo", "ok");
        $("#es-zap", el).innerHTML = botaoZap(n);
        if (trocouFunc) A.avisar("Avise o novo funcionário pelo botão do WhatsApp.");
        rota();
      }).catch(function (e) { A.ocupado(b, false); falhou(e); });
    };
    $("#es-apagar", el).onclick = function () {
      if (!A.confirmar("Apagar esta parte do serviço? Os registros de ponto e relatórios continuam guardados.")) return;
      q(sb.from("servicos").delete().eq("id", id)).then(function () { tirar(S.serv, id); j.fechar(); A.avisar("Apagado", "ok"); rota(); }).catch(falhou);
    };
  }

  // =================================================================
  // PONTO (cartão de ponto com fotos e GPS)
  // =================================================================
  function verPonto(c) {
    if (!filtroPonto) {
      var hoje = new Date(), seg = new Date(hoje);
      seg.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7));
      filtroPonto = { func: "", de: A.isoLocal(seg), ate: A.isoLocal(hoje) };
    }
    var F = filtroPonto;
    c.innerHTML = '<div class="cab-secao"><h2>Cartão de ponto</h2><button id="bp-csv">⬇ Planilha (CSV)</button></div>' +
      '<div class="filtros"><select id="fp-func" aria-label="Funcionário"><option value="">Todos os funcionários</option>' +
      S.func.map(function (f) { return '<option value="' + f.id + '">' + esc(f.nome) + "</option>"; }).join("") + "</select>" +
      '<input type="date" id="fp-de" aria-label="De"><input type="date" id="fp-ate" aria-label="Até"></div><div id="lista-ponto">' + carregando() + "</div>";
    $("#fp-func").value = F.func; $("#fp-de").value = F.de; $("#fp-ate").value = F.ate;
    ["#fp-func", "#fp-de", "#fp-ate"].forEach(function (s) {
      $(s).onchange = function () { F.func = $("#fp-func").value; F.de = $("#fp-de").value; F.ate = $("#fp-ate").value; carregar(); };
    });
    var dias = [];
    $("#bp-csv").onclick = function () { baixarCsv(dias); };

    function carregar() {
      var l = $("#lista-ponto");
      if (!F.de || !F.ate || F.de > F.ate) { l.innerHTML = '<div class="aviso">Escolha um período válido.</div>'; return; }
      l.innerHTML = carregando();
      var ini = new Date(F.de + "T00:00:00"), fim = new Date(F.ate + "T00:00:00");
      fim.setDate(fim.getDate() + 1);
      var cons = sb.from("pontos").select("*").gte("criado_em", ini.toISOString()).lt("criado_em", fim.toISOString()).order("criado_em").limit(5000);
      if (F.func) cons = cons.eq("funcionario_id", F.func);
      q(cons).then(function (pts) {
        pts.forEach(registrarInfoPonto);
        var grupos = {};
        pts.forEach(function (p) {
          var k = A.isoLocal(new Date(p.criado_em)) + "|" + p.funcionario_id;
          (grupos[k] = grupos[k] || []).push(p);
        });
        var hojeIso = A.isoLocal(new Date());
        dias = Object.keys(grupos).map(function (k) {
          var ps = grupos[k], dia = k.split("|")[0];
          var hr = calcHoras(ps, dia === hojeIso ? Date.now() : null);
          var ch = ps.filter(function (p) { return p.tipo === "chegada"; }), sa = ps.filter(function (p) { return p.tipo === "saida"; });
          return { dia: dia, func: ps[0].funcionario_id, pontos: ps, horas: hr, chegada: ch[0], saida: sa[sa.length - 1], semGps: ps.filter(function (p) { return p.lat === null; }).length };
        }).sort(function (a, b) { return a.dia < b.dia ? 1 : a.dia > b.dia ? -1 : nomeFunc(a.func).localeCompare(nomeFunc(b.func)); });

        if (!dias.length) { l.innerHTML = '<div class="cartao vazio">Nenhum registro neste período.</div>'; return; }
        var tot = {};
        dias.forEach(function (d) { var t = tot[d.func] = tot[d.func] || { ms: 0, dias: 0 }; t.ms += d.horas.total; t.dias++; });
        var h = '<div class="cartao"><h3>Resumo do período</h3><div class="tabela-caixa"><table><thead><tr><th>Funcionário</th><th class="num">Dias</th><th class="num">Horas</th></tr></thead><tbody>' +
          Object.keys(tot).sort(function (a, b) { return nomeFunc(a).localeCompare(nomeFunc(b)); }).map(function (fid) {
            return "<tr><td>" + esc(nomeFunc(fid)) + '</td><td class="num">' + tot[fid].dias + '</td><td class="num">' + A.duracao(tot[fid].ms) + "</td></tr>";
          }).join("") + "</tbody></table></div></div>";
        var diaAtual = null;
        dias.forEach(function (d) {
          if (d.dia !== diaAtual) {
            diaAtual = d.dia;
            var dt = new Date(d.dia + "T12:00:00");
            h += '<h3 style="margin:16px 0 8px">' + esc(dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })) + "</h3>";
          }
          h += '<div class="cartao"><div class="linha"><b>' + esc(nomeFunc(d.func)) + "</b>" +
            '<span class="peq">Chegada <b>' + (d.chegada ? A.hora(d.chegada.criado_em) : "—") + "</b> · Saída <b>" + (d.saida ? A.hora(d.saida.criado_em) : "—") + "</b></span>" +
            (d.horas.emAberto ? '<span class="selo atencao">' + (d.dia === hojeIso ? "ainda trabalhando" : "sem saída") + "</span>" : "") +
            (d.semGps ? '<span class="selo critico">' + d.semGps + " sem GPS</span>" : "") +
            '<span class="dir forte">' + A.duracao(d.horas.total) + "</span></div>" +
            '<div class="fotos">' + d.pontos.map(function (p) { return htmlFoto(p.foto, A.TIPO_PONTO[p.tipo] + " " + A.hora(p.criado_em)); }).join("") + "</div></div>";
        });
        l.innerHTML = h;
        hidratarFotos(l);
      }).catch(function (e) { l.innerHTML = '<div class="aviso erro">' + esc(A.msgErro(e)) + "</div>"; });
    }
    carregar();
  }

  function baixarCsv(dias) {
    if (!dias || !dias.length) { A.avisar("Nada para exportar neste período."); return; }
    var cel = function (t) { t = String(t === null || t === undefined ? "" : t); return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    var linhas = [["Data", "Funcionário", "Primeira chegada", "Última saída", "Horas trabalhadas", "Registros", "Sem GPS", "Situação"]];
    dias.slice().sort(function (a, b) { return a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : nomeFunc(a.func).localeCompare(nomeFunc(b.func)); }).forEach(function (d) {
      linhas.push([A.dataSimples(d.dia), nomeFunc(d.func), d.chegada ? A.hora(d.chegada.criado_em) : "", d.saida ? A.hora(d.saida.criado_em) : "",
        A.duracao(d.horas.total), d.pontos.length, d.semGps, d.horas.emAberto ? "sem saída" : "ok"]);
    });
    var csv = "﻿" + linhas.map(function (l) { return l.map(cel).join(";"); }).join("\r\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "ponto-" + filtroPonto.de + "-a-" + filtroPonto.ate + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  // =================================================================
  // RELATÓRIOS (enviados pelos funcionários)
  // =================================================================
  function htmlCartaoRel(r) {
    var s = porId(S.serv, r.servico_id), o = s ? porId(S.obras, s.obra_id) : null;
    return '<div class="cartao clic" data-rel="' + r.id + '"' + (r.lido ? "" : ' style="border-left:4px solid var(--critico)"') + '><div class="linha">' +
      (s ? A.seloCategoria(s.categoria) : "") + (r.lido ? "" : '<span class="selo critico">novo</span>') + (r.concluido ? '<span class="selo bom">concluído</span>' : "") +
      '<span class="dir mudo peq">' + A.dataHora(r.criado_em) + "</span></div>" +
      '<div style="margin-top:6px"><b>' + esc(r.tipo_servico || "Relatório") + "</b> · " + esc(o ? o.cliente : "serviço apagado") + "</div>" +
      '<div class="peq mudo">👷 ' + esc(nomeFunc(r.funcionario_id)) + " · " + (r.materiais || []).length + " materiais · " + (r.fotos || []).length + " fotos</div></div>";
  }

  function verRelatorios(c) {
    var lista = S.rel.filter(function (r) { return filtroRel === "todos" || !r.lido; });
    c.innerHTML = '<div class="cab-secao"><h2>Relatórios da equipe</h2><select id="fr-filtro" style="width:auto" aria-label="Filtro">' +
      '<option value="nao_lidos">Novos</option><option value="todos">Todos</option></select></div>' +
      (lista.length ? lista.map(htmlCartaoRel).join("") : '<div class="cartao vazio">' + (filtroRel === "todos" ? "Nenhum relatório ainda." : "Nenhum relatório novo.") + "</div>");
    $("#fr-filtro").value = filtroRel;
    $("#fr-filtro").onchange = function () { filtroRel = this.value; verRelatorios(c); };
    $$("[data-rel]", c).forEach(function (d) { d.onclick = function () { abrirRelatorio(d.dataset.rel); }; });
  }

  function abrirRelatorio(id) {
    var r = porId(S.rel, id), s = porId(S.serv, r.servico_id), o = s ? porId(S.obras, s.obra_id) : null;
    var mats = r.materiais || [];
    var j = A.janela(
      '<div class="linha">' + (s ? A.seloCategoria(s.categoria) : "") + (r.concluido ? '<span class="selo bom">funcionário marcou como concluído</span>' : "") +
      '<span class="dir mudo peq">' + A.dataHora(r.criado_em) + "</span></div>" +
      '<p><b>Cliente:</b> ' + esc(o ? o.cliente : "serviço apagado") + (o && o.endereco ? " · " + esc(o.endereco) : "") + "<br><b>Funcionário:</b> " + esc(nomeFunc(r.funcionario_id)) +
      "<br><b>Tipo de serviço:</b> " + esc(r.tipo_servico || "—") + "</p>" +
      (r.descricao ? '<div class="cartao" style="white-space:pre-wrap">' + esc(r.descricao) + "</div>" : "") +
      "<h3>Materiais pedidos</h3>" + (mats.length ? '<div class="tabela-caixa"><table><thead><tr><th>Material</th><th class="num">Qtd</th><th>Un</th></tr></thead><tbody>' +
        mats.map(function (m) { return "<tr><td>" + esc(m.item) + '</td><td class="num">' + A.numero(m.qtd) + "</td><td>" + esc(m.un) + "</td></tr>"; }).join("") +
        "</tbody></table></div>" : '<p class="mudo peq">Nenhum material.</p>') +
      ((r.fotos || []).length ? '<h3 style="margin-top:12px">Fotos</h3><div class="fotos">' + r.fotos.map(function (f) { return htmlFoto(f, ""); }).join("") + "</div>" : "") +
      '<div class="acoes"><button class="prim" id="er-orc">💲 Gerar orçamento</button>' + (s ? '<button id="er-serv">Abrir serviço</button>' : "") +
      '<button id="er-lido">' + (r.lido ? "Marcar como novo" : "Marcar como lido") + "</button></div>",
      { titulo: "Relatório", larga: true, aoFechar: function () { if (location.hash.slice(1) === "relatorios") rota(); } });
    var el = j.el;
    (r.fotos || []).forEach(function (f) { infoFoto[f] = "Foto do relatório · " + esc(nomeFunc(r.funcionario_id)) + " · " + A.dataHora(r.criado_em); });
    hidratarFotos(el);
    function marcar(lido) {
      return q(sb.from("relatorios").update({ lido: lido }).eq("id", id).select().single()).then(function (n) { trocar(S.rel, n); r = n; });
    }
    if (!r.lido) marcar(true).then(function () { $("#er-lido", el).textContent = "Marcar como novo"; desenharAbas(location.hash.slice(1) || "hoje"); }).catch(falhou);
    $("#er-lido", el).onclick = function () { marcar(!r.lido).then(function () { j.fechar(); rota(); }).catch(falhou); };
    if ($("#er-serv", el)) $("#er-serv", el).onclick = function () { j.fechar(); abrirServico(s.id); };
    $("#er-orc", el).onclick = function () {
      j.fechar();
      var itens = mats.map(function (m) { return { tipo: "material", descricao: m.item, qtd: Number(m.qtd) || 1, un: m.un || "un", valor: 0 }; });
      itens.push({ tipo: "servico", descricao: (r.tipo_servico || "Mão de obra") + (s ? " (" + A.CATEG[s.categoria].nome.toLowerCase() + ")" : ""), qtd: 1, un: "serv", valor: 0 });
      editarOrcamento(null, {
        obra_id: o ? o.id : null, relatorio_id: r.id, cliente: o ? o.cliente : "", telefone: o ? o.telefone : "", endereco: o ? o.endereco : "",
        categoria: s ? s.categoria : "", itens: itens, observacoes: r.descricao || ""
      });
    };
  }

  // =================================================================
  // ORÇAMENTOS (só o dono vê)
  // =================================================================
  function verOrcamentos(c) {
    c.innerHTML = '<div class="cab-secao"><h2>Orçamentos</h2><button class="prim" id="bo-novo">+ Novo orçamento</button></div>' +
      '<p class="mudo peq" style="margin-top:-6px">Só você vê esta área. Os funcionários nunca veem valores.</p>' +
      (S.orc.length ? '<div class="cartao tabela-caixa"><table><thead><tr><th>Nº</th><th>Cliente</th><th class="esconde-cel">Área</th><th>Situação</th><th class="num">Total</th><th class="esconde-cel">Data</th></tr></thead><tbody>' +
        S.orc.map(function (o) {
          return '<tr class="clic" data-orc="' + o.id + '" style="cursor:pointer"><td>' + String(o.numero).padStart(4, "0") + "</td><td>" + esc(o.cliente) + '</td><td class="esconde-cel">' +
            esc(CAT_ORC[o.categoria] || "") + '</td><td><span class="selo ' + COR_ORC[o.status] + '">' + STATUS_ORC[o.status] + '</span></td><td class="num">' + A.dinheiro(o.total) +
            '</td><td class="esconde-cel">' + A.data(o.criado_em) + "</td></tr>";
        }).join("") + "</tbody></table></div>" : '<div class="cartao vazio">Nenhum orçamento ainda. Crie um aqui ou a partir do relatório de um funcionário.</div>');
    $("#bo-novo").onclick = function () { editarOrcamento(null, {}); };
    $$("[data-orc]", c).forEach(function (t) { t.onclick = function () { editarOrcamento(porId(S.orc, t.dataset.orc)); }; });
  }

  function orcamentoDaObra(obraId) {
    var o = porId(S.obras, obraId);
    var cats = S.serv.filter(function (s) { return s.obra_id === obraId; }).map(function (s) { return s.categoria; });
    var cat = cats.indexOf("eletrica") >= 0 && cats.indexOf("pintura") >= 0 ? "eletrica_pintura" : cats[0] || "";
    editarOrcamento(null, { obra_id: o.id, cliente: o.cliente, telefone: o.telefone, endereco: o.endereco, categoria: cat });
  }

  function calcOrc(M) {
    var mat = 0, serv = 0;
    M.itens.forEach(function (i) { var st = (Number(i.qtd) || 0) * (Number(i.valor) || 0); if (i.tipo === "material") mat += st; else serv += st; });
    var bruto = mat + serv, total = Math.max(0, bruto - (Number(M.desconto) || 0));
    return { mat: Math.round(mat * 100) / 100, serv: Math.round(serv * 100) / 100, bruto: Math.round(bruto * 100) / 100, total: Math.round(total * 100) / 100 };
  }

  function editarOrcamento(orc, base) {
    var M = orc ? JSON.parse(JSON.stringify(orc)) : Object.assign({
      id: null, numero: null, obra_id: null, relatorio_id: null, cliente: "", telefone: "", endereco: "", categoria: "", itens: [],
      desconto: 0, pagamento: "50% na aprovação e 50% na entrega do serviço", prazo: "", validade_dias: 15, observacoes: "", status: "rascunho"
    }, base || {});
    M.itens = (M.itens || []).map(function (i) { return Object.assign({ tipo: "material", descricao: "", qtd: 1, un: "un", valor: 0 }, i); });
    if (!M.itens.length) M.itens.push({ tipo: "servico", descricao: "Mão de obra", qtd: 1, un: "serv", valor: 0 });

    var j = A.janela(
      '<div class="duas"><div><label for="eo2-cli">Cliente *</label><input id="eo2-cli" maxlength="200"></div><div><label for="eo2-tel">Telefone</label><input id="eo2-tel" type="tel" maxlength="40"></div></div>' +
      '<div class="duas"><div><label for="eo2-end">Endereço</label><input id="eo2-end" maxlength="300"></div><div><label for="eo2-cat">Área</label><select id="eo2-cat"><option value="">—</option>' +
      Object.keys(CAT_ORC).map(function (k) { return '<option value="' + k + '">' + CAT_ORC[k] + "</option>"; }).join("") + "</select></div></div>" +
      '<h3 style="margin-top:14px">Itens</h3><div id="eo2-itens"></div>' +
      '<div class="linha" style="margin-top:8px"><button class="peq" id="eo2-mais-mat">+ Material</button><button class="peq" id="eo2-mais-serv">+ Mão de obra / serviço</button></div>' +
      '<div class="duas"><div><label for="eo2-desc">Desconto (R$)</label><input id="eo2-desc" inputmode="decimal"></div><div><label for="eo2-val">Validade (dias)</label><input id="eo2-val" type="number" min="1" max="365"></div></div>' +
      '<div class="cartao" style="margin-top:10px" id="eo2-totais"></div>' +
      '<div class="duas"><div><label for="eo2-pag">Forma de pagamento</label><input id="eo2-pag" maxlength="300"></div><div><label for="eo2-prazo">Prazo de execução</label><input id="eo2-prazo" maxlength="200" placeholder="Ex.: 5 dias úteis"></div></div>' +
      '<label for="eo2-obs">Observações</label><textarea id="eo2-obs" rows="3"></textarea>' +
      '<label for="eo2-st">Situação</label><select id="eo2-st">' + Object.keys(STATUS_ORC).map(function (k) { return '<option value="' + k + '">' + STATUS_ORC[k] + "</option>"; }).join("") + "</select>" +
      '<div class="acoes"><button class="prim" id="eo2-salvar">Salvar</button><button id="eo2-imprimir">🖨 Imprimir / PDF</button><button class="zap" id="eo2-zap">📲 WhatsApp do cliente</button>' +
      (M.id ? '<button class="perigo" id="eo2-apagar">Apagar</button>' : "") + "</div>",
      { titulo: M.numero ? "Orçamento nº " + String(M.numero).padStart(4, "0") : "Novo orçamento", larga: true, fixa: true });
    var el = j.el;
    $("#eo2-cli", el).value = M.cliente || ""; $("#eo2-tel", el).value = M.telefone || ""; $("#eo2-end", el).value = M.endereco || "";
    $("#eo2-cat", el).value = M.categoria || ""; $("#eo2-desc", el).value = M.desconto ? A.numero(M.desconto) : "";
    $("#eo2-val", el).value = M.validade_dias || 15; $("#eo2-pag", el).value = M.pagamento || ""; $("#eo2-prazo", el).value = M.prazo || "";
    $("#eo2-obs", el).value = M.observacoes || ""; $("#eo2-st", el).value = M.status;

    function desenharItens() {
      $("#eo2-itens", el).innerHTML = M.itens.map(function (i, n) {
        return '<div class="item-orc" data-i="' + n + '"><div class="l1"><select class="i-tipo" aria-label="Tipo"><option value="material">Material</option><option value="servico">Mão de obra</option></select>' +
          '<input class="i-desc" maxlength="300" placeholder="Descrição" aria-label="Descrição"></div>' +
          '<div class="l2"><label>Qtd<input class="i-qtd" inputmode="decimal"></label>' +
          '<label>Un<select class="i-un">' + UNIDADES.concat(UNIDADES.indexOf(i.un) < 0 && i.un ? [i.un] : []).map(function (u) { return "<option>" + esc(u) + "</option>"; }).join("") + "</select></label>" +
          '<label>Valor un. (R$)<input class="i-valor" inputmode="decimal"></label><div class="i-sub forte"></div>' +
          '<button class="peq i-tirar" aria-label="Remover item">✕</button></div></div>';
      }).join("");
      $$("#eo2-itens .item-orc", el).forEach(function (tr) {
        var i = M.itens[Number(tr.dataset.i)];
        $(".i-tipo", tr).value = i.tipo; $(".i-desc", tr).value = i.descricao; $(".i-qtd", tr).value = A.numero(i.qtd, 3);
        $(".i-un", tr).value = i.un; $(".i-valor", tr).value = i.valor ? A.numero(i.valor) : "";
        tr.oninput = tr.onchange = function () {
          i.tipo = $(".i-tipo", tr).value; i.descricao = $(".i-desc", tr).value; i.qtd = A.lerNumero($(".i-qtd", tr).value);
          i.un = $(".i-un", tr).value; i.valor = A.lerNumero($(".i-valor", tr).value);
          totais();
        };
        $(".i-tirar", tr).onclick = function () { M.itens.splice(Number(tr.dataset.i), 1); desenharItens(); };
      });
      totais();
    }
    function lerCampos() {
      M.cliente = val(el, "#eo2-cli"); M.telefone = val(el, "#eo2-tel"); M.endereco = val(el, "#eo2-end"); M.categoria = $("#eo2-cat", el).value;
      M.desconto = A.lerNumero($("#eo2-desc", el).value); M.validade_dias = Math.max(1, parseInt($("#eo2-val", el).value, 10) || 15);
      M.pagamento = val(el, "#eo2-pag"); M.prazo = val(el, "#eo2-prazo"); M.observacoes = val(el, "#eo2-obs"); M.status = $("#eo2-st", el).value;
    }
    function totais() {
      lerCampos();
      M.itens.forEach(function (i, n) { var c = $('#eo2-itens .item-orc[data-i="' + n + '"] .i-sub', el); if (c) c.textContent = A.dinheiro((Number(i.qtd) || 0) * (Number(i.valor) || 0)); });
      var t = calcOrc(M);
      $("#eo2-totais", el).innerHTML = '<div class="linha"><span>Materiais</span><span class="dir">' + A.dinheiro(t.mat) + "</span></div>" +
        '<div class="linha"><span>Mão de obra / serviços</span><span class="dir">' + A.dinheiro(t.serv) + "</span></div>" +
        (M.desconto ? '<div class="linha"><span>Desconto</span><span class="dir">− ' + A.dinheiro(M.desconto) + "</span></div>" : "") +
        '<div class="linha forte" style="font-size:18px;margin-top:4px"><span>Total</span><span class="dir">' + A.dinheiro(t.total) + "</span></div>";
    }
    $("#eo2-desc", el).oninput = totais;
    $("#eo2-mais-mat", el).onclick = function () { M.itens.push({ tipo: "material", descricao: "", qtd: 1, un: "un", valor: 0 }); desenharItens(); focarUltimo(); };
    $("#eo2-mais-serv", el).onclick = function () { M.itens.push({ tipo: "servico", descricao: "", qtd: 1, un: "serv", valor: 0 }); desenharItens(); focarUltimo(); };
    function focarUltimo() { var x = $$(".i-desc", el); if (x.length) x[x.length - 1].focus(); }
    desenharItens();

    function salvar() {
      lerCampos();
      if (!M.cliente) return Promise.reject(new Error("Informe o cliente."));
      var itens = M.itens.filter(function (i) { return i.descricao.trim(); }).map(function (i) {
        return { tipo: i.tipo, descricao: i.descricao.trim(), qtd: Number(i.qtd) || 0, un: i.un, valor: Math.round((Number(i.valor) || 0) * 100) / 100 };
      });
      var dados = { obra_id: M.obra_id, relatorio_id: M.relatorio_id, cliente: M.cliente, telefone: nulo(M.telefone), endereco: nulo(M.endereco), categoria: nulo(M.categoria),
        itens: itens, desconto: Math.round((M.desconto || 0) * 100) / 100, total: calcOrc({ itens: itens, desconto: M.desconto }).total,
        pagamento: nulo(M.pagamento), prazo: nulo(M.prazo), validade_dias: M.validade_dias, observacoes: nulo(M.observacoes), status: M.status };
      var p = M.id ? sb.from("orcamentos").update(dados).eq("id", M.id).select().single() : sb.from("orcamentos").insert(dados).select().single();
      return q(p).then(function (n) {
        trocar(S.orc, n);
        S.orc.sort(function (a, b) { return b.numero - a.numero; });
        M = Object.assign(M, n);
        desenharItens();
        var titulo = el.closest(".modal").querySelector(".cab h2");
        titulo.textContent = "Orçamento nº " + String(n.numero).padStart(4, "0");
        if (location.hash.slice(1) === "orcamentos") rota();
        return n;
      });
    }
    $("#eo2-salvar", el).onclick = function () {
      var b = this; A.ocupado(b, true, "Salvando...");
      salvar().then(function () { A.ocupado(b, false); A.avisar("Orçamento salvo", "ok"); }).catch(function (e) { A.ocupado(b, false); falhou(e); });
    };
    $("#eo2-imprimir", el).onclick = function () {
      var w = window.open("", "_blank");
      if (!w) { A.avisar("O navegador bloqueou a janela. Permita pop-ups para este site.", "erro"); return; }
      w.document.write('<p style="font-family:sans-serif">Preparando orçamento...</p>');
      salvar().then(function (n) { escreverImpressao(w, n); }).catch(function (e) { w.close(); falhou(e); });
    };
    $("#eo2-zap", el).onclick = function () {
      lerCampos();
      if (!M.telefone) { A.avisar("Informe o telefone do cliente.", "erro"); return; }
      var w = window.open("", "_blank");
      salvar().then(function (n) {
        var url = A.linkZap(n.telefone, textoOrcamento(n));
        if (w) w.location.href = url; else location.href = url;
      }).catch(function (e) { if (w) w.close(); falhou(e); });
    };
    if ($("#eo2-apagar", el)) $("#eo2-apagar", el).onclick = function () {
      if (!A.confirmar("Apagar este orçamento?")) return;
      q(sb.from("orcamentos").delete().eq("id", M.id)).then(function () { tirar(S.orc, M.id); j.fechar(); A.avisar("Apagado", "ok"); rota(); }).catch(falhou);
    };
  }

  function textoOrcamento(o) {
    var E = A.CFG.EMPRESA || {};
    var t = "*" + (E.nome || "AGE Elétrica e Pintura") + "*\nOrçamento nº " + String(o.numero).padStart(4, "0") + " — " + A.data(o.criado_em) + "\n\nCliente: " + o.cliente + "\n";
    if (o.endereco) t += "Local: " + o.endereco + "\n";
    t += "\n";
    o.itens.forEach(function (i) {
      t += "• " + i.descricao + " — " + A.numero(i.qtd, 3) + " " + i.un + " × " + A.dinheiro(i.valor) + " = " + A.dinheiro(i.qtd * i.valor) + "\n";
    });
    if (Number(o.desconto)) t += "\nDesconto: − " + A.dinheiro(o.desconto);
    t += "\n*Total: " + A.dinheiro(o.total) + "*\n";
    if (o.pagamento) t += "Pagamento: " + o.pagamento + "\n";
    if (o.prazo) t += "Prazo: " + o.prazo + "\n";
    t += "Validade: " + o.validade_dias + " dias";
    if (o.observacoes) t += "\n\n" + o.observacoes;
    return t;
  }

  function escreverImpressao(w, o) {
    var E = A.CFG.EMPRESA || {}, t = calcOrc(o);
    function bloco(tipo, titulo) {
      var itens = o.itens.filter(function (i) { return (tipo === "material") === (i.tipo === "material"); });
      if (!itens.length) return "";
      return "<h3>" + titulo + '</h3><table><thead><tr><th>Descrição</th><th class="n">Qtd</th><th>Un</th><th class="n">Valor un.</th><th class="n">Subtotal</th></tr></thead><tbody>' +
        itens.map(function (i) {
          return "<tr><td>" + esc(i.descricao) + '</td><td class="n">' + A.numero(i.qtd, 3) + "</td><td>" + esc(i.un) + '</td><td class="n">' + A.dinheiro(i.valor) +
            '</td><td class="n">' + A.dinheiro(i.qtd * i.valor) + "</td></tr>";
        }).join("") + "</tbody></table>";
    }
    var validade = new Date(o.criado_em); validade.setDate(validade.getDate() + Number(o.validade_dias || 15));
    var html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Orçamento ' +
      String(o.numero).padStart(4, "0") + " - " + esc(o.cliente) + "</title><style>" +
      "body{font:14px/1.45 Arial,Helvetica,sans-serif;color:#111;margin:0;padding:28px;max-width:800px;margin:0 auto}" +
      ".cab{display:flex;justify-content:space-between;gap:16px;border-bottom:3px solid #14325c;padding-bottom:12px}" +
      ".emp b{font-size:20px;color:#14325c}.num{text-align:right}.num b{font-size:18px}" +
      ".cli{background:#f3f5f8;border-radius:8px;padding:10px 12px;margin:16px 0}" +
      "h3{color:#14325c;margin:18px 0 6px;font-size:15px}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left}" +
      "th{font-size:12px;text-transform:uppercase;color:#555}.n{text-align:right;white-space:nowrap}" +
      ".tot{margin-left:auto;width:300px;margin-top:14px}.tot div{display:flex;justify-content:space-between;padding:3px 0}.tot .g{font-size:18px;font-weight:bold;border-top:2px solid #14325c;padding-top:6px}" +
      ".cond{margin-top:18px}.ass{margin-top:60px;display:flex;gap:40px}.ass div{flex:1;border-top:1px solid #333;text-align:center;padding-top:4px;font-size:12px}" +
      "@media print{body{padding:0}button{display:none}}button{padding:10px 16px;font-size:15px;margin:0 0 16px;cursor:pointer}</style></head><body>" +
      '<button onclick="window.print()">🖨 Imprimir / salvar PDF</button>' +
      '<div class="cab"><div class="emp"><b>' + esc(E.nome || "AGE Elétrica e Pintura") + "</b><br>" +
      [E.documento, E.telefone, E.email, E.endereco, E.cidade].filter(Boolean).map(esc).join("<br>") + "</div>" +
      '<div class="num"><b>ORÇAMENTO Nº ' + String(o.numero).padStart(4, "0") + "</b><br>Data: " + A.data(o.criado_em) + "<br>Válido até: " + A.data(validade) + "</div></div>" +
      '<div class="cli"><b>Cliente:</b> ' + esc(o.cliente) + (o.telefone ? " · " + esc(o.telefone) : "") + (o.endereco ? "<br><b>Local:</b> " + esc(o.endereco) : "") +
      (o.categoria ? "<br><b>Serviço:</b> " + esc(CAT_ORC[o.categoria] || o.categoria) : "") + "</div>" +
      bloco("material", "Materiais") + bloco("servico", "Mão de obra / serviços") +
      '<div class="tot"><div><span>Materiais</span><span>' + A.dinheiro(t.mat) + "</span></div><div><span>Mão de obra</span><span>" + A.dinheiro(t.serv) + "</span></div>" +
      (Number(o.desconto) ? "<div><span>Desconto</span><span>− " + A.dinheiro(o.desconto) + "</span></div>" : "") +
      '<div class="g"><span>Total</span><span>' + A.dinheiro(o.total) + "</span></div></div>" +
      '<div class="cond">' + (o.pagamento ? "<p><b>Forma de pagamento:</b> " + esc(o.pagamento) + "</p>" : "") + (o.prazo ? "<p><b>Prazo de execução:</b> " + esc(o.prazo) + "</p>" : "") +
      (o.observacoes ? '<p><b>Observações:</b><br><span style="white-space:pre-wrap">' + esc(o.observacoes) + "</span></p>" : "") + "</div>" +
      '<div class="ass"><div>' + esc(E.nome || "AGE Elétrica e Pintura") + "</div><div>Cliente — de acordo</div></div>" +
      "<script>setTimeout(function(){window.print()},400)<\/script></body></html>";
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  // =================================================================
  // EQUIPE (funcionários e links)
  // =================================================================
  function msgLink(f) {
    return "Olá, " + f.nome.split(" ")[0] + "! Este é o seu link do app da *AGE Elétrica e Pintura*.\n\n" +
      "Por ele você vê seus serviços, registra a CHEGADA, as FOTOS do serviço e a SAÍDA (com foto e GPS) e envia o relatório com os materiais.\n\n" +
      linkFunc(f) + "\n\nDica: abra o link no navegador e use \"Adicionar à tela inicial\". Não passe este link para ninguém.";
  }

  function verEquipe(c) {
    c.innerHTML = '<div class="cab-secao"><h2>Equipe</h2><button class="prim" id="be-novo">+ Novo funcionário</button></div>' +
      (S.func.length ? S.func.map(function (f) {
        return '<div class="cartao"' + (f.ativo ? "" : ' style="opacity:.6"') + '><div class="linha"><h3>' + esc(f.nome) + "</h3>" +
          '<span class="selo ' + (f.area === "ambos" ? "" : f.area) + '">' + esc(A.AREA[f.area]) + "</span>" + (f.ativo ? "" : '<span class="selo critico">desativado</span>') +
          '<span class="dir peq mudo">' + esc(f.telefone || "sem telefone") + "</span></div>" +
          (f.ativo ? '<div class="acoes"><button class="peq" data-copiar="' + f.id + '">🔗 Copiar link</button>' +
            (f.telefone ? '<a class="botao peq zap" target="_blank" rel="noopener" href="' + esc(A.linkZap(f.telefone, msgLink(f))) + '">📲 Enviar link</a>' : "") +
            '<button class="peq" data-editar="' + f.id + '">Editar</button></div>' : '<div class="acoes"><button class="peq" data-editar="' + f.id + '">Editar / reativar</button></div>') + "</div>";
      }).join("") : '<div class="cartao vazio">Cadastre o primeiro funcionário.</div>') +
      '<p class="mudo peq">Cada funcionário tem um link próprio e secreto. Se alguém perder o celular ou sair da empresa, use “Editar” → “Gerar novo link” ou desative: o link antigo para de funcionar na hora.</p>';
    $("#be-novo").onclick = function () { editarFunc(null); };
    $$("[data-copiar]", c).forEach(function (b) { b.onclick = function () { copiar(linkFunc(porId(S.func, b.dataset.copiar))); }; });
    $$("[data-editar]", c).forEach(function (b) { b.onclick = function () { editarFunc(b.dataset.editar); }; });
  }

  function editarFunc(id) {
    var f = id ? porId(S.func, id) : null;
    var j = A.janela('<label for="ef-nome">Nome *</label><input id="ef-nome" maxlength="120">' +
      '<label for="ef-tel">WhatsApp (com DDD)</label><input id="ef-tel" type="tel" maxlength="40" placeholder="(11) 91234-5678">' +
      '<label for="ef-area">Área</label><select id="ef-area"><option value="eletrica">Elétrica</option><option value="pintura">Pintura</option><option value="ambos">Elétrica e pintura</option></select>' +
      (f ? '<label class="marca-linha"><input type="checkbox" id="ef-ativo"> Ativo (pode usar o link)</label>' : "") +
      '<div class="acoes"><button class="prim" id="ef-salvar">Salvar</button>' +
      (f ? '<button id="ef-token">🔄 Gerar novo link</button><button class="perigo" id="ef-apagar">Apagar</button>' : "") + "</div>",
      { titulo: f ? "Editar funcionário" : "Novo funcionário" });
    var el = j.el;
    $("#ef-nome", el).value = f ? f.nome : ""; $("#ef-tel", el).value = f ? f.telefone || "" : ""; $("#ef-area", el).value = f ? f.area : "eletrica";
    if (f) $("#ef-ativo", el).checked = f.ativo;
    $("#ef-salvar", el).onclick = function () {
      var nome = val(el, "#ef-nome");
      if (!nome) { A.avisar("Informe o nome.", "erro"); return; }
      var b = this; A.ocupado(b, true, "Salvando...");
      var dados = { nome: nome, telefone: nulo(val(el, "#ef-tel")), area: $("#ef-area", el).value };
      if (f) dados.ativo = $("#ef-ativo", el).checked;
      var p = f ? sb.from("funcionarios").update(dados).eq("id", f.id).select().single() : sb.from("funcionarios").insert(dados).select().single();
      q(p).then(function (n) {
        trocar(S.func, n);
        S.func.sort(function (a, b2) { return a.nome.localeCompare(b2.nome); });
        j.fechar(); rota();
        if (!f) {
          A.janela('<p>Funcionário cadastrado. Envie o link pessoal para ' + esc(n.nome) + ":</p>" +
            '<div class="acoes">' + (n.telefone ? '<a class="botao zap" target="_blank" rel="noopener" href="' + esc(A.linkZap(n.telefone, msgLink(n))) + '">📲 Enviar no WhatsApp</a>' : "") +
            '<button id="ok-copiar">🔗 Copiar link</button></div>', { titulo: "Pronto" }).el.querySelector("#ok-copiar").onclick = function () { copiar(linkFunc(n)); };
        } else A.avisar("Salvo", "ok");
      }).catch(function (e) { A.ocupado(b, false); falhou(e); });
    };
    if (!f) return;
    $("#ef-token", el).onclick = function () {
      if (!A.confirmar("Gerar um novo link para " + f.nome + "? O link antigo para de funcionar e você precisa enviar o novo.")) return;
      q(sb.from("funcionarios").update({ token: novoToken() }).eq("id", f.id).select().single()).then(function (n) {
        trocar(S.func, n); j.fechar(); rota();
        A.janela('<p>Novo link criado. Envie para ' + esc(n.nome) + ":</p>" +
          '<div class="acoes">' + (n.telefone ? '<a class="botao zap" target="_blank" rel="noopener" href="' + esc(A.linkZap(n.telefone, msgLink(n))) + '">📲 Enviar no WhatsApp</a>' : "") +
          '<button id="ok-copiar">🔗 Copiar link</button></div>', { titulo: "Novo link" }).el.querySelector("#ok-copiar").onclick = function () { copiar(linkFunc(n)); };
      }).catch(falhou);
    };
    $("#ef-apagar", el).onclick = function () {
      if (!A.confirmar("Apagar " + f.nome + "? Só é possível se ainda não houver registros de ponto ou relatórios dele.")) return;
      q(sb.from("funcionarios").delete().eq("id", f.id)).then(function () {
        tirar(S.func, f.id);
        S.serv.forEach(function (s) { if (s.funcionario_id === f.id) s.funcionario_id = null; });
        j.fechar(); A.avisar("Apagado", "ok"); rota();
      }).catch(function (e) {
        if (/foreign key|violates/i.test(A.msgErro(e))) A.avisar("Ele já tem registros de ponto ou relatórios. Desmarque “Ativo” em vez de apagar.", "erro");
        else falhou(e);
      });
    };
  }

  iniciar();
})();
