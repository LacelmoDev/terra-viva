# Relatório de verificação dos dados

Gerado por `node tools/relatorio.mjs`. Serve para conferir os números antes de os mostrar.

- Fonte do clima: **NASA POWER** (Monthly and Annual API + Daily API), comunidade AG (Agroclimatology).
- Período: 2001–2024, oito zonas de Angola.
- Culturas: **FAO EcoCrop** (cópia CSV do OpenCLIM), consulta de 2026-11-14.
- Limiares usados (todos escolha nossa, escritos no código):
  - `chuvaMesChuvosoMm` = 40
  - `diaSecoMm` = 1
  - `diaCalorTmaxC` = 35
  - `soloSecoPercentil` = 0.25
  - `chuvaMesSuspeitoMmDia` = 60

---

## Clima por zona

| Zona | Prov. | Chuva anual (mm) | Época chuvosa | Dias secos seguidos (mediana / pior) | Dias ≥35 °C (média/ano) | Meses solo mais seco | Variação anual (CV) | Anos usados |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Benguela | Benguela | 323 | fev–abr (3 meses) | 18.5 / 43 (2004) | 0 | ago, set, out | 67.4 % | 24 |
| Huambo | Huambo | 1101 | out–abr (7 meses) | 17 / 29 (2014) | 0.2 | ago, set, out | 36.1 % | 23 |
| Kuito | Bié | 904 | out–abr (7 meses) | 13 / 22 (2016) | 0.4 | ago, set, out | 31.9 % | 23 |
| Lubango | Huíla | 695 | nov–abr (6 meses) | 21 / 52 (2018) | 15.3 | ago, set, out | 47.9 % | 23 |
| Malanje | Malanje | 797 | out–abr (7 meses) | 10 / 14 (2016) | 11 | jul, ago, set | 22.1 % | 24 |
| Ondjiva | Cunene | 477 | nov–mar (5 meses) | 18 / 35 (2022) | 106 | ago, set, out | 43.1 % | 24 |
| Uíge | Uíge | 1476 | set–mai (9 meses) | 12 / 31 (2003) | 1.3 | ago, set, out | 15.5 % | 24 |
| Waku Kungo | Cuanza Sul | 987 | out–abr (7 meses) | 12 / 24 (2004) | 1.8 | jul, ago, set | 54.8 % | 24 |

### Máximos e mínimos de chuva anual

| Zona | Ano mais seco | Ano mais chuvoso |
| --- | --- | --- |
| Benguela | 2003: 93 mm | 2020: 913 mm |
| Huambo | 2024: 568 mm | 2007: 2351 mm |
| Kuito | 2024: 512 mm | 2007: 1670 mm |
| Lubango | 2003: 306 mm | 2011: 1585 mm |
| Malanje | 2017: 481 mm | 2010: 1081 mm |
| Ondjiva | 2024: 164 mm | 2011: 1056 mm |
| Uíge | 2008: 1083 mm | 2020: 1866 mm |
| Waku Kungo | 2019: 447 mm | 2007: 2662 mm |

### Controlo de qualidade

| Zona | Mês suspeito | Valor | Consequência |
| --- | --- | --- | --- |
| Huambo | mar 2020 | 2546 mm no mês | ano excluído das médias |
| Kuito | mar 2020 | 2169 mm no mês | ano excluído das médias |
| Lubango | nov 2007 | 1841 mm no mês | ano excluído das médias |

Regra aplicada: Mês com média diária de chuva acima de 60 mm/dia (mais de ~1 800 mm no mês) é marcado como suspeito: é um artefacto conhecido de reanálise, não chuva. O valor fica visível na lista de suspeitos, mas esse mês sai das climatologias e o ano inteiro sai da série anual. Nada é inventado nem apagado em silêncio.

### Chuva média mensal (mm)

