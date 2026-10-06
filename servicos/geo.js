// Localização das lojas e montagem de rotas (sem servidor: roda no navegador).
//  - distâncias em linha reta (haversine) x 1,3 para estimar estrada
//  - divide as lojas em dias com lojas PERTO umas das outras (agrupamento com
//    limite de paradas por dia) e coloca cada dia na melhor ordem
//    (vizinho mais próximo + 2-opt)
(function (raiz) {
  "use strict";
  var FATOR_ESTRADA = 1.3;

  function km(a, b) {
    var R = 6371, rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function temLocal(p) { return p && typeof p.lat === "number" && typeof p.lng === "number" && isFinite(p.lat) && isFinite(p.lng); }

  // Comprimento do caminho partida -> paradas (-> partida, se voltar)
  function comprimento(partida, paradas, voltar) {
    var t = 0, ant = partida;
    paradas.forEach(function (p) { if (ant) t += km(ant, p); ant = p; });
    if (voltar && partida && paradas.length) t += km(ant, partida);
    return t;
  }

  // Ordem boa para visitar: vizinho mais próximo saindo da partida, depois 2-opt.
  function ordenar(partida, paradas, voltar) {
    var resto = paradas.slice(), rota = [], atual = partida;
    if (!atual && resto.length) { atual = resto.shift(); rota.push(atual); }
    while (resto.length) {
      var mi = 0, md = Infinity;
      for (var i = 0; i < resto.length; i++) { var d = km(atual, resto[i]); if (d < md) { md = d; mi = i; } }
      atual = resto.splice(mi, 1)[0];
      rota.push(atual);
    }
    // 2-opt: inverte trechos enquanto encurtar o caminho
    var melhorou = true, voltas = 0;
    while (melhorou && voltas++ < 60) {
      melhorou = false;
      for (var a = 0; a < rota.length - 1; a++) {
        for (var b = a + 1; b < rota.length; b++) {
          var nova = rota.slice(0, a).concat(rota.slice(a, b + 1).reverse(), rota.slice(b + 1));
          if (comprimento(partida, nova, voltar) + 1e-9 < comprimento(partida, rota, voltar)) { rota = nova; melhorou = true; }
        }
      }
    }
    return rota;
  }

  // Divide em grupos de no máximo "porDia" lojas, cada grupo com lojas próximas.
  function agrupar(partida, pontos, porDia) {
    var n = pontos.length, k = Math.ceil(n / porDia);
    if (k <= 1) return [pontos.slice()];
    // sementes espalhadas: a mais longe da partida, depois sempre a mais longe das já escolhidas
    var ref = partida || pontos[0], centros = [], i, j;
    var primeiro = 0;
    for (i = 1; i < n; i++) if (km(ref, pontos[i]) > km(ref, pontos[primeiro])) primeiro = i;
    centros.push({ lat: pontos[primeiro].lat, lng: pontos[primeiro].lng });
    while (centros.length < k) {
      var mi = -1, md = -1;
      for (i = 0; i < n; i++) {
        var dm = Infinity;
        for (j = 0; j < centros.length; j++) dm = Math.min(dm, km(pontos[i], centros[j]));
        if (dm > md) { md = dm; mi = i; }
      }
      centros.push({ lat: pontos[mi].lat, lng: pontos[mi].lng });
    }
    var grupo = new Array(n);
    for (var it = 0; it < 30; it++) {
      // quem tem menos opção boa escolhe primeiro (diferença entre o 1º e o 2º centro mais perto)
      var ordem = pontos.map(function (p, idx) {
        var ds = centros.map(function (c, ci) { return [km(p, c), ci]; }).sort(function (x, y) { return x[0] - y[0]; });
        return { idx: idx, ds: ds, folga: (ds[1] ? ds[1][0] : 0) - ds[0][0] };
      }).sort(function (x, y) { return y.folga - x.folga; });
      var vagas = centros.map(function () { return porDia; }), mudou = false;
      ordem.forEach(function (o) {
        for (var q = 0; q < o.ds.length; q++) {
          var ci = o.ds[q][1];
          if (vagas[ci] > 0) { vagas[ci]--; if (grupo[o.idx] !== ci) { grupo[o.idx] = ci; mudou = true; } break; }
        }
      });
      centros = centros.map(function (c, ci) {
        var m = pontos.filter(function (p, idx) { return grupo[idx] === ci; });
        if (!m.length) return c;
        return { lat: m.reduce(function (s, p) { return s + p.lat; }, 0) / m.length, lng: m.reduce(function (s, p) { return s + p.lng; }, 0) / m.length };
      });
      if (!mudou) break;
    }
    var grupos = centros.map(function () { return []; });
    pontos.forEach(function (p, idx) { grupos[grupo[idx]].push(p); });
    return grupos.filter(function (g) { return g.length; });
  }

  // Regiões: lojas ligadas por "pulos" de até raioKm. Lojas de regiões diferentes
  // nunca vão no mesmo dia, mesmo que o dia fique com menos paradas.
  function regioes(pontos, raioKm) {
    var pai = pontos.map(function (p, i) { return i; });
    function raiz(i) { while (pai[i] !== i) { pai[i] = pai[pai[i]]; i = pai[i]; } return i; }
    for (var i = 0; i < pontos.length; i++) {
      for (var j = i + 1; j < pontos.length; j++) if (km(pontos[i], pontos[j]) <= raioKm) pai[raiz(i)] = raiz(j);
    }
    var grupos = {};
    pontos.forEach(function (p, i) { (grupos[raiz(i)] = grupos[raiz(i)] || []).push(p); });
    return Object.keys(grupos).map(function (k) { return grupos[k]; });
  }

  // Plano completo: [{ paradas: [...], km, kmEstrada }], dias ordenados do mais perto ao mais longe da partida
  function planejar(partida, lojas, opcoes) {
    opcoes = opcoes || {};
    var porDia = Math.max(1, opcoes.porDia || 6), voltar = !!opcoes.voltar, raioRegiao = opcoes.raioRegiao > 0 ? opcoes.raioRegiao : 40;
    var com = lojas.filter(temLocal), sem = lojas.filter(function (l) { return !temLocal(l); });
    if (!com.length) return { dias: [], semLocal: sem };
    var grupos = [];
    regioes(com, raioRegiao).forEach(function (r) { grupos = grupos.concat(agrupar(partida, r, porDia)); });
    var dias = grupos.map(function (g) {
      var rota = ordenar(partida, g, voltar), d = comprimento(partida, rota, voltar);
      return { paradas: rota, km: d, kmEstrada: d * FATOR_ESTRADA };
    });
    if (partida) dias.sort(function (a, b) { return km(partida, a.paradas[0]) - km(partida, b.paradas[0]); });
    return { dias: dias, semLocal: sem };
  }

  function perto(centro, lojas, raioKm) {
    return lojas.filter(function (l) { return temLocal(l) && km(centro, l) <= raioKm; })
      .sort(function (a, b) { return km(centro, a) - km(centro, b); });
  }

  // ---------- links de navegação ----------
  function enderecoTexto(l) {
    return [[l.endereco, l.numero].filter(Boolean).join(", "), l.bairro, l.cidade && l.uf ? l.cidade + " - " + l.uf : l.cidade, "Brasil"]
      .filter(Boolean).join(", ");
  }
  // Com local preciso usa coordenada; com local aproximado deixa o Google achar pelo endereço.
  function alvo(p) {
    var preciso = p.geo_precisao === "endereco" || p.geo_precisao === "gps" || p.geo_precisao === "manual" || p.ehPartida;
    if (temLocal(p) && (preciso || !p.endereco)) return p.lat.toFixed(6) + "," + p.lng.toFixed(6);
    return enderecoTexto(p);
  }
  // Google Maps aceita até 9 paradas intermediárias por link: divide em trechos.
  // Sem partida, o Google sai de onde a pessoa está (GPS do celular).
  function linksGoogle(partida, paradas, voltar) {
    var pts = paradas.slice(), links = [], i = 0;
    if (voltar && partida) pts.push(Object.assign({ ehPartida: true }, partida));
    var origem = partida ? Object.assign({ ehPartida: true }, partida) : null;
    while (i < pts.length) {
      var t = pts.slice(i, i + 10);
      var u = "https://www.google.com/maps/dir/?api=1&travelmode=driving" + (origem ? "&origin=" + encodeURIComponent(alvo(origem)) : "") +
        "&destination=" + encodeURIComponent(alvo(t[t.length - 1]));
      if (t.length > 1) u += "&waypoints=" + encodeURIComponent(t.slice(0, -1).map(alvo).join("|"));
      links.push(u);
      origem = t[t.length - 1];
      i += 10;
    }
    return links;
  }
  function linkNavegar(p) { return "https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=" + encodeURIComponent(alvo(p)); }
  function linkWaze(p) {
    return temLocal(p) && alvo(p).indexOf(",") > 0 && /^-?\d/.test(alvo(p)) ? "https://waze.com/ul?ll=" + p.lat + "," + p.lng + "&navigate=yes"
      : "https://waze.com/ul?q=" + encodeURIComponent(enderecoTexto(p)) + "&navigate=yes";
  }

  // Lê coordenadas coladas: "-19.91, -43.93" ou link do Google Maps (@-19.91,-43.93 ou q=-19.91,-43.93)
  function lerCoordenadas(t) {
    t = String(t || "");
    var m = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(t) || /[?&](?:q|query|ll|destination)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/i.exec(t) ||
      /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(t) || /^\s*(-?\d{1,2}[.,]\d+)\s*[,;\s]\s*(-?\d{1,3}[.,]\d+)\s*$/.exec(t);
    if (!m) return null;
    var lat = Number(String(m[1]).replace(",", ".")), lng = Number(String(m[2]).replace(",", "."));
    if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat: lat, lng: lng };
  }

  // ---------- localizar endereço (OpenStreetMap / Nominatim, grátis, 1 consulta por segundo) ----------
  var ESTADOS = { MG: "Minas Gerais", ES: "Espírito Santo", SP: "São Paulo", RJ: "Rio de Janeiro", GO: "Goiás", BA: "Bahia", DF: "Distrito Federal" };
  var TIPOS_RUA = [[/^R\.?\s+/i, "Rua "], [/^AV\.?\s+/i, "Avenida "], [/^ROD\.?\s+/i, "Rodovia "], [/^(PC|PÇA|PRACA|PRAÇA)\.?\s+/i, "Praça "],
    [/^AL\.?\s+/i, "Alameda "], [/^TV\.?\s+/i, "Travessa "], [/^EST\.?\s+/i, "Estrada "]];
  function semAcento(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase(); }
  function ruaPorExtenso(r) {
    r = String(r || "").trim();
    for (var i = 0; i < TIPOS_RUA.length; i++) if (TIPOS_RUA[i][0].test(r)) return r.replace(TIPOS_RUA[i][0], TIPOS_RUA[i][1]);
    return r;
  }
  function tentativas(l) {
    var estado = ESTADOS[l.uf] || l.uf || "", cid = l.cidade || "", lista = [];
    var num = /^\d+/.exec(l.numero || "");
    if (l.endereco && cid && !/^(ROD|BR|MG)\b/i.test(l.endereco)) {
      lista.push({ p: { street: (num ? num[0] + " " : "") + ruaPorExtenso(l.endereco), city: cid, state: estado, country: "Brasil" }, precisao: "endereco" });
    }
    var cep = String(l.cep || "").replace(/\D/g, "");
    if (cep.length === 8 && !/000$/.test(cep)) lista.push({ p: { postalcode: cep.slice(0, 5) + "-" + cep.slice(5), country: "Brasil" }, precisao: "cep" });
    if (l.bairro && cid && semAcento(l.bairro) !== semAcento(cid)) lista.push({ p: { q: l.bairro + ", " + cid + ", " + estado + ", Brasil" }, precisao: "bairro" });
    if (cid) lista.push({ p: { city: cid, state: estado, country: "Brasil" }, precisao: "cidade" });
    return lista;
  }
  function esperar(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  var ultimaConsulta = 0, cacheCidade = {};
  function consultar(params, fetchFn) {
    var agora = Date.now(), espera = Math.max(0, ultimaConsulta + 1100 - agora);
    ultimaConsulta = agora + espera;
    var u = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&addressdetails=1&accept-language=pt-BR";
    Object.keys(params).forEach(function (k) { u += "&" + k + "=" + encodeURIComponent(params[k]); });
    return esperar(espera).then(function () { return (fetchFn || fetch)(u); }).then(function (r) {
      if (r.status === 429) throw new Error("O serviço de mapas pediu para ir mais devagar. Tente de novo em alguns minutos.");
      if (!r.ok) throw new Error("Serviço de mapas indisponível (" + r.status + ").");
      return r.json();
    });
  }
  // Confere se o resultado é mesmo na cidade da loja (evita rua com mesmo nome em outra cidade)
  function mesmaCidade(res, cidade) {
    var a = res && res.address || {}, c = semAcento(cidade);
    var nomes = [a.city, a.town, a.village, a.municipality, a.city_district, a.suburb].filter(Boolean).map(semAcento);
    if (nomes.indexOf(c) >= 0) return true;
    return semAcento(res.display_name || "").indexOf(c) >= 0;
  }
  function localizar(l, fetchFn) {
    var lista = tentativas(l), i = 0;
    function proxima() {
      if (i >= lista.length) return Promise.resolve(null);
      var t = lista[i++];
      var chave = t.precisao === "cidade" ? semAcento(t.p.city + "|" + t.p.state) : null;
      if (chave && cacheCidade[chave]) return Promise.resolve(cacheCidade[chave]);
      return consultar(t.p, fetchFn).then(function (res) {
        var r = res && res[0];
        if (!r || (l.cidade && t.precisao !== "cep" && !mesmaCidade(r, l.cidade))) return proxima();
        if (t.precisao === "cep" && l.cidade && !mesmaCidade(r, l.cidade)) return proxima();
        var out = { lat: Number(r.lat), lng: Number(r.lon), geo_precisao: t.precisao };
        if (chave) cacheCidade[chave] = out;
        return out;
      });
    }
    return proxima();
  }

  var GEO = { km: km, temLocal: temLocal, comprimento: comprimento, ordenar: ordenar, agrupar: agrupar, regioes: regioes, planejar: planejar, perto: perto,
    enderecoTexto: enderecoTexto, linksGoogle: linksGoogle, linkNavegar: linkNavegar, linkWaze: linkWaze, lerCoordenadas: lerCoordenadas,
    localizar: localizar, tentativas: tentativas, FATOR_ESTRADA: FATOR_ESTRADA };
  if (typeof module !== "undefined" && module.exports) module.exports = GEO;
  else raiz.AGE_GEO = GEO;
})(typeof window !== "undefined" ? window : this);
