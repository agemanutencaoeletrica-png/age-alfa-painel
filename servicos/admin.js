// Painel do dono: serviços, ponto, relatórios, orçamentos e equipe.
// Só entra quem tem login E está na tabela "admins" (ver supabase.sql).
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var app = $("#app");
  var sb = null;
  var S = { func: [], obras: [], serv: [], rel: [], orc: [], lojas: [], rotas: [], pref: [], contr: [], med: [], lic: [], docs: [], veic: [], semPref: false, semVeic: false };
  var urls = {};        // caminho da foto -> { url, vence }
  var infoFoto = {};    // caminho da foto -> html com detalhes (hora, GPS...)
  var filtroServ = { cat: "", st: "ativos", func: "", busca: "" };
  var filtroPonto = null;
  var filtroRel = "nao_lidos", filtroRelTipo = "";
  var ABAS = [["hoje", "Hoje"], ["servicos", "Serviços"], ["prefeitura", "🏛️ Prefeitura"], ["rotas", "Rotas"], ["lojas", "Lojas"], ["ponto", "Ponto"], ["veiculos", "🚗 Veículos"], ["relatorios", "Relatórios"], ["orcamentos", "Orçamentos"], ["equipe", "Equipe"]];
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
  // serviço/obra de prefeitura fica só na aba Prefeitura
  function ehPrefObra(o) { return !!(o && o.prefeitura_id); }
  function ehPrefServ(s) { return ehPrefObra(porId(S.obras, s.obra_id)); }
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
    // voltou pelo link do e-mail "Esqueci a senha": pede a senha nova
    var recuperando = /type=recovery/.test(location.hash);
    sb.auth.onAuthStateChange(function (ev) {
      if (ev === "SIGNED_OUT") telaLogin();
      if (ev === "PASSWORD_RECOVERY") { recuperando = true; telaNovaSenha(); }
    });
    sb.auth.getSession().then(function (r) {
      if (recuperando) { if (r.data && r.data.session) telaNovaSenha(); else telaLogin("O link para trocar a senha venceu. Peça outro em “Esqueci a senha”."); return; }
      if (r.data && r.data.session) { if (travaAtiva()) bloquear(verificarAdmin); else verificarAdmin(); }
      else telaLogin();
    }).catch(function () { telaLogin(); });
  }

  // =================================================================
  // TRAVA COM DIGITAL / ROSTO (só neste aparelho)
  // Usa o desbloqueio do próprio celular/computador (WebAuthn). A digital nunca
  // sai do aparelho; o app só guarda o "id" da chave criada aqui.
  // =================================================================
  var CHAVE_TRAVA = "age_trava", TRAVA_MIN = 2, saiuEm = 0;
  function b64(buf) { return btoa(String.fromCharCode.apply(null, new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function deB64(t) { t = t.replace(/-/g, "+").replace(/_/g, "/"); while (t.length % 4) t += "="; return Uint8Array.from(atob(t), function (c) { return c.charCodeAt(0); }); }
  function aleatorio(n) { return crypto.getRandomValues(new Uint8Array(n)); }
  function lerTrava() { try { return JSON.parse(localStorage.getItem(CHAVE_TRAVA) || "null"); } catch (e) { return null; } }
  function travaAtiva() { return !!(lerTrava() && window.PublicKeyCredential); }
  function travaDisponivel() {
    if (!window.PublicKeyCredential || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return Promise.resolve(false);
    return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(function () { return false; });
  }
  function ativarTrava() {
    return sb.auth.getSession().then(function (r) {
      var se = r.data && r.data.session, email = (se && se.user && se.user.email) || "dono";
      return navigator.credentials.create({ publicKey: {
        rp: { name: "AGE Painel" }, challenge: aleatorio(32),
        user: { id: aleatorio(16), name: email, displayName: email },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
        timeout: 60000, attestation: "none"
      } });
    }).then(function (cred) {
      localStorage.setItem(CHAVE_TRAVA, JSON.stringify({ id: b64(cred.rawId), criada: new Date().toISOString() }));
    });
  }
  function conferirDigital() {
    var t = lerTrava();
    return navigator.credentials.get({ publicKey: {
      challenge: aleatorio(32), allowCredentials: [{ type: "public-key", id: deB64(t.id), transports: ["internal", "hybrid"] }],
      userVerification: "required", timeout: 60000
    } });
  }
  function msgTrava(e) {
    var n = e && e.name;
    if (n === "NotAllowedError") return "Desbloqueio cancelado ou não reconhecido. Toque de novo.";
    if (n === "InvalidStateError") return "Este aparelho já tem a trava. Desative e ative de novo.";
    if (n === "SecurityError") return "A trava só funciona pelo endereço oficial do painel (https).";
    return A.msgErro(e);
  }
  // tela de bloqueio por cima de tudo; "depois" roda quando desbloquear
  function bloquear(depois) {
    if ($("#trava")) return;
    var d = document.createElement("div");
    d.id = "trava";
    d.setAttribute("style", "position:fixed;inset:0;z-index:200;background:var(--fundo,#f3f4f7);display:flex;align-items:center;justify-content:center;padding:20px");
    d.innerHTML = '<div class="entrada" style="margin:0;width:100%;text-align:center"><div class="marca-g">AGE</div>' +
      '<h2 style="margin-bottom:6px">🔒 Painel travado</h2><p class="mudo">Use a digital ou o rosto deste aparelho.</p>' +
      '<div id="trava-msg"></div><div class="acoes" style="flex-direction:column"><button class="prim grande" id="trava-ok" style="min-height:56px;font-size:17px">👆 Desbloquear</button>' +
      '<button class="texto peq" id="trava-senha">Entrar com e-mail e senha</button></div></div>';
    document.body.appendChild(d);
    document.body.style.overflow = "hidden";
    function abrir() {
      var b = $("#trava-ok");
      $("#trava-msg").innerHTML = "";
      A.ocupado(b, true, "Aguardando a digital...");
      conferirDigital().then(function () {
        d.remove();
        if (!$(".fundo-modal")) document.body.style.overflow = "";
        if (depois) depois();
      }).catch(function (e) {
        A.ocupado(b, false);
        $("#trava-msg").innerHTML = '<div class="aviso erro">' + esc(msgTrava(e)) + "</div>";
      });
    }
    $("#trava-ok").onclick = abrir;
    $("#trava-senha").onclick = function () { d.remove(); document.body.style.overflow = ""; sb.auth.signOut(); };
    abrir();  // já pede a digital (se o navegador exigir um toque, o botão resolve)
  }
  // volta para o app depois de alguns minutos fora: trava de novo
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { saiuEm = Date.now(); return; }
    if (saiuEm && travaAtiva() && $("#abas") && Date.now() - saiuEm >= TRAVA_MIN * 60000) bloquear(null);
    saiuEm = 0;
  });
  function janelaTrava() {
    travaDisponivel().then(function (ok) {
      var ativa = travaAtiva();
      var j = A.janela(!ok ? '<div class="aviso">Este aparelho ou navegador não tem desbloqueio por digital/rosto disponível (ou não está configurado no celular). ' +
        "Cadastre a digital nas configurações do celular e abra o painel pelo Chrome.</div>" :
        '<p>' + (ativa ? "✅ A trava está <b>ativa neste aparelho</b>." : "Ao abrir o painel (ou voltar para ele depois de " + TRAVA_MIN + " minutos), ele pede a <b>digital ou o rosto</b> do celular.") + "</p>" +
        '<p class="mudo peq">Vale só para este aparelho. A digital fica no celular, o app nunca recebe. Se a digital falhar, dá para entrar com e-mail e senha.</p>' +
        '<div id="tv-msg"></div><div class="acoes">' + (ativa ? '<button id="tv-testar">👆 Testar</button><button class="perigo" id="tv-desativar">Desativar trava</button>' :
          '<button class="prim" id="tv-ativar">🔒 Ativar trava com digital</button>') + "</div>",
        { titulo: "Trava com digital" });
      var el = j.el, msg = function (t, tipo) { $("#tv-msg", el).innerHTML = '<div class="aviso ' + (tipo || "erro") + '">' + esc(t) + "</div>"; };
      if ($("#tv-ativar", el)) $("#tv-ativar", el).onclick = function () {
        var b = this; A.ocupado(b, true, "Confirme com a digital...");
        ativarTrava().then(function () { j.fechar(); A.avisar("Trava ativada. Da próxima vez o painel pede a digital.", "ok"); atualizarBotaoTrava(); })
          .catch(function (e) { A.ocupado(b, false); msg(msgTrava(e)); });
      };
      if ($("#tv-testar", el)) $("#tv-testar", el).onclick = function () {
        conferirDigital().then(function () { msg("Digital reconhecida. A trava está funcionando.", "ok"); }).catch(function (e) { msg(msgTrava(e)); });
      };
      if ($("#tv-desativar", el)) $("#tv-desativar", el).onclick = function () {
        localStorage.removeItem(CHAVE_TRAVA); j.fechar(); A.avisar("Trava desativada neste aparelho."); atualizarBotaoTrava();
      };
    });
  }
  function atualizarBotaoTrava() {
    var b = $("#b-trava");
    if (!b) return;
    travaDisponivel().then(function (ok) {
      b.classList.toggle("oculto", !ok && !travaAtiva());
      b.textContent = travaAtiva() ? "🔒" : "🔓";
      b.title = travaAtiva() ? "Trava com digital: ativa" : "Ativar trava com digital";
    });
  }
  // depois de entrar com senha, oferece a trava uma vez por aparelho
  function oferecerTrava() {
    if (!$("#abas") || travaAtiva() || localStorage.getItem("age_trava_oferecida")) return;
    travaDisponivel().then(function (ok) {
      if (!ok) return;
      localStorage.setItem("age_trava_oferecida", "1");
      janelaTrava();
    });
  }

  // campo de senha com o botão 👁 para ver o que foi digitado
  function campoSenha(id, rotulo, auto) {
    return '<label for="' + id + '">' + rotulo + '</label><div style="position:relative">' +
      '<input id="' + id + '" type="password" autocomplete="' + auto + '" autocapitalize="none" autocorrect="off" spellcheck="false" required style="padding-right:52px">' +
      '<button type="button" class="texto" data-ver-senha="' + id + '" aria-label="Mostrar a senha" title="Mostrar a senha" ' +
      'style="position:absolute;right:2px;top:50%;transform:translateY(-50%);min-height:0;padding:8px 10px;font-size:20px;line-height:1">👁</button></div>';
  }
  function ligarVerSenha(raiz) {
    $$("[data-ver-senha]", raiz).forEach(function (b) {
      b.onclick = function () {
        var i = $("#" + b.dataset.verSenha), ver = i.type === "password";
        i.type = ver ? "text" : "password";
        b.textContent = ver ? "🙈" : "👁";
        b.setAttribute("aria-label", ver ? "Esconder a senha" : "Mostrar a senha");
        i.focus();
      };
    });
  }
  function urlPainel() { return location.href.split("#")[0].split("?")[0]; }

  function telaNovaSenha() {
    window.removeEventListener("hashchange", rota);
    app.innerHTML = '<div class="entrada"><div class="marca-g">AGE</div><h2 style="text-align:center;margin-bottom:14px">Criar senha nova</h2>' +
      '<form class="cartao" id="f-nova">' + campoSenha("n-senha", "Senha nova (mínimo 8 letras ou números)", "new-password") +
      campoSenha("n-senha2", "Repita a senha nova", "new-password") +
      '<div id="n-msg"></div><div class="acoes"><button class="prim" type="submit">Salvar senha nova</button></div></form></div>';
    ligarVerSenha(app);
    $("#f-nova").onsubmit = function (ev) {
      ev.preventDefault();
      var s1 = $("#n-senha").value, s2 = $("#n-senha2").value, b = $("button[type=submit]", this);
      var erro = function (m) { $("#n-msg").innerHTML = '<div class="aviso erro">' + esc(m) + "</div>"; };
      if (s1.length < 8) { erro("A senha precisa ter pelo menos 8 letras ou números."); return; }
      if (s1 !== s2) { erro("As duas senhas estão diferentes. Toque no 👁 para conferir."); return; }
      A.ocupado(b, true, "Salvando...");
      sb.auth.updateUser({ password: s1 }).then(function (r) {
        if (r.error) throw r.error;
        history.replaceState(null, "", urlPainel());
        A.avisar("Senha trocada. Use a senha nova da próxima vez.", "ok");
        return verificarAdmin();
      }).catch(function (e) { A.ocupado(b, false); erro(A.msgErro(e)); });
    };
  }

  function telaLogin(msg) {
    window.removeEventListener("hashchange", rota);
    app.innerHTML = '<div class="entrada"><div class="marca-g">AGE</div><h2 style="text-align:center;margin-bottom:14px">Painel AGE Elétrica e Pintura</h2>' +
      '<form class="cartao" id="f-login"><label for="l-email">E-mail</label><input id="l-email" type="email" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required>' +
      campoSenha("l-senha", "Senha", "current-password") +
      '<div id="l-msg">' + (msg ? '<div class="aviso erro">' + esc(msg) + "</div>" : "") + "</div>" +
      '<div class="acoes"><button class="prim" type="submit">Entrar</button></div>' +
      '<button type="button" class="texto peq" id="l-esqueci" style="margin-top:10px">Esqueci a senha</button></form></div>';
    ligarVerSenha(app);
    $("#l-esqueci").onclick = function () {
      var email = $("#l-email").value.trim().toLowerCase(), b = this;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $("#l-msg").innerHTML = '<div class="aviso erro">Escreva o seu e-mail acima e toque de novo em “Esqueci a senha”.</div>'; return; }
      A.ocupado(b, true, "Enviando...");
      sb.auth.resetPasswordForEmail(email, { redirectTo: urlPainel() }).then(function (r) {
        if (r.error) throw r.error;
        A.ocupado(b, false);
        $("#l-msg").innerHTML = '<div class="aviso ok">Se este e-mail tiver acesso, chega em alguns minutos uma mensagem para trocar a senha. Abra o link do e-mail <b>neste mesmo aparelho</b>. Olhe também o Spam.</div>';
      }).catch(function (e) {
        A.ocupado(b, false);
        var m = A.msgErro(e);
        if (/rate limit|too many|seconds/i.test(m)) m = "Muitos pedidos seguidos. Espere alguns minutos e tente de novo.";
        $("#l-msg").innerHTML = '<div class="aviso erro">' + esc(m) + "</div>";
      });
    };
    $("#f-login").onsubmit = function (ev) {
      ev.preventDefault();
      var b = $("button[type=submit]", this);
      A.ocupado(b, true, "Entrando...");
      sb.auth.signInWithPassword({ email: $("#l-email").value.trim().toLowerCase(), password: $("#l-senha").value }).then(function (r) {
        if (r.error) throw r.error;
        return verificarAdmin().then(oferecerTrava);
      }).catch(function (e) {
        A.ocupado(b, false);
        var m = A.msgErro(e);
        if (/Invalid login/i.test(m)) m = "E-mail ou senha errados. Toque no 👁 para ver a senha digitada (atenção a letras maiúsculas).";
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
      q(sb.from("orcamentos").select("*").order("numero", { ascending: false }).limit(500)),
      q(sb.from("lojas").select("*").limit(5000)),
      q(sb.from("rotas").select("*").order("criado_em", { ascending: false }).limit(300)),
      // prefeituras: se o supabase.sql novo ainda não foi rodado, o resto do painel continua funcionando
      Promise.all([
        q(sb.from("prefeituras").select("*").order("nome")),
        q(sb.from("contratos").select("*").order("criado_em", { ascending: false })),
        q(sb.from("medicoes").select("*").order("numero", { ascending: false }).limit(500)),
        q(sb.from("licitacoes").select("*").order("abertura", { ascending: false }).limit(500)),
        q(sb.from("documentos").select("*").order("nome"))
      ]).catch(function () { return null; }),
      q(sb.from("veiculos").select("*").order("placa")).catch(function () { return null; })
    ]).then(function (r) {
      S.func = r[0]; S.obras = r[1]; S.serv = r[2]; S.rel = r[3]; S.orc = r[4]; S.lojas = r[5]; S.rotas = r[6]; ordenarLojas();
      S.semPref = !r[7]; S.pref = r[7] ? r[7][0] : []; S.contr = r[7] ? r[7][1] : []; S.med = r[7] ? r[7][2] : [];
      S.semVeic = !r[8]; S.veic = r[8] || [];
      S.lic = r[7] ? r[7][3] : []; S.docs = r[7] ? r[7][4] : [];
    });
  }

  function montar() {
    app.innerHTML = '<div class="topo"><div class="marca">AGE</div><div><div class="nome">AGE Elétrica e Pintura</div><div class="sub">Painel do responsável</div></div>' +
      '<div class="dir"><button class="leve peq oculto" id="b-instalar">📲 Instalar app</button><button class="leve peq oculto" id="b-trava" aria-label="Trava com digital">🔓</button>' +
      '<button class="leve peq" id="b-recarregar" aria-label="Atualizar">↻</button><button class="leve peq" id="b-sair">Sair</button></div></div>' +
      '<nav class="abas" id="abas"></nav><main id="conteudo"></main>';
    A.ligarInstalar($("#b-instalar"));
    $("#b-sair").onclick = function () { sb.auth.signOut(); };
    $("#b-trava").onclick = janelaTrava;
    atualizarBotaoTrava();
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
    ({ hoje: verHoje, servicos: verServicos, prefeitura: function (c2) { window.AGE_PREF.ver(c2, P); }, rotas: verRotas, lojas: verLojas, ponto: verPonto, veiculos: verVeiculos, relatorios: verRelatorios, orcamentos: verOrcamentos, equipe: verEquipe })[aba](c);
  }

  // =================================================================
  // HOJE
  // =================================================================
  function verHoje(c) {
    c.innerHTML = carregando();
    var ini = A.inicioDia(new Date());
    Promise.all([
      q(sb.from("pontos").select("*").gte("criado_em", ini.toISOString()).order("criado_em")),
      S.semVeic ? Promise.resolve([]) : q(sb.from("km_registros").select("*").gte("criado_em", ini.toISOString()).order("criado_em")).catch(function () { return []; })
    ]).then(function (rr) {
      var pts = rr[0], kms = rr[1];
      kms.forEach(registrarInfoKm);
      var ativosTodos = S.serv.filter(function (s) { return s.status === "aberto" || s.status === "em_andamento"; });
      var ativos = ativosTodos.filter(function (s) { return !ehPrefServ(s); });
      var osPref = S.obras.filter(function (o) { return ehPrefObra(o) && ativosTodos.some(function (s) { return s.obra_id === o.id; }); }).length;
      var abE = ativos.filter(function (s) { return s.categoria === "eletrica"; }).length;
      var abP = ativos.filter(function (s) { return s.categoria === "pintura"; }).length;
      var novos = S.rel.filter(function (r) { return !r.lido; }).length;
      var aguard = S.orc.filter(function (o) { return o.status === "enviado"; });
      var h = '<div class="grade">' +
        '<div class="ladrilho"><div class="r">⚡ Elétrica</div><div class="v">' + abE + '</div><div class="d">serviços ativos</div></div>' +
        '<div class="ladrilho"><div class="r">🖌️ Pintura</div><div class="v">' + abP + '</div><div class="d">serviços ativos</div></div>' +
        (S.pref.length || osPref ? '<a class="ladrilho" href="#prefeitura" style="text-decoration:none;color:inherit"><div class="r">🏛️ Prefeitura</div><div class="v">' + osPref + '</div><div class="d">OS em aberto</div></a>' : "") +
        '<div class="ladrilho"><div class="r">Relatórios</div><div class="v">' + novos + '</div><div class="d">novos para ler</div></div>' +
        '<div class="ladrilho"><div class="r">Orçamentos</div><div class="v">' + aguard.length + '</div><div class="d">' +
        A.dinheiro(aguard.reduce(function (t, o) { return t + Number(o.total); }, 0)) + " aguardando cliente</div></div></div>";
      var daEquipe = S.serv.filter(function (s) { return s.criado_pelo_funcionario && new Date(s.criado_em) >= ini; });
      if (daEquipe.length) h += '<div class="aviso">🆕 A equipe cadastrou ' + (daEquipe.length === 1 ? "1 serviço" : daEquipe.length + " serviços") +
        ' hoje: ' + daEquipe.slice(0, 5).map(function (s) { var o = porId(S.obras, s.obra_id); return esc((o ? o.cliente : "") + " (" + nomeFunc(s.funcionario_id) + ")"); }).join(", ") +
        '. Veja em <a href="#servicos">Serviços</a>.</div>';
      if (window.AGE_PREF) h += window.AGE_PREF.avisosHoje(S);
      h += '<div class="cab-secao"><h2>Equipe hoje</h2><span class="mudo peq">' + A.data(new Date()) + "</span></div>";
      var equipe = S.func.filter(function (f) { return f.ativo || pts.some(function (p) { return p.funcionario_id === f.id; }) || kms.some(function (k) { return k.funcionario_id === f.id; }); });
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
          usosKm(kms.filter(function (k) { return k.funcionario_id === f.id; })).reverse().map(linhaUsoHoje).join("") +
          (meus.length || kms.some(function (k) { return k.funcionario_id === f.id; }) ? '<div class="fotos">' + meus.map(function (p) { return htmlFoto(p.foto, A.TIPO_PONTO[p.tipo] + " " + A.hora(p.criado_em)); }).join("") +
            kms.filter(function (k) { return k.funcionario_id === f.id; }).map(function (k) { return htmlFoto(k.foto, "🚗 KM " + A.hora(k.criado_em)); }).join("") + "</div>" : "") +
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
      '<option value="concluido">Concluídos</option><option value="cancelado">Cancelados</option><option value="equipe">Criados pela equipe</option><option value="todos">Todos</option></select>' +
      '<select id="fs-func" aria-label="Funcionário"><option value="">Todos os funcionários</option><option value="-">Sem funcionário</option>' +
      S.func.map(function (f) { return '<option value="' + f.id + '">' + esc(f.nome) + "</option>"; }).join("") + "</select>" +
      '<input id="fs-busca" type="search" placeholder="Buscar cliente ou endereço"></div>' +
      (S.pref.length ? '<p class="mudo peq" style="margin:-4px 0 10px">Aqui ficam os clientes particulares e as lojas. As OS da prefeitura ficam na aba <a href="#prefeitura">🏛️ Prefeitura</a>.</p>' : "") +
      '<div id="lista-serv"></div>';
    c.innerHTML = h;
    $("#fs-cat").value = F.cat; $("#fs-st").value = F.st; $("#fs-func").value = F.func; $("#fs-busca").value = F.busca;
    ["#fs-cat", "#fs-st", "#fs-func"].forEach(function (s) { $(s).onchange = function () { lerFiltro(); listar(); }; });
    $("#fs-busca").oninput = function () { lerFiltro(); listar(); };
    $("#b-novo-serv").onclick = function () { novoServico(null); };
    function lerFiltro() { F.cat = $("#fs-cat").value; F.st = $("#fs-st").value; F.func = $("#fs-func").value; F.busca = $("#fs-busca").value.trim().toLowerCase(); }

    function passa(s) {
      if (F.cat && s.categoria !== F.cat) return false;
      if (F.st === "ativos" && !(s.status === "aberto" || s.status === "em_andamento")) return false;
      if (F.st === "equipe" && !s.criado_pelo_funcionario) return false;
      if (F.st !== "ativos" && F.st !== "todos" && F.st !== "equipe" && s.status !== F.st) return false;
      if (F.func === "-" && s.funcionario_id) return false;
      if (F.func && F.func !== "-" && s.funcionario_id !== F.func) return false;
      return true;
    }
    function listar() {
      var obras = S.obras.filter(function (o) {
        if (ehPrefObra(o)) return false;
        if (F.busca && ((o.cliente || "") + " " + (o.endereco || "") + " " + (o.telefone || "")).toLowerCase().indexOf(F.busca) < 0) return false;
        var partes = S.serv.filter(function (s) { return s.obra_id === o.id; });
        if (!partes.length) return F.st === "todos" && !F.cat && !F.func;
        return partes.some(passa);
      });
      var l = $("#lista-serv");
      if (!obras.length) { l.innerHTML = '<div class="cartao vazio">Nenhum serviço com este filtro.</div>'; return; }
      l.innerHTML = obras.map(function (o) {
        var partes = S.serv.filter(function (s) { return s.obra_id === o.id && passa(s); });
        return '<div class="cartao"><div class="linha"><h3>' + esc(o.cliente) + "</h3>" + seloOS(o) +
          '<span class="dir"><button class="peq" data-parte="' + o.id + '">+ Parte</button> <button class="peq" data-orc-obra="' + o.id + '">💲 Orçamento</button> ' +
          '<button class="peq" data-obra="' + o.id + '">Editar</button></span></div>' +
          (o.endereco ? '<div class="peq"><a href="' + A.linkEndereco(o.endereco) + '" target="_blank" rel="noopener">📍 ' + esc(o.endereco) + "</a></div>" : "") +
          (o.telefone || o.email ? '<div class="peq mudo">' + (o.telefone ? "📞 " + esc(o.telefone) + " " : "") + (o.email ? "✉ " + esc(o.email) : "") + "</div>" : "") +
          partes.map(function (s) {
            return '<div class="parte ' + s.categoria + '" data-serv="' + s.id + '" role="button" tabindex="0"><div class="linha">' + A.seloCategoria(s.categoria) + A.seloStatus(s.status) +
              (s.criado_pelo_funcionario ? '<span class="selo atencao">criado pela equipe</span>' : "") +
              '<span class="peq">' + (s.funcionario_id ? "👷 " + esc(nomeFunc(s.funcionario_id)) : '<span class="selo critico">sem funcionário</span>') + "</span>" +
              (s.pede_assinatura ? '<span class="selo">✍️ pede assinatura</span>' : "") +
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

  function seloOS(o) {
    if (!o || !o.prefeitura_id) return "";
    var p = porId(S.pref, o.prefeitura_id);
    return '<span class="selo">🏛️ ' + esc(p ? p.nome : "Prefeitura") + (o.protocolo ? " · OS " + esc(o.protocolo) : "") + "</span>";
  }

  function msgServico(s) {
    var o = porId(S.obras, s.obra_id), f = porId(S.func, s.funcionario_id);
    var t = "*AGE Elétrica e Pintura*\nServiço de " + (A.CATEG[s.categoria].icone + " *" + A.CATEG[s.categoria].nome.toUpperCase()) + "*\n\n" +
      (o.prefeitura_id ? "🏛️ " + ((porId(S.pref, o.prefeitura_id) || {}).nome || "Prefeitura") + (o.protocolo ? " · OS/Protocolo " + o.protocolo : "") + "\n" +
        (o.fiscal ? "Fiscal: " + o.fiscal + "\n" : "") : "") +
      "Cliente: " + o.cliente + "\n" + (o.referencia ? "Referência: " + o.referencia + "\n" : "") + (o.endereco ? "Endereço: " + o.endereco + "\n" : "") + (o.telefone ? "Telefone: " + o.telefone + "\n" : "") +
      (s.data_prevista ? "Data: " + A.dataSimples(s.data_prevista) + "\n" : "") + (s.descricao ? "\nO que fazer:\n" + s.descricao + "\n" : "") +
      (o.prefeitura_id ? "\n📷 Fotos de ANTES e de DEPOIS são obrigatórias (no relatório do app).\n" : "") +
      (s.pede_assinatura ? "\n✍️ Ao concluir, colher a ASSINATURA do " + (o.prefeitura_id ? "FISCAL" : "responsável no local") + " (no relatório do app).\n" : "");
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
      '<label for="ns-' + cat + '-desc">O que fazer</label><textarea id="ns-' + cat + '-desc" rows="3"></textarea>' +
      '<label class="marca-linha" style="font-weight:400"><input type="checkbox" id="ns-' + cat + '-assin"> ✍️ Liberar assinatura do responsável neste serviço <span class="mudo peq">(desligado: o funcionário não vê o quadro de assinatura)</span></label></div></div>';
  }

  function novoServico(obraId) {
    var obra = obraId ? porId(S.obras, obraId) : null;
    var j = A.janela(
      (obra ? '<div class="cartao" style="margin:0"><b>' + esc(obra.cliente) + "</b><div class=\"peq mudo\">" + esc(obra.endereco || "") + "</div></div>" :
        (S.lojas.length ? '<label for="ns-loja">Loja da rede (opcional)</label><input id="ns-loja" list="ns-dl-lojas" placeholder="Digite o número, nome ou cidade da loja">' +
          '<datalist id="ns-dl-lojas">' + S.lojas.filter(function (l) { return l.ativo; }).map(function (l) { return '<option value="' + esc(rotuloLoja(l)) + '">'; }).join("") + "</datalist>" : "") +
        '<label for="ns-cli">Cliente *</label><input id="ns-cli" maxlength="200" required>' +
        '<div class="duas"><div><label for="ns-tel">WhatsApp do cliente</label><input id="ns-tel" type="tel" maxlength="40"></div>' +
        '<div><label for="ns-email">E-mail do cliente</label><input id="ns-email" type="email" maxlength="200"></div></div>' +
        '<label for="ns-end">Endereço</label><input id="ns-end" maxlength="300">' +
        '<label for="ns-obs">Observações (o funcionário vê)</label><textarea id="ns-obs" rows="2" placeholder="Ex.: chave com o porteiro, cachorro no quintal"></textarea>') +
      '<p class="peq mudo" style="margin:12px 0 0">Marque as partes do serviço. Cada parte vai para o funcionário daquela área.</p>' +
      formParte("eletrica", "⚡ Parte ELÉTRICA") + formParte("pintura", "🖌️ Parte PINTURA") +
      '<div id="ns-erro"></div><div class="acoes"><button class="prim" id="ns-salvar">Salvar serviço</button></div>',
      { titulo: obra ? "Nova parte do serviço" : "Novo serviço", fixa: true });
    var el = j.el;
    var lojaEscolhida = null;
    if ($("#ns-loja", el)) $("#ns-loja", el).onchange = function () {
      lojaEscolhida = lojaPorRotulo(this.value);
      if (!lojaEscolhida) return;
      $("#ns-cli", el).value = nomeLoja(lojaEscolhida);
      $("#ns-end", el).value = enderecoLoja(lojaEscolhida);
      if (lojaEscolhida.telefone) $("#ns-tel", el).value = lojaEscolhida.telefone;
    };
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
        cliente: val(el, "#ns-cli"), telefone: nulo(val(el, "#ns-tel")), email: nulo(val(el, "#ns-email")), endereco: nulo(val(el, "#ns-end")), observacoes: nulo(val(el, "#ns-obs")),
        loja_id: lojaEscolhida && $("#ns-loja", el).value === rotuloLoja(lojaEscolhida) ? lojaEscolhida.id : null
      }).select().single()).then(function (o) { S.obras.unshift(o); obra = o; return o; });
      pObra.then(function (o) {
        return q(sb.from("servicos").insert(cats.map(function (cat) {
          return { obra_id: o.id, categoria: cat, funcionario_id: nulo(val(el, "#ns-" + cat + "-func")),
            data_prevista: nulo(val(el, "#ns-" + cat + "-data")), descricao: nulo(val(el, "#ns-" + cat + "-desc")),
            pede_assinatura: $("#ns-" + cat + "-assin", el).checked };
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
      '<div class="duas"><div><label for="eo-tel">WhatsApp</label><input id="eo-tel" type="tel" maxlength="40" value="' + esc(o.telefone || "") + '"></div>' +
      '<div><label for="eo-email">E-mail</label><input id="eo-email" type="email" maxlength="200" value="' + esc(o.email || "") + '"></div></div>' +
      '<label for="eo-end">Endereço</label><input id="eo-end" maxlength="300" value="' + esc(o.endereco || "") + '">' +
      '<label for="eo-obs">Observações (o funcionário vê)</label><textarea id="eo-obs" rows="3">' + esc(o.observacoes || "") + "</textarea>" +
      '<div class="acoes"><button class="prim" id="eo-salvar">Salvar</button><button class="perigo" id="eo-apagar">Apagar cliente e partes</button></div>',
      { titulo: "Cliente / obra" });
    var el = j.el;
    $("#eo-salvar", el).onclick = function () {
      if (!val(el, "#eo-cli")) { A.avisar("Informe o cliente.", "erro"); return; }
      var b = this; A.ocupado(b, true, "Salvando...");
      q(sb.from("obras").update({ cliente: val(el, "#eo-cli"), telefone: nulo(val(el, "#eo-tel")), email: nulo(val(el, "#eo-email")), endereco: nulo(val(el, "#eo-end")), observacoes: nulo(val(el, "#eo-obs")) })
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
      '<div class="linha">' + A.seloCategoria(s.categoria) + A.seloStatus(s.status) +
      (s.criado_pelo_funcionario ? '<span class="selo atencao">criado pela equipe' + (s.funcionario_id ? " (" + esc(nomeFunc(s.funcionario_id)) + ")" : "") + "</span>" : "") +
      '<span class="dir mudo peq">criado ' + A.data(s.criado_em) + "</span></div>" +
      "<h3 style=\"margin-top:8px\">" + esc(o.cliente) + "</h3>" + seloOS(o) +
      (o.endereco ? '<div class="peq"><a href="' + A.linkEndereco(o.endereco) + '" target="_blank" rel="noopener">📍 ' + esc(o.endereco) + "</a></div>" : "") +
      '<div class="duas"><div><label for="es-func">Funcionário</label><select id="es-func">' + opcoesFunc(s.categoria, s.funcionario_id) + "</select></div>" +
      '<div><label for="es-data">Data prevista</label><input type="date" id="es-data" value="' + esc(s.data_prevista || "") + '"></div></div>' +
      '<label for="es-st">Situação</label><select id="es-st">' + Object.keys(A.STATUS).map(function (k) {
        return '<option value="' + k + '"' + (k === s.status ? " selected" : "") + ">" + A.STATUS[k] + "</option>";
      }).join("") + "</select>" +
      '<label for="es-desc">O que fazer</label><textarea id="es-desc" rows="4">' + esc(s.descricao || "") + "</textarea>" +
      '<label class="marca-linha" style="font-weight:400"><input type="checkbox" id="es-assin"' + (s.pede_assinatura ? " checked" : "") + '> ✍️ Liberar assinatura do responsável neste serviço <span class="mudo peq">(desligado: o funcionário não vê o quadro de assinatura)</span></label>' +
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
      var dados = { funcionario_id: nulo($("#es-func", el).value), data_prevista: nulo($("#es-data", el).value), status: st, descricao: nulo(val(el, "#es-desc")),
        pede_assinatura: $("#es-assin", el).checked };
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
  // VEÍCULOS (placa e KM: início e fim do uso, com foto do painel e GPS)
  // =================================================================
  var filtroVeic = null;
  function placaVeic(id) { var v = porId(S.veic, id); return v ? v.placa : "—"; }
  function registrarInfoKm(k) {
    infoFoto[k.foto] = "<b>🚗 " + esc(placaVeic(k.veiculo_id)) + " · " + (k.tipo === "fim" ? "fim do uso" : "início do uso") + "</b> · " + esc(nomeFunc(k.funcionario_id)) +
      "<br>KM informado: <b>" + A.numero(k.km, 0) + "</b> · " + A.dataHora(k.criado_em) + " (hora do servidor)<br>" +
      (k.lat !== null ? '<a href="' + A.linkMapa(k.lat, k.lng) + '" target="_blank" rel="noopener">📍 Ver no mapa</a> <span class="mudo peq">(precisão ±' + Math.round(k.precisao || 0) + " m)</span>" :
        '<span class="selo critico">sem GPS</span>');
  }
  // junta cada início com o fim seguinte do mesmo funcionário e veículo
  function usosKm(regs) {
    var usos = [], abertos = {};
    regs.slice().sort(function (a, b) { return new Date(a.criado_em) - new Date(b.criado_em); }).forEach(function (k) {
      var c = k.funcionario_id + "|" + k.veiculo_id;
      if (k.tipo === "inicio") {
        if (abertos[c]) usos.push(abertos[c]);
        abertos[c] = { func: k.funcionario_id, veic: k.veiculo_id, ini: k, fim: null };
      } else if (abertos[c]) { abertos[c].fim = k; usos.push(abertos[c]); delete abertos[c]; }
      else usos.push({ func: k.funcionario_id, veic: k.veiculo_id, ini: null, fim: k });
    });
    Object.keys(abertos).forEach(function (c) { usos.push(abertos[c]); });
    usos.forEach(function (u) { u.km = u.ini && u.fim ? u.fim.km - u.ini.km : null; });
    return usos.sort(function (a, b) { return new Date((b.ini || b.fim).criado_em) - new Date((a.ini || a.fim).criado_em); });
  }
  function linhaUsoHoje(u) {
    return '<div class="peq" style="margin-top:4px">🚗 <b>' + esc(placaVeic(u.veic)) + "</b> · " +
      (u.ini ? "início " + A.hora(u.ini.criado_em) + " (" + A.numero(u.ini.km, 0) + " km)" : "sem início") + " → " +
      (u.fim ? "fim " + A.hora(u.fim.criado_em) + " (" + A.numero(u.fim.km, 0) + " km)" : '<span class="selo atencao">em uso</span>') +
      (u.km !== null ? " · <b>" + A.numero(u.km, 0) + " km rodados</b>" : "") + "</div>";
  }

  function verVeiculos(c) {
    if (S.semVeic) {
      c.innerHTML = '<div class="cab-secao"><h2>🚗 Veículos</h2></div><div class="aviso">Para usar esta área, rode de novo o arquivo <b>supabase.sql</b> no Supabase (SQL Editor → colar tudo → Run). Depois toque em ↻.</div>';
      return;
    }
    if (!filtroVeic) { var h0 = new Date(), d7 = new Date(); d7.setDate(d7.getDate() - 6); filtroVeic = { de: A.isoLocal(d7), ate: A.isoLocal(h0), veic: "", func: "" }; }
    var F = filtroVeic, usos = [];
    c.innerHTML = '<div class="cab-secao"><h2>🚗 Veículos</h2><button class="prim" id="bv-novo">+ Veículo</button></div>' +
      (S.veic.length ? '<div class="grade">' + S.veic.map(function (v) {
        return '<button class="ladrilho" data-veic="' + v.id + '" style="text-align:left;cursor:pointer;white-space:normal;display:block;min-width:0' + (v.ativo ? "" : ";opacity:.55") + '"><div class="r">' + esc(v.modelo || "Veículo") +
          (v.ativo ? "" : " · inativo") + '</div><div class="v" style="font-size:22px">' + esc(v.placa) + '</div><div class="d" id="bv-ult-' + v.id + '">…</div></button>';
      }).join("") + "</div>" : '<div class="cartao vazio">Cadastre os veículos da empresa (placa e modelo). Eles aparecem no app dos funcionários para registrar o KM.</div>') +
      '<div class="filtros"><input type="date" id="fv-de" aria-label="De"><input type="date" id="fv-ate" aria-label="Até">' +
      '<select id="fv-veic" aria-label="Veículo"><option value="">Todos os veículos</option>' + S.veic.map(function (v) { return '<option value="' + v.id + '">' + esc(v.placa) + "</option>"; }).join("") + "</select>" +
      '<select id="fv-func" aria-label="Funcionário"><option value="">Todos os funcionários</option>' + S.func.map(function (f) { return '<option value="' + f.id + '">' + esc(f.nome) + "</option>"; }).join("") + "</select>" +
      '<button id="bv-csv">⬇ Planilha (Excel)</button></div><div id="lista-km">' + carregando() + "</div>";
    $("#fv-de").value = F.de; $("#fv-ate").value = F.ate; $("#fv-veic").value = F.veic; $("#fv-func").value = F.func;
    ["#fv-de", "#fv-ate", "#fv-veic", "#fv-func"].forEach(function (s) { $(s).onchange = function () { F.de = $("#fv-de").value; F.ate = $("#fv-ate").value; F.veic = $("#fv-veic").value; F.func = $("#fv-func").value; carregar(); }; });
    $("#bv-novo").onclick = function () { editarVeiculo(null); };
    $$("[data-veic]", c).forEach(function (b) { b.onclick = function () { editarVeiculo(b.dataset.veic); }; });
    $("#bv-csv").onclick = function () { csvKm(usos); };
    if (S.veic.length) q(sb.from("km_registros").select("veiculo_id,km,criado_em").order("criado_em", { ascending: false }).limit(300)).then(function (ult) {
      S.veic.forEach(function (v) {
        var x = ult.filter(function (k) { return k.veiculo_id === v.id; })[0], el = $("#bv-ult-" + v.id);
        if (el) el.textContent = x ? "último KM " + A.numero(x.km, 0) + " · " + A.data(x.criado_em) : "sem registro";
      });
    }).catch(function () { /* só o resumo */ });
    function carregar() {
      var l = $("#lista-km");
      if (!F.de || !F.ate) { l.innerHTML = '<div class="aviso">Escolha o período.</div>'; return; }
      var ini = new Date(F.de + "T00:00:00"), fim = new Date(F.ate + "T00:00:00"); fim.setDate(fim.getDate() + 1);
      var cons = sb.from("km_registros").select("*").gte("criado_em", ini.toISOString()).lt("criado_em", fim.toISOString()).order("criado_em");
      if (F.veic) cons = cons.eq("veiculo_id", F.veic);
      if (F.func) cons = cons.eq("funcionario_id", F.func);
      l.innerHTML = carregando();
      q(cons).then(function (regs) {
        regs.forEach(registrarInfoKm);
        usos = usosKm(regs);
        if (!usos.length) { l.innerHTML = '<div class="cartao vazio">Nenhum registro de KM neste período.</div>'; return; }
        var tot = {};
        usos.forEach(function (u) { if (u.km !== null) { var t = tot[u.veic] = tot[u.veic] || { km: 0, usos: 0 }; t.km += u.km; t.usos++; } });
        l.innerHTML = (Object.keys(tot).length ? '<div class="cartao"><h3>Total no período</h3>' + Object.keys(tot).map(function (vid) {
          return '<div class="linha"><b>' + esc(placaVeic(vid)) + '</b><span class="dir">' + A.numero(tot[vid].km, 0) + " km · " + tot[vid].usos + " uso(s)</span></div>";
        }).join("") + "</div>" : "") +
        usos.map(function (u) {
          var dia = (u.ini || u.fim).criado_em;
          return '<div class="cartao"><div class="linha"><b>🚗 ' + esc(placaVeic(u.veic)) + "</b><span>" + esc(nomeFunc(u.func)) + "</span>" +
            (u.km !== null ? '<span class="dir forte">' + A.numero(u.km, 0) + " km</span>" : '<span class="dir selo atencao">' + (u.ini ? "sem registro de fim" : "sem registro de início") + "</span>") + "</div>" +
            '<div class="peq mudo">' + A.data(dia) + " · " + (u.ini ? "início " + A.hora(u.ini.criado_em) + " com " + A.numero(u.ini.km, 0) + " km" + (u.ini.lat === null ? " (sem GPS)" : "") : "—") +
            " → " + (u.fim ? "fim " + A.hora(u.fim.criado_em) + " com " + A.numero(u.fim.km, 0) + " km" + (u.fim.lat === null ? " (sem GPS)" : "") : "—") + "</div>" +
            '<div class="fotos">' + [u.ini, u.fim].filter(Boolean).map(function (k) { return htmlFoto(k.foto, (k.tipo === "fim" ? "Fim " : "Início ") + A.hora(k.criado_em)); }).join("") + "</div></div>";
        }).join("") + '<p class="mudo peq">Toque na foto para ver o painel do carro e o local (GPS). Os lugares visitados aparecem no <a href="#ponto">Ponto</a> (chegada e saída com GPS).</p>';
        hidratarFotos(l);
      }).catch(function (e) { l.innerHTML = '<div class="aviso erro">' + esc(A.msgErro(e)) + "</div>"; });
    }
    carregar();
  }
  function csvKm(usos) {
    if (!usos || !usos.length) { A.avisar("Nada para exportar neste período."); return; }
    var cel = function (t) { t = String(t === null || t === undefined ? "" : t); return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    var linhas = [["Data", "Veículo", "Funcionário", "Início (hora)", "KM início", "Fim (hora)", "KM fim", "KM rodados"]];
    usos.slice().reverse().forEach(function (u) {
      linhas.push([A.data((u.ini || u.fim).criado_em), placaVeic(u.veic), nomeFunc(u.func), u.ini ? A.hora(u.ini.criado_em) : "", u.ini ? u.ini.km : "",
        u.fim ? A.hora(u.fim.criado_em) : "", u.fim ? u.fim.km : "", u.km === null ? "" : u.km]);
    });
    var csv = "﻿" + linhas.map(function (l) { return l.map(cel).join(";"); }).join("\r\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "km-veiculos-" + filtroVeic.de + "-a-" + filtroVeic.ate + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function editarVeiculo(id) {
    var v = id ? porId(S.veic, id) : null;
    var j = A.janela('<label for="ev-placa">Placa *</label><input id="ev-placa" maxlength="10" placeholder="ABC1D23" style="text-transform:uppercase">' +
      '<label for="ev-mod">Modelo</label><input id="ev-mod" maxlength="80" placeholder="Ex.: Fiat Strada branca">' +
      (v ? '<label class="marca-linha"><input type="checkbox" id="ev-ativo"> Ativo (aparece no app dos funcionários)</label>' : "") +
      '<div class="acoes"><button class="prim" id="ev-salvar">Salvar</button>' + (v ? '<button class="perigo" id="ev-apagar">Apagar</button>' : "") + "</div>",
      { titulo: v ? "Veículo " + v.placa : "Novo veículo" });
    var el = j.el;
    if (v) { $("#ev-placa", el).value = v.placa; $("#ev-mod", el).value = v.modelo || ""; $("#ev-ativo", el).checked = v.ativo; }
    $("#ev-salvar", el).onclick = function () {
      var placa = val(el, "#ev-placa").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (placa.length < 6) { A.avisar("Informe a placa (ex.: ABC1D23).", "erro"); return; }
      var b = this, dados = { placa: placa, modelo: nulo(val(el, "#ev-mod")) };
      if (v) dados.ativo = $("#ev-ativo", el).checked;
      A.ocupado(b, true, "Salvando...");
      q(v ? sb.from("veiculos").update(dados).eq("id", v.id).select().single() : sb.from("veiculos").insert(dados).select().single()).then(function (n) {
        trocar(S.veic, n); S.veic.sort(function (a, b2) { return a.placa.localeCompare(b2.placa); }); j.fechar(); A.avisar("Salvo", "ok"); rota();
      }).catch(function (e) {
        A.ocupado(b, false);
        if (/duplicate|unique/i.test(A.msgErro(e))) A.avisar("Esta placa já está cadastrada.", "erro"); else falhou(e);
      });
    };
    if (v) $("#ev-apagar", el).onclick = function () {
      if (!A.confirmar("Apagar o veículo " + v.placa + "? Só é possível se ainda não tiver registros de KM.")) return;
      q(sb.from("veiculos").delete().eq("id", v.id)).then(function () { tirar(S.veic, v.id); j.fechar(); A.avisar("Apagado", "ok"); rota(); }).catch(function (e) {
        if (/foreign key|violates/i.test(A.msgErro(e))) A.avisar("Este veículo já tem registros de KM. Desmarque “Ativo” em vez de apagar.", "erro"); else falhou(e);
      });
    };
  }

  // =================================================================
  // RELATÓRIOS (enviados pelos funcionários)
  // =================================================================
  function htmlCartaoRel(r) {
    var s = porId(S.serv, r.servico_id), o = s ? porId(S.obras, s.obra_id) : null;
    return '<div class="cartao clic" data-rel="' + r.id + '"' + (r.lido ? "" : ' style="border-left:4px solid var(--critico)"') + '><div class="linha">' +
      (s ? A.seloCategoria(s.categoria) : "") + (r.lido ? "" : '<span class="selo critico">novo</span>') + (r.concluido ? '<span class="selo bom">concluído</span>' : "") +
      (r.assinatura ? '<span class="selo bom">✍️ assinado</span>' : (r.concluido && s && s.pede_assinatura ? '<span class="selo atencao">sem assinatura</span>' : "")) +
      '<span class="dir mudo peq">' + A.dataHora(r.criado_em) + "</span></div>" +
      '<div style="margin-top:6px"><b>' + esc(r.tipo_servico || "Relatório") + "</b> · " + esc(o ? o.cliente : "serviço apagado") + "</div>" +
      '<div class="peq mudo">👷 ' + esc(nomeFunc(r.funcionario_id)) + " · " + (r.materiais || []).length + " materiais · " +
        ((r.fotos_antes || []).length ? (r.fotos_antes || []).length + " fotos antes · " + (r.fotos || []).length + " depois" : (r.fotos || []).length + " fotos") + "</div></div>";
  }

  function verRelatorios(c) {
    var lista = S.rel.filter(function (r) {
      if (filtroRel !== "todos" && r.lido) return false;
      if (!filtroRelTipo) return true;
      var s = porId(S.serv, r.servico_id), pr = !!(s && ehPrefServ(s));
      return filtroRelTipo === "prefeitura" ? pr : !pr;
    });
    c.innerHTML = '<div class="cab-secao"><h2>Relatórios da equipe</h2>' +
      (S.pref.length ? '<select id="fr-tipo-f" style="width:auto" aria-label="Tipo"><option value="">Particulares e prefeitura</option><option value="particulares">Só particulares</option><option value="prefeitura">🏛️ Só prefeitura</option></select>' : "") +
      '<select id="fr-filtro" style="width:auto" aria-label="Filtro">' +
      '<option value="nao_lidos">Novos</option><option value="todos">Todos</option></select></div>' +
      (lista.length ? lista.map(htmlCartaoRel).join("") : '<div class="cartao vazio">' + (filtroRel === "todos" ? "Nenhum relatório ainda." : "Nenhum relatório novo.") + "</div>");
    $("#fr-filtro").value = filtroRel;
    if ($("#fr-tipo-f")) { $("#fr-tipo-f").value = filtroRelTipo; $("#fr-tipo-f").onchange = function () { filtroRelTipo = this.value; verRelatorios(c); }; }
    $("#fr-filtro").onchange = function () { filtroRel = this.value; verRelatorios(c); };
    $$("[data-rel]", c).forEach(function (d) { d.onclick = function () { abrirRelatorio(d.dataset.rel); }; });
  }

  function abrirRelatorio(id) {
    var r = porId(S.rel, id), s = porId(S.serv, r.servico_id), o = s ? porId(S.obras, s.obra_id) : null;
    var mats = r.materiais || [], pref = !!(o && o.prefeitura_id);
    var j = A.janela(
      '<div class="linha">' + (s ? A.seloCategoria(s.categoria) : "") + (r.concluido ? '<span class="selo bom">funcionário marcou como concluído</span>' : "") +
      '<span class="dir mudo peq">' + A.dataHora(r.criado_em) + "</span></div>" +
      (pref ? seloOS(o) : "") + '<p><b>Cliente:</b> ' + esc(o ? o.cliente : "serviço apagado") + (o && o.endereco ? " · " + esc(o.endereco) : "") + "<br><b>Funcionário:</b> " + esc(nomeFunc(r.funcionario_id)) +
      "<br><b>Tipo de serviço:</b> " + esc(r.tipo_servico || "—") + "</p>" +
      (r.descricao ? '<div class="cartao" style="white-space:pre-wrap">' + esc(r.descricao) + "</div>" : "") +
      "<h3>Materiais pedidos</h3>" + (mats.length ? '<div class="tabela-caixa"><table><thead><tr><th>Material</th><th class="num">Qtd</th><th>Un</th></tr></thead><tbody>' +
        mats.map(function (m) { return "<tr><td>" + esc(m.item) + '</td><td class="num">' + A.numero(m.qtd) + "</td><td>" + esc(m.un) + "</td></tr>"; }).join("") +
        "</tbody></table></div>" : '<p class="mudo peq">Nenhum material.</p>') +
      ((r.fotos_antes || []).length ? '<h3 style="margin-top:12px">Fotos ANTES</h3><div class="fotos">' + r.fotos_antes.map(function (f) { return htmlFoto(f, "antes"); }).join("") + "</div>" : "") +
      ((r.fotos || []).length ? '<h3 style="margin-top:12px">' + (pref ? "Fotos DEPOIS" : "Fotos") + '</h3><div class="fotos">' + r.fotos.map(function (f) { return htmlFoto(f, pref ? "depois" : ""); }).join("") + "</div>" : "") +
      (r.assinatura ? '<h3 style="margin-top:12px">✍️ Assinatura ' + (pref ? "do fiscal" : "do responsável") + "</h3>" + '<div class="linha"><button class="foto" data-foto="' + esc(r.assinatura) +
        '" style="width:220px;height:110px;background:#fff" aria-label="Ver assinatura"><img alt="Assinatura" style="object-fit:contain"></button>' +
        '<div class="peq"><b>' + esc(r.assinado_por || "") + "</b><br>" + (r.assinado_em ? A.dataHora(r.assinado_em) : "") + "</div></div>"
        : (r.concluido && s && s.pede_assinatura ? '<div class="aviso" style="margin-top:12px">Este serviço pedia assinatura, mas foi concluído <b>sem assinatura</b> (responsável não estava no local).</div>' : "")) +
      '<div class="acoes"><button class="prim" id="er-orc">💲 Gerar orçamento</button>' + (s ? '<button id="er-serv">Abrir serviço</button>' : "") +
      '<button id="er-lido">' + (r.lido ? "Marcar como novo" : "Marcar como lido") + "</button></div>",
      { titulo: "Relatório", larga: true, aoFechar: function () { if (location.hash.slice(1) === "relatorios") rota(); } });
    var el = j.el;
    (r.fotos || []).forEach(function (f) { infoFoto[f] = (pref ? "Foto DEPOIS" : "Foto do relatório") + " · " + esc(nomeFunc(r.funcionario_id)) + " · " + A.dataHora(r.criado_em); });
    (r.fotos_antes || []).forEach(function (f) { infoFoto[f] = "Foto ANTES · " + esc(nomeFunc(r.funcionario_id)) + " · " + A.dataHora(r.criado_em); });
    if (r.assinatura) infoFoto[r.assinatura] = "<b>Assinatura</b> de " + esc(r.assinado_por || "") + " · " + (r.assinado_em ? A.dataHora(r.assinado_em) : "") +
      " · coletada por " + esc(nomeFunc(r.funcionario_id));
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
        obra_id: o ? o.id : null, relatorio_id: r.id, cliente: o ? o.cliente : "", telefone: o ? o.telefone : "", email: o ? o.email : "", endereco: o ? o.endereco : "",
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
    editarOrcamento(null, { obra_id: o.id, cliente: o.cliente, telefone: o.telefone, email: o.email, endereco: o.endereco, categoria: cat });
  }

  function calcOrc(M) {
    var mat = 0, serv = 0;
    M.itens.forEach(function (i) { var st = (Number(i.qtd) || 0) * (Number(i.valor) || 0); if (i.tipo === "material") mat += st; else serv += st; });
    var bruto = mat + serv, total = Math.max(0, bruto - (Number(M.desconto) || 0));
    return { mat: Math.round(mat * 100) / 100, serv: Math.round(serv * 100) / 100, bruto: Math.round(bruto * 100) / 100, total: Math.round(total * 100) / 100 };
  }

  function editarOrcamento(orc, base) {
    var M = orc ? JSON.parse(JSON.stringify(orc)) : Object.assign({
      id: null, numero: null, obra_id: null, relatorio_id: null, cliente: "", telefone: "", email: "", endereco: "", categoria: "", itens: [],
      desconto: 0, pagamento: "50% na aprovação e 50% na entrega do serviço", prazo: "", validade_dias: 15, observacoes: "", status: "rascunho"
    }, base || {});
    M.itens = (M.itens || []).map(function (i) { return Object.assign({ tipo: "material", descricao: "", qtd: 1, un: "un", valor: 0 }, i); });
    if (!M.itens.length) M.itens.push({ tipo: "servico", descricao: "Mão de obra", qtd: 1, un: "serv", valor: 0 });

    var j = A.janela(
      '<label for="eo2-cli">Cliente *</label><input id="eo2-cli" maxlength="200">' +
      '<div class="duas"><div><label for="eo2-tel">WhatsApp do cliente</label><input id="eo2-tel" type="tel" maxlength="40"></div><div><label for="eo2-email">E-mail do cliente</label><input id="eo2-email" type="email" maxlength="200"></div></div>' +
      '<div class="duas"><div><label for="eo2-end">Endereço</label><input id="eo2-end" maxlength="300"></div><div><label for="eo2-cat">Área</label><select id="eo2-cat"><option value="">—</option>' +
      Object.keys(CAT_ORC).map(function (k) { return '<option value="' + k + '">' + CAT_ORC[k] + "</option>"; }).join("") + "</select></div></div>" +
      '<h3 style="margin-top:14px">Itens</h3><div id="eo2-itens"></div>' +
      '<div class="linha" style="margin-top:8px"><button class="peq" id="eo2-mais-mat">+ Material</button><button class="peq" id="eo2-mais-serv">+ Mão de obra / serviço</button></div>' +
      '<div class="duas"><div><label for="eo2-desc">Desconto (R$)</label><input id="eo2-desc" inputmode="decimal"></div><div><label for="eo2-val">Validade (dias)</label><input id="eo2-val" type="number" min="1" max="365"></div></div>' +
      '<div class="cartao" style="margin-top:10px" id="eo2-totais"></div>' +
      '<div class="duas"><div><label for="eo2-pag">Forma de pagamento</label><input id="eo2-pag" maxlength="300"></div><div><label for="eo2-prazo">Prazo de execução</label><input id="eo2-prazo" maxlength="200" placeholder="Ex.: 5 dias úteis"></div></div>' +
      '<label for="eo2-obs">Observações</label><textarea id="eo2-obs" rows="3"></textarea>' +
      '<label for="eo2-st">Situação</label><select id="eo2-st">' + Object.keys(STATUS_ORC).map(function (k) { return '<option value="' + k + '">' + STATUS_ORC[k] + "</option>"; }).join("") + "</select>" +
      '<div class="acoes"><button class="prim" id="eo2-salvar">Salvar</button>' +
      (podeCompartilharArquivo() ? '<button class="prim" id="eo2-compartilhar">📤 Enviar PDF (WhatsApp, e-mail...)</button>' : "") +
      '<button id="eo2-pdf">📄 Baixar PDF</button></div>' +
      '<div class="acoes" style="margin-top:8px"><button class="zap" id="eo2-zap">📲 WhatsApp do cliente</button><button id="eo2-email-b">✉ E-mail do cliente</button>' +
      '<button id="eo2-imprimir">🖨 Imprimir</button>' + (M.id ? '<button class="perigo" id="eo2-apagar">Apagar</button>' : "") + "</div>",
      { titulo: M.numero ? "Orçamento nº " + String(M.numero).padStart(4, "0") : "Novo orçamento", larga: true, fixa: true });
    var el = j.el;
    $("#eo2-cli", el).value = M.cliente || ""; $("#eo2-tel", el).value = M.telefone || ""; $("#eo2-email", el).value = M.email || ""; $("#eo2-end", el).value = M.endereco || "";
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
      M.cliente = val(el, "#eo2-cli"); M.telefone = val(el, "#eo2-tel"); M.email = val(el, "#eo2-email"); M.endereco = val(el, "#eo2-end"); M.categoria = $("#eo2-cat", el).value;
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
      var dados = { obra_id: M.obra_id, relatorio_id: M.relatorio_id, cliente: M.cliente, telefone: nulo(M.telefone), email: nulo(M.email), endereco: nulo(M.endereco), categoria: nulo(M.categoria),
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
      if (A.soDigitos(M.telefone).length < 10) { A.avisar("Informe o WhatsApp do cliente com DDD.", "erro"); return; }
      var b = this; A.ocupado(b, true, "Salvando...");
      salvar().then(function (n) { A.ocupado(b, false); A.abrirZap(A.linkZap(n.telefone, textoOrcamento(n))); })
        .catch(function (e) { A.ocupado(b, false); falhou(e); });
    };
    carregarJsPdf().catch(function () { /* tenta de novo ao clicar */ });
    function prepararPdf(b) {
      A.ocupado(b, true, "Gerando PDF...");
      return salvar().then(function (n) {
        return gerarPdf(n).then(function (blob) { A.ocupado(b, false); return { orc: n, blob: blob }; });
      }).catch(function (e) { A.ocupado(b, false); throw e; });
    }
    $("#eo2-pdf", el).onclick = function () {
      prepararPdf(this).then(function (r) { baixar(r.blob, nomePdf(r.orc)); A.avisar("PDF baixado", "ok"); }).catch(falhou);
    };
    if ($("#eo2-compartilhar", el)) $("#eo2-compartilhar", el).onclick = function () {
      prepararPdf(this).then(function (r) { compartilharPdf(r.orc, r.blob); }).catch(falhou);
    };
    $("#eo2-email-b", el).onclick = function () {
      lerCampos();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(M.email)) { A.avisar("Informe um e-mail válido do cliente.", "erro"); return; }
      prepararPdf(this).then(function (r) {
        baixar(r.blob, nomePdf(r.orc));
        var o = r.orc, E = A.CFG.EMPRESA || {};
        var assunto = "Orçamento nº " + String(o.numero).padStart(4, "0") + " - " + (E.nome || "AGE Elétrica e Pintura");
        var corpo = textoOrcamento(o, true) + "\n\n(O orçamento completo vai em PDF, anexo.)";
        A.janela('<p>O PDF <b>' + esc(nomePdf(o)) + '</b> foi baixado. Clique abaixo para abrir o e-mail já preenchido para <b>' + esc(o.email) +
          "</b> e <b>anexe o PDF</b> (fica na pasta Downloads).</p>" +
          '<div class="acoes"><a class="botao prim" id="ok-email" href="mailto:' + encodeURIComponent(o.email) + "?subject=" + encodeURIComponent(assunto) +
          "&body=" + encodeURIComponent(corpo.replace(/\n/g, "\r\n")) + '">✉ Abrir e-mail</a></div>', { titulo: "Enviar por e-mail" });
      }).catch(falhou);
    };
    if ($("#eo2-apagar", el)) $("#eo2-apagar", el).onclick = function () {
      if (!A.confirmar("Apagar este orçamento?")) return;
      q(sb.from("orcamentos").delete().eq("id", M.id)).then(function () { tirar(S.orc, M.id); j.fechar(); A.avisar("Apagado", "ok"); rota(); }).catch(falhou);
    };
  }

  function textoOrcamento(o, semNegrito) {
    var E = A.CFG.EMPRESA || {};
    var t = "Olá, " + o.cliente.split(" ")[0] + "! Segue o orçamento solicitado.\n\n*" + (E.nome || "AGE Elétrica e Pintura") + "*\nOrçamento nº " +
      String(o.numero).padStart(4, "0") + " — " + A.data(o.criado_em) + "\n\nCliente: " + o.cliente + "\n";
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
    if (E.telefone) t += "\n\nDúvidas: " + E.telefone;
    return semNegrito ? t.replace(/\*/g, "") : t;
  }

  // ---------- PDF do orçamento ----------
  var jsPdfPronto = null;
  function carregarJsPdf() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (!jsPdfPronto) {
      jsPdfPronto = new Promise(function (ok, falha) {
        var sc = document.createElement("script");
        sc.src = "https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js";
        sc.onload = function () { if (window.jspdf && window.jspdf.jsPDF) ok(window.jspdf.jsPDF); else { jsPdfPronto = null; falha(new Error("Falha ao carregar o gerador de PDF.")); } };
        sc.onerror = function () { jsPdfPronto = null; sc.remove(); falha(new Error("Sem internet para gerar o PDF. Tente de novo.")); };
        document.head.appendChild(sc);
      });
    }
    return jsPdfPronto;
  }
  function nomePdf(o) {
    var c = String(o.cliente || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return "Orcamento-" + String(o.numero).padStart(4, "0") + (c ? "-" + c : "") + ".pdf";
  }
  function baixar(blob, nome) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }
  function podeCompartilharArquivo() {
    try { return !!(navigator.canShare && navigator.canShare({ files: [new File(["x"], "x.pdf", { type: "application/pdf" })] })); } catch (e) { return false; }
  }
  function compartilharPdf(o, blob) {
    var arq = new File([blob], nomePdf(o), { type: "application/pdf" });
    var dados = { files: [arq], title: "Orçamento nº " + String(o.numero).padStart(4, "0"), text: "Orçamento nº " + String(o.numero).padStart(4, "0") + " — " + o.cliente };
    return navigator.share(dados).catch(function (e) {
      if (e && e.name === "AbortError") return;           // a pessoa fechou a janela de compartilhar
      // o navegador exige um toque novo depois de gerar o PDF
      var j = A.janela('<p>PDF pronto. Toque para escolher WhatsApp, Gmail ou outro app.</p><div class="acoes"><button class="prim" id="ok-comp">📤 Compartilhar PDF</button>' +
        '<button id="ok-baixar">📄 Baixar</button></div>', { titulo: "Enviar PDF" });
      $("#ok-comp", j.el).onclick = function () { navigator.share(dados).then(j.fechar, function (e2) { if (!e2 || e2.name !== "AbortError") falhou(e2); }); };
      $("#ok-baixar", j.el).onclick = function () { baixar(blob, arq.name); j.fechar(); };
    });
  }

  // Texto em A4, nítido e leve (não é foto da tela).
  function gerarPdf(o) {
    return carregarJsPdf().then(function (JsPDF) {
      var doc = new JsPDF({ unit: "mm", format: "a4" }), E = A.CFG.EMPRESA || {}, t = calcOrc(o);
      var L = 15, R = 195, y = 18, num = String(o.numero).padStart(4, "0");
      function tx(v) {
        return String(v === null || v === undefined ? "" : v).replace(/[\u2212\u2013\u2014]/g, "-").replace(/[\u201c\u201d]/g, '"')
          .replace(/[\u2018\u2019]/g, "'").replace(/\u2022/g, "-").replace(/\u202f/g, " ").replace(/[^\x00-\xff]/g, "");
      }
      function azul() { doc.setTextColor(20, 50, 92); }
      function preto() { doc.setTextColor(20, 20, 20); }
      function fonte(peso, tam) { doc.setFont("helvetica", peso); doc.setFontSize(tam); }
      function cabeTabela() {
        fonte("bold", 8); doc.setTextColor(90, 90, 90);
        doc.text("DESCRIÇÃO", L + 1, y); doc.text("QTD", 122, y, { align: "right" }); doc.text("UN", 125, y);
        doc.text("VALOR UN.", 162, y, { align: "right" }); doc.text("SUBTOTAL", R - 1, y, { align: "right" });
        y += 2; doc.setDrawColor(200); doc.setLineWidth(0.3); doc.line(L, y, R, y); y += 4.5;
      }
      function espaco(alt) { if (y + alt > 278) { doc.addPage(); y = 18; return true; } return false; }

      // cabeçalho
      fonte("bold", 16); azul(); doc.text(tx(E.nome || "AGE Elétrica e Pintura"), L, y);
      fonte("bold", 13); preto(); doc.text("ORÇAMENTO Nº " + num, R, y, { align: "right" });
      var validade = new Date(o.criado_em); validade.setDate(validade.getDate() + Number(o.validade_dias || 15));
      fonte("normal", 10); doc.text("Data: " + A.data(o.criado_em), R, y + 6, { align: "right" }); doc.text("Válido até: " + A.data(validade), R, y + 11, { align: "right" });
      fonte("normal", 9); var yi = y + 6;
      [E.documento, E.telefone, E.email, E.endereco, E.cidade].filter(Boolean).forEach(function (l) { doc.text(tx(l), L, yi); yi += 4.5; });
      y = Math.max(yi, y + 14) + 1;
      doc.setDrawColor(20, 50, 92); doc.setLineWidth(0.8); doc.line(L, y, R, y); y += 6;

      // cliente
      var cli = [["Cliente: ", o.cliente], ["WhatsApp: ", o.telefone], ["E-mail: ", o.email], ["Local: ", o.endereco], ["Serviço: ", CAT_ORC[o.categoria] || o.categoria]]
        .filter(function (c) { return c[1]; });
      var linhasCli = cli.map(function (c) { return { r: c[0], v: doc.splitTextToSize(tx(c[1]), 150) }; });
      var altCli = linhasCli.reduce(function (s2, c) { return s2 + c.v.length * 5; }, 0) + 5;
      doc.setFillColor(243, 245, 248); doc.roundedRect(L, y - 4, R - L, altCli, 2, 2, "F");
      y += 1.5;
      linhasCli.forEach(function (c) {
        fonte("bold", 10); preto(); doc.text(c.r, L + 3, y);
        fonte("normal", 10); doc.text(c.v, L + 23, y); y += c.v.length * 5;
      });
      y += 5;

      // itens
      [["material", "Materiais"], ["servico", "Mão de obra / serviços"]].forEach(function (g) {
        var itens = o.itens.filter(function (i) { return (g[0] === "material") === (i.tipo === "material"); });
        if (!itens.length) return;
        espaco(20);
        fonte("bold", 12); azul(); doc.text(tx(g[1]), L, y); y += 6;
        cabeTabela();
        itens.forEach(function (i) {
          fonte("normal", 9.5); preto();
          var d = doc.splitTextToSize(tx(i.descricao), 88), alt = d.length * 4.4 + 2.4;
          if (espaco(alt)) cabeTabela();
          fonte("normal", 9.5); preto();
          doc.text(d, L + 1, y);
          doc.text(tx(A.numero(i.qtd, 3)), 122, y, { align: "right" }); doc.text(tx(i.un), 125, y);
          doc.text(tx(A.dinheiro(i.valor)), 162, y, { align: "right" }); doc.text(tx(A.dinheiro(i.qtd * i.valor)), R - 1, y, { align: "right" });
          y += alt - 2.4; doc.setDrawColor(225); doc.setLineWidth(0.2); doc.line(L, y - 1.6, R, y - 1.6); y += 3.2;
        });
        y += 3;
      });

      // totais
      espaco(32);
      var xt = 120;
      fonte("normal", 10); preto();
      [["Materiais", t.mat], ["Mão de obra", t.serv]].concat(Number(o.desconto) ? [["Desconto", -Number(o.desconto)]] : []).forEach(function (l) {
        doc.text(l[0], xt, y); doc.text((l[1] < 0 ? "- " : "") + tx(A.dinheiro(Math.abs(l[1]))), R, y, { align: "right" }); y += 5.5;
      });
      doc.setDrawColor(20, 50, 92); doc.setLineWidth(0.6); doc.line(xt, y - 2.5, R, y - 2.5); y += 3;
      fonte("bold", 14); doc.text("TOTAL", xt, y); doc.text(tx(A.dinheiro(o.total)), R, y, { align: "right" }); y += 10;

      // condições
      [["Forma de pagamento: ", o.pagamento], ["Prazo de execução: ", o.prazo], ["Observações: ", o.observacoes]].forEach(function (c) {
        if (!c[1]) return;
        var linhas = doc.splitTextToSize(tx(c[1]), R - L);
        espaco(6 + linhas.length * 4.6);
        fonte("bold", 10); preto(); doc.text(c[0], L, y); y += 5;
        fonte("normal", 10); doc.text(linhas, L, y); y += linhas.length * 4.6 + 3;
      });

      // assinaturas
      if (espaco(30)) y += 10; else y += 18;
      doc.setDrawColor(60); doc.setLineWidth(0.3);
      doc.line(L, y, 95, y); doc.line(115, y, R, y);
      fonte("normal", 9); doc.text(tx(E.nome || "AGE Elétrica e Pintura"), 55, y + 4.5, { align: "center" }); doc.text("Cliente - de acordo", 155, y + 4.5, { align: "center" });

      var n = doc.getNumberOfPages();
      for (var pg = 1; pg <= n; pg++) {
        doc.setPage(pg); fonte("normal", 8); doc.setTextColor(130);
        doc.text("Orçamento nº " + num + "  ·  página " + pg + " de " + n, 105, 290, { align: "center" });
      }
      doc.setProperties({ title: "Orçamento " + num + " - " + tx(o.cliente), author: tx(E.nome || "AGE Elétrica e Pintura") });
      return doc.output("blob");
    });
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
      '<div class="cli"><b>Cliente:</b> ' + esc(o.cliente) + (o.telefone ? " · " + esc(o.telefone) : "") + (o.email ? " · " + esc(o.email) : "") + (o.endereco ? "<br><b>Local:</b> " + esc(o.endereco) : "") +
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
  // LOJAS (endereços da rede de clientes)
  // =================================================================
  var G = window.AGE_GEO;
  var PRECISAO = { endereco: ["bom", "endereço"], gps: ["bom", "GPS"], manual: ["bom", "conferido"], cep: ["", "CEP"], bairro: ["atencao", "bairro"], cidade: ["atencao", "só cidade"] };
  var NIVEL = { cidade: 1, bairro: 2, cep: 3, endereco: 4, gps: 5, manual: 6 };
  var CORES_DIA = ["#1f62d0", "#d1495b", "#2a9d8f", "#e08a00", "#7b4fd6", "#3c8d2f", "#c2185b", "#00838f", "#6d4c41", "#455a64"];
  var filtroLojas = { busca: "", cidade: "", regiao: "", local: "" }, limiteLojas = 150;

  function semAcento(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function ordenarLojas() {
    S.lojas.sort(function (a, b) {
      var na = parseInt(a.codigo, 10), nb = parseInt(b.codigo, 10);
      if (isNaN(na) !== isNaN(nb)) return isNaN(na) ? 1 : -1;
      return (na - nb) || String(a.nome).localeCompare(String(b.nome));
    });
  }
  function nomeLoja(l) { return (l.codigo ? (l.tipo === "loja" ? "Loja " : "") + l.codigo + " – " : "") + l.nome; }
  function rotuloLoja(l) { return nomeLoja(l) + (l.cidade ? " (" + l.cidade + ")" : ""); }
  function lojaPorRotulo(t) { for (var i = 0; i < S.lojas.length; i++) if (rotuloLoja(S.lojas[i]) === t) return S.lojas[i]; return null; }
  function enderecoLoja(l) {
    return [[l.endereco, l.numero].filter(Boolean).join(", "), l.complemento, l.bairro, l.cidade ? l.cidade + (l.uf ? "/" + l.uf : "") : ""].filter(Boolean).join(" - ");
  }
  function seloLocal(l) {
    if (!G.temLocal(l)) return '<span class="selo critico">sem local</span>';
    var p = PRECISAO[l.geo_precisao] || ["", "?"];
    return '<span class="selo ' + p[0] + '">📍 ' + p[1] + "</span>";
  }
  function opcoesUnicas(campo) {
    var vistos = {};
    S.lojas.forEach(function (l) { if (l[campo]) vistos[l[campo]] = 1; });
    return Object.keys(vistos).sort(function (a, b) { return a.localeCompare(b); });
  }
  function filtrarLojas(F) {
    var b = semAcento(F.busca);
    return S.lojas.filter(function (l) {
      if (F.local === "desativadas") { if (l.ativo) return false; } else if (!l.ativo) return false;
      if (F.cidade && l.cidade !== F.cidade) return false;
      if (F.regiao && l.regiao !== F.regiao) return false;
      if (F.local === "sem" && G.temLocal(l)) return false;
      if (F.local === "aprox" && !(G.temLocal(l) && NIVEL[l.geo_precisao] <= 2)) return false;
      if (F.local === "bom" && !(G.temLocal(l) && NIVEL[l.geo_precisao] >= 3)) return false;
      if (b && semAcento([l.codigo, l.nome, l.bairro, l.cidade, l.endereco, l.cnpj].join(" ")).indexOf(b) < 0) return false;
      return true;
    });
  }
  function htmlFiltrosLojas(pref, F) {
    return '<div class="filtros"><input id="' + pref + '-busca" type="search" placeholder="Buscar nº, nome, bairro, cidade" value="' + esc(F.busca) + '">' +
      '<select id="' + pref + '-cidade" aria-label="Cidade"><option value="">Todas as cidades</option>' +
      opcoesUnicas("cidade").map(function (c) { return '<option' + (c === F.cidade ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") + "</select>" +
      '<select id="' + pref + '-regiao" aria-label="Região"><option value="">Todas as regiões</option>' +
      opcoesUnicas("regiao").map(function (c) { return '<option' + (c === F.regiao ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") + "</select></div>";
  }
  function ligarFiltrosLojas(raiz, pref, F, depois) {
    $("#" + pref + "-busca", raiz).oninput = function () { F.busca = this.value.trim(); depois(); };
    $("#" + pref + "-cidade", raiz).onchange = function () { F.cidade = this.value; depois(); };
    $("#" + pref + "-regiao", raiz).onchange = function () { F.regiao = this.value; depois(); };
  }

  function verLojas(c) {
    var F = filtroLojas, ativas = S.lojas.filter(function (l) { return l.ativo; });
    var sem = ativas.filter(function (l) { return !G.temLocal(l); }).length;
    var aprox = ativas.filter(function (l) { return G.temLocal(l) && NIVEL[l.geo_precisao] <= 2; }).length;
    c.innerHTML = '<div class="cab-secao"><h2>Lojas</h2><button id="bl-imp">⬆ Atualizar lojas (Word ou planilha)</button><button id="bl-geo">📍 Localizar no mapa</button>' +
      '<button class="prim" id="bl-nova">+ Nova loja</button></div>' +
      '<p class="peq mudo" style="margin-top:-6px">' + ativas.length + " lojas · " + (sem ? '<b style="color:var(--critico)">' + sem + " sem local</b> · " : "") +
      (aprox ? aprox + " com local aproximado · " : "") + (ativas.length - sem - aprox) + " com local bom</p>" +
      htmlFiltrosLojas("fl", F).replace('</div>', '<select id="fl-local" aria-label="Localização"><option value="">Todas</option><option value="sem">Sem local</option>' +
        '<option value="aprox">Local aproximado</option><option value="bom">Local bom</option><option value="desativadas">Desativadas</option></select></div>') +
      '<div id="lista-lojas"></div><input type="file" id="bl-arq" accept=".doc,.docx,.csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/csv" class="oculto">';
    $("#fl-local").value = F.local;
    $("#fl-local").onchange = function () { F.local = this.value; listar(); };
    ligarFiltrosLojas(c, "fl", F, function () { limiteLojas = 150; listar(); });
    $("#bl-nova").onclick = function () { editarLoja(null); };
    $("#bl-geo").onclick = function () { localizarLojas(); };
    $("#bl-imp").onclick = function () { $("#bl-arq").value = ""; $("#bl-arq").click(); };
    $("#bl-arq").onchange = function () { var f = this.files && this.files[0]; if (f) importarLojas(f); };
    function listar() {
      var lista = filtrarLojas(F), l = $("#lista-lojas");
      if (!S.lojas.length) {
        l.innerHTML = '<div class="cartao vazio">Nenhuma loja cadastrada. Toque em <b>⬆ Atualizar lojas</b> e escolha o documento <b>DADOS DAS LOJAS</b> (Word) ou a planilha <b>lojas-supermercados-bh.csv</b>.</div>';
        return;
      }
      if (!lista.length) { l.innerHTML = '<div class="cartao vazio">Nenhuma loja com este filtro.</div>'; return; }
      l.innerHTML = '<div class="cartao tabela-caixa"><table><thead><tr><th>Nº</th><th>Loja</th><th class="esconde-cel">Bairro</th><th>Cidade</th><th>Local</th></tr></thead><tbody>' +
        lista.slice(0, limiteLojas).map(function (x) {
          return '<tr data-loja="' + x.id + '" style="cursor:pointer"><td>' + esc(x.codigo || "") + "</td><td>" + esc(x.nome) +
            (x.tipo !== "loja" ? ' <span class="selo">' + esc(x.tipo === "cd" ? "CD" : x.tipo === "posto" ? "posto" : "outro") + "</span>" : "") +
            '</td><td class="esconde-cel">' + esc(x.bairro || "") + "</td><td>" + esc(x.cidade || "") + "</td><td>" + seloLocal(x) + "</td></tr>";
        }).join("") + "</tbody></table></div>" +
        (lista.length > limiteLojas ? '<div class="acoes"><button id="bl-mais">Mostrar mais (' + (lista.length - limiteLojas) + ")</button></div>" : "");
      $$("[data-loja]", l).forEach(function (tr) { tr.onclick = function () { editarLoja(tr.dataset.loja); }; });
      if ($("#bl-mais")) $("#bl-mais").onclick = function () { limiteLojas += 300; listar(); };
    }
    listar();
  }

  function posicaoAtual(precisa) {
    return new Promise(function (ok, falha) {
      if (!navigator.geolocation) { falha(new Error("Este aparelho não informa a localização.")); return; }
      navigator.geolocation.getCurrentPosition(function (p) { ok({ lat: p.coords.latitude, lng: p.coords.longitude, precisao: p.coords.accuracy }); },
        function (e) { falha(new Error(e.code === 1 ? "Localização bloqueada: libere a localização para este site." : "Não consegui pegar a localização. Tente de novo.")); },
        { enableHighAccuracy: !!precisa, timeout: 20000, maximumAge: precisa ? 0 : 120000 });
    });
  }

  function editarLoja(id) {
    var l = id ? porId(S.lojas, id) : { tipo: "loja", uf: "MG", ativo: true, nome: "" };
    var geo = { lat: l.lat, lng: l.lng, geo_precisao: l.geo_precisao };
    var campo = function (k, rot, extra) { return '<div><label for="lj-' + k + '">' + rot + '</label><input id="lj-' + k + '" ' + (extra || "") + ' value="' + esc(l[k] || "") + '"></div>'; };
    var j = A.janela(
      '<div class="duas">' + campo("codigo", "Nº / código", 'maxlength="20"') + '<div><label for="lj-tipo">Tipo</label><select id="lj-tipo"><option value="loja">Loja</option>' +
      '<option value="cd">Centro de distribuição</option><option value="posto">Posto</option><option value="outro">Outro</option></select></div></div>' +
      '<label for="lj-nome">Nome *</label><input id="lj-nome" maxlength="200" value="' + esc(l.nome) + '">' +
      '<div class="duas">' + campo("endereco", "Rua / avenida", 'maxlength="300"') + campo("numero", "Número", 'maxlength="40"') + "</div>" +
      '<div class="duas">' + campo("complemento", "Complemento", 'maxlength="100"') + campo("bairro", "Bairro", 'maxlength="120"') + "</div>" +
      '<div class="duas">' + campo("cidade", "Cidade", 'maxlength="120"') + '<div class="duas"><div><label for="lj-uf">UF</label><input id="lj-uf" maxlength="2" value="' + esc(l.uf || "MG") + '"></div>' +
      campo("cep", "CEP", 'inputmode="numeric" maxlength="10"') + "</div></div>" +
      '<div class="duas">' + campo("telefone", "Telefone da loja", 'type="tel" maxlength="40"') + campo("cnpj", "CNPJ", 'maxlength="20"') + "</div>" +
      '<div class="duas">' + campo("regiao", "Região", 'maxlength="120"') + campo("empresa", "Empresa", 'maxlength="200"') + "</div>" +
      '<h3 style="margin-top:14px">Localização no mapa</h3><div id="lj-geo-txt" class="peq" style="margin:6px 0"></div>' +
      '<label for="lj-coord">Coordenadas ou link do Google Maps</label><input id="lj-coord" placeholder="-19.9167, -43.9345  ou cole o link do Google Maps">' +
      '<div class="acoes"><button id="lj-gps">📍 Estou na loja: usar meu GPS</button><button id="lj-buscar">🔎 Buscar pelo endereço</button></div>' +
      '<label class="marca-linha"><input type="checkbox" id="lj-ativo"> Ativa</label>' +
      '<div class="acoes"><button class="prim" id="lj-salvar">Salvar</button>' + (id ? '<button class="perigo" id="lj-apagar">Apagar</button>' : "") + "</div>",
      { titulo: id ? nomeLoja(l) : "Nova loja", fixa: true });
    var el = j.el;
    $("#lj-tipo", el).value = l.tipo || "loja";
    $("#lj-ativo", el).checked = l.ativo !== false;
    function mostrarGeo() {
      $("#lj-geo-txt", el).innerHTML = G.temLocal(geo) ? seloLocal(geo) + ' <a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' +
        geo.lat + "," + geo.lng + '">ver no mapa</a> <span class="mudo">(' + geo.lat.toFixed(5) + ", " + geo.lng.toFixed(5) + ")</span>" : seloLocal(geo);
      $("#lj-coord", el).value = G.temLocal(geo) ? geo.lat.toFixed(6) + ", " + geo.lng.toFixed(6) : "";
    }
    mostrarGeo();
    $("#lj-coord", el).onchange = function () {
      if (!this.value.trim()) { geo = { lat: null, lng: null, geo_precisao: null }; mostrarGeo(); return; }
      var c = G.lerCoordenadas(this.value);
      if (!c) { A.avisar("Não entendi as coordenadas. Ex.: -19.9167, -43.9345", "erro"); return; }
      geo = { lat: c.lat, lng: c.lng, geo_precisao: "manual" }; mostrarGeo();
    };
    $("#lj-gps", el).onclick = function () {
      var b = this; A.ocupado(b, true, "Pegando GPS...");
      posicaoAtual(true).then(function (p) {
        A.ocupado(b, false);
        if (p.precisao > 100 && !A.confirmar("O GPS está impreciso (±" + Math.round(p.precisao) + " m). Usar mesmo assim?")) return;
        geo = { lat: p.lat, lng: p.lng, geo_precisao: "gps" }; mostrarGeo();
      }).catch(function (e) { A.ocupado(b, false); falhou(e); });
    };
    $("#lj-buscar", el).onclick = function () {
      var b = this; A.ocupado(b, true, "Buscando...");
      G.localizar(lerForm()).then(function (r) {
        A.ocupado(b, false);
        if (!r) { A.avisar("Endereço não encontrado no mapa. Cole as coordenadas ou use o GPS na loja.", "erro"); return; }
        geo = r; mostrarGeo();
      }).catch(function (e) { A.ocupado(b, false); falhou(e); });
    };
    function lerForm() {
      var d = {};
      ["codigo", "nome", "endereco", "numero", "complemento", "bairro", "cidade", "cep", "telefone", "cnpj", "regiao", "empresa"].forEach(function (k) { d[k] = nulo(val(el, "#lj-" + k)); });
      d.uf = (val(el, "#lj-uf") || "MG").toUpperCase(); d.tipo = $("#lj-tipo", el).value; d.ativo = $("#lj-ativo", el).checked;
      return d;
    }
    $("#lj-salvar", el).onclick = function () {
      var d = lerForm();
      if (!d.nome) { A.avisar("Informe o nome da loja.", "erro"); return; }
      d.lat = G.temLocal(geo) ? geo.lat : null; d.lng = G.temLocal(geo) ? geo.lng : null; d.geo_precisao = G.temLocal(geo) ? geo.geo_precisao : null;
      var b = this; A.ocupado(b, true, "Salvando...");
      q(id ? sb.from("lojas").update(d).eq("id", id).select().single() : sb.from("lojas").insert(d).select().single()).then(function (n) {
        trocar(S.lojas, n); ordenarLojas(); j.fechar(); A.avisar("Loja salva", "ok"); rota();
      }).catch(function (e) { A.ocupado(b, false); falhou(e); });
    };
    if (id) $("#lj-apagar", el).onclick = function () {
      if (!A.confirmar("Apagar " + nomeLoja(l) + "? Os serviços dessa loja continuam, só perdem o vínculo. Para só esconder, desmarque “Ativa”.")) return;
      q(sb.from("lojas").delete().eq("id", id)).then(function () {
        tirar(S.lojas, id); S.obras.forEach(function (o) { if (o.loja_id === id) o.loja_id = null; });
        j.fechar(); A.avisar("Apagada", "ok"); rota();
      }).catch(falhou);
    };
  }

  // Planilha CSV (separada por ; ou ,) com cabeçalho: codigo;tipo;nome;endereco;numero;complemento;bairro;cidade;uf;cep;cnpj;regiao;empresa[;telefone;lat;lng]
  function lerCsv(texto) {
    texto = texto.replace(/^﻿/, "");
    var prim = texto.split(/\r?\n/)[0] || "", sep = prim.split(";").length >= prim.split(",").length ? ";" : ",";
    var linhas = [], campoAtual = "", linha = [], aspas = false;
    for (var i = 0; i < texto.length; i++) {
      var ch = texto[i];
      if (aspas) {
        if (ch === '"') { if (texto[i + 1] === '"') { campoAtual += '"'; i++; } else aspas = false; } else campoAtual += ch;
      } else if (ch === '"') aspas = true;
      else if (ch === sep) { linha.push(campoAtual); campoAtual = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && texto[i + 1] === "\n") i++; linha.push(campoAtual); linhas.push(linha); linha = []; campoAtual = ""; }
      else campoAtual += ch;
    }
    if (campoAtual || linha.length) { linha.push(campoAtual); linhas.push(linha); }
    linhas = linhas.filter(function (l) { return l.some(function (x) { return x.trim(); }); });
    if (!linhas.length) return [];
    var cab = linhas.shift().map(function (h) { return semAcento(h).trim().replace(/[^a-z_]/g, ""); });
    return linhas.map(function (l) { var o = {}; cab.forEach(function (h, k) { o[h] = (l[k] || "").trim(); }); return o; });
  }
  // ---------- atualizar lojas pelo documento do Word (.doc/.docx) ou planilha (.csv) ----------
  var CAMPOS_LOJA = ["codigo", "tipo", "nome", "empresa", "endereco", "numero", "complemento", "bairro", "cidade", "uf", "cep", "cnpj", "regiao", "telefone"];
  var CAMPOS_ENDERECO = ["endereco", "numero", "bairro", "cidade", "uf", "cep"];
  var NOME_CAMPO = { codigo: "nº", tipo: "tipo", nome: "nome", empresa: "empresa", endereco: "rua", numero: "número", complemento: "complemento", bairro: "bairro",
    cidade: "cidade", uf: "UF", cep: "CEP", cnpj: "CNPJ", regiao: "região", telefone: "telefone", ativo: "situação" };
  var cfbPronto = null;
  function carregarCfb() {
    if (window.CFB && window.CFB.read) return Promise.resolve(window.CFB);
    if (!cfbPronto) {
      cfbPronto = new Promise(function (ok, falha) {
        var sc = document.createElement("script");
        sc.src = "https://cdn.jsdelivr.net/npm/cfb@1.2.2/dist/cfb.min.js";
        sc.onload = function () { if (window.CFB && window.CFB.read) ok(window.CFB); else { cfbPronto = null; falha(new Error("Falha ao carregar o leitor do Word.")); } };
        sc.onerror = function () { cfbPronto = null; sc.remove(); falha(new Error("Sem internet para ler o documento. Tente de novo.")); };
        document.head.appendChild(sc);
      });
    }
    return cfbPronto;
  }
  function lerArquivoLojas(arquivo) {
    var nome = arquivo.name.toLowerCase();
    if (/\.docx?$/.test(nome)) {
      return Promise.all([carregarCfb(), arquivo.arrayBuffer()]).then(function (r) {
        var D = window.AGE_LOJAS_DOC, lojas;
        try { lojas = D.extrairLojas(D.textoDoWord(new Uint8Array(r[1]), r[0])); }
        catch (e) { throw new Error("Não consegui ler o documento: " + A.msgErro(e)); }
        if (!lojas.length) throw new Error("Não achei lojas neste documento. Ele precisa seguir o modelo do DADOS DAS LOJAS (empresa e nº da loja, endereço com CEP e CNPJ).");
        return lojas;
      });
    }
    if (/\.csv$/.test(nome) || /csv/.test(arquivo.type)) {
      return arquivo.text().then(function (texto) {
        var linhas = lerCsv(texto);
        if (!linhas.length || !("nome" in linhas[0]) && !("codigo" in linhas[0])) throw new Error("Planilha sem as colunas esperadas (nome, codigo, endereco, cidade...).");
        return linhas;
      });
    }
    return Promise.reject(new Error("Escolha o documento do Word (.doc ou .docx) ou uma planilha .csv."));
  }
  function plural(n, um, varios) { return n + " " + (n === 1 ? um : varios); }
  function compararLojas(registros) {
    var porCnpj = {}, porCodigo = {}, usados = {};
    S.lojas.forEach(function (l) { if (l.cnpj) porCnpj[A.soDigitos(l.cnpj)] = l; if (l.codigo) porCodigo[l.tipo + "|" + l.codigo] = l; });
    var R2 = { novas: [], alteradas: [], iguais: 0, repetidas: 0, comLocal: [], sumidas: [] };
    registros.forEach(function (r) {
      var d = {};
      CAMPOS_LOJA.forEach(function (k) { d[k] = nulo(String(r[k] === null || r[k] === undefined ? "" : r[k]).trim()); });
      if (!d.nome && !d.codigo) return;
      d.tipo = ["loja", "cd", "posto", "outro"].indexOf(d.tipo) >= 0 ? d.tipo : "loja";
      d.nome = d.nome || "Loja " + d.codigo;
      d.uf = (d.uf || "MG").toUpperCase().slice(0, 2);
      var la = Number(String(r.lat || "").replace(",", ".")), ln = Number(String(r.lng || r.lon || "").replace(",", "."));
      var temCoord = r.lat && r.lng && isFinite(la) && isFinite(ln) && la && ln;
      var ex = (d.cnpj && porCnpj[A.soDigitos(d.cnpj)]) || (d.codigo && porCodigo[d.tipo + "|" + d.codigo]) || null;
      if (ex && usados[ex.id]) { R2.repetidas++; return; }
      if (!ex) { R2.novas.push(d); if (temCoord) R2.comLocal.push({ d: d, lat: la, lng: ln }); return; }
      usados[ex.id] = 1;
      var mud = {}, n = 0;
      CAMPOS_LOJA.forEach(function (k) {
        // campo vazio no documento não apaga o que já está no app
        if (d[k] !== null && d[k] !== (ex[k] === undefined ? null : ex[k])) { mud[k] = [ex[k], d[k]]; n++; }
      });
      if (!ex.ativo) { mud.ativo = [false, true]; n++; }
      if (temCoord) R2.comLocal.push({ id: ex.id, lat: la, lng: ln });
      if (!n) { R2.iguais++; return; }
      var endMudou = CAMPOS_ENDERECO.some(function (k) { return k in mud; });
      R2.alteradas.push({ loja: ex, mud: mud, endMudou: endMudou });
    });
    R2.sumidas = S.lojas.filter(function (l) { return l.ativo && !usados[l.id] && (l.cnpj || l.codigo); });
    return R2;
  }
  function importarLojas(arquivo) {
    lerArquivoLojas(arquivo).then(function (registros) {
      var C = compararLojas(registros);
      var lista = function (itens, fmt, max) {
        max = max || 80;
        return '<ul class="peq" style="max-height:260px;overflow:auto;margin:6px 0;padding-left:20px">' + itens.slice(0, max).map(fmt).join("") +
          (itens.length > max ? "<li>… e mais " + (itens.length - max) + "</li>" : "") + "</ul>";
      };
      var h = "<p>Arquivo <b>" + esc(arquivo.name) + "</b>: <b>" + registros.length + "</b> lojas lidas.</p>";
      h += '<details' + (C.novas.length && C.novas.length <= 30 ? " open" : "") + '><summary><b>🆕 ' + plural(C.novas.length, "loja nova", "lojas novas") + "</b></summary>" +
        (C.novas.length ? lista(C.novas, function (d) { return "<li>" + esc(rotuloLoja(d)) + (d.endereco ? " — " + esc(enderecoLoja(d)) : ' — <span style="color:var(--critico)">sem endereço no documento</span>') + "</li>"; }) : "") + "</details>";
      h += '<details' + (C.alteradas.length && C.alteradas.length <= 30 ? " open" : "") + '><summary><b>✏️ ' + plural(C.alteradas.length, "loja com dados alterados", "lojas com dados alterados") + "</b></summary>" +
        (C.alteradas.length ? lista(C.alteradas, function (a) {
          return "<li><b>" + esc(rotuloLoja(a.loja)) + "</b>: " + Object.keys(a.mud).map(function (k) {
            var v = a.mud[k];
            if (k === "ativo") return "volta a ficar ativa";
            return esc(NOME_CAMPO[k] || k) + ' "' + esc(v[0] || "") + '" → "' + esc(v[1] || "") + '"';
          }).join("; ") + (a.endMudou ? ' <span class="selo atencao">endereço mudou: localizar de novo</span>' : "") + "</li>";
        }) : "") + "</details>";
      h += "<p>✔ " + plural(C.iguais, "loja sem mudança", "lojas sem mudança") + (C.repetidas ? " · " + C.repetidas + " repetidas no arquivo (ignoradas)" : "") + "</p>";
      if (C.sumidas.length) {
        h += "<details><summary><b>❓ " + plural(C.sumidas.length, "loja do app não está neste arquivo", "lojas do app não estão neste arquivo") + "</b></summary>" +
          lista(C.sumidas, function (l) { return "<li>" + esc(rotuloLoja(l)) + "</li>"; }) + "</details>" +
          '<label class="marca-linha"><input type="checkbox" id="imp-desativar"> ' + (C.sumidas.length === 1 ? "Desativar essa loja" : "Desativar essas " + C.sumidas.length + " lojas") + " (some das rotas; dá para reativar)</label>";
      }
      var nada = !C.novas.length && !C.alteradas.length && !C.comLocal.length;
      h += '<div class="acoes"><button class="prim" id="ok-imp">' + (nada && !C.sumidas.length ? "Fechar" : "Atualizar lojas") + "</button></div>";
      var j = A.janela(h, { titulo: "Atualizar lojas", larga: true });
      $("#ok-imp", j.el).onclick = function () {
        var desativar = $("#imp-desativar", j.el) && $("#imp-desativar", j.el).checked;
        if (nada && !desativar) { j.fechar(); return; }
        var b = this; A.ocupado(b, true, "Atualizando...");
        var passos = Promise.resolve();
        for (var i = 0; i < C.novas.length; i += 200) {
          (function (lote) { passos = passos.then(function () { return q(sb.from("lojas").insert(lote).select()); }); })(C.novas.slice(i, i + 200));
        }
        C.alteradas.forEach(function (a) {
          var dados = {};
          Object.keys(a.mud).forEach(function (k) { dados[k] = a.mud[k][1]; });
          if (a.endMudou) { dados.lat = null; dados.lng = null; dados.geo_precisao = null; }
          passos = passos.then(function () { return q(sb.from("lojas").update(dados).eq("id", a.loja.id).select()); });
        });
        if (desativar) {
          var ids = C.sumidas.map(function (l) { return l.id; });
          passos = passos.then(function () { return q(sb.from("lojas").update({ ativo: false }).in("id", ids).select()); });
        }
        passos.then(function () {
          return q(sb.from("lojas").select("*").limit(5000)).then(function (todas) {
            S.lojas = todas; ordenarLojas();
            // coordenadas que vieram na planilha (se tiver)
            var porChave = {};
            todas.forEach(function (l) { if (l.cnpj) porChave["c" + A.soDigitos(l.cnpj)] = l; if (l.codigo) porChave["k" + l.tipo + "|" + l.codigo] = l; });
            return C.comLocal.reduce(function (p, x) {
              var l = x.id ? porId(S.lojas, x.id) : (x.d.cnpj && porChave["c" + A.soDigitos(x.d.cnpj)]) || porChave["k" + x.d.tipo + "|" + x.d.codigo];
              if (!l) return p;
              return p.then(function () { return q(sb.from("lojas").update({ lat: x.lat, lng: x.lng, geo_precisao: "manual" }).eq("id", l.id).select().single()).then(function (n) { trocar(S.lojas, n); }); });
            }, Promise.resolve());
          });
        }).then(function () {
          j.fechar(); ordenarLojas(); rota();
          A.avisar("Lojas atualizadas: " + plural(C.novas.length, "nova", "novas") + ", " + plural(C.alteradas.length, "alterada", "alteradas") + (desativar ? ", " + plural(C.sumidas.length, "desativada", "desativadas") : ""), "ok");
          var sem = S.lojas.filter(function (l) { return l.ativo && !G.temLocal(l); }).length;
          if (sem && A.confirmar(sem + " lojas ainda não estão no mapa. Localizar agora pelo endereço? (leva cerca de " + Math.max(1, Math.ceil(sem * 2.5 / 60)) + " min; pode deixar rodando)")) localizarLojas();
        }).catch(function (e) {
          A.ocupado(b, false); falhou(e);
          // recarrega para mostrar o que já foi gravado antes do erro
          q(sb.from("lojas").select("*").limit(5000)).then(function (todas) { S.lojas = todas; ordenarLojas(); }).catch(function () { /* fica a lista atual */ });
        });
      };
    }).catch(falhou);
  }

  // Localiza no mapa as lojas sem coordenadas (1 consulta por segundo, regra do serviço gratuito)
  function localizarLojas() {
    var semLocal = S.lojas.filter(function (l) { return l.ativo && !G.temLocal(l); });
    var aproximadas = S.lojas.filter(function (l) { return l.ativo && G.temLocal(l) && NIVEL[l.geo_precisao] <= 2; });
    var parar = false, rodando = false;
    var j = A.janela('<p><b>' + semLocal.length + "</b> lojas sem local e <b>" + aproximadas.length + "</b> com local aproximado.</p>" +
      '<label class="marca-linha"><input type="checkbox" id="lg-aprox"> Tentar melhorar também as aproximadas</label>' +
      '<p class="peq mudo">Usa o mapa gratuito OpenStreetMap: procura pelo endereço; se não achar, pelo CEP, bairro e por último a cidade. ' +
      "É devagar de propósito (regra do serviço gratuito). Pode deixar a tela aberta. O que for achado já fica salvo.</p>" +
      '<div class="cartao" id="lg-prog" style="display:none"><div class="linha"><b id="lg-txt"></b></div>' +
      '<div style="height:8px;background:var(--sup2);border-radius:4px;margin-top:8px;overflow:hidden"><div id="lg-barra" style="height:100%;width:0;background:var(--prim)"></div></div>' +
      '<div class="peq mudo" id="lg-ult" style="margin-top:6px"></div></div>' +
      '<div class="acoes"><button class="prim" id="lg-ir">Começar</button></div>',
      { titulo: "Localizar lojas no mapa", fixa: true, aoFechar: function () { parar = true; } });
    var el = j.el;
    $("#lg-ir", el).onclick = function () {
      if (rodando) { parar = true; return; }
      var lista = semLocal.concat($("#lg-aprox", el).checked ? aproximadas : []).filter(function (l) { return porId(S.lojas, l.id); });
      if (!lista.length) { A.avisar("Nada para localizar."); return; }
      parar = false; rodando = true; this.textContent = "⏸ Pausar";
      $("#lg-prog", el).style.display = "";
      var b = this, feitas = 0, achadas = 0, falhas = 0;
      (function proxima(i) {
        $("#lg-txt", el).textContent = feitas + " de " + lista.length + " · achadas " + achadas + (falhas ? " · não achadas " + falhas : "");
        $("#lg-barra", el).style.width = (feitas / lista.length * 100) + "%";
        if (parar || i >= lista.length) {
          rodando = false; b.textContent = i >= lista.length ? "Concluído" : "▶ Continuar";
          if (i >= lista.length) { b.disabled = true; A.avisar("Localização concluída: " + achadas + " lojas no mapa", "ok"); }
          semLocal = lista.slice(i); aproximadas = [];
          if (location.hash.slice(1) === "lojas" || location.hash.slice(1) === "rotas") rota();
          return;
        }
        var l = lista[i];
        $("#lg-ult", el).textContent = "Procurando " + nomeLoja(l) + " (" + (l.cidade || "?") + ")...";
        G.localizar(l).then(function (r) {
          feitas++;
          if (!r || (G.temLocal(l) && NIVEL[r.geo_precisao] <= NIVEL[l.geo_precisao])) { if (!r) falhas++; return; }
          achadas++;
          return q(sb.from("lojas").update({ lat: r.lat, lng: r.lng, geo_precisao: r.geo_precisao }).eq("id", l.id).select().single()).then(function (n) { trocar(S.lojas, n); });
        }).then(function () { proxima(i + 1); }, function (e) {
          A.avisar(A.msgErro(e), "erro");
          parar = true; proxima(i);
        });
      })(0);
    };
  }

  // =================================================================
  // ROTAS (lojas próximas no mesmo dia, na melhor ordem)
  // =================================================================
  var R = { partida: "gps", partidaLoja: "", modo: "servicos", cat: "", raio: 15, porDia: 6, juntar: 40, voltar: false, escolhidas: {}, plano: null, origem: null, mapa: null };

  function lojasComServico(cat) {
    var mapa = {};
    S.serv.forEach(function (s) {
      if (!(s.status === "aberto" || s.status === "em_andamento") || (cat && s.categoria !== cat)) return;
      var o = porId(S.obras, s.obra_id), l = o && o.loja_id ? porId(S.lojas, o.loja_id) : null;
      if (!l) return;
      (mapa[l.id] = mapa[l.id] || { loja: l, servicos: [] }).servicos.push(s);
    });
    return Object.keys(mapa).map(function (k) { return mapa[k]; });
  }

  function verRotas(c) {
    var base = A.CFG.BASE && G.temLocal(A.CFG.BASE) ? A.CFG.BASE : null;
    c.innerHTML = '<div class="cab-secao"><h2>Rotas</h2></div>' +
      (S.lojas.length ? "" : '<div class="aviso">Cadastre ou importe as lojas na aba <a href="#lojas">Lojas</a> para montar rotas.</div>') +
      '<div class="cartao"><div class="duas"><div><label for="rt-partida">Saindo de</label><select id="rt-partida"><option value="gps">📍 Minha localização agora</option>' +
      (base ? '<option value="base">🏠 ' + esc(base.nome || "Base da AGE") + "</option>" : "") + '<option value="loja">🏪 Uma loja...</option>' +
      '<option value="nenhuma">— sem ponto de partida (começa na 1ª loja)</option></select>' +
      '<input id="rt-partida-loja" list="rt-dl-lojas" class="oculto" style="margin-top:6px" placeholder="Digite a loja de partida"></div>' +
      '<div><label for="rt-modo">Quais lojas</label><select id="rt-modo"><option value="servicos">Lojas com serviço aberto</option>' +
      '<option value="escolher">Escolher as lojas</option><option value="raio">Todas as lojas perto da partida</option></select>' +
      '<div id="rt-modo-extra" style="margin-top:6px"></div></div></div>' +
      '<div class="duas"><div><label for="rt-pordia">Máximo de lojas por dia</label><input id="rt-pordia" type="number" min="1" max="40" value="' + R.porDia + '"></div>' +
      '<div><label for="rt-juntar">Só junta no mesmo dia lojas a até (km)</label><input id="rt-juntar" type="number" min="1" max="500" value="' + R.juntar + '"></div></div>' +
      '<label class="marca-linha"><input type="checkbox" id="rt-voltar"> Voltar ao ponto de partida no fim do dia</label>' +
      '<datalist id="rt-dl-lojas">' + S.lojas.filter(function (l) { return l.ativo && G.temLocal(l); }).map(function (l) { return '<option value="' + esc(rotuloLoja(l)) + '">'; }).join("") + "</datalist>" +
      '<div class="acoes"><button class="prim" id="rt-montar">🧭 Montar rota</button></div></div>' +
      '<div id="rt-resultado"></div>' +
      '<div class="cab-secao" style="margin-top:18px"><h2>Rotas salvas</h2></div><div id="rt-salvas"></div>';
    $("#rt-partida").value = R.partida === "base" && !base ? "gps" : R.partida;
    $("#rt-partida-loja").value = R.partidaLoja;
    $("#rt-modo").value = R.modo; $("#rt-voltar").checked = R.voltar;
    function extras() {
      $("#rt-partida-loja").classList.toggle("oculto", $("#rt-partida").value !== "loja");
      var m = $("#rt-modo").value, x = $("#rt-modo-extra");
      if (m === "servicos") {
        x.innerHTML = '<select id="rt-cat" aria-label="Área"><option value="">Elétrica e pintura</option><option value="eletrica">⚡ Só elétrica</option><option value="pintura">🖌️ Só pintura</option></select>' +
          '<div class="peq mudo" style="margin-top:4px">' + lojasComServico(R.cat).length + " lojas com serviço aberto (serviços ligados a uma loja)</div>";
        $("#rt-cat").value = R.cat;
        $("#rt-cat").onchange = function () { R.cat = this.value; extras(); };
      } else if (m === "escolher") {
        x.innerHTML = '<button id="rt-esc">✔ Escolher lojas (' + Object.keys(R.escolhidas).length + " escolhidas)</button>";
        $("#rt-esc").onclick = escolherLojas;
      } else {
        x.innerHTML = '<div class="linha"><input id="rt-raio" type="number" min="1" max="500" value="' + R.raio + '" style="width:90px"> <span>km de distância</span></div>';
        $("#rt-raio").oninput = function () { R.raio = Number(this.value) || 15; };
      }
    }
    extras();
    $("#rt-partida").onchange = function () { R.partida = this.value; extras(); };
    $("#rt-partida-loja").onchange = function () { R.partidaLoja = this.value; };
    $("#rt-modo").onchange = function () { R.modo = this.value; extras(); };
    $("#rt-pordia").oninput = function () { R.porDia = Math.max(1, Math.min(40, parseInt(this.value, 10) || 6)); };
    $("#rt-juntar").oninput = function () { R.juntar = Math.max(1, Number(this.value) || 40); };
    $("#rt-voltar").onchange = function () { R.voltar = this.checked; };
    $("#rt-montar").onclick = function () { montarRota(this); };
    function escolherLojas() {
      var F = { busca: "", cidade: "", regiao: "" };
      var j = A.janela(htmlFiltrosLojas("re", F) + '<div class="linha" style="margin-bottom:8px"><button class="peq" id="re-todas">Marcar as da lista</button>' +
        '<button class="peq" id="re-nenhuma">Desmarcar as da lista</button><span class="dir forte" id="re-cont"></span></div><div id="re-lista"></div>' +
        '<div class="acoes"><button class="prim" id="re-ok">Concluir</button></div>', { titulo: "Escolher lojas", larga: true, aoFechar: extras });
      var el = j.el;
      function listar() {
        var lista = filtrarLojas(F);
        $("#re-cont", el).textContent = Object.keys(R.escolhidas).length + " escolhidas";
        $("#re-lista", el).innerHTML = lista.slice(0, 600).map(function (l) {
          return '<label class="marca-linha" style="font-weight:400;margin:4px 0"><input type="checkbox" data-esc="' + l.id + '"' + (R.escolhidas[l.id] ? " checked" : "") + "> " +
            esc(rotuloLoja(l)) + " " + seloLocal(l) + "</label>";
        }).join("") || '<div class="vazio">Nenhuma loja com este filtro.</div>';
        $$("[data-esc]", el).forEach(function (cb) {
          cb.onchange = function () { if (this.checked) R.escolhidas[this.dataset.esc] = 1; else delete R.escolhidas[this.dataset.esc]; $("#re-cont", el).textContent = Object.keys(R.escolhidas).length + " escolhidas"; };
        });
      }
      ligarFiltrosLojas(el, "re", F, listar);
      $("#re-todas", el).onclick = function () { filtrarLojas(F).forEach(function (l) { R.escolhidas[l.id] = 1; }); listar(); };
      $("#re-nenhuma", el).onclick = function () { filtrarLojas(F).forEach(function (l) { delete R.escolhidas[l.id]; }); listar(); };
      $("#re-ok", el).onclick = function () { j.fechar(); };
      listar();
    }
    desenharResultado();
    desenharSalvas();
  }

  function obterPartida() {
    var tipo = R.partida;
    if (tipo === "nenhuma") return Promise.resolve(null);
    if (tipo === "base") { var b = A.CFG.BASE; return Promise.resolve({ nome: b.nome || "Base da AGE", lat: Number(b.lat), lng: Number(b.lng) }); }
    if (tipo === "loja") {
      var l = lojaPorRotulo(R.partidaLoja);
      if (!l || !G.temLocal(l)) return Promise.reject(new Error("Escolha a loja de partida (precisa estar localizada no mapa)."));
      return Promise.resolve({ nome: nomeLoja(l), lat: l.lat, lng: l.lng, lojaId: l.id });
    }
    return posicaoAtual(false).then(function (p) { return { nome: "Minha localização", lat: p.lat, lng: p.lng, gps: true }; });
  }

  function montarRota(b) {
    A.ocupado(b, true, "Montando...");
    obterPartida().then(function (partida) {
      var lojas;
      if (R.modo === "servicos") {
        lojas = lojasComServico(R.cat).map(function (x) { return Object.assign({}, x.loja, { servicos: x.servicos }); });
        if (!lojas.length) throw new Error("Nenhuma loja com serviço aberto. Ao criar o serviço, escolha a loja no campo “Loja da rede”.");
      } else if (R.modo === "escolher") {
        lojas = Object.keys(R.escolhidas).map(function (id) { return porId(S.lojas, id); }).filter(Boolean);
        if (!lojas.length) throw new Error("Escolha as lojas primeiro.");
      } else {
        if (!partida) throw new Error("Para “lojas perto”, escolha de onde vai sair.");
        lojas = G.perto(partida, S.lojas.filter(function (l) { return l.ativo; }), R.raio);
        if (!lojas.length) throw new Error("Nenhuma loja localizada a até " + R.raio + " km.");
      }
      if (partida && partida.lojaId) lojas = lojas.filter(function (l) { return l.id !== partida.lojaId; });
      R.origem = partida;
      R.plano = G.planejar(partida, lojas, { porDia: R.porDia, voltar: R.voltar, raioRegiao: R.juntar });
      A.ocupado(b, false);
      desenharResultado();
      var res = $("#rt-resultado"); if (res) res.scrollIntoView({ behavior: "smooth", block: "start" });
    }).catch(function (e) { A.ocupado(b, false); falhou(e); });
  }

  function htmlParada(p, i, ant) {
    var d = ant ? G.km(ant, p) * G.FATOR_ESTRADA : null;
    return '<li style="margin:6px 0"><b>' + esc(nomeLoja(p)) + "</b> " + (NIVEL[p.geo_precisao] <= 2 ? '<span class="selo atencao">local aproximado</span>' : "") +
      (d !== null ? ' <span class="mudo peq">+' + A.numero(d, 1) + " km</span>" : "") +
      '<div class="peq mudo">' + esc(enderecoLoja(p)) + "</div>" +
      (p.servicos ? '<div class="peq">' + p.servicos.map(function (s) { return A.seloCategoria(s.categoria) + " " + esc((s.descricao || "").slice(0, 60)); }).join("<br>") + "</div>" : "") + "</li>";
  }

  function desenharResultado() {
    var c = $("#rt-resultado");
    if (!c) return;
    if (R.mapa) { try { R.mapa.remove(); } catch (e) { /* mapa já removido */ } R.mapa = null; }
    var P = R.plano;
    if (!P) { c.innerHTML = ""; return; }
    var total = P.dias.reduce(function (t, d) { return t + d.kmEstrada; }, 0);
    var h = '<div class="cab-secao" style="margin-top:14px"><h2>' + P.dias.length + (P.dias.length === 1 ? " dia" : " dias") + " · " +
      P.dias.reduce(function (t, d) { return t + d.paradas.length; }, 0) + " paradas</h2><span class=\"mudo peq\">≈ " + A.numero(total, 0) + " km no total (estimado)</span></div>";
    if (P.semLocal.length) h += '<div class="aviso">⚠ ' + P.semLocal.length + " loja(s) ficaram de fora por não estarem no mapa: " +
      P.semLocal.slice(0, 8).map(function (l) { return esc(nomeLoja(l)); }).join(", ") + (P.semLocal.length > 8 ? "…" : "") + '. Localize na aba <a href="#lojas">Lojas</a>.</div>';
    h += '<div id="rt-mapa" style="height:340px;border-radius:12px;margin-bottom:12px;background:var(--sup2)"></div>';
    P.dias.forEach(function (d, i) {
      var links = G.linksGoogle(R.origem && !R.origem.gps ? R.origem : null, d.paradas, R.voltar);
      h += '<div class="cartao" style="border-left:5px solid ' + CORES_DIA[i % CORES_DIA.length] + '"><div class="linha"><h3>Dia ' + (i + 1) + "</h3>" +
        '<span class="mudo peq">' + d.paradas.length + " paradas · ≈ " + A.numero(d.kmEstrada, 0) + " km</span></div>" +
        (R.origem ? '<div class="peq mudo" style="margin-top:4px">Saída: ' + esc(R.origem.nome) + "</div>" : "") +
        '<ol style="padding-left:22px;margin:6px 0">' + d.paradas.map(function (p, k) { return htmlParada(p, k, k ? d.paradas[k - 1] : R.origem); }).join("") + "</ol>" +
        '<div class="acoes">' + links.map(function (u, k) {
          return '<a class="botao" target="_blank" rel="noopener" href="' + esc(u) + '">🗺 Google Maps' + (links.length > 1 ? " (parte " + (k + 1) + ")" : "") + "</a>";
        }).join("") + '<button class="prim" data-salvar-dia="' + i + '">💾 Salvar / enviar ao funcionário</button></div></div>';
    });
    c.innerHTML = h;
    $$("[data-salvar-dia]", c).forEach(function (b) { b.onclick = function () { salvarRota(Number(b.dataset.salvarDia)); }; });
    desenharMapa($("#rt-mapa"), P.dias, R.origem);
  }

  var leafletPronto = null;
  function carregarLeaflet() {
    if (window.L && window.L.map) return Promise.resolve(window.L);
    if (!leafletPronto) {
      leafletPronto = new Promise(function (ok, falha) {
        var css = document.createElement("link");
        css.rel = "stylesheet"; css.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(css);
        var sc = document.createElement("script");
        sc.src = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";
        sc.onload = function () { ok(window.L); };
        sc.onerror = function () { leafletPronto = null; sc.remove(); falha(new Error("Mapa indisponível sem internet.")); };
        document.head.appendChild(sc);
      });
    }
    return leafletPronto;
  }
  function desenharMapa(caixa, dias, origem) {
    if (!caixa) return;
    carregarLeaflet().then(function (L) {
      if (!document.body.contains(caixa)) return;
      var m = L.map(caixa, { scrollWheelZoom: false });
      R.mapa = m;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
      var todos = [];
      if (origem) {
        L.circleMarker([origem.lat, origem.lng], { radius: 8, color: "#111", fillColor: "#fff", fillOpacity: 1, weight: 3 }).addTo(m).bindTooltip("Saída: " + origem.nome);
        todos.push([origem.lat, origem.lng]);
      }
      dias.forEach(function (d, i) {
        var cor = CORES_DIA[i % CORES_DIA.length];
        var linha = (origem ? [[origem.lat, origem.lng]] : []).concat(d.paradas.map(function (p) { return [p.lat, p.lng]; }));
        L.polyline(linha, { color: cor, weight: 3, opacity: .8 }).addTo(m);
        d.paradas.forEach(function (p, k) {
          todos.push([p.lat, p.lng]);
          L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "", iconSize: [24, 24], iconAnchor: [12, 12],
            html: '<div style="width:24px;height:24px;border-radius:50%;background:' + cor + ';color:#fff;font:700 12px/24px sans-serif;text-align:center;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)">' + (k + 1) + "</div>" }) })
            .addTo(m).bindTooltip("Dia " + (i + 1) + " · " + (k + 1) + ". " + esc(nomeLoja(p)));
        });
      });
      if (todos.length) m.fitBounds(todos, { padding: [24, 24], maxZoom: 15 });
    }).catch(function (e) { caixa.innerHTML = '<div class="vazio">' + esc(A.msgErro(e)) + "</div>"; });
  }

  function paradaParaSalvar(p) {
    return { loja_id: p.id, codigo: p.codigo, tipo: p.tipo, nome: p.nome, endereco: p.endereco, numero: p.numero, complemento: p.complemento,
      bairro: p.bairro, cidade: p.cidade, uf: p.uf, lat: p.lat, lng: p.lng, geo_precisao: p.geo_precisao };
  }
  function msgRota(r) {
    var f = porId(S.func, r.funcionario_id);
    var t = "*AGE Elétrica e Pintura — " + r.nome + "*\n" + (r.data ? "Data: " + A.dataSimples(r.data) + "\n" : "") + r.paradas.length + " paradas, na ordem:\n\n";
    r.paradas.forEach(function (p, i) { t += (i + 1) + ". " + nomeLoja(p) + "\n   " + enderecoLoja(p) + "\n   " + G.linkNavegar(p) + "\n"; });
    var links = G.linksGoogle(r.partida && G.temLocal(r.partida) ? r.partida : null, r.paradas, false);
    t += "\nRota completa no Google Maps" + (links.length > 1 ? " (em partes)" : "") + ":\n" + links.join("\n");
    if (f) t += "\n\nA rota também aparece no seu app:\n" + linkFunc(f);
    return t;
  }
  function salvarRota(i) {
    var d = R.plano.dias[i], hoje = A.isoLocal(new Date());
    var j = A.janela('<label for="sr-nome">Nome da rota</label><input id="sr-nome" maxlength="120" value="' + esc("Rota " + A.data(new Date()) + " – dia " + (i + 1)) + '">' +
      '<div class="duas"><div><label for="sr-data">Data</label><input id="sr-data" type="date" value="' + hoje + '"></div>' +
      '<div><label for="sr-func">Funcionário</label><select id="sr-func">' + opcoesFunc(null, null) + "</select></div></div>" +
      '<p class="peq mudo">O funcionário vê a rota no app (do dia marcado em diante) com botões para navegar até cada loja.</p>' +
      '<div class="acoes"><button class="prim" id="sr-ok">Salvar</button></div>', { titulo: "Salvar rota" });
    var el = j.el;
    $("#sr-ok", el).onclick = function () {
      var b = this; A.ocupado(b, true, "Salvando...");
      var partida = R.origem && !R.origem.gps ? { nome: R.origem.nome, lat: R.origem.lat, lng: R.origem.lng } : null;
      q(sb.from("rotas").insert({ nome: val(el, "#sr-nome") || "Rota", data: nulo($("#sr-data", el).value), funcionario_id: nulo($("#sr-func", el).value),
        partida: partida, paradas: d.paradas.map(paradaParaSalvar), km: Math.round(d.kmEstrada * 10) / 10 }).select().single()).then(function (n) {
        S.rotas.unshift(n); j.fechar(); desenharSalvas(); A.avisar("Rota salva", "ok");
        var f = porId(S.func, n.funcionario_id);
        if (f && f.telefone) A.janela('<p>Rota salva para ' + esc(f.nome) + ".</p>" + '<div class="acoes"><a class="botao zap" target="_blank" rel="noopener" href="' +
          esc(A.linkZap(f.telefone, msgRota(n))) + '">📲 Enviar a rota no WhatsApp</a></div>', { titulo: "Rota salva" });
      }).catch(function (e) { A.ocupado(b, false); falhou(e); });
    };
  }
  function desenharSalvas() {
    var c = $("#rt-salvas");
    if (!c) return;
    if (!S.rotas.length) { c.innerHTML = '<div class="cartao vazio">Nenhuma rota salva.</div>'; return; }
    c.innerHTML = S.rotas.slice(0, 60).map(function (r) {
      var f = porId(S.func, r.funcionario_id), links = G.linksGoogle(r.partida && G.temLocal(r.partida) ? r.partida : null, r.paradas || [], false);
      return '<div class="cartao"><div class="linha"><h3>' + esc(r.nome) + "</h3>" + (r.data ? '<span class="selo">📅 ' + A.dataSimples(r.data) + "</span>" : "") +
        '<span class="dir mudo peq">' + (r.paradas || []).length + " paradas" + (r.km ? " · ≈ " + A.numero(r.km, 0) + " km" : "") + "</span></div>" +
        '<div class="peq">' + (f ? "👷 " + esc(f.nome) : '<span class="mudo">sem funcionário</span>') + " · " +
        esc((r.paradas || []).map(function (p) { return p.codigo || p.nome; }).join(" → ")) + "</div>" +
        '<div class="acoes">' + links.map(function (u, k) { return '<a class="botao peq" target="_blank" rel="noopener" href="' + esc(u) + '">🗺 Google Maps' + (links.length > 1 ? " " + (k + 1) : "") + "</a>"; }).join("") +
        (f && f.telefone ? '<a class="botao peq zap" target="_blank" rel="noopener" href="' + esc(A.linkZap(f.telefone, msgRota(r))) + '">📲 WhatsApp</a>' : "") +
        '<button class="peq perigo" data-apagar-rota="' + r.id + '">Apagar</button></div></div>';
    }).join("");
    $$("[data-apagar-rota]", c).forEach(function (b) {
      b.onclick = function () {
        if (!A.confirmar("Apagar esta rota?")) return;
        q(sb.from("rotas").delete().eq("id", b.dataset.apagarRota)).then(function () { tirar(S.rotas, b.dataset.apagarRota); desenharSalvas(); }).catch(falhou);
      };
    });
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

  // o módulo da prefeitura (prefeitura.js) usa as mesmas funções do painel
  var P = {
    get sb() { return sb; }, S: S, q: q, porId: porId, trocar: trocar, tirar: tirar, falhou: falhou, nomeFunc: nomeFunc, carregando: carregando,
    val: val, nulo: nulo, htmlFoto: htmlFoto, hidratarFotos: hidratarFotos, infoFoto: infoFoto, registrarInfoPonto: registrarInfoPonto,
    opcoesFunc: opcoesFunc, formParte: formParte, botaoZap: botaoZap, seloOS: seloOS, abrirServico: abrirServico, abrirRelatorio: abrirRelatorio,
    rota: rota, carregarJsPdf: carregarJsPdf, baixar: baixar, podeCompartilharArquivo: podeCompartilharArquivo, UNIDADES: UNIDADES
  };

  iniciar();
})();
