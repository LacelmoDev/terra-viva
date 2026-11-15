// ============================================================================
// Terra Viva — motor.js
// Motor de regras transparente. Sem caixa-preta, sem IA: cada pontuação sai de
// uma conta que está escrita aqui e que o site mostra ao utilizador.
//
// Entradas: clima da zona (dados/clima/<id>.json), fichas das culturas
// (dados/culturas.json), histórico do agricultor, prioridades e restrições.
// Saída: três rotações pontuadas, com porquês, benefícios, lacunas e riscos.
//
// Critérios disponíveis com os dados que temos:
//   água, calor, azoto, pragas, risco.
// Critérios sem dados (ficam null e são declarados, nunca inventados):
//   cobertura do solo, matéria orgânica, rendimento/mercado.
// ============================================================================

const clamp = (v) => Math.max(0, Math.min(1, v));

const MESES_EPOCA_PADRAO = 6;

/** Meses (1–12) da época chuvosa, a partir do início e fim guardados. */
export function mesesDaEpoca(epoca) {
  if (!epoca?.inicioMes || !epoca?.fimMes) return [];
  const meses = [];
  let mes = epoca.inicioMes;
  for (let i = 0; i < 12; i++) {
    meses.push(mes);
    if (mes === epoca.fimMes) break;
    mes = mes === 12 ? 1 : mes + 1;
  }
  return meses;
}

