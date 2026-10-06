// Service worker do app de serviços da AGE (só vale dentro da pasta servicos/).
// Sempre busca a versão nova na internet; se estiver sem sinal, abre a última
// versão guardada. Dados do Supabase e fotos NUNCA ficam guardados aqui.
var CACHE = "age-servicos-v4";
var BASICOS = ["./index.html", "./funcionario.html", "./estilo.css", "./comum.js", "./admin.js", "./funcionario.js", "./geo.js", "./lojas-doc.js", "./config.js",
  "./icone.svg", "./icone-192.png", "./icone-512.png", "./manifest.webmanifest", "./manifest-funcionario.webmanifest"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(BASICOS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf("age-servicos-") === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var r = e.request;
  if (r.method !== "GET") return;
  var u = new URL(r.url);
  // só os arquivos do próprio app; Supabase (dados e fotos) e bibliotecas vão direto para a internet
  if (u.origin !== self.location.origin) return;
  e.respondWith(fetch(r).then(function (resp) {
    if (resp.ok) {
      var copia = resp.clone();
      caches.open(CACHE).then(function (c) { c.put(r, copia); });
    }
    return resp;
  }).catch(function () {
    return caches.match(r, { ignoreSearch: true }).then(function (m) { return m || Response.error(); });
  }));
});
