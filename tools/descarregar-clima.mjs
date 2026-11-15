// ============================================================================
// Terra Viva — tools/descarregar-clima.mjs
// Descarrega a NASA POWER para os oito locais e guarda a resposta em bruto.
//
// Uso:  node tools/descarregar-clima.mjs [--so id1,id2]
//
// Entrada: dados/locais.json
// Saída:   tools/.bruto/<id>.json   (resposta da API, sem tratamento)
//
// Nada aqui é inventado: os parâmetros são pedidos à API e o que vem em bruto
// fica guardado para auditoria. O cálculo dos indicadores está no script
// calcular-indicadores.mjs, com as regras em regras.mjs.
// ============================================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pastaBruto = path.join(raiz, "tools", ".bruto");
mkdirSync(pastaBruto, { recursive: true });

export const PERIODO = { inicio: 2001, fim: 2024 };
export const PARAMETROS_MENSAIS = [
  "PRECTOTCORR",
  "T2M",
  "T2M_MAX",
  "T2M_MIN",
  "RH2M",
  "WS2M",
  "ALLSKY_SFC_SW_DWN",
  "GWETROOT",
  "GWETPROF",
];
export const PARAMETROS_DIARIOS = ["PRECTOTCORR", "T2M_MAX", "T2M", "GWETROOT"];

const BASE = "https://power.larc.nasa.gov/api/temporal";
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function pedir(url, tentativas = 3) {
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    try {
      const resposta = await fetch(url, {
        headers: { "User-Agent": "TerraViva/1.0 (NASA Space Apps 2026, Angola)" },
        signal: AbortSignal.timeout(120000),
      });
      if (!resposta.ok) throw new Error("HTTP " + resposta.status);
      const dados = await resposta.json();
      if (dados?.messages?.length) {
        const erros = dados.messages.filter((m) => m.type === "ERROR");
        if (erros.length) throw new Error(JSON.stringify(erros[0]));
      }
      return dados;
    } catch (erro) {
      if (tentativa === tentativas) throw erro;
      const pausa = 2500 * tentativa;
      console.warn(`  falhou (${erro.message}); nova tentativa em ${pausa / 1000}s`);
      await espera(pausa);
    }
  }
}

export async function descarregarLocal(local, { forcar = false } = {}) {
  const destino = path.join(pastaBruto, local.id + ".json");
  if (!forcar && existsSync(destino)) {
    console.log("· " + local.id + ": já existe (usa --forcar para repetir)");
    return JSON.parse(readFileSync(destino, "utf8"));
  }

  const comum =
    `longitude=${local.lon}&latitude=${local.lat}` +
    `&start=${PERIODO.inicio}&end=${PERIODO.fim}` +
    `&community=AG&format=JSON`;

  const urlMensal =
    `${BASE}/monthly/point?parameters=${PARAMETROS_MENSAIS.join(",")}&` + comum;
  console.log("· " + local.id + ": mensal…");
  const mensal = await pedir(urlMensal);
  await espera(700);

  const urlDiario =
    `${BASE}/daily/point?parameters=${PARAMETROS_DIARIOS.join(",")}&` + comum;
  console.log("· " + local.id + ": diário…");
  const diario = await pedir(urlDiario);

  const pacote = {
    local: { id: local.id, nome: local.nome, provincia: local.provincia, lat: local.lat, lon: local.lon },
    pedido: { periodo: PERIODO, parametrosMensais: PARAMETROS_MENSAIS, parametrosDiarios: PARAMETROS_DIARIOS },
    descarregadoEm: new Date().toISOString(),
    mensal,
    diario,
  };

  writeFileSync(destino, JSON.stringify(pacote));
  console.log(
    "  guardado tools/.bruto/" + local.id + ".json (" + (JSON.stringify(pacote).length / 1024).toFixed(0) + " KB)"
  );
  await espera(900);
  return pacote;
}

// Corrido diretamente? (no Windows o caminho precisa de pathToFileURL)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const locais = JSON.parse(readFileSync(path.join(raiz, "dados/locais.json"), "utf8")).locais;
  const argumentos = process.argv.slice(2);
  const forcar = argumentos.includes("--forcar");
  const filtroArg = argumentos.find((a) => a.startsWith("--so="));
  const filtro = filtroArg ? filtroArg.replace("--so=", "").split(",") : null;

  const alvo = filtro ? locais.filter((l) => filtro.includes(l.id)) : locais;
  console.log("NASA POWER · " + PERIODO.inicio + "–" + PERIODO.fim + " · " + alvo.length + " local(is)");

  for (const local of alvo) {
    await descarregarLocal(local, { forcar });
  }
  console.log("Concluído.");
}
