// Service worker do app de serviços da AGE (só vale dentro da pasta servicos/).
// Sempre busca a versão nova na internet; se estiver sem sinal, abre a última
// versão guardada. Dados do Supabase e fotos NUNCA ficam guardados aqui.
var CACHE = "age-servicos-v101";
var BASICOS = ["./index.html", "./funcionario.html", "./estilo.css", "./comum.js", "./admin.js", "./funcionario.js", "./geo.js", "./lojas-doc.js", "./prefeitura.js", "./pagamentos.js", "./fornecedores.js", "./compras.js", "./fechamento.js", "./faturamento.js", "./prospeccao.js", "./precos-base.js", "./materiais-base.js", "./leitor-texto.js", "./precos.js", "./orclojas.js", "./config.js",
  "./icone.svg", "./icone-192.png", "./icone-512.png", "./manifest.webmanifest", "./manifest-funcionario.webmanifest"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(BASICOS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf("age-servicos-") === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// "Compartilhar → AGE" no Android: o celular manda o texto e as fotos por POST para a página com ?receber.
// Guarda tudo no cache "age-recebido" e abre a página, que pergunta o que fazer com o que chegou.
function receber(r) {
  var u = new URL(r.url), pagina = u.pathname.split("/").pop() || "index.html";
  return r.formData().then(function (fd) {
    var arqs = fd.getAll("fotos").filter(function (f) { return f && f.size; }).slice(0, 20);
    return caches.delete("age-recebido").then(function () { return caches.open("age-recebido"); }).then(function (c) {
      var meta = { title: fd.get("title") || "", text: fd.get("text") || "", url: fd.get("url") || "", quando: Date.now(),
        arquivos: arqs.map(function (f) { return { nome: f.name, tipo: f.type }; }) };
      return Promise.all(arqs.map(function (f, i) { return c.put("recebido/f" + i, new Response(f, { headers: { "Content-Type": f.type || "application/octet-stream" } })); }))
        .then(function () { return c.put("recebido/meta", new Response(JSON.stringify(meta), { headers: { "Content-Type": "application/json" } })); });
    });
  }).catch(function () { /* sem nada para guardar */ }).then(function () { return Response.redirect("./" + pagina + "?recebido=1", 303); });
}

// POST de outro site (formulário que outra página envia para cá) não é "Compartilhar": não guarda nada.
// O Compartilhar do Android chega sem Origin (ou "null") e sem Referer; o service worker não enxerga o Sec-Fetch-Site.
function deOutroSite(r) {
  var o = r.headers.get("Origin");
  if (o && o !== "null" && o !== self.location.origin) return true;
  try { if (/^https?:/i.test(r.referrer || "") && new URL(r.referrer).origin !== self.location.origin) return true; } catch (e) { return true; }
  return false;
}

self.addEventListener("fetch", function (e) {
  var r = e.request;
  if (r.method === "POST" && new URL(r.url).searchParams.has("receber")) {
    if (deOutroSite(r)) { e.respondWith(Response.redirect("./" + (new URL(r.url).pathname.split("/").pop() || "index.html"), 303)); return; }
    e.respondWith(receber(r)); return;
  }
  if (r.method !== "GET") return;
  var u = new URL(r.url);
  // só os arquivos do próprio app; Supabase (dados e fotos) e bibliotecas vão direto para a internet
  if (u.origin !== self.location.origin) return;
  // "no-cache": sempre confere com o servidor (o GitHub Pages manda guardar por 10 min,
  // o que fazia a versão nova demorar a aparecer depois de uma atualização)
  e.respondWith(fetch(r.url, { cache: "no-cache", credentials: "same-origin" }).then(function (resp) {
    if (resp.ok) {
      var copia = resp.clone();
      caches.open(CACHE).then(function (c) { c.put(r, copia); });
    }
    return resp;
  }).catch(function () {
    return caches.match(r, { ignoreSearch: true }).then(function (m) { return m || Response.error(); });
  }));
});
