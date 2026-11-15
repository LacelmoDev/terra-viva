// ============================================================================
// Terra Viva — animacoes.js
// Camada de movimento, separada do resto: não lê nem calcula dados e não
// muda nenhuma pontuação. Liga-se ao que já está desenhado (e ao que é
// desenhado depois, por observação do DOM) e só mexe em classes.
//
// Se este ficheiro falhar, nada se perde: sem a classe html.tv-anima o CSS
// desta camada não esconde nada.
// ============================================================================

import { formatarNumero } from "./dados.js";

const NS = "http://www.w3.org/2000/svg";
const CX = 350;
const CY = 350;

// Com movimento reduzido não se anima nada, mas o que é informação — o
// marcador do dia de hoje no relógio — continua a aparecer, parado.
const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
iniciar(reduzido);

function iniciar(semMovimento) {
  if (semMovimento) {
    relogioAnimado(true);
    return;
  }

  document.documentElement.classList.add("tv-anima");

  progressoLeitura();
  parallaxHero();
  garoaDoHero();
  trilhoProgresso();
  direcaoDosPassos();
  sinaisDoMapa();
  cartoesDoResultado();
  relogioAnimado(false);
}

// Uma só fila de fotogramas para todos os efeitos de scroll.
const fila = new Set();
let pedido = false;

function noProximoQuadro(tarefa) {
  fila.add(tarefa);
  if (pedido) return;
  pedido = true;
  requestAnimationFrame(() => {
    pedido = false;
    const agora = [...fila];
    fila.clear();
    agora.forEach((t) => t());
  });
}

// ---------- Barra de progresso de leitura ----------

function progressoLeitura() {
  const barra = document.createElement("div");
  barra.className = "tv-progresso";
  barra.setAttribute("aria-hidden", "true");
  document.body.append(barra);

  const medir = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progresso = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    barra.style.setProperty("--p", progresso.toFixed(4));
    barra.classList.toggle("tv-progresso--visivel", window.scrollY > 160);
  };

  window.addEventListener("scroll", () => noProximoQuadro(medir), { passive: true });
  window.addEventListener("resize", () => noProximoQuadro(medir));
  medir();
}

// ---------- Hero: camadas com parallax suave ----------

function parallaxHero() {
  const hero = document.querySelector(".hero");
  const motivo = document.querySelector(".hero__motivo");
  const contornos = document.querySelector(".hero__contornos");
  if (!hero || !motivo) return;

  const mover = () => {
    const y = window.scrollY;
    if (y > hero.offsetHeight * 1.4) return;
    motivo.style.transform = "translate3d(0, " + (-y * 0.06).toFixed(1) + "px, 0)";
    if (contornos) {
      contornos.style.transform = "translate3d(0, " + (y * 0.035).toFixed(1) + "px, 0)";
    }
  };

  window.addEventListener("scroll", () => noProximoQuadro(mover), { passive: true });
  mover();
}

// ---------- Hero: uma camada de garoa por cima da chuva desenhada ----------

function garoaDoHero() {
  const hero = document.querySelector(".hero");
  if (!hero) return;
  const camada = document.createElement("div");
  camada.className = "tv-garoa";
  camada.setAttribute("aria-hidden", "true");
  const chuva = document.getElementById("chuva");
  hero.insertBefore(camada, chuva ? chuva.nextSibling : hero.firstChild);
}

// ---------- Trilho: linha de progresso que avança ----------

function trilhoProgresso() {
  const trilho = document.getElementById("trilho");
  if (!trilho) return;

  const pintar = () => {
    const atual = trilho.querySelector('[aria-current="step"]');
    const numero = atual ? Number(atual.dataset.ir) : 1;
    trilho.style.setProperty("--p", (numero / 4).toFixed(3));
  };

  new MutationObserver(pintar).observe(trilho, {
    attributes: true,
    subtree: true,
    attributeFilter: ["aria-current"],
  });
  pintar();
}

// ---------- Passos: o sentido do movimento diz se avanças ou recuas ----------

