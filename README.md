# Terra Viva

**O calendário vivo da tua terra.** Ferramenta de apoio à decisão para rotação de culturas em
Angola, construída para o **NASA Space Apps Challenge 2026** — evento local de Calumbo, Zango.

A ferramenta ajuda a pensar; não substitui o agricultor nem o técnico agrícola.

---

## Estado atual

| Marco | Conteúdo | Estado |
| --- | --- | --- |
| 1 | Esqueleto, identidade, hero, mapa de Angola, navegação dos 4 passos, PWA base | concluído |
| 2 | Scripts de dados, clima dos 8 locais, indicadores, fichas de culturas | concluído |
| 3 | Motor de regras e três cartões de rotação | concluído |
| 4 | Relógio da Terra e cenários | concluído |
| 5 | Polimento, offline testado, acessibilidade, 360 px | concluído |
| 6 | Versão em inglês e seletor de idioma | concluído |

### O que já funciona

- Página inicial com hero animado, motivo do Relógio, faixa das três etiquetas de origem e rodapé.
- Mapa de Angola (Natural Earth) com as oito zonas; escolha por mapa ou lista, com teclado.
- Clima real da NASA POWER para os oito locais, 2001–2024: chuva mensal, temperatura, humidade do solo e radiação.
- Indicadores derivados com regra escrita e etiqueta: chuva anual, época chuvosa, maior seca seguida, dias de calor, meses de solo mais seco, variação entre anos.
- Resumo do ano da terra na página, para a zona escolhida, com as regras a um toque.
- Fichas das oito culturas a partir da FAO EcoCrop, com `TODO_FACTO` onde a base não responde.
- Escolha das culturas da última época e da anterior, com oito símbolos desenhados à mão.
- Prioridades (água, rendimento, solo, risco) e restrições (irrigação, mão de obra).
- Motor de regras determinístico: três rotações pontuadas — a atual e duas alternativas — cada uma
  com porquê, evidência etiquetada, benefícios, lacunas e riscos a validar.
- Relógio da Terra: doze meses em três anéis (chuva, humidade do solo, temperatura), o arco da
  cultura no anel interior e os meses de terra nua a pulsar.
- Cenários de chuva (normal, atraso de três semanas, menos 20 %, mais 20 %) que redesenham o relógio
  e voltam a pontuar as três rotações. A mesma informação existe em tabela.
- Escolha de textura do solo pelo agricultor (declarada como informação do agricultor, não do satélite).
- Navegação dos quatro passos com `#passo-1` … `#passo-4`, botões anterior/seguinte e trilho.
- Modo campo (tema escuro) guardado no aparelho.
- Manifest + service worker: shell em cache-first, JSON em stale-while-revalidate, página
  `offline.html`, aviso offline com data da última atualização.
- Texto de toda a interface em `textos/pt.json` e `textos/en.json`; o HTML mantém texto em português para arrancar sem JS.
- Seletor PT/EN no cabeçalho das quatro páginas, guardado no aparelho. Muda também os nomes das
  culturas, os meses, os formatos de número e as regras dos indicadores.

### O que ainda não existe (é intencional)

- Previsão meteorológica, contas, backend e diagnóstico por foto: fora do âmbito da versão principal.

Os passos 2, 3 e 4 mostram um painel que diz exatamente isto, em vez de fingir conteúdo.

---

## Como correr

O site é estático, sem passo de build e sem dependências de CDN.

```bash
# qualquer servidor estático serve
python -m http.server 8123 --bind 127.0.0.1
# abrir http://127.0.0.1:8123/
```

Abrir `index.html` diretamente por `file://` mostra o site, mas **o service worker e os `fetch` de
JSON falham**. Para testar offline é obrigatório servir por HTTP (ou publicar).

### Ferramentas de dados

```bash
node tools/descarregar-clima.mjs     # NASA POWER: mensal + diário, 2001–2024, oito locais
node tools/calcular-indicadores.mjs  # aplica as regras e escreve dados/clima/*.json
node tools/descarregar-culturas.mjs  # FAO EcoCrop → dados/culturas.json
node tools/relatorio.mjs             # tabela de verificação → tools/RELATORIO-DADOS.md
node tools/build-map.mjs             # dados/angola.json a partir de tools/data/AGO.geo.json
node tools/make-icons.mjs            # ícones PNG do PWA (sem dependências)
```

Nenhum script precisa de chave de API. As respostas em bruto ficam em `tools/.bruto/` (fora do
repositório, ver `.gitignore`) para auditoria; apagar essa pasta só obriga a descarregar outra vez.
As regras dos indicadores vivem em `tools/regras.mjs` e o site mostra o mesmo texto.

---

## Estrutura

