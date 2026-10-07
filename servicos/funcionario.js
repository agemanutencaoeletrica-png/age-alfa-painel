// Página do funcionário: aberta pelo link pessoal (…/funcionario.html#t=TOKEN).
// Não mostra preços nem orçamentos: o servidor só devolve os serviços dele.
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var app = $("#app");
  var sb = null, TOKEN = null, D = null;

  var TIPOS_SERVICO = {
    eletrica: ["Instalação de tomadas e interruptores", "Troca de disjuntor", "Montagem de quadro de distribuição", "Instalação de iluminação",
      "Instalação de chuveiro", "Padrão de entrada", "Passagem de fiação", "Manutenção corretiva", "Instalação de ventilador de teto",
      "Aterramento", "Visita técnica / orçamento"],
    pintura: ["Pintura interna", "Pintura externa", "Massa corrida", "Textura / grafiato", "Pintura de portões e grades", "Verniz em madeira",
      "Impermeabilização", "Tratamento de infiltração / mofo", "Pintura de piso", "Visita técnica / orçamento"]
  };
  var MATERIAIS = {
    eletrica: ["Fio 1,5 mm", "Fio 2,5 mm", "Fio 4 mm", "Fio 6 mm", "Fio 10 mm", "Cabo PP", "Disjuntor", "Disjuntor DR", "DPS", "Tomada 10 A",
      "Tomada 20 A", "Interruptor simples", "Interruptor paralelo", "Caixa 4x2", "Eletroduto", "Conduíte", "Quadro de distribuição",
      "Luminária", "Lâmpada LED", "Plafon", "Fita isolante", "Conector", "Haste de aterramento"],
    pintura: ["Tinta acrílica", "Tinta látex PVA", "Esmalte sintético", "Massa corrida", "Massa acrílica", "Selador acrílico",
      "Fundo preparador", "Textura", "Verniz", "Impermeabilizante", "Lixa", "Rolo", "Pincel", "Fita crepe", "Lona plástica",
      "Thinner", "Aguarrás", "Bandeja"]
  };
  var UNIDADES = ["un", "m", "m²", "rolo", "L", "galão", "lata", "balde", "kg", "cx", "pç", "par"];
  var TIPO_PUBLICO = { predio: "Prédio público", iluminacao: "Iluminação pública", obra: "Obra / reforma" };

  function lerToken() {
    var m = /(?:^|[#&?])t=([A-Za-z0-9_-]+)/.exec(location.hash.slice(1) + "&" + location.search.slice(1));
    var t = m ? m[1] : null;
    try {
      if (t) localStorage.setItem("age_token", t);
      else t = localStorage.getItem("age_token");
    } catch (e) { /* navegador sem armazenamento: segue só com o link */ }
    return t;
  }
  function esquecerToken() { try { localStorage.removeItem("age_token"); } catch (e) { /* sem armazenamento */ } }

  function telaMensagem(titulo, texto) {
    app.innerHTML = '<div class="entrada"><div class="marca-g">AGE</div><div class="cartao"><h2>' + esc(titulo) + "</h2><p>" + texto + "</p></div></div>";
  }

  function iniciar() {
    if (!A.configurado()) { A.telaSemConfig(app); return; }
    TOKEN = lerToken();
    if (!TOKEN) {
      telaMensagem("Abra pelo seu link", "Esta página só funciona pelo link pessoal que o responsável enviou para você no WhatsApp.");
      return;
    }
    try {
      sb = A.cliente({ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    } catch (e) { telaMensagem("Sem conexão", esc(A.msgErro(e))); return; }
    carregar();
  }

  function carregar() {
    return sb.rpc("func_dados", { p_token: TOKEN }).then(function (r) {
      if (r.error) throw r.error;
      D = r.data;
      desenhar();
    }).catch(function (e) {
      var m = A.msgErro(e);
      if (/Link inválido/.test(m)) {
        esquecerToken();
        telaMensagem("Link desativado", esc(m));
      } else if (!D) {
        telaMensagem("Não consegui abrir", esc(m) + '<br><br><button class="prim" onclick="location.reload()">Tentar de novo</button>');
      } else {
        A.avisar(m, "erro");
      }
    });
  }

  function servicoPorId(id) {
    for (var i = 0; i < D.servicos.length; i++) if (D.servicos[i].id === id) return D.servicos[i];
    return null;
  }
  function nomeServico(s) {
    return (A.CATEG[s.categoria] || {}).icone + " " + (s.prefeitura ? "🏛️ " + (s.protocolo ? s.protocolo + " · " : "") : "") + s.cliente + (s.endereco ? " — " + s.endereco : "");
  }

  function resumoHoje() {
    var p = D.pontos_hoje || [];
    var ch = p.filter(function (x) { return x.tipo === "chegada"; });
    var ult = p[p.length - 1];
    if (!ch.length) return { texto: "Você ainda não registrou a chegada hoje.", cor: "atencao" };
    if (ult.tipo === "saida") return { texto: "Saída registrada às " + A.hora(ult.criado_em) + ". Bom descanso!", cor: "ok" };
    return { texto: "Trabalhando desde " + A.hora(ch[0].criado_em) + ".", cor: "ok" };
  }

  function desenhar() {
    var f = D.funcionario, hoje = new Date();
    var res = resumoHoje();
    var h = '<div class="topo"><div class="marca">AGE</div><div><div class="nome">Olá, ' + esc(f.nome.split(" ")[0]) + '</div>' +
      '<div class="sub">' + esc(A.AREA[f.area] || "") + " · " + hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" }) + "</div></div>" +
      '<div class="dir"><button class="leve peq oculto" id="b-instalar">📲 Instalar</button><button class="leve peq" id="b-atualizar" aria-label="Atualizar">↻</button></div></div><main>';
    h += '<div class="aviso ' + res.cor + ' estado">' + esc(res.texto) + "</div>";
    h += '<div class="botoes-ponto">' +
      '<button class="bom" data-ponto="chegada"><span class="ic">📍</span>Chegada</button>' +
      '<button class="prim" data-ponto="servico"><span class="ic">📷</span>Foto do serviço</button>' +
      '<button class="perigo" data-ponto="saida"><span class="ic">🏁</span>Saída</button>' +
      '<button data-relatorio=""><span class="ic">📝</span>Relatório e materiais</button></div>';

    (D.rotas || []).forEach(function (r) {
      var G = window.AGE_GEO, paradas = r.paradas || [], links = G.linksGoogle(null, paradas, false);
      h += '<div class="cab-secao" ><h2>🧭 ' + esc(r.nome) + "</h2>" + (r.data ? '<span class="mudo peq">' + A.dataSimples(r.data) + "</span>" : "") + "</div>" +
        '<div class="cartao"><div class="acoes" style="margin-top:0">' + links.map(function (u, k) {
          return '<a class="botao prim" target="_blank" rel="noopener" href="' + esc(u) + '">🗺 Rota completa' + (links.length > 1 ? " (parte " + (k + 1) + ")" : "") + "</a>";
        }).join("") + "</div>" +
        paradas.map(function (p, i) {
          return '<div class="rota-parada"><div class="n">' + (i + 1) + "</div><div><b>" + esc((p.codigo ? (p.tipo === "loja" ? "Loja " : "") + p.codigo + " – " : "") + p.nome) + "</b>" +
            '<div class="peq mudo">' + esc([[p.endereco, p.numero].filter(Boolean).join(", "), p.bairro, p.cidade].filter(Boolean).join(" - ")) + "</div>" +
            '<div class="linha" style="margin-top:6px"><a class="botao peq" target="_blank" rel="noopener" href="' + esc(G.linkNavegar(p)) + '">🧭 Ir (Google Maps)</a>' +
            '<a class="botao peq" target="_blank" rel="noopener" href="' + esc(G.linkWaze(p)) + '">Waze</a></div></div></div>';
        }).join("") + "</div>";
    });

    h += '<div class="cab-secao" style="margin-top:18px"><h2>Meus serviços</h2><span class="mudo peq">' + D.servicos.length + "</span>" +
      '<button class="peq dir" id="b-novo-serv">➕ Serviço não cadastrado</button></div>';
    if (!D.servicos.length) h += '<div class="cartao vazio">Nenhum serviço aberto para você agora.<br>Vai fazer um serviço que não está aqui? Toque em <b>➕ Serviço não cadastrado</b>.</div>';
    D.servicos.forEach(function (s) {
      h += '<div class="cartao"><div class="linha">' + A.seloCategoria(s.categoria) + A.seloStatus(s.status) +
        (s.data_prevista ? '<span class="dir mudo peq">📅 ' + A.dataSimples(s.data_prevista) + "</span>" : "") + "</div>" +
        (s.prefeitura ? '<div class="aviso" style="margin:8px 0 0">🏛️ <b>' + esc(s.prefeitura) + "</b>" + (s.protocolo ? " · OS/Protocolo <b>" + esc(s.protocolo) + "</b>" : "") +
          (s.tipo_publico ? "<br>" + esc(TIPO_PUBLICO[s.tipo_publico] || "") : "") + (s.secretaria ? " · " + esc(s.secretaria) : "") +
          (s.fiscal ? "<br>Fiscal: " + esc(s.fiscal) : "") +
          '<br><span class="peq">Tire fotos de <b>ANTES</b> e de <b>DEPOIS</b> e colha a assinatura do fiscal ao concluir.</span></div>' : "") +
        '<h3 style="margin-top:8px">' + esc(s.cliente) + "</h3>" +
        (s.referencia ? '<div class="peq">🔖 ' + esc(s.referencia) + "</div>" : "") +
        (s.endereco ? '<div class="peq"><a href="' + A.linkEndereco(s.endereco) + '" target="_blank" rel="noopener">📍 ' + esc(s.endereco) + "</a></div>" : "") +
        (s.telefone ? '<div class="peq"><a href="tel:' + esc(A.soDigitos(s.telefone)) + '">📞 ' + esc(s.telefone) + "</a></div>" : "") +
        (s.descricao ? '<p style="white-space:pre-wrap;margin:8px 0 0">' + esc(s.descricao) + "</p>" : "") +
        (s.observacoes && !/^Criado por .* pelo app$/.test(s.observacoes) ? '<p class="mudo peq" style="white-space:pre-wrap;margin:6px 0 0">Obs.: ' + esc(s.observacoes) + "</p>" : "") +
        '<div class="acoes"><button class="peq" data-ponto="chegada" data-serv="' + s.id + '">📍 Cheguei aqui</button>' +
        '<button class="peq" data-ponto="servico" data-serv="' + s.id + '">📷 Foto</button>' +
        '<button class="peq" data-relatorio="' + s.id + '">📝 Relatório</button></div></div>';
    });

    h += '<div class="cab-secao" style="margin-top:18px"><h2>Registros de hoje</h2></div><div class="cartao">';
    if (!D.pontos_hoje.length) h += '<div class="vazio">Nada registrado hoje.</div>';
    D.pontos_hoje.slice().reverse().forEach(function (p) {
      var s = p.servico_id ? servicoPorId(p.servico_id) : null;
      h += '<div class="linha" style="padding:6px 0;border-bottom:1px solid var(--borda)"><b>' + A.hora(p.criado_em) + "</b> " +
        esc(A.TIPO_PONTO[p.tipo]) + (s ? ' <span class="mudo peq">· ' + esc(s.cliente) + "</span>" : "") +
        (p.tem_gps ? "" : ' <span class="selo critico dir">sem GPS</span>') + "</div>";
    });
    h += '</div><p class="mudo mini" style="text-align:center">A hora do registro é a do servidor da AGE. As fotos vão direto para o responsável.</p></main>';
    app.innerHTML = h;

    A.ligarInstalar($("#b-instalar"));
    $("#b-atualizar").onclick = function () { carregar().then(function () { A.avisar("Atualizado"); }); };
    $("#b-novo-serv").onclick = function () { novoServico(null); };
    $$("[data-ponto]").forEach(function (b) { b.onclick = function () { fluxoPonto(b.dataset.ponto, b.dataset.serv || null); }; });
    $$("[data-relatorio]").forEach(function (b) { b.onclick = function () { fluxoRelatorio(b.dataset.relatorio || null); }; });
  }

  function opcoesServico(selecionado, comVazio) {
    var h = comVazio ? '<option value="">Sem serviço específico</option>' : "";
    D.servicos.forEach(function (s) {
      h += '<option value="' + s.id + '"' + (s.id === selecionado ? " selected" : "") + ">" + esc(nomeServico(s)) + "</option>";
    });
    return h;
  }

  // ---------- Registro de ponto (chegada / foto do serviço / saída) ----------
  function fluxoPonto(tipo, servicoId) {
    var nomeTipo = { chegada: "chegada", servico: "foto do serviço", saida: "saída" }[tipo];
    if (!servicoId && D.pontos_hoje.length) {
      // sugere o último serviço em que ele registrou algo hoje
      for (var i = D.pontos_hoje.length - 1; i >= 0; i--) {
        if (D.pontos_hoje[i].servico_id && servicoPorId(D.pontos_hoje[i].servico_id)) { servicoId = D.pontos_hoje[i].servico_id; break; }
      }
    }
    if (!servicoId && D.servicos.length === 1) servicoId = D.servicos[0].id;
    var aberto = Date.now(), melhor = null, vigia = null, foto = null;

    var j = A.janela(
      (tipo === "saida" && !D.pontos_hoje.some(function (p) { return p.tipo === "chegada"; }) ?
        '<div class="aviso">Você não registrou a chegada hoje. Se esqueceu, avise o responsável.</div>' : "") +
      "<label for=\"fp-serv\">Serviço</label><select id=\"fp-serv\">" + opcoesServico(servicoId, true) + "</select>" +
      '<button class="texto peq" id="fp-novo">➕ Não está na lista? Cadastrar o serviço</button>' +
      '<div id="fp-gps" class="aviso">📡 Procurando sua localização...</div>' +
      '<button class="texto peq" id="fp-gps-de-novo">↻ Tentar localização de novo</button>' +
      '<label for="fp-obs">Observação (opcional)</label><textarea id="fp-obs" rows="2" maxlength="1000" placeholder="Ex.: cliente pediu para voltar amanhã"></textarea>' +
      '<input type="file" accept="image/*" capture="environment" id="fp-arq" class="oculto">' +
      '<div id="fp-prev" class="previa"></div><div id="fp-erro"></div>' +
      '<div class="acoes"><button class="prim grande" id="fp-foto">📷 Tirar foto</button>' +
      '<button class="bom grande oculto" id="fp-enviar">✔ Enviar ' + esc(nomeTipo) + "</button></div>",
      { titulo: "Registrar " + nomeTipo, fixa: true, aoFechar: pararGps });
    var el = j.el;

    function mostrarGps(estado, erro) {
      var c = $("#fp-gps", el);
      if (!c) return;
      if (estado === "ok") {
        c.className = "aviso ok";
        c.textContent = "📍 Localização encontrada (precisão de " + Math.round(melhor.coords.accuracy) + " m)";
      } else if (estado === "erro") {
        c.className = "aviso erro";
        c.textContent = erro && erro.code === 1 ?
          "⚠ A localização está bloqueada. Libere a localização para este site nas configurações do navegador e toque em “Tentar de novo”." :
          "⚠ Não achei o GPS. Ligue a localização do celular, vá para uma área aberta e toque em “Tentar de novo”.";
      } else if (estado === "sem") {
        c.className = "aviso erro";
        c.textContent = "⚠ Este celular não informa a localização.";
      } else {
        c.className = "aviso";
        c.textContent = "📡 Procurando sua localização...";
      }
    }
    function iniciarGps() {
      pararGps();
      if (!navigator.geolocation) { mostrarGps("sem"); return; }
      mostrarGps(melhor ? "ok" : "procurando");
      vigia = navigator.geolocation.watchPosition(function (p) {
        if (p.timestamp && p.timestamp < aberto - 5000) return;
        if (!melhor || p.coords.accuracy <= melhor.coords.accuracy) melhor = p;
        mostrarGps("ok");
      }, function (e) { if (!melhor) mostrarGps("erro", e); }, { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 });
    }
    function pararGps() { if (vigia !== null && navigator.geolocation) navigator.geolocation.clearWatch(vigia); vigia = null; }
    iniciarGps();
    $("#fp-gps-de-novo", el).onclick = iniciarGps;
    $("#fp-novo", el).onclick = function () {
      novoServico(function (id) {
        var sel = $("#fp-serv", el);
        if (sel) { sel.innerHTML = opcoesServico(id, true); sel.value = id; }
      });
    };

    var arq = $("#fp-arq", el);
    $("#fp-foto", el).onclick = function () { arq.value = ""; arq.click(); };
    arq.onchange = function () {
      var f = arq.files && arq.files[0];
      $("#fp-erro", el).innerHTML = "";
      if (!f) return;
      if (f.lastModified > 0 && Date.now() - f.lastModified > 15 * 60 * 1000) {
        $("#fp-erro", el).innerHTML = '<div class="aviso erro">Esta foto é antiga. Tire a foto agora, na hora do registro.</div>';
        return;
      }
      var quando = new Date(), pos = melhor, s = servicoPorId($("#fp-serv", el).value);
      var linhas = [
        "AGE ELÉTRICA E PINTURA · " + A.TIPO_PONTO[tipo].toUpperCase(),
        D.funcionario.nome + " · " + quando.toLocaleString("pt-BR"),
        pos ? "GPS " + pos.coords.latitude.toFixed(6) + ", " + pos.coords.longitude.toFixed(6) + " (±" + Math.round(pos.coords.accuracy) + " m)" : "SEM GPS",
        s ? (s.protocolo ? "OS " + s.protocolo + " · " : "") + s.cliente : ""
      ];
      var bFoto = $("#fp-foto", el);
      A.ocupado(bFoto, true, "Preparando foto...");
      A.prepararFoto(f, linhas).then(function (blob) {
        if (foto && foto.url) URL.revokeObjectURL(foto.url);
        foto = { blob: blob, url: URL.createObjectURL(blob), pos: pos, quando: quando, caminho: null, enviada: false };
        $("#fp-prev", el).innerHTML = '<img alt="Foto do registro" src="' + foto.url + '">';
        A.ocupado(bFoto, false);
        bFoto.innerHTML = "📷 Tirar outra";
        bFoto.className = "grande";
        $("#fp-enviar", el).classList.remove("oculto");
      }).catch(function (e) {
        A.ocupado(bFoto, false);
        $("#fp-erro", el).innerHTML = '<div class="aviso erro">' + esc(A.msgErro(e)) + "</div>";
      });
    };

    $("#fp-enviar", el).onclick = function () {
      if (!foto) return;
      if (!foto.pos && !A.confirmar("Sem localização GPS. Enviar mesmo assim? O responsável verá o aviso “sem GPS”.")) return;
      var b = this;
      A.ocupado(b, true, "Enviando...");
      if (!foto.caminho) foto.caminho = TOKEN + "/" + A.isoLocal(foto.quando) + "/" + A.uuid() + ".jpg";
      enviarFoto(foto).then(function () {
        return sb.rpc("registrar_ponto", {
          p_token: TOKEN, p_tipo: tipo, p_foto: foto.caminho,
          p_servico_id: $("#fp-serv", el).value || null,
          p_lat: foto.pos ? foto.pos.coords.latitude : null,
          p_lng: foto.pos ? foto.pos.coords.longitude : null,
          p_precisao: foto.pos ? foto.pos.coords.accuracy : null,
          p_capturado_em: foto.quando.toISOString(),
          p_observacao: $("#fp-obs", el).value || null
        });
      }).then(function (r) {
        if (r.error) throw r.error;
        j.fechar();
        A.avisar(A.TIPO_PONTO[tipo] + " registrada às " + A.hora(r.data.criado_em), "ok");
        carregar();
      }).catch(function (e) {
        A.ocupado(b, false);
        b.innerHTML = "↻ Tentar enviar de novo";
        $("#fp-erro", el).innerHTML = '<div class="aviso erro">' + esc(A.msgErro(e)) + "</div>";
      });
    };
  }

  // Envia a foto para a pasta do funcionário. Se já tinha subido numa
  // tentativa anterior (erro de rede no meio), segue em frente.
  function enviarFoto(foto) {
    if (foto.enviada) return Promise.resolve();
    return sb.storage.from("fotos").upload(foto.caminho, foto.blob, { contentType: "image/jpeg", upsert: false }).then(function (r) {
      if (r.error && !/exist|duplicate/i.test(r.error.message || "") && String(r.error.statusCode) !== "409") throw r.error;
      foto.enviada = true;
    });
  }

  // ---------- Quadro de assinatura (dedo ou caneta na tela) ----------
  function quadroAssinatura(cv, aoMudar) {
    var cx = cv.getContext("2d"), tracos = [], atual = null;
    function ajustar() {
      var r = cv.getBoundingClientRect(), k = window.devicePixelRatio || 1;
      if (!r.width) return;
      cv.width = Math.round(r.width * k); cv.height = Math.round(r.height * k);
      cx.setTransform(k, 0, 0, k, 0, 0);
      redesenhar();
    }
    function redesenhar() {
      var r = cv.getBoundingClientRect();
      cx.clearRect(0, 0, r.width, r.height);
      cx.lineWidth = 2.6; cx.lineCap = "round"; cx.lineJoin = "round"; cx.strokeStyle = "#0d1b33";
      tracos.forEach(function (t) {
        cx.beginPath();
        t.forEach(function (p, i) { if (i) cx.lineTo(p[0], p[1]); else cx.moveTo(p[0], p[1]); });
        if (t.length === 1) cx.lineTo(t[0][0] + 0.1, t[0][1] + 0.1);
        cx.stroke();
      });
    }
    function ponto(ev) { var r = cv.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; }
    cv.addEventListener("pointerdown", function (ev) {
      ev.preventDefault();
      if (cv.setPointerCapture) cv.setPointerCapture(ev.pointerId);
      atual = [ponto(ev)]; tracos.push(atual); redesenhar();
    });
    cv.addEventListener("pointermove", function (ev) { if (!atual) return; ev.preventDefault(); atual.push(ponto(ev)); redesenhar(); });
    function soltar() { if (atual) { atual = null; aoMudar(tracos.length === 0); } }
    cv.addEventListener("pointerup", soltar); cv.addEventListener("pointercancel", soltar); cv.addEventListener("pointerleave", soltar);
    window.addEventListener("resize", ajustar);
    setTimeout(ajustar, 0);
    return {
      ajustar: ajustar,
      vazio: function () { return !tracos.some(function (t) { return t.length > 1; }); },
      limpar: function () { tracos = []; redesenhar(); aoMudar(true); },
      // imagem JPEG (fundo branco) com o carimbo de quem assinou e quando
      paraJpeg: function (linhas) {
        var r = cv.getBoundingClientRect(), esc2 = Math.max(1, 900 / r.width), w = Math.round(r.width * esc2), hA = Math.round(r.height * esc2);
        var fs = 22, hT = linhas.length * fs * 1.4 + 16, out = document.createElement("canvas");
        out.width = w; out.height = hA + hT;
        var c = out.getContext("2d");
        c.fillStyle = "#fff"; c.fillRect(0, 0, w, out.height);
        c.scale(esc2, esc2);
        c.lineWidth = 2.6; c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = "#0d1b33";
        tracos.forEach(function (t) { c.beginPath(); t.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.stroke(); });
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.strokeStyle = "#c9ced6"; c.lineWidth = 2; c.beginPath(); c.moveTo(20, hA - 30); c.lineTo(w - 20, hA - 30); c.stroke();
        c.fillStyle = "#f1f3f6"; c.fillRect(0, hA, w, hT);
        c.fillStyle = "#222"; c.textBaseline = "top";
        linhas.forEach(function (l, i) { c.font = (i ? "" : "bold ") + fs + "px sans-serif"; c.fillText(l, 12, hA + 8 + i * fs * 1.4, w - 24); });
        return new Promise(function (ok, falha) { out.toBlob(function (b) { b ? ok(b) : falha(new Error("Falha ao preparar a assinatura.")); }, "image/jpeg", 0.9); });
      }
    };
  }

  // ---------- Serviço que não estava cadastrado ----------
  // O funcionário cria o serviço pelo app; no painel ele aparece marcado "criado pela equipe".
  function novoServico(depois, aviso) {
    var area = D.funcionario.area === "pintura" ? "pintura" : "eletrica";
    var j = A.janela((aviso ? '<div class="aviso">' + esc(aviso) + "</div>" : "") +
      '<label for="ns-cat">Tipo de serviço</label><select id="ns-cat"><option value="eletrica">⚡ Elétrica</option><option value="pintura">🖌️ Pintura</option></select>' +
      '<label for="ns-loja">Nº da loja (se for loja da rede)</label><input id="ns-loja" inputmode="numeric" maxlength="10" placeholder="Ex.: 236">' +
      '<p class="mudo peq" style="margin:4px 0 0">Com o nº da loja, o nome e o endereço entram sozinhos.</p>' +
      '<label for="ns-cli">Cliente (se não for loja)</label><input id="ns-cli" maxlength="200" placeholder="Ex.: Casa do Sr. João">' +
      '<label for="ns-end">Endereço</label><input id="ns-end" maxlength="300" placeholder="Rua, número, bairro, cidade">' +
      '<label for="ns-desc">O que vai ser feito *</label><textarea id="ns-desc" rows="3" maxlength="2000" placeholder="Ex.: Instalação de interruptor"></textarea>' +
      '<div id="ns-erro"></div><div class="acoes"><button class="bom grande" id="ns-ok">✔ Cadastrar serviço</button></div>',
      { titulo: "Serviço não cadastrado", fixa: true });
    var el = j.el;
    $("#ns-cat", el).value = area;
    $("#ns-ok", el).onclick = function () {
      var b = this, loja = $("#ns-loja", el).value.trim(), cli = $("#ns-cli", el).value.trim(), desc = $("#ns-desc", el).value.trim();
      var erro = function (m) { $("#ns-erro", el).innerHTML = '<div class="aviso erro">' + esc(m) + "</div>"; };
      if (!loja && !cli) { erro("Escreva o nº da loja ou o nome do cliente."); return; }
      if (!desc) { erro("Escreva o que vai ser feito."); return; }
      A.ocupado(b, true, "Cadastrando...");
      sb.rpc("criar_servico_func", {
        p_token: TOKEN, p_categoria: $("#ns-cat", el).value, p_descricao: desc,
        p_cliente: cli || null, p_endereco: $("#ns-end", el).value.trim() || null, p_loja_codigo: loja || null
      }).then(function (r) {
        if (r.error) throw r.error;
        return carregar().then(function () {
          j.fechar();
          A.avisar("Serviço cadastrado. O responsável já consegue ver.", "ok");
          if (depois) depois(r.data.id);
        });
      }).catch(function (e) { A.ocupado(b, false); erro(A.msgErro(e)); });
    };
  }

  // ---------- Relatório do serviço e lista de materiais ----------
  function fluxoRelatorio(servicoId) {
    if (!D.servicos.length) {
      novoServico(function (id) { fluxoRelatorio(id); }, "Para enviar o relatório, primeiro diga qual é o serviço.");
      return;
    }
    if (!servicoId) servicoId = D.servicos[0].id;
    var fotos = [];
    var j = A.janela(
      '<label for="fr-serv">Serviço</label><select id="fr-serv">' + opcoesServico(servicoId, false) + "</select>" +
      '<label for="fr-tipo">Tipo de serviço</label><input id="fr-tipo" list="fr-tipos" maxlength="200" placeholder="Escolha ou escreva"><datalist id="fr-tipos"></datalist>' +
      '<label for="fr-desc">O que foi feito / o que precisa ser feito</label>' +
      '<textarea id="fr-desc" rows="4" maxlength="5000" placeholder="Descreva o serviço, medidas (m², metros de fio, número de pontos), problemas encontrados..."></textarea>' +
      '<label id="fr-mats-r">Materiais necessários</label><div id="fr-mats"></div><datalist id="fr-dl-mat"></datalist>' +
      '<button class="peq" id="fr-mais">+ Adicionar material</button>' +
      '<div id="fr-antes-caixa" class="oculto"><label>🏛️ Fotos ANTES do serviço (até 6)</label><input type="file" accept="image/*" multiple id="fr-arq-antes" class="oculto">' +
      '<div class="fotos" id="fr-fotos-antes"></div><button class="peq" id="fr-add-antes" style="margin-top:8px">📷 Fotos de ANTES</button>' +
      '<div id="fr-antes-ok" class="mudo peq oculto" style="margin-top:4px">✔ As fotos de antes já foram enviadas num relatório anterior.</div></div>' +
      '<label id="fr-fotos-r">Fotos (até 6)</label><input type="file" accept="image/*" multiple id="fr-arq" class="oculto">' +
      '<div class="fotos" id="fr-fotos"></div><button class="peq" id="fr-add-foto" style="margin-top:8px">📷 Adicionar fotos</button>' +
      '<label class="marca-linha"><input type="checkbox" id="fr-concl"> Serviço concluído</label>' +
      '<div id="fr-assin-aviso" class="aviso oculto" style="margin-top:8px">✍️ Este serviço pede a <b>assinatura do responsável</b> no local.</div>' +
      '<button class="peq oculto" id="fr-assin-opc" style="margin-top:8px">✍️ Coletar assinatura (opcional)</button>' +
      '<div id="fr-assin" class="cartao oculto" style="margin-top:10px">' +
      '<h3 id="fr-assin-tit">✍️ Assinatura do responsável no local</h3><p class="mudo peq" id="fr-assin-txt" style="margin:4px 0 8px">Peça ao gerente (ou ao cliente) para assinar com o dedo.</p>' +
      '<div class="quadro-assin"><canvas id="fr-canvas" aria-label="Quadro de assinatura"></canvas><span class="linha-assin">assine aqui</span></div>' +
      '<div class="linha" style="margin-top:6px"><button class="peq" id="fr-limpar">↺ Limpar</button><span class="mudo mini dir" id="fr-assin-status"></span></div>' +
      '<label for="fr-assin-nome">Nome de quem assinou</label><input id="fr-assin-nome" maxlength="120" placeholder="Ex.: Carlos (gerente da loja)">' +
      '<label class="marca-linha" id="fr-sem-assin-l" style="font-weight:400"><input type="checkbox" id="fr-sem-assin"> <span id="fr-sem-assin-t">Responsável não está no local (enviar sem assinatura)</span></label></div>' +
      '<div id="fr-erro"></div><div class="acoes"><button class="bom grande" id="fr-enviar">✔ Enviar relatório</button></div>',
      { titulo: "Relatório e materiais", fixa: true });
    var el = j.el;

    // OS de prefeitura: itens do contrato (sem preço) entram primeiro na lista de materiais
    function itensContrato(s) { return (s && s.contrato_id && (D.itens_contrato || {})[s.contrato_id]) || []; }
    function ehPref() { var s = servicoPorId($("#fr-serv", el).value); return !!(s && s.prefeitura); }
    function atualizarListas() {
      var s = servicoPorId($("#fr-serv", el).value), c = s ? s.categoria : "eletrica", pref = !!(s && s.prefeitura);
      $("#fr-tipos", el).innerHTML = TIPOS_SERVICO[c].map(function (t) { return '<option value="' + esc(t) + '">'; }).join("");
      $("#fr-dl-mat", el).innerHTML = itensContrato(s).map(function (t) {
        return '<option value="' + esc(t.descricao) + '">' + esc((t.codigo ? t.codigo + " · " : "") + (t.un || "")) + "</option>";
      }).join("") + MATERIAIS[c].map(function (t) { return '<option value="' + esc(t) + '">'; }).join("");
      $("#fr-mats-r", el).textContent = pref ? "Serviços executados e materiais usados (quantidades)" : "Materiais necessários";
      $("#fr-antes-caixa", el).classList.toggle("oculto", !pref);
      $("#fr-antes-ok", el).classList.toggle("oculto", !(pref && s.tem_fotos_antes));
      $("#fr-fotos-r", el).textContent = pref ? "🏛️ Fotos DEPOIS (serviço pronto, até 6)" : "Fotos (até 6)";
      $("#fr-add-foto", el).textContent = pref ? "📷 Fotos de DEPOIS" : "📷 Adicionar fotos";
      $("#fr-assin-tit", el).textContent = pref ? "✍️ Assinatura do fiscal da prefeitura" : "✍️ Assinatura do responsável no local";
      $("#fr-assin-txt", el).textContent = pref ? "Peça ao fiscal da prefeitura para assinar com o dedo." : "Peça ao gerente (ou ao cliente) para assinar com o dedo.";
      $("#fr-assin-nome", el).placeholder = pref ? "Nome do fiscal" : "Ex.: Carlos (gerente da loja)";
      if (pref && s.fiscal && !$("#fr-assin-nome", el).value) $("#fr-assin-nome", el).value = s.fiscal;
      $("#fr-sem-assin-t", el).textContent = pref ? "Fiscal não está no local (enviar sem assinatura)" : "Responsável não está no local (enviar sem assinatura)";
      $("#fr-assin-aviso", el).innerHTML = pref ? "✍️ OS da prefeitura: colha a <b>assinatura do fiscal</b>." : "✍️ Este serviço pede a <b>assinatura do responsável</b> no local.";
      // unidade do item do contrato entra sozinha ao escolher o item
      $$(".mat", el).forEach(ligarUnidade);
    }
    function ligarUnidade(d) {
      var inp = $(".m-item", d);
      inp.onchange = function () {
        var it = itensContrato(servicoPorId($("#fr-serv", el).value)).filter(function (t) { return t.descricao === inp.value.trim(); })[0];
        var sel = $(".m-un", d);
        if (it && it.un) {
          if (!Array.prototype.some.call(sel.options, function (o) { return o.value === it.un; })) sel.insertAdjacentHTML("beforeend", "<option>" + esc(it.un) + "</option>");
          sel.value = it.un;
        }
      };
    }

    function novaLinha() {
      var d = document.createElement("div");
      d.className = "mat";
      d.innerHTML = '<input class="m-item" list="fr-dl-mat" placeholder="Material" maxlength="200" aria-label="Material">' +
        '<input class="m-qtd" inputmode="decimal" placeholder="Qtd" aria-label="Quantidade">' +
        '<select class="m-un" aria-label="Unidade">' + UNIDADES.map(function (u) { return "<option>" + u + "</option>"; }).join("") + "</select>" +
        '<button class="m-tirar" aria-label="Remover material">✕</button>';
      $(".m-tirar", d).onclick = function () { d.remove(); };
      $("#fr-mats", el).appendChild(d);
      ligarUnidade(d);
      return d;
    }
    novaLinha();
    atualizarListas();
    $("#fr-serv", el).onchange = atualizarListas;
    // GPS no carimbo das fotos da OS da prefeitura (comprova o local)
    var posRel = null;
    if (navigator.geolocation && D.servicos.some(function (x) { return x.prefeitura; })) navigator.geolocation.getCurrentPosition(function (p) { posRel = p; }, function () {}, { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
    $("#fr-mais", el).onclick = function () { $(".m-item", novaLinha()).focus(); };

    var fotosAntes = [];
    function seletorFotos(lista, idCaixa, idArq, idBotao, rotulo) {
      function desenhar() {
        $(idCaixa, el).innerHTML = lista.map(function (f, i) {
          return '<div class="foto"><img alt="" src="' + f.url + '"><button class="et" data-i="' + i + '" style="border:0;width:100%;min-height:0;padding:2px;border-radius:0">remover</button></div>';
        }).join("");
        $$("[data-i]", $(idCaixa, el)).forEach(function (b) {
          b.onclick = function () { var f = lista.splice(Number(b.dataset.i), 1)[0]; URL.revokeObjectURL(f.url); desenhar(); };
        });
        $(idBotao, el).classList.toggle("oculto", lista.length >= 6);
      }
      var arq = $(idArq, el);
      $(idBotao, el).onclick = function () { arq.value = ""; arq.click(); };
      arq.onchange = function () {
        var novas = Array.prototype.slice.call(arq.files || [], 0, 6 - lista.length);
        var b = $(idBotao, el), txt = b.textContent, s = servicoPorId($("#fr-serv", el).value), pref = !!(s && s.prefeitura);
        A.ocupado(b, true, "Preparando...");
        var linhas = ["AGE ELÉTRICA E PINTURA · " + (pref ? "PREFEITURA · FOTO " + rotulo() : "RELATÓRIO"),
          D.funcionario.nome + " · " + new Date().toLocaleString("pt-BR")];
        if (pref) {
          linhas.push((s.protocolo ? "OS " + s.protocolo + " · " : "") + s.cliente);
          linhas.push(posRel ? "GPS " + posRel.coords.latitude.toFixed(6) + ", " + posRel.coords.longitude.toFixed(6) + " (±" + Math.round(posRel.coords.accuracy) + " m)" : "SEM GPS");
        }
        novas.reduce(function (p, f) {
          return p.then(function () {
            return A.prepararFoto(f, linhas, 1400).then(function (blob) {
              lista.push({ blob: blob, url: URL.createObjectURL(blob), caminho: null, enviada: false });
            });
          });
        }, Promise.resolve()).catch(function (e) { A.avisar(A.msgErro(e), "erro"); }).then(function () { A.ocupado(b, false); b.textContent = txt; desenhar(); });
      };
    }
    seletorFotos(fotos, "#fr-fotos", "#fr-arq", "#fr-add-foto", function () { return "DEPOIS"; });
    seletorFotos(fotosAntes, "#fr-fotos-antes", "#fr-arq-antes", "#fr-add-antes", function () { return "ANTES"; });

    var quadro = quadroAssinatura($("#fr-canvas", el), function (vazio) {
      assin = null;  // mudou o desenho: gera a imagem de novo no envio
      $("#fr-assin-status", el).textContent = vazio ? "" : "✔ assinado";
    });
    var assin = null, assinOpcional = false;
    // a assinatura só é obrigatória nos serviços em que o dono ligou "pedir assinatura"
    function pedeAssin() { var sv = servicoPorId($("#fr-serv", el).value); return !!(sv && sv.pede_assinatura); }
    function mostrarAssin(rolar) {
      var concl = $("#fr-concl", el).checked, obrig = pedeAssin(), ver = concl && (obrig || assinOpcional);
      $("#fr-assin", el).classList.toggle("oculto", !ver);
      $("#fr-assin-aviso", el).classList.toggle("oculto", !(concl && obrig));
      $("#fr-assin-opc", el).classList.toggle("oculto", !(concl && !obrig && !assinOpcional));
      $("#fr-sem-assin-l", el).classList.toggle("oculto", !obrig);
      if (ver) { quadro.ajustar(); if (rolar) $("#fr-assin", el).scrollIntoView({ behavior: "smooth", block: "center" }); }
    }
    $("#fr-concl", el).onchange = function () { mostrarAssin(true); };
    $("#fr-serv", el).addEventListener("change", function () { mostrarAssin(false); });
    $("#fr-assin-opc", el).onclick = function () { assinOpcional = true; mostrarAssin(true); };
    $("#fr-limpar", el).onclick = function () { quadro.limpar(); };
    $("#fr-sem-assin", el).onchange = function () { $(".quadro-assin", el).style.opacity = this.checked ? ".35" : "1"; };

    $("#fr-enviar", el).onclick = function () {
      var b = this;
      var materiais = $$(".mat", el).map(function (d) {
        return { item: $(".m-item", d).value.trim(), qtd: A.lerNumero($(".m-qtd", d).value), un: $(".m-un", d).value };
      }).filter(function (m) { return m.item; });
      var tipoServ = $("#fr-tipo", el).value.trim(), desc = $("#fr-desc", el).value.trim();
      var concl = $("#fr-concl", el).checked;
      if (!tipoServ && !desc) { $("#fr-erro", el).innerHTML = '<div class="aviso erro">Escreva o tipo de serviço ou a descrição.</div>'; return; }
      var sPref = servicoPorId($("#fr-serv", el).value), pref = !!(sPref && sPref.prefeitura);
      if (pref && concl && !fotosAntes.length && !sPref.tem_fotos_antes) {
        $("#fr-erro", el).innerHTML = '<div class="aviso erro">OS da prefeitura: falta a foto de <b>ANTES</b> do serviço.</div>'; return;
      }
      if (pref && concl && !fotos.length) {
        $("#fr-erro", el).innerHTML = '<div class="aviso erro">OS da prefeitura: falta a foto de <b>DEPOIS</b> (serviço pronto).</div>'; return;
      }
      var obrig = pedeAssin(), visivel = concl && (obrig || assinOpcional);
      var semAssin = obrig && $("#fr-sem-assin", el).checked, nomeAssin = $("#fr-assin-nome", el).value.trim();
      var usarAssin = visivel && !semAssin && !quadro.vazio();
      if (concl && obrig && !semAssin && quadro.vazio()) {
        $("#fr-erro", el).innerHTML = '<div class="aviso erro">' + (pref ? "Falta a assinatura do fiscal. Se ele não estiver, marque “Fiscal não está no local”." :
          "Falta a assinatura do responsável. Se ele não estiver, marque “Responsável não está no local”.") + "</div>"; return;
      }
      if (usarAssin && !nomeAssin) { $("#fr-erro", el).innerHTML = '<div class="aviso erro">Escreva o nome de quem assinou.</div>'; $("#fr-assin-nome", el).focus(); return; }
      if (concl && !A.confirmar("Marcar o serviço como CONCLUÍDO? Ele sai da sua lista.")) return;
      $("#fr-erro", el).innerHTML = "";
      A.ocupado(b, true, "Enviando...");
      var hoje = A.isoLocal(new Date());
      fotos.forEach(function (f) { if (!f.caminho) f.caminho = TOKEN + "/" + hoje + "/rel-" + A.uuid() + ".jpg"; });
      if (!pref) fotosAntes.length = 0;
      fotosAntes.forEach(function (f) { if (!f.caminho) f.caminho = TOKEN + "/" + hoje + "/antes-" + A.uuid() + ".jpg"; });
      var s0 = servicoPorId($("#fr-serv", el).value);
      var pAssin = !usarAssin ? Promise.resolve(null) : (assin ? Promise.resolve(assin) : quadro.paraJpeg([
        "Assinado por " + nomeAssin + (pref ? " (fiscal)" : "") + " · " + new Date().toLocaleString("pt-BR"),
        (s0 ? (s0.protocolo ? "OS " + s0.protocolo + " · " : "") + s0.cliente + " · " : "") + "Funcionário: " + D.funcionario.nome
      ]).then(function (blob) { assin = { blob: blob, caminho: TOKEN + "/" + hoje + "/assin-" + A.uuid() + ".jpg", enviada: false }; return assin; }));
      pAssin.then(function (a) {
        return fotosAntes.concat(fotos, a ? [a] : []).reduce(function (p, f) { return p.then(function () { return enviarFoto(f); }); }, Promise.resolve()).then(function () { return a; });
      }).then(function (a) {
        var args = {
          p_token: TOKEN, p_servico_id: $("#fr-serv", el).value, p_tipo_servico: tipoServ, p_descricao: desc,
          p_materiais: materiais, p_fotos: fotos.map(function (f) { return f.caminho; }), p_concluido: concl,
          p_assinatura: a ? a.caminho : null, p_assinado_por: a ? nomeAssin : null
        };
        if (pref) args.p_fotos_antes = fotosAntes.map(function (f) { return f.caminho; });
        return sb.rpc("enviar_relatorio", args);
      }).then(function (r) {
        if (r.error) throw r.error;
        j.fechar();
        A.avisar("Relatório enviado. Obrigado!", "ok");
        carregar();
      }).catch(function (e) {
        A.ocupado(b, false);
        b.innerHTML = "↻ Tentar enviar de novo";
        $("#fr-erro", el).innerHTML = '<div class="aviso erro">' + esc(A.msgErro(e)) + "</div>";
      });
    };
  }

  iniciar();
})();
