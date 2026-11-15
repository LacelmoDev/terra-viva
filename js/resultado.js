// ============================================================================
// Terra Viva — resultado.js
// Desenha os três cartões de rotação. Todo o texto sai de textos/pt.json;
// todos os números vêm do motor ou dos dados da NASA, com etiqueta de origem.
// ============================================================================

import { formatarNumero, nomeCultura, texto } from "./dados.js";
import { CRITERIOS } from "./motor.js";

const NS = "http://www.w3.org/2000/svg";
const numero = { format: (valor) => formatarNumero(valor) };

/** Texto com substituição de {variáveis}. */
function t(chave, vars = {}) {
  let saida = texto(chave, "");
  for (const [chaveVar, valor] of Object.entries(vars)) {
    saida = saida.split("{" + chaveVar + "}").join(String(valor));
  }
  return saida;
}

function icone(id, nomeAcessivel) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(NS, "use");
  use.setAttribute("href", "#i-" + id);
  svg.append(use);
  if (nomeAcessivel) svg.setAttribute("title", nomeAcessivel);
  return svg;
}

function listaSimples(itens, classe) {
  const ul = document.createElement("ul");
  if (classe) ul.className = classe;
  itens.forEach((item) => {
    const li = document.createElement("li");
    if (typeof item === "string") li.textContent = item;
    else li.append(item);
    ul.append(li);
  });
  return ul;
}

function campoTitulo(chave) {
  const h4 = document.createElement("h4");
  h4.textContent = texto(chave, "");
  return h4;
}

// ---------------------------------------------------------------------------
// Evidência: cada linha com a sua origem, sem misturar fontes
// ---------------------------------------------------------------------------

function evidenciasDe(rotacao, clima, porCultura) {
  const chuva = clima.indicadores?.chuvaAnual?.media_mm;
  const epoca = clima.indicadores?.epocaChuvosa;
  const meses = epoca?.duracaoMeses;
  const diasEpoca = meses ? Math.round(meses * 30.4) : null;
  const temperatura = mediaNaEpoca(clima, epoca);

  const culturas = rotacao.culturas;
  const faixasChuva = culturas
    .map((c) => {
      const faixa = porCultura[c.id]?.chuvaAnualMm?.otima;
      return faixa && faixa[0] != null ? nomeCultura(c) + " " + faixa[0] + "–" + faixa[1] : null;
    })
    .filter(Boolean);

  const ciclos = culturas
    .map((c) => {
      const ciclo = porCultura[c.id]?.cicloDias;
      return ciclo ? nomeCultura(c) + " " + ciclo.min + "–" + ciclo.max : null;
    })
    .filter(Boolean);

  const otimas = culturas
    .map((c) => {
      const faixa = porCultura[c.id]?.temperaturaC?.otima;
      return faixa && faixa[0] != null ? nomeCultura(c) + " " + faixa[0] + "–" + faixa[1] : null;
    })
    .filter(Boolean);

  const familias = [...new Set(culturas.map((c) => c.familia).filter(Boolean))];

  const linhas = [
    { fonte: "nasa", texto: t("motor.evidencia.chuvaLocal", { chuva: numero.format(chuva) }) },
    { fonte: "conhecimento", texto: t("motor.evidencia.chuvaCulturas", { lista: faixasChuva.join("; ") }) },
    { fonte: "conhecimento", texto: t("motor.evidencia.ciclos", { lista: ciclos.join("; ") }) },
    {
      fonte: "calculado",
      texto: t("motor.evidencia.epoca", { meses: meses ?? "—", dias: diasEpoca ?? "—" }),
    },
    {
      fonte: "nasa",
      texto: t("motor.evidencia.temperaturaEpoca", { t: temperatura ?? "—" }),
    },
    { fonte: "conhecimento", texto: t("motor.evidencia.temperaturaOtima", { lista: otimas.join("; ") }) },
    {
      fonte: "calculado",
      texto: t("motor.evidencia.calor", {
        dias: Math.round(clima.indicadores?.stressTermico?.mediaDiasAno ?? 0),
      }),
    },
    { fonte: "conhecimento", texto: t("motor.evidencia.familias", { lista: familias.join("; ") }) },
  ];

  return linhas.filter((linha) => linha.texto);
}

