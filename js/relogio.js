// ============================================================================
// Terra Viva — relogio.js
// O Relógio da Terra: doze meses em três anéis (chuva, humidade do solo,
// temperatura), o calendário da cultura no anel interior e a terra nua a
// pulsar. Os cenários de chuva mudam o relógio e voltam a pontuar as rotações.
//
// Tudo é desenhado a partir de dados/clima/<id>.json. Não há valores inventados:
// o que falta fica dito. A tabela é a alternativa em texto ao desenho.
// ============================================================================

import { formatarNumero, idioma, nomeCultura, nomeMes, texto } from "./dados.js";

const NS = "http://www.w3.org/2000/svg";
const CX = 350;
const CY = 350;
const TAM = 700;

const ANEIS = {
  chuva: { r0: 228, r1: 330 },
  solo: { r0: 176, r1: 220 },
  temp: { r0: 134, r1: 174 },
};
const CALENDARIO = { r0: 88, r1: 126 };
const FOLGA = (1.1 * Math.PI) / 180; // respiro entre setores

// Meses no idioma ativo: 0 = janeiro.
const nomeDoMes = (indice) => nomeMes(indice + 1, "long");
const inicialDoMes = (indice) => nomeMes(indice + 1, "short").charAt(0).toUpperCase();

const numero = { format: (valor) => formatarNumero(valor) };
const numeroFino = { format: (valor) => formatarNumero(valor, { maximumFractionDigits: 1 }) };

const fmt = (modelo, valores) =>
  String(modelo).replace(/\{(\w+)\}/g, (_, chave) =>
    valores[chave] === undefined ? "" : valores[chave]
  );

// Em português os meses vão em minúscula a meio da frase; em inglês ficam
// capitalizados, como é hábito.
const mesNaFrase = (mes) =>
  idioma() === "en" ? nomeMes(mes) : nomeMes(mes).toLowerCase();

// ---------- Geometria ----------

const angulo = (mes) => (mes / 12) * Math.PI * 2 - Math.PI / 2;
const ponto = (r, a) => [CX + r * Math.cos(a), CY + r * Math.sin(a)];

