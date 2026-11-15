// ============================================================================
// Terra Viva — tools/regras.mjs
// Regras dos indicadores derivados. São escolhas nossas, por isso vivem num
// sítio só, com o texto que o site mostra. Nada aqui inventa dados: só
// transforma o que a NASA POWER devolve.
// ============================================================================

export const LIMIARES = {
  chuvaMesChuvosoMm: 40,
  diaSecoMm: 1.0,
  diaCalorTmaxC: 35,
  // GWETROOT é uma fracção 0–1 que raramente desce muito: um corte fixo
  // (0,2) nunca dispara. Usamos o quartil mais seco do próprio ano local.
  soloSecoPercentil: 0.25,
  // Média mensal acima disto não é chuva: é artefacto do modelo.
  chuvaMesSuspeitoMmDia: 60,
};

export const REGRAS = {
  climatologiaMensal: {
    etiqueta: "calculado",
    texto:
      "Para cada mês, média aritmética de todos os anos do período (2001–2024). Meses com valor em falta (-999) são ignorados.",
    textoEN:
      "For each month, the arithmetic mean of all years in the period (2001–2024). Months with a missing value (-999) are ignored.",
  },
  epocaChuvosa: {
    etiqueta: "calculado",
    texto:
      "Mês chuvoso = média climatológica mensal ≥ 40 mm. A época é a maior sequência contínua de meses chuvosos (o ano é tratado em círculo); se houver mais de uma, escolhemos a que contém o mês mais chuvoso.",
    textoEN:
      "Rainy month = monthly climatological mean ≥ 40 mm. The season is the longest continuous run of rainy months (the year is treated as a circle); if there is more than one, we choose the one containing the wettest month.",
  },
  diasSecos: {
    etiqueta: "calculado",
    texto:
      "Dia seco = precipitação diária < 1,0 mm. Contamos a maior sequência de dias secos dentro da época chuvosa de cada ano; mostramos a mediana dos anos e o pior ano.",
    textoEN:
      "Dry day = daily precipitation < 1.0 mm. We count the longest run of dry days inside each year's rainy season; we show the median across years and the worst year.",
  },
  stressTermico: {
    etiqueta: "calculado",
    texto:
      "Dia de calor = temperatura máxima diária a 2 m ≥ 35 °C. Mostramos a média de dias por ano e o máximo registado no período.",
    textoEN:
      "Hot day = daily maximum temperature at 2 m ≥ 35 °C. We show the average number of days per year and the highest recorded in the period.",
  },
  mesesSoloSeco: {
    etiqueta: "calculado",
    texto:
      "Meses de solo mais seco = os meses cuja média climatológica de humidade da zona radicular (GWETROOT, 0–1) fica no quartil mais seco do próprio ano local. Usamos um critério relativo porque o GWETROOT nunca desce a valores perto de zero e um corte fixo não diria nada. É água no solo vista pelo modelo da NASA, não uma medição no teu campo.",
    textoEN:
      "Driest soil months = the months whose climatological mean root-zone soil moisture (GWETROOT, 0–1) falls in the driest quartile of that area's own year. We use a relative criterion because GWETROOT never drops near zero and a fixed cut-off would say nothing. This is soil water as seen by NASA's model, not a measurement in your field.",
  },
  variacaoAnual: {
    etiqueta: "calculado",
    texto:
      "Desvio-padrão da chuva anual dividido pela média, em percentagem (coeficiente de variação). Mostra quanto a chuva de um ano foge do normal.",
    textoEN:
      "Standard deviation of annual rain divided by the mean, as a percentage (coefficient of variation). It shows how far one year's rain strays from normal.",
  },
  qualidade: {
    etiqueta: "calculado",
    texto:
      "Mês com média diária de chuva acima de 60 mm/dia (mais de ~1 800 mm no mês) é marcado como suspeito: é um artefacto conhecido de reanálise, não chuva. O valor fica visível na lista de suspeitos, mas esse mês sai das climatologias e o ano inteiro sai da série anual. Nada é inventado nem apagado em silêncio.",
    textoEN:
      "A month with an average above 60 mm/day (more than ~1,800 mm in the month) is flagged as suspect: it is a known reanalysis artefact, not rain. The value stays visible in the suspect list, but that month leaves the climatologies and the whole year leaves the annual series. Nothing is invented or deleted silently.",
  },
  terraNua: {
    etiqueta: "calculado",
    texto:
      "Meses sem cultura no campo dependem do calendário de cada cultura escolhida. Não há um valor único para a zona: o Relógio da Terra calcula-os no browser, por rotação e época, a partir do início da época chuvosa e do ciclo da cultura. Este ficheiro não guarda um número fixo para não sugerir um calendário que não existe.",
    textoEN:
      "Months without a crop in the field depend on the calendar of the crop you choose. There is no single value for the area: the Earth Clock calculates them in the browser, per rotation and season, from the start of the rainy season and the crop cycle. This file keeps no fixed number, so it does not suggest a calendar that does not exist.",
  },
};

