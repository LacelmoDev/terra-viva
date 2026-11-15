// ============================================================================
// Terra Viva — tools/descarregar-culturas.mjs
// Constrói dados/culturas.json a partir da base EcoCrop da FAO.
//
// Uso:  node tools/descarregar-culturas.mjs
//
// Fonte: EcoCrop (FAO), cópia em CSV usada pelo modelo de aptidão OpenCLIM,
// publicada em https://github.com/OpenCLIM/ecocrop (EcoCrop_DB.csv).
// A folha oficial da FAO por espécie está em
// https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=<EcoPortCode>
//
// Regra: só entra valor que exista na base. Onde a base não responde ao que
// precisamos, o campo fica TODO_FACTO com TODO_FONTE e um bilhete para a
// equipa agrícola. Nada é preenchido a partir de conhecimento geral, exceto
// a família botânica, que vem na própria base.
// ============================================================================

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL_ECOCROP =
  "https://raw.githubusercontent.com/OpenCLIM/ecocrop/main/EcoCrop_DB.csv";
const URL_FOLHA = "https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=";

// As oito culturas do desafio, com o nome científico usado na base.
const CULTURAS = [
  { id: "milho", nome: "Milho", cientifico: "Zea mays", alias: ["milho", "maize"] },
  { id: "feijao", nome: "Feijão", cientifico: "Phaseolus vulgaris", alias: ["feijão", "feijao"] },
  { id: "mandioca", nome: "Mandioca", cientifico: "Manihot esculenta", alias: ["mandioca", "cassava"] },
  { id: "amendoim", nome: "Amendoim", cientifico: "Arachis hypogaea", alias: ["amendoim"] },
  { id: "soja", nome: "Soja", cientifico: "Glycine max", alias: ["soja"] },
  { id: "batata-doce", nome: "Batata-doce", cientifico: "Ipomoea batatas", alias: ["batata-doce"] },
  { id: "massango", nome: "Massango / sorgo", cientifico: "Sorghum bicolor", alias: ["massango", "sorgo", "sorghum"] },
  { id: "abobora", nome: "Abóbora", cientifico: "Cucurbita maxima", alias: ["abóbora", "abobora", "pumpkin"] },
];

// ---------- Parser CSV mínimo (RFC 4180) ----------
function lerCSV(texto) {
  const linhas = [];
  let campo = "";
  let linha = [];
  let dentro = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (dentro) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else dentro = false;
      } else campo += c;
      continue;
    }
    if (c === '"') dentro = true;
    else if (c === ",") {
      linha.push(campo);
      campo = "";
    } else if (c === "\n") {
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else if (c !== "\r") campo += c;
  }
  if (campo || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }

  const cabecalho = linhas.shift();
  return linhas
    .filter((l) => l.length === cabecalho.length)
    .map((l) => Object.fromEntries(cabecalho.map((chave, i) => [chave, l[i]])));
}

