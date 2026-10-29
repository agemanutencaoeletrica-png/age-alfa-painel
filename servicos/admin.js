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
  var filtroServ = { cat: "", st: "ativos", func: "", busca: "", ordem: "recentes" };
  var filtroPonto = null;
  var filtroRel = "nao_lidos", filtroRelTipo = "";
  var ABAS = [["hoje", "Hoje"], ["servicos", "Serviços"], ["executados", "✅ Executados"], ["prefeitura", "🏛️ Prefeitura"], ["rotas", "Rotas"], ["lojas", "Lojas"], ["ponto", "Ponto"], ["pagamentos", "💰 Pagamentos"], ["compras", "🧾 Compras"], ["faturamento", "💼 Notas e resultado"], ["prospeccao", "🎯 Prospecção"], ["veiculos", "🚗 Veículos"], ["relatorios", "Relatórios"], ["orcamentos", "Orçamentos"], ["precos", "💲 Preços"], ["equipe", "Equipe"]];
  // corretor dos itens do orçamento: palavras do dia a dia de elétrica e pintura escritas sem acento ou com erro comum
  var CORRECOES = {
    eletrica: "elétrica", eletricas: "elétricas", eletrico: "elétrico", eletricos: "elétricos", eletricista: "eletricista",
    bifasica: "bifásica", bifasico: "bifásico", trifasica: "trifásica", trifasico: "trifásico", monofasica: "monofásica", monofasico: "monofásico",
    distribuicao: "distribuição", distribicao: "distribuição", distribiçao: "distribuição", distribição: "distribuição", distribuiçao: "distribuição",
    instalacao: "instalação", instalaçao: "instalação", istalacao: "instalação", istalação: "instalação", istalarção: "instalação", instalarção: "instalação",
    instalacoes: "instalações", istalar: "instalar", adequarçao: "adequação", adequarção: "adequação", adequaçao: "adequação", adequacao: "adequação", espostos: "expostos", esposto: "exposto", espostas: "expostas", indentificar: "identificar", indentificacao: "identificação", identificacao: "identificação", vistoria: "vistoria", instalacão: "instalação", lancar: "lançar", lancamento: "lançamento", manutencao: "manutenção", manutençao: "manutenção", iluminacao: "iluminação", iluminaçao: "iluminação",
    fixacao: "fixação", fixaçao: "fixação", fixaçar: "fixar", conexao: "conexão", conexoes: "conexões", extensao: "extensão", tensao: "tensão",
    potencia: "potência", saida: "saída", saidas: "saídas", padrao: "padrão", medicao: "medição", protecao: "proteção", ligacao: "ligação", ligacoes: "ligações",
    alimentacao: "alimentação", substituicao: "substituição", substituiçao: "substituição", adequacao: "adequação", revisao: "revisão",
    conteiner: "contêiner", conteineres: "contêineres", container: "contêiner", metalica: "metálica", metalicas: "metálicas", metalico: "metálico",
    galpao: "galpão", galpoes: "galpões", industria: "indústria", industrial: "industrial", epoxi: "epóxi", epoxy: "epóxi",
    demarcacao: "demarcação", sinalizacao: "sinalização", impermeabilizacao: "impermeabilização", pintura: "pintura", demaos: "demãos", demao: "demão",
    servico: "serviço", servicos: "serviços", mao: "mão", area: "área", areas: "áreas", agua: "água", calcada: "calçada",
    eletrocalha: "eletrocalha", eletroduto: "eletroduto", disjuntor: "disjuntor", diferencial: "diferencial", aterramento: "aterramento",
    refletor: "refletor", refletores: "refletores", lampada: "lâmpada", lampadas: "lâmpadas", luminaria: "luminária", luminarias: "luminárias",
    tomadas: "tomadas", interruptor: "interruptor", chuveiro: "chuveiro", chuveiros: "chuveiros", poste: "poste", postes: "postes",
    rapido: "rápido", tecnico: "técnico", tecnica: "técnica", eletronico: "eletrônico", automatico: "automático", automatica: "automática",
    cabeamento: "cabeamento", subterraneo: "subterrâneo", subterranea: "subterrânea", aereo: "aéreo", aerea: "aérea"
  };
  // corrige palavra a palavra mantendo MAIÚSCULAS / Primeira maiúscula; devolve o texto e a lista do que mudou
  function corrigirTexto(t) {
    var feitas = [];
    var novo = String(t || "").replace(/[A-Za-zÀ-ÿ]+/g, function (w) {
      var c = CORRECOES[w.toLowerCase()];
      if (!c || c === w.toLowerCase()) return w;
      var r = w === w.toUpperCase() ? c.toLocaleUpperCase("pt-BR") : (w.charAt(0) === w.charAt(0).toUpperCase() ? c.charAt(0).toUpperCase() + c.slice(1) : c);
      if (r !== w) feitas.push(w + " → " + r);
      return r;
    });
    return { texto: novo, feitas: feitas };
  }
  var GRUPO_MAT_ORC = "Materiais (dos orçamentos)";
  // item da 💲 tabela que é material (lista de materiais ou aprendido de orçamento)
  function ehMaterialPreco(x) { return /^Materiais/.test(String((x && x.grupo) || "")); }
  function soMateriais(o) { return o && o.tipo === "materiais"; }
  function nomeOrc(o, maiusc) { var t = soMateriais(o) ? "Orçamento de materiais" : "Orçamento"; return maiusc ? t.toUpperCase() : t; }
  var STATUS_ORC = { rascunho: "Rascunho", enviado: "Enviado", aprovado: "Aprovado", recusado: "Recusado" };
  var COR_ORC = { rascunho: "", enviado: "atencao", aprovado: "bom", recusado: "critico" };
  var CAT_ORC = { eletrica: "Elétrica", pintura: "Pintura", eletrica_pintura: "Elétrica e pintura" };
  var UNIDADES = ["un", "m", "m²", "barra", "rolo", "L", "galão", "lata", "balde", "kg", "cx", "pç", "par", "cento", "kit", "serv", "h", "dia", "vb"];

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
      '<div style="margin-top:10px">' + (infoFoto[caminho] || "") + "</div>" +
      (u ? '<div class="acoes"><button class="peq" id="af-comp">📤 Compartilhar</button><button class="peq" id="af-baixar">⬇️ Baixar</button></div>' : ""), { titulo: "Foto", larga: true });
    var txt = String(infoFoto[caminho] || "").replace(/<[^>]*>/g, "");
    if (u) { $("#af-comp", j.el).onclick = function () { compartilharFotos([caminho], "Foto", txt, this); }; $("#af-baixar", j.el).onclick = function () { baixarFotos([caminho], "foto", this); }; }
    return j;
  }
  // ---------- tirar as fotos do app: compartilhar (WhatsApp...) ou baixar ----------
  function nomeArq(t) { return semAcento(t).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "foto"; }
  function arquivosDasFotos(caminhos, prefixo) {
    return q(sb.storage.from("fotos").createSignedUrls(caminhos, 600)).then(function (lista) {
      return Promise.all((lista || []).map(function (x, i) {
        if (!x.signedUrl) return null;
        return fetch(x.signedUrl).then(function (r) { return r.blob(); }).then(function (b) {
          return new File([b], nomeArq(prefixo) + "-" + (i + 1) + ".jpg", { type: /^image\//.test(b.type) ? b.type : "image/jpeg" });
        }).catch(function () { return null; });
      }));
    }).then(function (fs) { return fs.filter(Boolean); });
  }
  function baixarFotos(caminhos, prefixo, b) {
    if (b) A.ocupado(b, true, "Baixando...");
    return arquivosDasFotos(caminhos, prefixo).then(function (fs) {
      if (b) A.ocupado(b, false);
      if (!fs.length) { A.avisar("Não consegui baixar as fotos.", "erro"); return; }
      fs.forEach(function (f, i) { setTimeout(function () { baixar(f, f.name); }, i * 400); });   // uma por vez (o navegador pode pedir para permitir vários downloads)
      A.avisar("⬇️ " + fs.length + " foto" + (fs.length > 1 ? "s" : "") + " baixada" + (fs.length > 1 ? "s" : ""), "ok");
    }).catch(function (e) { if (b) A.ocupado(b, false); falhou(e); });
  }
  function compartilharFotos(caminhos, titulo, texto, b) {
    if (b) A.ocupado(b, true, "Preparando...");
    return arquivosDasFotos(caminhos, titulo).then(function (fs) {
      if (b) A.ocupado(b, false);
      if (!fs.length) { A.avisar("Não consegui pegar as fotos.", "erro"); return; }
      var pode = false;
      try { pode = !!(navigator.share && navigator.canShare && navigator.canShare({ files: fs })); } catch (e) { pode = false; }
      // computador que não compartilha arquivo: baixa as fotos para você anexar no WhatsApp Web
      if (!pode) { fs.forEach(function (f, i) { setTimeout(function () { baixar(f, f.name); }, i * 400); }); A.avisar("Este navegador não compartilha fotos direto: baixei " + fs.length + " foto" + (fs.length > 1 ? "s" : "") + " para você anexar.", "ok"); return; }
      return A.compartilhar({ titulo: titulo, texto: texto, arquivos: fs });
    }).catch(function (e) { if (b) A.ocupado(b, false); falhou(e); });
  }

  // ---------- entrada ----------
  function iniciar() {
    if (!A.configurado()) { A.telaSemConfig(app); return; }
    try { sb = A.cliente(); } catch (e) { app.innerHTML = '<div class="entrada"><div class="aviso erro">' + esc(A.msgErro(e)) + "</div></div>"; return; }
    sb.auth.onAuthStateChange(function (ev) { if (ev === "SIGNED_OUT") telaLogin(); });
    sb.auth.getSession().then(function (r) {
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
      var j = A.janela('<h3 style="margin:0 0 6px">👆 Trava com digital</h3>' + (!ok ? '<div class="aviso">Este aparelho ou navegador não tem desbloqueio por digital/rosto disponível (ou não está configurado no celular). ' +
        "Cadastre a digital nas configurações do celular e abra o painel pelo Chrome.</div>" :
        '<p>' + (ativa ? "✅ A trava está <b>ativa neste aparelho</b>." : "Ao abrir o painel (ou voltar para ele depois de " + TRAVA_MIN + " minutos), ele pede a <b>digital ou o rosto</b> do celular.") + "</p>" +
        '<p class="mudo peq">Vale só para este aparelho. A digital fica no celular, o app nunca recebe. Se a digital falhar, dá para entrar com e-mail e senha.</p>' +
        '<div id="tv-msg"></div><div class="acoes">' + (ativa ? '<button id="tv-testar">👆 Testar</button><button class="perigo" id="tv-desativar">Desativar trava</button>' :
          '<button class="prim" id="tv-ativar">🔒 Ativar trava com digital</button>') + "</div>") +
        '<hr class="sep"><h3 style="margin:0 0 6px">🔑 Senha</h3><div class="acoes" style="margin-top:6px"><button id="tv-senha">Trocar minha senha</button></div>',
        { titulo: "⚙ Conta" });
      var el = j.el;
      $("#tv-senha", el).onclick = function () { j.fechar(); trocarSenha(); };
      var msg = function (t, tipo) { if ($("#tv-msg", el)) $("#tv-msg", el).innerHTML = '<div class="aviso ' + (tipo || "erro") + '">' + esc(t) + "</div>"; };
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
    b.textContent = travaAtiva() ? "⚙🔒" : "⚙";
    b.title = travaAtiva() ? "Conta (trava com digital ativa)" : "Conta: trava com digital e senha";
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
  // ⚙ → Trocar minha senha (já logado; confere a senha atual antes)
  function trocarSenha() {
    var j = A.janela(campoSenha("ts-atual", "Senha atual", "current-password") +
      campoSenha("ts-nova", "Senha nova (mínimo 8 letras ou números)", "new-password") +
      campoSenha("ts-nova2", "Repita a senha nova", "new-password") +
      '<div id="ts-msg"></div><div class="acoes"><button class="prim" id="ts-ok">Salvar senha nova</button></div>', { titulo: "🔑 Trocar minha senha" });
    var el = j.el;
    ligarVerSenha(el);
    $("#ts-ok", el).onclick = function () {
      var b = this, atual = $("#ts-atual", el).value, s1 = $("#ts-nova", el).value, s2 = $("#ts-nova2", el).value;
      var erro = function (m) { $("#ts-msg", el).innerHTML = '<div class="aviso erro">' + esc(m) + "</div>"; };
      if (!atual) { erro("Digite a senha atual."); return; }
      if (s1.length < 8) { erro("A senha nova precisa ter pelo menos 8 letras ou números."); return; }
      if (s1 !== s2) { erro("As duas senhas novas estão diferentes. Toque no 👁 para conferir."); return; }
      if (s1 === atual) { erro("A senha nova é igual à atual."); return; }
      A.ocupado(b, true, "Salvando...");
      sb.auth.getSession().then(function (r) {
        var se = r.data && r.data.session, email = se && se.user && se.user.email;
        if (!email) throw new Error("Sua sessão expirou. Entre de novo.");
        return sb.auth.signInWithPassword({ email: email, password: atual }).then(function (x) {
          if (x.error) throw new Error(/Invalid login/i.test(x.error.message || "") ? "A senha atual está errada. Toque no 👁 para conferir." : A.msgErro(x.error));
          return sb.auth.updateUser({ password: s1 });
        });
      }).then(function (r) {
        if (r.error) throw r.error;
        j.fechar(); A.avisar("Senha trocada. Use a senha nova da próxima vez.", "ok");
      }).catch(function (e) {
        A.ocupado(b, false);
        var m = A.msgErro(e);
        if (/different from the old/i.test(m)) m = "A senha nova é igual à atual.";
        erro(m);
      });
    };
  }

  function telaLogin(msg) {
    window.removeEventListener("hashchange", rota);
    app.innerHTML = '<div class="entrada"><div class="marca-g">AGE</div><h2 style="text-align:center;margin-bottom:14px">Painel AGE Elétrica e Pintura</h2>' +
      '<form class="cartao" id="f-login"><label for="l-email">E-mail</label><input id="l-email" type="email" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required>' +
      campoSenha("l-senha", "Senha", "current-password") +
      '<div id="l-msg">' + (msg ? '<div class="aviso erro">' + esc(msg) + "</div>" : "") + "</div>" +
      '<div class="acoes"><button class="prim" type="submit">Entrar</button></div>' +
      '<p class="mudo peq" style="margin:12px 0 0">Esqueceu a senha? Ela é trocada no Supabase (veja o LEIA-ME, “Esqueci a senha”). Depois de entrar, use ⚙ → Trocar minha senha.</p></form></div>';
    ligarVerSenha(app);
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

  // atualiza os dados sozinho: a cada minuto com a tela aberta e ao voltar para a aba do navegador.
  // Não atualiza com uma janela aberta nem enquanto você digita, para não atrapalhar.
  var autoAt = { timer: null, ultima: Date.now(), indo: false };
  function podeAtualizar() {
    var a = document.activeElement;
    return document.visibilityState === "visible" && !document.querySelector(".fundo-modal") &&
      !(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
  }
  function atualizarSozinho() {
    if (autoAt.indo || !podeAtualizar()) return;
    autoAt.indo = true;
    carregarBase().then(function () { autoAt.ultima = Date.now(); if (podeAtualizar()) rota(); })
      .catch(function () { /* sem internet: tenta de novo no próximo minuto */ })
      .then(function () { autoAt.indo = false; });
  }
  function iniciarAtualizacaoAutomatica() {
    if (autoAt.timer) return;
    autoAt.timer = setInterval(atualizarSozinho, 60000);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible" && Date.now() - autoAt.ultima > 20000) atualizarSozinho(); });
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
      q(sb.from("veiculos").select("*").order("placa")).catch(function () { return null; }),
      q(sb.from("pagamentos").select("*").order("pago_em", { ascending: false })).catch(function (e) { S.erroPag = A.msgErro(e); return null; }),
      q(sb.from("compras").select("*").order("comprado_em", { ascending: false })).catch(function (e) { S.erroCompras = A.msgErro(e); return null; }),
      q(sb.from("fornecedores").select("*").order("nome")).catch(function (e) { S.erroForn = A.msgErro(e); return null; }),
      q(sb.from("receitas").select("*").order("emitida_em", { ascending: false })).catch(function (e) { S.erroReceitas = A.msgErro(e); return null; }),
      q(sb.from("prospects").select("*").order("criado_em", { ascending: false })).catch(function (e) { S.erroProsp = A.msgErro(e); return null; }),
      q(sb.from("servicos").select("etapa").limit(1)).then(function () { return true; }).catch(function () { return false; }),
      q(sb.from("precos").select("*").order("descricao")).catch(function (e) { S.erroPrecos = A.msgErro(e); return null; }),
      q(sb.from("candidatos").select("*").order("criado_em", { ascending: false }).limit(500)).catch(function () { return null; })
    ]).then(function (r) {
      S.func = r[0]; S.obras = r[1]; S.serv = r[2]; S.rel = r[3]; S.orc = r[4]; S.lojas = r[5]; S.rotas = r[6]; ordenarLojas();
      S.semPref = !r[7]; S.pref = r[7] ? r[7][0] : []; S.contr = r[7] ? r[7][1] : []; S.med = r[7] ? r[7][2] : [];
      S.semVeic = !r[8]; S.veic = r[8] || [];
      S.semPag = !r[9]; S.pag = r[9] || [];
      S.semCompras = !r[10]; S.compras = r[10] || [];
      S.semForn = !r[11]; S.forn = r[11] || [];
      S.semReceitas = !r[12]; S.receitas = r[12] || [];
      S.semProsp = !r[13]; S.prosp = r[13] || [];
      S.semEtapa = !r[14];   // banco ainda sem a coluna servicos.etapa (rode o bloco do supabase.sql)
      S.semPrecos = !r[15]; S.precos = r[15] || [];
      S.semCand = !r[16]; S.cand = r[16] || [];
      S.lic = r[7] ? r[7][3] : []; S.docs = r[7] ? r[7][4] : [];
    });
  }

  function montar() {
    app.innerHTML = '<div class="topo"><div class="marca">AGE</div><div><div class="nome">AGE Elétrica e Pintura</div><div class="sub">Painel do responsável</div></div>' +
      '<div class="dir"><button class="leve peq oculto" id="b-instalar">📲 Instalar app</button><button class="leve peq" id="b-trava" aria-label="Conta: trava com digital e senha">⚙</button>' +
      '<button class="leve peq" id="b-recarregar" aria-label="Atualizar">↻</button><button class="leve peq" id="b-sair">Sair</button></div></div>' +
      '<nav class="abas" id="abas"></nav><main id="conteudo"></main>';
    A.ligarInstalar($("#b-instalar"));
    $("#b-sair").onclick = function () { sb.auth.signOut(); };
    $("#b-trava").onclick = janelaTrava;
    atualizarBotaoTrava();
    $("#b-recarregar").onclick = function () {
      carregarBase().then(function () { rota(); A.avisar("Atualizado"); }).catch(falhou);
    };
    iniciarAtualizacaoAutomatica();
    if (/[?&]recebido=1/.test(location.search)) { history.replaceState(null, "", location.pathname + location.hash); abrirRecebido(); }
    window.removeEventListener("hashchange", rota);
    window.addEventListener("hashchange", rota);
    rota();
  }

  function desenharAbas(atual) {
    var novos = S.rel.filter(function (r) { return !r.lido; }).length;
    var aPagar = window.AGE_COMPRAS && S.compras ? window.AGE_COMPRAS.naoQuitadas(S).length : 0;
    var aReceber = window.AGE_FAT ? window.AGE_FAT.aReceber(S).length : 0;
    var retornos = window.AGE_PROSP && S.prosp ? window.AGE_PROSP.retornarHoje(S).length : 0;
    $("#abas").innerHTML = ABAS.map(function (a) {
      return '<a href="#' + a[0] + '" class="' + (a[0] === atual ? "ativa" : "") + '">' + a[1] +
        (a[0] === "relatorios" && novos ? '<span class="cont">' + novos + "</span>" : "") +
        (a[0] === "compras" && aPagar ? '<span class="cont" title="Notas não quitadas">' + aPagar + "</span>" : "") +
        (a[0] === "faturamento" && aReceber ? '<span class="cont" style="background:var(--atencao)" title="Notas de serviço a receber">' + aReceber + "</span>" : "") +
        (a[0] === "prospeccao" && retornos ? '<span class="cont" style="background:var(--atencao)" title="Empresas para retornar hoje">' + retornos + "</span>" : "") + "</a>";
    }).join("");
    // celular: a barra desliza de lado; a aba aberta fica sempre à vista
    var at = $("#abas a.ativa");
    if (at && at.scrollIntoView) at.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function rota() {
    var aba = location.hash.slice(1) || "hoje";
    if (!ABAS.some(function (a) { return a[0] === aba; })) aba = "hoje";
    desenharAbas(aba);
    var c = $("#conteudo");
    if (!c) return;
    window.scrollTo(0, 0);
    ({ hoje: verHoje, servicos: verServicos, executados: verExecutados, prefeitura: function (c2) { window.AGE_PREF.ver(c2, P); }, rotas: verRotas, lojas: verLojas, ponto: verPonto, pagamentos: function (c2) { window.AGE_PAG.ver(c2, P); }, compras: function (c2) { window.AGE_COMPRAS.ver(c2, P); }, faturamento: function (c2) { window.AGE_FAT.ver(c2, P); }, prospeccao: function (c2) { window.AGE_PROSP.ver(c2, P); }, veiculos: verVeiculos, relatorios: verRelatorios, orcamentos: verOrcamentos, precos: function (c2) { window.AGE_PRECOS.ver(c2, P); }, equipe: verEquipe })[aba](c);
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
      var visitasOrc = S.serv.filter(function (s) { return s.status === "aguardando"; }).length;
      var probl = S.obras.filter(function (o) { return problemaPortal(o.portal); }), reprov = probl.length, pend = pendencias();
      var h = (probl.length ? '<div class="aviso erro" style="margin-bottom:12px">' + probl.map(function (o) {
          var pr = o.portal.reprovado || o.portal.reclamacao, sv = S.serv.filter(function (x) { return x.obra_id === o.id; })[0];
          return '<div style="margin:2px 0' + (sv ? ';cursor:pointer" data-h-prob="' + sv.id + '" role="button" tabindex="0"' : '"') + '>🚨 <b>' + esc(o.cliente) + "</b> · chamado " + esc(o.chamado || "") + " · " +
            (o.portal.reprovado ? "REPROVADO" : "RECLAMAÇÃO") + " em " + esc(pr.data || "") + ": “" + esc(String(pr.motivo || pr.txt || "").slice(0, 160)) + "”</div>";
        }).join("") + "</div>" : "") +
        (pend.length ? '<div class="cartao" style="margin-bottom:12px;border-left:4px solid var(--atencao)"><h3 style="margin:0 0 6px">📌 Pendências dos chamados (' + pend.length + ")</h3>" + pend.map(function (x) {
          return '<div class="peq" style="margin:4px 0;cursor:pointer" data-h-prob="' + x.serv.id + '" role="button" tabindex="0"><span class="selo ' + x.cor + '">' + esc(x.txt) + "</span> <b>" + esc(x.obra.cliente) + "</b> · chamado " + esc(x.obra.chamado) + "</div>";
        }).join("") + '<div class="mudo peq" style="margin-top:6px">Some sozinha quando você atualiza o chamado (colando os Detalhes) ou muda o serviço no app.</div></div>' : "") +
        htmlRevisao(semConferir()) +
        (window.AGE_COMPRAS && S.compras ? window.AGE_COMPRAS.htmlAlerta(S) : "") +
        '<div class="grade">' +
        '<div class="ladrilho"><div class="r">⚡ Elétrica</div><div class="v">' + abE + '</div><div class="d">serviços ativos</div></div>' +
        '<div class="ladrilho"><div class="r">🖌️ Pintura</div><div class="v">' + abP + '</div><div class="d">serviços ativos</div></div>' +
        (S.pref.length || osPref ? '<a class="ladrilho" href="#prefeitura" style="text-decoration:none;color:inherit"><div class="r">🏛️ Prefeitura</div><div class="v">' + osPref + '</div><div class="d">OS em aberto</div></a>' : "") +
        '<div class="ladrilho"><div class="r">Relatórios</div><div class="v">' + novos + '</div><div class="d">novos para ler</div></div>' +
        '<div class="ladrilho"><div class="r">Orçamentos</div><div class="v">' + aguard.length + '</div><div class="d">' +
        A.dinheiro(aguard.reduce(function (t, o) { return t + Number(o.total); }, 0)) + " aguardando cliente</div></div>" +
        (reprov ? '<a class="ladrilho" href="#servicos" id="h-reprov" style="text-decoration:none;color:inherit;border:2px solid var(--critico)"><div class="r">🚨 Reprovados / reclamações</div><div class="v">' + reprov + '</div><div class="d">voltar e refazer</div></a>' : "") +
        (visitasOrc ? '<a class="ladrilho" href="#servicos" id="h-visitas-orc" style="text-decoration:none;color:inherit"><div class="r">🧾 Visitas de orçamento</div><div class="v">' + visitasOrc + '</div><div class="d">aguardando aprovação</div></a>' : "") + "</div>";
      var daEquipe = S.serv.filter(function (s) { return s.criado_pelo_funcionario && new Date(s.criado_em) >= ini; });
      if (daEquipe.length) h += '<div class="aviso">🆕 A equipe cadastrou ' + (daEquipe.length === 1 ? "1 serviço" : daEquipe.length + " serviços") +
        ' hoje: ' + daEquipe.slice(0, 5).map(function (s) { var o = porId(S.obras, s.obra_id); return esc((o ? o.cliente : "") + " (" + nomeFunc(s.funcionario_id) + ")"); }).join(", ") +
        '. Veja em <a href="#servicos">Serviços</a>.</div>';
      if (window.AGE_PREF) h += window.AGE_PREF.avisosHoje(S);
      if (window.AGE_PROSP && S.prosp) h += window.AGE_PROSP.avisoHoje(S);
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
      if ($("#h-visitas-orc")) $("#h-visitas-orc").onclick = function () { filtroServ.st = "aguardando"; };
      if ($("#h-reprov")) $("#h-reprov").onclick = function () { filtroServ.st = "reprovados"; };
      $$("[data-h-prob]", c).forEach(function (d) { d.onclick = function () { abrirServico(d.dataset.hProb); }; });
      if (window.AGE_COMPRAS) window.AGE_COMPRAS.ligarAlerta(c, P, rota);
      $$("[data-pr-hoje]", c).forEach(function (a) { a.onclick = function () { window.AGE_PROSP.irRetornar(); }; });
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

  // ---------- etapa do serviço: 📐 orçamento (visita para orçar, fotos do local) ou 🔧 serviço (executar; fecha só com foto do serviço feito) ----------
  var ETAPAS = { orcamento: "📐 Orçamento", servico: "🔧 Serviço" };
  var RE_ORC = /fazer\s+or[cç]amento|\(\s*fazer\s+or|\bor[cç]ar\b|levantamento|visita\s+(t[eé]cnica|para\s+or)/i;
  function etapaPelaDescricao(t) { return RE_ORC.test(t || "") ? "orcamento" : "servico"; }
  function etapaDe(s) { return s.etapa || (s.status === "aguardando" ? "orcamento" : etapaPelaDescricao(s.descricao)); }
  function seloEtapa(s) {
    var e = etapaDe(s);
    return '<span class="selo ' + (e === "orcamento" ? "atencao" : "bom") + '" title="' + (e === "orcamento" ? "Visita para orçamento: fotos do local e medidas" : "Executar o serviço: fecha só com foto do serviço feito") + '">' + ETAPAS[e] + "</span>";
  }
  // orçamento aprovado: volta para aberto como serviço a executar (mesmo funcionário, se tiver)
  function aprovarOrcamento(sid) {
    var dados = { status: "aberto", concluido_em: null };
    if (!S.semEtapa) dados.etapa = "servico";
    return q(sb.from("servicos").update(dados).eq("id", sid).select().single()).then(function (n) { trocar(S.serv, n); A.avisar("✅ Orçamento aprovado: agora é serviço a executar" + (n.funcionario_id ? " (" + nomeFunc(n.funcionario_id) + ")" : " — escolha o funcionário"), "ok"); return n; });
  }
  function verServicos(c) {
    var F = filtroServ;
    var h = '<div class="cab-secao"><h2>Serviços</h2><span><button id="b-chamado">📋 Chamados BH' + (lerCaixa().length ? " (" + lerCaixa().length + " na caixa)" : "") + '</button> <button class="prim" id="b-novo-serv">+ Novo serviço</button></span></div>' +
      '<div class="filtros"><select id="fs-cat" aria-label="Categoria"><option value="">Elétrica e pintura</option><option value="eletrica">⚡ Só elétrica</option><option value="pintura">🖌️ Só pintura</option></select>' +
      '<select id="fs-st" aria-label="Situação"><option value="ativos">Abertos, em andamento e orçamentos</option><option value="aberto">Abertos</option><option value="em_andamento">Em andamento</option>' +
      '<option value="aguardando">🧾 Orçamento feito (aguardando aprovação)</option><option value="reprovados">🚨 Reprovados / reclamações da loja</option>' +
      '<option value="concluido">Concluídos</option><option value="cancelado">Cancelados</option><option value="equipe">Criados pela equipe</option><option value="todos">Todos</option></select>' +
      '<select id="fs-func" aria-label="Funcionário"><option value="">Todos os funcionários</option><option value="-">Sem funcionário</option>' +
      S.func.map(function (f) { return '<option value="' + f.id + '">' + esc(f.nome) + "</option>"; }).join("") + "</select>" +
      '<select id="fs-ordem" aria-label="Ordem"><option value="recentes">📅 Mais recentes primeiro</option><option value="antigos">📅 Mais antigos primeiro</option><option value="loja">🏪 Por nº da loja</option></select>' +
      '<input id="fs-busca" type="search" placeholder="Buscar cliente, endereço ou nº do chamado"></div>' +
      (S.pref.length ? '<p class="mudo peq" style="margin:-4px 0 10px">Aqui ficam os clientes particulares e as lojas. As OS da prefeitura ficam na aba <a href="#prefeitura">🏛️ Prefeitura</a>.</p>' : "") +
      '<div id="lista-serv"></div>';
    c.innerHTML = h;
    $("#fs-cat").value = F.cat; $("#fs-st").value = F.st; $("#fs-func").value = F.func; $("#fs-busca").value = F.busca; $("#fs-ordem").value = F.ordem || "recentes";
    ["#fs-cat", "#fs-st", "#fs-func", "#fs-ordem"].forEach(function (s) { $(s).onchange = function () { lerFiltro(); listar(); }; });
    $("#fs-busca").oninput = function () { lerFiltro(); listar(); };
    $("#b-novo-serv").onclick = function () { novoServico(null); };
    $("#b-chamado").onclick = importarChamado;
    function lerFiltro() { F.ordem = $("#fs-ordem").value; F.cat = $("#fs-cat").value; F.st = $("#fs-st").value; F.func = $("#fs-func").value; F.busca = $("#fs-busca").value.trim().toLowerCase(); }

    function passa(s) {
      if (F.cat && s.categoria !== F.cat) return false;
      if (F.st === "ativos" && !(s.status === "aberto" || s.status === "em_andamento" || s.status === "aguardando")) return false;
      if (F.st === "equipe" && !s.criado_pelo_funcionario) return false;
      if (F.st === "reprovados") { var ob = porId(S.obras, s.obra_id); if (!(ob && problemaPortal(ob.portal))) return false; }
      if (F.st !== "ativos" && F.st !== "todos" && F.st !== "equipe" && F.st !== "reprovados" && s.status !== F.st) return false;
      if (F.func === "-" && s.funcionario_id) return false;
      if (F.func && F.func !== "-" && s.funcionario_id !== F.func) return false;
      return true;
    }
    function listar() {
      var obras = S.obras.filter(function (o) {
        if (ehPrefObra(o)) return false;
        if (F.busca && ((o.cliente || "") + " " + (o.endereco || "") + " " + (o.telefone || "") + " " + (o.chamado || "")).toLowerCase().indexOf(F.busca) < 0) return false;
        var partes = S.serv.filter(function (s) { return s.obra_id === o.id; });
        if (!partes.length) return F.st === "todos" && !F.cat && !F.func;
        return partes.some(passa);
      });
      obras.sort(function (a, b) {
        if (F.ordem === "loja") {
          var la = a.loja_id ? porId(S.lojas, a.loja_id) : null, lb = b.loja_id ? porId(S.lojas, b.loja_id) : null;
          var na = la ? parseInt(la.codigo, 10) : NaN, nb = lb ? parseInt(lb.codigo, 10) : NaN;
          if (isNaN(na) !== isNaN(nb)) return isNaN(na) ? 1 : -1;
          if (na !== nb && !isNaN(na)) return na - nb;
        }
        var d = dataObra(b) - dataObra(a);
        return F.ordem === "antigos" ? -d : d;
      });
      // chamados diferentes da mesma loja ficam juntos (o grupo fica na posição do mais recente/antigo)
      var grupos = {}, ordemG = [];
      obras.forEach(function (o) {
        var k = o.loja_id ? "l:" + o.loja_id : "c:" + String(o.cliente || "").trim().toLowerCase();
        if (!grupos[k]) { grupos[k] = []; ordemG.push(k); }
        grupos[k].push(o);
      });
      var l = $("#lista-serv");
      if (!obras.length) { l.innerHTML = '<div class="cartao vazio">Nenhum serviço com este filtro.</div>'; return; }
      l.innerHTML = ordemG.map(function (k) {
        var g = grupos[k];
        return (g.length > 1 ? '<div class="peq mudo" style="margin:12px 0 4px;font-weight:600">🏪 ' + esc(g[0].cliente) + " · " + g.length + " nesta loja</div>" : "") +
          g.map(cartaoObra).join("");
      }).join("");
      function cartaoObra(o) {
        var partes = S.serv.filter(function (s) { return s.obra_id === o.id && passa(s); });
        return '<div class="cartao"><div class="linha"><h3>' + esc(o.cliente) + "</h3>" + seloOS(o) + seloChamado(o) +
          '<span class="dir"><button class="peq" data-parte="' + o.id + '">+ Parte</button> <button class="peq" data-orc-obra="' + o.id + '">💲 Orçamento</button> ' +
          '<button class="peq" data-obra="' + o.id + '">Editar</button></span></div>' +
          (o.endereco ? '<div class="peq"><a href="' + A.linkEndereco(o.endereco) + '" target="_blank" rel="noopener">📍 ' + esc(o.endereco) + "</a></div>" : "") +
          (o.telefone || o.email ? '<div class="peq mudo">' + (o.telefone ? "📞 " + esc(o.telefone) + " " : "") + (o.email ? "✉ " + esc(o.email) : "") + "</div>" : "") +
          partes.map(function (s) {
            return '<div class="parte ' + s.categoria + '" data-serv="' + s.id + '" role="button" tabindex="0"><div class="linha">' + A.seloCategoria(s.categoria) + A.seloStatus(s.status) + (o.prefeitura_id ? "" : seloEtapa(s)) +
              (s.status === "aguardando" ? '<button class="peq bom" data-aprovar="' + s.id + '" title="O cliente aprovou o orçamento">✅ Aprovado → executar</button>' : "") +
              (s.criado_pelo_funcionario ? '<span class="selo atencao">criado pela equipe</span>' : "") +
              '<span class="peq">' + (s.funcionario_id ? "👷 " + esc(nomeFunc(s.funcionario_id)) : '<span class="selo critico">sem funcionário</span>') + "</span>" +
              (s.pede_assinatura ? '<span class="selo">✍️ pede assinatura</span>' : "") +
              (s.data_prevista ? '<span class="dir peq mudo">📅 ' + A.dataSimples(s.data_prevista) + "</span>" : "") + "</div>" +
              (s.descricao ? '<div class="peq" style="margin-top:4px;white-space:pre-wrap">' + esc(s.descricao.length > 220 ? s.descricao.slice(0, 220) + "…" : s.descricao) + "</div>" : "") +
              "</div>";
          }).join("") + "</div>";
      }
      $$("[data-serv]", l).forEach(function (d) {
        d.onclick = function () { abrirServico(d.dataset.serv); };
        d.onkeydown = function (ev) { if (ev.key === "Enter") abrirServico(d.dataset.serv); };
      });
      $$("[data-aprovar]", l).forEach(function (b) {
        b.onclick = function (ev) { ev.stopPropagation(); A.ocupado(b, true, "..."); aprovarOrcamento(b.dataset.aprovar).then(function () { listar(); }).catch(function (e) { A.ocupado(b, false); falhou(e); }); };
      });
      $$("[data-parte]", l).forEach(function (b) { b.onclick = function () { novoServico(b.dataset.parte); }; });
      $$("[data-obra]", l).forEach(function (b) { b.onclick = function () { editarObra(b.dataset.obra); }; });
      $$("[data-orc-obra]", l).forEach(function (b) { b.onclick = function () { orcamentoDaObra(b.dataset.orcObra); }; });
    }
    listar();
  }

  // data de abertura do chamado (ou, se não houver, quando o serviço entrou no app)
  function aberturaChamado(o) {
    if (o.chamado_aberto) return new Date(o.chamado_aberto + "T12:00:00");
    var srv = S.serv.filter(function (x) { return x.obra_id === o.id; });
    for (var i = 0; i < srv.length; i++) {
      var m = String(srv[i].descricao || "").match(/aberto em (\d{2})\/(\d{2})\/(\d{4})/);
      if (m) return new Date(m[3] + "-" + m[2] + "-" + m[1] + "T12:00:00");
    }
    return null;
  }
  function dataObra(o) {
    var a = o.chamado ? aberturaChamado(o) : null;
    if (a) return a.getTime();
    var t = new Date(o.criado_em || 0).getTime();
    S.serv.forEach(function (x) { if (x.obra_id === o.id) t = Math.max(t, new Date(x.criado_em || 0).getTime()); });
    return t;
  }
  function seloChamado(o) {
    if (!o || !o.chamado) return "";
    var a = aberturaChamado(o);
    return '<span class="selo">📋 Chamado ' + esc(o.chamado) + (a ? " · aberto " + A.data(a) : "") + "</span>" + seloPortal(o.portal);
  }
  function isoDeBR(d) { var m = String(d || "").match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? m[3] + "-" + m[2] + "-" + m[1] : null; }

  function seloOS(o) {
    if (!o || !o.prefeitura_id) return "";
    var p = porId(S.pref, o.prefeitura_id);
    return '<span class="selo">🏛️ ' + esc(p ? p.nome : "Prefeitura") + (o.protocolo ? " · OS " + esc(o.protocolo) : "") + "</span>";
  }

  // semLink: para compartilhar com outras pessoas (o link pessoal do funcionário não vai junto)
  function msgServico(s, juntos, semLink) {
    var o = porId(S.obras, s.obra_id), f = porId(S.func, s.funcionario_id);
    var t = "*AGE Elétrica e Pintura*\nServiço de " + (A.CATEG[s.categoria].icone + " *" + A.CATEG[s.categoria].nome.toUpperCase()) + "*\n\n" +
      (o.prefeitura_id ? "🏛️ " + ((porId(S.pref, o.prefeitura_id) || {}).nome || "Prefeitura") + (o.protocolo ? " · OS/Protocolo " + o.protocolo : "") + "\n" +
        (o.fiscal ? "Fiscal: " + o.fiscal + "\n" : "") : "") +
      "Cliente: " + o.cliente + "\n" + (o.chamado ? "Chamado nº " + o.chamado + "\n" : "") + (o.referencia ? "Referência: " + o.referencia + "\n" : "") + (o.endereco ? "Endereço: " + o.endereco + "\n" : "") + (o.telefone ? "Telefone: " + o.telefone + "\n" : "") +
      (s.data_prevista ? "Data: " + A.dataSimples(s.data_prevista) + "\n" : "") + (s.descricao ? "\nO que fazer:\n" + s.descricao + "\n" : "") +
      (o.prefeitura_id ? "\n📷 Fotos de ANTES e de DEPOIS são obrigatórias (no relatório do app).\n" : "") +
      (s.pede_assinatura ? "\n✍️ Ao concluir, colher a ASSINATURA do " + (o.prefeitura_id ? "FISCAL" : "responsável no local") + " (no relatório do app).\n" : "");
    if (juntos && juntos.length) t += "\nTambém nesta loja (" + juntos.length + "):\n" + juntos.map(function (x) {
      var ox = porId(S.obras, x.obra_id) || {};
      return "• " + (ox.chamado ? "Chamado nº " + ox.chamado + ": " : "") + resumoServ(x, 140);
    }).join("\n") + "\n";
    if (f && !semLink) t += "\nRegistre a chegada, as fotos do serviço e a saída pelo seu link:\n" + linkFunc(f);
    if (semLink && o.endereco) t += "\n📍 " + A.linkEndereco(o.endereco);
    return t;
  }
  function botaoZap(s, juntos) {
    var f = porId(S.func, s.funcionario_id);
    if (!f) return "";
    if (!f.telefone) return '<span class="mudo peq">Cadastre o telefone de ' + esc(f.nome) + " para avisar pelo WhatsApp.</span>";
    return '<a class="botao zap" target="_blank" rel="noopener" href="' + esc(A.linkZap(f.telefone, msgServico(s, juntos))) + '">📲 Avisar ' + esc(f.nome.split(" ")[0]) + " no WhatsApp</a>";
  }

  // mesma loja: mesma loja cadastrada ou, sem loja, o mesmo nome de cliente (prefeituras ficam de fora)
  function mesmaLoja(a, b) {
    if (!a || !b || ehPrefObra(a) || ehPrefObra(b)) return false;
    if (a.loja_id || b.loja_id) return a.loja_id === b.loja_id;
    var ca = String(a.cliente || "").trim().toLowerCase();
    return !!ca && ca === String(b.cliente || "").trim().toLowerCase();
  }
  // ao escolher o funcionário de um serviço, os outros chamados abertos da mesma loja e da mesma área
  // que estão sem funcionário vão para ele também. Devolve { porServ: {id: [levados]}, outro: n }
  function levarChamadosDaLoja(lista) {
    var alvo = {}, porServ = {}, outro = 0, ids = lista.map(function (s) { return s.id; });
    lista.forEach(function (s) {
      if (!s.funcionario_id || (s.status !== "aberto" && s.status !== "em_andamento")) return;
      var o = porId(S.obras, s.obra_id);
      S.serv.forEach(function (x) {
        if (ids.indexOf(x.id) >= 0 || alvo[x.id] || x.categoria !== s.categoria || (x.status !== "aberto" && x.status !== "em_andamento")) return;
        if (!mesmaLoja(o, porId(S.obras, x.obra_id))) return;
        if (x.funcionario_id) { if (x.funcionario_id !== s.funcionario_id) outro++; return; }
        alvo[x.id] = s; (porServ[s.id] = porServ[s.id] || []).push(x);
      });
    });
    var grupos = {};
    Object.keys(alvo).forEach(function (id) { var f = alvo[id].funcionario_id; (grupos[f] = grupos[f] || []).push(id); });
    return Promise.all(Object.keys(grupos).map(function (f) {
      return q(sb.from("servicos").update({ funcionario_id: f }).in("id", grupos[f]).select()).then(function (ns) { ns.forEach(function (n) { trocar(S.serv, n); }); });
    })).then(function () {
      Object.keys(porServ).forEach(function (k) { porServ[k] = porServ[k].map(function (x) { return porId(S.serv, x.id) || x; }); });
      var n = Object.keys(alvo).length;
      if (n) A.avisar(n + " outro" + (n > 1 ? "s chamados" : " chamado") + " desta loja também " + (n > 1 ? "foram" : "foi") + " para " + nomeFunc(lista.filter(function (s) { return porServ[s.id]; })[0].funcionario_id) + ".", "ok");
      if (outro) A.avisar(outro + " chamado" + (outro > 1 ? "s" : "") + " desta loja já " + (outro > 1 ? "estão" : "está") + " com outro funcionário (não mudei).");
      return { porServ: porServ, outro: outro };
    });
  }

  function formParte(cat, rotulo) {
    return '<div class="cartao" style="margin:10px 0 0;border-left:4px solid var(--' + cat + ')">' +
      '<label class="marca-linha" style="margin:0"><input type="checkbox" id="ns-' + cat + '"> ' + rotulo + "</label>" +
      '<div id="ns-' + cat + '-campos" class="oculto"><div class="duas"><div><label for="ns-' + cat + '-func">Funcionário</label><select id="ns-' + cat + '-func">' + opcoesFunc(cat, null) + "</select></div>" +
      '<div><label for="ns-' + cat + '-data">Data prevista</label><input type="date" id="ns-' + cat + '-data"></div></div>' +
      '<label for="ns-' + cat + '-desc">O que fazer</label><textarea id="ns-' + cat + '-desc" rows="3"></textarea>' +
      '<label class="marca-linha" style="font-weight:400"><input type="checkbox" id="ns-' + cat + '-assin"> ✍️ Liberar assinatura do responsável neste serviço <span class="mudo peq">(desligado: o funcionário não vê o quadro de assinatura)</span></label></div></div>';
  }

  function novoServico(obraId, pre) {
    var obra = obraId ? porId(S.obras, obraId) : null;
    pre = pre || {};
    var j = A.janela(
      (obra ? '<div class="cartao" style="margin:0"><b>' + esc(obra.cliente) + "</b><div class=\"peq mudo\">" + esc(obra.endereco || "") + "</div></div>" :
        (S.lojas.length ? '<label for="ns-loja">Loja da rede (opcional)</label><input id="ns-loja" list="ns-dl-lojas" placeholder="Digite o número, nome ou cidade da loja">' +
          '<datalist id="ns-dl-lojas">' + S.lojas.filter(function (l) { return l.ativo; }).map(function (l) { return '<option value="' + esc(rotuloLoja(l)) + '">'; }).join("") + "</datalist>" : "") +
        '<label for="ns-cli">Cliente *</label><input id="ns-cli" maxlength="200" required>' +
        '<div class="duas"><div><label for="ns-tel">WhatsApp do cliente</label><input id="ns-tel" type="tel" maxlength="40"></div>' +
        '<div><label for="ns-email">E-mail do cliente</label><input id="ns-email" type="email" maxlength="200"></div></div>' +
        '<label for="ns-end">Endereço</label><input id="ns-end" maxlength="300">' +
        '<label for="ns-obs">Observações (o funcionário vê)</label><textarea id="ns-obs" rows="2" placeholder="Ex.: chave com o porteiro, cachorro no quintal"></textarea>' +
        '<label class="marca-linha" style="font-weight:400"><input type="checkbox" id="ns-divulgar"> 📣 Cliente autorizou divulgar fotos deste serviço nas redes sociais</label>') +
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
    // vindo de um chamado: loja, área e descrição já preenchidas
    if (pre.loja && $("#ns-loja", el)) { $("#ns-loja", el).value = rotuloLoja(pre.loja); $("#ns-loja", el).onchange(); }
    else if (pre.cliente && $("#ns-cli", el)) $("#ns-cli", el).value = pre.cliente;
    if (pre.obs && $("#ns-obs", el)) $("#ns-obs", el).value = pre.obs;
    if (pre.cat) { $("#ns-" + pre.cat, el).checked = true; $("#ns-" + pre.cat, el).onchange(); $("#ns-" + pre.cat + "-desc", el).value = pre.desc || ""; }
    $("#ns-salvar", el).onclick = function () {
      var b = this, erro = $("#ns-erro", el);
      var cats = ["eletrica", "pintura"].filter(function (cat) { return $("#ns-" + cat, el).checked; });
      if (!obra && !val(el, "#ns-cli")) { erro.innerHTML = '<div class="aviso erro">Informe o cliente.</div>'; return; }
      if (!cats.length) { erro.innerHTML = '<div class="aviso erro">Marque a parte elétrica, a de pintura ou as duas.</div>'; return; }
      A.ocupado(b, true, "Salvando...");
      var pObra = obra ? Promise.resolve(obra) : q(sb.from("obras").insert({
        cliente: val(el, "#ns-cli"), telefone: nulo(val(el, "#ns-tel")), email: nulo(val(el, "#ns-email")), endereco: nulo(val(el, "#ns-end")), observacoes: nulo(val(el, "#ns-obs")),
        autoriza_divulgar: $("#ns-divulgar", el).checked ? true : undefined,
        loja_id: lojaEscolhida && $("#ns-loja", el).value === rotuloLoja(lojaEscolhida) ? lojaEscolhida.id : null,
        chamado: pre.chamado || undefined, chamado_aberto: pre.aberto || undefined
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
        return levarChamadosDaLoja(novos).catch(function (e) { falhou(e); return { porServ: {} }; }).then(function (lv) { return { novos: novos, lv: lv }; });
      }).then(function (r) {
        if (!r) return;
        var novos = r.novos;
        rota();
        var zaps = novos.map(function (s) { return botaoZap(s, r.lv.porServ[s.id]); }).filter(Boolean);
        if (zaps.length) A.janela("<p>Avise a equipe:</p>" + zaps.map(function (z) { return '<div class="acoes">' + z + "</div>"; }).join(""), { titulo: "Serviço salvo" });
      }).catch(function (e) {
        // se a obra foi criada e as partes falharam, a próxima tentativa usa a mesma obra
        A.ocupado(b, false);
        erro.innerHTML = '<div class="aviso erro">' + esc(A.msgErro(e)) + "</div>";
      });
    };
  }

  // ---- chamados do cliente (ex.: app do Supermercados BH): cola o texto e vira um serviço ----
  // Formato reconhecido:  "37377 - 29/09/2026 07:41 / L320 - Normal / Elétrica/Gerador | Iluminação | Luminárias queimadas"
  // Detalhes do chamado no portal (abas Histórico, Ordens de serviço e Requisições de compra):
  // OS da AGE e a situação dela, valor, requisições de compra, reprovação pela loja e comentários.
  // Campo ausente = a aba colada não diz (ao juntar colagens, não apaga o que outra aba trouxe).
  function lerPortal(t, ls, stChamado) {
    var p = { outros: [], comentarios: [] }, m, i, osAge = {}, reqAge = {}, sitOS = {}, sitReq = {}, prest = {}, ordem = {};
    var re = /n[uú]mero\s*'(\d+)'\s*criada\.?\s*para o prestador\s*'([^']*)'/gi;
    while ((m = re.exec(t))) {
      if (!(m[1] in ordem)) ordem[m[1]] = m.index;
      if (EH_AGE.test(m[2])) { osAge[m[1]] = 1; p.os = m[1]; } else { prest[m[1]] = m[2]; if (p.outros.indexOf(m[1]) < 0) p.outros.push(m[1]); }
    }
    // situação das OS, na ordem do histórico (duas formas de escrever no portal)
    var ev = [];
    re = /ordem (?:de )?servi[cç]o de n[uú]mero\s*'(\d+)'\s*foi alterad[oa](?: de)?(?: para)?\s*'([^']+)'/gi;
    while ((m = re.exec(t))) ev.push([m.index, m[1], m[2]]);
    re = /ordem de servi[cç]o\s*n[º°o]?\.?\s*(\d+)\s*foi alterad[oa](?: de)?\s*para\s*'([^']+)'/gi;
    while ((m = re.exec(t))) ev.push([m.index, m[1], m[2]]);
    ev.sort(function (a, b) { return a[0] - b[0]; }).forEach(function (e) { sitOS[e[1]] = e[2]; });
    // requisições de compra da AGE (criadas para ela ou desdobradas de uma dela)
    re = /requisi[cç][aã]o de compras? de n[uú]mero\s*'(\d+)'\s*foi criada para o prestador\s*'([^']*)'/gi;
    while ((m = re.exec(t))) if (EH_AGE.test(m[2])) reqAge[m[1]] = 1;
    re = /requisi[cç][aã]o de compras? n[º°o]?\.?\s*(\d+),\s*a requisi[cç][aã]o de n[º°o]?\.?\s*(\d+)/gi;
    while ((m = re.exec(t))) if (reqAge[m[1]]) reqAge[m[2]] = 1;
    re = /requisi[cç][aã]o de compras? de n[uú]mero\s*'(\d+)'[^'\n]*?(?:status alterado para|foi alterad[oa] para)\s*'([^']+)'/gi;
    while ((m = re.exec(t))) sitReq[m[1]] = m[2];
    // abas em tabela: Ordens de serviço "10744 · usuário · prestador · tipo · valor · valor negociação · (situação na linha de baixo)"
    // e Requisições "OS · nº · emissão · usuário · prestador · (situação)"
    var lin = t.split("\n");
    function situacaoDepois(cel, k, idx) {
      if (cel[k]) return cel[k];
      for (var n = idx + 1; n < lin.length && n < idx + 4; n++) { var x = lin[n].trim(); if (x) return /^[A-Za-zÀ-ú ]{3,30}$/.test(x) ? x : ""; }
      return "";
    }
    for (i = 0; i < lin.length; i++) {
      var cel = lin[i].split("\t").map(function (x) { return x.trim(); });
      if (cel.length < 4 || !/^\d{3,8}$/.test(cel[0])) continue;
      if (/^\d{2,8}$/.test(cel[1]) && /^\d{2}\/\d{2}\/\d{4}$/.test(cel[2])) {
        if (osAge[cel[0]] || EH_AGE.test(cel[4] || "")) {
          reqAge[cel[1]] = 1; var sr = situacaoDepois(cel, 5, i); if (sr) sitReq[cel[1]] = sr;
          if (EH_AGE.test(cel[4] || "")) { osAge[cel[0]] = 1; if (!p.os) p.os = cel[0]; }   // a aba só de requisições também diz a OS da AGE
        }
      } else if (EH_AGE.test(cel[2] || "")) {
        osAge[cel[0]] = 1; p.os = cel[0]; if (!(cel[0] in ordem)) ordem[cel[0]] = Number(cel[0]);
        var vs = cel.slice(4, 6).filter(function (x) { return /^\d{1,3}(\.\d{3})*,\d{2}$/.test(x); });
        if (vs.length) p.valor = A.lerNumero(vs[vs.length - 1]);
        var so = situacaoDepois(cel, 6, i); if (so) sitOS[cel[0]] = so;
      } else if (cel[2]) {
        prest[cel[0]] = cel[2]; if (p.outros.indexOf(cel[0]) < 0) p.outros.push(cel[0]); if (!(cel[0] in ordem)) ordem[cel[0]] = Number(cel[0]);
        var so2 = situacaoDepois(cel, 6, i); if (so2) sitOS[cel[0]] = so2;
      }
    }
    if (p.os && sitOS[p.os]) p.osSit = sitOS[p.os];
    // de quem é o chamado: vale a última OS criada que ainda está valendo (não cancelada nem reprovada)
    var vale = function (n) { return !/cancel|reprov/i.test(sitOS[n] || ""); };
    var todas = Object.keys(osAge).concat(p.outros).filter(vale).sort(function (a, b) { return (ordem[a] || 0) - (ordem[b] || 0); });
    var dono = todas[todas.length - 1];
    if (todas.length) p.outroPrest = "";
    if (dono && !osAge[dono]) p.outroPrest = "OS " + dono + " · " + String(prest[dono] || "outro prestador").replace(/\s*-\s*\(\d[\d./-]*\).*$/, "");
    var reqs = Object.keys(reqAge).map(function (n) { return { n: n, sit: sitReq[n] || "" }; });
    if (reqs.length) p.req = reqs;
    if (stChamado) p.status = stChamado;
    // histórico: cada registro é o texto seguido da linha "dd/mm/aaaa hh:mm:ss - autor"
    var iH = -1; for (i = 0; i < ls.length; i++) if (semAcento(ls[i]) === "historico") { iH = i; break; }
    var regs = [], buf = [];
    if (iH >= 0) ls.slice(iH + 1).forEach(function (x) {
      var mt = x.match(/^(\d{2}\/\d{2}\/\d{4})\s+\d{1,2}:\d{2}(?::\d{2})?\s*-\s*(.*)$/);
      if (mt) { regs.push({ txt: buf.join(" ").trim(), data: mt[1], autor: mt[2] }); buf = []; }
      else if (!/^(ordens de servi[cç]o|requisi[cç][oõ]es de compra|visualizar|descri[cç][aã]o|enviar|com)$/i.test(x)) buf.push(x);
    });
    if (regs.length) {
      var auto = /^(status |a? ?ordem de servi|requisi|a requisi|foi gerada|pedido criado|chamado reprovado)/i;
      p.comentarios = regs.filter(function (r) { return r.txt && !auto.test(r.txt); }).map(function (r) { return r.txt; });
      // reprovado pela loja e ainda não concluído de novo
      var ir = -1; regs.forEach(function (r, k) { if (/chamado reprovado/i.test(r.txt)) ir = k; });
      var refeito = ir >= 0 && regs.slice(ir + 1).some(function (r) { return /servi[cç]o conclu[ií]do/i.test(r.txt); });
      if (ir >= 0 && !refeito) {
        var rr = regs[ir], nota = (rr.txt.match(/nota:\s*(\d+)/i) || [])[1];
        var motivo = [ir > 0 && !auto.test(regs[ir - 1].txt) ? regs[ir - 1].txt : "",
          rr.txt.replace(/chamado reprovado\.?/i, "").replace(/status alterado para\s*'[^']*'\.?/i, "").replace(/nota:\s*\d+\.?/i, "").trim()].filter(Boolean).join(" ");
        p.reprovado = { data: rr.data, por: rr.autor, nota: nota ? Number(nota) : null, motivo: motivo.slice(0, 400) };
      } else p.reprovado = false;
      // reclamação da loja no histórico ("não veio ninguém", "continua com defeito"...) ainda sem novo "Serviço concluído"
      var ic = -1;
      regs.forEach(function (r, k) { if (r.txt && !auto.test(r.txt) && !EH_AGE.test(r.autor) && RECLAMA.test(semAcento(r.txt))) ic = k; });
      var resolvida = ic >= 0 && regs.slice(ic + 1).some(function (r) { return /servi[cç]o conclu[ií]do/i.test(r.txt); });
      p.reclamacao = ic >= 0 && !resolvida ? { data: regs[ic].data, por: regs[ic].autor, txt: regs[ic].txt.slice(0, 400) } : false;
    }
    p.lido_em = new Date().toISOString();
    return p;
  }
  // frases de reclamação da loja (comparadas sem acento)
  var RECLAMA = new RegExp(["nao veio ninguem", "ninguem (veio|apareceu|compareceu|esteve)", "nao (compareceu|apareceu|vieram|veio|esteve)",
    "nao (foi|esta|estao|ficou) (feito|feita|realizad|executad|resolvid|funcionando|pronto|concluid)", "nao (resolveu|funciona|ficou bom)",
    "continua (com|sem|dando|parad|queimad|o mesmo|a mesma|desligad|apagad)", "persiste", "mal feito", "malfeito", "reclama", "insatisf",
    "pessimo", "nao estou ciente", "voltou a (dar|queimar|desarmar|parar|vazar|apagar)", "mesmo problema", "servico incompleto"].join("|"));
  // chamado com problema na loja: reprovado ou com reclamação
  function problemaPortal(p) { return !!(p && (p.reprovado || p.reclamacao)); }
  // o que falta fazer em um chamado, pela situação no portal e no app. Calculado na hora:
  // ao colar os Detalhes novos (Atualizar) ou mudar o serviço no app, a pendência some sozinha.
  function pendenciaChamado(o) {
    if (!o || !o.chamado || ehPrefObra(o)) return null;
    var p = o.portal || {}, st = String(p.status || ""), os = String(p.osSit || "");
    if (problemaPortal(p) || /finaliz/i.test(st + " " + os)) return null;   // reprovado/reclamação já tem o alerta vermelho
    var sv = S.serv.filter(function (x) { return x.obra_id === o.id && x.status !== "cancelado"; });
    if (!sv.length) return null;
    var abertos = sv.filter(function (x) { return x.status === "aberto" || x.status === "em_andamento"; });
    var aguard = sv.filter(function (x) { return x.status === "aguardando"; });
    var semFunc = abertos.filter(function (x) { return !x.funcionario_id; });
    var r = function (txt, cor, x) { return { obra: o, serv: x || sv[0], txt: txt, cor: cor }; };
    if (p.outroPrest && (abertos.length || aguard.length)) return r("✖ não pertence à AGE (" + p.outroPrest + "): cancele o serviço", "critico", abertos[0] || aguard[0]);
    if (/cancel/i.test(st) && (abertos.length || aguard.length)) return r("✖ chamado cancelado no portal: cancele o serviço no app", "critico", abertos[0] || aguard[0]);
    if (/reprov/i.test(os) && (abertos.length || aguard.length)) return r("✖ orçamento reprovado no portal: renegocie ou cancele", "critico", abertos[0] || aguard[0]);
    if (/aprov/i.test(os) && aguard.length) return r("🔧 aprovado no portal: volte o serviço para Aberto e escolha o funcionário", "atencao", aguard[0]);
    if (aguard.length && (!os || /pendente/i.test(os))) return r("🧾 visita de orçamento feita: lance o orçamento no portal", "atencao", aguard[0]);
    if (/aprov/i.test(os) && semFunc.length) return r("🔧 aprovado: escolha o funcionário para executar", "atencao", semFunc[0]);
    if (/pendente/i.test(os) && semFunc.length) return r("🧾 OS pendente: mande alguém fazer o orçamento", "atencao", semFunc[0]);
    var concl = sv.every(function (x) { return x.status === "concluido"; });
    if (concl && !/execut/i.test(os) && !/avalia/i.test(st)) {
      var ult = sv.map(function (x) { return x.concluido_em || ""; }).sort().pop();
      // sem situação do portal, só lembra dos concluídos nos últimos 30 dias
      if (o.portal || (ult && Date.now() - new Date(ult).getTime() < 30 * 86400000))
        return r("✅ executado no app: finalize o chamado no portal" + (provaFalta(sv[0], null).length ? " (⚠️ confira: sem foto de depois)" : ""), "atencao");
    }
    return null;
  }
  function pendencias() { return S.obras.map(pendenciaChamado).filter(Boolean); }
  // revisão: chamados lançados, com serviço em aberto, que ainda não foram conferidos no portal (Detalhes nunca colados)
  function semConferir() {
    return S.obras.filter(function (o) {
      return o.chamado && !ehPrefObra(o) && !o.portal && S.serv.some(function (x) { return x.obra_id === o.id && (x.status === "aberto" || x.status === "em_andamento" || x.status === "aguardando"); });
    }).sort(function (a, b) { return dataObra(b) - dataObra(a); });
  }
  function htmlRevisao(lista) {
    if (!lista.length) return "";
    return '<details class="cartao" style="margin:10px 0"><summary><b>🔍 Revisão: ' + lista.length + " chamado" + (lista.length > 1 ? "s lançados ainda não conferidos" : " lançado ainda não conferido") + " no portal</b></summary>" +
      '<p class="peq mudo" style="margin:6px 0">Abra cada um no portal, copie a tela <b>Detalhes</b> e cole na caixa de chamados. O app confere se é da AGE (os que não forem, cancela) e a etapa.</p>' +
      '<div class="peq">' + lista.map(function (o) { return "<b>" + esc(o.chamado) + "</b> " + esc(o.cliente); }).join(" · ") + "</div></details>";
  }
  // etapa do chamado no portal, para o selo
  function etapaPortal(p) {
    if (!p) return null;
    var st = String(p.status || ""), os = String(p.osSit || "");
    if (/finaliz/i.test(st) || /finaliz/i.test(os)) return { txt: "✅ finalizado no portal", cor: "bom" };
    if (/cancel/i.test(st)) return { txt: "✖ chamado cancelado", cor: "critico" };
    if (p.reprovado) return { txt: "⚠️ REPROVADO pela loja" + (p.reprovado.nota !== null && p.reprovado.nota !== undefined ? " · nota " + p.reprovado.nota : ""), cor: "critico" };
    if (p.reclamacao) return { txt: "🚨 RECLAMAÇÃO da loja", cor: "critico" };
    if (/avalia/i.test(st)) return { txt: "⏳ em avaliação pela loja", cor: "atencao" };
    if (/execut/i.test(os)) return { txt: "✔ executado no portal", cor: "bom" };
    // material: requisição de compra da AGE ainda em compra/análise, ou já comprada
    var reqs = (p.req || []).filter(function (r) { return !/cancel/i.test(r.sit); });
    var emCompra = reqs.some(function (r) { return /compra|an[aá]lise|pendente|aberta/i.test(r.sit) || !r.sit; });
    var comprado = reqs.length && reqs.every(function (r) { return /finaliz|entreg|atendid/i.test(r.sit); });
    if (emCompra && !/reprov|cancel/i.test(os)) return { txt: "🛒 " + (/aprov/i.test(os) ? "aprovado · " : "") + "material em compra", cor: "atencao" };
    if (/aprov/i.test(os)) return { txt: "🔧 aprovado" + (comprado ? " · material comprado" : "") + ": executar", cor: "atencao" };
    if (/or[cç]ad/i.test(os)) return { txt: "💲 orçado: aguardando aprovação", cor: "" };
    if (/reprov/i.test(os)) return { txt: "✖ orçamento reprovado", cor: "critico" };
    if (/cancel/i.test(os)) return { txt: "✖ OS cancelada", cor: "critico" };
    if (/pendente/i.test(os)) return { txt: "🧾 OS pendente: orçar", cor: "atencao" };
    if (p.os) return { txt: "OS " + p.os, cor: "" };
    return null;
  }
  function seloPortal(p) {
    var e = etapaPortal(p);
    if (!e) return "";
    return '<span class="selo ' + e.cor + '" title="Situação no portal do cliente">' + esc(e.txt) + "</span>" + (p.valor ? ' <span class="selo">💲 ' + esc(A.dinheiro(p.valor)) + "</span>" : "");
  }
  // junta o que duas colagens (abas diferentes dos Detalhes) disseram do mesmo chamado
  function juntarPortal(velho, novo) {
    if (!novo) return velho || null;
    var r = Object.assign({}, velho || {});
    Object.keys(novo).forEach(function (k) { if (novo[k] !== undefined && !Array.isArray(novo[k])) r[k] = novo[k]; });
    // listas: junta as duas (requisições pelo número, ficando a situação mais nova)
    var req = (r.req || []).map(function (x) { return Object.assign({}, x); });
    (novo.req || []).forEach(function (x) { var e = req.filter(function (y) { return y.n === x.n; })[0]; if (e) { if (x.sit) e.sit = x.sit; } else req.push(Object.assign({}, x)); });
    if (req.length) r.req = req;
    r.outros = (r.outros || []).concat((novo.outros || []).filter(function (x) { return (r.outros || []).indexOf(x) < 0; }));
    return r;
  }
  // prestador da AGE no portal do BH: CNPJ, "AGE SOLUCOES..." ou o nome do Antônio
  var EH_AGE = /17\.134\.491|\bage\b|ant[oô]nio/i;
  function lerChamado(texto) {
    var t = String(texto || "").replace(/\r/g, "");
    // tela "Detalhes" do portal: rótulo numa linha e valor na linha seguinte
    var ls = t.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
    function campo(rot) {
      for (var i = 0; i < ls.length - 1; i++) if (semAcento(ls[i]) === rot) return ls[i + 1];
      return "";
    }
    // a página da lista traz o filtro "Número / 0 ... Centro / Selecione uma opção": isso não é a tela Detalhes
    if (/^\d*[1-9]\d*$/.test(campo("numero")) && /^[a-z]?\s*\d/i.test(campo("centro"))) {
      var p = lerPortal(t, ls, campo("status chamado"));
      // comentários do histórico (sem as linhas automáticas do portal)
      var histTxt = p.comentarios.join(" / ");
      if (histTxt.length > 500) histTxt = histTxt.slice(0, 500) + "…";
      var dsc = campo("descricao"), loc = campo("locais"), desc = [dsc, loc ? "Local: " + loc : "", campo("solicitante") ? "Solicitante: " + campo("solicitante") : "",
        campo("coordenador") ? "Coordenador: " + campo("coordenador") : "", p.os ? "OS da AGE: " + p.os : "", histTxt ? "Histórico: " + histTxt : ""].filter(Boolean).join(" · ");
      var sa = semAcento(dsc), stCh = campo("status chamado"), sitOS = p.osSit || "";
      if (/finaliz|cancel/i.test(stCh)) sitOS = stCh;
      if (problemaPortal(p)) sitOS = "";   // reprovado ou reclamação: tem que voltar lá, não é "já executado"
      delete p.comentarios;
      return { numero: campo("numero").replace(/\D/g, ""), data: campo("abertura"), loja: campo("centro"), prioridade: campo("prioridade"), desc: desc,
        situacao: sitOS, outro: !!p.outroPrest, detalhes: true, portal: p,
        cat: /pintura|pintar|parede|piso|alvenaria/.test(sa) && !/tomada|eletric|ilumina|lumin|quadro|disjuntor|cabo|fio/.test(sa) ? "pintura" : "eletrica" };
    }
    var m = t.match(/(\d{3,8})\s*[-–]\s*(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{1,2}:\d{2}))?/);
    var ml = t.match(/\bL\s*0*(\d{1,4})\b(?:\s*[-–]\s*([A-Za-zÀ-ú]+))?/);
    var linhas = t.split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean);
    var desc = linhas.filter(function (x) { return x.indexOf("|") >= 0; }).join(" ") ||
      linhas.filter(function (x) { return !(m && x.indexOf(m[1]) >= 0) && !(ml && /^L\s*\d/.test(x)); }).join(" ");
    var semAc = semAcento(desc);
    var cat = /pintura|civil|alvenaria|parede|piso/.test(semAc) && !/eletric|gerador|ilumina|tomada|quadro|disjuntor/.test(semAc) ? "pintura" : "eletrica";
    return { numero: m ? m[1] : "", data: m ? m[2] + (m[3] ? " " + m[3] : "") : "", loja: ml ? ml[1] : "", prioridade: ml && ml[2] ? ml[2] : "", desc: desc.replace(/\s+/g, " ").trim(), cat: cat };
  }
  // centro do cliente -> loja cadastrada. "L320"/"320" = loja; "P623" = posto
  function lojaPorCodigo(cod) {
    var t = String(cod || "").trim().toUpperCase(), pre = (t.match(/^[A-Z]/) || [""])[0], n = parseInt(t.replace(/\D/g, ""), 10);
    if (isNaN(n)) return null;
    var tipo = pre === "P" ? "posto" : pre === "L" || !pre ? "loja" : null;
    if (!tipo) return null;
    for (var i = 0; i < S.lojas.length; i++) {
      var l = S.lojas[i];
      if ((l.tipo || "loja") === tipo && parseInt(String(l.codigo || "").replace(/\D/g, ""), 10) === n) return l;
    }
    return null;
  }
  // lista copiada do portal (Meus chamados ou Ordens de serviço): uma linha por chamado
  // lista "Ordens de serviço" do portal (só OS da AGE): nº da OS, nº do chamado, prioridade, emissão, centro,
  // solicitante, tipo, coordenador, valor negociado e situação — cada OS ocupa várias linhas
  function lerListaOS(t) {
    var re = /(?:^|\n)\s*(\d{3,8})[\t ]*\n\s*(\d{3,8})[\t ]*\n\s*(Normal|Alta|Urgente|Baixa|Emergencial|Cr[ií]tica)?[\t ]*\n?\s*(\d{2}\/\d{2}\/\d{4})\t+([LP]\s*\d{1,4})\t([^\n]*)\n\s*([A-Za-zÀ-ú][A-Za-zÀ-ú ]{2,30})/g, m, r = [], vistos = {};
    while ((m = re.exec(t))) {
      if (vistos[m[2]]) continue;
      vistos[m[2]] = 1;
      var cel = m[6].split("\t").map(function (x) { return x.trim(); }), valor = cel.filter(function (x) { return /^\d{1,3}(\.\d{3})*,\d{2}$/.test(x); }).pop();
      var sit = m[7].trim(), portal = { os: m[1], osSit: sit, outros: [], lido_em: new Date().toISOString() };
      if (valor) portal.valor = A.lerNumero(valor);
      if (/finaliz/i.test(sit)) portal.status = "Finalizado";
      r.push({ numero: m[2], data: m[4], centro: m[5].replace(/\s/g, ""), prioridade: m[3] || "", situacao: sit, portal: portal });
    }
    return r;
  }
  function lerListaChamados(texto) {
    var vistos = {}, t = String(texto || "");
    var listaOS = lerListaOS(t.replace(/\r/g, ""));
    if (listaOS.length) return listaOS;
    var porLinha = lerLinhas(t.split(/\n+/));
    if (porLinha.length >= 2) return porLinha;
    // tabela copiada com uma célula por linha: junta cada chamado a partir da data de abertura
    vistos = {};
    var blocos = t.split(/(?=\b(?:Normal|Alta|Urgente|Baixa|Emergencial|Cr[ií]tica)\b\s+\d{2}\/\d{2}\/\d{4})/i).map(function (b) { return b.replace(/\s+/g, " "); });
    if (lerLinhas(blocos).length < 2) blocos = t.split(/(?=^\s*\d{2}\/\d{2}\/\d{4}\s*\n\s*\d{3,8}\s*$)/m).map(function (b) { return b.replace(/\s+/g, " "); });
    return lerLinhas(blocos);
  }
  function lerLinhas(linhas) {
    var vistos = {};
    return linhas.map(function (linha) {
      var md = linha.match(/(\d{2}\/\d{2}\/\d{4})/), mc = linha.match(/\b([LP])\s*0*(\d{1,4})\b/);
      if (!md || !mc) return null;
      var antes = linha.slice(0, md.index), depois = linha.slice(md.index + md[0].length);
      var num = (depois.match(/^\D*?\b(\d{3,8})\b/) || [])[1];
      if (!num) { var nums = antes.match(/\b\d{3,8}\b/g) || []; num = nums[nums.length - 1]; }
      if (!num || vistos[num]) return null;
      vistos[num] = true;
      var prio = (linha.match(/\b(Normal|Alta|Urgente|Baixa|Emergencial|Cr[ií]tica)\b/i) || [])[1] || "";
      var sit = (linha.match(/\b(Pendente|Or[cç]ada|Aprovada|Finalizada|Executada|Conclu[ií]da|Cancelada|Em atendimento|Em execu[cç][aã]o)\b/i) || [])[1] || "";
      // aba Finalizados: tem a data de encerramento depois do centro
      // aba Finalizados: a data de encerramento vem depois do centro (vira a data do fechamento do mês)
      var mfim = linha.slice(mc.index + mc[0].length).match(/(\d{2}\/\d{2}\/\d{4})/), item = { numero: num, data: md[1], centro: mc[1] + mc[2], prioridade: prio, situacao: sit };
      if (!sit && mfim) { item.situacao = "Finalizado"; item.portal = { status: "Finalizado", finalizado_em: isoDeBR(mfim[1]), outros: [], lido_em: new Date().toISOString() }; }
      return item;
    }).filter(Boolean);
  }
  // ---- caixa de chamados: junta várias colagens (páginas da lista, telas de detalhes), organiza e só então lança ----
  var CHAVE_CAIXA = "age_caixa_chamados", caixaMem = null;
  function lerCaixa() {
    if (caixaMem) return caixaMem;
    try { caixaMem = JSON.parse(localStorage.getItem(CHAVE_CAIXA) || "[]"); } catch (e) { caixaMem = []; }
    return caixaMem;
  }
  function gravarCaixa(l) { caixaMem = l; try { localStorage.setItem(CHAVE_CAIXA, JSON.stringify(l)); } catch (e) { /* sem armazenamento: fica só na memória */ } }
  // junta na caixa: mesmo nº = mesmo chamado (completa o que faltava, não duplica)
  // chamado aberto antes da data de corte (config CHAMADOS_DESDE) e que ainda não está no app: retroativo, não entra
  function corteChamados() { return (A.CFG && A.CFG.CHAMADOS_DESDE) || ""; }
  function retroativo(c) {
    var d = isoDeBR(c.data), corte = corteChamados();
    return !!(corte && d && d < corte && !S.obras.some(function (o) { return o.chamado === c.numero; }));
  }
  function juntarNaCaixa(itens) {
    var cx = lerCaixa().slice().filter(function (c) { return !retroativo(c); }), novos = 0, atual = 0, antigos = 0, listaNovos = [], listaAntigos = [];
    itens.forEach(function (it) {
      if (!/^\d*[1-9]\d*$/.test(String(it.numero || ""))) return;
      if (retroativo(it)) { antigos++; listaAntigos.push(it); return; }
      var ex = cx.filter(function (c) { return c.numero === it.numero; })[0];
      var limpo = {}; Object.keys(it).forEach(function (k) { if (it[k] !== "" && it[k] !== null && it[k] !== undefined && it[k] !== false) limpo[k] = it[k]; });
      if (ex) {
        var pv = juntarPortal(ex.portal, it.portal);
        // a aba Ordens de serviço não traz os comentários: não troca uma descrição mais completa
        if (limpo.desc && /Histórico:/.test(ex.desc || "") && !/Histórico:/.test(limpo.desc)) delete limpo.desc;
        Object.assign(ex, limpo);
        if (pv) ex.portal = pv;
        if (problemaPortal(pv)) ex.situacao = "";
        if (it.outro === false && it.detalhes) ex.outro = false;
        atual++;
      }
      else { var nv = Object.assign({ marcado: null }, limpo); cx.push(nv); novos++; listaNovos.push(nv); }
    });
    gravarCaixa(cx);
    return { novos: novos, atual: atual, antigos: antigos, listaNovos: listaNovos, listaAntigos: listaAntigos };
  }
  // situação do item na caixa: já lançado, ignorado (com motivo) ou pronto
  // palavras que identificam o pedido ("ventiladores" -> "ventil"), sem as que aparecem em quase todo chamado
  var PALAVRA_COMUM = /^(solici|instal|servic|favor|necess|precis|estamo|fazer|orcame|orcar|verifi|manute|urgent|quanta|materi|execuc|horas|setor|local|loja|para|dentr|todos|todas|esta|estao|nesse|nessa|ainda|outro|outra|sendo|tambe|pois)/;
  function chavesPedido(t) {
    var r = [];
    semAcento(String(t || "").split(" · ")[0].replace(/^Chamado nº[^\n]*\n?/, "")).split(/[^a-z0-9]+/).forEach(function (w) {
      if (w.length < 5 || /^\d+$/.test(w)) return;
      var k = w.slice(0, 6);
      if (!PALAVRA_COMUM.test(k) && r.indexOf(k) < 0) r.push(k);
    });
    return r;
  }
  // serviço já cadastrado na mesma loja, sem nº de chamado, pedindo a mesma coisa (lançado à mão antes do chamado)
  function servicoParecido(c) {
    var l = lojaPorCodigo(c.centro || c.loja), ch = chavesPedido(c.desc);
    if (!l || !ch.length) return null;
    var achou = null;
    S.obras.forEach(function (o) {
      if (achou || o.loja_id !== l.id || o.chamado) return;
      S.serv.forEach(function (x) {
        if (achou || x.obra_id !== o.id || x.status === "cancelado") return;
        var cx = chavesPedido(x.descricao);
        if (ch.some(function (k) { return cx.indexOf(k) >= 0; })) achou = { obra: o, serv: x };
      });
    });
    return achou;
  }
  function avaliarItem(c) {
    if (S.obras.some(function (o) { return o.chamado === c.numero; })) {
      if (c.outro && c.detalhes) return { ja: true, atualizar: true, naoAge: true, txt: "✖ lançado no app, mas não pertence à AGE", cor: "critico" };
      return c.desc && c.detalhes ? { ja: true, atualizar: true, txt: "já lançado · descrição nova", cor: "atencao" } : { ja: true, txt: "já lançado", cor: "" };
    }
    if (c.outro) return { ignorar: true, txt: "OS de outro prestador", cor: "critico" };
    if (c.situacao && /or[cç]ad|finaliz|execut|conclu|cancel/i.test(c.situacao)) return { ignorar: true, txt: "já " + c.situacao.toLowerCase(), cor: "critico" };
    var par = servicoParecido(c);
    if (par) return { dup: par, txt: "⚠️ parece repetido: já existe na loja “" + resumoServ(par.serv, 50) + "” (" + A.STATUS[par.serv.status] + ")", cor: "critico" };
    return { ok: true, txt: lojaPorCodigo(c.centro || c.loja) ? "novo" : "novo · loja não cadastrada", cor: lojaPorCodigo(c.centro || c.loja) ? "bom" : "atencao" };
  }
  function importarChamado() {
    var j = A.janela('<p class="peq mudo" style="margin-top:0">Cole aqui quantas vezes quiser: <b>cada página</b> de <b>Meus chamados</b> ou de <b>Ordens de serviço</b> (selecione a tabela e Ctrl+C) ' +
      "e a tela <b>Detalhes</b> de um chamado (completa a descrição). Tudo vai para a caixa abaixo, sem repetir. Depois confira e lance.</p>" +
      (corteChamados() ? '<p class="peq mudo" style="margin:0 0 4px">⏭ Só entram chamados abertos a partir de <b>' + esc(A.dataSimples(corteChamados())) + "</b> (os retroativos são ignorados; os que já estão no app continuam sendo atualizados).</p>" : "") +
      '<textarea id="ch-txt" rows="3" placeholder="Cole aqui (Ctrl+V)"></textarea><div id="ch-msg" class="peq" style="margin-top:4px"></div><div id="cx-rev"></div><div id="cx"></div>',
      { titulo: "📋 Chamados do BH", larga: true, aoFechar: function () { if (/^(servicos|executados)$/.test(location.hash.slice(1))) rota(); } });
    var el = j.el;
    if (lerCaixa().some(retroativo)) gravarCaixa(lerCaixa().filter(function (c) { return !retroativo(c); }));   // retroativos que já estavam na caixa saem
    $("#ch-txt", el).oninput = function () {
      var t = this.value, c, itens = [];
      if (!t.trim()) return;
      c = lerChamado(t);
      if (c.detalhes && c.numero) itens = [Object.assign({ centro: c.loja }, c)];      // tela Detalhes
      else itens = lerListaChamados(t);                                                  // páginas da lista
      if (!itens.length && c.numero) itens = [Object.assign({ centro: c.loja ? "L" + c.loja : "" }, c)];  // texto do app no celular
      if (!itens.length) { $("#ch-msg", el).innerHTML = '<span class="selo critico">não reconheci chamados neste texto</span>'; return; }
      var r = juntarNaCaixa(itens);
      this.value = "";
      // chamado de outro prestador (sem OS da AGE): sai da caixa e avisa
      var naoAge = itens.filter(function (it) { return it.outro && !S.obras.some(function (o) { return o.chamado === it.numero; }); });
      if (naoAge.length) gravarCaixa(lerCaixa().filter(function (c) { return !naoAge.some(function (it) { return it.numero === c.numero; }); }));
      var naoAgeLanc = itens.filter(function (it) { return it.outro && it.detalhes && S.obras.some(function (o) { return o.chamado === it.numero; }); });
      var alertas = lerCaixa().filter(function (c) { return itens.some(function (it) { return it.numero === c.numero; }) && problemaPortal(c.portal); });
      // quais chamados entraram (e quais retroativos ficaram de fora): loja, abertura, nº e serviço, para identificar cada um
      var tabCh = function (ls, tit) {
        return ls.length ? '<details open style="margin-top:6px"><summary class="peq"><b>' + tit + " (" + ls.length + ")</b></summary>" +
          '<div class="tabela-caixa"><table><thead><tr><th>Chamado</th><th>Abertura</th><th>Loja</th><th>Serviço</th></tr></thead><tbody>' +
          ls.map(function (c) { var l = lojaPorCodigo(c.centro || c.loja); return "<tr><td><b>" + esc(c.numero) + "</b></td><td>" + esc(c.data || "—") + "</td><td>" + esc(l ? nomeLoja(l) : c.centro || c.loja || "—") + '</td><td class="peq">' + esc(String(c.desc || "").replace(/\s+/g, " ").slice(0, 120)) + "</td></tr>"; }).join("") +
          "</tbody></table></div></details>" : "";
      };
      $("#ch-msg", el).innerHTML = '<span class="selo bom">✔ ' + (r.novos ? r.novos + " adicionado" + (r.novos > 1 ? "s" : "") : "") + (r.novos && r.atual ? ", " : "") +
        (r.atual ? r.atual + " já estava" + (r.atual > 1 ? "m" : "") + " na caixa (completado" + (r.atual > 1 ? "s" : "") + ")" : "") + "</span> Pode colar a próxima página." +
        (r.antigos ? ' <span class="selo">⏭ ' + r.antigos + " retroativo" + (r.antigos > 1 ? "s" : "") + " ignorado" + (r.antigos > 1 ? "s" : "") + " (abertos antes de " + esc(A.dataSimples(corteChamados())) + ")</span>" : "") +
        tabCh(r.listaNovos, "🆕 Adicionados à caixa") + tabCh(r.listaAntigos, "⏭ Retroativos ignorados") +
        naoAgeLanc.map(function (it) {
          return '<div class="aviso erro" style="margin-top:6px">✖ <b>Chamado ' + esc(it.numero) + " já está lançado no app, mas não pertence à AGE</b>" + (it.portal && it.portal.outroPrest ? " (" + esc(it.portal.outroPrest) + ")" : "") + ". O serviço foi cancelado.</div>";
        }).join("") +
        naoAge.map(function (it) {
          return '<div class="aviso erro" style="margin-top:6px">✖ <b>Chamado ' + esc(it.numero) + " não pertence à AGE</b>" + (it.portal && it.portal.outroPrest ? " (" + esc(it.portal.outroPrest) + ")" : " (OS de outro prestador)") + ". Retirado da caixa.</div>";
        }).join("") +
        alertas.map(function (c) {
          var pr = c.portal.reprovado || c.portal.reclamacao;
          return '<div class="aviso erro" style="margin-top:6px">🚨 <b>Chamado ' + esc(c.numero) + ": " + (c.portal.reprovado ? "REPROVADO pela loja" : "RECLAMAÇÃO da loja") + "</b> em " + esc(pr.data || "") +
            ": “" + esc(String(pr.motivo || pr.txt || "").slice(0, 200)) + "”</div>";
        }).join("");
      // Detalhes de chamado que já está no app: atualiza na hora (descrição, etapa, reprovação, não é da AGE)
      var jaNoApp = lerCaixa().filter(function (c) { return c.portal && itens.some(function (it) { return it.numero === c.numero && it.portal; }) && S.obras.some(function (o) { return o.chamado === c.numero; }); });
      if (jaNoApp.length) atualizarJaLancados(null, jaNoApp, desenhar);
      desenhar();
    };
    function desenhar() {
      $("#cx-rev", el).innerHTML = htmlRevisao(semConferir());
      var cx = lerCaixa().slice().sort(function (a, b) { return String(isoDeBR(b.data)).localeCompare(String(isoDeBR(a.data))); });
      if (!cx.length) { $("#cx", el).innerHTML = '<div class="cartao vazio" style="margin-top:10px">A caixa está vazia.</div>'; return; }
      // chamados da mesma loja juntos: o grupo fica na posição do chamado mais recente
      var chaveLoja = function (c) { var t = String(c.centro || c.loja || "").toUpperCase(), n = parseInt(t.replace(/\D/g, ""), 10); return isNaN(n) ? "?" + c.numero : (t.match(/^P/) ? "P" : "L") + n; };
      var gr = {}, ordG = [];
      cx.forEach(function (c) { var k = chaveLoja(c); if (!gr[k]) { gr[k] = []; ordG.push(k); } gr[k].push(c); });
      cx = [].concat.apply([], ordG.map(function (k) { return gr[k]; }));
      var qtdLoja = function (c) { return gr[chaveLoja(c)].length; };
      var av = cx.map(avaliarItem), marc = function (c, a) { return a.ja ? false : c.marcado === null || c.marcado === undefined ? !!a.ok : c.marcado; };
      var nSel = cx.filter(function (c, i) { return marc(c, av[i]); }).length;
      var ign = av.filter(function (a) { return a.ignorar; }).length, ja = av.filter(function (a) { return a.ja; }).length;
      var marcAt = function (c, a) { return a.atualizar && c.atualizar !== false; };
      var nAt = cx.filter(function (c, i) { return marcAt(c, av[i]); }).length;
      var nFin = cx.filter(function (c, i) { return av[i].ignorar && /finaliz/i.test(c.situacao || "") && !c.outro; }).length;
      var botao = function (id) {
        return (nFin && id === "cx-lancar-topo" ? '<button class="peq" id="cx-hist">📥 Registrar ' + nFin + " finalizado" + (nFin > 1 ? "s" : "") + " no histórico</button>" : "") + (nSel ? '<button class="prim" id="' + id + '">Lançar ' + nSel + " selecionado" + (nSel > 1 ? "s" : "") + "</button>" : "") +
          (nAt ? '<button class="bom" id="' + id + '-at">✏️ Atualizar descrição de ' + nAt + " já lançado" + (nAt > 1 ? "s" : "") + "</button>" : "");
      };
      $("#cx", el).innerHTML = '<div class="cab-secao" style="margin-top:12px"><h2>Caixa: ' + cx.length + " chamado" + (cx.length > 1 ? "s" : "") + "</h2>" +
        '<span class="mudo peq">' + nSel + " selecionado" + (nSel > 1 ? "s" : "") + (ign ? " · " + ign + " ignorado" + (ign > 1 ? "s" : "") : "") + (ja ? " · " + ja + " já lançado" + (ja > 1 ? "s" : "") : "") + "</span></div>" +
        '<div class="acoes" style="margin-top:0">' + botao("cx-lancar-topo") + '<button class="peq" id="cx-limpar">🗑 Esvaziar caixa</button></div>' +
        '<div class="tabela-caixa"><table><thead><tr><th></th><th>Chamado</th><th>Abertura</th><th>Loja</th><th>O que fazer</th><th>Situação</th></tr></thead><tbody>' +
        cx.map(function (c, i) {
          var a = av[i], l = lojaPorCodigo(c.centro || c.loja), q = qtdLoja(c);
          var cab = q > 1 && (i === 0 || chaveLoja(cx[i - 1]) !== chaveLoja(c)) ?
            '<tr class="grupo-loja"><td colspan="6" class="peq" style="font-weight:600;background:rgba(127,127,127,.12)">🏪 ' + esc(l ? nomeLoja(l) : c.centro || c.loja) + " · " + q + " chamados nesta loja</td></tr>" : "";
          return cab + "<tr><td>" + (a.ja ? (a.atualizar ? '<input type="checkbox" data-cxa="' + esc(c.numero) + '"' + (marcAt(c, a) ? " checked" : "") + ' aria-label="Atualizar ' + esc(c.numero) + '">' : "") : '<input type="checkbox" data-cx="' + esc(c.numero) + '"' + (marc(c, a) ? " checked" : "") + ' aria-label="Lançar ' + esc(c.numero) + '">') + "</td><td>" + esc(c.numero) +
            "</td><td>" + esc(c.data || "") + "</td><td>" + (l ? esc(nomeLoja(l)) : esc(c.centro || c.loja || "—")) + '</td><td class="peq">' + esc(String(c.desc || "").slice(0, 70)) +
            "</td><td>" + '<span class="selo ' + a.cor + '">' + esc(a.txt) + "</span>" + (a.dup ? ' <button class="peq bom" data-cx-vinc="' + esc(c.numero) + '">🔗 Vincular a esse serviço</button>' : "") + (c.portal ? " " + seloPortal(c.portal) : c.situacao && !a.ignorar ? ' <span class="peq mudo">' + esc(c.situacao) + "</span>" : "") + "</td></tr>";
        }).join("") + "</tbody></table></div>" +
        '<div class="duas"><div><label for="cx-cat">Área (para os que não dizem)</label><select id="cx-cat"><option value="eletrica">⚡ Elétrica</option><option value="pintura">🖌️ Pintura</option></select></div>' +
        (S.semEtapa ? "<div></div>" : '<div><label for="cx-etapa">Etapa (o que o funcionário vai fazer)</label><select id="cx-etapa"><option value="auto">Automático: “fazer orçamento” → 📐 Orçamento; o resto → 🔧 Serviço</option><option value="orcamento">📐 Orçamento (visita para orçar)</option><option value="servico">🔧 Serviço (executar)</option></select></div>') + "</div>" +
        '<p class="peq mudo">Ficam desmarcados os <b>já orçados/feitos</b> e os de <b>outro prestador</b> (marque se quiser lançar). Loja não cadastrada entra com o código do centro; cadastre a loja depois para entrar nas rotas. ' +
        "Os serviços entram sem funcionário: depois, direcione na aba Serviços.</p>" +
        '<div class="acoes">' + botao("cx-lancar") + "</div>";
      $$("[data-cx]", el).forEach(function (cb) {
        cb.onchange = function () { var l = lerCaixa(); l.forEach(function (c) { if (c.numero === cb.dataset.cx) c.marcado = cb.checked; }); gravarCaixa(l); desenhar(); };
      });
      $$("[data-cx-vinc]", el).forEach(function (bt) {
        bt.onclick = function () {
          var i = cx.map(function (c) { return c.numero; }).indexOf(bt.dataset.cxVinc);
          vincularChamado(bt, cx[i], av[i].dup.obra, desenhar);
        };
      });
      $("#cx-limpar", el).onclick = function () { if (A.confirmar("Esvaziar a caixa? (os chamados já lançados não são apagados)")) { gravarCaixa([]); desenhar(); } };
      $$("[data-cxa]", el).forEach(function (cb) {
        cb.onchange = function () { var l = lerCaixa(); l.forEach(function (c) { if (c.numero === cb.dataset.cxa) c.atualizar = cb.checked; }); gravarCaixa(l); desenhar(); };
      });
      var atualizar = function () { atualizarJaLancados(this, cx.filter(function (c, i) { return marcAt(c, av[i]); }), desenhar); };
      ["#cx-lancar-at", "#cx-lancar-topo-at"].forEach(function (id) { if ($(id, el)) $(id, el).onclick = atualizar; });
      var lancar = function () { lancarCaixa(this, cx.filter(function (c, i) { return marc(c, av[i]); }), $("#cx-cat", el).value, j, false, $("#cx-etapa", el) ? $("#cx-etapa", el).value : null); };
      // finalizados no portal que nunca entraram no app: entram já concluídos (aparecem em Executados, com o valor)
      if ($("#cx-hist", el)) $("#cx-hist", el).onclick = function () {
        lancarCaixa(this, cx.filter(function (c, i) { return av[i].ignorar && /finaliz/i.test(c.situacao || "") && !c.outro; }), $("#cx-cat", el).value, j, true);
      };
      if ($("#cx-lancar", el)) $("#cx-lancar", el).onclick = lancar;
      if ($("#cx-lancar-topo", el)) $("#cx-lancar-topo", el).onclick = lancar;
    }
    desenhar();
    $("#ch-txt", el).focus();
  }
  // chamado que já virou serviço: troca o "o que fazer" pela descrição completa da tela Detalhes
  function atualizarJaLancados(b, sel, redesenhar) {
    var tarefas = [], obrasAt = [], reabrir = 0, cancelados = 0, finalizados = 0;
    sel.forEach(function (c) {
      S.obras.filter(function (o) { return o.chamado === c.numero; }).forEach(function (o) {
        var pv = juntarPortal(o.portal, c.portal);
        if (pv) obrasAt.push({ obra: o, portal: pv });
        S.serv.filter(function (x) { return x.obra_id === o.id; }).forEach(function (x) {
          var d = String(x.descricao || ""), l1 = /^Chamado nº/.test(d) ? d.split("\n")[0] : "Chamado nº " + c.numero + (c.data ? " (aberto em " + c.data + ")" : "");
          var corpo = !c.desc || (/Histórico:/.test(d) && !/Histórico:/.test(c.desc)) ? d.split("\n").slice(/^Chamado nº/.test(d) ? 1 : 0).join("\n") : c.desc;
          var dados = { descricao: l1 + "\n" + corpo };
          // finalizado no portal: o serviço que ainda estava aberto no app passa a concluído
          if (pv && (/finaliz/i.test(pv.status || "") || /finaliz/i.test(pv.osSit || "")) && !problemaPortal(pv) && x.status !== "concluido" && x.status !== "cancelado") {
            dados.status = "concluido"; dados.concluido_em = new Date().toISOString(); finalizados++;
          }
          // revisão: o chamado é de outro prestador — cancela o que ainda não foi feito
          if (c.outro && x.status !== "concluido" && x.status !== "cancelado") { dados.status = "cancelado"; dados.descricao = l1 + "\nNão pertence à AGE" + (pv && pv.outroPrest ? " (" + pv.outroPrest + ")" : "") + ".\n" + corpo; cancelados++; return tarefas.push({ serv: x, dados: dados }); }
          // reprovado pela loja: o serviço volta a ficar aberto para a equipe voltar lá
          if (problemaPortal(pv) && (x.status === "concluido" || x.status === "aguardando")) { dados.status = "aberto"; dados.concluido_em = null; reabrir++; }
          tarefas.push({ serv: x, dados: dados });
        });
      });
    });
    if (!tarefas.length && !obrasAt.length) return;
    if (b) A.ocupado(b, true, "Atualizando...");
    Promise.all(obrasAt.map(function (t) {
      return q(sb.from("obras").update({ portal: t.portal }).eq("id", t.obra.id).select().single()).then(function (n) { trocar(S.obras, n); });
    }).concat(tarefas.map(function (t) {
      return q(sb.from("servicos").update(t.dados).eq("id", t.serv.id).select().single()).then(function (n) { trocar(S.serv, n); });
    }))).then(function () {
      var feitos = {}; sel.forEach(function (c) { feitos[c.numero] = 1; });
      gravarCaixa(lerCaixa().filter(function (c) { return !feitos[c.numero]; }));
      if (tarefas.length) A.avisar(tarefas.length + " serviço" + (tarefas.length > 1 ? "s" : "") + " atualizado" + (tarefas.length > 1 ? "s" : ""), "ok");
      if (finalizados) A.avisar("✅ " + finalizados + " serviço" + (finalizados > 1 ? "s finalizados" : " finalizado") + " no portal: marcado" + (finalizados > 1 ? "s" : "") + " como concluído no app.", "ok");
      if (cancelados) A.avisar("✖ " + cancelados + " serviço" + (cancelados > 1 ? "s cancelados" : " cancelado") + ": o chamado não pertence à AGE.", "erro");
      if (reabrir) A.avisar("⚠️ " + reabrir + " serviço" + (reabrir > 1 ? "s reprovados voltaram" : " reprovado voltou") + " para Aberto: a loja reprovou ou reclamou.", "erro");
      redesenhar();
    }).catch(function (e) { if (b) A.ocupado(b, false); falhou(e); });
  }
  // chamado que já tinha serviço lançado à mão na loja: grava o nº do chamado nesse serviço em vez de criar outro
  function vincularChamado(b, c, obra, redesenhar) {
    var dadosObra = { chamado: c.numero, chamado_aberto: isoDeBR(c.data) };
    if (c.portal) dadosObra.portal = c.portal;
    A.ocupado(b, true, "Vinculando...");
    q(sb.from("obras").update(dadosObra).eq("id", obra.id).select().single()).then(function (o) {
      trocar(S.obras, o);
      var l1 = "Chamado nº " + c.numero + (c.data ? " (aberto em " + c.data + ")" : "") + (c.prioridade ? " · prioridade " + c.prioridade : "");
      return Promise.all(S.serv.filter(function (x) { return x.obra_id === o.id; }).map(function (x) {
        var antes = String(x.descricao || "").trim();
        return q(sb.from("servicos").update({ descricao: l1 + "\n" + (c.desc || "") + (antes ? "\nAnotação anterior: " + antes : "") }).eq("id", x.id).select().single()).then(function (n) { trocar(S.serv, n); });
      }));
    }).then(function () {
      gravarCaixa(lerCaixa().filter(function (x) { return x.numero !== c.numero; }));
      A.avisar("Chamado " + c.numero + " vinculado ao serviço que já existia (sem criar outro).", "ok");
      redesenhar();
    }).catch(function (e) { A.ocupado(b, false); falhou(e); });
  }
  function lancarCaixa(b, sel, catPadrao, janela, historico, etapaPadrao) {
    sel = sel.filter(function (c) { return /^\d*[1-9]\d*$/.test(String(c.numero || "")); });   // nunca lança "chamado nº 0"
    if (!sel.length) return;
    A.ocupado(b, true, "Lançando...");
    q(sb.from("obras").insert(sel.map(function (c) {
      var l = lojaPorCodigo(c.centro || c.loja);
      return { cliente: l ? nomeLoja(l) : "Centro " + (c.centro || c.loja || "?"), endereco: l ? nulo(enderecoLoja(l)) : null, telefone: l ? nulo(l.telefone) : null,
        loja_id: l ? l.id : null, chamado: c.numero, chamado_aberto: isoDeBR(c.data) };
    }).map(function (o, k) { if (sel[k].portal) o.portal = sel[k].portal; return o; })).select()).then(function (obras) {
      obras.forEach(function (o) { S.obras.unshift(o); });
      return q(sb.from("servicos").insert(obras.map(function (o) {
        var c = sel.filter(function (x) { return x.numero === o.chamado; })[0];
        var fin = c.portal && /finaliz/i.test((c.portal.status || "") + " " + (c.portal.osSit || "")) || /finaliz/i.test(c.situacao || "");
        var sv = { obra_id: o.id, categoria: c.cat && c.desc ? c.cat : catPadrao, status: fin ? "concluido" : "aberto", concluido_em: fin ? ((c.portal && c.portal.finalizado_em) || isoDeBR(c.data) || A.isoLocal(new Date())) + "T12:00:00" : null,
          descricao: "Chamado nº " + c.numero + (c.data ? " (aberto em " + c.data + ")" : "") + (c.prioridade ? " · prioridade " + c.prioridade : "") + "\n" +
            (c.desc || "Ver a descrição do problema no portal do cliente.") };
        if (!S.semEtapa && etapaPadrao) sv.etapa = fin ? "servico" : etapaPadrao === "auto" ? etapaPelaDescricao(c.desc) : etapaPadrao;
        return sv;
      })).select());
    }).then(function (serv) {
      serv.forEach(function (x) { S.serv.unshift(x); });
      var feitos = {}; sel.forEach(function (c) { feitos[c.numero] = 1; });
      gravarCaixa(lerCaixa().filter(function (c) { return !feitos[c.numero]; }));
      if (historico) {
        janela.fechar(); filtroExec.dias = ""; filtroExec.portal = "fin"; location.hash = "#executados"; rota();
        A.avisar("✅ " + serv.length + " finalizado" + (serv.length > 1 ? "s registrados" : " registrado") + " no histórico (aba Executados).", "ok");
        return;
      }
      janela.fechar(); filtroServ.func = "-";
      location.hash = "#servicos"; rota();
      var jr = A.janela("<p><b>" + serv.length + " chamado" + (serv.length > 1 ? "s" : "") + " lançado" + (serv.length > 1 ? "s" : "") + ".</b></p><p>Agora direcione cada um a um funcionário (lista filtrada em “Sem funcionário”) ou monte a rota do dia com as lojas mais próximas umas das outras.</p>" +
        '<div class="acoes"><button class="prim" id="cl-rota">🧭 Montar rota com as lojas</button><button id="cl-dir">Direcionar agora</button></div>', { titulo: "Chamados lançados" });
      $("#cl-dir", jr.el).onclick = function () { jr.fechar(); };
      $("#cl-rota", jr.el).onclick = function () { jr.fechar(); R.modo = "servicos"; R.cat = ""; location.hash = "#rotas"; };
    }).catch(function (e) { A.ocupado(b, false); falhou(e); });
  }

  function editarObra(id) {
    var o = porId(S.obras, id);
    var j = A.janela('<label for="eo-cli">Cliente *</label><input id="eo-cli" maxlength="200" value="' + esc(o.cliente) + '">' +
      '<div class="duas"><div><label for="eo-tel">WhatsApp</label><input id="eo-tel" type="tel" maxlength="40" value="' + esc(o.telefone || "") + '"></div>' +
      '<div><label for="eo-email">E-mail</label><input id="eo-email" type="email" maxlength="200" value="' + esc(o.email || "") + '"></div></div>' +
      '<label for="eo-end">Endereço</label><input id="eo-end" maxlength="300" value="' + esc(o.endereco || "") + '">' +
      '<label for="eo-obs">Observações (o funcionário vê)</label><textarea id="eo-obs" rows="3">' + esc(o.observacoes || "") + "</textarea>" +
      '<label class="marca-linha" style="font-weight:400"><input type="checkbox" id="eo-divulgar"> 📣 Cliente autorizou divulgar fotos deste serviço nas redes sociais</label>' +
      '<div class="acoes"><button class="prim" id="eo-salvar">Salvar</button><button class="perigo" id="eo-apagar">Apagar cliente e partes</button></div>',
      { titulo: "Cliente / obra" });
    var el = j.el;
    $("#eo-divulgar", el).checked = !!o.autoriza_divulgar;
    $("#eo-salvar", el).onclick = function () {
      if (!val(el, "#eo-cli")) { A.avisar("Informe o cliente.", "erro"); return; }
      var b = this; A.ocupado(b, true, "Salvando...");
      var dadosObra = { cliente: val(el, "#eo-cli"), telefone: nulo(val(el, "#eo-tel")), email: nulo(val(el, "#eo-email")), endereco: nulo(val(el, "#eo-end")), observacoes: nulo(val(el, "#eo-obs")) };
      if ($("#eo-divulgar", el).checked !== !!o.autoriza_divulgar) dadosObra.autoriza_divulgar = $("#eo-divulgar", el).checked;
      q(sb.from("obras").update(dadosObra)
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
      "<h3 style=\"margin-top:8px\">" + esc(o.cliente) + "</h3>" + seloOS(o) + seloChamado(o) +
      (pendenciaChamado(o) ? '<div class="aviso" style="margin:6px 0">📌 <b>Pendente:</b> ' + esc(pendenciaChamado(o).txt) + "</div>" : "") +
      (o.portal && o.portal.reprovado ? '<div class="aviso erro" style="margin:6px 0">⚠️ <b>A loja reprovou a execução</b> em ' + esc(o.portal.reprovado.data || "") +
        (o.portal.reprovado.nota !== null && o.portal.reprovado.nota !== undefined ? " (nota " + esc(o.portal.reprovado.nota) + ")" : "") + (o.portal.reprovado.motivo ? ": “" + esc(o.portal.reprovado.motivo) + "”" : "") +
        ". Volte à loja, faça o serviço com registro de chegada e fotos de depois.</div>" : "") +
      (o.portal && o.portal.reclamacao && !o.portal.reprovado ? '<div class="aviso erro" style="margin:6px 0">🚨 <b>Reclamação da loja</b> em ' + esc(o.portal.reclamacao.data || "") +
        (o.portal.reclamacao.por ? " (" + esc(o.portal.reclamacao.por) + ")" : "") + ": “" + esc(o.portal.reclamacao.txt) + "”. Resolva e responda no portal.</div>" : "") +
      (o.chamado && s.status === "concluido" ? '<div id="es-prova" class="aviso" style="margin:6px 0">Serviço concluído: lembre de <b>finalizar o chamado ' + esc(o.chamado) + "</b> no app do cliente.</div>" : "") +
      (s.status === "aguardando" ? '<div class="aviso" style="margin:6px 0">🧾 Visita de orçamento feita: o serviço <b>ainda não foi executado</b>. ' + (o.chamado ? "Lance o orçamento do chamado " + esc(o.chamado) + " no portal. " : "") +
        'Quando o cliente aprovar: <button class="peq bom" id="es-aprovar">✅ Aprovado → executar</button></div>' : "") +
      (o.endereco ? '<div class="peq"><a href="' + A.linkEndereco(o.endereco) + '" target="_blank" rel="noopener">📍 ' + esc(o.endereco) + "</a></div>" : "") +
      '<div class="duas"><div><label for="es-func">Funcionário</label><select id="es-func">' + opcoesFunc(s.categoria, s.funcionario_id) + "</select></div>" +
      '<div><label for="es-data">Data prevista</label><input type="date" id="es-data" value="' + esc(s.data_prevista || "") + '"></div></div>' +
      '<div class="duas"><div><label for="es-st">Situação</label><select id="es-st">' + Object.keys(A.STATUS).map(function (k) {
        return '<option value="' + k + '"' + (k === s.status ? " selected" : "") + ">" + A.STATUS[k] + "</option>";
      }).join("") + "</select></div>" +
      (o.prefeitura_id || S.semEtapa ? "<div></div>" : '<div><label for="es-etapa">Etapa (o que o funcionário vai fazer)</label><select id="es-etapa"><option value="orcamento">📐 Orçamento — visita, fotos do local e medidas</option><option value="servico">🔧 Serviço — executar (fecha só com foto do serviço feito)</option></select></div>') + "</div>" +
      '<label for="es-desc">O que fazer</label><textarea id="es-desc" rows="4">' + esc(s.descricao || "") + "</textarea>" +
      '<label class="marca-linha" style="font-weight:400"><input type="checkbox" id="es-assin"' + (s.pede_assinatura ? " checked" : "") + '> ✍️ Liberar assinatura do responsável neste serviço <span class="mudo peq">(desligado: o funcionário não vê o quadro de assinatura)</span></label>' +
      '<div class="acoes"><button class="prim" id="es-salvar">Salvar</button><span id="es-zap">' + botaoZap(s) + '</span><button id="es-comp">📤 Compartilhar</button><button class="perigo" id="es-apagar">Apagar parte</button></div>' +
      '<hr class="sep"><h3>Registros de ponto neste serviço</h3><div id="es-pontos">' + carregando() + "</div>" +
      '<hr class="sep"><h3>Relatórios</h3><div id="es-rels"></div>',
      { titulo: "Serviço de " + A.CATEG[s.categoria].nome, larga: true });
    var el = j.el;
    if ($("#es-etapa", el)) $("#es-etapa", el).value = etapaDe(s);
    if ($("#es-aprovar", el)) $("#es-aprovar", el).onclick = function () { aprovarOrcamento(s.id).then(function () { j.fechar(); rota(); abrirServico(s.id); }).catch(falhou); };

    var rels = S.rel.filter(function (r) { return r.servico_id === id; });
    $("#es-rels", el).innerHTML = rels.length ? rels.map(htmlCartaoRel).join("") : '<div class="mudo peq">Nenhum relatório ainda.</div>';
    $$("[data-rel]", el).forEach(function (d) { d.onclick = function () { abrirRelatorio(d.dataset.rel); }; });

    // chegada registrada em outro chamado da mesma loja, no mesmo dia, também vale
    var irmaos = o.loja_id ? S.serv.filter(function (x) { var ox = porId(S.obras, x.obra_id); return x.id !== id && ox && ox.loja_id === o.loja_id; }).map(function (x) { return x.id; }) : [];
    Promise.all([q(sb.from("pontos").select("*").eq("servico_id", id).order("criado_em")),
      irmaos.length ? q(sb.from("pontos").select("*").in("servico_id", irmaos).eq("tipo", "chegada").order("criado_em")).catch(function () { return []; }) : Promise.resolve([])
    ]).then(function (r) {
      var pts = r[0], dia = function (t) { return A.isoLocal(new Date(t)).slice(0, 10); };
      var dias = pts.map(function (p) { return dia(p.criado_em); }).concat(rels.map(function (x) { return dia(x.criado_em); }));
      if (!pts.some(function (p) { return p.tipo === "chegada"; })) {
        var outra = r[1].filter(function (p) { return dias.indexOf(dia(p.criado_em)) >= 0; })[0];
        if (outra) { outra = Object.assign({}, outra, { daMesmaLoja: true }); pts = [outra].concat(pts); }
      }
      pts.forEach(registrarInfoPonto);
      // antes de finalizar no portal: tem prova de que a equipe esteve lá e fez?
      var prova = $("#es-prova", el);
      if (prova) {
        var falta = provaFalta(s, pts);
        if (falta.length) { prova.className = "aviso erro"; prova.innerHTML = "⚠️ <b>Antes de finalizar o chamado " + esc(o.chamado) + " no portal</b>, confira: " + esc(falta.join(" e ")) + ". Sem prova, a loja pode reprovar (\"não veio ninguém\")."; }
        else prova.innerHTML = "✔ Tem registro de chegada e foto de depois. Pode <b>finalizar o chamado " + esc(o.chamado) + "</b> no app do cliente.";
      }
      $("#es-pontos", el).innerHTML = pts.length ? '<div class="fotos">' + pts.map(function (p) {
        return htmlFoto(p.foto, A.TIPO_PONTO[p.tipo] + (p.daMesmaLoja ? " (outro chamado da loja)" : "") + " " + A.data(p.criado_em).slice(0, 5) + " " + A.hora(p.criado_em));
      }).join("") + "</div>" : '<div class="mudo peq">Nenhum registro ainda.</div>';
      hidratarFotos($("#es-pontos", el));
    }).catch(function (e) { $("#es-pontos", el).innerHTML = '<div class="aviso erro">' + esc(A.msgErro(e)) + "</div>"; });

    $("#es-comp", el).onclick = function () { A.compartilhar({ titulo: "Serviço · " + (o.cliente || ""), texto: msgServico(s, null, true) }); };
    $("#es-salvar", el).onclick = function () {
      var b = this, st = $("#es-st", el).value;
      var dados = { funcionario_id: nulo($("#es-func", el).value), data_prevista: nulo($("#es-data", el).value), status: st, descricao: nulo(val(el, "#es-desc")),
        pede_assinatura: $("#es-assin", el).checked };
      if ($("#es-etapa", el)) dados.etapa = $("#es-etapa", el).value;
      // concluido_em = quando terminou o serviço ou a visita de orçamento
      var fim = function (x) { return x === "concluido" || x === "aguardando"; };
      if (fim(st) && st !== s.status) dados.concluido_em = new Date().toISOString();
      if (!fim(st)) dados.concluido_em = null;
      var trocouFunc = dados.funcionario_id && dados.funcionario_id !== s.funcionario_id;
      A.ocupado(b, true, "Salvando...");
      q(sb.from("servicos").update(dados).eq("id", id).select().single()).then(function (n) {
        trocar(S.serv, n); s = n;
        A.ocupado(b, false);
        A.avisar("Salvo", "ok");
        $("#es-zap", el).innerHTML = botaoZap(n);
        if (!trocouFunc) { rota(); return; }
        A.avisar("Avise o novo funcionário pelo botão do WhatsApp.");
        return levarChamadosDaLoja([n]).then(function (lv) { $("#es-zap", el).innerHTML = botaoZap(n, lv.porServ[n.id]); rota(); }, function (e) { rota(); falhou(e); });
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
      (s ? A.seloCategoria(s.categoria) : "") + (r.lido ? "" : '<span class="selo critico">novo</span>') + (r.concluido ? '<span class="selo bom">concluído</span>' : "") + (r.orcamento ? '<span class="selo atencao">🧾 visita de orçamento</span>' : "") +
      (r.assinatura ? '<span class="selo bom">✍️ assinado</span>' : (r.concluido && s && s.pede_assinatura ? '<span class="selo atencao">sem assinatura</span>' : "")) +
      '<span class="dir mudo peq">' + A.dataHora(r.criado_em) + "</span></div>" +
      '<div style="margin-top:6px"><b>' + esc(r.tipo_servico || "Relatório") + "</b> · " + esc(o ? o.cliente : "serviço apagado") + "</div>" +
      '<div class="peq mudo">👷 ' + esc(nomeFunc(r.funcionario_id)) + " · " + (r.materiais || []).length + " materiais · " +
        ((r.fotos_antes || []).length ? (r.fotos_antes || []).length + " fotos antes · " + (r.fotos || []).length + " depois" : (r.fotos || []).length + " fotos") + "</div></div>";
  }

  // =================================================================
  // 📣 DIVULGAR nas redes (Instagram, Facebook, WhatsApp, Telegram...)
  // Monta uma imagem 1080x1350 com as fotos do serviço (sem o carimbo de GPS/
  // nome do cliente), o nome e o telefone da AGE, e uma legenda pronta.
  // Só para clientes que autorizaram divulgar.
  // =================================================================
  function fotosDaObra(o) {
    var ids = S.serv.filter(function (s) { return s.obra_id === o.id; }).map(function (s) { return s.id; }), lista = [];
    S.rel.filter(function (r) { return ids.indexOf(r.servico_id) >= 0; }).slice().reverse().forEach(function (r) {
      (r.fotos_antes || []).forEach(function (f) { lista.push({ c: f, tipo: "antes", linhas: 4 }); });
      (r.fotos || []).forEach(function (f) { lista.push({ c: f, tipo: "depois", linhas: o.prefeitura_id ? 4 : 2 }); });
    });
    return lista;
  }
  // carrega a foto e corta a faixa do carimbo (mesma conta do A.prepararFoto)
  function fotoSemCarimbo(url, linhas) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error("Não consegui abrir a foto."); return r.blob(); })
      .then(function (b) { return createImageBitmap(b); })
      .then(function (img) {
        var fs = Math.max(14, Math.round(Math.min(img.width, img.height) / 30)), pad = Math.round(fs * 0.5);
        var corte = Math.ceil(linhas * fs * 1.3 + pad * 2) + 2;
        return { img: img, w: img.width, h: Math.max(10, img.height - corte) };
      });
  }
  function desenharCobrindo(cx, f, x, y, w, h) {
    var k = Math.max(w / f.w, h / f.h), sw = w / k, sh = h / k;
    cx.drawImage(f.img, (f.w - sw) / 2, (f.h - sh) / 2, sw, sh, x, y, w, h);
  }
  function retArred(cx, x, y, w, h, r) { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }
  function montarDivulgacao(fotos, titulo, categoria) {
    var E = A.CFG.EMPRESA || {}, W = 1080, H = 1350, cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    var cx = cv.getContext("2d");
    cx.fillStyle = "#14325c"; cx.fillRect(0, 0, W, H);
    cx.fillStyle = "#fff"; cx.textBaseline = "middle";
    cx.font = "bold 60px sans-serif"; cx.fillText(E.nome || "AGE Elétrica e Pintura", 50, 92, W - 100);
    if (categoria) {
      cx.font = "bold 30px sans-serif";
      var tw = cx.measureText(categoria).width + 44;
      cx.fillStyle = "#f5b800"; retArred(cx, W - 50 - tw, 160, tw, 52, 26); cx.fill();
      cx.fillStyle = "#14325c"; cx.fillText(categoria, W - 50 - tw + 22, 187);
    }
    var y0 = 230, alt = 860, gap = 14;
    var larg = fotos.length === 2 ? (W - 100 - gap) / 2 : W - 100;
    fotos.forEach(function (f, i) {
      var x = 50 + i * (larg + gap);
      cx.save(); retArred(cx, x, y0, larg, alt, 22); cx.clip(); desenharCobrindo(cx, f, x, y0, larg, alt); cx.restore();
      if (fotos.length === 2) {
        var rot = i === 0 ? "ANTES" : "DEPOIS";
        cx.font = "bold 34px sans-serif";
        var rw = cx.measureText(rot).width + 40;
        cx.fillStyle = i === 0 ? "rgba(0,0,0,.72)" : "#1f9d55"; retArred(cx, x + 18, y0 + 18, rw, 58, 29); cx.fill();
        cx.fillStyle = "#fff"; cx.fillText(rot, x + 38, y0 + 47);
      }
    });
    cx.fillStyle = "#fff"; cx.font = "bold 48px sans-serif";
    cx.fillText(titulo || "Serviço realizado", 50, 1160, W - 100);
    cx.font = "36px sans-serif"; cx.fillStyle = "#dbe6f5";
    cx.fillText((E.telefone ? "📞 " + E.telefone + "  ·  " : "") + "Orçamento sem compromisso", 50, 1236, W - 100);
    cx.font = "28px sans-serif"; cx.fillStyle = "#9fb4d3";
    cx.fillText("Elétrica · Pintura · Manutenção", 50, 1294, W - 100);
    return new Promise(function (ok, falha) { cv.toBlob(function (b) { b ? ok(b) : falha(new Error("Falha ao montar a imagem.")); }, "image/jpeg", 0.9); });
  }
  function legendaPadrao(titulo, cat) {
    var E = A.CFG.EMPRESA || {};
    var tags = cat === "pintura" ? "#pintura #pintor #pinturaresidencial #reforma" : "#eletricista #eletrica #instalacaoeletrica #manutencaoeletrica";
    return (cat === "pintura" ? "🖌️ " : "⚡ ") + (titulo || "Serviço realizado") + " — mais um serviço entregue pela " + (E.nome || "AGE Elétrica e Pintura") + "!\n\n" +
      "✅ Trabalho com garantia e acabamento caprichado.\n" +
      (E.telefone ? "📲 Orçamento sem compromisso: " + E.telefone + " (WhatsApp)\n" : "") + "\n" + tags + " #belohorizonte #bh #contagem #betim";
  }
  function divulgar(r) {
    var s = porId(S.serv, r.servico_id), o = s ? porId(S.obras, s.obra_id) : null;
    if (!o) { A.avisar("Serviço apagado.", "erro"); return; }
    if (!o.autoriza_divulgar) {
      if (!A.confirmar("O cliente “" + o.cliente + "” autorizou divulgar as fotos nas redes sociais?\n\nSó divulgue com autorização (principalmente lojas da rede e prefeituras).")) return;
      q(sb.from("obras").update({ autoriza_divulgar: true }).eq("id", o.id).select().single()).then(function (n) { trocar(S.obras, n); divulgar(r); }).catch(falhou);
      return;
    }
    var lista = fotosDaObra(o);
    if (!lista.length) { A.avisar("Este serviço ainda não tem fotos de relatório.", "erro"); return; }
    var antes = lista.filter(function (f) { return f.tipo === "antes"; })[0], depois = lista.filter(function (f) { return f.tipo === "depois"; }).pop();
    var escolha = antes && depois ? [antes, depois] : [lista[lista.length - 1]];
    var titulo0 = r.tipo_servico || (s.descricao || A.CATEG[s.categoria].nome).split("\n")[0].slice(0, 60);
    var j = A.janela('<p class="mudo peq" style="margin-top:0">Toque nas fotos para escolher (1 foto, ou 2 para <b>antes e depois</b>). O carimbo com GPS e nome do cliente é cortado; o endereço não aparece.</p>' +
      '<div class="fotos" id="dv-fotos"></div>' +
      '<label for="dv-tit">Título na imagem</label><input id="dv-tit" maxlength="60">' +
      '<label for="dv-leg">Legenda do post</label><textarea id="dv-leg" rows="6"></textarea>' +
      '<div id="dv-prev" style="margin-top:10px"></div><div id="dv-msg"></div>' +
      '<div class="acoes"><button class="prim" id="dv-gerar">🖼 Montar imagem</button></div>' +
      '<div class="acoes oculto" id="dv-acoes">' + (P_compartilha() ? '<button class="prim" id="dv-comp">📤 Postar (Instagram, Facebook, WhatsApp, Telegram...)</button>' : "") +
      '<button id="dv-baixar">⬇ Baixar imagem</button><button id="dv-copiar">📋 Copiar legenda</button></div>',
      { titulo: "📣 Divulgar nas redes", larga: true, fixa: true });
    var el = j.el, blob = null;
    $("#dv-tit", el).value = titulo0; $("#dv-leg", el).value = legendaPadrao(titulo0, s.categoria);
    function desenharEscolha() {
      $("#dv-fotos", el).innerHTML = lista.map(function (f, i) {
        var n = escolha.indexOf(f);
        return '<button class="foto" data-dv="' + i + '" data-foto="' + esc(f.c) + '" style="' + (n >= 0 ? "outline:4px solid var(--prim);outline-offset:1px" : "opacity:.6") + '" aria-label="Escolher foto">' +
          '<img alt=""><span class="et">' + (n >= 0 ? (escolha.length === 2 ? (n === 0 ? "1º ANTES" : "2º DEPOIS") : "✔ escolhida") : f.tipo) + "</span></button>";
      }).join("");
      hidratarFotos($("#dv-fotos", el));
      $$("[data-dv]", el).forEach(function (b) {
        b.onclick = function (ev) {
          ev.stopImmediatePropagation(); ev.preventDefault();
          var f = lista[Number(b.dataset.dv)], n = escolha.indexOf(f);
          if (n >= 0) escolha.splice(n, 1); else { escolha.push(f); if (escolha.length > 2) escolha.shift(); }
          blob = null; $("#dv-acoes", el).classList.add("oculto"); $("#dv-prev", el).innerHTML = "";
          desenharEscolha();
        };
      });
    }
    desenharEscolha();
    function nomeArq() { return "AGE-" + String($("#dv-tit", el).value || "servico").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) + ".jpg"; }
    $("#dv-tit", el).oninput = function () { blob = null; $("#dv-acoes", el).classList.add("oculto"); };
    $("#dv-gerar", el).onclick = function () {
      var b = this;
      if (!escolha.length) { $("#dv-msg", el).innerHTML = '<div class="aviso erro">Escolha pelo menos 1 foto.</div>'; return; }
      $("#dv-msg", el).innerHTML = ""; A.ocupado(b, true, "Montando...");
      q(sb.storage.from("fotos").createSignedUrls(escolha.map(function (f) { return f.c; }), 600)).then(function (us) {
        return Promise.all(escolha.map(function (f) {
          var u = (us || []).filter(function (x) { return x.path === f.c; })[0];
          if (!u || !u.signedUrl) throw new Error("Não consegui abrir a foto.");
          return fotoSemCarimbo(u.signedUrl, f.linhas);
        }));
      }).then(function (fs) {
        return montarDivulgacao(fs, $("#dv-tit", el).value.trim(), s.categoria === "pintura" ? "PINTURA" : "ELÉTRICA");
      }).then(function (bl) {
        blob = bl; A.ocupado(b, false); b.innerHTML = "↻ Montar de novo";
        $("#dv-prev", el).innerHTML = '<img alt="Prévia da divulgação" src="' + URL.createObjectURL(bl) + '" style="width:100%;max-width:360px;display:block;margin:0 auto;border-radius:10px">';
        $("#dv-acoes", el).classList.remove("oculto");
      }).catch(function (e) { A.ocupado(b, false); $("#dv-msg", el).innerHTML = '<div class="aviso erro">' + esc(A.msgErro(e)) + "</div>"; });
    };
    function copiarLegenda(aviso) {
      var t = $("#dv-leg", el).value;
      return (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { if (aviso) A.avisar(aviso, "ok"); },
        function () { window.prompt("Copie a legenda:", t); });
    }
    $("#dv-baixar", el).onclick = function () { if (blob) { baixar(blob, nomeArq()); copiarLegenda("Imagem baixada e legenda copiada. Cole a legenda no post (Ctrl+V)."); } };
    $("#dv-copiar", el).onclick = function () { copiarLegenda("Legenda copiada."); };
    if ($("#dv-comp", el)) $("#dv-comp", el).onclick = function () {
      if (!blob) return;
      var t = $("#dv-leg", el).value, arq = new File([blob], nomeArq(), { type: "image/jpeg" });
      // o Instagram ignora o texto do compartilhamento: a legenda vai copiada para colar
      copiarLegenda().then(function () {
        return navigator.share({ files: [arq], text: t, title: $("#dv-tit", el).value });
      }).then(function () { A.avisar("Pronto! A legenda está copiada: cole no post se ela não aparecer.", "ok"); })
        .catch(function (e) { if (!e || e.name !== "AbortError") A.avisar("Não consegui abrir o compartilhar. Use ⬇ Baixar imagem.", "erro"); });
    };
  }
  function P_compartilha() {
    try { return !!(navigator.canShare && navigator.canShare({ files: [new File(["x"], "x.jpg", { type: "image/jpeg" })] })); } catch (e) { return false; }
  }

  // =================================================================
  // SERVIÇOS EXECUTADOS (por dia de execução, com loja e fotos)
  // =================================================================
  var filtroExec = { dias: "30", cat: "", func: "", busca: "", portal: "" };
  // o que falta para provar a execução: registro de chegada e foto de depois (relatório)
  function provaFalta(s, pts) {
    var falta = [];
    if (pts && !pts.some(function (p) { return p.tipo === "chegada"; })) falta.push("sem registro de chegada");
    if (!S.rel.some(function (r) { return r.servico_id === s.id && !r.orcamento && (r.fotos || []).length; })) falta.push("sem foto do serviço realizado (as fotos do orçamento não contam)");
    return falta;
  }
  function dataExecucao(s) {
    if (s.concluido_em) return new Date(s.concluido_em);
    var rs = S.rel.filter(function (r) { return r.servico_id === s.id && r.concluido; });
    return rs.length ? new Date(rs[0].criado_em) : new Date(s.criado_em);
  }
  function verExecutados(c) {
    var F = filtroExec;
    // duas visões: por dia (com fotos) e o fechamento mensal dos chamados (valores do portal)
    var trocaModo = '<div class="filtros"><button class="' + (F.modo !== "fech" ? "prim" : "") + '" data-exmodo="dia">📅 Por dia</button><button class="' + (F.modo === "fech" ? "prim" : "") + '" data-exmodo="fech">📊 Fechamento mensal (chamados)</button></div>';
    if (F.modo === "fech") {
      c.innerHTML = trocaModo + '<div id="fx-fech"></div>';
      window.AGE_FECH.ver($("#fx-fech"), P);
      $$("[data-exmodo]", c).forEach(function (b) { b.onclick = function () { F.modo = b.dataset.exmodo; verExecutados(c); }; });
      return;
    }
    c.innerHTML = trocaModo + '<div class="cab-secao"><h2>✅ Serviços executados</h2></div>' +
      '<div class="filtros"><select id="fx-dias" aria-label="Período"><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="365">Último ano</option><option value="">Tudo</option></select>' +
      '<select id="fx-cat" aria-label="Área"><option value="">Elétrica e pintura</option><option value="eletrica">⚡ Só elétrica</option><option value="pintura">🖌️ Só pintura</option></select>' +
      '<select id="fx-func" aria-label="Funcionário"><option value="">Todos os funcionários</option>' + S.func.map(function (f) { return '<option value="' + f.id + '">' + esc(f.nome) + "</option>"; }).join("") + "</select>" +
      '<select id="fx-portal" aria-label="Portal"><option value="">Finalizados ou não no portal</option><option value="fin">✅ Finalizados no portal</option><option value="falta">⏳ Falta finalizar no portal</option></select>' +
      '<input id="fx-busca" type="search" placeholder="Buscar loja, cliente ou nº do chamado"></div><div id="fx-res"></div>';
    $$("[data-exmodo]", c).forEach(function (b) { b.onclick = function () { F.modo = b.dataset.exmodo; verExecutados(c); }; });
    $("#fx-dias").value = F.dias; $("#fx-cat").value = F.cat; $("#fx-func").value = F.func; $("#fx-busca").value = F.busca; $("#fx-portal").value = F.portal || "";
    ["#fx-dias", "#fx-cat", "#fx-func", "#fx-portal"].forEach(function (id) { $(id).onchange = function () { ler(); listar(); }; });
    $("#fx-busca").oninput = function () { ler(); listar(); };
    function ler() { F.portal = $("#fx-portal").value; F.dias = $("#fx-dias").value; F.cat = $("#fx-cat").value; F.func = $("#fx-func").value; F.busca = semAcento($("#fx-busca").value.trim()); }
    function listar() {
      var limite = F.dias ? Date.now() - Number(F.dias) * 864e5 : 0;
      var lista = S.serv.filter(function (s) {
        if (s.status !== "concluido") return false;
        if (F.cat && s.categoria !== F.cat) return false;
        if (F.func && s.funcionario_id !== F.func) return false;
        if (dataExecucao(s).getTime() < limite) return false;
        var o = porId(S.obras, s.obra_id);
        if (F.busca && semAcento([o && o.cliente, o && o.endereco, o && o.chamado, o && o.protocolo].join(" ")).indexOf(F.busca) < 0) return false;
        var fin = !!(o && o.portal && /finaliz/i.test((o.portal.status || "") + " " + (o.portal.osSit || "")));
        if (F.portal === "fin" && !fin) return false;
        if (F.portal === "falta" && (fin || !(o && o.chamado))) return false;
        return true;
      }).sort(function (a, b) { return dataExecucao(b) - dataExecucao(a); });
      var r = $("#fx-res");
      if (!lista.length) { r.innerHTML = '<div class="cartao vazio">Nenhum serviço executado neste período.</div>'; return; }
      var dias = {}, ordem = [];
      lista.forEach(function (s) { var d = A.isoLocal(dataExecucao(s)); if (!dias[d]) { dias[d] = []; ordem.push(d); } dias[d].push(s); });
      var obrasL = {}; lista.forEach(function (s) { obrasL[s.obra_id] = porId(S.obras, s.obra_id); });
      var total = Object.keys(obrasL).reduce(function (t, k) { var o = obrasL[k]; return t + (o && o.portal && o.portal.valor ? Number(o.portal.valor) : 0); }, 0);
      r.innerHTML = '<p class="mudo peq" style="margin:-4px 0 10px">' + lista.length + " serviço" + (lista.length > 1 ? "s" : "") + " executado" + (lista.length > 1 ? "s" : "") + " em " + ordem.length + " dia" + (ordem.length > 1 ? "s" : "") +
        (total ? " · <b>" + esc(A.dinheiro(total)) + "</b> em valor negociado no portal" : "") + ".</p>" +
        ordem.map(function (d) {
          var ss = dias[d], lojas = {};
          ss.forEach(function (s) { var o = porId(S.obras, s.obra_id); lojas[(o && (o.loja_id || o.id)) || s.id] = 1; });
          return '<div class="cab-secao" style="margin-top:14px"><h2>📅 ' + A.dataSimples(d) + "</h2><span class=\"mudo peq\">" + ss.length + " serviço" + (ss.length > 1 ? "s" : "") +
            " · " + Object.keys(lojas).length + " local" + (Object.keys(lojas).length > 1 ? "is" : "") + "</span></div>" + ss.map(cartaoExecutado).join("");
        }).join("");
      hidratarFotos(r);
      $$("[data-exec-rel]", r).forEach(function (b) { b.onclick = function () { abrirRelatorio(b.dataset.execRel); }; });
      $$("[data-exec-serv]", r).forEach(function (b) { b.onclick = function () { abrirServico(b.dataset.execServ); }; });
      $$("[data-exec-comp]", r).forEach(function (b) {
        b.onclick = function () {
          var s = porId(S.serv, b.dataset.execComp), o = porId(S.obras, s.obra_id) || {};
          var dOrc = !!b.dataset.orc;
          compartilharFotos(fotosDoServico(s.id, dOrc), (o.cliente || "Serviço") + (dOrc ? " orcamento" : ""), ((A.CFG.EMPRESA || {}).nome || "AGE") + " — " + (dOrc ? "📐 ORÇAMENTO · " : "🔧 SERVIÇO REALIZADO · ") + (o.cliente || "") + (o.chamado ? " · chamado " + o.chamado : "") + "\n" + resumoServ(s, 160) + "\n" + A.dataSimples(A.isoLocal(dataExecucao(s))), b);
        };
      });
      $$("[data-exec-baixar]", r).forEach(function (b) {
        b.onclick = function () { var s = porId(S.serv, b.dataset.execBaixar), o = porId(S.obras, s.obra_id) || {}; baixarFotos(fotosDoServico(s.id, !!b.dataset.orc), (o.cliente || "servico") + (b.dataset.orc ? "-orcamento" : "") + "-" + A.isoLocal(dataExecucao(s)), b); };
      });
    }
    function cartaoExecutado(s) {
      var o = porId(S.obras, s.obra_id) || {}, rels = S.rel.filter(function (x) { return x.servico_id === s.id; });
      // fotos do relatório de ORÇAMENTO (visita para orçar) ficam separadas das do SERVIÇO realizado
      var antes = [], depois = [], orc = [];
      rels.forEach(function (x) { if (x.orcamento) orc = orc.concat(x.fotos_antes || [], x.fotos || []); else { antes = antes.concat(x.fotos_antes || []); depois = depois.concat(x.fotos || []); } });
      rels.forEach(function (x) {
        (x.fotos_antes || []).concat(x.orcamento ? x.fotos || [] : []).forEach(function (f) { infoFoto[f] = (x.orcamento ? "📐 Foto do ORÇAMENTO · " : "Foto ANTES · ") + esc(o.cliente || "") + " · " + A.dataHora(x.criado_em); });
        if (!x.orcamento) (x.fotos || []).forEach(function (f) { infoFoto[f] = "🔧 Foto do SERVIÇO · " + esc(o.cliente || "") + " · " + A.dataHora(x.criado_em); });
      });
      var fotos = antes.slice(0, 3).map(function (f) { return htmlFoto(f, "antes"); }).concat(depois.slice(0, antes.length ? 3 : 6).map(function (f) { return htmlFoto(f, antes.length ? "depois" : ""); }));
      var mais = antes.length + depois.length - fotos.length;
      return '<div class="cartao"><div class="linha"><h3>' + esc(o.cliente || "Serviço") + "</h3>" + seloOS(o) + seloChamado(o) +
        '<span class="dir mudo peq">' + A.hora(dataExecucao(s)) + "</span></div>" +
        '<div class="linha">' + A.seloCategoria(s.categoria) + '<span class="peq">👷 ' + esc(nomeFunc(s.funcionario_id) || "—") + "</span>" +
        (o.chamado && !(o.portal && /finaliz/i.test((o.portal.status || "") + " " + (o.portal.osSit || ""))) ? (provaFalta(s, null).length ? '<span class="selo critico">⚠️ sem foto de depois: confira antes de finalizar o chamado ' + esc(o.chamado) + "</span>" :
          '<span class="selo atencao">finalizar chamado ' + esc(o.chamado) + " no portal</span>") : "") + "</div>" +
        (o.endereco ? '<div class="peq mudo">📍 ' + esc(o.endereco) + "</div>" : "") +
        (s.descricao ? '<div class="peq" style="margin-top:4px">' + esc(resumoServ(s, 160)) + "</div>" : "") +
        (orc.length ? '<div class="peq" style="margin-top:8px"><b>📐 Fotos do orçamento</b></div><div class="fotos">' + orc.slice(0, 4).map(function (f) { return htmlFoto(f, "orçamento"); }).join("") + "</div>" : "") +
        (fotos.length ? (orc.length ? '<div class="peq" style="margin-top:8px"><b>🔧 Fotos do serviço realizado</b></div>' : "") + '<div class="fotos" style="margin-top:' + (orc.length ? 0 : 8) + 'px">' + fotos.join("") + "</div>" + (mais > 0 ? '<div class="peq mudo">+ ' + mais + " foto" + (mais > 1 ? "s" : "") + " no relatório</div>" : "") :
          '<div class="peq mudo" style="margin-top:6px">' + (orc.length ? "Ainda sem foto do serviço realizado." : "Sem fotos no relatório.") + "</div>") +
        '<div class="acoes">' + (rels.length ? '<button class="peq" data-exec-rel="' + rels[0].id + '">📝 Ver relatório</button>' : "") + '<button class="peq" data-exec-serv="' + s.id + '">Abrir serviço</button>' +
        (antes.length + depois.length ? '<button class="peq" data-exec-comp="' + s.id + '">📤 Fotos do serviço (' + (antes.length + depois.length) + ')</button><button class="peq" data-exec-baixar="' + s.id + '">⬇️ Baixar fotos do serviço</button>' : "") +
        (orc.length ? '<button class="peq" data-exec-comp="' + s.id + '" data-orc="1">📤 Fotos do orçamento (' + orc.length + ')</button><button class="peq" data-exec-baixar="' + s.id + '" data-orc="1">⬇️ Baixar fotos do orçamento</button>' : "") + "</div></div>";
    }
    // fotos do serviço executado: as de antes primeiro, depois as de depois
    function fotosDoServico(sid, doOrcamento) {
      var antes = [], depois = [];
      S.rel.filter(function (x) { return x.servico_id === sid && !!x.orcamento === !!doOrcamento; }).forEach(function (x) { antes = antes.concat(x.fotos_antes || []); depois = depois.concat(x.fotos || []); });
      return antes.concat(depois);
    }
    listar();
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
      '<div class="linha">' + (s ? A.seloCategoria(s.categoria) : "") + (r.concluido ? '<span class="selo bom">funcionário marcou como concluído</span>' : "") + (r.orcamento ? '<span class="selo atencao">🧾 só a visita de orçamento (serviço ainda não feito)</span>' : "") +
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
      '<div class="acoes"><button class="prim" id="er-orc">💲 Gerar orçamento</button>' + (s ? '<button id="er-serv">Abrir serviço</button>' : "") + '<button id="er-comp">📤 Compartilhar' + ((r.fotos || []).length + (r.fotos_antes || []).length ? " com fotos" : "") + "</button>" +
      ((r.fotos || []).length || (r.fotos_antes || []).length ? '<button id="er-div">📣 Divulgar</button>' : "") +
      (o && (A.CFG.EMPRESA || {}).avaliacao ? '<button id="er-aval">⭐ Pedir avaliação</button>' : "") +
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
    if ($("#er-div", el)) $("#er-div", el).onclick = function () { divulgar(r); };
    $("#er-comp", el).onclick = function () { compartilharRelatorio(this, r); };
    if ($("#er-aval", el)) $("#er-aval", el).onclick = function () { pedirAvaliacao(o); };
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

  // relatório para o WhatsApp do gerente/coordenador: resumo + fotos de antes e depois (até 10)
  function textoRelatorio(r) {
    var s = porId(S.serv, r.servico_id), o = s ? porId(S.obras, s.obra_id) : null, mats = r.materiais || [];
    return "*" + ((A.CFG.EMPRESA || {}).nome || "AGE") + " — Relatório*\n" + (o ? o.cliente + "\n" : "") + (o && o.chamado ? "Chamado nº " + o.chamado + "\n" : "") +
      "Data: " + A.dataHora(r.criado_em) + " · " + nomeFunc(r.funcionario_id) + "\n" + (r.tipo_servico ? "Serviço: " + r.tipo_servico + "\n" : "") +
      (r.concluido ? "✅ Serviço concluído\n" : r.orcamento ? "🧾 Visita de orçamento\n" : "") + (r.descricao ? "\n" + r.descricao + "\n" : "") +
      (mats.length ? "\nMateriais:\n" + mats.map(function (m) { return "• " + m.item + (m.qtd ? " — " + A.numero(m.qtd) + " " + (m.un || "") : ""); }).join("\n") + "\n" : "");
  }
  function compartilharRelatorio(b, r) {
    var cam = (r.fotos_antes || []).concat(r.fotos || []).slice(0, 10), txt = b.textContent;
    A.ocupado(b, true, cam.length ? "Preparando as fotos..." : "Abrindo...");
    var pFotos = !cam.length ? Promise.resolve([]) : q(sb.storage.from("fotos").createSignedUrls(cam, 600)).then(function (us) {
      return Promise.all(cam.map(function (c, i) {
        var u = (us || []).filter(function (x) { return x.path === c; })[0];
        if (!u || !u.signedUrl) return null;
        return fetch(u.signedUrl).then(function (res) { return res.blob(); }).then(function (bl) {
          return new File([bl], "AGE-" + ((r.fotos_antes || []).indexOf(c) >= 0 ? "antes" : "foto") + "-" + (i + 1) + ".jpg", { type: bl.type || "image/jpeg" });
        }).catch(function () { return null; });
      }));
    }).then(function (fs) { return fs.filter(Boolean); });
    pFotos.catch(function () { return []; }).then(function (fs) {
      A.ocupado(b, false); b.textContent = txt;
      return A.compartilhar({ titulo: "Relatório AGE", texto: textoRelatorio(r), arquivos: fs });
    });
  }

  // o que chegou pelo "Compartilhar → AGE Painel" do Android
  function abrirRecebido() {
    A.lerRecebido().then(function (rc) {
      // ZIP compartilhado (várias fotos do WhatsApp): abre antes de perguntar o que fazer
      return rc && rc.arquivos && rc.arquivos.some(A.ehZip) ? A.abrirZips(rc.arquivos).then(function (fs) { rc.arquivos = fs; return rc; }).catch(function (e) { A.avisar(A.msgErro(e), "erro"); return rc; }) : rc;
    }).then(function (rc) {
      if (!rc || (!rc.texto && !rc.arquivos.length)) return;
      var j = A.janela((rc.texto ? '<div class="cartao peq" style="white-space:pre-wrap;max-height:220px;overflow:auto">' + esc(rc.texto.slice(0, 3000)) + "</div>" : "") +
        (rc.arquivos.length ? '<p class="peq">📷 ' + rc.arquivos.length + " foto" + (rc.arquivos.length > 1 ? "s" : "") + " recebida" + (rc.arquivos.length > 1 ? "s" : "") +
          ". Comprovante Pix: toque em 💰. Foto de serviço: compartilhe pelo app do funcionário (<b>AGE Ponto</b>).</p>" : "") +
        '<div class="acoes">' + (rc.arquivos.length || /pix|comprovante|transfer/i.test(rc.texto || "") ? '<button class="prim" id="rc-pix">💰 Registrar pagamento Pix</button>' : "") +
        (rc.arquivos.length || /nota|cupom|nfc|cnpj|total/i.test(rc.texto || "") ? '<button id="rc-nota">🧾 Registrar nota de compra</button>' : "") +
        (rc.texto ? '<button' + (rc.arquivos.length ? "" : ' class="prim"') + ' id="rc-cx">📋 Colocar na caixa de chamados</button><button id="rc-novo">➕ Novo serviço com este texto</button>' : "") +
        '<button id="rc-copiar">Copiar o texto</button></div>', { titulo: "📥 Recebido pelo compartilhamento" });
      if ($("#rc-nota", j.el)) $("#rc-nota", j.el).onclick = function () { j.fechar(); location.hash = "#compras"; window.AGE_COMPRAS.receber(rc, P); };
      if ($("#rc-pix", j.el)) $("#rc-pix", j.el).onclick = function () { j.fechar(); location.hash = "#pagamentos"; window.AGE_PAG.receber(rc, P); };
      if ($("#rc-cx", j.el)) $("#rc-cx", j.el).onclick = function () {
        j.fechar(); location.hash = "#servicos"; importarChamado();
        var t = $("#ch-txt"); if (t) { t.value = rc.texto; t.dispatchEvent(new Event("input")); }
      };
      if ($("#rc-novo", j.el)) $("#rc-novo", j.el).onclick = function () { j.fechar(); novoServico(null, { obs: rc.texto.slice(0, 2000), desc: rc.texto.slice(0, 2000) }); };
      $("#rc-copiar", j.el).onclick = function () { copiar(rc.texto || ""); A.avisar("Texto copiado", "ok"); };
    });
  }

  // mensagem pronta pedindo ao cliente uma avaliação da AGE no Google
  function msgAvaliacao(o) {
    var nome = String((o && o.cliente) || "").trim().split(/\s+/)[0];
    return "Olá" + (nome ? ", " + nome : "") + "! Aqui é da " + ((A.CFG.EMPRESA || {}).nome || "AGE") + ". Obrigado pela confiança no nosso serviço! 🙏\n\n" +
      "Se puder, deixe sua avaliação no Google — leva 1 minuto e ajuda muito a gente:\n⭐ " + A.CFG.EMPRESA.avaliacao;
  }
  function pedirAvaliacao(o) {
    var texto = msgAvaliacao(o);
    if (o && o.telefone) A.abrirZap(A.linkZap(o.telefone, texto));
    else copiar(texto).then(function () { A.avisar("Cliente sem WhatsApp cadastrado: mensagem copiada para você colar onde quiser.", "ok"); });
  }

  // =================================================================
  // ORÇAMENTOS (só o dono vê)
  // =================================================================
  var buscaOrc = "", tipoOrcFiltro = "";
  // busca por número, cliente, endereço ou qualquer item (sem ligar para acento e maiúscula)
  function orcBate(o, b) {
    if (!b) return true;
    var txt = semAcento([String(o.numero).padStart(4, "0"), o.cliente, o.documento, soDig(o.documento), o.endereco, o.telefone, CAT_ORC[o.categoria] || ""].concat((o.itens || []).map(function (i) { return i.descricao; })).join(" "));
    return b.split(/\s+/).every(function (p) { return txt.indexOf(p) >= 0; });
  }
  function verOrcamentos(c) {
    c.innerHTML = '<div class="cab-secao"><h2>Orçamentos</h2><span><button class="prim" id="bo-novo">+ Novo orçamento</button> <button id="bo-mat">🧱 + Orçamento de materiais</button></span></div>' +
      '<p class="mudo peq" style="margin-top:-6px">Só você vê esta área. Os funcionários nunca veem valores.</p>' +
      (S.orc.length ? '<div class="filtros">' + [["", "Todos"], ["servico", "🔧 Serviços"], ["materiais", "🧱 Materiais"]].map(function (f) {
        return '<button class="' + (tipoOrcFiltro === f[0] ? "prim" : "") + '" data-orctipo="' + f[0] + '">' + f[1] + "</button>";
      }).join("") + "</div>" + '<input id="bo-busca" type="search" placeholder="🔍 Buscar orçamento: cliente, nº, endereço ou item (ex.: refletor, quadro)" style="margin-bottom:8px">' +
        '<p class="mudo peq" style="margin:-2px 0 8px">Ache um orçamento parecido e toque em <b>📋 Usar como modelo</b>: abre um novo com os mesmos itens e preços, é só trocar o cliente e ajustar o que mudou.</p>' +
        '<div class="cartao tabela-caixa"><table><thead><tr><th>Nº</th><th>Cliente</th><th class="esconde-cel">Área</th><th>Situação</th><th class="num">Total</th><th class="esconde-cel">Data</th><th></th></tr></thead><tbody id="bo-lista"></tbody></table></div>' +
        '<div id="bo-nada" class="vazio oculto">Nenhum orçamento com essa busca.</div>'
        : '<div class="cartao vazio">Nenhum orçamento ainda. Crie um aqui ou a partir do relatório de um funcionário.</div>');
    $("#bo-novo").onclick = function () { editarOrcamento(null, {}); };
    $("#bo-mat").onclick = function () { editarOrcamento(null, { tipo: "materiais" }); };
    if (!S.orc.length) return;
    $$("[data-orctipo]", c).forEach(function (b) { b.onclick = function () { tipoOrcFiltro = b.dataset.orctipo; verOrcamentos(c); }; });
    function lista() {
      var b = semAcento(buscaOrc).trim(), ls = S.orc.filter(function (o) {
        return orcBate(o, b) && (!tipoOrcFiltro || (tipoOrcFiltro === "materiais") === soMateriais(o));
      });
      $("#bo-lista", c).innerHTML = ls.map(function (o) {
        return '<tr class="clic" data-orc="' + o.id + '" style="cursor:pointer"><td>' + String(o.numero).padStart(4, "0") + "</td><td>" + esc(o.cliente) + (soMateriais(o) ? ' <span class="selo">🧱 materiais</span>' : "") + '</td><td class="esconde-cel">' +
          esc(CAT_ORC[o.categoria] || "") + '</td><td><span class="selo ' + COR_ORC[o.status] + '">' + STATUS_ORC[o.status] + '</span></td><td class="num">' + A.dinheiro(o.total) +
          '</td><td class="esconde-cel">' + A.data(o.criado_em) + '</td><td><button class="peq" data-dup="' + o.id + '" title="Abre um orçamento novo com os mesmos itens">📋 Usar como modelo</button></td></tr>';
      }).join("");
      $("#bo-nada", c).classList.toggle("oculto", ls.length > 0);
      $$("[data-orc]", c).forEach(function (t) { t.onclick = function () { editarOrcamento(porId(S.orc, t.dataset.orc)); }; });
      $$("[data-dup]", c).forEach(function (b) { b.onclick = function (ev) { ev.stopPropagation(); usarComoModelo(porId(S.orc, b.dataset.dup)); }; });
    }
    $("#bo-busca", c).value = buscaOrc;
    $("#bo-busca", c).oninput = function () { buscaOrc = this.value; lista(); };
    lista();
  }
  // orçamento novo a partir de um antigo: mesmos itens, preços e condições; cliente em branco
  function usarComoModelo(o) {
    if (!o) return;
    editarOrcamento(null, {
      categoria: o.categoria || "", itens: JSON.parse(JSON.stringify(o.itens || [])), desconto: Number(o.desconto) || 0,
      pagamento: o.pagamento || "", prazo: o.prazo || "", validade_dias: o.validade_dias || 15, observacoes: o.observacoes || "",
      valores_cliente: o.valores_cliente || "itens", materiais_cliente: o.materiais_cliente === true, tipo: o.tipo || "servico"
    });
    A.avisar("📋 Itens do orçamento nº " + String(o.numero).padStart(4, "0") + " copiados. Preencha o cliente e ajuste o que mudou.", "ok");
  }

  // orçamento de materiais a partir de um de serviço: mesmos dados do cliente, só os materiais (com o preço do app)
  function materiaisDoOrcamento(o) {
    var itens = [];
    (o.itens || []).forEach(function (i) {
      if (i.tipo === "material") itens.push({ tipo: "material", descricao: i.descricao, qtd: i.qtd, un: i.un, valor: Number(i.valor) || 0 });
      else if (i.tipo === "ambos") itens.push({ tipo: "material", descricao: i.descricao, qtd: i.qtd, un: i.un, valor: Number(i.valor_mat) || 0 });
    });
    if (!itens.length) { A.avisar("Este orçamento não tem materiais.", "erro"); return; }
    editarOrcamento(null, {
      tipo: "materiais", obra_id: o.obra_id || null, cliente: o.cliente, documento: o.documento || "", telefone: o.telefone || "", email: o.email || "",
      endereco: o.endereco || "", categoria: o.categoria || "", itens: itens, pagamento: o.pagamento || "", validade_dias: o.validade_dias || 15
    });
    A.avisar("🧱 Orçamento de materiais criado a partir do nº " + String(o.numero).padStart(4, "0") + ". Confira os preços e salve.", "ok");
  }

  function orcamentoDaObra(obraId) {
    var o = porId(S.obras, obraId);
    var cats = S.serv.filter(function (s) { return s.obra_id === obraId; }).map(function (s) { return s.categoria; });
    var cat = cats.indexOf("eletrica") >= 0 && cats.indexOf("pintura") >= 0 ? "eletrica_pintura" : cats[0] || "";
    editarOrcamento(null, { obra_id: o.id, cliente: o.cliente, telefone: o.telefone, email: o.email, endereco: o.endereco, categoria: cat });
  }

  // tipos de item: material (só quantidade para o cliente; o valor fica no app), mão de obra, e material + mão de obra
  var TIPOS_ITEM = { material: "Material", servico: "Mão de obra", ambos: "Material + mão de obra" };
  // orçamento antigo (antes das opções) continua como era: materiais com valor para o cliente
  // CPF / CNPJ do cliente: confere os dígitos e formata
  function soDig(t) { return String(t || "").replace(/\D/g, ""); }
  function cpfValido(c) {
    c = soDig(c); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
    var dv = function (n) { var s = 0; for (var i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i); var r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
  }
  function cnpjValido(c) {
    c = soDig(c); if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
    var dv = function (n) { var s = 0, p = n - 7; for (var i = 0; i < n; i++) { s += Number(c[i]) * p--; if (p < 2) p = 9; } var r = s % 11; return r < 2 ? 0 : 11 - r; };
    return dv(12) === Number(c[12]) && dv(13) === Number(c[13]);
  }
  function fmtDoc(t) {
    var d = soDig(t);
    if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
    if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    return String(t || "").trim();
  }
  function rotuloDoc(t) { var d = soDig(t); return d.length === 14 ? "CNPJ" : d.length === 11 ? "CPF" : "CPF/CNPJ"; }
  // valores em reais sempre com 2 casas (ex.: 100,00)
  function reais2(v) { return Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function matCliente(o) { return o.materiais_cliente !== false; }
  function valoresCliente(o) { return o.valores_cliente !== "total"; }
  function calcOrc(M) {
    var mat = 0, serv = 0, r2 = function (v) { return Math.round(v * 100) / 100; };
    M.itens.forEach(function (i) {
      var q = Number(i.qtd) || 0;
      if (i.tipo === "material") mat += q * (Number(i.valor) || 0);
      else { serv += q * (Number(i.valor) || 0); if (i.tipo === "ambos") mat += q * (Number(i.valor_mat) || 0); }
    });
    var mc = matCliente(M), cliente = serv + (mc ? mat : 0), desc = Number(M.desconto) || 0;
    return { mat: r2(mat), serv: r2(serv), cliente: r2(cliente), mc: mc, total: r2(Math.max(0, cliente - desc)), custo: r2(Math.max(0, mat + serv - desc)) };
  }
  // valor unitário que o cliente vê (no "material + mão de obra", só a mão de obra, a não ser que os materiais vão para o cliente)
  function unCliente(i, o) { return (Number(i.valor) || 0) + (i.tipo === "ambos" && matCliente(o) ? Number(i.valor_mat) || 0 : 0); }

  function editarOrcamento(orc, base) {
    var M = orc ? JSON.parse(JSON.stringify(orc)) : Object.assign({
      id: null, numero: null, obra_id: null, relatorio_id: null, cliente: "", telefone: "", email: "", endereco: "", categoria: "", itens: [],
      desconto: 0, pagamento: "50% na aprovação e 50% na entrega do serviço", prazo: "", validade_dias: 15, observacoes: "", status: "rascunho",
      valores_cliente: "itens", materiais_cliente: false, tipo: "servico"
    }, base || {});
    // orçamento só de materiais: valores dos materiais vão para o cliente, sem mão de obra
    if (soMateriais(M)) { M.materiais_cliente = true; M.valores_cliente = "itens"; if (!base || !base.pagamento) M.pagamento = M.pagamento === "50% na aprovação e 50% na entrega do serviço" ? "À vista na aprovação" : M.pagamento; }
    M.itens = (M.itens || []).map(function (i) { return Object.assign({ tipo: "material", descricao: "", qtd: 1, un: "un", valor: 0 }, i); });
    if (soMateriais(M)) M.itens.forEach(function (i) { i.tipo = "material"; });
    if (!M.itens.length) M.itens.push(soMateriais(M) ? { tipo: "material", descricao: "", qtd: 1, un: "un", valor: 0 } : { tipo: "servico", descricao: "", qtd: 1, un: "serv", valor: 0 });
    M.materiais_cliente = matCliente(M); M.valores_cliente = valoresCliente(M) ? "itens" : "total";

    var j = A.janela(
      '<label for="eo2-cli">Cliente *</label><input id="eo2-cli" maxlength="200">' +
      '<label for="eo2-doc">CPF ou CNPJ do cliente</label><div class="linha"><input id="eo2-doc" inputmode="numeric" maxlength="20" placeholder="Só os números ou com pontos" style="flex:1">' +
      '<button class="peq" id="eo2-doc-busca" title="Com CNPJ, busca a razão social e o endereço na Receita">🔎 Buscar CNPJ</button></div><div id="eo2-doc-msg" class="peq"></div>' +
      '<div class="duas"><div><label for="eo2-tel">WhatsApp do cliente</label><input id="eo2-tel" type="tel" maxlength="40"></div><div><label for="eo2-email">E-mail do cliente</label><input id="eo2-email" type="email" maxlength="200"></div></div>' +
      '<div class="duas"><div><label for="eo2-end">Endereço</label><input id="eo2-end" maxlength="300"></div><div><label for="eo2-cat">Área</label><select id="eo2-cat"><option value="">—</option>' +
      Object.keys(CAT_ORC).map(function (k) { return '<option value="' + k + '">' + CAT_ORC[k] + "</option>"; }).join("") + "</select></div></div>" +
      '<h3 style="margin-top:14px">Itens</h3><div id="eo2-itens"></div><datalist id="eo2-dl-precos"></datalist>' +
      '<div class="linha" style="margin-top:8px"><button class="peq" id="eo2-mais-mat">+ Material</button>' + (soMateriais(M) ? "" : '<button class="peq" id="eo2-mais-serv">+ Mão de obra / serviço</button><button class="peq" id="eo2-mais-ambos">+ Material + mão de obra</button>') + '<button class="peq" id="eo2-lista-mat" title="Escolher vários materiais da lista de uma vez">📋 Escolher da lista</button><button class="peq" id="eo2-maiusc" title="Deixa a descrição de todos os itens em letra maiúscula (toque de novo para desfazer)">🔠 MAIÚSCULAS</button></div>' +
      '<div class="duas"><div><label for="eo2-desc">Desconto (R$)</label><input id="eo2-desc" inputmode="decimal"></div><div><label for="eo2-val">Validade (dias)</label><input id="eo2-val" type="number" min="1" max="365"></div></div>' +
      '<div class="cartao' + (soMateriais(M) ? " oculto" : "") + '" style="margin-top:10px"><b>O que vai para o cliente (PDF, impressão e WhatsApp)</b>' +
      '<label class="marca-linha" style="font-weight:400"><input type="checkbox" id="eo2-vitens"> Mostrar o valor de cada serviço de mão de obra</label>' +
      '<label class="marca-linha" style="font-weight:400"><input type="checkbox" id="eo2-mcli"> Enviar também o valor dos materiais</label>' +
      '<p class="mudo peq" style="margin:4px 0 0">Desmarcado: os materiais vão só com a quantidade e o valor deles fica só no app. Para mandar os materiais com preço, use <b>🧱 Orçamento de materiais</b>.</p></div>' +
      '<div class="cartao" style="margin-top:10px" id="eo2-totais"></div>' +
      '<div class="duas"><div><label for="eo2-pag">Forma de pagamento</label><input id="eo2-pag" maxlength="300"></div><div><label for="eo2-prazo">Prazo de execução</label><input id="eo2-prazo" maxlength="200" placeholder="Ex.: 5 dias úteis"></div></div>' +
      '<label for="eo2-obs">Observações</label><textarea id="eo2-obs" rows="3"></textarea>' +
      '<label for="eo2-st">Situação</label><select id="eo2-st">' + Object.keys(STATUS_ORC).map(function (k) { return '<option value="' + k + '">' + STATUS_ORC[k] + "</option>"; }).join("") + "</select>" +
      '<p class="mudo peq" id="eo2-auto" style="margin:8px 0 0">💾 O orçamento salva sozinho enquanto você digita (com o cliente preenchido).</p>' +
      '<div class="acoes"><button class="prim" id="eo2-salvar">Salvar</button>' +
      (podeCompartilharArquivo() ? '<button class="prim" id="eo2-compartilhar">📤 Enviar PDF (WhatsApp, e-mail...)</button>' : "") +
      '<button id="eo2-pdf">📄 Baixar PDF</button></div>' +
      '<div class="acoes" style="margin-top:8px"><button class="zap" id="eo2-zap">📲 WhatsApp do cliente</button><button id="eo2-email-b">✉ E-mail do cliente</button>' +
      '<button id="eo2-imprimir">🖨 Imprimir</button>' + (!soMateriais(M) ? '<button id="eo2-gmat">🧱 Gerar orçamento de materiais</button>' : "") + '<button id="eo2-dup">📋 Usar como modelo</button>' + (M.id ? '<button class="perigo" id="eo2-apagar">Apagar</button>' : "") + "</div>",
      { titulo: M.numero ? nomeOrc(M) + " nº " + String(M.numero).padStart(4, "0") : soMateriais(M) ? "Novo orçamento de materiais" : "Novo orçamento", larga: true, fixa: true });
    var el = j.el;
    function preencher() {
      $("#eo2-doc", el).value = M.documento ? fmtDoc(M.documento) : "";
      $("#eo2-cli", el).value = M.cliente || ""; $("#eo2-tel", el).value = M.telefone || ""; $("#eo2-email", el).value = M.email || ""; $("#eo2-end", el).value = M.endereco || "";
      $("#eo2-cat", el).value = M.categoria || ""; $("#eo2-desc", el).value = M.desconto ? reais2(M.desconto) : "";
      $("#eo2-val", el).value = M.validade_dias || 15; $("#eo2-pag", el).value = M.pagamento || ""; $("#eo2-prazo", el).value = M.prazo || "";
      $("#eo2-obs", el).value = M.observacoes || ""; $("#eo2-st", el).value = M.status;
      $("#eo2-vitens", el).checked = M.valores_cliente !== "total"; $("#eo2-mcli", el).checked = !!M.materiais_cliente;
    }
    preencher();

    // rascunho no aparelho: o que foi digitado e ainda não foi salvo volta se a página recarregar, fechar ou cair a internet
    var chaveRasc = "age_rascunho_orc_" + (M.id || "novo"), tRasc = null, rascPronto = false;
    function temAlgo() {
      return !!(M.cliente || M.telefone || M.endereco || M.itens.some(function (i) { return (i.descricao && i.descricao !== "Mão de obra") || Number(i.valor); }));
    }
    function guardarRasc() {
      if (!rascPronto) return;
      clearTimeout(tRasc);
      tRasc = setTimeout(function () {
        lerCampos();
        // igual ao que está salvo: não há o que recuperar
        if (assinatura() === salvoSig) { apagarRasc(); return; }
        try { if (temAlgo()) localStorage.setItem(chaveRasc, JSON.stringify({ em: Date.now(), M: M })); } catch (e) { /* sem armazenamento */ }
        agendarAuto();
      }, 400);
    }
    // gravação automática no servidor (com o cliente preenchido): ao reabrir, em qualquer aparelho, já vem tudo atualizado
    var tAuto = null, gravando = false, deNovo = false;
    function agendarAuto() {
      clearTimeout(tAuto);
      if (!M.cliente) return;
      tAuto = setTimeout(function () {
        if (!document.body.contains(el)) return;
        if (gravando) { deNovo = true; return; }
        lerCampos();
        if (assinatura() === salvoSig) return;
        gravando = true; mostrarAuto("💾 Salvando...");
        salvar(true).then(function () {
          mostrarAuto("✅ Salvo automaticamente às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
        }).catch(function (e) {
          // mostra o motivo real (sem internet, sessão vencida, banco...) para não parecer salvo quando não está
          mostrarAuto("⚠ Não salvou no servidor: " + A.msgErro(e) + " — o rascunho está guardado neste aparelho; tento de novo na próxima alteração.");
        }).then(function () { gravando = false; if (deNovo) { deNovo = false; agendarAuto(); } });
      }, 2000);
    }
    function mostrarAuto(t) { var x = $("#eo2-auto", el); if (x) x.textContent = t; }
    function assinatura() {
      return JSON.stringify([M.documento, M.cliente, M.telefone, M.email, M.endereco, M.categoria, M.desconto, M.validade_dias, M.pagamento, M.prazo, M.observacoes, M.status,
        M.valores_cliente, M.materiais_cliente,
        M.itens.map(function (i) { return [i.tipo, i.descricao, Number(i.qtd) || 0, i.un, Number(i.valor) || 0, Number(i.valor_mat) || 0]; })]);
    }
    var salvoSig = null;
    function apagarRasc(k) { try { localStorage.removeItem(k || chaveRasc); } catch (e) { /* sem armazenamento */ } }
    function conferirDoc(mostrarOk) {
      var v = val(el, "#eo2-doc"), d = soDig(v), m = $("#eo2-doc-msg", el);
      if (!d) { m.textContent = ""; return; }
      var ok = d.length === 11 ? cpfValido(d) : d.length === 14 ? cnpjValido(d) : false;
      if (ok) { $("#eo2-doc", el).value = fmtDoc(d); m.innerHTML = mostrarOk ? '<span style="color:var(--bom)">✔ ' + rotuloDoc(d) + " válido</span>" : ""; }
      else m.innerHTML = '<span style="color:var(--critico)">⚠ ' + (d.length === 11 || d.length === 14 ? rotuloDoc(d) + " com dígito errado — confira os números." : "CPF tem 11 números e CNPJ tem 14.") + "</span>";
    }
    $("#eo2-doc", el).addEventListener("blur", function () { conferirDoc(true); });
    $("#eo2-doc-busca", el).onclick = function () {
      var d = soDig(val(el, "#eo2-doc")), b = this, m = $("#eo2-doc-msg", el);
      if (d.length !== 14 || !cnpjValido(d)) { conferirDoc(); if (d.length !== 14) m.innerHTML = '<span style="color:var(--critico)">A busca é só para CNPJ (14 números).</span>'; return; }
      if (!window.AGE_FORN) return;
      A.ocupado(b, true, "Buscando...");
      window.AGE_FORN.consultar(d).then(function (r) {
        A.ocupado(b, false);
        if (!r) { m.innerHTML = '<span style="color:var(--atencao)">Não achei esse CNPJ agora (sem internet ou fora do ar). Preencha à mão.</span>'; return; }
        // só preenche o que está vazio; o que você já escreveu fica
        var feitos = [];
        if (!val(el, "#eo2-cli")) { $("#eo2-cli", el).value = r.razao_social; feitos.push("cliente"); }
        var end = [r.endereco, r.bairro, r.cidade && r.uf ? r.cidade + "/" + r.uf : r.cidade, r.cep].filter(Boolean).join(" - ");
        if (!val(el, "#eo2-end") && end) { $("#eo2-end", el).value = end; feitos.push("endereço"); }
        if (!val(el, "#eo2-email") && r.email) { $("#eo2-email", el).value = r.email; feitos.push("e-mail"); }
        if (!val(el, "#eo2-tel") && (r.whatsapp || r.telefone)) { $("#eo2-tel", el).value = r.whatsapp || r.telefone; feitos.push("telefone"); }
        m.innerHTML = '<span style="color:var(--bom)">✔ ' + esc(r.razao_social) + (feitos.length ? " — preenchi: " + feitos.join(", ") : " — os campos já estavam preenchidos") + "</span>";
        totais();
      });
    };
    el.addEventListener("input", function () { guardarRasc(); });
    el.addEventListener("change", function () { guardarRasc(); });

    function desenharItens() {
      $("#eo2-itens", el).innerHTML = M.itens.map(function (i, n) {
        return '<div class="item-orc" data-i="' + n + '"><div class="l1"><select class="i-tipo" aria-label="Tipo">' +
          Object.keys(TIPOS_ITEM).filter(function (k) { return !soMateriais(M) || k === "material"; }).map(function (k) { return '<option value="' + k + '">' + TIPOS_ITEM[k] + "</option>"; }).join("") + "</select>" +
          '<input class="i-desc" list="eo2-dl-precos" maxlength="300" spellcheck="true" lang="pt-BR" autocorrect="on" placeholder="Descrição (os serviços da 💲 tabela de preços aparecem aqui)" aria-label="Descrição"></div>' +
          '<div class="l2' + (i.tipo === "ambos" ? " ambos" : "") + '"><label>Qtd<input class="i-qtd" inputmode="decimal"></label>' +
          '<label>Un<select class="i-un">' + UNIDADES.concat(UNIDADES.indexOf(i.un) < 0 && i.un ? [i.un] : []).map(function (u) { return "<option>" + esc(u) + "</option>"; }).join("") + "</select></label>" +
          (i.tipo === "ambos" ? '<label>Material un. (R$)<input class="i-vmat" inputmode="decimal"></label>' : "") +
          '<label>' + (i.tipo === "material" ? "Valor un. (R$)" + (M.materiais_cliente ? "" : " · só no app") : i.tipo === "ambos" ? "Mão de obra un. (R$)" : "Valor un. (R$)") +
          '<input class="i-valor" inputmode="decimal" placeholder="0,00"></label><div class="i-sub forte"></div>' +
          '<div class="i-aviso aviso erro peq oculto" style="grid-column:1/-1;margin:4px 0 0">Neste campo vai só o número (ex.: 250 ou 12,50). O nome do serviço ou do material vai no campo grande ao lado do tipo.</div>' +
          '<button class="peq i-tirar" aria-label="Remover item">✕</button></div></div>';
      }).join("");
      $$("#eo2-itens .item-orc", el).forEach(function (tr) {
        var i = M.itens[Number(tr.dataset.i)];
        $(".i-tipo", tr).value = i.tipo; $(".i-desc", tr).value = i.descricao; $(".i-qtd", tr).value = A.numero(i.qtd, 3);
        $(".i-un", tr).value = i.un; $(".i-valor", tr).value = i.valor ? reais2(i.valor) : "";
        if ($(".i-vmat", tr)) $(".i-vmat", tr).value = i.valor_mat ? reais2(i.valor_mat) : "";
        // ao sair do campo de valor, formata com 2 casas (10 → 10,00)
        [".i-valor", ".i-vmat"].forEach(function (k) {
          var x = $(k, tr); if (!x) return;
          x.addEventListener("blur", function () { if (/[A-Za-zÀ-ÿ]/.test(x.value) || !String(x.value).trim()) return; var v = A.lerNumero(x.value); x.value = v ? reais2(v) : ""; });
        });
        tr.oninput = tr.onchange = function (ev) {
          var tipoAntes = i.tipo;
          i.tipo = $(".i-tipo", tr).value; i.descricao = $(".i-desc", tr).value; i.qtd = A.lerNumero($(".i-qtd", tr).value);
          i.un = $(".i-un", tr).value; i.valor = A.lerNumero($(".i-valor", tr).value);
          if ($(".i-vmat", tr)) i.valor_mat = A.lerNumero($(".i-vmat", tr).value);
          // letra no campo de valor: avisa (é comum digitar a descrição ali)
          var letras = [$(".i-valor", tr), $(".i-vmat", tr)].some(function (x) { return x && /[A-Za-zÀ-ÿ]/.test(x.value); });
          $(".i-aviso", tr).classList.toggle("oculto", !letras);
          // trocou o tipo: redesenha para mostrar (ou tirar) o campo do valor do material
          if (i.tipo !== tipoAntes) { desenharItens(); return; }
          // serviço escolhido da 💲 tabela de preços: vira mão de obra e traz a unidade e o preço
          var pc = ev && ev.target && ev.target.classList.contains("i-desc") && window.AGE_PRECOS ? window.AGE_PRECOS.acharServico(S, M.categoria, i.descricao) : null;
          if (pc) {
            // a descrição fica como foi escrita (ex.: em MAIÚSCULAS): da tabela vêm só o tipo, a unidade e o preço
            var tipo = soMateriais(M) ? "material" : i.tipo === "ambos" ? "ambos" : ehMaterialPreco(pc) ? "material" : "servico", un = pc.un || i.un;
            var valor = pc.valor !== null && pc.valor !== undefined && !i.valor ? Number(pc.valor) : i.valor;
            if (tipo !== i.tipo || un !== i.un || valor !== i.valor) { i.tipo = tipo; i.un = un; i.valor = valor; desenharItens(); return; }
          }
          totais();
        };
        $(".i-tirar", tr).onclick = function () { M.itens.splice(Number(tr.dataset.i), 1); desenharItens(); };
        // ao sair do campo, corrige acentos e erros comuns (ex.: BIFASICA → BIFÁSICA)
        $(".i-desc", tr).addEventListener("blur", function () {
          var r = corrigirTexto(this.value);
          if (!r.feitas.length) return;
          this.value = i.descricao = r.texto; totais();
          A.avisar("✍ Corrigido: " + r.feitas.join(", "), "ok");
        });
      });
      totais();
    }
    // 🔠 descrição dos itens em maiúscula; tocar de novo volta ao texto de antes
    var antesMaiusc = null;
    function botaoMaiusc() { $("#eo2-maiusc", el).textContent = antesMaiusc ? "↩ Desfazer maiúsculas" : "🔠 MAIÚSCULAS"; }
    $("#eo2-maiusc", el).onclick = function () {
      if (antesMaiusc) {
        M.itens.forEach(function (i, n) { if (antesMaiusc[n] !== undefined && i.descricao === String(antesMaiusc[n]).toLocaleUpperCase("pt-BR")) i.descricao = antesMaiusc[n]; });
        antesMaiusc = null;
      } else {
        antesMaiusc = M.itens.map(function (i) { return i.descricao || ""; });
        M.itens.forEach(function (i) { i.descricao = String(i.descricao || "").toLocaleUpperCase("pt-BR"); });
      }
      botaoMaiusc(); desenharItens();
    };
    function listaPrecos() {
      if (!window.AGE_PRECOS) return;
      $("#eo2-dl-precos", el).innerHTML = window.AGE_PRECOS.paraOrcamento(S, $("#eo2-cat", el).value).filter(function (x) { return !soMateriais(M) || ehMaterialPreco(x); }).map(function (x) {
        return '<option value="' + esc(x.descricao) + '">' + esc((x.un || "") + (x.valor !== null && x.valor !== undefined ? " · " + A.dinheiro(Number(x.valor)) : " · a definir")) + "</option>";
      }).join("");
    }
    function lerCampos() {
      M.documento = soDig(val(el, "#eo2-doc")) ? fmtDoc(val(el, "#eo2-doc")) : "";
      M.cliente = val(el, "#eo2-cli"); M.telefone = val(el, "#eo2-tel"); M.email = val(el, "#eo2-email"); M.endereco = val(el, "#eo2-end"); M.categoria = $("#eo2-cat", el).value;
      M.desconto = A.lerNumero($("#eo2-desc", el).value); M.validade_dias = Math.max(1, parseInt($("#eo2-val", el).value, 10) || 15);
      M.pagamento = val(el, "#eo2-pag"); M.prazo = val(el, "#eo2-prazo"); M.observacoes = val(el, "#eo2-obs"); M.status = $("#eo2-st", el).value;
      M.valores_cliente = $("#eo2-vitens", el).checked ? "itens" : "total"; M.materiais_cliente = $("#eo2-mcli", el).checked;
    }
    function totais() {
      lerCampos(); guardarRasc();
      M.itens.forEach(function (i, n) {
        var c = $('#eo2-itens .item-orc[data-i="' + n + '"] .i-sub', el);
        if (c) c.textContent = A.dinheiro((Number(i.qtd) || 0) * ((Number(i.valor) || 0) + (i.tipo === "ambos" ? Number(i.valor_mat) || 0 : 0)));
      });
      var t = calcOrc(M);
      $("#eo2-totais", el).innerHTML = '<div class="linha"><span>🧱 Materiais' + (t.mc ? "" : ' <span class="selo">só no app</span>') + '</span><span class="dir">' + A.dinheiro(t.mat) + "</span></div>" +
        (soMateriais(M) ? "" : '<div class="linha"><span>👷 Mão de obra / serviços</span><span class="dir">' + A.dinheiro(t.serv) + "</span></div>") +
        (M.desconto ? '<div class="linha"><span>Desconto</span><span class="dir">− ' + A.dinheiro(M.desconto) + "</span></div>" : "") +
        '<div class="linha forte" style="font-size:18px;margin-top:4px"><span>Total para o cliente</span><span class="dir">' + A.dinheiro(t.total) + "</span></div>" +
        (!t.mc && t.mat ? '<div class="linha mudo peq"><span>Custo total com os materiais (só no app)</span><span class="dir">' + A.dinheiro(t.custo) + "</span></div>" : "");
    }
    $("#eo2-desc", el).oninput = totais;
    $("#eo2-desc", el).addEventListener("blur", function () { var v = A.lerNumero(this.value); this.value = v ? reais2(v) : ""; });
    $("#eo2-cat", el).addEventListener("change", listaPrecos); listaPrecos();
    $("#eo2-mais-mat", el).onclick = function () { M.itens.push({ tipo: "material", descricao: "", qtd: 1, un: "un", valor: 0 }); desenharItens(); focarUltimo(); };
    if ($("#eo2-mais-serv", el)) $("#eo2-mais-serv", el).onclick = function () { M.itens.push({ tipo: "servico", descricao: "", qtd: 1, un: "serv", valor: 0 }); desenharItens(); focarUltimo(); };
    if ($("#eo2-mais-ambos", el)) $("#eo2-mais-ambos", el).onclick = function () { M.itens.push({ tipo: "ambos", descricao: "", qtd: 1, un: "un", valor: 0, valor_mat: 0 }); desenharItens(); focarUltimo(); };
    // trocar a opção dos materiais muda o rótulo do valor e o total para o cliente
    $("#eo2-mcli", el).addEventListener("change", function () { lerCampos(); desenharItens(); });
    $("#eo2-vitens", el).addEventListener("change", totais);
    function focarUltimo() { var x = $$(".i-desc", el); if (x.length) x[x.length - 1].focus(); }
    desenharItens();
    if (M.id) { lerCampos(); salvoSig = assinatura(); }
    rascPronto = true;
    (function oferecerRasc() {
      var r = null;
      try { r = JSON.parse(localStorage.getItem(chaveRasc) || "null"); } catch (e) { r = null; }
      if (!r || !r.M || Date.now() - r.em > 30 * 864e5) return;
      if (M.id && r.em <= Date.parse(M.atualizado_em || M.criado_em || 0)) { apagarRasc(); return; }
      var av = document.createElement("div");
      av.className = "aviso"; av.id = "eo2-rasc";
      av.innerHTML = "📝 Há um rascunho <b>não salvo</b> deste orçamento" + (r.M.cliente ? " (" + esc(r.M.cliente) + ")" : "") + ", de " +
        esc(new Date(r.em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })) + "." +
        '<div class="acoes" style="margin-top:6px"><button class="prim peq" id="eo2-rasc-sim">↩ Recuperar</button><button class="peq" id="eo2-rasc-nao">Descartar</button></div>';
      el.insertBefore(av, el.firstChild);
      $("#eo2-rasc-sim", el).onclick = function () {
        var id = M.id, numero = M.numero;
        M = Object.assign(M, r.M, { id: id, numero: numero });
        M.itens = (M.itens || []).map(function (i) { return Object.assign({ tipo: "material", descricao: "", qtd: 1, un: "un", valor: 0 }, i); });
        if (!M.itens.length) M.itens.push({ tipo: "servico", descricao: "", qtd: 1, un: "serv", valor: 0 });
        preencher(); listaPrecos(); desenharItens(); av.remove(); A.avisar("Rascunho recuperado. Clique em Salvar para guardar.", "ok");
      };
      $("#eo2-rasc-nao", el).onclick = function () { if (!window.confirm("Descartar o rascunho? O que não foi salvo será perdido.")) return; apagarRasc(); av.remove(); };
    })();

    // itens novos com preço entram sozinhos na 💲 tabela de preços (e aparecem como sugestão nos próximos orçamentos);
    // os que já vieram de um orçamento ficam com o último preço usado; os da tabela base/ABRAPP não mudam
    function aprenderItens(itens, cat) {
      if ((cat !== "eletrica" && cat !== "pintura") || S.semPrecos || !window.AGE_PRECOS) return;
      var novos = [], mudar = [], vistos = {};
      itens.forEach(function (i) {
        var v = Math.round((Number(i.valor) || 0) * 100) / 100, d = String(i.descricao || "").trim(), chave = semAcento(d).trim();
        if (!v || d.length < 3 || vistos[chave]) return;
        vistos[chave] = 1;
        var ja = window.AGE_PRECOS.acharServico(S, cat, d);
        if (!ja) novos.push({ categoria: cat, grupo: i.tipo === "material" ? GRUPO_MAT_ORC : "Serviços (dos orçamentos)", descricao: d.slice(0, 300), un: i.un || "un", valor: v, fonte: "Orçamento" });
        else if (ja.valor === null || ja.valor === undefined || (ja.fonte === "Orçamento" && Number(ja.valor) !== v)) mudar.push({ id: ja.id, valor: v });
      });
      if (!novos.length && !mudar.length) return;
      var ps = [];
      if (novos.length) ps.push(q(sb.from("precos").insert(novos).select()).then(function (ns) { ns.forEach(function (n) { trocar(S.precos, n); }); }));
      mudar.forEach(function (m) { ps.push(q(sb.from("precos").update({ valor: m.valor, atualizado_em: new Date().toISOString() }).eq("id", m.id).select().single()).then(function (n) { trocar(S.precos, n); })); });
      Promise.all(ps).then(function () {
        listaPrecos();
        if (novos.length) A.avisar(novos.length + " item(ns) novo(s) guardado(s) na 💲 tabela de preços", "ok");
      }).catch(function () { /* o orçamento já foi salvo; a tabela tenta de novo no próximo salvamento */ });
    }
    function salvar(auto) {
      lerCampos();
      if (!M.cliente) return Promise.reject(new Error("Informe o cliente."));
      if (!auto) {
        // ao salvar pelo botão, o corretor passa em todos os itens (inclusive os escritos antes dele existir)
        var corr = [];
        M.itens.forEach(function (i) { var r = corrigirTexto(i.descricao); if (r.feitas.length) { i.descricao = r.texto; corr = corr.concat(r.feitas); } });
        if (corr.length) A.avisar("✍ Corrigido: " + corr.join(", "), "ok");
      }
      var itens = M.itens.filter(function (i) { return i.descricao.trim(); }).map(function (i) {
        var x = { tipo: i.tipo, descricao: i.descricao.trim(), qtd: Number(i.qtd) || 0, un: i.un, valor: Math.round((Number(i.valor) || 0) * 100) / 100 };
        if (i.tipo === "ambos") x.valor_mat = Math.round((Number(i.valor_mat) || 0) * 100) / 100;
        return x;
      });
      var dados = { obra_id: M.obra_id, relatorio_id: M.relatorio_id, cliente: M.cliente, documento: nulo(M.documento), telefone: nulo(M.telefone), email: nulo(M.email), endereco: nulo(M.endereco), categoria: nulo(M.categoria),
        itens: itens, desconto: Math.round((M.desconto || 0) * 100) / 100, total: calcOrc({ itens: itens, desconto: M.desconto, materiais_cliente: M.materiais_cliente }).total,
        pagamento: nulo(M.pagamento), prazo: nulo(M.prazo), validade_dias: M.validade_dias, observacoes: nulo(M.observacoes), status: M.status };
      if (!S.semOpcOrc) { dados.valores_cliente = M.valores_cliente; dados.materiais_cliente = !!M.materiais_cliente; }
      if (S.semDocOrc) delete dados.documento;
      if (!S.semTipoOrc) dados.tipo = M.tipo || "servico";
      function gravar(d) { return q(M.id ? sb.from("orcamentos").update(d).eq("id", M.id).select().single() : sb.from("orcamentos").insert(d).select().single()); }
      return gravar(dados).catch(function (e) {
        // banco ainda sem as colunas novas: grava sem elas e avisa uma vez para rodar o SQL
        var msg = A.msgErro(e) + " " + (e && e.message), opc = /valores_cliente|materiais_cliente/.test(msg), doc = /documento/.test(msg), tp = /'tipo' column|column "?tipo"?/.test(msg);
        if ((!opc || S.semOpcOrc) && (!doc || S.semDocOrc) && (!tp || S.semTipoOrc)) throw e;
        if (tp) { S.semTipoOrc = true; delete dados.tipo; }
        if (opc) { S.semOpcOrc = true; delete dados.valores_cliente; delete dados.materiais_cliente; }
        if (doc) { S.semDocOrc = true; delete dados.documento; }
        A.avisar("Para guardar as opções do que vai ao cliente, rode o supabase.sql no Supabase (colunas novas do orçamento).", "erro");
        return gravar(dados);
      }).then(function (n) {
        if (S.semOpcOrc) { n.valores_cliente = M.valores_cliente; n.materiais_cliente = !!M.materiais_cliente; }
        if (S.semDocOrc) n.documento = M.documento;
        if (S.semTipoOrc) n.tipo = M.tipo;
        trocar(S.orc, n);
        S.orc.sort(function (a, b) { return b.numero - a.numero; });
        var titulo = el.closest(".modal").querySelector(".cab h2");
        if (auto) {
          // gravação automática: não redesenha a tela (quem está digitando não perde o campo)
          M.id = n.id; M.numero = n.numero; M.criado_em = n.criado_em; M.atualizado_em = n.atualizado_em;
          apagarRasc(); apagarRasc("age_rascunho_orc_novo"); chaveRasc = "age_rascunho_orc_" + n.id;
          // aprende só os itens que não estão sendo digitados agora
          var ativo = document.activeElement && document.activeElement.closest ? document.activeElement.closest(".item-orc") : null;
          var ai = ativo ? Number(ativo.dataset.i) : -1;
          aprenderItens(M.itens.filter(function (y, k) { return k !== ai && String(y.descricao || "").trim(); }).map(function (y) {
            return { tipo: y.tipo, descricao: y.descricao.trim(), un: y.un, valor: Math.round((Number(y.valor) || 0) * 100) / 100 };
          }), M.categoria);
          salvoSig = assinatura();
          titulo.textContent = nomeOrc(M) + " nº " + String(n.numero).padStart(4, "0");
          if (location.hash.slice(1) === "orcamentos") rota();
          return n;
        }
        M = Object.assign(M, n);
        // salvo no servidor: o rascunho deste aparelho não é mais necessário
        clearTimeout(tRasc); apagarRasc(); apagarRasc("age_rascunho_orc_novo"); chaveRasc = "age_rascunho_orc_" + n.id;
        aprenderItens(itens, M.categoria);
        desenharItens();
        lerCampos(); salvoSig = assinatura();
        titulo.textContent = nomeOrc(M) + " nº " + String(n.numero).padStart(4, "0");
        if (location.hash.slice(1) === "orcamentos") rota();
        return n;
      });
    }
    $("#eo2-salvar", el).onclick = function () {
      var b = this; A.ocupado(b, true, "Salvando...");
      salvar().then(function (n) { A.ocupado(b, false); A.avisar("Orçamento nº " + String(n.numero).padStart(4, "0") + " salvo", "ok"); mostrarAuto("✅ Salvo às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })); })
        .catch(function (e) { A.ocupado(b, false); falhou(e); mostrarAuto("⚠ Não salvou: " + A.msgErro(e)); });
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
    $("#eo2-lista-mat", el).onclick = function () { escolherMateriais(); };
    // escolher vários materiais da 💲 tabela de uma vez (com busca e grupos)
    function escolherMateriais() {
      lerCampos();
      var cat = M.categoria === "eletrica" || M.categoria === "pintura" ? M.categoria : "";
      var todos = (S.precos || []).filter(function (x) { return x.ativo !== false && ehMaterialPreco(x) && (!cat || x.categoria === cat); })
        .sort(function (a, b) { return String(a.grupo).localeCompare(String(b.grupo), "pt") || String(a.descricao).localeCompare(String(b.descricao), "pt"); });
      if (!todos.length) { A.avisar("Nenhum material na 💲 tabela" + (cat ? " de " + CAT_ORC[cat].toLowerCase() : "") + ". Em 💲 Preços, toque em 📥 Carregar lista de materiais.", "erro"); return; }
      var marc = {};
      var jl = A.janela('<input id="em-busca" type="search" placeholder="🔍 Buscar material (ex.: cabo 2,5, disjuntor, tinta)">' +
        '<div id="em-lista" style="max-height:55vh;overflow:auto;margin-top:8px"></div><div class="acoes"><button class="prim" id="em-ok">Adicionar selecionados</button></div>',
        { titulo: "📋 Escolher materiais" + (cat ? " · " + CAT_ORC[cat] : ""), larga: true });
      function desenha() {
        var b = semAcento($("#em-busca", jl.el).value).trim(), g = null, h = "";
        todos.filter(function (x) { return !b || b.split(/\s+/).every(function (p) { return semAcento(x.descricao + " " + x.grupo).indexOf(p) >= 0; }); }).slice(0, 400).forEach(function (x) {
          if (x.grupo !== g) { g = x.grupo; h += '<h3 style="margin:10px 0 4px">' + esc(String(g).replace(/^Materiais – /, "")) + "</h3>"; }
          h += '<label class="marca-linha" style="font-weight:400"><input type="checkbox" data-em="' + x.id + '"' + (marc[x.id] ? " checked" : "") + "> " + esc(x.descricao) +
            ' <span class="peq mudo">· ' + esc(x.un || "un") + (x.valor !== null && x.valor !== undefined ? " · " + A.dinheiro(Number(x.valor)) : " · a definir") + "</span></label>";
        });
        $("#em-lista", jl.el).innerHTML = h || '<div class="vazio">Nada com essa busca.</div>';
        $$("[data-em]", jl.el).forEach(function (cb) { cb.onchange = function () { if (cb.checked) marc[cb.dataset.em] = 1; else delete marc[cb.dataset.em]; $("#em-ok", jl.el).textContent = "Adicionar selecionados (" + Object.keys(marc).length + ")"; }; });
      }
      $("#em-busca", jl.el).oninput = desenha; desenha();
      $("#em-ok", jl.el).onclick = function () {
        var ids = Object.keys(marc); if (!ids.length) { A.avisar("Marque pelo menos um material.", "erro"); return; }
        // tira a linha vazia do começo, se houver
        M.itens = M.itens.filter(function (i) { return String(i.descricao || "").trim() || Number(i.valor); });
        ids.forEach(function (id) { var x = porId(S.precos, id); if (x) M.itens.push({ tipo: "material", descricao: x.descricao, qtd: 1, un: x.un || "un", valor: x.valor === null || x.valor === undefined ? 0 : Number(x.valor) }); });
        jl.fechar(); desenharItens(); guardarRasc(); A.avisar(ids.length + " material(is) adicionado(s). Ajuste as quantidades.", "ok");
      };
    }
    if ($("#eo2-gmat", el)) $("#eo2-gmat", el).onclick = function () {
      var b = this; A.ocupado(b, true, "Gerando...");
      salvar().then(function (n) { A.ocupado(b, false); j.fechar(); materiaisDoOrcamento(n); }).catch(function (e) { A.ocupado(b, false); falhou(e); });
    };
    if ($("#eo2-dup", el)) $("#eo2-dup", el).onclick = function () {
      // salva o que está na tela antes de copiar
      var b = this; A.ocupado(b, true, "Copiando...");
      salvar().then(function (n) { A.ocupado(b, false); j.fechar(); usarComoModelo(n); }).catch(function (e) { A.ocupado(b, false); falhou(e); });
    };
    if ($("#eo2-apagar", el)) $("#eo2-apagar", el).onclick = function () {
      if (!A.confirmar("Apagar este orçamento?")) return;
      q(sb.from("orcamentos").delete().eq("id", M.id)).then(function () { tirar(S.orc, M.id); j.fechar(); A.avisar("Apagado", "ok"); rota(); }).catch(falhou);
    };
  }

  function gruposCliente(o) {
    var mc = matCliente(o), vi = valoresCliente(o);
    return [
      { titulo: "Materiais", itens: o.itens.filter(function (i) { return i.tipo === "material"; }), comValor: mc },
      { titulo: "Mão de obra / serviços", itens: o.itens.filter(function (i) { return i.tipo !== "material"; }), comValor: vi }
    ].filter(function (g) { return g.itens.length; });
  }
  function textoOrcamento(o, semNegrito) {
    var E = A.CFG.EMPRESA || {};
    var t = "Olá, " + o.cliente.split(" ")[0] + "! Segue o " + (soMateriais(o) ? "orçamento de materiais" : "orçamento") + " solicitado.\n\n*" + (E.nome || "AGE Elétrica e Pintura") + "*\n" + nomeOrc(o) + " nº " +
      String(o.numero).padStart(4, "0") + " — " + A.data(o.criado_em) + "\n\nCliente: " + o.cliente + "\n" + (o.documento ? rotuloDoc(o.documento) + ": " + fmtDoc(o.documento) + "\n" : "");
    if (o.endereco) t += "Local: " + o.endereco + "\n";
    t += "\n";
    var tc = calcOrc(o);
    gruposCliente(o).forEach(function (g) {
      t += "*" + g.titulo + "*\n";
      g.itens.forEach(function (i) {
        var u = unCliente(i, o);
        t += "• " + i.descricao + " — " + A.numero(i.qtd, 3) + " " + i.un + (g.comValor ? " × " + A.dinheiro(u) + " = " + A.dinheiro(i.qtd * u) : "") + "\n";
      });
      t += "\n";
    });
    if (tc.mc && tc.mat) t += "Materiais: " + A.dinheiro(tc.mat) + "\n";
    if (tc.serv) t += "Mão de obra: " + A.dinheiro(tc.serv) + "\n";
    if (Number(o.desconto)) t += "Desconto: − " + A.dinheiro(o.desconto) + "\n";
    t += "*Total: " + A.dinheiro(tc.total) + "*\n";
    if (o.pagamento) t += "Pagamento: " + o.pagamento + "\n";
    if (o.prazo) t += "Prazo: " + o.prazo + "\n";
    t += "Validade: " + o.validade_dias + " dias";
    if (o.observacoes) t += "\n\n" + o.observacoes;
    if (E.fraseOrcamento) t += "\n\n" + E.fraseOrcamento + (E.telefone ? "\n📲 " + E.telefone : "");
    else if (E.telefone) t += "\n\nDúvidas: " + E.telefone;
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
      var comValorTab = true;
      function cabeTabela() {
        fonte("bold", 8); doc.setTextColor(90, 90, 90);
        doc.text("DESCRIÇÃO", L + 1, y); doc.text("QTD", 122, y, { align: "right" }); doc.text("UN", 125, y);
        if (comValorTab) { doc.text("VALOR UN.", 162, y, { align: "right" }); doc.text("SUBTOTAL", R - 1, y, { align: "right" }); }
        y += 2; doc.setDrawColor(200); doc.setLineWidth(0.3); doc.line(L, y, R, y); y += 4.5;
      }
      function espaco(alt) { if (y + alt > 278) { doc.addPage(); y = 18; return true; } return false; }

      // cabeçalho
      fonte("bold", 16); azul(); doc.text(tx(E.nome || "AGE Elétrica e Pintura"), L, y);
      fonte("bold", 13); preto(); doc.text(nomeOrc(o, true) + " Nº " + num, R, y, { align: "right" });
      var validade = new Date(o.criado_em); validade.setDate(validade.getDate() + Number(o.validade_dias || 15));
      fonte("normal", 10); doc.text("Data: " + A.data(o.criado_em), R, y + 6, { align: "right" }); doc.text("Válido até: " + A.data(validade), R, y + 11, { align: "right" });
      fonte("normal", 9); var yi = y + 6;
      [E.documento, E.telefone, E.email, E.endereco, E.cidade].filter(Boolean).forEach(function (l) { doc.text(tx(l), L, yi); yi += 4.5; });
      y = Math.max(yi, y + 14) + 1;
      doc.setDrawColor(20, 50, 92); doc.setLineWidth(0.8); doc.line(L, y, R, y); y += 6;

      // cliente
      var cli = [["Cliente: ", o.cliente], [rotuloDoc(o.documento) + ": ", o.documento ? fmtDoc(o.documento) : ""], ["WhatsApp: ", o.telefone], ["E-mail: ", o.email], ["Local: ", o.endereco], ["Serviço: ", CAT_ORC[o.categoria] || o.categoria]]
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
      gruposCliente(o).forEach(function (g) {
        var itens = g.itens; comValorTab = g.comValor;
        espaco(20);
        fonte("bold", 12); azul(); doc.text(tx(g.titulo), L, y); y += 6;
        cabeTabela();
        itens.forEach(function (i) {
          fonte("normal", 9.5); preto();
          var u = unCliente(i, o), d = doc.splitTextToSize(tx(i.descricao), g.comValor ? 88 : 100), alt = d.length * 4.4 + 2.4;
          if (espaco(alt)) cabeTabela();
          fonte("normal", 9.5); preto();
          doc.text(d, L + 1, y);
          doc.text(tx(A.numero(i.qtd, 3)), 122, y, { align: "right" }); doc.text(tx(i.un), 125, y);
          if (g.comValor) { doc.text(tx(A.dinheiro(u)), 162, y, { align: "right" }); doc.text(tx(A.dinheiro(i.qtd * u)), R - 1, y, { align: "right" }); }
          y += alt - 2.4; doc.setDrawColor(225); doc.setLineWidth(0.2); doc.line(L, y - 1.6, R, y - 1.6); y += 3.2;
        });
        y += 3;
      });

      // totais
      espaco(32);
      var xt = 120;
      fonte("normal", 10); preto();
      (t.mc && t.mat ? [["Materiais", t.mat]] : []).concat(t.serv ? [["Mão de obra", t.serv]] : []).concat(Number(o.desconto) ? [["Desconto", -Number(o.desconto)]] : []).forEach(function (l) {
        doc.text(l[0], xt, y); doc.text((l[1] < 0 ? "- " : "") + tx(A.dinheiro(Math.abs(l[1]))), R, y, { align: "right" }); y += 5.5;
      });
      doc.setDrawColor(20, 50, 92); doc.setLineWidth(0.6); doc.line(xt, y - 2.5, R, y - 2.5); y += 3;
      fonte("bold", 14); doc.text("TOTAL", xt, y); doc.text(tx(A.dinheiro(t.total)), R, y, { align: "right" }); y += 10;

      // condições
      [["Forma de pagamento: ", o.pagamento], ["Prazo de execução: ", o.prazo], ["Observações: ", o.observacoes]].forEach(function (c) {
        if (!c[1]) return;
        var linhas = doc.splitTextToSize(tx(c[1]), R - L);
        espaco(6 + linhas.length * 4.6);
        fonte("bold", 10); preto(); doc.text(c[0], L, y); y += 5;
        fonte("normal", 10); doc.text(linhas, L, y); y += linhas.length * 4.6 + 3;
      });

      // frase de atendimento
      if (E.fraseOrcamento) {
        var fr = doc.splitTextToSize(tx(E.fraseOrcamento + (E.telefone ? "  WhatsApp: " + E.telefone : "")), R - L);
        espaco(6 + fr.length * 5); fonte("bold", 10.5); azul(); doc.text(fr, 105, y, { align: "center" }); y += fr.length * 5 + 2; preto();
      }
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
    function bloco(g) {
      return "<h3>" + esc(g.titulo) + '</h3><table><thead><tr><th>Descrição</th><th class="n">Qtd</th><th>Un</th>' + (g.comValor ? '<th class="n">Valor un.</th><th class="n">Subtotal</th>' : "") + "</tr></thead><tbody>" +
        g.itens.map(function (i) {
          var u = unCliente(i, o);
          return "<tr><td>" + esc(i.descricao) + '</td><td class="n">' + A.numero(i.qtd, 3) + "</td><td>" + esc(i.un) + "</td>" +
            (g.comValor ? '<td class="n">' + A.dinheiro(u) + '</td><td class="n">' + A.dinheiro(i.qtd * u) + "</td>" : "") + "</tr>";
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
      '<div class="num"><b>' + nomeOrc(o, true) + " Nº " + String(o.numero).padStart(4, "0") + "</b><br>Data: " + A.data(o.criado_em) + "<br>Válido até: " + A.data(validade) + "</div></div>" +
      '<div class="cli"><b>Cliente:</b> ' + esc(o.cliente) + (o.documento ? " · <b>" + rotuloDoc(o.documento) + ":</b> " + esc(fmtDoc(o.documento)) : "") + (o.telefone ? " · " + esc(o.telefone) : "") + (o.email ? " · " + esc(o.email) : "") + (o.endereco ? "<br><b>Local:</b> " + esc(o.endereco) : "") +
      (o.categoria ? "<br><b>Serviço:</b> " + esc(CAT_ORC[o.categoria] || o.categoria) : "") + "</div>" +
      gruposCliente(o).map(bloco).join("") +
      '<div class="tot">' + (t.mc && t.mat ? "<div><span>Materiais</span><span>" + A.dinheiro(t.mat) + "</span></div>" : "") +
      (t.serv ? "<div><span>Mão de obra</span><span>" + A.dinheiro(t.serv) + "</span></div>" : "") +
      (Number(o.desconto) ? "<div><span>Desconto</span><span>− " + A.dinheiro(o.desconto) + "</span></div>" : "") +
      '<div class="g"><span>Total</span><span>' + A.dinheiro(t.total) + "</span></div></div>" +
      '<div class="cond">' + (o.pagamento ? "<p><b>Forma de pagamento:</b> " + esc(o.pagamento) + "</p>" : "") + (o.prazo ? "<p><b>Prazo de execução:</b> " + esc(o.prazo) + "</p>" : "") +
      (o.observacoes ? '<p><b>Observações:</b><br><span style="white-space:pre-wrap">' + esc(o.observacoes) + "</span></p>" : "") + "</div>" +
      (E.fraseOrcamento ? '<p style="text-align:center;font-weight:bold;color:#14325c;margin-top:18px">' + esc(E.fraseOrcamento) + (E.telefone ? " · WhatsApp: " + esc(E.telefone) : "") + "</p>" : "") +
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

  // "📋 3338 · acréscimo de tomada..." (sem a linha automática "Chamado nº ... aberto em ...")
  function resumoServ(s, max) {
    var o = porId(S.obras, s.obra_id), d = String(s.descricao || "");
    if (o && o.chamado) d = d.replace(/^Chamado nº[^\n]*\n?/, "").replace(/^Ver a descrição do problema no portal do cliente\.?$/, "");
    d = d.replace(/\s+/g, " ").trim();
    max = max || 70;
    return (o && o.chamado ? "📋 " + o.chamado + (d ? " · " : "") : "") + (d.length > max ? d.slice(0, max) + "…" : d);
  }
  function lojasComServico(cat, etapa) {
    var mapa = {};
    S.serv.forEach(function (s) {
      if (!(s.status === "aberto" || s.status === "em_andamento") || (cat && s.categoria !== cat) || (etapa && etapaDe(s) !== etapa)) return;
      var o = porId(S.obras, s.obra_id), l = o && o.loja_id ? porId(S.lojas, o.loja_id) : null;
      if (!l) return;
      (mapa[l.id] = mapa[l.id] || { loja: l, servicos: [] }).servicos.push(s);
    });
    return Object.keys(mapa).map(function (k) { return mapa[k]; });
  }

  // base da AGE: a do config.js ou a salva neste aparelho (botão "Salvar como base")
  function baseRotas() {
    if (A.CFG.BASE && G.temLocal(A.CFG.BASE)) return A.CFG.BASE;
    try { var b = JSON.parse(localStorage.getItem("age_base_rota") || "null"); return b && G.temLocal(b) ? b : null; } catch (e) { return null; }
  }
  function verRotas(c) {
    var base = baseRotas();
    c.innerHTML = '<div class="cab-secao"><h2>Rotas</h2></div>' +
      (S.lojas.length ? "" : '<div class="aviso">Cadastre ou importe as lojas na aba <a href="#lojas">Lojas</a> para montar rotas.</div>') +
      '<div class="cartao"><div class="duas"><div><label for="rt-partida">Saindo de</label><select id="rt-partida"><option value="gps">📍 Minha localização agora</option>' +
      (base ? '<option value="base">🏠 ' + esc(base.nome || "Base da AGE") + "</option>" : "") + '<option value="loja">🏪 Uma loja...</option>' +
      '<option value="nenhuma">— sem ponto de partida (começa na 1ª loja)</option></select>' +
      '<input id="rt-partida-loja" list="rt-dl-lojas" class="oculto" style="margin-top:6px" placeholder="Digite a loja de partida"><div id="rt-gps" class="peq" style="margin-top:4px"></div></div>' +
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
    // localização atual: pega já ao abrir a aba, para a rota sair daqui
    function pegarGps(forcar) {
      var x = $("#rt-gps");
      if (!x || $("#rt-partida").value !== "gps") { if (x) x.innerHTML = ""; return; }
      if (R.gps && !forcar && Date.now() - R.gps.quando < 10 * 60000) { mostrarGps(); return; }
      x.innerHTML = '<span class="mudo">📍 Pegando sua localização...</span>';
      posicaoAtual(true).then(function (p) { R.gps = { lat: p.lat, lng: p.lng, precisao: p.precisao, quando: Date.now() }; mostrarGps(); })
        .catch(function (e) { x.innerHTML = '<span class="selo critico">' + esc(e.message) + '</span> <button class="peq" id="rt-gps-de-novo">↻ Tentar de novo</button>'; $("#rt-gps-de-novo").onclick = function () { pegarGps(true); }; });
    }
    function mostrarGps() {
      var x = $("#rt-gps"), g = R.gps;
      x.innerHTML = '<span class="selo bom">📍 Localização incluída' + (g.precisao ? " (±" + Math.round(g.precisao) + " m)" : "") + "</span> " +
        '<a href="https://www.google.com/maps?q=' + g.lat + "," + g.lng + '" target="_blank" rel="noopener">ver no mapa</a> · <button class="peq" id="rt-gps-at">↻ Atualizar</button> <button class="peq" id="rt-gps-base">🏠 Salvar como base</button>' +
        (g.precisao > 1000 ? '<div class="mudo">No computador a localização é aproximada (pela internet). Para mais precisão, salve a base ou use o celular.</div>' : "");
      $("#rt-gps-at").onclick = function () { pegarGps(true); };
      $("#rt-gps-base").onclick = function () {
        if (!A.confirmar("Salvar este ponto como a base da AGE neste aparelho? Ele aparece como opção “🏠 Base da AGE” em Saindo de.")) return;
        try { localStorage.setItem("age_base_rota", JSON.stringify({ nome: "Base da AGE", lat: g.lat, lng: g.lng })); } catch (e) { /* sem armazenamento */ }
        A.avisar("Base salva", "ok"); rota();
      };
    }
    function extras() {
      $("#rt-partida-loja").classList.toggle("oculto", $("#rt-partida").value !== "loja");
      pegarGps(false);
      var m = $("#rt-modo").value, x = $("#rt-modo-extra");
      if (m === "servicos") {
        x.innerHTML = '<select id="rt-cat" aria-label="Área"><option value="">Elétrica e pintura</option><option value="eletrica">⚡ Só elétrica</option><option value="pintura">🖌️ Só pintura</option></select>' +
          '<select id="rt-etapa" aria-label="Etapa"><option value="">📐 Orçamentos e 🔧 serviços</option><option value="orcamento">📐 Só orçamentos (visitas para orçar)</option><option value="servico">🔧 Só serviços (executar)</option></select>' +
          '<div class="peq mudo" style="margin-top:4px">' + lojasComServico(R.cat, R.etapa).length + " lojas com serviço aberto (serviços ligados a uma loja)</div>";
        $("#rt-cat").value = R.cat; $("#rt-etapa").value = R.etapa || "";
        $("#rt-cat").onchange = function () { R.cat = this.value; extras(); };
        $("#rt-etapa").onchange = function () { R.etapa = this.value; extras(); };
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
    if (tipo === "base") { var b = baseRotas(); return Promise.resolve({ nome: b.nome || "Base da AGE", lat: Number(b.lat), lng: Number(b.lng) }); }
    if (tipo === "loja") {
      var l = lojaPorRotulo(R.partidaLoja);
      if (!l || !G.temLocal(l)) return Promise.reject(new Error("Escolha a loja de partida (precisa estar localizada no mapa)."));
      return Promise.resolve({ nome: nomeLoja(l), lat: l.lat, lng: l.lng, lojaId: l.id });
    }
    if (R.gps && Date.now() - R.gps.quando < 10 * 60000) return Promise.resolve({ nome: "Minha localização", lat: R.gps.lat, lng: R.gps.lng, gps: true });
    return posicaoAtual(false).then(function (p) { R.gps = { lat: p.lat, lng: p.lng, precisao: p.precisao, quando: Date.now() }; return { nome: "Minha localização", lat: p.lat, lng: p.lng, gps: true }; });
  }

  function montarRota(b) {
    A.ocupado(b, true, "Montando...");
    obterPartida().then(function (partida) {
      var lojas;
      if (R.modo === "servicos") {
        lojas = lojasComServico(R.cat, R.etapa).map(function (x) { return Object.assign({}, x.loja, { servicos: x.servicos }); });
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

  // botões para mudar a ordem, tirar ou passar a parada para outro dia (dia = índice no plano; null nas rotas salvas)
  function botoesParada(i, n, dia, nDias) {
    return '<span class="dir" style="display:inline-flex;gap:4px;align-items:center;flex-wrap:nowrap">' +
      '<button class="peq" type="button" data-pmv="' + (dia === null ? "" : dia) + ":" + i + ':-1" title="Subir"' + (i ? "" : " disabled") + ">⬆️</button>" +
      '<button class="peq" type="button" data-pmv="' + (dia === null ? "" : dia) + ":" + i + ':1" title="Descer"' + (i < n - 1 ? "" : " disabled") + ">⬇️</button>" +
      (nDias > 1 ? '<select class="peq" style="width:auto;min-height:34px;padding:4px 6px;font-size:13px" data-pdia="' + dia + ":" + i + '" title="Passar para outro dia"><option value="">→ dia</option>' +
        Array.apply(null, { length: nDias }).map(function (x, k) { return k === dia ? "" : '<option value="' + k + '">Dia ' + (k + 1) + "</option>"; }).join("") + "</select>" : "") +
      '<button class="peq perigo" type="button" data-prm="' + (dia === null ? "" : dia) + ":" + i + '" title="Tirar da rota">✕</button></span>';
  }
  function htmlParada(p, i, ant, dia, n, nDias) {
    var d = ant ? G.km(ant, p) * G.FATOR_ESTRADA : null;
    return '<li style="margin:6px 0"><div class="linha" style="gap:6px"><span><b>' + esc(nomeLoja(p)) + "</b> " + (NIVEL[p.geo_precisao] <= 2 ? '<span class="selo atencao">local aproximado</span>' : "") +
      (d !== null ? ' <span class="mudo peq">+' + A.numero(d, 1) + " km</span>" : "") + "</span>" + (n ? botoesParada(i, n, dia, nDias) : "") + "</div>" +
      '<div class="peq mudo">' + esc(enderecoLoja(p)) + "</div>" +
      (p.servicos ? '<div class="peq">' + p.servicos.map(function (s) { return '<div style="display:flex;gap:6px;align-items:center;margin:2px 0;flex-wrap:wrap">' + A.seloCategoria(s.categoria) + seloEtapa(s) + " <span>" + esc(resumoServ(s)) + "</span>" +
        (n ? ' <button class="peq" type="button" data-sfeito="' + s.id + '" title="Marcar este serviço como executado">✔ Já feito</button>' : "") + "</div>"; }).join("") + "</div>" : "") + "</li>";
  }
  // serviço já executado (que ainda estava aberto no app): marca como concluído
  function marcarFeito(sid) {
    var sv = porId(S.serv, sid);
    if (!sv || !A.confirmar("Marcar como EXECUTADO: " + resumoServ(sv, 80) + "?")) return Promise.resolve(null);
    return q(sb.from("servicos").update({ status: "concluido", concluido_em: new Date().toISOString() }).eq("id", sid).select().single())
      .then(function (n) { trocar(S.serv, n); A.avisar("✅ Serviço marcado como executado", "ok"); return n; });
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
        '<ol style="padding-left:22px;margin:6px 0">' + d.paradas.map(function (p, k) { return htmlParada(p, k, k ? d.paradas[k - 1] : R.origem, i, d.paradas.length, P.dias.length); }).join("") + "</ol>" +
        (d.paradas.length ? "" : '<div class="peq mudo">Sem paradas neste dia.</div>') +
        '<div class="acoes">' + links.map(function (u, k) {
          return '<a class="botao" target="_blank" rel="noopener" href="' + esc(u) + '">🗺 Google Maps' + (links.length > 1 ? " (parte " + (k + 1) + ")" : "") + "</a>";
        }).join("") + '<button class="prim" data-salvar-dia="' + i + '">💾 Salvar / enviar ao funcionário</button></div></div>';
    });
    c.innerHTML = h;
    $$("[data-salvar-dia]", c).forEach(function (b) { b.onclick = function () { salvarRota(Number(b.dataset.salvarDia)); }; });
    // mudar a ordem, tirar ou passar para outro dia: recalcula os km e redesenha (mapa e links do Google Maps acompanham)
    var recalc = function (d) { d.km = G.comprimento(R.origem, d.paradas, R.voltar); d.kmEstrada = d.km * G.FATOR_ESTRADA; };
    var depois = function () { P.dias.forEach(recalc); P.dias = P.dias.filter(function (d) { return d.paradas.length; }); desenharResultado(); };
    $$("[data-pmv]", c).forEach(function (b) {
      b.onclick = function () {
        var a = b.dataset.pmv.split(":").map(Number), ps = P.dias[a[0]].paradas, k = a[1] + a[2];
        if (k < 0 || k >= ps.length) return;
        var t = ps[a[1]]; ps[a[1]] = ps[k]; ps[k] = t; depois();
      };
    });
    $$("[data-prm]", c).forEach(function (b) {
      b.onclick = function () { var a = b.dataset.prm.split(":").map(Number), p = P.dias[a[0]].paradas.splice(a[1], 1)[0]; A.avisar("✕ " + nomeLoja(p) + " saiu da rota", "ok"); depois(); };
    });
    // ✔ Já feito: o serviço sai da rota; a loja sem mais nada aberto sai junto
    $$("[data-sfeito]", c).forEach(function (b) {
      b.onclick = function () {
        marcarFeito(b.dataset.sfeito).then(function (n) {
          if (!n) return;
          P.dias.forEach(function (d) {
            d.paradas.forEach(function (p) { if (p.servicos) p.servicos = p.servicos.filter(function (x) { return x.id !== n.id; }); });
            d.paradas = d.paradas.filter(function (p) { return !p.servicos || p.servicos.length; });
          });
          depois();
        }).catch(falhou);
      };
    });
    $$("[data-pdia]", c).forEach(function (s2) {
      s2.onchange = function () {
        if (this.value === "") return;
        var a = s2.dataset.pdia.split(":").map(Number), p = P.dias[a[0]].paradas.splice(a[1], 1)[0];
        P.dias[Number(this.value)].paradas.push(p); A.avisar(nomeLoja(p) + " → dia " + (Number(this.value) + 1), "ok"); depois();
      };
    });
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
  function msgRota(r, semLink) {
    var f = porId(S.func, r.funcionario_id);
    r = Object.assign({}, r, { paradas: r.id ? (r.paradas || []).filter(function (p) { return !paradaFeita(p, r); }) : r.paradas });
    var t = "*AGE Elétrica e Pintura — " + r.nome + "*\n" + (r.data ? "Data: " + A.dataSimples(r.data) + "\n" : "") + r.paradas.length + " paradas, na ordem:\n\n";
    var abertos = {};
    lojasComServico("").forEach(function (x) { abertos[x.loja.id] = x.servicos; });
    r.paradas.forEach(function (p, i) {
      t += (i + 1) + ". " + nomeLoja(p) + "\n   " + enderecoLoja(p) + "\n";
      (abertos[p.id] || []).forEach(function (s) { t += "   " + A.CATEG[s.categoria].icone + " " + (etapaDe(s) === "orcamento" ? "📐 ORÇAMENTO (fotos e medidas): " : "🔧 SERVIÇO: ") + resumoServ(s, 90) + "\n"; });
      t += "   " + G.linkNavegar(p) + "\n";
    });
    var links = G.linksGoogle(r.partida && G.temLocal(r.partida) ? r.partida : null, r.paradas, false);
    t += "\nRota completa no Google Maps" + (links.length > 1 ? " (em partes)" : "") + ":\n" + links.join("\n");
    if (f && !semLink) t += "\n\nA rota também aparece no seu app:\n" + linkFunc(f);
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
  // rota salva: mudar a ordem ou tirar paradas (o funcionário vê a ordem nova no app)
  function editarParadas(r) {
    var ps = (r.paradas || []).slice(), partida = r.partida && G.temLocal(r.partida) ? r.partida : null;
    var j = A.janela('<div id="ep-lista"></div><div class="acoes"><button class="prim" id="ep-ok">💾 Salvar ordem</button></div>', { titulo: "✏️ " + r.nome, larga: true });
    var el = j.el;
    function desenhar() {
      $("#ep-lista", el).innerHTML = ps.length ? '<ol style="padding-left:22px;margin:6px 0">' + ps.map(function (p, k) {
        var abertos = (lojasComServico("").filter(function (x) { return x.loja.id === p.loja_id; })[0] || {}).servicos || [];
        return '<li style="margin:6px 0"><div class="linha" style="gap:6px"><span><b>' + esc(nomeLoja(p)) + "</b>" + (paradaFeita(p, r) ? ' <span class="selo bom">✔ feita</span>' : "") + "</span>" + botoesParada(k, ps.length, null, 1) + "</div>" +
          '<div class="peq mudo">' + esc(enderecoLoja(p)) + "</div>" +
          abertos.map(function (sv) { return '<div class="peq" style="display:flex;gap:6px;align-items:center;margin:2px 0">' + A.seloCategoria(sv.categoria) + " <span>" + esc(resumoServ(sv)) + '</span> <button class="peq" type="button" data-sfeito="' + sv.id + '">✔ Já feito</button></div>'; }).join("") + "</li>";
      }).join("") + '</ol><div class="peq mudo">≈ ' + A.numero(G.comprimento(partida, ps.filter(G.temLocal), false) * G.FATOR_ESTRADA, 0) + " km</div>" : '<div class="aviso">Sem paradas: para apagar a rota inteira, use “Apagar” na lista.</div>';
      $$("[data-pmv]", el).forEach(function (b) { b.onclick = function () { var a = b.dataset.pmv.split(":"), i = Number(a[1]), k = i + Number(a[2]); if (k < 0 || k >= ps.length) return; var t = ps[i]; ps[i] = ps[k]; ps[k] = t; desenhar(); }; });
      $$("[data-prm]", el).forEach(function (b) { b.onclick = function () { ps.splice(Number(b.dataset.prm.split(":")[1]), 1); desenhar(); }; });
      $$("[data-sfeito]", el).forEach(function (b) { b.onclick = function () { marcarFeito(b.dataset.sfeito).then(function (n) { if (n) { desenhar(); desenharSalvas(); } }).catch(falhou); }; });
      $("#ep-ok", el).disabled = !ps.length;
    }
    desenhar();
    $("#ep-ok", el).onclick = function () {
      var b = this; A.ocupado(b, true, "Salvando...");
      q(sb.from("rotas").update({ paradas: ps, km: Math.round(G.comprimento(partida, ps.filter(G.temLocal), false) * G.FATOR_ESTRADA * 10) / 10 }).eq("id", r.id).select().single())
        .then(function (n) {
          trocar(S.rotas, n); j.fechar(); desenharSalvas(); A.avisar("Rota atualizada", "ok");
          var f = porId(S.func, n.funcionario_id);
          if (f && f.telefone) A.janela("<p>A ordem nova já aparece no app de " + esc(f.nome) + '. Quer avisar pelo WhatsApp?</p><div class="acoes"><a class="botao zap" target="_blank" rel="noopener" href="' +
            esc(A.linkZap(f.telefone, msgRota(n))) + '">📲 Enviar a rota atualizada</a></div>', { titulo: "Rota atualizada" });
        }).catch(function (e) { A.ocupado(b, false); falhou(e); });
    };
  }
  // loja da rota já atendida: serviço dela concluído depois que a rota foi criada e nada mais aberto
  function paradaFeita(p, r) {
    if (!p.loja_id) return false;
    var feito = false, aberto = false;
    S.serv.forEach(function (x) {
      var o = porId(S.obras, x.obra_id);
      if (!o || o.loja_id !== p.loja_id) return;
      if (x.status === "aberto" || x.status === "em_andamento") aberto = true;
      else if ((x.status === "concluido" || x.status === "aguardando") && x.concluido_em && x.concluido_em >= r.criado_em) feito = true;
    });
    return feito && !aberto;
  }
  function desenharSalvas() {
    var c = $("#rt-salvas");
    if (!c) return;
    if (!S.rotas.length) { c.innerHTML = '<div class="cartao vazio">Nenhuma rota salva.</div>'; return; }
    c.innerHTML = S.rotas.slice(0, 60).map(function (r) {
      var f = porId(S.func, r.funcionario_id), pend = (r.paradas || []).filter(function (p) { return !paradaFeita(p, r); });
      var links = G.linksGoogle(r.partida && G.temLocal(r.partida) ? r.partida : null, pend, false), feitas = (r.paradas || []).length - pend.length;
      return '<div class="cartao"' + (!pend.length ? ' style="opacity:.75"' : "") + '><div class="linha"><h3>' + esc(r.nome) + "</h3>" + (r.data ? '<span class="selo">📅 ' + A.dataSimples(r.data) + "</span>" : "") +
        (!pend.length ? '<span class="selo bom">✅ concluída</span>' : feitas ? '<span class="selo atencao">✔ ' + feitas + " de " + (r.paradas || []).length + " feitas</span>" : "") +
        '<span class="dir mudo peq">' + (r.paradas || []).length + " paradas" + (r.km ? " · ≈ " + A.numero(r.km, 0) + " km" : "") + "</span></div>" +
        '<div class="peq">' + (f ? "👷 " + esc(f.nome) : '<span class="mudo">sem funcionário</span>') + " · " +
        (r.paradas || []).map(function (p) { var t = esc(p.codigo || p.nome); return paradaFeita(p, r) ? "<s>" + t + "</s> ✔" : t; }).join(" → ") +
        (feitas ? ' <span class="mudo">(as feitas saíram do app do funcionário e estão em <a href="#executados">✅ Executados</a>)</span>' : "") + "</div>" +
        '<div class="acoes">' + links.map(function (u, k) { return '<a class="botao peq" target="_blank" rel="noopener" href="' + esc(u) + '">🗺 Google Maps' + (links.length > 1 ? " " + (k + 1) : "") + "</a>"; }).join("") +
        (f && f.telefone ? '<a class="botao peq zap" target="_blank" rel="noopener" href="' + esc(A.linkZap(f.telefone, msgRota(r))) + '">📲 WhatsApp</a>' : "") +
        '<button class="peq" data-rota-comp="' + r.id + '">📤 Compartilhar</button><button class="peq" data-rota-ed="' + r.id + '">✏️ Editar paradas</button>' +
        '<button class="peq perigo" data-apagar-rota="' + r.id + '">Apagar</button></div></div>';
    }).join("");
    $$("[data-rota-comp]", c).forEach(function (b) {
      b.onclick = function () { var r = porId(S.rotas, b.dataset.rotaComp); if (r) A.compartilhar({ titulo: r.nome, texto: msgRota(r, true) }); };
    });
    $$("[data-rota-ed]", c).forEach(function (b) { b.onclick = function () { editarParadas(porId(S.rotas, b.dataset.rotaEd)); }; });
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
      '<p class="mudo peq">Cada funcionário tem um link próprio e secreto. Se alguém perder o celular ou sair da empresa, use “Editar” → “Gerar novo link” ou desative: o link antigo para de funcionar na hora.</p>' +
      htmlCandidatos();
    $("#be-novo").onclick = function () { editarFunc(null); };
    ligarCandidatos(c);
    $$("[data-copiar]", c).forEach(function (b) { b.onclick = function () { copiar(linkFunc(porId(S.func, b.dataset.copiar))); }; });
    $$("[data-editar]", c).forEach(function (b) { b.onclick = function () { editarFunc(b.dataset.editar); }; });
  }

  // ---------- candidatos que se cadastraram no site ("Trabalhe com a gente") ----------
  var FUNCOES_CAND = { pintor: "Pintor", ajudante_pintura: "Ajudante de pintura", eletricista: "Eletricista", ajudante_eletrica: "Ajudante de eletricista", cordeiro: "Cordeiro / alpinista (cadeirinha)", limpeza_vidros: "Limpeza de vidros em altura" };
  var SIT_CAND = { novo: "🆕 Novo", contato: "💬 Conversando", entrevista: "📅 Entrevista / teste", contratado: "✅ Contratado", descartado: "🚫 Não serve agora" };
  var filtroCand = "abertos";
  function htmlCandidatos() {
    if (S.semCand) return '<hr class="sep"><h3>👷 Candidatos do site</h3><div class="aviso peq">Para receber os cadastros do “Trabalhe com a gente” do site, rode no Supabase o <b>supabase.sql</b> atualizado (bloco “Candidatos”) e depois <code>notify pgrst, \'reload schema\';</code></div>';
    var ls = S.cand.filter(function (x) { return filtroCand === "todos" || (filtroCand === "abertos" ? x.situacao !== "descartado" && x.situacao !== "contratado" : x.situacao === filtroCand); });
    var novos = S.cand.filter(function (x) { return x.situacao === "novo"; }).length;
    var link = sitePintura() + "#trabalhe";
    return '<hr class="sep"><div class="cab-secao"><h3 style="margin:0">👷 Candidatos do site' + (novos ? ' <span class="selo critico">' + novos + " novo" + (novos > 1 ? "s" : "") + "</span>" : "") + '</h3>' +
      '<span><button class="peq" id="cd-link">🔗 Copiar link da vaga</button> <button class="peq zap" id="cd-divulgar">📣 Divulgar a vaga</button></span></div>' +
      '<div class="filtros">' + [["abertos", "Em aberto"], ["novo", "🆕 Novos"], ["entrevista", "📅 Entrevista"], ["contratado", "✅ Contratados"], ["descartado", "🚫 Não serve"], ["todos", "Todos"]].map(function (f) {
        return '<button class="peq ' + (filtroCand === f[0] ? "prim" : "") + '" data-cdf="' + f[0] + '">' + f[1] + "</button>"; }).join("") + "</div>" +
      (ls.length ? ls.map(function (x) {
        return '<div class="cartao"><div class="linha"><h3 style="margin:0">' + esc(x.nome) + "</h3>" + (x.funcoes || []).map(function (f) { return '<span class="selo">' + esc(FUNCOES_CAND[f] || f) + "</span>"; }).join("") +
          (x.nrs || []).map(function (n) { return '<span class="selo bom">' + esc(n.toUpperCase().replace("NR", "NR-")) + "</span>"; }).join("") + '<span class="dir peq mudo">' + esc(A.dataSimples(String(x.criado_em).slice(0, 10))) + "</span></div>" +
          '<div class="peq mudo">' + esc([x.cidade, x.experiencia && "experiência: " + x.experiencia, x.disponibilidade].filter(Boolean).join(" · ")) + "</div>" +
          (x.obs ? '<div class="peq">' + esc(x.obs) + "</div>" : "") + (x.notas ? '<div class="peq">📝 ' + esc(x.notas) + "</div>" : "") +
          '<div class="acoes"><a class="botao peq zap" target="_blank" rel="noopener" href="' + esc(A.linkZap(x.whatsapp, "Olá, " + String(x.nome).split(" ")[0] + "! Aqui é da " + ((A.CFG.EMPRESA || {}).nome || "AGE") + ". Recebemos seu cadastro no site para a vaga. Podemos conversar?")) + '">💬 ' + esc(x.whatsapp) + "</a>" +
          '<select class="peq" data-cds="' + x.id + '">' + Object.keys(SIT_CAND).map(function (k) { return '<option value="' + k + '"' + (k === x.situacao ? " selected" : "") + ">" + SIT_CAND[k] + "</option>"; }).join("") + "</select>" +
          '<button class="peq" data-cdn="' + x.id + '">📝 Anotar</button>' + (x.situacao === "contratado" && !S.func.some(function (f) { return A.soDigitos(f.telefone).slice(-9) === String(x.whatsapp).slice(-9); }) ? '<button class="peq prim" data-cdc="' + x.id + '">➕ Cadastrar na equipe</button>' : "") + "</div></div>";
      }).join("") : '<div class="cartao vazio peq">Nenhum candidato neste filtro. Divulgue o link da vaga (botão 📣) em grupos de WhatsApp e Facebook da sua região.</div>') +
      '<p class="mudo peq">Link do formulário: <a href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(link) + "</a></p>";
  }
  function sitePintura() { return (A.CFG.EMPRESA && A.CFG.EMPRESA.sitePintura) || new URL("../site/", location.href).href; }
  function ligarCandidatos(c) {
    var link = sitePintura() + "#trabalhe";
    if ($("#cd-link", c)) $("#cd-link", c).onclick = function () { copiar(link); };
    if ($("#cd-divulgar", c)) $("#cd-divulgar", c).onclick = function () {
      A.compartilhar({ titulo: "Vaga AGE", texto: "👷 *A " + ((A.CFG.EMPRESA || {}).nome || "AGE") + " está contratando!*\n*Vagas temporárias, por obra* (diária ou empreitada pelo período do serviço) para pintor, ajudante de pintura, eletricista, ajudante e profissional de cadeirinha (acesso por corda / limpeza de vidros em altura) em BH e região.\n\nCadastre-se aqui: " + link });
    };
    $$("[data-cdf]", c).forEach(function (b) { b.onclick = function () { filtroCand = b.dataset.cdf; verEquipe(c); }; });
    $$("[data-cds]", c).forEach(function (s) {
      s.onchange = function () { q(sb.from("candidatos").update({ situacao: s.value, atualizado_em: new Date().toISOString() }).eq("id", s.dataset.cds).select().single()).then(function (n) { trocar(S.cand, n); verEquipe(c); }).catch(falhou); };
    });
    $$("[data-cdn]", c).forEach(function (b) {
      b.onclick = function () {
        var x = porId(S.cand, b.dataset.cdn), t = window.prompt("Anotação sobre " + x.nome + ":", x.notas || "");
        if (t === null) return;
        q(sb.from("candidatos").update({ notas: t.trim() || null, atualizado_em: new Date().toISOString() }).eq("id", x.id).select().single()).then(function (n) { trocar(S.cand, n); verEquipe(c); }).catch(falhou);
      };
    });
    $$("[data-cdc]", c).forEach(function (b) {
      b.onclick = function () {
        var x = porId(S.cand, b.dataset.cdc), fs = x.funcoes || [];
        var el = editarFunc(null);
        $("#ef-nome", el).value = x.nome; $("#ef-tel", el).value = x.whatsapp;
        var ele = fs.some(function (f) { return /eletric/.test(f); }), pin = fs.some(function (f) { return !/eletric/.test(f); });
        $("#ef-area", el).value = ele && pin ? "ambos" : ele ? "eletrica" : "pintura";
      };
    });
  }

  function editarFunc(id) {
    var f = id ? porId(S.func, id) : null;
    var j = A.janela('<label for="ef-nome">Nome *</label><input id="ef-nome" maxlength="120">' +
      '<label for="ef-tel">WhatsApp (com DDD)</label><input id="ef-tel" type="tel" maxlength="40" placeholder="(11) 91234-5678">' +
      '<label for="ef-pix">Chave Pix (para o app reconhecer os comprovantes)</label><input id="ef-pix" maxlength="120" placeholder="Telefone, CPF, e-mail ou chave aleatória">' +
      '<label for="ef-area">Área</label><select id="ef-area"><option value="eletrica">Elétrica</option><option value="pintura">Pintura</option><option value="ambos">Elétrica e pintura</option></select>' +
      (f ? '<label class="marca-linha"><input type="checkbox" id="ef-ativo"> Ativo (pode usar o link)</label>' : "") +
      '<div class="acoes"><button class="prim" id="ef-salvar">Salvar</button>' +
      (f ? '<button id="ef-token">🔄 Gerar novo link</button><button class="perigo" id="ef-apagar">Apagar</button>' : "") + "</div>",
      { titulo: f ? "Editar funcionário" : "Novo funcionário" });
    var el = j.el;
    $("#ef-nome", el).value = f ? f.nome : ""; $("#ef-tel", el).value = f ? f.telefone || "" : ""; $("#ef-area", el).value = f ? f.area : "eletrica"; $("#ef-pix", el).value = f ? f.pix || "" : "";
    if (f) $("#ef-ativo", el).checked = f.ativo;
    $("#ef-salvar", el).onclick = function () {
      var nome = val(el, "#ef-nome");
      if (!nome) { A.avisar("Informe o nome.", "erro"); return; }
      var b = this; A.ocupado(b, true, "Salvando...");
      var dados = { nome: nome, telefone: nulo(val(el, "#ef-tel")), area: $("#ef-area", el).value };
      if (val(el, "#ef-pix") || (f && f.pix)) dados.pix = nulo(val(el, "#ef-pix"));
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
    if (!f) return el;
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
    };    return el;
  }

  // o módulo da prefeitura (prefeitura.js) usa as mesmas funções do painel
  var P = {
    get sb() { return sb; }, S: S, q: q, porId: porId, trocar: trocar, tirar: tirar, falhou: falhou, nomeFunc: nomeFunc, carregando: carregando,
    val: val, nulo: nulo, htmlFoto: htmlFoto, hidratarFotos: hidratarFotos, infoFoto: infoFoto, registrarInfoPonto: registrarInfoPonto,
    opcoesFunc: opcoesFunc, formParte: formParte, botaoZap: botaoZap, seloOS: seloOS, abrirServico: abrirServico, abrirRelatorio: abrirRelatorio,
    rota: rota, atualizarAbas: function () { desenharAbas(location.hash.slice(1) || "hoje"); }, resumoServ: resumoServ, importarChamado: importarChamado, carregarJsPdf: carregarJsPdf, baixar: baixar, podeCompartilharArquivo: podeCompartilharArquivo, UNIDADES: UNIDADES, carregarLeaflet: carregarLeaflet
  };

  iniciar();
})();
