// ============================================================================
// Terra Viva — clima.js
// Mostra o resumo do ano da terra para a zona escolhida, a partir de
// dados/clima/<id>.json (gerado por tools/calcular-indicadores.mjs).
//
// Todo o número leva a etiqueta CALCULADO POR NÓS e a regra fica a um toque.
// Nada é calculado no browser: aqui só se lê e se formata.
// ============================================================================

import { formatarNumero, nomeMes, regraDe, texto } from "./dados.js";

const RAIZ = new URL("../", import.meta.url);
const cache = new Map();

const numero = { format: (valor) => formatarNumero(valor) };
const numeroFino = { format: (valor) => formatarNumero(valor, { maximumFractionDigits: 1 }) };

// Valores pequenos (0,2 dias) ficam falsos se forem arredondados a zero.
const valorLegivel = (valor) =>
  valor === null || valor === undefined
    ? "—"
    : valor > 0 && valor < 10
      ? numeroFino.format(valor)
      : numero.format(valor);

function caminhoClima(id) {
  return new URL("dados/clima/" + id + ".json", RAIZ).href;
}

export async function obterClima(id) {
  if (cache.has(id)) return cache.get(id);
  const resposta = await fetch(caminhoClima(id));
  if (!resposta.ok) throw new Error("HTTP " + resposta.status);
  const dados = await resposta.json();
  cache.set(id, dados);
  return dados;
}

export function iniciarResumoClima() {
  const alvo = document.getElementById("clima-conteudo");
  if (!alvo) return { mostrar: () => {} };

  return {
    mostrar: (id) => {
      if (!id) return;
      desenhar(alvo, id);
    },
  };
}

async function desenhar(alvo, id) {
  if (!cache.has(id)) {
    alvo.textContent = texto("clima.carregando", "A ler os dados da NASA para esta zona…");
    alvo.classList.add("clima__vazio");
    try {
      await obterClima(id);
    } catch (erro) {
      alvo.textContent = texto("clima.erro", "Não foi possível carregar os dados desta zona.");
      console.error(erro);
      return;
    }
  }

  const dados = cache.get(id);
  const i = dados.indicadores;
  const epoca = i.epocaChuvosa;

  alvo.classList.remove("clima__vazio");
  alvo.textContent = "";

  const grade = document.createElement("div");
  grade.className = "clima__grade";

  const figuras = [
    {
      rotulo: texto("clima.chuva", "Chuva por ano"),
      valor: valorLegivel(i.chuvaAnual.media_mm),
      unidade: "mm",
      regra: regraDe(i.chuvaAnual),
    },
    {
      rotulo: texto("clima.epoca", "Época chuvosa"),
      valor: epoca?.inicioMes
        ? nomeMes(epoca.inicioMes) + "–" + nomeMes(epoca.fimMes)
        : "—",
      unidade: epoca?.duracaoMeses ? epoca.duracaoMeses + " " + texto("clima.meses", "meses") : "",
      regra: regraDe(epoca),
    },
    {
      rotulo: texto("clima.seca", "Maior seca seguida"),
      valor: i.diasSecosSeguidos ? valorLegivel(i.diasSecosSeguidos.medianaDias) : "—",
      unidade: texto("clima.dias", "dias"),
      regra: regraDe(i.diasSecosSeguidos),
      nota: i.diasSecosSeguidos
        ? texto("clima.piorAno", "pior ano: {ano}").replace("{ano}", i.diasSecosSeguidos.piorAno)
        : "",
    },
    {
      rotulo: texto("clima.calor", "Dias de calor") + " (≥ 35 °C)",
      valor: i.stressTermico ? valorLegivel(i.stressTermico.mediaDiasAno) : "—",
      unidade: texto("clima.dias", "dias") + "/ano",
      regra: regraDe(i.stressTermico),
    },
  ];

  figuras.forEach((figura) => {
    const item = document.createElement("div");
    item.className = "clima__item";

    const valor = document.createElement("p");
    valor.className = "clima__valor";
    valor.append(figura.valor);
    if (figura.unidade) {
      const unidade = document.createElement("small");
      unidade.textContent = figura.unidade;
      valor.append(unidade);
    }

    const rotulo = document.createElement("p");
    rotulo.className = "clima__rotulo";
    rotulo.textContent = figura.rotulo;

    item.append(valor, rotulo);
    if (figura.nota) {
      const nota = document.createElement("p");
      nota.className = "clima__nota-figura";
      nota.textContent = figura.nota;
      item.append(nota);
    }
    grade.append(item);
  });

  alvo.append(grade);

  // Regras e limites, a um toque.
  const detalhes = document.createElement("details");
  detalhes.className = "clima__regras";
  const resumo = document.createElement("summary");
  resumo.textContent = texto("clima.verRegras", "Ver regras e limites");
  detalhes.append(resumo);

  const lista = document.createElement("ul");
  lista.className = "clima__lista";
  figuras
    .filter((figura) => figura.regra)
    .forEach((figura) => {
      const li = document.createElement("li");
      const forte = document.createElement("strong");
      forte.textContent = figura.rotulo + ": ";
      li.append(forte, figura.regra);
      lista.append(li);
    });

  const limite = document.createElement("li");
  limite.textContent = texto("clima.limite", "Estes números vêm de um modelo da NASA para um ponto do mapa, não da tua machamba.");
  lista.append(limite);

  if (dados.qualidade?.mesesSuspeitos?.length) {
    const qualidade = document.createElement("li");
    qualidade.textContent = texto(
      "clima.qualidade",
      "Um mês desta série foi marcado como suspeito e ficou fora das médias."
    );
    lista.append(qualidade);
  }

  detalhes.append(lista);
  alvo.append(detalhes);

  const fonte = document.createElement("p");
  fonte.className = "clima__fonte";
  const etiqueta = document.createElement("span");
  etiqueta.className = "etiqueta etiqueta--calculado";
  etiqueta.textContent = texto("clima.origem", "Calculado por nós");
  fonte.append(etiqueta, " " + dados.local.nome + " · " + texto("clima.fonte", "NASA POWER · 2001–2024"));
  alvo.append(fonte);
}
