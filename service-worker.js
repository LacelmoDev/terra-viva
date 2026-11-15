// ============================================================================
// Terra Viva — service-worker.js
// Shell em cache-first, dados em stale-while-revalidate, navegação com
// rede primeiro e recurso à cópia guardada. Muda a versão para forçar
// a substituição das caches antigas.
// ============================================================================

const VERSAO = "terra-viva-v21";

const SHELL = [
  "./",
  "./index.html",
  "./sobre.html",
  "./fontes.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./css/tokens.css",
  "./css/base.css",
  "./css/componentes.css",
  "./css/relogio.css",
  "./css/animacoes.css",
  "./js/app.js",
  "./js/animacoes.js",
  "./js/clima.js",
  "./js/dados.js",
  "./js/mapa.js",
  "./js/motor.js",
  "./js/resultado.js",
  "./js/relogio.js",
  "./js/passos.js",
  "./js/pwa.js",
  "./textos/pt.json",
  "./textos/en.json",
  "./dados/locais.json",
  "./dados/angola.json",
  "./dados/clima/_meta.json",
  "./dados/clima/benguela.json",
  "./dados/clima/huambo.json",
  "./dados/clima/kuito.json",
  "./dados/clima/lubango.json",
  "./dados/clima/malanje.json",
  "./dados/clima/ondjiva.json",
  "./dados/clima/uige.json",
  "./dados/clima/waku-kungo.json",
  "./dados/culturas.json",
  "./icons/favicon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon-180.png",
  "./fontes/fraunces-latin.woff2",
  "./fontes/fraunces-latin-ext.woff2",
  "./fontes/karla-latin.woff2",
  "./fontes/karla-latin-ext.woff2",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(instalar());
});

// Pré-carga com cache: "reload" — assim uma versão nova do site nunca fica
// presa a uma cópia antiga da cache HTTP do browser.
async function instalar() {
  const cache = await caches.open(VERSAO);
  await Promise.all(
    SHELL.map(async (url) => {
      try {
        const resposta = await fetch(new Request(url, { cache: "reload" }));
        if (resposta && resposta.ok) await cache.put(url, resposta);
      } catch (erro) {
        // Um ficheiro em falta não deve impedir a instalação; o fetch normal
        // volta a tentá-lo mais tarde.
        console.warn("Pré-carga falhou:", url);
      }
    })
  );
  await self.skipWaiting();
}

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((nome) => nome !== VERSAO).map((nome) => caches.delete(nome))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET") return;

  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;

  if (pedido.mode === "navigate") {
    evento.respondWith(navegacao(pedido));
    return;
  }

  if (url.pathname.includes("/dados/") || url.pathname.includes("/textos/")) {
    evento.respondWith(revalidar(pedido));
    return;
  }

  evento.respondWith(cachePrimeiro(pedido));
});

async function navegacao(pedido) {
  try {
    return await fetch(pedido);
  } catch (erro) {
    const cache = await caches.open(VERSAO);
    return (
      (await cache.match(pedido)) ||
      (await cache.match("./index.html")) ||
      (await cache.match("./offline.html")) ||
      Response.error()
    );
  }
}

async function revalidar(pedido) {
  const cache = await caches.open(VERSAO);
  const guardado = await cache.match(pedido);

  const daRede = fetch(pedido)
    .then((resposta) => {
      if (resposta && resposta.ok) cache.put(pedido, resposta.clone());
      return resposta;
    })
    .catch(() => null);

  if (guardado) return guardado;
  return (await daRede) || Response.error();
}

async function cachePrimeiro(pedido) {
  const cache = await caches.open(VERSAO);
  const guardado = await cache.match(pedido);
  if (guardado) return guardado;

  try {
    const resposta = await fetch(pedido);
    if (resposta && resposta.ok) cache.put(pedido, resposta.clone());
    return resposta;
  } catch (erro) {
    return Response.error();
  }
}
