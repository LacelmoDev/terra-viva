// Terra Viva — extras de apoio ao agricultor: procurar município, ouvir e partilhar o resultado.
const EN = () => document.documentElement.lang.startsWith("en");
const T = (pt, en) => (EN() ? en : pt);
const rad = (g) => (g * Math.PI) / 180;
const km = (a, b, c, d) => {
  const h = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};
const base = new URL("../", import.meta.url);
const ler = (f) => fetch(new URL(f, base)).then((r) => r.json());

/* ---------- 1. Procurar município: liga à zona NASA mais próxima ---------- */
async function iniciarMunicipios() {
  const lista = document.getElementById("lista-zonas");
  if (!lista || document.getElementById("muni")) return;
  let muni, locais;
  try { [muni, locais] = await Promise.all([ler("dados/municipios.json"), ler("dados/locais.json")]); } catch { return; }
  const zonas = locais.locais;
  const caixa = document.createElement("div");
  caixa.id = "muni";
  caixa.className = "muni";
  caixa.innerHTML = `<h3 class="muni__titulo"></h3>
    <label class="muni__campo"><span class="muni__rotulo" data-r="p"></span><select id="muni-prov"></select></label>
    <label class="muni__campo"><span class="muni__rotulo" data-r="m"></span><select id="muni-mun" disabled></select></label>
    <p class="muni__nota" id="muni-nota" aria-live="polite"></p>`;
  lista.before(caixa);
  const prov = caixa.querySelector("#muni-prov"), mun = caixa.querySelector("#muni-mun"), nota = caixa.querySelector("#muni-nota");
  const textos = () => {
    caixa.querySelector(".muni__titulo").textContent = T("Procura o teu município", "Find your municipality");
    caixa.querySelector('[data-r="p"]').textContent = T("Província", "Province");
    caixa.querySelector('[data-r="m"]').textContent = T("Município", "Municipality");
    prov.innerHTML = `<option value="">${T("Escolhe", "Choose")}</option>` +
      Object.keys(muni.provincias).map((p) => `<option>${p}</option>`).join("");
  };
  textos();
  prov.addEventListener("change", () => {
    mun.disabled = !prov.value;
    mun.innerHTML = `<option value="">${T("Escolhe", "Choose")}</option>` +
      (muni.provincias[prov.value] || []).map((m, i) => `<option value="${i}">${m[0]}</option>`).join("");
    nota.textContent = "";
  });
  mun.addEventListener("change", () => {
    const m = (muni.provincias[prov.value] || [])[Number(mun.value)];
    if (!m) return;
    const perto = zonas.map((z) => ({ z, d: km(m[1], m[2], z.lat, z.lon) })).sort((a, b) => a.d - b.d)[0];
    lista.querySelector(`.zona[data-id="${perto.z.id}"]`)?.click();
    const d = Math.round(perto.d);
    const aviso = d <= 120 ? "" : d <= 250
      ? T(" A chuva e o calor podem ser diferentes na tua terra.", " Rain and heat may differ where you farm.")
      : T(" Está longe: usa os números só como indicação.", " It is far away: treat the numbers as a rough guide only.");
    nota.textContent = T(`${m[0]} fica a cerca de ${d} km de ${perto.z.nome}. Usamos os dados dessa zona.`,
      `${m[0]} is about ${d} km from ${perto.z.nome}. We use that zone's data.`) + aviso;
    nota.dataset.longe = d > 120 ? "1" : "0";
  });
  new MutationObserver(() => { if (document.documentElement.lang !== caixa.dataset.l) { caixa.dataset.l = document.documentElement.lang; textos(); } })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
}