function mediaNaEpoca(climatologia, meses) {
  const valores = meses.map((m) => climatologia[m - 1]).filter((v) => v !== null && v !== undefined);
  if (!valores.length) return null;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

const ehLeguminosa = (cultura) => Boolean(cultura?.fixaAzoto?.valor);
const familia = (cultura) => cultura?.familia?.valor ?? null;

// ---------------------------------------------------------------------------
// Critérios
// ---------------------------------------------------------------------------

export function criterioAgua(cultura, clima) {
  const otima = cultura.chuvaAnualMm?.otima;
  const chuva = clima.indicadores?.chuvaAnual?.media_mm;
  if (chuva == null || !otima || otima[0] == null || otima[1] == null) return null;

  const [minimo, maximo] = otima;
  let ajusteChuva;
  if (chuva >= minimo && chuva <= maximo) ajusteChuva = 1;
  else if (chuva < minimo) ajusteChuva = clamp(chuva / minimo);
  else ajusteChuva = clamp(maximo / chuva);

  const meses = clima.indicadores?.epocaChuvosa?.duracaoMeses ?? MESES_EPOCA_PADRAO;
  const ciclo = cultura.cicloDias?.max ?? cultura.cicloDias?.min ?? null;
  let ajusteCiclo = null;
  if (ciclo) {
    const diasEpoca = meses * 30.4;
    ajusteCiclo = ciclo <= diasEpoca ? 1 : clamp(diasEpoca / ciclo);
  }

  const valor = ajusteCiclo === null ? ajusteChuva : 0.7 * ajusteChuva + 0.3 * ajusteCiclo;

  return {
    chave: "agua",
    valor: clamp(valor),
    detalhe: { chuvaLocal: chuva, otima, ajusteChuva, ajusteCiclo, mesesEpoca: meses, cicloDias: ciclo },
  };
}

export function criterioCalor(cultura, clima) {
  const otima = cultura.temperaturaC?.otima;
  if (!otima || otima[0] == null || otima[1] == null) return null;

  const meses = mesesDaEpoca(clima.indicadores?.epocaChuvosa);
  const temperatura = mediaNaEpoca(clima.climatologiaMensal?.t2m_c ?? [], meses);
  if (temperatura === null) return null;

  const [minimo, maximo] = otima;
  const fora = temperatura < minimo ? minimo - temperatura : temperatura > maximo ? temperatura - maximo : 0;
  const base = clamp(1 - fora / 6);

  const diasCalor = clima.indicadores?.stressTermico?.mediaDiasAno ?? 0;
  const penalidadeCalor = clamp(diasCalor / 60);

  return {
    chave: "calor",
    valor: clamp(0.75 * base + 0.25 * (1 - penalidadeCalor)),
    detalhe: { temperaturaEpoca: Math.round(temperatura * 10) / 10, otima, diasCalor },
  };
}

export function criterioAzoto(cultura) {
  if (cultura.fixaAzoto?.valor === undefined || cultura.fixaAzoto?.valor === null) return null;
  return {
    chave: "azoto",
    valor: ehLeguminosa(cultura) ? 1 : 0.1,
    detalhe: { fixa: ehLeguminosa(cultura), familia: familia(cultura) },
  };
}

export function criterioPragas(cultura, culturaAnterior) {
  if (!culturaAnterior) return null;
  const atual = familia(cultura);
  const anterior = familia(culturaAnterior);
  if (!atual || !anterior) return null;
  return {
    chave: "pragas",
    valor: atual === anterior ? 0.1 : 1,
    detalhe: { familiaAtual: atual, familiaAnterior: anterior },
  };
}

/** Composto nosso: água, calor e irregularidade da chuva. */
export function criterioRisco(agua, calor, clima) {
  if (!agua || !calor) return null;
  const variacao = clima.indicadores?.variacaoAnual?.coeficienteVariacao_pct;
  const estabilidade = variacao == null ? 0.5 : clamp(1 - variacao / 100);
  return {
    chave: "risco",
    valor: clamp(0.5 * agua.valor + 0.3 * calor.valor + 0.2 * estabilidade),
    detalhe: {
      agua: agua.valor,
      calor: calor.valor,
      variacaoAnual_pct: variacao,
    },
  };
}

/** Pontua uma cultura dentro de uma sequência. */
export function pontuarCultura(cultura, clima, culturaAnterior) {
  const agua = criterioAgua(cultura, clima);
  const calor = criterioCalor(cultura, clima);
  const criterios = {
    agua,
    calor,
    azoto: criterioAzoto(cultura),
    pragas: criterioPragas(cultura, culturaAnterior),
    risco: criterioRisco(agua, calor, clima),
    cobertura: null, // sem dados
    materiaOrganica: null, // sem dados
    rendimento: null, // sem dados
  };
  return { cultura, criterios };
}

// ---------------------------------------------------------------------------
// Pesos
// ---------------------------------------------------------------------------

export const CRITERIOS = [
  { chave: "agua", grupo: "agua" },
  { chave: "calor", grupo: "risco" },
  { chave: "azoto", grupo: "solo" },
  { chave: "pragas", grupo: "solo" },
  { chave: "risco", grupo: "risco" },
  { chave: "cobertura", grupo: "solo" },
  { chave: "materiaOrganica", grupo: "solo" },
  { chave: "rendimento", grupo: "rendimento" },
];

/**
 * Pesos finais por critério. Prioridade 0,5 / 1 / 1,5 (baixa, normal, alta).
 * Com irrigação a água pesa menos; sem irrigação pesa mais.
 */
export function calcularPesos(prioridades = {}, restricoes = {}) {
  const grupo = {
    agua: prioridades.agua ?? 1,
    rendimento: prioridades.rendimento ?? 1,
    solo: prioridades.solo ?? 1,
    risco: prioridades.risco ?? 1,
  };

  const pesos = {};
  for (const criterio of CRITERIOS) {
    pesos[criterio.chave] = grupo[criterio.grupo] ?? 1;
  }

  if (restricoes.irrigacao === true) pesos.agua *= 0.6;
  else pesos.agua *= 1.2;

  return pesos;
}

// ---------------------------------------------------------------------------
// Sequências
// ---------------------------------------------------------------------------

function assinaturaFamilias(sequencia, porId) {
  return [...new Set(sequencia.map((id) => familia(porId[id])).filter(Boolean))].sort().join("|");
}

function diversidade(sequencia, porId) {
  const familias = new Set(sequencia.map((id) => familia(porId[id])).filter(Boolean));
  return clamp(familias.size / 3);
}

export function pontuarSequencia(sequencia, contexto) {
  const { clima, porId, pesos, culturaBase } = contexto;

  const pontuadas = sequencia.map((id, indice) => {
    const anterior = indice === 0 ? culturaBase : porId[sequencia[indice - 1]];
    return pontuarCultura(porId[id], clima, anterior);
  });

  // Média ponderada por critério, só sobre os critérios que têm valor.
  const somas = {};
  for (const criterio of CRITERIOS) {
    const valores = pontuadas
      .map((p) => p.criterios[criterio.chave])
      .filter((c) => c && typeof c.valor === "number")
      .map((c) => c.valor);
    somas[criterio.chave] = valores.length
      ? valores.reduce((a, b) => a + b, 0) / valores.length
      : null;
  }

  let somaPesos = 0;
  let somaValores = 0;
  const contributos = {};
  for (const criterio of CRITERIOS) {
    const valor = somas[criterio.chave];
    if (valor === null) continue;
    const peso = pesos[criterio.chave] ?? 1;
    contributos[criterio.chave] = { valor, peso, contributo: valor * peso };
    somaPesos += peso;
    somaValores += valor * peso;
  }

  const mediaCriterios = somaPesos ? somaValores / somaPesos : 0;
  const div = diversidade(sequencia, porId);
  const total = clamp(0.8 * mediaCriterios + 0.2 * div);

  return {
    sequencia,
    pontuadas,
    criterios: somas,
    contributos,
    diversidade: div,
    pontuacao: Math.round(total * 100),
    assinatura: assinaturaFamilias(sequencia, porId),
  };
}

/** Todas as sequências de 3 épocas sem repetir a mesma cultura em anos seguidos. */
export function gerarCandidatos(culturas) {
  const ids = culturas.map((c) => c.id);
  const saida = [];
  for (const a of ids) {
    for (const b of ids) {
      if (b === a) continue;
      for (const c of ids) {
        if (c === b) continue;
        saida.push([a, b, c]);
      }
    }
  }
  return saida;
}

// ---------------------------------------------------------------------------
// Porquês, benefícios, lacunas, riscos
// ---------------------------------------------------------------------------

function regrasDaSequencia(sequencia, contexto) {
  const { porId, culturaBase } = contexto;
  const regras = [];
  const culturas = sequencia.map((id) => porId[id]);

  // leguminosa depois de não-leguminosa
  for (let i = 0; i < sequencia.length; i++) {
    const anterior = i === 0 ? culturaBase : culturas[i - 1];
    if (ehLeguminosa(culturas[i]) && anterior && !ehLeguminosa(anterior)) {
      regras.push({ chave: "leguminosa", vars: { cultura: culturas[i].nome, anterior: anterior.nome } });
      break;
    }
  }

  const familias = new Set(culturas.map(familia).filter(Boolean));
  if (familias.size === 3) {
    regras.push({ chave: "diversidade", vars: { familias: [...familias].length } });
  }

  const repetiu = sequencia.some((id, i) => i > 0 && id === sequencia[i - 1]);
  if (!repetiu) regras.push({ chave: "semRepeticao", vars: {} });

  return regras;
}

function lacunasDaSequencia(sequencia, porId) {
  const lacunas = new Set();
  for (const id of sequencia) {
    const cultura = porId[id];
    if (!cultura.aguaNoCicloMm?.valor) lacunas.add("aguaCiclo");
    if (!cultura.profundidadeRaizCm?.valor) lacunas.add("raiz");
    if (!cultura.coberturaSolo?.valor) lacunas.add("cobertura");
    if (!cultura.uso?.valor) lacunas.add("uso");
  }
  lacunas.add("rendimento");
  lacunas.add("solo");
  return [...lacunas];
}

function riscosDaSequencia(contexto, pontuacao) {
  const riscos = [];
  const i = contexto.clima.indicadores ?? {};

  if (i.diasSecosSeguidos?.piorDias >= 21) {
    riscos.push({ chave: "seca", vars: { dias: i.diasSecosSeguidos.piorDias } });
  }
  if (i.stressTermico?.mediaDiasAno >= 10) {
    riscos.push({ chave: "calor", vars: { dias: Math.round(i.stressTermico.mediaDiasAno) } });
  }
  if (i.variacaoAnual?.coeficienteVariacao_pct >= 35) {
    riscos.push({ chave: "chuvaIrregular", vars: { cv: i.variacaoAnual.coeficienteVariacao_pct } });
  }

  const agua = pontuacao.criterios.agua;
  if (agua !== null && agua < 0.6) riscos.push({ chave: "aguaAjuste", vars: {} });

  riscos.push({ chave: "variedade", vars: {} });
  return riscos;
}

function beneficiosDaSequencia(sequencia, contexto, pontuacao) {
  const { porId } = contexto;
  const beneficios = [];
  const culturas = sequencia.map((id) => porId[id]);

  if (culturas.some(ehLeguminosa)) beneficios.push({ chave: "azoto", vars: {} });
  if (pontuacao.criterios.pragas !== null && pontuacao.criterios.pragas >= 0.9) {
    beneficios.push({ chave: "pragas", vars: {} });
  }
  if (pontuacao.criterios.agua !== null && pontuacao.criterios.agua >= 0.75) {
    beneficios.push({ chave: "agua", vars: {} });
  }
  if (pontuacao.diversidade >= 0.99) beneficios.push({ chave: "diversidade", vars: {} });
  if (!beneficios.length) beneficios.push({ chave: "estabilidade", vars: {} });

  return beneficios;
}

// ---------------------------------------------------------------------------
// Escolha final
// ---------------------------------------------------------------------------

/**
 * @param {object} entrada
 * @param {object} entrada.clima       dados/clima/<id>.json
 * @param {object} entrada.catalogo    dados/culturas.json
 * @param {object} entrada.historico   { ultima: id, anterior: id|null }
 * @param {object} entrada.prioridades { agua, rendimento, solo, risco } 0.5|1|1.5
 * @param {object} entrada.restricoes  { irrigacao: bool, maoDeObra: 'pouca'|'normal'|'muita' }
 */
export function escolherRotacoes({ clima, catalogo, historico, prioridades = {}, restricoes = {} }) {
  const porId = Object.fromEntries(catalogo.culturas.map((c) => [c.id, c]));
  const culturaBase = historico?.ultima ? porId[historico.ultima] : null;
  if (!culturaBase) {
    return { erro: "semHistorico" };
  }

  const contexto = { clima, porId, pesos: calcularPesos(prioridades, restricoes), culturaBase };

  // Rotação atual: repetir o ciclo que o agricultor já faz.
  const atualSeq = [
    historico.ultima,
    historico.anterior ?? historico.ultima,
    historico.ultima,
  ];
  const atual = pontuarSequencia(atualSeq, contexto);

  // Candidatos: todas as sequências válidas, exceto a atual.
  const candidatos = gerarCandidatos(catalogo.culturas)
    .filter((seq) => seq.join("|") !== atualSeq.join("|"))
    .map((seq) => pontuarSequencia(seq, contexto))
    .sort((a, b) => b.pontuacao - a.pontuacao);

  if (!candidatos.length) return { erro: "semAlternativas" };

  const melhor = candidatos[0];

  // A segunda alternativa procura famílias diferentes da atual e da melhor.
  const familiasProibidas = new Set([atual.assinatura, melhor.assinatura]);
  const diferentes = candidatos.filter((c) => !familiasProibidas.has(c.assinatura));
  const segunda = (diferentes.length ? diferentes : candidatos.slice(1))[0];

  const rotacoes = [
    { ...atual, tipo: "atual", regras: [{ chave: "atual", vars: {} }] },
    { ...melhor, tipo: "alternativa", regras: regrasDaSequencia(melhor.sequencia, contexto) },
    { ...segunda, tipo: "alternativa", regras: regrasDaSequencia(segunda.sequencia, contexto) },
  ];

  return {
    rotacoes: rotacoes.map((rotacao, indice) => ({
      id: indice === 0 ? "atual" : "alternativa-" + indice,
      tipo: rotacao.tipo,
      sequencia: rotacao.sequencia,
      culturas: rotacao.sequencia.map((id) => {
        const c = porId[id];
        return {
          id: c.id,
          nome: c.nome,
          nomeEN: c.nomeEN,
          familia: familia(c),
          fixaAzoto: ehLeguminosa(c),
          cicloDias: c.cicloDias,
          confianca: c.confianca,
        };
      }),
      pontuacao: rotacao.pontuacao,
      criterios: rotacao.criterios,
      contributos: rotacao.contributos,
      diversidade: rotacao.diversidade,
      regras: rotacao.regras,
      beneficios: beneficiosDaSequencia(rotacao.sequencia, contexto, rotacao),
      lacunas: lacunasDaSequencia(rotacao.sequencia, porId),
      riscos: riscosDaSequencia(contexto, rotacao),
    })),
    pesos: contexto.pesos,
    semDados: ["cobertura", "materiaOrganica", "rendimento"],
    notas: [
      restricoes.maoDeObra && restricoes.maoDeObra !== "normal" ? "maoDeObra" : null,
      restricoes.irrigacao ? "irrigacao" : "sequeiro",
    ].filter(Boolean),
  };
}
