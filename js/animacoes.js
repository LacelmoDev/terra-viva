// Terra Viva — camada de animação. Aditiva: se falhar, o site continua igual.
const reduz = matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!reduz) iniciar();

function iniciar() {
  const NS = "http://www.w3.org/2000/svg";
  const raiz = document.documentElement;

  // Barra de progresso e parallax do hero, num único rAF por scroll.
  const barra = document.createElement("div");
  barra.className = "anim-progresso";
  barra.setAttribute("aria-hidden", "true");
  document.body.append(barra);
  let esperando = false;
  const medir = () => {
    esperando = false;
    const y = window.scrollY;
    raiz.style.setProperty("--py", Math.min(y, 900));
    barra.style.setProperty("--p", Math.min(1, y / Math.max(1, raiz.scrollHeight - innerHeight)).toFixed(3));
  };
  addEventListener("scroll", () => { if (!esperando) { esperando = true; requestAnimationFrame(medir); } }, { passive: true });
  medir();

  // Entrada quando o elemento aparece no ecrã.
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    // Os três cartões ficam lado a lado no telemóvel: acendem todos, em sequência.
    const grupo = e.target.matches(".rotacao") ? [...e.target.parentElement.querySelectorAll(".rotacao")] : [e.target];
    grupo.forEach((alvo) => {
      alvo.classList.add("anim--on");
        io.unobserve(alvo);
    });
  }), { threshold: 0.12 });
  const preparar = (no, atraso = 0) => {
    if (no.classList.contains("anim")) return;
    no.classList.add("anim");
    no.style.setProperty("--d", atraso + "s");
    io.observe(no);
  };
  document.querySelectorAll("#confianca li").forEach((li, i) => preparar(li, i * 0.1));

  // Nota: a pontuação nunca é animada nem alterada; o número do motor aparece sempre tal como foi calculado.

  // Ponteiro do ano sobre o Relógio (fica no svg, sobrevive às mudanças de cenário).
  function ponteiro(svg) {
    if (svg.querySelector(".rel-ponteiro")) return;
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "rel-ponteiro");
    g.setAttribute("aria-hidden", "true");
    g.innerHTML = '<line x1="350" y1="350" x2="350" y2="36"/><circle cx="350" cy="36" r="5"/>';
    svg.append(g);
  }

  // Reage ao que o site vai desenhando (cartões, Relógio).
  const ver = (no) => {
    if (no.nodeType !== 1) return;
    if (no.matches?.(".rotacao")) {
      const i = [...no.parentElement.children].indexOf(no);
      preparar(no, i * 0.14);
    }
    no.querySelectorAll?.(".rotacao").forEach((c, i) => preparar(c, i * 0.14));
    const svg = no.matches?.("svg.relogio__svg") ? no : no.querySelector?.("svg.relogio__svg");
    if (svg) ponteiro(svg);
    const camada = no.matches?.(".relogio__camada") ? no : null;
    if (camada) camada.querySelectorAll(".relogio__setor").forEach((s) => {
      s.style.setProperty("--n", [...s.parentElement.children].indexOf(s));
    });
  };
  new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach(ver)))
    .observe(document.body, { childList: true, subtree: true });
  document.querySelectorAll(".rotacao,svg.relogio__svg").forEach(ver);

  // Ao mudar de cenário, o palco dá um pequeno pulso.
  document.addEventListener("click", (e) => {
    const botao = e.target.closest?.("#relogio .segmento");
    const palco = document.querySelector(".relogio__palco");
    if (!botao || !palco) return;
    palco.classList.remove("rel-flash");
    void palco.offsetWidth;
    palco.classList.add("rel-flash");
  });
}