export const PARAMETROS = {
  PRECTOTCORR: "Precipitação total corrigida — a API mensal devolve mm/dia; convertemos para mm/mês multiplicando pelos dias do mês",
  T2M: "Temperatura média a 2 m (°C)",
  T2M_MAX: "Temperatura máxima a 2 m (°C)",
  T2M_MIN: "Temperatura mínima a 2 m (°C)",
  RH2M: "Humidade relativa a 2 m (%)",
  WS2M: "Velocidade do vento a 2 m (m/s)",
  ALLSKY_SFC_SW_DWN: "Radiação solar incidente à superfície (MJ/m²/dia)",
  GWETROOT: "Humidade da zona radicular, 0–1 (modelo de superfície)",
  GWETPROF: "Humidade do perfil do solo, 0–1",
};

const FALTA = -999;

// ---------- Estatística simples ----------

export function media(valores) {
  const validos = valores.filter((v) => Number.isFinite(v));
  if (!validos.length) return null;
  return validos.reduce((a, b) => a + b, 0) / validos.length;
}

export function mediana(valores) {
  const validos = valores.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!validos.length) return null;
  const meio = Math.floor(validos.length / 2);
  return validos.length % 2 ? validos[meio] : (validos[meio - 1] + validos[meio]) / 2;
}

export function desvioPadrao(valores) {
  const validos = valores.filter((v) => Number.isFinite(v));
  if (validos.length < 2) return null;
  const m = media(validos);
  const soma = validos.reduce((acc, v) => acc + (v - m) ** 2, 0);
  return Math.sqrt(soma / (validos.length - 1));
}

export function arredondar(valor, casas = 1) {
  if (!Number.isFinite(valor)) return null;
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}

// ---------- Leitura das respostas POWER ----------

export function lerMensal(serie, ano, mes) {
  const chave = `${ano}${String(mes).padStart(2, "0")}`;
  const valor = serie?.[chave];
  return typeof valor === "number" && valor !== FALTA ? valor : null;
}

export function lerAnual(serie, ano) {
  const valor = serie?.[`${ano}13`];
  return typeof valor === "number" && valor !== FALTA ? valor : null;
}

export function lerDiario(serie, dataISO) {
  const valor = serie?.[dataISO];
  return typeof valor === "number" && valor !== FALTA ? valor : null;
}

/** Média por mês do calendário (12 posições, índice 0 = janeiro). */
export function climatologiaMensal(seriePorParametro, anos) {
  const resultado = [];
  for (let mes = 1; mes <= 12; mes++) {
    const valores = anos
      .map((ano) => lerMensal(seriePorParametro[ano]?.serie ?? seriePorParametro, ano, mes))
      .filter((v) => v !== null);
    resultado.push(arredondar(media(valores), 2));
  }
  return resultado;
}

export function climatologiaDeSerie(serie, anos, casas = 2) {
  const saida = [];
  for (let mes = 1; mes <= 12; mes++) {
    const valores = [];
    for (const ano of anos) {
      const v = lerMensal(serie, ano, mes);
      if (v !== null) valores.push(v);
    }
    saida.push(arredondar(media(valores), casas));
  }
  return saida;
}

export function somaAnualChuva(serie, ano) {
  let soma = 0;
  let meses = 0;
  for (let mes = 1; mes <= 12; mes++) {
    const v = chuvaMensalMm(serie, ano, mes);
    if (v === null) continue;
    soma += v;
    meses++;
  }
  return meses === 12 ? soma : null;
}

// ---------- Época chuvosa ----------

/**
 * Maior sequência circular de meses com chuva climatológica ≥ limiar.
 * Devolve meses 1–12, com início e fim no calendário.
 */
export function epocaChuvosa(climaChuva, limiar = LIMIARES.chuvaMesChuvosoMm) {
  const chuvoso = climaChuva.map((v) => (v ?? 0) >= limiar);
  const total = chuvoso.filter(Boolean).length;
  if (!total) return null;
  if (total === 12) {
    return { inicio: 1, fim: 12, duracaoMeses: 12, meses: [1,2,3,4,5,6,7,8,9,10,11,12] };
  }

  // Arrancar num mês seco garante que cada sequência é contada uma vez.
  let indiceArranque = chuvoso.findIndex((v) => !v);
  const sequencias = [];
  let atual = null;

  for (let passo = 0; passo < 12; passo++) {
    const mes = ((indiceArranque + passo) % 12) + 1;
    if (chuvoso[mes - 1]) {
      if (!atual) atual = { inicio: mes, fim: mes, meses: [mes] };
      else {
        atual.fim = mes;
        atual.meses.push(mes);
      }
    } else if (atual) {
      sequencias.push(atual);
      atual = null;
    }
  }
  if (atual) sequencias.push(atual);

  const pico = climaChuva.indexOf(Math.max(...climaChuva.filter((v) => v !== null))) + 1;
  const comPico = sequencias.find((s) => s.meses.includes(pico));
  const escolhida =
    comPico ?? sequencias.sort((a, b) => b.meses.length - a.meses.length)[0];

  return { ...escolhida, duracaoMeses: escolhida.meses.length };
}