const numero = (valor) => {
  const n = Number(String(valor).replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
};

const familia = (famname) => {
  if (!famname) return null;
  const partes = famname.split(":");
  const ultima = partes[partes.length - 1];
  if (!ultima) return null;
  // EcoCrop usa nomes antigos; acrescentamos o equivalente atual quando difere.
  const atual = {
    Gramineae: "Poaceae",
    Leguminosae: "Fabaceae",
    Compositae: "Asteraceae",
    Umbelliferae: "Apiaceae",
    Cruciferae: "Brassicaceae",
  }[ultima];
  return atual ? `${ultima} (${atual})` : ultima;
};

function traduzirUso(cat) {
  if (!cat || !cat.trim()) return null;
  const mapa = {
    "pulses (grain legumes)": "leguminosas de grão",
    "cereals & pseudocereals": "cereais",
    "roots/tubers": "raízes e tubérculos",
    vegetables: "hortícola",
    "fruits & nuts": "fruta",
    "forage/pasture": "forragem",
    "medicinals & aromatic": "medicinal",
    materials: "materiais",
    "food": "alimento",
  };
  return cat
    .split(",")
    .map((parte) => mapa[parte.trim()] ?? parte.trim())
    .filter(Boolean);
}

async function descarregar() {
  console.log("EcoCrop · a descarregar a base…");
  const resposta = await fetch(URL_ECOCROP, {
    headers: { "User-Agent": "TerraViva/1.0 (NASA Space Apps 2026)" },
    signal: AbortSignal.timeout(120000),
  });
  if (!resposta.ok) throw new Error("HTTP " + resposta.status + " no EcoCrop");
  const buffer = Buffer.from(await resposta.arrayBuffer());
  // A base mistura UTF-8 com Latin-1: decodificar em Latin-1 nunca rebenta.
  return { texto: buffer.toString("latin1"), bytes: buffer.length };
}

const { texto, bytes } = await descarregar();
const registos = lerCSV(texto);
console.log("  " + (bytes / 1024).toFixed(0) + " KB · " + registos.length + " espécies");

const culturas = CULTURAS.map((alvo) => {
  const registo = registos.find((r) => r.ScientificName === alvo.cientifico);
  if (!registo) {
    throw new Error("Espécie não encontrada na base: " + alvo.cientifico);
  }

  const folha = URL_FOLHA + registo.EcoPortCode;
  const fonte = { id: "ecocrop", folha };
  const cicloMin = numero(registo.GMIN);
  const cicloMax = numero(registo.GMAX);
  const usa = traduzirUso(registo.CAT);

  return {
    id: alvo.id,
    nome: alvo.nome,
    alias: alvo.alias,
    nomeCientifico: registo.ScientificName,
    familia: {
      valor: familia(registo.FAMNAME),
      fonte,
    },
    cicloDias: {
      min: cicloMin,
      max: cicloMax,
      fonte,
      nota:
        "Faixa de ciclo da base EcoCrop, que cobre variedades muito diferentes. Confirmar com a variedade da zona.",
    },
    temperaturaC: {
      otima: [numero(registo.TOPMN), numero(registo.TOPMX)],
      absoluta: [numero(registo.TMIN), numero(registo.TMAX)],
      fonte,
    },
    chuvaAnualMm: {
      otima: [numero(registo.ROPMN), numero(registo.ROPMX)],
      absoluta: [numero(registo.RMIN), numero(registo.RMAX)],
      fonte,
      nota: "Chuva anual, não água necessária no ciclo.",
    },
    aguaNoCicloMm: {
      valor: null,
      fonte: "TODO_FONTE",
      nota:
        "TODO_FACTO: falta necessidade hídrica por ciclo com fonte aplicável a Angola. Validar com a equipa agrícola.",
    },
    fixaAzoto: {
      valor: /Leguminosae|Fabaceae/.test(registo.FAMNAME || ""),
      fonte,
      nota: "Determinado pela família botânica na base EcoCrop (leguminosas nodulam).",
    },
    profundidadeRaizCm: {
      valor: null,
      fonte: "TODO_FONTE",
      nota:
        "TODO_FACTO: a EcoCrop indica profundidade de solo exigida, não profundidade de raiz. Requer fonte própria.",
    },
    coberturaSolo: {
      valor: null,
      fonte: "TODO_FONTE",
      nota: "TODO_FACTO: falta descrição de cobertura do solo e risco de erosão por cultura.",
    },
    uso: {
      valor: usa,
      fonte: usa ? fonte : "TODO_FONTE",
      nota: usa ? undefined : "TODO_FACTO: a EcoCrop não traz categorias de uso para esta espécie.",
    },
    confianca: null, // calculada abaixo
  };
});

// Confiança = proporção de campos obrigatórios que têm mesmo valor.
const CAMPOS_OBRIGATORIOS = [
  { nome: "familia", ler: (c) => c.familia.valor },
  { nome: "cicloDias", ler: (c) => [c.cicloDias.min, c.cicloDias.max] },
  { nome: "temperaturaC", ler: (c) => c.temperaturaC.otima },
  { nome: "chuvaAnualMm", ler: (c) => c.chuvaAnualMm.otima },
  { nome: "aguaNoCicloMm", ler: (c) => c.aguaNoCicloMm.valor },
  { nome: "profundidadeRaizCm", ler: (c) => c.profundidadeRaizCm.valor },
  { nome: "coberturaSolo", ler: (c) => c.coberturaSolo.valor },
  { nome: "uso", ler: (c) => c.uso.valor },
];

function preenchido(valor) {
  if (valor === null || valor === undefined) return false;
  if (Array.isArray(valor)) return valor.length > 0 && valor.every((v) => v !== null && v !== undefined);
  return true;
}

culturas.forEach((cultura) => {
  const emFalta = CAMPOS_OBRIGATORIOS.filter((campo) => !preenchido(campo.ler(cultura))).map(
    (campo) => campo.nome
  );
  const preenchidos = CAMPOS_OBRIGATORIOS.length - emFalta.length;
  const proporcao = preenchidos / CAMPOS_OBRIGATORIOS.length;
  cultura.camposEmFalta = emFalta;
  cultura.confianca = proporcao >= 0.85 ? "alta" : proporcao >= 0.55 ? "media" : "baixa";
});

const saida = {
  versao: "1",
  atualizadoEm: new Date().toISOString().slice(0, 10),
  instrucoes:
    "Folha para editar à mão. Cada campo traz 'fonte' (id de fonte ou TODO_FONTE) e, quando preciso, 'nota'. Para preencher um TODO_FACTO: pôr o valor, trocar a fonte por uma entrada de referencias.json e apagar a nota. Não apagar campos: o site lê-os pelo nome.",
  fonte: {
    nome: "FAO EcoCrop",
    descricao:
      "Base de requisitos ecológicos das culturas. Inclui família, ciclo, temperatura, chuva anual, pH, altitude e uso.",
    url: "https://ecocrop.apps.fao.org/ecocrop/srv/en/home",
    folha: URL_FOLHA + "<EcoPortCode>",
    copiaCsv: URL_ECOCROP,
    licenca: "FAO, uso com atribuição (cópia OpenCLIM, CC-BY-4.0)",
    consulta: new Date().toISOString().slice(0, 10),
  },
  referencias: {
    ecocrop: {
      nome: "FAO EcoCrop",
      url: "https://ecocrop.apps.fao.org/ecocrop/srv/en/home",
    },
  },
  culturas,
};

mkdirSync(path.join(raiz, "dados"), { recursive: true });
writeFileSync(path.join(raiz, "dados/culturas.json"), JSON.stringify(saida, null, 2));

console.log("\nCulturas:");
console.table(
  culturas.map((c) => ({
    id: c.id,
    nome: c.nome,
    familia: c.familia.valor,
    ciclo: c.cicloDias.min + "–" + c.cicloDias.max,
    temp: c.temperaturaC.otima.join("–"),
    chuva: c.chuvaAnualMm.otima.join("–"),
    azoto: c.fixaAzoto.valor ? "sim" : "não",
    uso: c.uso.valor ? c.uso.valor.join(", ") : "TODO_FACTO",
    confianca: c.confianca,
  }))
);