```
index.html            página inicial e fluxo dos 4 passos
sobre.html            metodologia, limites, uso de IA, privacidade
fontes.html           todas as fontes, licenças e créditos
offline.html          recurso quando não há rede nem cópia em cache
manifest.webmanifest  PWA: nome, ícones, cores
service-worker.js     cache do shell e dos dados, versão de cache
css/tokens.css        cores, tipos, espaços, movimentos
css/base.css          tipografia auto-alojada, reset, fundo de papel
css/componentes.css   cabeçalho, botões, etiquetas, mapa, passos, rodapé
css/relogio.css       motivo do Relógio desenhado no hero
js/app.js             arranque: tema, motivo, chuva do hero, revelações
js/dados.js           fetch de JSON, i18n, carimbo de atualização
js/mapa.js            contorno + pontos das zonas
js/clima.js           resumo do clima da zona, com regras e etiquetas
js/passos.js          trilho dos passos, zona e solo
js/pwa.js             registo do service worker e aviso offline
js/relogio.js         Relógio da Terra: anéis do clima, calendário da cultura e cenários
js/motor.js           motor de regras: pontua, gera e escolhe as três rotações
js/resultado.js       três cartões com porquê, evidência, benefícios, lacunas e riscos
dados/locais.json     oito zonas com coordenadas verificadas
dados/angola.json     contorno SVG + projeção (gerado)
dados/culturas.json   fichas das oito culturas (EcoCrop + TODO_FACTO)
dados/clima/          um ficheiro por local: climatologia, série anual,
                      indicadores, qualidade e regras
textos/pt.json        todos os textos visíveis (português)
textos/en.json        o mesmo dicionário em inglês (255 chaves, verificadas uma a uma)
tools/regras.mjs      limiares e textos das regras dos indicadores
tools/descarregar-clima.mjs     NASA POWER mensal + diário, 2001–2024
tools/calcular-indicadores.mjs  bruto → dados/clima, com controlo de qualidade
tools/descarregar-culturas.mjs  EcoCrop → dados/culturas.json
tools/relatorio.mjs    tabela de verificação em tools/RELATORIO-DADOS.md
tools/build-map.mjs    contorno de Angola → dados/angola.json
tools/make-icons.mjs   ícones PNG do PWA
tools/RELATORIO-DADOS.md  números, limiares e conferência, para revisão
tools/data/           dados geográficos de origem
icons/                selo SVG e ícones PNG do PWA
fontes/               WOFF2 auto-alojados (OFL 1.1)
REQUISITOS-EXTRA.md   requisitos adicionais da organização
```

---

## Como o motor pontua

`js/motor.js` é determinístico e não usa IA. Para cada cultura calcula cinco critérios com dados
nossos: **água** (chuva da zona contra a faixa da EcoCrop e ciclo contra a época chuvosa), **calor**
(temperatura da época e dias ≥ 35 °C), **azoto** (família leguminosa), **pragas** (família diferente
da anterior) e **risco** (composto de água, calor e variação entre anos).

Ficam de fora, por falta de dado, **cobertura do solo**, **matéria orgânica** e **rendimento**; a
página diz isso em cada cartão e nenhum valor é estimado no lugar deles. As prioridades do agricultor
dão peso a cada critério (0,5 / 1 / 1,5); com irrigação a água pesa menos, sem irrigação pesa mais.

As alternativas são escolhidas entre todas as sequências de três épocas sem repetir a mesma cultura
em anos seguidos: a melhor pontuação e a melhor com famílias diferentes da atual e da primeira.
A rotação atual é a sequência do agricultor repetida, para servir de base à comparação.

Teste rápido do motor, sem browser:

```bash
node --input-type=module -e "import('./js/motor.js').then(m=>console.log(m.escolherRotacoes))"
```

## Duas línguas

O seletor PT/EN fica no cabeçalho e guarda a escolha em `tv:lingua`. Mudar de língua recarrega a
página — os textos vivem em JSON e os componentes são desenhados no arranque — mas o estado dos
quatro passos fica em `sessionStorage` (`tv:estado`) e é reposto, incluindo zona, culturas, solo,
prioridades e restrições.

O inglês não é só a interface: `dados/culturas.json` tem `nomeEN` por cultura e cada indicador de
`dados/clima/*.json` tem `regraEN`, escritos no mesmo sítio que as regras (`tools/regras.mjs`) e
regenerados pelo pipeline. Números e datas usam `en-GB` (1,101 mm) e os meses vêm do `Intl`.

Verificação de cobertura: as chaves dos dois dicionários são comparadas por script (255 = 255, sem
faltas nem sobras).

## O Relógio da Terra e os cenários

O relógio desenha um ano em três anéis a partir da climatologia mensal da NASA POWER: chuva em
milímetros (escala absoluta), humidade do solo (`GWETROOT`, 0 a 1) e temperatura média. Cada mês é
um setor; a altura é proporcional ao valor, com solo e temperatura medidos contra o mínimo e o máximo
da própria zona.

