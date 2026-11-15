// ============================================================================
// Terra Viva — pwa.js
// Registo do service worker e aviso discreto de modo offline com a data
// da última atualização guardada no aparelho.
// ============================================================================

import { formatarData, lerAtualizacao, texto } from "./dados.js";

export function iniciarPwa() {
  registarServiceWorker();
  configurarAvisoOffline();
}

async function registarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
    // Fora de HTTPS o browser não aceita service workers: o site funciona, sem offline garantido.
    return;
  }
  try {
    await navigator.serviceWorker.register(new URL("../service-worker.js", import.meta.url), {
      scope: "../",
    });
  } catch (erro) {
    console.warn("Service worker não registado:", erro);
  }
}

function configurarAvisoOffline() {
  const aviso = document.getElementById("aviso-offline");
  const dataEl = document.getElementById("aviso-data");
  if (!aviso) return;

  const atualizar = () => {
    const offline = navigator.onLine === false;
    aviso.hidden = !offline;
    if (!offline || !dataEl) return;

    const data = lerAtualizacao();
    dataEl.textContent =
      texto("offline.ultima", "Última atualização:") +
      " " +
      (data ? formatarData(data) : texto("offline.nunca", "ainda sem dados descarregados"));
  };

  atualizar();
  window.addEventListener("online", atualizar);
  window.addEventListener("offline", atualizar);
}
