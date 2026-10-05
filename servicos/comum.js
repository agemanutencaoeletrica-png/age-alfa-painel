// Funções usadas pelo painel do dono e pela página do funcionário.
(function () {
  "use strict";
  var CFG = window.AGE_CONFIG || {};

  var CATEG = {
    eletrica: { nome: "Elétrica", icone: "⚡" },
    pintura: { nome: "Pintura", icone: "🖌️" }
  };
  var AREA = { eletrica: "Elétrica", pintura: "Pintura", ambos: "Elétrica e pintura" };
  var STATUS = { aberto: "Aberto", em_andamento: "Em andamento", concluido: "Concluído", cancelado: "Cancelado" };
  var STATUS_COR = { aberto: "atencao", em_andamento: "", concluido: "bom", cancelado: "critico" };
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
    setTimeout(function () { t.remove(); }, tipo === "erro" ? 6000 : 3200);
  }
  function msgErro(e) {
    if (!e) return "Erro desconhecido.";
    var m = e.message || e.error_description || e.msg || String(e);
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Sem internet ou servidor fora do ar. Tente de novo.";
    if (/JWT|expired/i.test(m)) return "Sua sessão expirou. Entre de novo.";
    return m;
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
    var fechado = false;
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
    fundo.addEventListener("mousedown", function (ev) { if (ev.target === fundo && !op.fixa) fechar(); });
    return { el: $(".corpo", fundo), fechar: fechar };
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
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () { /* segue sem modo app */ }); });
  }

  window.AGE = {
    ligarInstalar: ligarInstalar,
    CFG: CFG, CATEG: CATEG, AREA: AREA, STATUS: STATUS, TIPO_PONTO: TIPO_PONTO,
    esc: esc, $: $, $$: $$, data: data, hora: hora, dataHora: dataHora, dataSimples: dataSimples, isoLocal: isoLocal,
    inicioDia: inicioDia, duracao: duracao, dinheiro: dinheiro, numero: numero, lerNumero: lerNumero, soDigitos: soDigitos,
    linkZap: linkZap, linkMapa: linkMapa, linkEndereco: linkEndereco, seloCategoria: seloCategoria, seloStatus: seloStatus,
    avisar: avisar, msgErro: msgErro, janela: janela, confirmar: confirmar, ocupado: ocupado, uuid: uuid,
    configurado: configurado, cliente: cliente, telaSemConfig: telaSemConfig, prepararFoto: prepararFoto
  };
})();