function direcaoDosPassos() {
  const passos = document.getElementById("passos");
  if (!passos) return;

  const atual = () => {
    const marcado = document.querySelector('#trilho [aria-current="step"]');
    return marcado ? Number(marcado.dataset.ir) : 1;
  };

  document.addEventListener(
    "click",
    (evento) => {
      const botao = evento.target.closest("#botao-seguinte, #botao-anterior, #trilho [data-ir]");
      if (!botao) return;

      let direcao = "frente";
      if (botao.id === "botao-anterior") direcao = "tras";
      else if (botao.dataset.ir) direcao = Number(botao.dataset.ir) < atual() ? "tras" : "frente";

      passos.dataset.direcao = direcao;
    },
    true
  );
}

// ---------- Mapa: pontos a emitir sinal e resposta ao toque ----------

function sinaisDoMapa() {
  const pins = document.getElementById("mapa-pins");
  if (pins) {
    const numerar = () => {
      pins.querySelectorAll(".pin").forEach((pin, indice) => {
        if (pin.dataset.tv) return;
        pin.dataset.tv = "1";
        pin.style.setProperty("--k", String(indice % 8));
      });
    };
    new MutationObserver(numerar).observe(pins, { childList: true });
    numerar();
  }

  document.addEventListener("click", (evento) => {
    if (!evento.target.closest(".pin, .zona")) return;
    const rotulo = document.getElementById("mapa-rotulo");
    if (!rotulo) return;
    rotulo.classList.remove("tv-novo");
    void rotulo.offsetWidth;
    rotulo.classList.add("tv-novo");
  });
}

// ---------- Resultado: cartões em sequência, nota a contar, barras a encher ----------

function cartoesDoResultado() {
  const alvo = document.getElementById("resultado");
  if (!alvo) return;

  const animar = () => {
    const grelha = alvo.querySelector(".rotacoes");
    if (!grelha || grelha.dataset.tv === "1") return;
    grelha.dataset.tv = "1";
    // Num separador escondido não há fotogramas: aparece tudo, sem esconder nada.
    if (document.hidden) return;

    grelha.classList.add("tv-cartoes", "tv-barras");

    const cartoes = [...grelha.children];

    // A classe que esconde os cartões só pode sair quando a entrada acaba: é
    // ela que tem o opacity 0. Sai uma vez, no fim do último cartão, e há uma
    // rede de segurança — o conteúdo nunca fica invisível à espera de um evento.
    const mostrar = () => {
      if (grelha.dataset.fim === "1") return;
      grelha.dataset.fim = "1";
      grelha.classList.remove("tv-cartoes");
    };

    let terminados = 0;
    grelha.addEventListener("animationend", (evento) => {
      if (!evento.target.classList.contains("rotacao")) return;
      terminados += 1;
      if (terminados >= cartoes.length) mostrar();
    });

    cartoes.forEach((cartao, indice) => {
      cartao.style.setProperty("--k", String(indice));
      const nota = cartao.querySelector(".rotacao__ponto");
      if (nota) contarNota(nota);
    });

    grelha
      .querySelectorAll(".barra")
      .forEach((barra, indice) => barra.style.setProperty("--k", String(indice)));

    requestAnimationFrame(() =>
      requestAnimationFrame(() => grelha.classList.add("tv-cheias"))
    );

    window.setTimeout(mostrar, 2000);
  };

  new MutationObserver(animar).observe(alvo, { childList: true });
  animar();
}

function contarNota(nota) {
  const valor = nota.firstChild;
  if (!valor || valor.nodeType !== 3) return;
  if (document.hidden) return; // sem fotogramas não se anima nada: fica o valor final

  const alvo = Number(valor.nodeValue.replace(/[^0-9]/g, ""));
  if (!Number.isFinite(alvo)) return;

  const inicio = performance.now();
  const duracao = 760;

  const passo = (agora) => {
    // O carimbo do fotograma pode ser anterior ao clique: nunca abaixo de zero.
    const t = Math.min(1, Math.max(0, (agora - inicio) / duracao));
    const suave = 1 - Math.pow(1 - t, 3);
    valor.nodeValue = formatarNumero(Math.round(alvo * suave));
    if (t < 1) requestAnimationFrame(passo);
    else valor.nodeValue = formatarNumero(alvo);
  };

  valor.nodeValue = formatarNumero(0);
  requestAnimationFrame(passo);
}