function mediaNaEpoca(clima, epoca) {
  if (!epoca?.inicioMes || !epoca?.fimMes) return null;
  const meses = [];
  let mes = epoca.inicioMes;
  for (let i = 0; i < 12; i++) {
    meses.push(mes);
    if (mes === epoca.fimMes) break;
    mes = mes === 12 ? 1 : mes + 1;
  }
  const valores = meses
    .map((m) => clima.climatologiaMensal?.t2m_c?.[m - 1])
    .filter((v) => v !== null && v !== undefined);
  if (!valores.length) return null;
  return Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Cartão
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// À vista: três sinais a partir das pontuações por critério que o motor já dá.
// Limiares nossos (CALCULADO POR NÓS): 0,75 ou mais = bom; 0,50 = atenção.
// ---------------------------------------------------------------------------

const LIMIAR_BOM = 0.75;
const LIMIAR_ATENCAO = 0.5;

function estadoDe(valor, tipo) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "sem";
  if (valor >= LIMIAR_BOM) return "bom";
  if (valor >= LIMIAR_ATENCAO) return "atencao";
  return tipo === "risco" ? "alto" : "fraco";
}

function sinaisDe(rotacao) {
  const criterios = rotacao.criterios || {};
  const soloPartes = [criterios.azoto, criterios.pragas].filter((v) => typeof v === "number");
  const solo = soloPartes.length
    ? soloPartes.reduce((a, b) => a + b, 0) / soloPartes.length
    : null;

  return [
    { chave: "agua", estado: estadoDe(criterios.agua, "agua") },
    { chave: "solo", estado: estadoDe(solo, "solo") },
    { chave: "risco", estado: estadoDe(criterios.risco, "risco") },
  ];
}

function razoesDe(rotacao) {
  return rotacao.regras.map((regra) =>
    t("motor.porque." + regra.chave, {
      ...regra.vars,
      c1: nomeCultura(rotacao.culturas[0]),
      c2: nomeCultura(rotacao.culturas[1]),
      c3: nomeCultura(rotacao.culturas[2]),
    })
  );
}

