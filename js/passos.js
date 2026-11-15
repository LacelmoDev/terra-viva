// ============================================================================
// Terra Viva — passos.js
// Trilho dos quatro passos, escolha da zona, do solo, das culturas,
// prioridades, restrições e montagem do resultado.
// O estado fica só na memória do separador: nada é enviado para fora.
// ============================================================================

import { CAMINHOS, nomeCultura, pedirJSON, texto } from "./dados.js";
import { criarMapa } from "./mapa.js";
import { iniciarResumoClima, obterClima } from "./clima.js";
import { escolherRotacoes } from "./motor.js";
import { renderResultado } from "./resultado.js";
import { criarRelogio, aplicarCenario } from "./relogio.js";

const TOTAL = 4;
const POUSIO = "pousio";
const CHAVE_ESTADO = "tv:estado";
const NS = "http://www.w3.org/2000/svg";

const estado = {
  passo: 1,
  localId: null,
  solo: null,
  ultima: null,
  anterior: null,
  prioridades: { agua: 1, rendimento: 1, solo: 1, risco: 1 },
  restricoes: { irrigacao: false, maoDeObra: "normal" },
  locais: [],
  culturas: [],
};

let mapa = null;
let clima = null;
let relogio = null;
let elementos = {};

// O estado vive na memória, mas também em sessionStorage: assim mudar de
// língua (que recarrega a página) não obriga a repetir os quatro passos.
function guardarEstado() {
  try {
    sessionStorage.setItem(
      CHAVE_ESTADO,
      JSON.stringify({
        passo: estado.passo,
        localId: estado.localId,
        solo: estado.solo,
        ultima: estado.ultima,
        anterior: estado.anterior,
        prioridades: estado.prioridades,
        restricoes: estado.restricoes,
      })
    );
  } catch (e) {
    /* sem armazenamento: só dura o separador aberto */
  }
}

function restaurarEstado() {
  try {
    const bruto = sessionStorage.getItem(CHAVE_ESTADO);
    if (!bruto) return;
    const guardado = JSON.parse(bruto);
    estado.solo = guardado.solo ?? null;
    estado.ultima = guardado.ultima ?? null;
    estado.anterior = guardado.anterior ?? null;
    estado.localId = guardado.localId ?? null;
    estado.prioridades = { ...estado.prioridades, ...(guardado.prioridades || {}) };
    estado.restricoes = { ...estado.restricoes, ...(guardado.restricoes || {}) };
    estado.passo = Math.min(TOTAL, Math.max(1, Number(guardado.passo) || 1));
  } catch (e) {
    /* estado corrompido: começa do início */
  }
}

export async function iniciarPassos() {
  if (!document.getElementById("trilho")) return; // páginas sem o fluxo

  elementos = {
    trilho: document.getElementById("trilho"),
    passos: [...document.querySelectorAll(".passo")],
    anterior: document.getElementById("botao-anterior"),
    seguinte: document.getElementById("botao-seguinte"),
    listaZonas: document.getElementById("lista-zonas"),
    soloOpcoes: [...document.querySelectorAll(".solo__opcao")],
    mapaSvg: document.getElementById("mapa-svg"),
    angolaContorno: document.getElementById("angola-contorno"),
    mapaPins: document.getElementById("mapa-pins"),
    mapaRotulo: document.getElementById("mapa-rotulo"),
    fluxo: document.getElementById("fluxo"),
    gridUltima: document.getElementById("culturas-ultima"),
    gridAnterior: document.getElementById("culturas-anterior"),
    resultado: document.getElementById("resultado"),
    relogioSecao: document.getElementById("relogio"),
    relogioConteudo: document.getElementById("relogio-conteudo"),
  };

  relogio = criarRelogio(elementos.relogioConteudo, {
    aoMudarCenario: () => atualizarResultado(),
  });

  clima = iniciarResumoClima();
  restaurarEstado();
  ligarTrilho();
  ligarNavegacao();
  ligarSolo();
  ligarPrioridades();
  ligarRestricoes();
  irPara(lerHash() || estado.passo, false);

  await carregarDados();
}

