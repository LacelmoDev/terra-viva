// ============================================================================
// Terra Viva — tools/relatorio.mjs
// Escreve tools/RELATORIO-DADOS.md: a tabela de verificação que se lê antes de
// confiar nos números. Não calcula nada de novo, só arruma o que os scripts
// anteriores gravaram.
//
// Uso:  node tools/relatorio.mjs
// ============================================================================

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pastaClima = path.join(raiz, "dados", "clima");

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const nomeMes = (n) => MESES[(n - 1) % 12];

const meta = JSON.parse(readFileSync(path.join(pastaClima, "_meta.json"), "utf8"));
const ficheiros = readdirSync(pastaClima)
  .filter((f) => f.endsWith(".json") && f !== "_meta.json")
  .sort();

const locais = ficheiros.map((f) => JSON.parse(readFileSync(path.join(pastaClima, f), "utf8")));
const culturas = JSON.parse(readFileSync(path.join(raiz, "dados", "culturas.json"), "utf8"));

const fmt = (v, unidade = "") => (v === null || v === undefined ? "—" : v + unidade);

let md = "";

md += "# Relatório de verificação dos dados\n\n";
md += "Gerado por `node tools/relatorio.mjs`. Serve para conferir os números antes de os mostrar.\n\n";
md += `- Fonte do clima: **${meta.fonte.nome}** (${meta.fonte.servico}), comunidade ${meta.fonte.comunidade}.\n`;
md += `- Período: ${meta.regras ? "" : ""}2001–2024, oito zonas de Angola.\n`;
md += `- Culturas: **FAO EcoCrop** (cópia CSV do OpenCLIM), consulta de ${culturas.fonte.consulta}.\n`;
md += "- Limiares usados (todos escolha nossa, escritos no código):\n";
for (const [chave, valor] of Object.entries(meta.limiares)) {
  md += `  - \`${chave}\` = ${valor}\n`;
}
md += "\n---\n\n";

md += "## Clima por zona\n\n";
md += "| Zona | Prov. | Chuva anual (mm) | Época chuvosa | Dias secos seguidos (mediana / pior) | Dias ≥35 °C (média/ano) | Meses solo mais seco | Variação anual (CV) | Anos usados |\n";
md += "| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n";
for (const d of locais) {
  const i = d.indicadores;
  const ep = i.epocaChuvosa;
  const epoca = ep?.inicioMes
    ? `${nomeMes(ep.inicioMes)}–${nomeMes(ep.fimMes)} (${ep.duracaoMeses} meses)`
    : "—";
  const secos = i.diasSecosSeguidos
    ? `${i.diasSecosSeguidos.medianaDias} / ${i.diasSecosSeguidos.piorDias} (${i.diasSecosSeguidos.piorAno})`
    : "—";
  const solo = i.mesesSoloSeco.meses.map(nomeMes).join(", ") || "—";
  md += `| ${d.local.nome} | ${d.local.provincia} | ${fmt(i.chuvaAnual.media_mm)} | ${epoca} | ${secos} | ${fmt(i.stressTermico?.mediaDiasAno)} | ${solo} | ${fmt(i.variacaoAnual.coeficienteVariacao_pct, " %")} | ${d.anosComDados} |\n`;
}

md += "\n### Máximos e mínimos de chuva anual\n\n";
md += "| Zona | Ano mais seco | Ano mais chuvoso |\n| --- | --- | --- |\n";
for (const d of locais) {
  const c = d.indicadores.chuvaAnual;
  md += `| ${d.local.nome} | ${c.minimo.ano}: ${c.minimo.valor_mm} mm | ${c.maximo.ano}: ${c.maximo.valor_mm} mm |\n`;
}

md += "\n### Controlo de qualidade\n\n";
const comSuspeitos = locais.filter((d) => d.qualidade.mesesSuspeitos.length);
if (!comSuspeitos.length) {
  md += "Nenhum mês marcado como suspeito.\n";
} else {
  md += "| Zona | Mês suspeito | Valor | Consequência |\n| --- | --- | --- | --- |\n";
  for (const d of comSuspeitos) {
    for (const m of d.qualidade.mesesSuspeitos) {
      md += `| ${d.local.nome} | ${nomeMes(m.mes)} ${m.ano} | ${m.mm_mes} mm no mês | ano excluído das médias |\n`;
    }
  }
  md += `\nRegra aplicada: ${comSuspeitos[0].qualidade.regra}\n`;
}

md += "\n### Chuva média mensal (mm)\n\n";
md += "| Zona | " + MESES.join(" | ") + " |\n";
md += "| --- | " + MESES.map(() => "---").join(" | ") + " |\n";
for (const d of locais) {
  md += `| ${d.local.nome} | ${d.climatologiaMensal.chuva_mm.map((v) => (v === null ? "—" : Math.round(v))).join(" | ")} |\n`;
}

md += "\n---\n\n## Fichas das culturas\n\n";
md += "| Cultura | Família | Ciclo (dias) | Temp. ótima (°C) | Chuva anual (mm) | Fixa azoto | Uso | Confiança | Campos em falta |\n";
md += "| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n";
for (const c of culturas.culturas) {
  md += `| ${c.nome} (\`${c.id}\`) | ${c.familia.valor ?? "—"} | ${c.cicloDias.min}–${c.cicloDias.max} | ${c.temperaturaC.otima.join("–")} | ${c.chuvaAnualMm.otima.join("–")} | ${c.fixaAzoto.valor ? "sim" : "não"} | ${c.uso.valor ? c.uso.valor.join(", ") : "TODO_FACTO"} | ${c.confianca} | ${c.camposEmFalta.join(", ") || "—"} |\n`;
}

md += "\nCampos com `TODO_FACTO` em todas as culturas: necessidade de água por ciclo, profundidade de raiz e cobertura do solo. Precisam de fonte própria e da validação da equipa agrícola; até lá o site mostra «dado em falta».\n";

md += "\n---\n\n## Conferência rápida com valores publicados\n\n";
md += "Comparação indicativa, feita à mão, com normais publicadas (fontes secundárias, não estações oficiais):\n\n";
md += "| Zona | Aqui (NASA POWER, 2001–2024) | Normal publicada | Leitura |\n| --- | --- | --- | --- |\n";
md += "| Huambo | 1 101 mm/ano | 1 221 mm (1991–2020, monthlyclimate.com) · 1 365 mm (climatestotravel.com) | a reanálise fica 10–20 % abaixo |\n";
md += "| Malanje | 797 mm/ano | 1 008 mm (1991–2020, monthlyclimate.com) | a reanálise subestima; validar com estação local |\n";
md += "\nIsto não é erro de código: é a diferença entre um modelo de reanálise e uma estação. Fica escrito para não ser escondido.\n";

md += "\n## Limitações assumidas\n\n";
md += "- O satélite vê chuva, temperatura, humidade, radiação, vento e humidade do solo do modelo. Não vê fertilidade, textura nem o que se passa na machamba.\n";
md += "- O GWETROOT nunca desce perto de zero, por isso o indicador de solo seco é relativo ao próprio local (quartil mais seco), não um corte absoluto.\n";
md += "- Os dias secos e o stress térmico vêm do produto diário da POWER, agregados por nós.\n";
md += "- `mesesTerraNua` não tem valor fixo no ficheiro: depende da rotação e da época escolhidas e é calculado no browser pelo Relógio da Terra.\n";

writeFileSync(path.join(raiz, "tools", "RELATORIO-DADOS.md"), md);
console.log("tools/RELATORIO-DADOS.md escrito · " + locais.length + " zonas · " + culturas.culturas.length + " culturas");