function construirCartao(rotacao, indice, contexto) {
  const { clima, porId } = contexto;
  const artigo = document.createElement("article");
  artigo.className = "rotacao" + (rotacao.tipo === "atual" ? " rotacao--atual" : "");

  const topo = document.createElement("div");
  topo.className = "rotacao__topo";

  const titulo = document.createElement("h3");
  titulo.className = "rotacao__titulo";
  titulo.textContent =
    rotacao.tipo === "atual"
      ? texto("resultado.atual", "A tua rotação atual")
      : t("resultado.alternativa", { n: indice });

  const ponto = document.createElement("p");
  ponto.className = "rotacao__ponto";
  ponto.textContent = numero.format(rotacao.pontuacao);
  const pontoNota = document.createElement("small");
  pontoNota.textContent = texto("resultado.de100", "de 100");
  ponto.append(pontoNota);

  topo.append(titulo, ponto);

  // Sequência das três épocas
  const sequencia = document.createElement("ol");
  sequencia.className = "rotacao__sequencia";
  rotacao.culturas.forEach((cultura, i) => {
    const li = document.createElement("li");
    li.className = "rotacao__epoca";
    const epoca = document.createElement("span");
    epoca.className = "ep";
    epoca.textContent = t("resultado.epoca", { n: i + 1 });
    li.append(epoca, icone(cultura.id), document.createTextNode(nomeCultura(cultura)));
    sequencia.append(li);
  });

  artigo.append(topo, sequencia);

  // --- À vista: três sinais com ícone, palavra e cor (nunca só cor) ---
  const sinais = document.createElement("ul");
  sinais.className = "sinais";
  sinaisDe(rotacao).forEach((sinal) => {
    const li = document.createElement("li");
    li.className = "sinal sinal--" + sinal.estado;

    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "sinal__icone");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const uso = document.createElementNS(NS, "use");
    uso.setAttribute("href", "#i-" + sinal.chave);
    svg.append(uso);

    const nome = document.createElement("span");
    nome.className = "sinal__nome";
    nome.textContent = texto("resultado.sinais." + sinal.chave, sinal.chave);

    const estado = document.createElement("span");
    estado.className = "sinal__estado";
    estado.textContent = texto("resultado.estados." + sinal.estado, sinal.estado);

    li.append(svg, nome, estado);
    sinais.append(li);
  });
  artigo.append(sinais);

  const nota = document.createElement("p");
  nota.className = "sinais__nota";
  nota.textContent = texto("resultado.sinaisNota", "");
  artigo.append(nota);

  // --- Uma frase, com texto que já existe (primeiro porquê) ---
  const frase = document.createElement("p");
  frase.className = "rotacao__frase";
  frase.textContent = razoesDe(rotacao)[0] ?? "";
  artigo.append(frase);

  // --- Detalhe: tudo o resto, recolhido por defeito ---
  const detalhe = document.createElement("details");
  detalhe.className = "rotacao__detalhe";
  const sumario = document.createElement("summary");
  sumario.textContent = texto("resultado.detalhe", "Ver porquê");
  detalhe.append(sumario);

  // 1. Porque foi sugerida
  const porque = document.createElement("div");
  porque.className = "rotacao__campo";
  porque.append(campoTitulo("resultado.porque"));
  const razoes = razoesDe(rotacao);
  porque.append(listaSimples(razoes));
  detalhe.append(porque);

  // 2. Evidência (com etiqueta em cada linha)
  const evidencia = document.createElement("div");
  evidencia.className = "rotacao__campo";
  evidencia.append(campoTitulo("resultado.evidencia"));
  const ulEvidencia = document.createElement("ul");
  ulEvidencia.className = "evidencias";
  evidenciasDe(rotacao, clima, porId).forEach((linha) => {
    const li = document.createElement("li");
    const etiqueta = document.createElement("span");
    etiqueta.className = "etiqueta etiqueta--" + linha.fonte;
    etiqueta.textContent =
      linha.fonte === "nasa"
        ? texto("confianca.nasa.nome", "Dado NASA")
        : linha.fonte === "calculado"
          ? texto("confianca.calculado.nome", "Calculado por nós")
          : texto("confianca.conhecimento.nome", "Conhecimento agronómico");
    const corpo = document.createElement("span");
    corpo.textContent = linha.texto;
    li.append(etiqueta, corpo);
    ulEvidencia.append(li);
  });
  evidencia.append(ulEvidencia);
  detalhe.append(evidencia);

  // 3. Benefícios
  const beneficios = document.createElement("div");
  beneficios.className = "rotacao__campo";
  beneficios.append(campoTitulo("resultado.beneficios"));
  beneficios.append(listaSimples(rotacao.beneficios.map((b) => t("motor.beneficio." + b.chave, b.vars))));
  detalhe.append(beneficios);

  // 4. Lacunas
  const lacunas = document.createElement("div");
  lacunas.className = "rotacao__campo";
  lacunas.append(campoTitulo("resultado.lacunas"));
  lacunas.append(listaSimples(rotacao.lacunas.map((chave) => t("motor.lacuna." + chave))));
  detalhe.append(lacunas);

  // 5. Riscos a validar
  const riscos = document.createElement("div");
  riscos.className = "rotacao__campo";
  riscos.append(campoTitulo("resultado.riscos"));
  riscos.append(listaSimples(rotacao.riscos.map((r) => t("motor.risco." + r.chave, r.vars))));
  detalhe.append(riscos);

  // Critérios
  const criterios = document.createElement("div");
  criterios.className = "rotacao__campo";
  criterios.append(campoTitulo("resultado.criterios"));
  criterios.append(tabelaCriterios(rotacao));
  detalhe.append(criterios);

  artigo.append(detalhe);

  return artigo;
}