async function carregarDados() {
  elementos.listaZonas.setAttribute("aria-busy", "true");
  try {
    const [dados, catalogo] = await Promise.all([
      pedirJSON(CAMINHOS.locais),
      pedirJSON(CAMINHOS.culturas),
    ]);
    estado.locais = dados.locais;
    estado.culturas = catalogo.culturas;

    desenharListaZonas();
    desenharCulturas();

    mapa = await criarMapa({
      svg: elementos.mapaSvg,
      contorno: elementos.angolaContorno,
      pins: elementos.mapaPins,
      rotulo: elementos.mapaRotulo,
      locais: estado.locais,
      aoEscolher: escolherZona,
    });

    sincronizarInterface();
  } catch (erro) {
    elementos.listaZonas.innerHTML = "";
    const aviso = document.createElement("p");
    aviso.className = "solo__nota";
    aviso.textContent = "Não foi possível carregar as zonas. Verifica a ligação e tenta outra vez.";

    const tentar = document.createElement("button");
    tentar.type = "button";
    tentar.className = "botao botao--fantasma botao--pequeno";
    tentar.style.marginTop = "0.75rem";
    tentar.textContent = "Tentar novamente";
    tentar.addEventListener("click", carregarDados);

    elementos.listaZonas.append(aviso, tentar);
    console.error(erro);
  } finally {
    elementos.listaZonas.setAttribute("aria-busy", "false");
  }
}

// ---------- Zonas ----------

function desenharListaZonas() {
  const lista = elementos.listaZonas;
  lista.innerHTML = "";

  estado.locais.forEach((local) => {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "zona";
    botao.dataset.id = local.id;
    botao.setAttribute("aria-pressed", "false");

    const nome = document.createElement("strong");
    nome.textContent = local.nome;
    const provincia = document.createElement("span");
    provincia.textContent = local.provincia;

    botao.append(nome, provincia);
    botao.addEventListener("click", () => escolherZona(local.id));
    lista.appendChild(botao);
  });
}

function escolherZona(id) {
  estado.localId = id;
  guardarEstado();
  elementos.listaZonas.querySelectorAll(".zona").forEach((botao) => {
    botao.setAttribute("aria-pressed", String(botao.dataset.id === id));
  });
  if (mapa) mapa.atualizar(id);
  if (clima) clima.mostrar(id);
  if (estado.passo === TOTAL) atualizarResultado();
}

// ---------- Culturas ----------

function iconeCultura(id) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(NS, "use");
  use.setAttribute("href", "#i-" + id);
  svg.append(use);
  return svg;
}

function desenharCulturas() {
  const opcoes = [
    ...estado.culturas.map((c) => ({ id: c.id, nome: nomeCultura(c) })),
    { id: POUSIO, nome: texto("passo2.pousio", "Pousio") },
  ];

  const alvos = [
    ["ultima", elementos.gridUltima],
    ["anterior", elementos.gridAnterior],
  ];

  alvos.forEach(([qual, alvo]) => {
    if (!alvo) return;
    alvo.innerHTML = "";
    alvo.setAttribute("aria-busy", "false");

    opcoes.forEach((opcao) => {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "cultura";
      botao.dataset.id = opcao.id;
      botao.setAttribute("aria-pressed", "false");

      const nome = document.createElement("span");
      nome.textContent = opcao.nome;

      botao.append(iconeCultura(opcao.id), nome);
      botao.addEventListener("click", () => escolherCultura(qual, opcao.id));
      alvo.append(botao);
    });
  });
}

function escolherCultura(qual, id) {
  estado[qual] = estado[qual] === id ? null : id;

  const alvo = qual === "ultima" ? elementos.gridUltima : elementos.gridAnterior;
  alvo.querySelectorAll(".cultura").forEach((botao) => {
    botao.setAttribute("aria-pressed", String(botao.dataset.id === estado[qual]));
  });

  guardarEstado();
  if (estado.passo === TOTAL) atualizarResultado();
}

// ---------- Prioridades e restrições ----------

