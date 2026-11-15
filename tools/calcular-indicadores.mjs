// ============================================================================
// Terra Viva — tools/calcular-indicadores.mjs
// Lê tools/.bruto/<id>.json e escreve dados/clima/<id>.json com a
// climatologia mensal, a série anual e os indicadores derivados.
//
// Uso:  node tools/calcular-indicadores.mjs
//
// Cada indicador leva: valor, etiqueta de origem e o texto da regra.
// ============================================================================

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  LIMIARES,
  PARAMETROS,
  REGRAS,
  arredondar,
  climatologiaChuvaMm,
  climatologiaDeSerie,
  desvioPadrao,
  diasDoMes,
  diasCalor,
  diasSecosNaEpoca,
  epocaChuvosa,
  lerDiario,
  media,
  mediana,
  mesSuspeito,
  mesesSoloSeco,
  somaAnualChuva,
} from "./regras.mjs";


const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pastaBruto = path.join(raiz, "tools", ".bruto");
const pastaSaida = path.join(raiz, "dados", "clima");
mkdirSync(pastaSaida, { recursive: true });

const ficheiros = readdirSync(pastaBruto).filter((f) => f.endsWith(".json"));
if (!ficheiros.length) {
  console.error("Sem dados em bruto. Corre primeiro: node tools/descarregar-clima.mjs");
  process.exit(1);
}

const meta = {
  fonte: {
    nome: "NASA POWER",
    servico: "Monthly and Annual API + Daily API",
    url: "https://power.larc.nasa.gov/",
    comunidade: "AG (Agroclimatology)",
    resolucao: "ponto, derivado de MERRA-2 e CERES",
    licenca: "Dados NASA, uso livre com atribuição",
    nota: "O satélite e o modelo veem chuva, temperatura, humidade, radiação e vento. Não medem fertilidade do solo nem o que se passa dentro da tua machamba.",
  },
  parametros: Object.fromEntries(
    Object.entries(PARAMETROS).filter(([chave]) =>
      ["PRECTOTCORR", "T2M", "T2M_MAX", "T2M_MIN", "RH2M", "WS2M", "ALLSKY_SFC_SW_DWN", "GWETROOT"].includes(chave)
    )
  ),
  limiares: LIMIARES,
  regras: REGRAS,
};

writeFileSync(path.join(pastaSaida, "_meta.json"), JSON.stringify(meta, null, 2));

const resumo = [];

