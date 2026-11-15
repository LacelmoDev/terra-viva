// ============================================================================
// Terra Viva — tools/build-map.mjs
// Gera dados/angola.json a partir do contorno de Angola (Natural Earth, 1:110m).
//
// Uso:  node tools/build-map.mjs
//
// Entrada:  tools/data/AGO.geo.json  (GeoJSON, domínio público)
// Saída:    dados/angola.json        (contorno em SVG + parâmetros de projeção)
//
// A projeção é equirretangular corrigida por cos(latitude média): o mesmo
// fator serve para desenhar o contorno e para colocar os pontos das zonas,
// por isso o mapa nunca desalinha.
// ============================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origem = path.join(raiz, "tools", "data", "AGO.geo.json");
const destino = path.join(raiz, "dados", "angola.json");

const geojson = JSON.parse(readFileSync(origem, "utf8"));
const feature = geojson.features[0];
const geometria = feature.geometry;

const poligonos =
  geometria.type === "MultiPolygon" ? geometria.coordinates : [geometria.coordinates];

let minLon = Infinity;
let maxLon = -Infinity;
let minLat = Infinity;
let maxLat = -Infinity;
const aneis = [];

for (const poligono of poligonos) {
  const anel = poligono[0]; // contorno exterior; os buracos não se aplicam a Angola
  aneis.push(anel);
  for (const [lon, lat] of anel) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
}

const latMedia = (minLat + maxLat) / 2;
const cosseno = Math.cos((latMedia * Math.PI) / 180);
const largura = 1000;
const k = largura / ((maxLon - minLon) * cosseno);
const altura = Math.round((maxLat - minLat) * k);

const arredondar = (valor) => Math.round(valor * 10) / 10;

const contorno = aneis
  .map((anel) => {
    const pontos = anel.map(([lon, lat]) => {
      const x = arredondar((lon - minLon) * cosseno * k);
      const y = arredondar((maxLat - lat) * k);
      return x + "," + y;
    });
    return "M" + pontos.join("L") + "Z";
  })
  .join("");

const saida = {
  versao: "1",
  geradoPor: "tools/build-map.mjs",
  fonte: {
    nome: "Natural Earth",
    escala: "1:110m",
    url: "https://www.naturalearthdata.com/",
    licenca: "Domínio público",
    ficheiro: "tools/data/AGO.geo.json",
    nota: "Contorno simplificado, para leitura e contexto. Não representa fronteiras oficiais nem limites administrativos.",
  },
  viewBox: [0, 0, largura, altura],
  proj: {
    tipo: "equirretangular-corrigida",
    lon0: +minLon.toFixed(6),
    lat0: +maxLat.toFixed(6),
    kx: +(cosseno * k).toFixed(6),
    ky: +k.toFixed(6),
  },
  contorno,
};

writeFileSync(destino, JSON.stringify(saida));

const pontos = contorno.split("L").length;
console.log(
  "dados/angola.json gerado · " +
    aneis.length +
    " anel(es) · " +
    pontos +
    " vértices · viewBox " +
    saida.viewBox.join("×") +
    " · " +
    (JSON.stringify(saida).length / 1024).toFixed(1) +
    " KB"
);