// ---------- Relógio: onda de setores, marcador do agora, pulso ----------

function relogioAnimado(semMovimento) {
  const conteudo = document.getElementById("relogio-conteudo");
  if (!conteudo) return;

  let porDentro = false;

  const sincronizar = () => {
    if (porDentro) return;
    const svg = conteudo.querySelector(".relogio__svg");
    if (!svg) return;

    porDentro = true;

    let mudou = false;
    svg.querySelectorAll(".relogio__camada:not([data-tv])").forEach((camada) => {
      camada.dataset.tv = "1";
      if (!semMovimento) {
        camada.classList.add("tv-onda");
        camada
          .querySelectorAll(".relogio__setor")
          .forEach((setor, indice) => setor.style.setProperty("--k", String(indice)));
      }
      mudou = true;
    });

    // Sem camada nova não se mexe no desenho — senão as mutações voltavam a
    // chamar esta função para sempre.
    if (mudou) {
      marcarAgora(svg);
      if (!semMovimento) {
        svg.classList.remove("tv-pulso");
        void svg.getBoundingClientRect();
        svg.classList.add("tv-pulso");
      }
    }

    porDentro = false;
  };

  // Sem requestAnimationFrame: o desenho do relógio tem de ficar marcado mesmo
  // num separador escondido, onde não correm fotogramas.
  new MutationObserver(sincronizar).observe(conteudo, {
    childList: true,
    subtree: true,
  });

  sincronizar();
}

/** Uma marca fina no dia de hoje: o "agora" do ano da terra. */
function marcarAgora(svg) {
  let grupo = svg.querySelector(".relogio__agora");
  if (!grupo) {
    grupo = document.createElementNS(NS, "g");
    grupo.setAttribute("class", "relogio__agora");
    grupo.setAttribute("aria-hidden", "true");
    const agulha = document.createElementNS(NS, "line");
    const ponta = document.createElementNS(NS, "line");
    ponta.setAttribute("class", "relogio__agora-ponta");
    grupo.append(agulha, ponta, document.createElementNS(NS, "circle"));
  }

  const angulo = anguloDeHoje();
  const [agulha, ponta] = grupo.querySelectorAll("line");
  const ponto = grupo.querySelector("circle");
  const cos = Math.cos(angulo);
  const sin = Math.sin(angulo);
  const marcar = (raio) => [
    (CX + cos * raio).toFixed(1),
    (CY + sin * raio).toFixed(1),
  ];

  const [x1, y1] = marcar(148);
  const [x2, y2] = marcar(330);
  agulha.setAttribute("x1", x1);
  agulha.setAttribute("y1", y1);
  agulha.setAttribute("x2", x2);
  agulha.setAttribute("y2", y2);

  const [x3, y3] = marcar(335);
  const [x4, y4] = marcar(346);
  ponta.setAttribute("x1", x3);
  ponta.setAttribute("y1", y3);
  ponta.setAttribute("x2", x4);
  ponta.setAttribute("y2", y4);

  const [cx, cy] = marcar(341);
  ponto.setAttribute("cx", cx);
  ponto.setAttribute("cy", cy);
  ponto.setAttribute("r", "3");

  svg.append(grupo);
}

function anguloDeHoje() {
  const hoje = new Date();
  const inicioDoAno = new Date(hoje.getFullYear(), 0, 1);
  const dias = Math.floor((hoje - inicioDoAno) / 86400000) + 1;
  return ((dias - 1) / 365) * Math.PI * 2 - Math.PI / 2;
}