for (const ficheiro of ficheiros) {
  const pacote = JSON.parse(readFileSync(path.join(pastaBruto, ficheiro), "utf8"));
  const { local, mensal, diario, pedido } = pacote;
  const anos = [];
  for (let ano = pedido.periodo.inicio; ano <= pedido.periodo.fim; ano++) anos.push(ano);

  const m = mensal.properties.parameter;
  const d = diario.properties.parameter;

  // --- Controlo de qualidade da chuva mensal -----------------------------
  // A API dá mm/dia. Marcamos meses implausíveis e tiramos esse mês das
  // climatologias e o ano inteiro da série anual. A lista fica no ficheiro.
  const chuvaLimpa = { ...m.PRECTOTCORR };
  const mesesSuspeitos = [];
  for (const ano of anos) {
    for (let mes = 1; mes <= 12; mes++) {
      const chave = `${ano}${String(mes).padStart(2, "0")}`;
      const bruto = m.PRECTOTCORR[chave];
      if (mesSuspeito(bruto)) {
        mesesSuspeitos.push({
          ano,
          mes,
          mm_dia: arredondar(bruto, 1),
          mm_mes: arredondar(bruto * diasDoMes(ano, mes), 0),
        });
        chuvaLimpa[chave] = null;
      }
    }
  }
  const anosSuspeitos = [...new Set(mesesSuspeitos.map((x) => x.ano))].sort();

  // A chuva é convertida de mm/dia para mm/mês antes de qualquer conta.
  const climaChuva = climatologiaChuvaMm(chuvaLimpa, anos);
  const climaT2M = climatologiaDeSerie(m.T2M, anos);
  const climaTmax = climatologiaDeSerie(m.T2M_MAX, anos);
  const climaTmin = climatologiaDeSerie(m.T2M_MIN, anos);
  const climaRh = climatologiaDeSerie(m.RH2M, anos, 1);
  const climaRad = climatologiaDeSerie(m.ALLSKY_SFC_SW_DWN, anos, 2);
  const climaSolo = climatologiaDeSerie(m.GWETROOT, anos, 3);

  const chuvasAnuais = anos
    .map((ano) => somaAnualChuva(chuvaLimpa, ano))
    .map((v) => (v === null ? null : arredondar(v, 0)));

  const validas = chuvasAnuais.filter((v) => v !== null);
  const mediaAnual = media(validas);
  const desvio = desvioPadrao(validas);
  const indiceMax = chuvasAnuais.indexOf(Math.max(...validas));
  const indiceMin = chuvasAnuais.indexOf(Math.min(...validas));

  const epoca = epocaChuvosa(climaChuva);
  const secos = diasSecosNaEpoca(d.PRECTOTCORR, epoca, anos);
  const calor = diasCalor(d.T2M_MAX, anos);
  const soloSeco = mesesSoloSeco(climaSolo);

  const saida = {
    versao: "1",
    local: {
      id: local.id,
      nome: local.nome,
      provincia: local.provincia,
      lat: local.lat,
      lon: local.lon,
    },
    periodo: pedido.periodo,
    anosComDados: validas.length,
    fonte: "nasa-power",
    qualidade: {
      mesesSuspeitos,
      anosSuspeitos,
      anosExcluidos: anosSuspeitos.length,
      regra: REGRAS.qualidade.texto,
      regraEN: REGRAS.qualidade.textoEN,
    },
    climatologiaMensal: {
      chuva_mm: climaChuva,
      t2m_c: climaT2M,
      tmax_c: climaTmax,
      tmin_c: climaTmin,
      rh2m_pct: climaRh,
      radiacao_mj_m2_dia: climaRad,
      gwetroot: climaSolo,
    },
    serieAnual: {
      anos,
      chuva_mm: chuvasAnuais,
    },
    indicadores: {
      chuvaAnual: {
        media_mm: arredondar(mediaAnual, 0),
        mediana_mm: arredondar(mediana(validas), 0),
        minimo: { valor_mm: chuvasAnuais[indiceMin], ano: anos[indiceMin] },
        maximo: { valor_mm: chuvasAnuais[indiceMax], ano: anos[indiceMax] },
        anos: validas.length,
        etiqueta: "nasa",
        regra: "Soma dos doze meses de cada ano, a partir da precipitação mensal da NASA POWER. A média é sobre todos os anos com os doze meses completos.",
        regraEN:
          "Sum of the twelve months of each year, from NASA POWER monthly precipitation. The mean is over all years with twelve complete months.",
      },
      variacaoAnual: {
        coeficienteVariacao_pct: arredondar((desvio / mediaAnual) * 100, 1),
        etiqueta: "calculado",
        regra: REGRAS.variacaoAnual.texto,
        regraEN: REGRAS.variacaoAnual.textoEN,
      },
      epocaChuvosa: epoca
        ? {
            inicioMes: epoca.inicio,
            fimMes: epoca.fim,
            duracaoMeses: epoca.duracaoMeses,
            etiqueta: "calculado",
            regra: REGRAS.epocaChuvosa.texto,
            regraEN: REGRAS.epocaChuvosa.textoEN,
          }
        : { valor: null, etiqueta: "calculado", regra: REGRAS.epocaChuvosa.texto },
      diasSecosSeguidos: secos
        ? {
            medianaDias: secos.medianaDias,
            piorAno: secos.piorAno,
            piorDias: secos.piorDias,
            anos: secos.anos,
            etiqueta: "calculado",
            regra: REGRAS.diasSecos.texto,
            regraEN: REGRAS.diasSecos.textoEN,
          }
        : null,
      stressTermico: calor
        ? {
            mediaDiasAno: calor.mediaDiasAno,
            maximoDiasAno: calor.maximoDiasAno,
            limiarC: calor.limiarC,
            etiqueta: "calculado",
            regra: REGRAS.stressTermico.texto,
            regraEN: REGRAS.stressTermico.textoEN,
          }
        : null,
      mesesSoloSeco: {
        meses: soloSeco.meses,
        total: soloSeco.total,
        limiarRelativo: soloSeco.limiarRelativo,
        etiqueta: "calculado",
        regra: REGRAS.mesesSoloSeco.texto,
        regraEN: REGRAS.mesesSoloSeco.textoEN,
      },
      mesesTerraNua: {
        valor: null,
        etiqueta: "calculado",
        regra: REGRAS.terraNua.texto,
        regraEN: REGRAS.terraNua.textoEN,
        nota: "TODO_FACTO: o valor depende da rotação; é calculado no Relógio da Terra.",
      },
    },
    atualizadoEm: pacote.descarregadoEm,
  };

  writeFileSync(path.join(pastaSaida, local.id + ".json"), JSON.stringify(saida));
  resumo.push({
    id: local.id,
    nome: local.nome,
    provincia: local.provincia,
    media: saida.indicadores.chuvaAnual.media_mm,
    epoca: epoca ? epoca.inicio + "–" + epoca.fim + " (" + epoca.duracaoMeses + "m)" : "—",
    secos: secos ? secos.medianaDias + " / " + secos.piorDias : "—",
    calor: calor ? calor.mediaDiasAno : "—",
    soloSeco: soloSeco.total + "m",
    cv: saida.indicadores.variacaoAnual.coeficienteVariacao_pct,
    ficheiro: local.id + ".json",
  });
  console.log("· dados/clima/" + local.id + ".json · chuva " + saida.indicadores.chuvaAnual.media_mm + " mm");
}

writeFileSync(
  path.join(raiz, "tools", ".resumo.json"),
  JSON.stringify({ geradoEm: new Date().toISOString(), locais: resumo }, null, 2)
);

console.log("\nResumo:");
console.table(resumo);
