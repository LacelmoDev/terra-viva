// ============================================================================
// Terra Viva — app.js
// Arranque: textos, tema, motivo do hero, chuva do hero, revelações ao scroll
// e ligação do fluxo de quatro passos.
// ============================================================================

import { aplicarTextos, carregarTextos, definirIdioma, idioma } from "./dados.js";
import { iniciarPassos } from "./passos.js";
import { iniciarPwa } from "./pwa.js";

const NS = "http://www.w3.org/2000/svg";
const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

async function arrancar() {
  iniciarTema();
  iniciarIdioma();
  desenharMeses();
  iniciarChuva();
  iniciarRevelacoes();

  try {
    const textos = await carregarTextos();
    aplicarTextos(textos);
  } catch (erro) {
    // Sem internet na primeira visita: o HTML já tem o texto em português.
    console.warn("Textos não carregados, a usar o texto do HTML:", erro);
  }

  await iniciarPassos();
  iniciarPwa();
}

// ---------- Tema ----------
function iniciarTema() {
  const botao = document.getElementById("botao-tema");
  const raiz = document.documentElement;
  if (!botao) return;

  const aplicar = (tema) => {
    if (tema === "campo") {
      raiz.setAttribute("data-tema", "campo");
      botao.setAttribute("aria-pressed", "true");
    } else {
      raiz.removeAttribute("data-tema");
      botao.setAttribute("aria-pressed", "false");
    }
  };

  aplicar(raiz.getAttribute("data-tema") === "campo" ? "campo" : "claro");

  botao.addEventListener("click", () => {
    const novo = raiz.getAttribute("data-tema") === "campo" ? "claro" : "campo";
    aplicar(novo);
    try {
      localStorage.setItem("tv:tema", novo);
    } catch (e) {
      /* sem armazenamento: o tema só dura a sessão */
    }
  });
}

// ---------- Idioma ----------
// Mudar de língua recarrega a página: os textos vêm todos de JSON e os
// componentes (mapa, clima, relógio, cartões) são desenhados no arranque.
// O estado dos passos fica em sessionStorage e é reposto a seguir.
function iniciarIdioma() {
  const botoes = [...document.querySelectorAll("[data-lingua]")];
  if (!botoes.length) return;

  const atual = idioma();
  botoes.forEach((botao) => {
    botao.setAttribute("aria-pressed", String(botao.dataset.lingua === atual));
    botao.addEventListener("click", () => {
      if (botao.dataset.lingua === idioma()) return;
      definirIdioma(botao.dataset.lingua);
      window.location.reload();
    });
  });
}

// ---------- Doze meses em volta do motivo ----------
function desenharMeses() {
  const grupo = document.getElementById("motivo-meses");
  if (!grupo) return;

  const letras = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  const centro = 160;

  letras.forEach((letra, indice) => {
    const angulo = (indice / 12) * Math.PI * 2 - Math.PI / 2;
    const cos = Math.cos(angulo);
    const sin = Math.sin(angulo);

    const risco = document.createElementNS(NS, "line");
    risco.setAttribute("class", "motivo__risco");
    risco.setAttribute("x1", String(centro + cos * 129));
    risco.setAttribute("y1", String(centro + sin * 129));
    risco.setAttribute("x2", String(centro + cos * 135));
    risco.setAttribute("y2", String(centro + sin * 135));
    grupo.appendChild(risco);

    const mes = document.createElementNS(NS, "text");
    mes.setAttribute("class", "motivo__mes");
    mes.setAttribute("x", String(centro + cos * 148));
    mes.setAttribute("y", String(centro + sin * 148 + 3.8));
    mes.textContent = letra;
    grupo.appendChild(mes);
  });
}

// ---------- Chuva leve no hero (canvas, só transform/alpha) ----------
function iniciarChuva() {
  const tela = document.getElementById("chuva");
  if (!tela || reduzirMovimento) return;

  const ctx = tela.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let largura = 0;
  let altura = 0;
  let gotas = [];
  let desenho = null;
  let visivel = true;

  const novaGota = (noTopo) => ({
    x: Math.random() * (largura + 80) - 40,
    y: noTopo ? -20 - Math.random() * 120 : Math.random() * altura,
    comprimento: 9 + Math.random() * 20,
    velocidade: 1.1 + Math.random() * 2.2,
    alfa: 0.06 + Math.random() * 0.2,
  });

  function medir() {
    const caixa = tela.getBoundingClientRect();
    largura = Math.max(1, caixa.width);
    altura = Math.max(1, caixa.height);
    tela.width = Math.round(largura * dpr);
    tela.height = Math.round(altura * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const quantidade = Math.round(Math.min(90, largura / 11));
    gotas = Array.from({ length: quantidade }, () => novaGota(false));
  }

  function passo() {
    ctx.clearRect(0, 0, largura, altura);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#d8d0be";
    ctx.beginPath();

    for (const gota of gotas) {
      gota.y += gota.velocidade;
      gota.x -= gota.velocidade * 0.3;

      ctx.globalAlpha = gota.alfa;
      ctx.moveTo(gota.x, gota.y);
      ctx.lineTo(gota.x + gota.comprimento * 0.3, gota.y + gota.comprimento);

      if (gota.y > altura + 20 || gota.x < -20) Object.assign(gota, novaGota(true));
    }

    ctx.stroke();
    ctx.globalAlpha = 1;
    desenho = requestAnimationFrame(passo);
  }

  function parar() {
    if (desenho) cancelAnimationFrame(desenho);
    desenho = null;
  }

  function retomar() {
    if (!desenho && visivel && !document.hidden) desenho = requestAnimationFrame(passo);
  }

  medir();
  retomar();

  let temporizador = null;
  window.addEventListener("resize", () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(medir, 180);
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entradas) => {
        visivel = entradas[0].isIntersecting;
        visivel ? retomar() : parar();
      },
      { threshold: 0.01 }
    ).observe(tela);
  }

  document.addEventListener("visibilitychange", () => {
    document.hidden ? parar() : retomar();
  });
}

// ---------- Revelações ao scroll ----------
function iniciarRevelacoes() {
  const alvos = document.querySelectorAll(".revelar");
  if (!("IntersectionObserver" in window)) {
    alvos.forEach((el) => el.classList.add("visivel"));
    return;
  }

  const observador = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((entrada) => {
        if (!entrada.isIntersecting) return;
        entrada.target.classList.add("visivel");
        observador.unobserve(entrada.target);
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -6% 0px" }
  );

  alvos.forEach((el) => observador.observe(el));
}

arrancar();
