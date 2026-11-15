// ============================================================================
// Terra Viva — dados.js
// Carregamento de JSON, textos (pt/en), formatação e carimbo da atualização.
// Nenhum número é calculado aqui: só se lê o que os scripts de tools/ geraram.
// ============================================================================

const RAIZ = new URL("../", import.meta.url);
const CHAVE_LINGUA = "tv:lingua";
const CHAVE_ATUALIZACAO = "tv:atualizadoEm";

// Idioma da interface. Os dados (clima, culturas) não mudam: mudam os nomes.
const LOCAIS_IDIOMA = { pt: "pt-AO", en: "en-GB" };

export function idioma() {
  try {
    return localStorage.getItem(CHAVE_LINGUA) === "en" ? "en" : "pt";
  } catch (e) {
    return "pt";
  }
}

export function locale() {
  return LOCAIS_IDIOMA[idioma()];
}

export function definirIdioma(codigo) {
  const novo = codigo === "en" ? "en" : "pt";
  try {
    localStorage.setItem(CHAVE_LINGUA, novo);
  } catch (e) {
    /* sem armazenamento: volta a português no próximo arranque */
  }
  return novo;
}

export const CAMINHOS = {
  get textos() {
    return new URL("textos/" + idioma() + ".json", RAIZ).href;
  },
  locais: new URL("dados/locais.json", RAIZ).href,
  angola: new URL("dados/angola.json", RAIZ).href,
  culturas: new URL("dados/culturas.json", RAIZ).href,
};

let textos = {};

/** Lê um caminho com pontos: "passo1.solo.nota". */
export function ler(chave, objeto = textos) {
  return chave.split(".").reduce((acc, parte) => {
    if (acc === undefined || acc === null) return undefined;
    return acc[parte];
  }, objeto);
}

export function texto(chave, reserva = "") {
  const valor = ler(chave);
  return typeof valor === "string" ? valor : reserva;
}

/** Nome da cultura no idioma ativo. Os dados guardam nome (pt) e nomeEN. */
export function nomeCultura(cultura) {
  if (!cultura) return "";
  return idioma() === "en" && cultura.nomeEN ? cultura.nomeEN : cultura.nome;
}

/** Regra de um indicador: no inglês usa regraEN, com recurso ao português. */
export function regraDe(bloco) {
  if (!bloco) return undefined;
  return idioma() === "en" ? bloco.regraEN || bloco.regra : bloco.regra;
}

const cacheFormatos = new Map();

export function formatarNumero(valor, opcoes) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "—";
  const definicoes = opcoes || { maximumFractionDigits: 0 };
  const chave = locale() + "|" + JSON.stringify(definicoes);
  if (!cacheFormatos.has(chave)) {
    cacheFormatos.set(chave, new Intl.NumberFormat(locale(), definicoes));
  }
  return cacheFormatos.get(chave).format(valor);
}

/** Nome do mês, 1 a 12, no idioma ativo. formato: "long" ou "short". */
export function nomeMes(mes, formato = "long") {
  const data = new Date(Date.UTC(2024, ((mes - 1) % 12 + 12) % 12, 15));
  return new Intl.DateTimeFormat(locale(), { month: formato })
    .format(data)
    .replace(".", "");
}

export async function pedirJSON(caminho) {
  const resposta = await fetch(caminho, { cache: "default" });
  if (!resposta.ok) {
    throw new Error("Falha ao carregar " + caminho + " (" + resposta.status + ")");
  }
  const dados = await resposta.json();
  marcarAtualizacao();
  return dados;
}

export async function carregarTextos() {
  try {
    textos = await pedirJSON(CAMINHOS.textos);
  } catch (erro) {
    // Se o inglês falhar (cache antiga, ficheiro em falta), cai para português
    // em vez de deixar o ecrã sem texto. O HTML já traz português.
    if (idioma() === "en") {
      console.warn("Textos em inglês indisponíveis; a usar português.", erro);
      textos = await pedirJSON(new URL("textos/pt.json", RAIZ).href);
    } else {
      throw erro;
    }
  }
  return textos;
}

/** Substitui o texto de todos os nós com data-i18n / data-i18n-attr. */
export function aplicarTextos(dicionario) {
  if (dicionario) textos = dicionario;

  document.documentElement.lang = locale();

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const valor = ler(el.dataset.i18n);
    if (typeof valor === "string") el.textContent = valor;
  });

  document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    el.dataset.i18nAttr.split(";").forEach((par) => {
      const [atributo, chave] = par.split(":");
      if (!atributo || !chave) return;
      const valor = ler(chave.trim());
      if (typeof valor === "string") el.setAttribute(atributo.trim(), valor);
    });
  });

  const chaveTitulo = document.body?.dataset?.titulo || "meta.titulo";
  const titulo = ler(chaveTitulo);
  if (typeof titulo === "string") document.title = titulo;
}

// --- Carimbo da última atualização (guardado no próprio aparelho) ---

export function marcarAtualizacao() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  try {
    localStorage.setItem(CHAVE_ATUALIZACAO, new Date().toISOString());
  } catch (e) {
    /* modo privado: sem carimbo, sem drama */
  }
}

export function lerAtualizacao() {
  try {
    const valor = localStorage.getItem(CHAVE_ATUALIZACAO);
    if (!valor) return null;
    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? null : data;
  } catch (e) {
    return null;
  }
}

export function formatarData(data) {
  if (!data) return "";
  try {
    return new Intl.DateTimeFormat(locale(), {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(data);
  } catch (e) {
    return data.toISOString().slice(0, 16).replace("T", " ");
  }
}