/* ---------- 2. Resultado: ouvir e partilhar com o técnico ---------- */
const limpo = (t) => t.replace(/\s+/g, " ").trim();
function resumo() {
  const zona = limpo(document.querySelector("#lista-zonas .zona[aria-pressed=true] strong")?.textContent || "");
  const linhas = [...document.querySelectorAll("#resultado .rotacao")].map((c) => {
    const nome = limpo(c.querySelector(".rotacao__titulo")?.textContent || "");
    const ponto = limpo(c.querySelector(".rotacao__ponto")?.firstChild?.textContent || "");
    const culturas = [...c.querySelectorAll(".rotacao__epoca")].map((li) => limpo(li.lastChild?.textContent || "")).join(" → ");
    return `• ${nome}: ${ponto}/100 — ${culturas}`;
  });
  return { zona, linhas };
}
const textoPartilha = () => {
  const { zona, linhas } = resumo();
  return [T("Terra Viva — comparação de rotações de culturas", "Terra Viva — crop rotation comparison"),
    zona && T(`Zona: ${zona}`, `Zone: ${zona}`), ...linhas, "",
    T("A pontuação compara as rotações entre si; não é previsão de colheita. Dados de clima: NASA POWER. Culturas: FAO EcoCrop. Confirma com um técnico agrícola da tua zona.",
      "The score compares the rotations with each other; it is not a harvest forecast. Climate data: NASA POWER. Crops: FAO EcoCrop. Check with a local agricultural technician."),
    location.href.split("#")[0]].filter((x) => x !== false && x !== "" || x === "").join("\n");
};
const textoVoz = () => {
  const { zona, linhas } = resumo();
  return T(`Zona ${zona}. ${linhas.join(". ").replace(/•/g, "").replace(/→/g, ", depois ")}. A pontuação compara as rotações; não é previsão de colheita. Confirma com um técnico agrícola.`,
    `Zone ${zona}. ${linhas.join(". ").replace(/•/g, "").replace(/→/g, ", then ")}. The score compares rotations; it is not a harvest forecast. Check with an agricultural technician.`);
};
function barra() {
  const b = document.createElement("div");
  b.className = "extras-barra";
  b.innerHTML = `<button type="button" class="botao botao--pequeno" id="ex-ouvir"></button>
    <button type="button" class="botao botao--pequeno botao--fantasma" id="ex-partilhar"></button>
    <span class="extras-barra__msg" id="ex-msg" role="status"></span>`;
  const ouvir = b.querySelector("#ex-ouvir"), part = b.querySelector("#ex-partilhar"), msg = b.querySelector("#ex-msg");
  const voz = "speechSynthesis" in window;
  const rot = () => { ouvir.textContent = speechSynthesis?.speaking ? T("Parar", "Stop") : T("Ouvir", "Listen"); part.textContent = T("Partilhar com o técnico", "Share with an expert"); };
  rot();
  if (!voz) ouvir.hidden = true;
  ouvir.addEventListener("click", () => {
    if (speechSynthesis.speaking) { speechSynthesis.cancel(); return rot(); }
    const u = new SpeechSynthesisUtterance(textoVoz());
    const v = speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith(EN() ? "en" : "pt"));
    u.lang = v?.lang || (EN() ? "en-GB" : "pt-PT"); if (v) u.voice = v; u.rate = 0.95;
    u.onend = u.onerror = rot;
    speechSynthesis.speak(u); rot();
  });
  part.addEventListener("click", async () => {
    const texto = textoPartilha();
    try { if (navigator.share) { await navigator.share({ title: "Terra Viva", text: texto }); return; } } catch (e) { if (e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(texto); msg.textContent = T("Copiado. Cola numa mensagem.", "Copied. Paste it into a message."); }
    catch { window.open("https://wa.me/?text=" + encodeURIComponent(texto), "_blank", "noopener"); }
  });
  return b;
}
function ligarResultado() {
  const alvo = document.getElementById("resultado");
  if (!alvo) return;
  const ver = () => {
    if (!alvo.querySelector(".rotacao") || alvo.querySelector(".extras-barra")) return;
    const nota = alvo.querySelector(".resultado__nota");
    (nota ? nota.after(barra()) : alvo.prepend(barra()));
  };
  new MutationObserver(ver).observe(alvo, { childList: true });
  ver();
}

const iniciar = () => { iniciarMunicipios(); ligarResultado(); };
document.readyState === "loading" ? addEventListener("DOMContentLoaded", iniciar) : iniciar();