function setor(r0, r1, a0, a1) {
  const [x0, y0] = ponto(r1, a0);
  const [x1, y1] = ponto(r1, a1);
  const [x2, y2] = ponto(r0, a1);
  const [x3, y3] = ponto(r0, a0);
  const grande = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r1} ${r1} 0 ${grande} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}A${r0} ${r0} 0 ${grande} 0 ${x3.toFixed(1)} ${y3.toFixed(1)}Z`;
}

const el = (nome, atributos = {}) => {
  const no = document.createElementNS(NS, nome);
  for (const [chave, valor] of Object.entries(atributos)) {
    no.setAttribute(chave, valor);
  }
  return no;
};

// ---------- Cenários ----------
// Só a chuva muda. A humidade do solo e a temperatura ficam como foram medidas,
// porque não temos um modelo que ligue uma coisa à outra com rigor.

export function aplicarCenario(clima, cenario) {
  const copia = JSON.parse(JSON.stringify(clima));
  const chuva = copia.climatologiaMensal.chuva_mm.slice();

  if (cenario === "menos20") {
    for (let i = 0; i < 12; i++) chuva[i] *= 0.8;
  } else if (cenario === "mais20") {
    for (let i = 0; i < 12; i++) chuva[i] *= 1.2;
  } else if (cenario === "atraso") {
    // Três semanas = 0,75 mês: a chuva de cada mês passa a ser a de 0,75 mês antes.
    const original = copia.climatologiaMensal.chuva_mm;
    for (let i = 0; i < 12; i++) {
      const pos = i - 0.75;
      const base = Math.floor(pos);
      const resto = pos - base;
      const antes = original[((base % 12) + 12) % 12];
      const depois = original[(((base + 1) % 12) + 12) % 12];
      chuva[i] = antes * (1 - resto) + depois * resto;
    }
  }

  copia.climatologiaMensal.chuva_mm = chuva;
  copia.cenario = cenario;

  if (cenario === "normal") return copia;

  // Mesma regra de tools/regras.mjs: mês chuvoso = média ≥ 40 mm; a época é a
  // maior sequência contínua, contando a volta do ano.
  const chuvoso = chuva.map((v) => v >= 40);
  let melhorInicio = 0;
  let melhorDuracao = 0;
  for (let inicio = 0; inicio < 12; inicio++) {
    if (!chuvoso[inicio]) continue;
    if (chuvoso[(inicio + 11) % 12]) continue; // não é o começo de uma sequência
    let duracao = 0;
    while (duracao < 12 && chuvoso[(inicio + duracao) % 12]) duracao++;
    if (duracao > melhorDuracao) {
      melhorDuracao = duracao;
      melhorInicio = inicio;
    }
  }

  if (melhorDuracao === 0) {
    copia.indicadores.epocaChuvosa = {
      ...copia.indicadores.epocaChuvosa,
      mesesComChuva: 0,
      cenario: cenario,
    };
  } else {
    copia.indicadores.epocaChuvosa = {
      ...copia.indicadores.epocaChuvosa,
      inicioMes: melhorInicio + 1,
      fimMes: ((melhorInicio + melhorDuracao - 1) % 12) + 1,
      duracaoMeses: melhorDuracao,
      cenario: cenario,
    };
  }

  const total = chuva.reduce((soma, v) => soma + v, 0);
  copia.indicadores.chuvaAnual = {
    ...copia.indicadores.chuvaAnual,
    media_mm: Math.round(total),
    cenario: cenario,
  };

  return copia;
}

// ---------- Relógio ----------

export function criarRelogio(alvo, { aoMudarCenario } = {}) {
  if (!alvo) return { atualizar: () => {}, lerCenario: () => "normal" };

  const estado = { cenario: "normal", rotacao: 0, epoca: 0 };
  let dados = null;
  let svg = null;
  let camada = null;
  let tabela = null;
  let centro = null;
  let centroNome = null;
  let centroDetalhe = null;
  let resumo = null;
  let aviso = null;
  let controles = {};

  construir();

  function construir() {
    alvo.innerHTML = "";

    const controlesCaixa = document.createElement("div");
    controlesCaixa.className = "relogio__controles";

    controles.rotacao = grupo("rotacao", [
      ["atual", texto("relogio.rotulos.atual", "Atual")],
      ["alt1", fmt(texto("relogio.rotulos.alternativa", "Alt. {n}"), { n: 1 })],
      ["alt2", fmt(texto("relogio.rotulos.alternativa", "Alt. {n}"), { n: 2 })],
    ], "relogio.rotacao");
    controles.epoca = grupo(
      "epoca",
      ["1", "2", "3"].map((n) => [n, n]),
      "relogio.epoca"
    );
    controles.cenario = grupo(
      "cenario",
      Object.entries({
        normal: texto("relogio.cenarios.normal", "Época normal"),
        atraso: texto("relogio.cenarios.atraso", "A chuva atrasa 3 semanas"),
        menos20: texto("relogio.cenarios.menos20", "Chove 20% menos"),
        mais20: texto("relogio.cenarios.mais20", "Chove 20% mais"),
      }),
      "relogio.cenario"
    );

    Object.values(controles).forEach((g) => controlesCaixa.append(g.caixa));

    const palco = document.createElement("div");
    palco.className = "relogio__palco";

    svg = el("svg", {
      class: "relogio__svg",
      viewBox: `0 0 ${TAM} ${TAM}`,
      role: "img",
      "aria-label": texto("relogio.aria", "Relógio da Terra."),
    });

    centro = el("g", { class: "relogio__centro" });
    centroNome = el("text", {
      class: "relogio__centro-nome",
      x: CX,
      y: CY - 10,
      "text-anchor": "middle",
    });
    centroDetalhe = el("text", {
      class: "relogio__centro-detalhe",
      x: CX,
      y: CY + 18,
      "text-anchor": "middle",
    });
    centro.append(centroNome, centroDetalhe);
    svg.append(centro);

    resumo = document.createElement("p");
    resumo.className = "relogio__resumo";
    resumo.setAttribute("aria-live", "polite");

    aviso = document.createElement("p");
    aviso.className = "relogio__aviso";
    aviso.hidden = true;

    const legenda = document.createElement("ul");
    legenda.className = "relogio__legenda";
    [
      ["chuva", "relogio.legenda.chuva", "Chuva"],
      ["solo", "relogio.legenda.solo", "Humidade do solo"],
      ["temp", "relogio.legenda.temp", "Temperatura"],
      ["cultura", "relogio.legenda.cultura", "Cultura no campo"],
      ["terraNua", "relogio.legenda.terraNua", "Terra nua"],
    ].forEach(([chave, chaveTexto, reserva]) => {
      const item = document.createElement("li");
      item.className = "relogio__legenda-item relogio__legenda-item--" + chave;
      const marca = document.createElement("span");
      marca.className = "relogio__marca";
      marca.setAttribute("aria-hidden", "true");
      const rotulo = document.createElement("span");
      rotulo.textContent = texto(chaveTexto, reserva);
      item.append(marca, rotulo);
      legenda.append(item);
    });

    const textoCaixa = document.createElement("div");
    textoCaixa.className = "relogio__texto";
    textoCaixa.append(resumo, aviso, legenda);

    const nota = document.createElement("p");
    nota.className = "relogio__regra";
    nota.textContent = texto("relogio.regra", "");
    const notaCenario = document.createElement("p");
    notaCenario.className = "relogio__regra";
    notaCenario.textContent = texto("relogio.regraCenario", "");

    palco.append(svg, textoCaixa);

    const caixaTabela = document.createElement("details");
    caixaTabela.className = "relogio__tabela";
    const sumario = document.createElement("summary");
    sumario.textContent = texto("relogio.tabela", "Ver em tabela");
    const corpoTabela = document.createElement("div");
    tabela = corpoTabela;
    caixaTabela.append(sumario, corpoTabela);

    alvo.append(controlesCaixa, palco, nota, notaCenario, caixaTabela);
  }

  function grupo(chave, opcoes, etiquetaChave) {
    const caixa = document.createElement("div");
    caixa.className = "relogio__grupo";

    const rotulo = document.createElement("p");
    rotulo.className = "relogio__grupo-rotulo";
    rotulo.id = "relogio-rotulo-" + chave;
    rotulo.textContent = texto(etiquetaChave, "");
    caixa.append(rotulo);

    const fila = document.createElement("div");
    fila.className = "relogio__fila";
    fila.setAttribute("role", "group");
    fila.setAttribute("aria-labelledby", rotulo.id);

    const botoes = opcoes.map(([valor, rotuloBotao]) => {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "segmento";
      botao.textContent = rotuloBotao;
      botao.dataset.valor = valor;
      botao.addEventListener("click", () => escolher(chave, valor));
      fila.append(botao);
      return botao;
    });

    caixa.append(fila);
    return { caixa, fila, botoes, chave };
  }

  function marcar() {
    if (controles.rotacao) {
      const indice = { 0: "atual", 1: "alt1", 2: "alt2" };
      controles.rotacao.botoes.forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.valor === indice[estado.rotacao]))
      );
    }
    if (controles.epoca) {
      controles.epoca.botoes.forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.valor === String(estado.epoca + 1)))
      );
    }
    if (controles.cenario) {
      controles.cenario.botoes.forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.valor === estado.cenario))
      );
    }
  }

  function escolher(chave, valor) {
    if (chave === "rotacao") estado.rotacao = { atual: 0, alt1: 1, alt2: 2 }[valor] ?? 0;
    if (chave === "epoca") estado.epoca = Number(valor) - 1;
    if (chave === "cenario") {
      if (estado.cenario === valor) return;
      estado.cenario = valor;
      marcar();
      aoMudarCenario?.(valor);
      return;
    }
    marcar();
    if (dados) desenhar();
  }

  function atualizar(novos) {
    dados = novos;
    if (!dados) return;
    marcar();
    if (dados.resultado?.rotacoes?.length) {
      estado.rotacao = Math.min(estado.rotacao, dados.resultado.rotacoes.length - 1);
    }
    desenhar();
  }

  function desenhar() {
    const { clima, resultado, culturas } = dados;
    const rotacao = resultado?.rotacoes?.[estado.rotacao] ?? null;
    const culturaId = rotacao?.sequencia?.[estado.epoca] ?? null;
    const cultura = culturaId ? culturas.find((c) => c.id === culturaId) : null;

    const antiga = camada;
    camada = el("g", { class: "relogio__camada" });
    svg.append(camada);
    requestAnimationFrame(() => camada.classList.add("relogio__camada--visivel"));
    if (antiga) {
      antiga.classList.remove("relogio__camada--visivel");
      window.setTimeout(() => antiga.remove(), 420);
    }

    const chuvas = clima.climatologiaMensal.chuva_mm;
    const solos = clima.climatologiaMensal.gwetroot;
    const temps = clima.climatologiaMensal.t2m_c;

    desenharAnel(camada, ANEIS.chuva, chuvas, "chuva", 0);
    desenharAnel(camada, ANEIS.solo, solos, "solo", 0);
    desenharAnel(camada, ANEIS.temp, temps, "temp", 0.12);
    desenharMeses(camada);

    const calendario = calcularCalendario(clima, cultura);
    desenharCalendario(camada, calendario, cultura);

    centroNome.textContent = cultura ? nomeCultura(cultura) : texto("relogio.semCultura", "Sem cultura");
    centroDetalhe.textContent = cultura
      ? fmt(texto("relogio.ciclo", "Ciclo {min}–{max} dias"), {
          min: cultura.cicloDias?.min ?? "—",
          max: cultura.cicloDias?.max ?? "—",
        })
      : "";
    svg.append(centro); // mantém o centro por cima das camadas

    desenharResumo(clima, calendario, cultura, rotacao);
    desenharTabela(clima, calendario, cultura);
  }

  function desenharAnel(raiz, anel, valores, chave, minimo) {
    if (!valores || !valores.length) return;

    // A chuva é absoluta (mm). O solo e a temperatura são relativos ao intervalo
    // local, senão um mês de 0,4 é indistinguível de um de 0,9.
    let minimoSerie = Math.min(...valores);
    let maximoSerie = Math.max(...valores);
    if (chave === "chuva") minimoSerie = 0;
    const espaco = maximoSerie - minimoSerie || 1;

    const grupoAnel = el("g", { class: "relogio__anel relogio__anel--" + chave });

    valores.forEach((valor, mes) => {
      const bruto = (valor - minimoSerie) / espaco;
      const altura = Math.max(minimo, Math.min(1, bruto));
      const r1 = anel.r0 + altura * (anel.r1 - anel.r0);
      const a0 = angulo(mes) + FOLGA;
      const a1 = angulo(mes + 1) - FOLGA;

      const setorNo = el("path", {
        d: setor(anel.r0, r1, a0, a1),
        class: "relogio__setor",
      });
      const titulo = el("title");
      titulo.textContent =
        nomeDoMes(mes) +
        ": " +
        (chave === "chuva"
          ? numeroFino.format(valor) + " mm"
          : chave === "solo"
            ? numeroFino.format(valor) + " (0 a 1)"
            : numeroFino.format(valor) + " °C");
      setorNo.append(titulo);
      grupoAnel.append(setorNo);
    });

    raiz.append(grupoAnel);
  }

  function desenharMeses(raiz) {
    const grupoMeses = el("g", { class: "relogio__meses", "aria-hidden": "true" });
    for (let mes = 0; mes < 12; mes++) {
      const letra = inicialDoMes(mes);
      const a = angulo(mes + 0.5);
      const [x, y] = ponto(344, a);
      const rotulo = el("text", {
        x: x.toFixed(1),
        y: y.toFixed(1),
        "text-anchor": "middle",
        "dominant-baseline": "middle",
      });
      rotulo.textContent = letra;
      grupoMeses.append(rotulo);
    }
    raiz.append(grupoMeses);
  }

  function calcularCalendario(clima, cultura) {
    const epoca = clima.indicadores.epocaChuvosa ?? {};
    const inicio = epoca.inicioMes ?? 10;
    // O desenho usa o meio da faixa da EcoCrop, que é larga (milho 65–365 dias).
    // O mínimo e o máximo ficam na ficha da cultura e na parte esbatida do arco.
    const mesesCiclo = cultura?.cicloDias?.min
      ? Math.min(
          12,
          Math.max(
            1,
            Math.round(
              ((cultura.cicloDias.min + (cultura.cicloDias.max ?? cultura.cicloDias.min)) / 2) /
                30.44
            )
          )
        )
      : 0;
    const mesesCicloMax = cultura?.cicloDias?.max
      ? Math.min(12, Math.max(mesesCiclo, Math.round(cultura.cicloDias.max / 30.44)))
      : mesesCiclo;

    const ocupados = new Array(12).fill(false);
    for (let i = 0; i < mesesCiclo; i++) ocupados[(inicio - 1 + i) % 12] = true;

    return { inicio, mesesCiclo, mesesCicloMax, ocupados, duracao: epoca.duracaoMeses };
  }

  function desenharCalendario(raiz, calendario, cultura) {
    const { inicio, ocupados, mesesCicloMax } = calendario;

    if (cultura && mesesCicloMax > 0) {
      const a0 = angulo(inicio - 1) + FOLGA * 0.4;
      const a1 = angulo(inicio - 1 + mesesCicloMax) - FOLGA * 0.4;

      // Faixa esbatida: até ao ciclo máximo da EcoCrop.
      const faixa = el("path", {
        d: setor(CALENDARIO.r0, CALENDARIO.r1, a0, a1),
        class: "relogio__cultura-relogio relogio__cultura-relogio--" + cultura.id,
        opacity: "0.28",
      });
      raiz.append(faixa);

      const cheio = el("path", {
        d: setor(
          CALENDARIO.r0,
          CALENDARIO.r1,
          a0,
          angulo(inicio - 1 + (calendario.mesesCiclo || 1)) - FOLGA * 0.4
        ),
        class: "relogio__cultura-relogio relogio__cultura-relogio--" + cultura.id,
      });
      const titulo = el("title");
      titulo.textContent =
        nomeCultura(cultura) +
        " · " +
        fmt(texto("relogio.ciclo", "Ciclo {min}–{max} dias"), {
          min: cultura.cicloDias?.min ?? "—",
          max: cultura.cicloDias?.max ?? "—",
        });
      cheio.append(titulo);
      raiz.append(cheio);
    }

    // Terra nua: os meses em que nada está no campo.
    const grupoNua = el("g", { class: "relogio__terra-nua" });
    for (let mes = 0; mes < 12; mes++) {
      if (ocupados[mes]) continue;
      const setorNo = el("path", {
        d: setor(CALENDARIO.r0, CALENDARIO.r1, angulo(mes) + FOLGA, angulo(mes + 1) - FOLGA),
        class: "relogio__terra-nua-setor",
      });
      const titulo = el("title");
      titulo.textContent = nomeDoMes(mes) + " · " + texto("relogio.legenda.terraNua", "Terra nua");
      setorNo.append(titulo);
      grupoNua.append(setorNo);
    }
    if (grupoNua.childNodes.length) raiz.append(grupoNua);
  }

  function desenharResumo(clima, calendario, cultura, rotacao) {
    const epoca = clima.indicadores.epocaChuvosa ?? {};
    const nua = calendario.ocupados.filter((v) => !v).length;
    resumo.textContent = fmt(texto("relogio.resumo", ""), {
      chuva: numero.format(clima.indicadores.chuvaAnual?.media_mm ?? 0),
      inicio: mesNaFrase(calendario.inicio),
      fim: mesNaFrase(epoca.fimMes ?? calendario.inicio),
      n: nua,
    });

    svg.setAttribute(
      "aria-label",
      texto("relogio.aria", "Relógio da Terra.") +
        " " +
        resumo.textContent +
        (cultura ? " " + nomeCultura(cultura) + "." : "")
    );

    const cenario = estado.cenario;
    aviso.hidden = cenario === "normal";
    aviso.textContent =
      cenario === "normal"
        ? ""
        : texto("relogio.aviso", "") +
          (cenario === "atraso"
            ? " " +
              fmt(texto("relogio.atrasoNota", ""), { mes: mesNaFrase(calendario.inicio) })
            : "");
  }

  function desenharTabela(clima, calendario, cultura) {
    if (!tabela) return;
    const chuvas = clima.climatologiaMensal.chuva_mm;
    const solos = clima.climatologiaMensal.gwetroot ?? [];
    const temps = clima.climatologiaMensal.t2m_c ?? [];

    const quadro = document.createElement("table");
    quadro.className = "tabela";

    const cabecalho = document.createElement("thead");
    const linhaCabecalho = document.createElement("tr");
    ["mes", "chuva", "solo", "temp", "cultura"].forEach((chave) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = texto("relogio.tabelaCabecalho." + chave, chave);
      linhaCabecalho.append(th);
    });
    cabecalho.append(linhaCabecalho);

    const corpo = document.createElement("tbody");
    for (let mes = 0; mes < 12; mes++) {
      const linha = document.createElement("tr");
      if (calendario.ocupados[mes]) linha.className = "tabela__linha-cultura";

      const celulas = [
        nomeDoMes(mes),
        numeroFino.format(chuvas[mes] ?? 0),
        solos[mes] !== undefined ? numeroFino.format(solos[mes]) : "—",
        temps[mes] !== undefined ? numeroFino.format(temps[mes]) : "—",
        calendario.ocupados[mes]
          ? nomeCultura(cultura) || "—"
          : texto("relogio.legenda.terraNua", "Terra nua"),
      ];

      celulas.forEach((valor, indice) => {
        const celula = document.createElement(indice === 0 ? "th" : "td");
        if (indice === 0) celula.scope = "row";
        celula.textContent = valor;
        linha.append(celula);
      });
      corpo.append(linha);
    }

    quadro.append(cabecalho, corpo);
    tabela.replaceChildren(quadro);
  }

  return {
    atualizar,
    lerCenario: () => estado.cenario,
  };
}