// ---------- Dias secos e calor ----------

export function diasDoMes(ano, mes) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** Mês com média diária implausível? Ver REGRAS.qualidade. */
export function mesSuspeito(valorMmDia) {
  return Number.isFinite(valorMmDia) && valorMmDia > LIMIARES.chuvaMesSuspeitoMmDia;
}

/** Chuva de um mês em mm: a API mensal dá mm/dia, multiplicamos pelos dias. */
export function chuvaMensalMm(serie, ano, mes) {
  const valor = lerMensal(serie, ano, mes);
  return valor === null ? null : valor * diasDoMes(ano, mes);
}

/** Climatologia da chuva em mm/mês (não em mm/dia). */
export function climatologiaChuvaMm(serie, anos) {
  const saida = [];
  for (let mes = 1; mes <= 12; mes++) {
    const valores = [];
    for (const ano of anos) {
      const v = chuvaMensalMm(serie, ano, mes);
      if (v !== null) valores.push(v);
    }
    saida.push(arredondar(media(valores), 1));
  }
  return saida;
}

export function percentil(valores, p) {
  const validos = valores.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!validos.length) return null;
  const posicao = (validos.length - 1) * p;
  const base = Math.floor(posicao);
  const resto = posicao - base;
  return validos[base + 1] !== undefined
    ? validos[base] + resto * (validos[base + 1] - validos[base])
    : validos[base];
}

function iso(ano, mes, dia) {
  return `${ano}${String(mes).padStart(2, "0")}${String(dia).padStart(2, "0")}`;
}

/** Maior sequência de dias secos dentro da janela da época, por ano. */
export function diasSecosNaEpoca(serieChuva, epoca, anos) {
  if (!epoca) return null;
  const porAno = [];

  for (const ano of anos) {
    const meses = epoca.meses;
    // A época pode atravessar o fim do ano: montamos a lista de (ano, mês).
    const janela = [];
    let anoCorrente = ano;
    for (let i = 0; i < meses.length; i++) {
      const mes = meses[i];
      if (i > 0 && mes < meses[i - 1]) anoCorrente += 1;
      janela.push([anoCorrente, mes]);
    }
    if (janela[janela.length - 1][0] > anos[anos.length - 1]) continue;

    let maior = 0;
    let atual = 0;
    for (const [a, m] of janela) {
      const total = diasDoMes(a, m);
      for (let d = 1; d <= total; d++) {
        const valor = lerDiario(serieChuva, iso(a, m, d));
        if (valor === null) {
          atual = 0;
          continue;
        }
        if (valor < LIMIARES.diaSecoMm) {
          atual += 1;
          if (atual > maior) maior = atual;
        } else {
          atual = 0;
        }
      }
    }
    porAno.push({ ano, dias: maior });
  }

  if (!porAno.length) return null;
  const valores = porAno.map((p) => p.dias);
  const pior = porAno.reduce((a, b) => (b.dias > a.dias ? b : a));
  return {
    medianaDias: arredondar(mediana(valores), 1),
    piorAno: pior.ano,
    piorDias: pior.dias,
    anos: porAno.length,
  };
}

export function diasCalor(serieTmax, anos) {
  const porAno = [];
  for (const ano of anos) {
    let contagem = 0;
    let diasValidos = 0;
    for (let mes = 1; mes <= 12; mes++) {
      const total = diasDoMes(ano, mes);
      for (let d = 1; d <= total; d++) {
        const valor = lerDiario(serieTmax, iso(ano, mes, d));
        if (valor === null) continue;
        diasValidos++;
        if (valor >= LIMIARES.diaCalorTmaxC) contagem++;
      }
    }
    if (diasValidos > 300) porAno.push(contagem);
  }
  if (!porAno.length) return null;
  return {
    mediaDiasAno: arredondar(media(porAno), 1),
    maximoDiasAno: Math.max(...porAno),
    limiarC: LIMIARES.diaCalorTmaxC,
  };
}

export function mesesSoloSeco(climaGwetroot) {
  const corte = percentil(
    climaGwetroot.filter((v) => v !== null),
    LIMIARES.soloSecoPercentil
  );
  const meses = [];
  climaGwetroot.forEach((valor, indice) => {
    if (valor !== null && valor <= corte) meses.push(indice + 1);
  });
  return { meses, total: meses.length, limiarRelativo: arredondar(corte, 3) };
}