function ligarPrioridades() {
  document.querySelectorAll(".prioridade").forEach((bloco) => {
    const chave = bloco.dataset.prioridade;
    bloco.querySelectorAll(".segmento").forEach((botao) => {
      botao.addEventListener("click", () => {
        estado.prioridades[chave] = Number(botao.dataset.valor);
        bloco.querySelectorAll(".segmento").forEach((outro) => {
          outro.setAttribute("aria-pressed", String(outro === botao));
        });
        guardarEstado();
        if (estado.passo === TOTAL) atualizarResultado();
      });
    });
  });
}

function ligarRestricoes() {
  const irrigacao = document.getElementById("irrigacao");
  if (irrigacao) {
    irrigacao.querySelectorAll("[data-irrigacao]").forEach((botao) => {
      botao.addEventListener("click", () => {
        estado.restricoes.irrigacao = botao.dataset.irrigacao === "true";
        irrigacao.querySelectorAll("[data-irrigacao]").forEach((outro) => {
          outro.setAttribute("aria-pressed", String(outro === botao));
        });
        guardarEstado();
        if (estado.passo === TOTAL) atualizarResultado();
      });
    });
  }

  const mao = document.getElementById("mao-de-obra");
  if (mao) {
    mao.querySelectorAll("[data-mao]").forEach((botao) => {
      botao.addEventListener("click", () => {
        estado.restricoes.maoDeObra = botao.dataset.mao;
        mao.querySelectorAll("[data-mao]").forEach((outro) => {
          outro.setAttribute("aria-pressed", String(outro === botao));
        });
        guardarEstado();
        if (estado.passo === TOTAL) atualizarResultado();
      });
    });
  }
}

// ---------- Solo ----------

function ligarSolo() {
  elementos.soloOpcoes.forEach((botao) => {
    botao.addEventListener("click", () => {
      const valor = botao.dataset.solo;
      estado.solo = estado.solo === valor ? null : valor;
      elementos.soloOpcoes.forEach((outro) => {
        outro.setAttribute("aria-pressed", String(outro.dataset.solo === estado.solo));
      });
      guardarEstado();
    });
  });
}

/** Volta a pintar a interface com o estado guardado (após mudar de língua). */
function sincronizarInterface() {
  if (estado.localId) {
    mapa?.atualizar(estado.localId);
    clima?.mostrar(estado.localId);
  }

  elementos.listaZonas.querySelectorAll(".zona").forEach((botao) => {
    botao.setAttribute("aria-pressed", String(botao.dataset.id === estado.localId));
  });

  const grelhas = [
    [elementos.gridUltima, estado.ultima],
    [elementos.gridAnterior, estado.anterior],
  ];
  grelhas.forEach(([grelha, escolhida]) => {
    if (!grelha) return;
    grelha.querySelectorAll(".cultura").forEach((botao) => {
      botao.setAttribute("aria-pressed", String(botao.dataset.id === escolhida));
    });
  });

  document.querySelectorAll(".prioridade").forEach((bloco) => {
    const chave = bloco.dataset.prioridade;
    bloco.querySelectorAll(".segmento").forEach((botao) => {
      botao.setAttribute(
        "aria-pressed",
        String(Number(botao.dataset.valor) === estado.prioridades[chave])
      );
    });
  });

  document.querySelectorAll("#irrigacao [data-irrigacao]").forEach((botao) => {
    botao.setAttribute(
      "aria-pressed",
      String((botao.dataset.irrigacao === "true") === estado.restricoes.irrigacao)
    );
  });

  document.querySelectorAll("#mao-de-obra [data-mao]").forEach((botao) => {
    botao.setAttribute("aria-pressed", String(botao.dataset.mao === estado.restricoes.maoDeObra));
  });

  elementos.soloOpcoes.forEach((botao) => {
    botao.setAttribute("aria-pressed", String(botao.dataset.solo === estado.solo));
  });

  // Voltar ao passo guardado agora que há dados (e desenhar o resultado).
  irPara(estado.passo, false);
}


// ---------- Navegação ----------

function ligarTrilho() {
  document.addEventListener("click", (evento) => {
    const botao = evento.target.closest("#trilho [data-ir], #nav-inferior [data-ir]");
    if (!botao) return;
    irPara(Number(botao.dataset.ir), true);
  });
}

