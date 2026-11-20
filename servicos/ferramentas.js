// Painel do dono — 🧰 FERRAMENTAS: lista de ferramentas e equipamentos entregues a cada funcionário (com termo para imprimir e assinar)
// e o catálogo geral (a lista gigante de tudo que a empresa usa), que você edita e aumenta quando quiser.
// Tudo é salvo sozinho ao digitar, e o corretor do app age em cada campo. Tabelas: ferramentas_catalogo e ferramentas_entregas.
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null, cat = null, ent = null, semTabela = false;
  var vista = "func", funcSel = "", buscaCat = "";
  var ESTADOS = ["Novo", "Bom", "Usado", "Com defeito"];

  // lista inicial (entra sozinha na primeira vez; depois é toda sua: edite, apague e acrescente)
  var PADRAO = {
    "Escadas e acesso em altura": ["Escada de degraus 3 degraus (alumínio)", "Escada de degraus 4 degraus (alumínio)", "Escada de degraus 5 degraus (alumínio)", "Escada de degraus 6 degraus (alumínio)", "Escada de degraus 7 degraus (alumínio)", "Escada de degraus 8 degraus (alumínio)", "Escada de degraus 10 degraus (alumínio)", "Escada de abrir (tesoura) em fibra 6 degraus", "Escada de abrir (tesoura) em fibra 8 degraus", "Escada de abrir (tesoura) em fibra 10 degraus", "Escada de abrir (tesoura) em alumínio 5 degraus", "Escada extensível em alumínio 4,00 m", "Escada extensível em alumínio 6,00 m", "Escada extensível em alumínio 7,20 m", "Escada extensível em fibra 6,00 m", "Escada extensível em fibra 7,20 m", "Escada articulada multifuncional 4x3", "Escada articulada multifuncional 4x4", "Escada telescópica", "Escada plataforma 2 degraus", "Escada plataforma 3 degraus", "Escada de madeira", "Escada marinheiro", "Banqueta de 2 degraus", "Andaime tubular (módulo)", "Andaime fachadeiro (módulo)", "Andaime móvel com rodízios", "Plataforma de trabalho", "Cavalete metálico", "Cavalete de madeira", "Balancim / cadeira suspensa", "Corda de segurança"],
    "Furadeiras, marteletes e parafusadeiras": ["Martelete rompedor", "Martelete perfurador SDS Plus", "Martelete perfurador SDS Max", "Furadeira de impacto", "Furadeira / parafusadeira a bateria 12 V", "Furadeira / parafusadeira a bateria 20 V", "Parafusadeira a bateria", "Parafusadeira de impacto", "Chave de impacto", "Parafusadeira para drywall", "Furadeira de bancada", "Furadeira de coluna", "Bateria extra 12 V", "Bateria extra 20 V", "Carregador de bateria", "Jogo de brocas para concreto (widia)", "Jogo de brocas para aço (HSS)", "Jogo de brocas para madeira", "Jogo de brocas SDS Plus", "Broca SDS Max", "Serra copo (jogo)", "Serra copo diamantada", "Ponteira e talhadeira SDS", "Jogo de bits e soquetes"],
    "Máquinas de corte e acabamento": ["Serra tico-tico", "Serra circular", "Serra mármore", "Serra sabre", "Serra de bancada", "Esmerilhadeira 4.1/2\"", "Esmerilhadeira 7\"", "Lixadeira orbital", "Lixadeira roto-orbital", "Lixadeira de parede (girafa)", "Politriz", "Plaina elétrica", "Tupia", "Soprador térmico", "Pistola de ar quente", "Máquina de solda inversora", "Máquina de solda MIG", "Policorte", "Cortador de piso", "Disco de corte", "Disco diamantado", "Disco de desbaste", "Lixas (jogo)"],
    "Ferramentas manuais de eletricista": ["Alicate universal", "Alicate de corte", "Alicate de bico", "Alicate de pressão", "Alicate descascador de fios", "Alicate rebitador", "Alicate para terminal (crimpar)", "Alicate de crimpagem RJ45", "Alicate bomba d'água", "Jogo de chaves de fenda", "Jogo de chaves Phillips", "Jogo de chaves de precisão", "Chave de teste", "Chave canhão (jogo)", "Jogo de chaves combinadas", "Jogo de chaves Allen", "Chave inglesa", "Chave grifo", "Chave de boca ajustável", "Torquímetro", "Martelo", "Martelo de borracha", "Marreta", "Arco de serra", "Serrote", "Estilete", "Faca de eletricista", "Passa-fio (guia de aço)", "Fita-guia", "Prensa terminal hidráulica", "Cortador de cabo", "Cortador de eletroduto", "Curvadora de tubo", "Tarraxa", "Rebitadeira manual", "Pistola de silicone", "Pistola de cola quente", "Ferro de solda", "Estação de solda", "Sugador de solda", "Bomba de vácuo", "Grampeador de fio"],
    "Medição e teste": ["Multímetro digital", "Alicate amperímetro", "Megôhmetro", "Terrômetro", "Detector de tensão", "Detector de metais / canos", "Luxímetro", "Termovisor / câmera térmica", "Termômetro infravermelho", "Testador de cabos de rede", "Certificador de cabos", "Localizador de cabos", "Testador de câmera CFTV", "Wattímetro", "Fasímetro", "Trena 5 m", "Trena 30 m", "Trena 50 m", "Trena a laser", "Trena de roda (odômetro)", "Nível a laser", "Nível de bolha", "Nível de mangueira", "Prumo", "Esquadro", "Compasso", "Paquímetro"],
    "Pintura": ["Pistola de pintura airless", "Pistola de pintura gravidade", "Pistola de pintura sucção", "Compressor de ar", "Mangueira de ar", "Rolo de lã (jogo)", "Rolo de espuma (jogo)", "Rolo epóxi", "Trincha (jogo)", "Pincel", "Cabo extensor telescópico", "Bandeja de pintura", "Grade para rolo", "Espátula", "Desempenadeira de aço", "Desempenadeira de PVC", "Raspador", "Escova de aço", "Lixadeira manual", "Balde de pintura", "Lona plástica", "Fita crepe", "Fita de demarcação", "Gabarito / estêncil de sinalização", "Giz de linha", "Máquina de demarcação viária", "Lavadora de alta pressão", "Misturador de tinta"],
    "Obra e construção": ["Colher de pedreiro", "Desempenadeira", "Talhadeira", "Ponteira", "Picareta", "Pá", "Enxada", "Enxadão", "Carrinho de mão", "Balde", "Betoneira", "Misturador de argamassa", "Vibrador de concreto", "Régua de alumínio", "Linha de nylon", "Serra copo para forro", "Escavadeira de poste (cavadeira)", "Pé de cabra", "Alavanca", "Macaco hidráulico"],
    "Redes, TI e CFTV": ["Alicate de crimpar RJ45/RJ11", "Testador de cabos RJ45", "Passador de cabo", "Cortador de fibra óptica", "Descascador de fibra", "Punch down (ferramenta de impacto)", "Notebook de serviço", "Tablet", "Celular da empresa", "Monitor de teste CFTV", "Fonte 12 V portátil", "Roteador de teste", "Switch de teste", "Cabo de rede de teste", "Kit de limpeza de fibra", "Fusionadora de fibra óptica"],
    "EPIs e segurança": ["Capacete com jugular", "Óculos de proteção", "Protetor facial", "Protetor auricular (concha)", "Protetor auricular (plug)", "Máscara PFF2", "Respirador semifacial", "Luva de vaqueta", "Luva isolante classe 0", "Luva isolante classe 2", "Luva de látex", "Luva nitrílica", "Luva de proteção mecânica", "Botina de segurança", "Botina isolante", "Bota de PVC", "Cinto paraquedista", "Talabarte", "Trava-quedas", "Linha de vida", "Mosquetão", "Uniforme / macacão", "Avental", "Perneira", "Mangote", "Colete refletivo", "Cone de sinalização", "Fita zebrada", "Placa de sinalização", "Kit de primeiros socorros", "Extintor portátil"],
    "Iluminação e extensões": ["Lanterna", "Lanterna de cabeça", "Refletor LED portátil", "Refletor LED com tripé", "Extensão elétrica 10 m", "Extensão elétrica 20 m", "Extensão elétrica 30 m", "Extensão elétrica 50 m", "Carretel enrolador de extensão", "Régua de tomadas (benjamim)", "Plugue adaptador (T)", "Fita isolante (rolo)", "Abraçadeiras (kit)"],
    "Transporte e organização": ["Caixa de ferramentas", "Maleta de ferramentas", "Bolsa de ferramentas", "Cinto porta-ferramentas", "Organizador plástico", "Caixa plástica grande", "Carrinho para ferramentas", "Bolsa para escada", "Tripé", "Lona de proteção", "Aspirador de pó industrial", "Soprador / aspirador", "Vassoura", "Pá de lixo"]
  };

  function semT(e) { return /does not exist|schema cache|PGRST205|42P01/i.test(String((e && (e.message || e.code)) || e)); }
  function agora() { var d = new Date(); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
  function dataBr(iso) { var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + "/" + m[2] + "/" + m[1] : ""; }
  function funcs() { return ((P && P.S.func) || []).filter(function (f) { return f.ativo !== false; }).slice().sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome), "pt-BR"); }); }
  function status(t, erro) { var s = $("#fe-status"); if (s) { s.textContent = t; s.style.color = erro ? "var(--erro, #c0392b)" : ""; } }
  function run(b) { return Promise.resolve(b).then(function (r) { if (r && r.error) throw r.error; return r; }); }

  function padraoLinhas() {
    var o = [], n = 0;
    Object.keys(PADRAO).forEach(function (g) { PADRAO[g].forEach(function (nome) { o.push({ nome: nome, categoria: g, ordem: n++ }); }); });
    return o;
  }
  function carregar(depois) {
    run(P.sb.from("ferramentas_catalogo").select("*").order("categoria").order("nome").limit(5000)).then(function (r) {
      if ((r.data || []).length) return r;
      var linhas = padraoLinhas().map(function (x) { return { nome: x.nome, categoria: x.categoria }; }), lotes = [];
      for (var i = 0; i < linhas.length; i += 100) lotes.push(linhas.slice(i, i + 100));
      return lotes.reduce(function (p, lote) { return p.then(function () { return run(P.sb.from("ferramentas_catalogo").insert(lote)); }); }, Promise.resolve())
        .then(function () { return run(P.sb.from("ferramentas_catalogo").select("*").order("categoria").order("nome").limit(5000)); });
    }).then(function (r) { cat = r.data || []; return run(P.sb.from("ferramentas_entregas").select("*").order("criado_em").limit(20000)); })
      .then(function (r) { ent = r.data || []; semTabela = false; })
      .catch(function (e) {
        semTabela = semT(e);
        cat = padraoLinhas().map(function (x, i) { return { id: "p" + i, nome: x.nome, categoria: x.categoria, padrao: true }; }); ent = [];
        if (!semTabela) A.avisar(A.msgErro ? A.msgErro(e) : e.message, "erro");
      }).then(depois);
  }

  // ---------------- tela ----------------
  function ver(c, ctx) {
    P = ctx;
    c.innerHTML = '<div class="cab-secao"><h2>🧰 Ferramentas</h2><span id="fe-status" class="mudo peq"></span></div><div class="cartao vazio">Carregando...</div>';
    carregar(function () { desenhar(c); });
  }
  function desenhar(c) {
    c.innerHTML = '<div class="cab-secao"><h2>🧰 Ferramentas</h2><span id="fe-status" class="mudo peq"></span></div>' +
      (semTabela ? '<div class="aviso">Para usar esta área, rode no Supabase o <b>ferramentas.sql</b> (tabelas <b>ferramentas_catalogo</b> e <b>ferramentas_entregas</b>) e atualize o app. Por enquanto só dá para ver a lista inicial.</div>' : "") +
      '<div class="acoes"><button class="' + (vista === "func" ? "prim" : "") + '" data-v="func">👷 Por funcionário</button><button class="' + (vista === "cat" ? "prim" : "") + '" data-v="cat">📚 Lista geral (' + cat.length + ")</button></div>" +
      '<datalist id="fe-nomes">' + cat.map(function (x) { return '<option value="' + esc(x.nome) + '">'; }).join("") + "</datalist>" +
      '<datalist id="fe-cats">' + categorias().map(function (g) { return '<option value="' + esc(g) + '">'; }).join("") + "</datalist>" +
      '<div id="fe-corpo"></div>';
    $$("[data-v]", c).forEach(function (b) { b.onclick = function () { vista = b.dataset.v; desenhar(c); }; });
    if (vista === "cat") verCatalogo($("#fe-corpo", c)); else verFunc($("#fe-corpo", c), c);
  }
  function categorias() { var s = {}; cat.forEach(function (x) { if (x.categoria) s[x.categoria] = 1; }); return Object.keys(s).sort(function (a, b) { return a.localeCompare(b, "pt-BR"); }); }

  // ---- por funcionário ----
  function minhas(fid) { return ent.filter(function (e) { return e.funcionario_id === fid; }); }
  function verFunc(c, raiz) {
    var fs = funcs();
    if (!fs.length) { c.innerHTML = '<div class="cartao vazio">Cadastre os funcionários na aba Equipe primeiro.</div>'; return; }
    if (!fs.some(function (f) { return f.id === funcSel; })) funcSel = fs[0].id;
    var f = fs.filter(function (x) { return x.id === funcSel; })[0], L = minhas(f.id), emPosse = L.filter(function (e) { return !e.devolvido_em && String(e.nome).trim(); });
    c.innerHTML = '<div class="filtros"><select id="fe-func" aria-label="Funcionário">' + fs.map(function (x) {
      var n = minhas(x.id).filter(function (e) { return !e.devolvido_em && String(e.nome).trim(); }).length;
      return '<option value="' + esc(x.id) + '"' + (x.id === funcSel ? " selected" : "") + ">" + esc(x.nome) + (n ? " (" + n + ")" : "") + "</option>";
    }).join("") + "</select></div>" +
      '<p class="mudo peq" style="margin:4px 0 8px"><b>' + emPosse.length + "</b> item(ns) em posse de " + esc(f.nome) + '. Tudo é salvo sozinho ao digitar.</p>' +
      '<div class="acoes"><button class="prim" id="fe-pick"' + (semTabela ? " disabled" : "") + '>➕ Escolher da lista geral</button><button id="fe-novo"' + (semTabela ? " disabled" : "") + '>➕ Linha em branco</button><button id="fe-imp"' + (emPosse.length ? "" : " disabled") + '>🖨 Imprimir termo para assinar</button></div>' +
      '<div id="fe-lista">' + (L.length ? L.map(linha).join("") : '<div class="cartao vazio">Nenhuma ferramenta lançada para ' + esc(f.nome) + ". Toque em ➕ Escolher da lista geral.</div>") + "</div>";
    $("#fe-func", c).onchange = function () { funcSel = this.value; verFunc(c, raiz); };
    $("#fe-pick", c).onclick = function () { escolher(f, function () { verFunc(c, raiz); }); };
    $("#fe-novo", c).onclick = function () { adicionar(f.id, [{ nome: "" }], function () { verFunc(c, raiz); }); };
    $("#fe-imp", c).onclick = function () { imprimir(f); };
    ligarLinhas($("#fe-lista", c), function () { verFunc(c, raiz); });
  }
  function linha(e) {
    return '<div class="cartao" data-ent="' + esc(e.id) + '"' + (e.devolvido_em ? ' style="opacity:.6"' : "") + ">" +
      '<div class="linha" style="gap:6px;align-items:flex-end">' +
      '<label style="flex:3;min-width:220px">Ferramenta / equipamento<input class="f-nome" list="fe-nomes" maxlength="160" value="' + esc(e.nome) + '"></label>' +
      '<label style="width:70px">Qtd<input class="f-qtd" type="number" min="0" max="9999" value="' + esc(e.qtd) + '"></label>' +
      '<button class="peq perigo" data-tirar aria-label="Apagar a linha">🗑</button></div>' +
      '<div class="linha" style="gap:6px;margin-top:6px">' +
      '<label style="flex:1;min-width:130px">Nº de série / patrimônio<input class="f-serie" data-sem-correcao maxlength="60" value="' + esc(e.serie || "") + '"></label>' +
      '<label style="width:130px">Estado<select class="f-estado">' + ESTADOS.concat(e.estado && ESTADOS.indexOf(e.estado) < 0 ? [e.estado] : []).map(function (s) { return '<option' + (s === (e.estado || "Bom") ? " selected" : "") + ">" + esc(s) + "</option>"; }).join("") + "</select></label>" +
      '<label style="width:150px">Entregue em<input class="f-ent" type="date" value="' + esc(e.entregue_em || "") + '"></label>' +
      '<label style="width:150px">Devolvido em<input class="f-dev" type="date" value="' + esc(e.devolvido_em || "") + '"></label></div>' +
      '<label style="display:block;margin-top:6px">Observação<input class="f-obs" maxlength="500" value="' + esc(e.obs || "") + '"></label></div>';
  }
  var timers = {};
  function ligarLinhas(lista, refazer) {
    function achar(el) { var d = el.closest("[data-ent]"); return d ? ent.filter(function (e) { return e.id === d.dataset.ent; })[0] : null; }
    function ler(d) {
      return { nome: $(".f-nome", d).value.trim(), qtd: Math.max(0, parseInt($(".f-qtd", d).value, 10) || 0), serie: $(".f-serie", d).value.trim() || null, estado: $(".f-estado", d).value,
        entregue_em: $(".f-ent", d).value || null, devolvido_em: $(".f-dev", d).value || null, obs: $(".f-obs", d).value.trim() || null };
    }
    function agendar(ev) {
      var t = ev.target, d = t.closest && t.closest("[data-ent]"); if (!d || !t.classList.contains || !/^f-/.test(t.className.split(" ")[0] || "")) return;
      var e = achar(t); if (!e || semTabela) return;
      status("Salvando…");
      clearTimeout(timers[e.id]);
      timers[e.id] = setTimeout(function () {
        var v = ler(d);
        run(P.sb.from("ferramentas_entregas").update(v).eq("id", e.id)).then(function () { Object.keys(v).forEach(function (k) { e[k] = v[k]; }); status("✓ Salvo às " + agora()); if (t.classList.contains("f-dev")) refazer(); })
          .catch(function (er) { status("Não salvou", true); A.avisar(A.msgErro ? A.msgErro(er) : er.message, "erro"); });
      }, 600);
    }
    lista.addEventListener("input", agendar); lista.addEventListener("change", agendar);
    $$("[data-tirar]", lista).forEach(function (b) {
      b.onclick = function () {
        var e = achar(b); if (!e) return;
        if (String(e.nome).trim() && !A.confirmar("Apagar “" + e.nome + "” desta lista?")) return;
        run(P.sb.from("ferramentas_entregas").delete().eq("id", e.id)).then(function () { ent = ent.filter(function (x) { return x.id !== e.id; }); status("✓ Salvo às " + agora()); refazer(); })
          .catch(function (er) { A.avisar(A.msgErro ? A.msgErro(er) : er.message, "erro"); });
      };
    });
  }
  function adicionar(fid, itens, depois) {
    var hoje = A.isoLocal(new Date());
    var regs = itens.map(function (i) { return { funcionario_id: fid, nome: i.nome || "", qtd: i.qtd || 1, estado: "Bom", entregue_em: hoje }; });
    run(P.sb.from("ferramentas_entregas").insert(regs).select()).then(function (r) { (r.data || []).forEach(function (x) { ent.push(x); }); status("✓ Salvo às " + agora()); depois(); })
      .catch(function (er) { A.avisar(A.msgErro ? A.msgErro(er) : er.message, "erro"); });
  }
  // escolher várias ferramentas da lista geral de uma vez
  function escolher(f, depois) {
    var j = A.janela('<input type="search" id="fp-busca" data-sem-correcao placeholder="🔍 Buscar na lista (ex.: escada, martelete)" style="width:100%"><div id="fp-lista" style="max-height:55vh;overflow:auto;margin-top:8px"></div>' +
      '<div class="acoes"><button class="prim" id="fp-ok">Adicionar para ' + esc(f.nome) + '</button><button id="fp-cancelar">Cancelar</button></div>', { titulo: "➕ Escolher ferramentas", larga: true, semRascunho: true });
    var marc = {}, qt = {};
    function pintar() {
      var b = $("#fp-busca", j.el).value.toLowerCase().trim(), g = {};
      cat.forEach(function (x) { if (!b || (x.nome + " " + (x.categoria || "")).toLowerCase().indexOf(b) >= 0) (g[x.categoria || "Outras"] = g[x.categoria || "Outras"] || []).push(x); });
      $("#fp-lista", j.el).innerHTML = Object.keys(g).sort(function (a, c2) { return a.localeCompare(c2, "pt-BR"); }).map(function (k) {
        return '<h4 style="margin:10px 0 4px">' + esc(k) + "</h4>" + g[k].map(function (x) {
          return '<div class="linha" style="gap:8px;padding:3px 0"><label style="flex:1;display:flex;gap:8px;align-items:center"><input type="checkbox" data-id="' + esc(x.id) + '"' + (marc[x.id] ? " checked" : "") + '> ' + esc(x.nome) + '</label><input type="number" min="1" max="999" data-q="' + esc(x.id) + '" value="' + (qt[x.id] || 1) + '" style="width:64px"></div>';
        }).join("");
      }).join("") || '<p class="mudo">Nada com essa busca.</p>';
      $$("[data-id]", j.el).forEach(function (i) { i.onchange = function () { marc[i.dataset.id] = i.checked; cont(); }; });
      $$("[data-q]", j.el).forEach(function (i) { i.oninput = function () { qt[i.dataset.q] = Math.max(1, parseInt(i.value, 10) || 1); }; });
      cont();
    }
    function cont() { var n = Object.keys(marc).filter(function (k) { return marc[k]; }).length; $("#fp-ok", j.el).textContent = "Adicionar " + (n || "") + " para " + f.nome; $("#fp-ok", j.el).disabled = !n; }
    $("#fp-busca", j.el).oninput = pintar; pintar();
    $("#fp-cancelar", j.el).onclick = function () { j.fechar(); };
    $("#fp-ok", j.el).onclick = function () {
      var itens = cat.filter(function (x) { return marc[x.id]; }).map(function (x) { return { nome: x.nome, qtd: qt[x.id] || 1 }; });
      if (!itens.length) return;
      adicionar(f.id, itens, function () { j.fechar(); depois(); });
    };
  }

  // ---- lista geral (catálogo) ----
  function verCatalogo(c) {
    c.innerHTML = '<p class="mudo peq" style="margin-top:0">Esta é a lista de tudo que a empresa usa. <b>Edite os nomes, mude a categoria, apague ou acrescente</b>: salva sozinho. Mudar o nome aqui não altera o que já foi entregue aos funcionários.</p>' +
      '<div class="cartao"><div class="linha" style="gap:6px;align-items:flex-end"><label style="flex:3;min-width:220px">Nova ferramenta<input class="fc-nome-novo" maxlength="160" placeholder="Ex.: Escada de fibra 12 degraus"></label>' +
      '<label style="flex:2;min-width:160px">Categoria<input class="fc-cat-novo" list="fe-cats" maxlength="60" placeholder="Ex.: Escadas e acesso em altura"></label><button class="prim" id="fc-add"' + (semTabela ? " disabled" : "") + ">➕ Acrescentar</button></div></div>" +
      '<div class="filtros"><input type="search" id="fc-busca" data-sem-correcao placeholder="🔍 Buscar na lista" value="' + esc(buscaCat) + '"></div><div id="fc-lista"></div>';
    function pintar() {
      var b = buscaCat.toLowerCase().trim(), g = {};
      cat.forEach(function (x) { if (!b || (x.nome + " " + (x.categoria || "")).toLowerCase().indexOf(b) >= 0) (g[x.categoria || "Sem categoria"] = g[x.categoria || "Sem categoria"] || []).push(x); });
      $("#fc-lista", c).innerHTML = Object.keys(g).sort(function (a, c2) { return a.localeCompare(c2, "pt-BR"); }).map(function (k) {
        return '<h3 style="margin:14px 0 6px">' + esc(k) + ' <span class="mudo peq">(' + g[k].length + ")</span></h3>" + g[k].map(function (x) {
          return '<div class="linha" data-cat="' + esc(x.id) + '" style="gap:6px;margin-bottom:6px"><input class="c-nome" style="flex:3;min-width:200px" maxlength="160" value="' + esc(x.nome) + '"' + (semTabela ? " disabled" : "") + '><input class="c-cat" list="fe-cats" style="flex:2;min-width:140px" maxlength="60" value="' + esc(x.categoria || "") + '"' + (semTabela ? " disabled" : "") + '><button class="peq perigo" data-tirar aria-label="Apagar"' + (semTabela ? " disabled" : "") + ">🗑</button></div>";
        }).join("");
      }).join("") || '<div class="cartao vazio">Nada com essa busca.</div>';
    }
    pintar();
    $("#fc-busca", c).oninput = function () { buscaCat = this.value; pintar(); };
    $("#fc-add", c).onclick = function () {
      var nome = $(".fc-nome-novo", c).value.trim(), g = $(".fc-cat-novo", c).value.trim();
      if (!nome) { A.avisar("Escreva o nome da ferramenta.", "erro"); return; }
      if (cat.some(function (x) { return x.nome.toLowerCase() === nome.toLowerCase(); })) { A.avisar("Essa ferramenta já está na lista.", "erro"); return; }
      run(P.sb.from("ferramentas_catalogo").insert({ nome: nome, categoria: g || null }).select()).then(function (r) { cat = cat.concat(r.data || []); status("✓ Salvo às " + agora()); desenhar($("#fe-corpo").parentNode); })
        .catch(function (er) { A.avisar(A.msgErro ? A.msgErro(er) : er.message, "erro"); });
    };
    var lista = $("#fc-lista", c), tm = {};
    function item(el) { var d = el.closest("[data-cat]"); return d ? cat.filter(function (x) { return x.id === d.dataset.cat; })[0] : null; }
    function salvar(ev) {
      var t = ev.target, x = t.classList && (t.classList.contains("c-nome") || t.classList.contains("c-cat")) ? item(t) : null; if (!x) return;
      var d = t.closest("[data-cat]"); status("Salvando…"); clearTimeout(tm[x.id]);
      tm[x.id] = setTimeout(function () {
        var nome = $(".c-nome", d).value.trim(), g = $(".c-cat", d).value.trim();
        if (!nome) { status("Escreva o nome", true); return; }
        run(P.sb.from("ferramentas_catalogo").update({ nome: nome, categoria: g || null }).eq("id", x.id)).then(function () { x.nome = nome; x.categoria = g || null; status("✓ Salvo às " + agora()); })
          .catch(function (er) { status("Não salvou", true); A.avisar(A.msgErro ? A.msgErro(er) : er.message, "erro"); });
      }, 600);
    }
    lista.addEventListener("input", salvar);
    lista.addEventListener("click", function (ev) {
      var b = ev.target.closest && ev.target.closest("[data-tirar]"); if (!b) return;
      var x = item(b); if (!x || !A.confirmar("Tirar “" + x.nome + "” da lista geral? (O que já foi entregue aos funcionários continua.)")) return;
      run(P.sb.from("ferramentas_catalogo").delete().eq("id", x.id)).then(function () { cat = cat.filter(function (y) { return y.id !== x.id; }); status("✓ Salvo às " + agora()); desenhar($("#fe-corpo").parentNode); })
        .catch(function (er) { A.avisar(A.msgErro ? A.msgErro(er) : er.message, "erro"); });
    });
  }

  // ---- termo para imprimir e assinar ----
  function imprimir(f) {
    var E = A.CFG.EMPRESA || {}, L = minhas(f.id).filter(function (e) { return !e.devolvido_em && String(e.nome).trim(); });
    if (!L.length) { A.avisar("Nenhuma ferramenta em posse deste funcionário.", "erro"); return; }
    var w = window.open("", "_blank");
    if (!w) { A.avisar("O navegador bloqueou a janela de impressão. Permita pop-ups para este site e tente de novo.", "erro"); return; }
    var emp = E.nome || "AGE Elétrica e Pintura", hoje = new Date().toLocaleDateString("pt-BR");
    var html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Termo de ferramentas - ' + esc(f.nome) + "</title><style>" +
      "body{font:13px/1.45 Arial,Helvetica,sans-serif;color:#111;margin:0 auto;padding:26px;max-width:820px}" +
      ".cab{display:flex;justify-content:space-between;gap:16px;border-bottom:3px solid #14325c;padding-bottom:10px}.cab b{font-size:19px;color:#14325c}" +
      "h2{text-align:center;color:#14325c;margin:16px 0 8px;font-size:16px;text-transform:uppercase}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #999;padding:5px 6px;text-align:left;vertical-align:top}" +
      "th{background:#eef1f6;font-size:11px;text-transform:uppercase}.n{text-align:center;white-space:nowrap}p{margin:6px 0;text-align:justify}.ass{margin-top:46px;display:flex;gap:40px}.ass div{flex:1;border-top:1px solid #333;text-align:center;padding-top:4px;font-size:12px}" +
      "@media print{body{padding:0}button{display:none}}button{padding:10px 16px;font-size:15px;margin:0 0 14px;cursor:pointer}</style></head><body>" +
      '<button onclick="window.print()">🖨 Imprimir / salvar PDF</button>' +
      '<div class="cab"><div><b>' + esc(emp) + "</b><br>" + [E.documento, E.telefone, E.endereco, E.cidade].filter(Boolean).map(esc).join(" · ") + '</div><div style="text-align:right">Data: ' + hoje + "</div></div>" +
      "<h2>Termo de entrega e responsabilidade de ferramentas e equipamentos</h2>" +
      "<p><b>Funcionário:</b> " + esc(f.nome) + " &nbsp;&nbsp; <b>CPF:</b> ____________________ &nbsp;&nbsp; <b>Função:</b> ____________________</p>" +
      "<p>Declaro que recebi da empresa <b>" + esc(emp) + "</b>, em bom estado de uso e funcionamento, as ferramentas e os equipamentos relacionados abaixo, e me comprometo a:</p>" +
      "<p>1) usá-los somente nos serviços da empresa e de acordo com as orientações de segurança;<br>2) zelar pela guarda e conservação, sem emprestá-los a terceiros;<br>3) comunicar imediatamente à empresa qualquer defeito, dano, perda ou furto;<br>4) devolvê-los quando solicitado ou ao término do vínculo com a empresa, ressalvado o desgaste natural pelo uso.</p>" +
      "<table><thead><tr><th class=\"n\">Nº</th><th>Ferramenta / equipamento</th><th class=\"n\">Qtd</th><th>Nº série / patrimônio</th><th>Estado</th><th class=\"n\">Entrega</th><th>Devolução (data e visto)</th></tr></thead><tbody>" +
      L.map(function (e, i) { return '<tr><td class="n">' + (i + 1) + "</td><td>" + esc(e.nome) + (e.obs ? '<br><span style="color:#555;font-size:11px">' + esc(e.obs) + "</span>" : "") + '</td><td class="n">' + esc(e.qtd) + "</td><td>" + esc(e.serie || "") + "</td><td>" + esc(e.estado || "") + '</td><td class="n">' + dataBr(e.entregue_em) + "</td><td></td></tr>"; }).join("") +
      "</tbody></table>" +
      "<p>Local e data: ______________________________, ____ / ____ / ________</p>" +
      '<div class="ass"><div>' + esc(f.nome) + "<br>Funcionário</div><div>" + esc(emp) + "<br>Responsável</div></div>" +
      "<script>setTimeout(function(){window.print()},400)<\/script></body></html>";
    w.document.open(); w.document.write(html); w.document.close();
  }

  window.AGE_FERR = { ver: ver };
})();
