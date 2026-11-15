// ============================================================================
// Terra Viva — tools/make-icons.mjs
// Desenha os ícones do PWA sem dependências externas (PNG escrito à mão com zlib).
//
// Uso:  node tools/make-icons.mjs
// Saída: icons/icon-192.png, icon-512.png, icon-maskable-512.png,
//        icons/apple-touch-icon-180.png
//
// O motivo é o mesmo do selo: três anéis de terra, milho e folha sobre
// verde-noite. Superamostragem 3× para contornos suaves.
// ============================================================================

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pasta = path.join(raiz, "icons");
mkdirSync(pasta, { recursive: true });

// ---------- PNG ----------
const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[n] = c >>> 0;
  }
  return tabela;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) c = TABELA_CRC[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloco(tipo, dados) {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length, 0);
  const nome = Buffer.from(tipo, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([nome, dados])), 0);
  return Buffer.concat([tamanho, nome, dados, crc]);
}

function escreverPNG(largura, altura, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const linha = largura * 4;
  const cru = Buffer.alloc((linha + 1) * altura);
  for (let y = 0; y < altura; y++) {
    cru[y * (linha + 1)] = 0; // filtro nenhum
    rgba.copy(cru, y * (linha + 1) + 1, y * linha, (y + 1) * linha);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloco("IHDR", ihdr),
    bloco("IDAT", deflateSync(cru, { level: 9 })),
    bloco("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- Desenho ----------
const FUNDO = [18, 26, 21];
const TERRA = [210, 104, 63];
const MILHO = [224, 178, 74];
const FOLHA = [138, 168, 120];
const CREME = [243, 235, 220];

const aneis = [
  { raio: 0.3, espessura: 0.052, inicio: 205, fim: 500, cor: TERRA },
  { raio: 0.215, espessura: 0.048, inicio: 330, fim: 600, cor: MILHO },
  { raio: 0.132, espessura: 0.044, inicio: 60, fim: 300, cor: FOLHA },
];

function corEm(nx, ny, escala) {
  const distancia = Math.hypot(nx, ny);
  const angulo = ((Math.atan2(ny, nx) * 180) / Math.PI + 360) % 360;

  for (const anel of aneis) {
    const raio = anel.raio * escala;
    const espessura = (anel.espessura * escala) / 2;
    if (Math.abs(distancia - raio) > espessura) continue;
    const inicio = anel.inicio % 360;
    const fim = anel.fim % 360;
    const dentro = inicio <= fim ? angulo >= inicio && angulo <= fim : angulo >= inicio || angulo <= fim;
    if (dentro) return anel.cor;
  }

  if (distancia < 0.045 * escala) return CREME;
  return FUNDO;
}

function desenhar(tamanho, escala) {
  const ss = 3;
  const grande = tamanho * ss;
  const pixels = Buffer.alloc(tamanho * tamanho * 4);

  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const nx = (x + (sx + 0.5) / ss) / tamanho - 0.5;
          const ny = (y + (sy + 0.5) / ss) / tamanho - 0.5;
          const cor = corEm(nx, ny, escala);
          r += cor[0];
          g += cor[1];
          b += cor[2];
        }
      }
      const total = ss * ss;
      const i = (y * tamanho + x) * 4;
      pixels[i] = Math.round(r / total);
      pixels[i + 1] = Math.round(g / total);
      pixels[i + 2] = Math.round(b / total);
      pixels[i + 3] = 255;
    }
  }

  return escreverPNG(tamanho, tamanho, pixels);
}

const ficheiros = [
  ["icon-192.png", 192, 1],
  ["icon-512.png", 512, 1],
  ["icon-maskable-512.png", 512, 0.78],
  ["apple-touch-icon-180.png", 180, 1],
];

for (const [nome, tamanho, escala] of ficheiros) {
  const png = desenhar(tamanho, escala);
  writeFileSync(path.join(pasta, nome), png);
  console.log("icons/" + nome + " · " + tamanho + "px · " + (png.length / 1024).toFixed(1) + " KB");
}