function tabelaCriterios(rotacao) {
  const tabela = document.createElement("table");
  tabela.className = "criterios";
  const thead = document.createElement("thead");
  const linhaCabecalho = document.createElement("tr");
  const th1 = document.createElement("th");
  th1.textContent = texto("resultado.criterios", "Critérios usados");
  const th2 = document.createElement("th");
  th2.textContent = texto("resultado.pontuacao", "Pontuação");
  linhaCabecalho.append(th1, th2);
  thead.append(linhaCabecalho);
  tabela.append(thead);

  const corpo = document.createElement("tbody");
  for (const criterio of CRITERIOS) {
    const valor = rotacao.criterios[criterio.chave];
    const linha = document.createElement("tr");
    if (valor === null || valor === undefined) linha.dataset.indisponivel = "";

    const nome = document.createElement("td");
    nome.textContent = texto("resultado.criteriosNomes." + criterio.chave, criterio.chave);

    const celulaValor = document.createElement("td");
    if (valor === null || valor === undefined) {
      const span = document.createElement("span");
      span.className = "valor-sem-dado";
      span.textContent = texto("resultado.semDados", "sem dados");
      celulaValor.append(span);
    } else {
      celulaValor.textContent = numero.format(valor * 100) + "%";
      const barra = document.createElement("span");
      barra.className = "barra";
      const preenchido = document.createElement("i");
      preenchido.style.width = Math.max(2, Math.round(valor * 100)) + "%";
      barra.append(preenchido);
      celulaValor.append(barra);
    }

    linha.append(nome, celulaValor);
    corpo.append(linha);
  }
  tabela.append(corpo);
  return tabela;
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

export function renderResultado(container, resultado, { clima, culturas }) {
  container.replaceChildren();

  const porId = Object.fromEntries(culturas.map((c) => [c.id, c]));
  const contexto = { clima, porId };

  // Linha-resumo em linguagem simples: qual das três tem a pontuação mais alta.
  let melhor = 0;
  resultado.rotacoes.forEach((rotacao, indice) => {
    if (rotacao.pontuacao > resultado.rotacoes[melhor].pontuacao) melhor = indice;
  });
  const vencedora = resultado.rotacoes[melhor];
  const nomeVencedora =
    vencedora.tipo === "atual"
      ? texto("resultado.atual", "")
      : t("resultado.alternativa", { n: melhor });

  const linhaResumo = document.createElement("p");
  linhaResumo.className = "resultado__resumo";
  linhaResumo.textContent = t("resultado.resumo", {
    qual: nomeVencedora,
    nota: numero.format(vencedora.pontuacao),
  });
  container.append(linhaResumo);

  const nota = document.createElement("p");
  nota.className = "resultado__nota";
  nota.textContent = texto("resultado.nota", "");
  container.append(nota);

  const grelha = document.createElement("div");
  grelha.className = "rotacoes";
  resultado.rotacoes.forEach((rotacao, indice) => {
    grelha.append(construirCartao(rotacao, indice, contexto));
  });
  container.append(grelha);

  const rodape = document.createElement("div");
  rodape.className = "resultado__rodape";

  if (resultado.notas?.length) {
    const notas = resultado.notas
      .map((chave) => texto("resultado.notas." + chave, ""))
      .filter(Boolean);
    if (notas.length) rodape.append(listaSimples(notas));
  }

  const detalhes = document.createElement("details");
  const resumo = document.createElement("summary");
  resumo.textContent = texto("resultado.regras", "Como pontuamos");
  detalhes.append(resumo);

  const pesos = CRITERIOS.map(
    (criterio) =>
      texto("resultado.criteriosNomes." + criterio.chave, criterio.chave) +
      " " +
      (resultado.pesos[criterio.chave] ?? 1).toFixed(1)
  ).join(" · ");

  detalhes.append(
    listaSimples([
      t("resultado.regrasTexto.pesos", { lista: pesos }),
      texto("resultado.regrasTexto.metodo", ""),
      texto("resultado.regrasTexto.semDados", ""),
    ])
  );

  rodape.append(detalhes);
  container.append(rodape);
}
