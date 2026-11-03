// Funções usadas pelo painel do dono e pela página do funcionário.
(function () {
  "use strict";
  var CFG = window.AGE_CONFIG || {};

  var CATEG = {
    eletrica: { nome: "Elétrica", icone: "⚡" },
    pintura: { nome: "Pintura", icone: "🖌️" }
  };
  var AREA = { eletrica: "Elétrica", pintura: "Pintura", ambos: "Elétrica e pintura" };
  var STATUS = { aberto: "Aberto", em_andamento: "Em andamento", aguardando: "Orçamento feito (aguardando aprovação)", concluido: "Concluído", cancelado: "Cancelado" };
  var STATUS_COR = { aberto: "atencao", em_andamento: "", aguardando: "atencao", concluido: "bom", cancelado: "critico" };
  var TIPO_PONTO = { chegada: "Chegada", servico: "Serviço", saida: "Saída" };

  function esc(t) {
    if (t === null || t === undefined) return "";
    return String(t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function $(sel, raiz) { return (raiz || document).querySelector(sel); }
  function $$(sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); }

  function data(v) { var d = v instanceof Date ? v : new Date(v); return d.toLocaleDateString("pt-BR"); }
  function hora(v) { var d = v instanceof Date ? v : new Date(v); return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }
  function dataHora(v) { return data(v) + " " + hora(v); }
  // "2026-10-05" (data sem hora, do banco) -> "05/10/2026" sem erro de fuso
  function dataSimples(s) { if (!s) return ""; var p = String(s).split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
  // Date -> "2026-10-05" no horário local
  function isoLocal(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function inicioDia(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function duracao(ms) {
    var min = Math.max(0, Math.round(ms / 60000));
    return Math.floor(min / 60) + "h" + String(min % 60).padStart(2, "0");
  }
  function dinheiro(v) {
    return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  function numero(v, casas) {
    return Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: casas === undefined ? 2 : casas });
  }
  // aceita "1.234,56", "1234,56" e "1234.56"
  function lerNumero(t) {
    if (typeof t === "number") return t;
    t = String(t || "").trim().replace(/\s/g, "");
    if (!t) return 0;
    if (t.indexOf(",") >= 0) t = t.replace(/\./g, "").replace(",", ".");
    var n = Number(t);
    return isFinite(n) ? n : 0;
  }

  function soDigitos(t) { return String(t || "").replace(/\D/g, ""); }
  function linkZap(telefone, texto) {
    var n = soDigitos(telefone);
    if (n.length === 10 || n.length === 11) n = "55" + n;
    return "https://wa.me/" + n + "?text=" + encodeURIComponent(texto);
  }
  function linkMapa(lat, lng) { return "https://www.google.com/maps/search/?api=1&query=" + lat + "," + lng; }
  function linkEndereco(end) { return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(end); }

  function seloCategoria(c) {
    var x = CATEG[c] || { nome: c || "-", icone: "" };
    return '<span class="selo ' + esc(c) + '">' + x.icone + " " + esc(x.nome) + "</span>";
  }
  function seloStatus(s) { return '<span class="selo ' + (STATUS_COR[s] || "") + '">' + esc(STATUS[s] || s) + "</span>"; }

  function avisar(msg, tipo) {
    var caixa = $("#avisos");
    if (!caixa) { caixa = document.createElement("div"); caixa.id = "avisos"; caixa.setAttribute("role", "status"); document.body.appendChild(caixa); }
    var t = document.createElement("div");
    t.className = "toast " + (tipo || "");
    t.textContent = msg;
    caixa.appendChild(t);
    while (caixa.children.length > 3) caixa.removeChild(caixa.firstChild);
    setTimeout(function () { t.remove(); }, tipo === "erro" ? 6000 : 3200);
  }
  function msgErro(e) {
    if (!e) return "Erro desconhecido.";
    var m = e.message || e.error_description || e.msg || String(e);
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Sem internet ou servidor fora do ar. Tente de novo.";
    if (/JWT|expired/i.test(m)) return "Sua sessão expirou. Entre de novo.";
    return m;
  }

  // ---------- 📝 rascunho e memória de preenchimento (vale para TODA janela com campos) ----------
  // Rascunho: o que você digita numa janela fica guardado neste aparelho. Se a janela fechar sem querer (X, Esc, clique fora),
  // a página atualizar ou o app reiniciar, ao abrir de novo o que você tinha escrito volta, com o botão "Descartar".
  // O rascunho some quando você salva ou toca em Cancelar (qualquer fechamento feito pelo próprio app) e depois de 7 dias.
  // Memória: cidade, e-mail, telefone, endereço, cliente e empresa já digitados viram sugestões nos próximos campos parecidos.
  var RASC = "age_rascunhos_v1", MEM = "age_memoria_v1", RASC_DIAS = 7;
  function lerLS(k) { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch (e) { return {}; } }
  function gravarLS(k, o) { try { localStorage.setItem(k, JSON.stringify(o)); } catch (e) { /* sem espaço ou bloqueado: segue sem guardar */ } }
  function camposDe(el) {
    return Array.prototype.filter.call(el.querySelectorAll("input[id], textarea[id], select[id]"), function (c) {
      return !/^(password|file|hidden|button|submit|reset|image)$/i.test(c.type) && !/senha|pass|token|chave|secret|pin\b/i.test(c.id);
    });
  }
  function valorDe(c) { return c.type === "checkbox" || c.type === "radio" ? (c.checked ? "1" : "0") : c.value; }
  function porValor(c, v) { if (c.type === "checkbox" || c.type === "radio") c.checked = v === "1"; else c.value = v; try { c.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) { /* ok */ } }
  function tirarRasc(chave) { var o = lerLS(RASC); if (o[chave]) { delete o[chave]; gravarLS(RASC, o); } }
  function categoria(c) {
    var t = (c.id + " " + (c.placeholder || "") + " " + (c.getAttribute("aria-label") || "")).toLowerCase();
    if (c.type === "email" || /mail/.test(t)) return "email";
    if (c.type === "tel" || /zap|fone|whats|celular/.test(t)) return "telefone";
    if (/cidade|\bcid\b|-cid\b/.test(t)) return "cidade";
    if (/endere|\bend\b|-end\b/.test(t)) return "endereco";
    if (/(^|[-_])(cli|cliente|emp|empresa)\b/.test(c.id.toLowerCase())) return "cliente";
    return "";
  }
  var memCont = 0;
  function memoria(el) {
    var mem = lerLS(MEM);
    camposDe(el).forEach(function (c) {
      if (c.tagName !== "INPUT" || c.getAttribute("list") || !/^(text|email|tel|search|)$/i.test(c.type)) return;
      var cat = categoria(c); if (!cat) return;
      var lst = (mem[cat] || []);
      if (lst.length) {
        var dl = document.createElement("datalist"); dl.id = "age-mem-" + (++memCont);
        dl.innerHTML = lst.map(function (v) { return '<option value="' + esc(v) + '">'; }).join("");
        c.parentNode.appendChild(dl); c.setAttribute("list", dl.id);
      }
      c.addEventListener("change", function () {
        var v = String(c.value || "").trim(); if (v.length < 3 || v.length > 120) return;
        var m = lerLS(MEM), l = (m[cat] || []).filter(function (x) { return x.toLowerCase() !== v.toLowerCase(); });
        l.unshift(v); m[cat] = l.slice(0, 40); gravarLS(MEM, m);
      });
    });
  }
  function rascunho(fundo, corpo, chave) {
    var ini = {}, ligado = false;
    function instante() { var o = {}; camposDe(corpo).forEach(function (c) { o[c.id] = valorDe(c); }); return o; }
    setTimeout(function () {
      if (!corpo.isConnected) return;
      var campos = camposDe(corpo); if (!campos.length) return;
      memoria(corpo);
      ini = instante();
      var todos = lerLS(RASC), d = todos[chave], volta = 0;
      if (d && d.t && Date.now() - d.t < RASC_DIAS * 864e5) {
        campos.forEach(function (c) {
          if (d.cur && d.cur[c.id] !== undefined && d.ini && d.ini[c.id] === ini[c.id] && d.cur[c.id] !== ini[c.id]) { porValor(c, d.cur[c.id]); volta++; }
        });
      }
      if (volta) {
        var av = document.createElement("div"); av.className = "aviso";
        av.innerHTML = '📝 Recuperei o que você tinha preenchido antes. <button type="button" class="peq">Descartar</button>';
        corpo.insertBefore(av, corpo.firstChild);
        av.querySelector("button").onclick = function () { campos.forEach(function (c) { if (ini[c.id] !== undefined && valorDe(c) !== ini[c.id]) porValor(c, ini[c.id]); }); tirarRasc(chave); av.remove(); };
      }
      ligado = true;
    }, 250);
    function guardar() {
      if (!ligado) return;
      var cur = instante(), mudou = Object.keys(cur).some(function (k) { return cur[k] !== ini[k]; });
      var o = lerLS(RASC);
      if (!mudou) { if (o[chave]) { delete o[chave]; gravarLS(RASC, o); } return; }
      o[chave] = { t: Date.now(), ini: ini, cur: cur };
      var ks = Object.keys(o).sort(function (a, b) { return o[b].t - o[a].t; });
      ks.slice(30).forEach(function (k) { delete o[k]; });
      gravarLS(RASC, o);
    }
    fundo.addEventListener("input", guardar); fundo.addEventListener("change", guardar);
  }

  // Janela (modal). Devolve { el, fechar }.
  function janela(html, op) {
    op = op || {};
    var fundo = document.createElement("div");
    fundo.className = "fundo-modal";
    fundo.innerHTML = '<div class="modal ' + (op.larga ? "larga" : "") + '" role="dialog" aria-modal="true">' +
      '<div class="cab"><h2>' + esc(op.titulo || "") + '</h2><button class="fechar" aria-label="Fechar">✕</button></div>' +
      '<div class="corpo">' + html + "</div></div>";
    document.body.appendChild(fundo);
    document.body.style.overflow = "hidden";
    var fechado = false, chaveR = "j:" + String(op.titulo || "").trim();
    if (op.titulo && !op.semRascunho) rascunho(fundo, $(".corpo", fundo), chaveR);
    function fecharPeloApp() { tirarRasc(chaveR); fechar(); }   // salvou ou cancelou: o rascunho some
    function fechar() {
      if (fechado) return;
      fechado = true;
      fundo.remove();
      if (!$(".fundo-modal")) document.body.style.overflow = "";
      document.removeEventListener("keydown", tecla);
      if (op.aoFechar) op.aoFechar();
    }
    function tecla(ev) { if (ev.key === "Escape" && fundo === $$(".fundo-modal").pop()) fechar(); }
    document.addEventListener("keydown", tecla);
    $(".fechar", fundo).onclick = fechar;
    // fecha ao clicar FORA da janela — mas não ao usar a barra de rolagem (ela é parte do fundo) nem ao arrastar
    // a seleção de dentro para fora: o clique tem de começar e terminar no fundo
    var comecouFora = false;
    fundo.addEventListener("mousedown", function (ev) { comecouFora = ev.target === fundo && ev.clientX < fundo.clientWidth && ev.clientY < fundo.clientHeight; });
    fundo.addEventListener("click", function (ev) { if (comecouFora && ev.target === fundo && !op.fixa) fechar(); comecouFora = false; });
    return { el: $(".corpo", fundo), fechar: fecharPeloApp };
  }

  function confirmar(msg) { return window.confirm(msg); }

  function ocupado(botao, sim, textoOcupado) {
    if (!botao) return;
    if (sim) {
      botao.dataset.textoOriginal = botao.innerHTML;
      botao.disabled = true;
      botao.innerHTML = '<span class="carregando"></span> ' + esc(textoOcupado || "Aguarde...");
    } else {
      botao.disabled = false;
      if (botao.dataset.textoOriginal !== undefined) botao.innerHTML = botao.dataset.textoOriginal;
    }
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  }

  function configurado() { return !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY); }
  function cliente(op) {
    if (!window.supabase || !window.supabase.createClient) throw new Error("Não foi possível carregar o sistema. Verifique a internet e recarregue a página.");
    return window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, op || {});
  }
  function telaSemConfig(alvo) {
    alvo.innerHTML = '<div class="entrada"><div class="marca-g">AGE</div><div class="cartao"><h2>Falta configurar</h2>' +
      '<p>Abra o arquivo <b>servicos/config.js</b> e preencha <b>SUPABASE_URL</b> e <b>SUPABASE_ANON_KEY</b>. ' +
      "O passo a passo está no arquivo <b>servicos/LEIA-ME.md</b>.</p></div></div>";
  }

  // Reduz a foto, carimba data/hora/GPS e devolve um JPEG (Blob).
  function carregarImagem(arquivo) {
    if (window.createImageBitmap) {
      return createImageBitmap(arquivo, { imageOrientation: "from-image" }).catch(function () { return carregarPorImg(arquivo); });
    }
    return carregarPorImg(arquivo);
  }
  function carregarPorImg(arquivo) {
    return new Promise(function (ok, falha) {
      var url = URL.createObjectURL(arquivo), img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); ok(img); };
      img.onerror = function () { URL.revokeObjectURL(url); falha(new Error("Não consegui abrir esta foto. Tire outra.")); };
      img.src = url;
    });
  }
  function prepararFoto(arquivo, linhas, maximo) {
    maximo = maximo || 1600;
    return carregarImagem(arquivo).then(function (img) {
      var w = img.width, h = img.height, k = Math.min(1, maximo / Math.max(w, h));
      w = Math.round(w * k); h = Math.round(h * k);
      var cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      var cx = cv.getContext("2d");
      cx.drawImage(img, 0, 0, w, h);
      if (img.close) img.close();
      linhas = (linhas || []).filter(Boolean);
      if (linhas.length) {
        var fs = Math.max(14, Math.round(Math.min(w, h) / 30)), pad = Math.round(fs * 0.5), alt = linhas.length * fs * 1.3 + pad * 2;
        cx.fillStyle = "rgba(0,0,0,0.6)";
        cx.fillRect(0, h - alt, w, alt);
        cx.fillStyle = "#fff";
        cx.textBaseline = "top";
        linhas.forEach(function (l, i) {
          cx.font = (i === 0 ? "bold " : "") + fs + "px sans-serif";
          cx.fillText(l, pad, h - alt + pad + i * fs * 1.3, w - pad * 2);
        });
      }
      return new Promise(function (ok, falha) {
        cv.toBlob(function (b) { b ? ok(b) : falha(new Error("Falha ao preparar a foto.")); }, "image/jpeg", 0.82);
      });
    });
  }

  // ---------- app instalável (Android e notebook) ----------
  var pedidoInstalar = null, botoesInstalar = [];
  function instalado() {
    return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  }
  function atualizarBotoesInstalar() {
    botoesInstalar = botoesInstalar.filter(function (b) { return document.body.contains(b); });
    botoesInstalar.forEach(function (b) { b.classList.toggle("oculto", !pedidoInstalar || instalado()); });
  }
  window.addEventListener("beforeinstallprompt", function (ev) { ev.preventDefault(); pedidoInstalar = ev; atualizarBotoesInstalar(); });
  window.addEventListener("appinstalled", function () { pedidoInstalar = null; atualizarBotoesInstalar(); avisar("App instalado", "ok"); });
  function ligarInstalar(botao) {
    if (!botao) return;
    botoesInstalar.push(botao);
    botao.onclick = function () {
      if (!pedidoInstalar) return;
      pedidoInstalar.prompt();
      pedidoInstalar.userChoice.then(function () { pedidoInstalar = null; atualizarBotoesInstalar(); });
    };
    atualizarBotoesInstalar();
  }
  var seguro = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if ("serviceWorker" in navigator && seguro) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(function (reg) {
        // procura versão nova ao voltar para o app e a cada 15 minutos (o app instalado fica aberto por dias)
        if (!reg) return;   // navegador sem service worker liberado
        var procurar = function () { reg.update().catch(function () { /* sem internet */ }); };
        setInterval(procurar, 15 * 60000);
        document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") procurar(); });
      }).catch(function () { /* segue sem modo app */ });
      // versão nova assumiu: recarrega sozinho (sem atrapalhar uma janela aberta ou quem está digitando)
      var tinha = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener("controllerchange", function () {
        if (!tinha) { tinha = true; return; }   // primeira vez que o app é aberto: nada a recarregar
        avisar("Nova versão do app: atualizando...");
        var tentar = function () {
          var a = document.activeElement;
          if (!document.querySelector(".fundo-modal") && !(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) location.reload();
          else setTimeout(tentar, 5000);
        };
        setTimeout(tentar, 1500);
      });
    });
  }

  // ---------- WhatsApp ----------
  // No celular o link wa.me abre direto no WhatsApp. No computador, o app do WhatsApp
  // para Windows às vezes abre sem a conversa; então oferecemos WhatsApp Web, o app
  // e "copiar a mensagem".
  var CELULAR = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
  function escolherZap(url) {
    var u = new URL(url), fone = u.pathname.replace(/\D/g, ""), texto = u.searchParams.get("text") || "";
    var qs = "phone=" + fone + "&text=" + encodeURIComponent(texto);
    var vis = fone.length >= 12 ? "(" + fone.slice(2, 4) + ") " + fone.slice(4, fone.length - 4) + "-" + fone.slice(-4) : fone;
    var j = janela('<p>Mensagem para <b>' + esc(vis) + '</b>. Escolha como enviar:</p>' +
      '<div class="acoes" style="flex-direction:column">' +
      '<a class="botao zap" id="zap-web" target="_blank" rel="noopener" href="https://web.whatsapp.com/send?' + esc(qs) + '">💻 WhatsApp Web (no navegador)</a>' +
      '<a class="botao" id="zap-app" href="whatsapp://send?' + esc(qs) + '">🟢 App do WhatsApp do computador</a>' +
      '<button id="zap-copiar">📋 Copiar a mensagem</button></div>' +
      '<p class="mudo peq" style="margin-top:10px">Se o app do WhatsApp abrir sem a conversa: deixe o WhatsApp aberto e clique de novo, ou use o WhatsApp Web.</p>' +
      '<details class="peq"><summary>Ver a mensagem</summary><pre style="white-space:pre-wrap;font:inherit;margin:6px 0 0">' + esc(texto) + "</pre></details>",
      { titulo: "Enviar pelo WhatsApp" });
    $("#zap-web", j.el).addEventListener("click", function () { setTimeout(j.fechar, 300); });
    $("#zap-app", j.el).addEventListener("click", function () { setTimeout(j.fechar, 300); });
    $("#zap-copiar", j.el).onclick = function () {
      var feito = function () { avisar("Mensagem copiada. Abra a conversa no WhatsApp e cole (Ctrl+V).", "ok"); j.fechar(); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(feito, function () { window.prompt("Copie a mensagem:", texto); });
      else window.prompt("Copie a mensagem:", texto);
    };
  }
  // 📤 Compartilhar: abre a lista do celular (WhatsApp, Telegram, e-mail...) com texto e fotos.
  // No computador sem essa lista, abre o WhatsApp com o texto. Devolve true se abriu.
  function compartilhar(d) {
    var dados = { title: d.titulo || "", text: d.texto || "" }, arqs = d.arquivos || [];
    var comArq = false;
    try { comArq = !!(arqs.length && navigator.canShare && navigator.canShare({ files: arqs })); } catch (e) { comArq = false; }
    if (comArq) dados.files = arqs;
    if (!navigator.share) { abrirZap("https://wa.me/?text=" + encodeURIComponent(dados.text)); return Promise.resolve(true); }
    return navigator.share(dados).then(function () { return true; }, function (e) {
      if (e && e.name === "AbortError") return false;     // a pessoa fechou a lista
      // o celular pede um toque novo quando as fotos demoram a baixar
      return new Promise(function (ok) {
        var j = janela('<p>Pronto' + (dados.files ? " (" + dados.files.length + " foto" + (dados.files.length > 1 ? "s" : "") + ")" : "") + '. Toque para escolher o WhatsApp ou outro app.</p>' +
          '<div class="acoes"><button class="prim" id="cp-ir">📤 Compartilhar</button><button id="cp-zap">WhatsApp (só o texto)</button></div>', { titulo: "Compartilhar" });
        $("#cp-ir", j.el).onclick = function () { navigator.share(dados).then(function () { j.fechar(); ok(true); }, function () { j.fechar(); ok(false); }); };
        $("#cp-zap", j.el).onclick = function () { j.fechar(); abrirZap("https://wa.me/?text=" + encodeURIComponent(dados.text)); ok(true); };
      });
    });
  }
  // o que chegou pelo "Compartilhar" do Android (o sw.js guarda): { texto, arquivos: [File] } ou null. Apaga depois de ler.
  function lerRecebido() {
    if (!window.caches) return Promise.resolve(null);
    return caches.open("age-recebido").then(function (c) {
      return c.match("recebido/meta").then(function (m) {
        if (!m) return null;
        return m.json().then(function (meta) {
          return Promise.all((meta.arquivos || []).map(function (a, i) {
            return c.match("recebido/f" + i).then(function (r) { return r ? r.blob().then(function (b) { return new File([b], a.nome || "foto" + i + ".jpg", { type: a.tipo || b.type }); }) : null; });
          })).then(function (fs) {
            return caches.delete("age-recebido").then(function () {
              return { texto: [meta.title, meta.text, meta.url].filter(Boolean).join("\n"), arquivos: fs.filter(Boolean), quando: meta.quando };
            });
          });
        });
      });
    }).catch(function () { return null; });
  }
  // abre um link wa.me (usado quando o link não é um botão <a>)
  function abrirZap(url) {
    if (CELULAR) { var w = window.open(url, "_blank"); if (!w) location.href = url; }
    else escolherZap(url);
  }
  if (!CELULAR) document.addEventListener("click", function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href^="https://wa.me/"]') : null;
    if (!a || ev.button !== 0 || ev.ctrlKey || ev.metaKey) return;
    ev.preventDefault();
    escolherZap(a.href);
  }, true);

  // ZIP (ex.: "Exportar conversa"/várias fotos do WhatsApp): abre e devolve as fotos, PDFs e XMLs de dentro; os outros arquivos passam direto
  var JSZIP = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js", zipPronto = null;
  function ehZip(f) { return /zip/i.test(f.type || "") || /\.zip$/i.test(f.name || ""); }
  function carregarZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    if (!zipPronto) zipPronto = new Promise(function (ok, falha) {
      var sc = document.createElement("script"); sc.src = JSZIP;
      sc.onload = function () { if (window.JSZip) ok(window.JSZip); else { zipPronto = null; falha(new Error("Não consegui abrir o ZIP.")); } };
      sc.onerror = function () { zipPronto = null; sc.remove(); falha(new Error("Sem internet para abrir o ZIP. Tente de novo.")); };
      document.head.appendChild(sc);
    });
    return zipPronto;
  }
  var TIPOS_ZIP = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", pdf: "application/pdf", xml: "text/xml" };
  function abrirZips(arquivos) {
    var fs = Array.prototype.slice.call(arquivos || []);
    if (!fs.some(ehZip)) return Promise.resolve(fs);
    return carregarZip().then(function (JSZip) {
      return Promise.all(fs.map(function (f) {
        if (!ehZip(f)) return [f];
        return JSZip.loadAsync(f).then(function (z) {
          var nomes = Object.keys(z.files).filter(function (n) { var e = n.split(".").pop().toLowerCase(); return !z.files[n].dir && !/(^|\/)(__MACOSX|\.)/.test(n) && TIPOS_ZIP[e]; }).sort();
          return Promise.all(nomes.map(function (n) {
            return z.files[n].async("blob").then(function (b) { var e = n.split(".").pop().toLowerCase(); return new File([b], n.split("/").pop(), { type: TIPOS_ZIP[e] }); });
          }));
        });
      })).then(function (ls) { return [].concat.apply([], ls); });
    });
  }

  window.AGE = {
    ligarInstalar: ligarInstalar, abrirZips: abrirZips, ehZip: ehZip,
    CFG: CFG, CATEG: CATEG, AREA: AREA, STATUS: STATUS, TIPO_PONTO: TIPO_PONTO,
    esc: esc, $: $, $$: $$, data: data, hora: hora, dataHora: dataHora, dataSimples: dataSimples, isoLocal: isoLocal,
    inicioDia: inicioDia, duracao: duracao, dinheiro: dinheiro, numero: numero, lerNumero: lerNumero, soDigitos: soDigitos,
    linkZap: linkZap, abrirZap: abrirZap, compartilhar: compartilhar, lerRecebido: lerRecebido, linkMapa: linkMapa, linkEndereco: linkEndereco, seloCategoria: seloCategoria, seloStatus: seloStatus,
    avisar: avisar, msgErro: msgErro, janela: janela, confirmar: confirmar, ocupado: ocupado, uuid: uuid,
    configurado: configurado, cliente: cliente, telaSemConfig: telaSemConfig, prepararFoto: prepararFoto
  };
})();
