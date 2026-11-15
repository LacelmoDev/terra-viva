// ============================================================================
// Terra Viva — mapa.js
// Desenha o contorno de Angola (Natural Earth) e os pontos das zonas.
// A projeção vem escrita no JSON gerado por tools/build-map.mjs,
// por isso o contorno e os pontos usam sempre a mesma transformação.
// ============================================================================

import { CAMINHOS, pedirJSON, texto } from "./dados.js";

export async function criarMapa({ svg, contorno, pins, rotulo, locais, aoEscolher }) {
  const geo = await pedirJSON(CAMINHOS.angola);
  // viewBox = [mínimoX, mínimoY, largura, altura]
  const largura = geo.viewBox[2];
  const altura = geo.viewBox[3];

  svg.setAttribute("viewBox", geo.viewBox.join(" "));
  svg.dataset.fonte = geo.fonte.nome;
  contorno.setAttribute("d", geo.contorno);

  const { lon0, lat0, kx, ky } = geo.proj;
  const botoes = new Map();

  locais.forEach((local) => {
    const x = (local.lon - lon0) * kx;
    const y = (lat0 - local.lat) * ky;

    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "pin";
    botao.dataset.id = local.id;
    botao.setAttribute("aria-pressed", "false");
    botao.setAttribute("aria-label", texto("a11y.pin", "Escolher a zona de") + " " + local.nome);
    botao.style.left = (x / largura) * 100 + "%";
    botao.style.top = (y / altura) * 100 + "%";
    botao.addEventListener("click", () => aoEscolher(local.id));

    pins.appendChild(botao);
    botoes.set(local.id, botao);
  });

  function atualizar(idSelecionado) {
    botoes.forEach((botao, id) => {
      botao.setAttribute("aria-pressed", String(id === idSelecionado));
    });

    const local = locais.find((l) => l.id === idSelecionado);
    if (!local) return;

    rotulo.textContent = "";
    const forte = document.createElement("strong");
    forte.textContent = local.nome;
    rotulo.append(texto("passo1.escolhida", "Zona escolhida") + ": ", forte, " · " + local.provincia);
  }

  return { atualizar };
}