| Zona | jan | fev | mar | abr | mai | jun | jul | ago | set | out | nov | dez |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Benguela | 38 | 45 | 79 | 58 | 3 | 1 | 0 | 3 | 8 | 17 | 45 | 27 |
| Huambo | 181 | 156 | 191 | 80 | 7 | 0 | 0 | 4 | 22 | 77 | 222 | 175 |
| Kuito | 167 | 154 | 138 | 62 | 9 | 1 | 0 | 1 | 23 | 59 | 154 | 154 |
| Lubango | 123 | 132 | 207 | 54 | 5 | 0 | 0 | 0 | 5 | 32 | 70 | 108 |
| Malanje | 95 | 99 | 133 | 83 | 12 | 1 | 0 | 4 | 29 | 94 | 133 | 115 |
| Ondjiva | 106 | 100 | 119 | 29 | 3 | 0 | 0 | 0 | 2 | 11 | 48 | 60 |
| Uíge | 174 | 161 | 193 | 198 | 74 | 7 | 2 | 15 | 58 | 150 | 236 | 210 |
| Waku Kungo | 109 | 110 | 198 | 75 | 15 | 1 | 0 | 4 | 38 | 103 | 199 | 135 |

---

## Fichas das culturas

| Cultura | Família | Ciclo (dias) | Temp. ótima (°C) | Chuva anual (mm) | Fixa azoto | Uso | Confiança | Campos em falta |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Milho (`milho`) | Gramineae (Poaceae) | 65–365 | 18–33 | 600–1200 | não | TODO_FACTO | baixa | aguaNoCicloMm, profundidadeRaizCm, coberturaSolo, uso |
| Feijão (`feijao`) | Leguminosae (Fabaceae) | 50–270 | 16–25 | 500–2000 | sim | leguminosas de grão, forragem, hortícola, medicinal | media | aguaNoCicloMm, profundidadeRaizCm, coberturaSolo |
| Mandioca (`mandioca`) | Euphorbiaceae | 180–365 | 20–29 | 1000–1500 | não | raízes e tubérculos | media | aguaNoCicloMm, profundidadeRaizCm, coberturaSolo |
| Amendoim (`amendoim`) | Leguminosae (Fabaceae) | 90–150 | 22–32 | 600–1500 | sim | leguminosas de grão, hortícola, materiais, medicinal | media | aguaNoCicloMm, profundidadeRaizCm, coberturaSolo |
| Soja (`soja`) | Leguminosae (Fabaceae) | 75–180 | 20–33 | 600–1500 | sim | leguminosas de grão | media | aguaNoCicloMm, profundidadeRaizCm, coberturaSolo |
| Batata-doce (`batata-doce`) | Convolvulaceae | 80–170 | 18–28 | 750–2000 | não | TODO_FACTO | baixa | aguaNoCicloMm, profundidadeRaizCm, coberturaSolo, uso |
| Massango / sorgo (`massango`) | Gramineae (Poaceae) | 90–300 | 22–35 | 400–600 | não | cereais, forragem, medicinal | media | aguaNoCicloMm, profundidadeRaizCm, coberturaSolo |
| Abóbora (`abobora`) | Cucurbitaceae | 80–140 | 20–30 | 600–1000 | não | forragem, fruta, hortícola, materiais, medicinal | media | aguaNoCicloMm, profundidadeRaizCm, coberturaSolo |

Campos com `TODO_FACTO` em todas as culturas: necessidade de água por ciclo, profundidade de raiz e cobertura do solo. Precisam de fonte própria e da validação da equipa agrícola; até lá o site mostra «dado em falta».

---

## Conferência rápida com valores publicados

Comparação indicativa, feita à mão, com normais publicadas (fontes secundárias, não estações oficiais):

| Zona | Aqui (NASA POWER, 2001–2024) | Normal publicada | Leitura |
| --- | --- | --- | --- |
| Huambo | 1 101 mm/ano | 1 221 mm (1991–2020, monthlyclimate.com) · 1 365 mm (climatestotravel.com) | a reanálise fica 10–20 % abaixo |
| Malanje | 797 mm/ano | 1 008 mm (1991–2020, monthlyclimate.com) | a reanálise subestima; validar com estação local |

Isto não é erro de código: é a diferença entre um modelo de reanálise e uma estação. Fica escrito para não ser escondido.

## Limitações assumidas

- O satélite vê chuva, temperatura, humidade, radiação, vento e humidade do solo do modelo. Não vê fertilidade, textura nem o que se passa na machamba.
- O GWETROOT nunca desce perto de zero, por isso o indicador de solo seco é relativo ao próprio local (quartil mais seco), não um corte absoluto.
- Os dias secos e o stress térmico vêm do produto diário da POWER, agregados por nós.
- `mesesTerraNua` não tem valor fixo no ficheiro: depende da rotação e da época escolhidas e é calculado no browser pelo Relógio da Terra.