No anel interior, a cultura da época escolhida começa no mês de início da época chuvosa e ocupa o
meio da faixa de ciclo da EcoCrop (o arco esbatido vai até ao ciclo máximo). Os meses que sobram são
desenhados como **terra nua**, a pulsar.

Os cenários mudam **só a chuva** (é o único dado com que podemos mexer sem inventar): o atraso de três
semanas desloca a série 0,75 mês e recalcula o início da época pela mesma regra dos 40 mm; os 20 %
mudam a série toda. Com isso, o motor volta a pontuar as rotações. A humidade do solo e a temperatura
ficam como foram medidas, e a página diz isso.

## Política de dados

Três etiquetas, nunca misturadas:

- **DADO NASA** — o que a NASA POWER devolve para o ponto escolhido.
- **CALCULADO POR NÓS** — indicadores derivados, com a regra escrita no ecrã e no código.
- **CONHECIMENTO AGRONÓMICO** — ciclos e necessidades das culturas, com a fonte citada.

Regras do projeto:

1. Nunca se inventa um número, data, coordenada, necessidade de água ou rendimento.
2. Onde falta dado verificado escreve-se `TODO_FACTO`; onde falta a fonte escreve-se `TODO_FONTE`.
3. O satélite vê chuva, temperatura, humidade, vegetação e relevo — **não vê a fertilidade do solo**.
4. Os recursos do desafio para os EUA (WSS, CDL, PRISM, SSURGO, NAIP) não cobrem Angola e não são
   usados. Esta decisão está registada em `sobre.html`.
5. Solo por local: enquanto não houver fonte fiável, a textura é escolhida pelo agricultor e o ecrã
   diz isso mesmo.
6. Unidades: a API mensal da POWER dá precipitação em **mm/dia**; o pipeline converte para mm/mês
   antes de qualquer conta. A radiação vem em MJ/m²/dia.
7. Qualidade: um mês com média acima de 60 mm/dia (mais de ~1 800 mm no mês) é marcado como suspeito,
   fica listado em `dados/clima/<id>.json` e sai das médias. Nada é apagado em silêncio.
8. Os valores da reanálise ficam 10–20 % abaixo das normais publicadas em algumas zonas (Malanje,
   Huambo). Isso está escrito em `tools/RELATORIO-DADOS.md` e na página Sobre.

---

## Verificado no Marco 5

- **Offline real:** com o servidor desligado (não só com o Wi-Fi em baixo), a página abriu do
  service worker, as oito zonas e as nove opções de cultura apareceram, e o percurso até ao passo 4
  desenhou o Relógio e os três cartões (Huambo: 55 / 89 / 89, 1 101 mm, 5 meses de terra nua).
  Consola vazia. O teste apanhou `js/relogio.js` fora da lista de pré-carga — offline o site
  rebentava; está corrigido e a lista tem agora 41 ficheiros.
- **Acessibilidade:** sem ids repetidos, sem botões nem ligações sem nome acessível, sem imagens sem
  `alt`; ligação «Saltar para o conteúdo» nas páginas; hierarquia de títulos H1→H2→H3→H4; grupos do
  Relógio com `role="group"` e rótulo associado; resumo do Relógio em `aria-live="polite"`.
  `--tinta-fraca` foi escurecido de `#857465` para `#736456` (contraste 4,2 → 5,3 sobre a superfície)
  e os botões do Relógio passaram de 40 para 44 px de altura.
- **360 px:** sem scroll horizontal (343 px de viewport, 343 px de conteúdo) em todos os passos.
- **Dados regenerados:** `tools/calcular-indicadores.mjs` voltou a correr sobre as respostas em
  bruto; os oito locais mantêm exatamente os mesmos números.

## Publicação

Preparado para GitHub Pages em subpasta: todos os caminhos são relativos e o `start_url` do manifest
é `./index.html`. Basta publicar a raiz do repositório. O service worker só funciona em HTTPS
(ou em `localhost`). O ficheiro `.nojekyll` está incluído para o Pages servir os ficheiros tal como
estão, sem passar pelo Jekyll.

Antes de publicar:

1. Confirmar que `tools/.bruto/` não vai no envio (está no `.gitignore`).
2. Abrir o site publicado uma vez com rede e outra sem, para o service worker instalar a versão certa.
3. Se mudar qualquer ficheiro do shell, subir `VERSAO` em `service-worker.js` — senão os aparelhos
   continuam com a cópia antiga.

---

## Licença

Código sob **Apache License 2.0** — ver `LICENSE`.
Dados e tipografia mantêm as licenças das respetivas fontes, listadas em `fontes.html`.