function ligarNavegacao() {
  elementos.anterior.addEventListener("click", () => irPara(estado.passo - 1, true));
  elementos.seguinte.addEventListener("click", () => irPara(estado.passo + 1, true));
  window.addEventListener("hashchange", () => {
    const passo = lerHash();
    if (passo && passo !== estado.passo) irPara(passo, false);
  });
}

function irPara(numero, atualizarHash) {
  const passo = Math.min(TOTAL, Math.max(1, Number(numero) || 1));
  estado.passo = passo;

  elementos.passos.forEach((seccao) => {
    const ativo = Number(seccao.dataset.passo) === passo;
    seccao.toggleAttribute("data-ativo", ativo);
    seccao.hidden = !ativo;
  });

  elementos.trilho.querySelectorAll("[data-ir]").forEach((botao) => {
    if (Number(botao.dataset.ir) === passo) {
      botao.setAttribute("aria-current", "step");
    } else {
      botao.removeAttribute("aria-current");
    }
  });

  elementos.anterior.disabled = passo === 1;
  elementos.seguinte.hidden = passo === TOTAL;

  marcarProgresso(passo);

  guardarEstado();
  if (passo === TOTAL) atualizarResultado();

  if (atualizarHash) {
    const novo = "#passo-" + passo;
    if (window.location.hash !== novo) history.replaceState(null, "", novo);
    const caixa = elementos.fluxo.getBoundingClientRect();
    if (caixa.top < 0) elementos.fluxo.scrollIntoView({ block: "start" });
  }
}

// "Passo 2 de 4" e a barra inferior do telemóvel dizem sempre onde estás.
function marcarProgresso(passo) {
  const indicador = document.getElementById("progresso-passos");
  if (indicador) {
    const forte = indicador.querySelector("strong");
    const rotulo = indicador.querySelector("[data-i18n]");
    if (forte) {
      forte.textContent = texto("fluxo.passoDe", "Passo {n} de 4").replace("{n}", String(passo));
    }
    if (rotulo) rotulo.textContent = texto("fluxo.passos." + passo, rotulo.textContent);
  }

  document.querySelectorAll("#nav-inferior [data-ir]").forEach((botao) => {
    if (Number(botao.dataset.ir) === passo) botao.setAttribute("aria-current", "step");
    else botao.removeAttribute("aria-current");
  });
}

// ---------- Resultado ----------

let pedidoEmCurso = 0;

async function atualizarResultado() {
  const alvo = elementos.resultado;
  if (!alvo) return;
  const meuPedido = ++pedidoEmCurso;

  const aviso = (chave) => {
    alvo.replaceChildren();
    if (elementos.relogioSecao) elementos.relogioSecao.hidden = true;
    const p = document.createElement("p");
    p.className = "clima__vazio";
    p.textContent = texto(chave, "");
    alvo.append(p);
  };

  if (!estado.localId) return aviso("passo4.semZona");
  if (!estado.ultima || estado.ultima === POUSIO) return aviso("passo4.semCultura");
  // As culturas ainda estão a chegar: não vale a pena anunciar erro.
  if (!estado.culturas.length) return;

  try {
    const climaBase = await obterClima(estado.localId);
    if (meuPedido !== pedidoEmCurso) return; // chegou outro pedido entretanto
    const dadosClima = aplicarCenario(climaBase, relogio.lerCenario());
    const resultado = escolherRotacoes({
      clima: dadosClima,
      catalogo: { culturas: estado.culturas },
      historico: {
        ultima: estado.ultima,
        anterior: estado.anterior === POUSIO ? null : estado.anterior,
      },
      prioridades: estado.prioridades,
      restricoes: estado.restricoes,
    });

    if (meuPedido !== pedidoEmCurso) return;
    if (resultado.erro) return aviso("resultado.erro");

    if (elementos.relogioSecao) elementos.relogioSecao.hidden = false;
    relogio.atualizar({ clima: dadosClima, resultado, culturas: estado.culturas });
    renderResultado(alvo, resultado, { clima: dadosClima, culturas: estado.culturas });
  } catch (erro) {
    console.error(erro);
    aviso("resultado.erro");
  }
}

function lerHash() {
  const achado = window.location.hash.match(/passo-(\d)/);
  return achado ? Number(achado[1]) : null;
}

export function lerEstado() {
  return { ...estado };
}
