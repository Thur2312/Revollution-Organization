import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import type { TipoProcessoInpi } from "../../../supabase/types";

/**
 * Cliente do portal público de busca do INPI (pePI, busca.inpi.gov.br).
 * Não existe API oficial — este cliente reproduz o fluxo de consulta
 * anônima do próprio site: abrir uma sessão sem login, buscar por número
 * de processo, e então abrir a página de detalhe do resultado (mesma
 * sessão) pra pegar o histórico de despachos de verdade — a lista de
 * busca só mostra a situação atual, sem despacho/RPI. Só existe uma fonte
 * de dados aqui, então isso não é uma abstração de "provedor escolhível" —
 * é o cliente da única fonte que existe.
 *
 * Marca, patente e desenho industrial são sistemas legados separados
 * dentro do próprio pePI, com HTML visivelmente escrito em épocas/estilos
 * diferentes — não só rótulos diferentes, mas estrutura de tabela
 * diferente pros mesmos conceitos (ex.: "Situação" é um par
 * `<td>rótulo</td><td>valor</td>` em marca, mas é uma COLUNA de tabela em
 * desenho industrial; patente não tem "Situação" nenhuma, só despachos).
 * Os parsers abaixo tentam múltiplas formas de achar cada campo em vez de
 * assumir a forma validada contra marca também vale pros outros tipos.
 */

const BASE = "https://busca.inpi.gov.br/pePI";
const TIMEOUT_MS = 45_000;
const USER_AGENT = "Mozilla/5.0 (compatible; RevollutionBot/1.0)";

const JSP_POR_TIPO: Record<TipoProcessoInpi, string> = {
  marca: `${BASE}/jsp/marcas/Pesquisa_num_processo.jsp`,
  patente: `${BASE}/jsp/patentes/PatenteSearchBasico.jsp`,
  desenho_industrial: `${BASE}/jsp/desenhos/DesenhoSearchBasico.jsp`,
};

const SERVLET_POR_TIPO: Record<TipoProcessoInpi, string> = {
  marca: `${BASE}/servlet/MarcasServletController`,
  patente: `${BASE}/servlet/PatenteServletController`,
  desenho_industrial: `${BASE}/servlet/DesenhoServletController`,
};

export type ResultadoConsultaInpi =
  | { tipo: "nao_encontrado" }
  | {
      tipo: "encontrado";
      nome: string | null;
      situacao: string | null;
      titular: string | null;
      apresentacao: string | null;
      natureza: string | null;
      classe: string | null;
      despachoDescricao: string | null;
      despachoData: string | null;
      numeroRpi: string | null;
      dadosAtualizadosAte: string | null;
    }
  // A página não bateu com nenhum padrão conhecido. O chamador trata isso
  // como falha e não mexe no snapshot salvo, em vez de arriscar gravar um
  // "não encontrado" ou "sem mudança" errado.
  | { tipo: "nao_reconhecido" };

async function fetchComTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function setCookiesDaResposta(resposta: Response): string[] {
  const headers = resposta.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const unico = resposta.headers.get("set-cookie");
  return unico ? [unico] : [];
}

/** Combina um cookie header existente com novos Set-Cookie, sobrescrevendo por nome. */
function mesclarCookies(atual: string, novosSetCookie: string[]): string {
  const mapa = new Map<string, string>();
  for (const par of atual.split(";").map((s) => s.trim()).filter(Boolean)) {
    const [nome, valor] = par.split("=");
    if (nome) mapa.set(nome, valor ?? "");
  }
  for (const setCookie of novosSetCookie) {
    const par = setCookie.split(";")[0]?.trim();
    if (!par) continue;
    const [nome, valor] = par.split("=");
    if (nome) mapa.set(nome, valor ?? "");
  }
  return Array.from(mapa, ([nome, valor]) => `${nome}=${valor}`).join("; ");
}

/**
 * Abre uma sessão anônima de pesquisa no pePI: GET no jsp do tipo (define
 * JSESSIONID), depois GET em LoginController?action=login — é o mesmo
 * link "Para realizar a Pesquisa anonimamente aperte apenas o botão
 * Continuar...." da tela de login do site, sem precisar de usuário/senha.
 * O cookie devolvido pode ser reaproveitado em várias chamadas de
 * consultarProcesso (mesmo tipo ou tipos diferentes) dentro da mesma
 * execução, evitando repetir esse handshake por processo.
 */
export async function abrirSessaoInpi(tipo: TipoProcessoInpi = "marca"): Promise<string> {
  const respostaJsp = await fetchComTimeout(JSP_POR_TIPO[tipo], {
    headers: { "User-Agent": USER_AGENT },
  });
  const cookieInicial = mesclarCookies("", setCookiesDaResposta(respostaJsp));

  const respostaLogin = await fetchComTimeout(`${BASE}/servlet/LoginController?action=login`, {
    headers: { "User-Agent": USER_AGENT, Cookie: cookieInicial },
  });

  return mesclarCookies(cookieInicial, setCookiesDaResposta(respostaLogin));
}

function corpoDaConsulta(tipo: TipoProcessoInpi, numeroProcesso: string): string {
  const body = new URLSearchParams();
  body.set("NumPedido", numeroProcesso);
  body.set("botao", " pesquisar · ");
  if (tipo === "marca") {
    body.set("Action", "searchMarca");
    body.set("tipoPesquisa", "BY_NUM_PROC");
  } else {
    body.set("Action", "SearchBasico");
  }
  return body.toString();
}

async function buscarHtml(url: string, cookie: string, corpo?: string): Promise<string> {
  const resposta = await fetchComTimeout(url, {
    method: corpo ? "POST" : "GET",
    headers: {
      "User-Agent": USER_AGENT,
      Cookie: cookie,
      ...(corpo ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: corpo,
  });

  // O site responde em ISO-8859-1 — resposta.text() assumiria UTF-8 e
  // estragaria acentuação, o que quebraria os regexes de rótulo abaixo.
  const buffer = await resposta.arrayBuffer();
  return new TextDecoder("iso-8859-1").decode(buffer);
}

const PADRAO_NAO_ENCONTRADO = /nenhum resultado foi encontrado/i;

/** Converte "dd/mm/aaaa" (formato usado pelo INPI) pra "aaaa-mm-dd" (ISO), ordenável como string. */
function paraDataIso(valor: string | undefined): string | null {
  const match = valor?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

/** Normaliza texto de rótulo pra comparação — case-insensitive, sem espaços nas pontas. */
function normalizar(texto: string): string {
  return texto.trim().toLowerCase();
}

/**
 * Texto de uma célula, sem o conteúdo de tooltips escondidos que o INPI
 * embute como `<div>` dentro da própria célula (ex.: a explicação da
 * classe de Nice, ou o texto legal completo de um despacho, somem no
 * hover) — sem remover isso, `.text()` traria o tooltip inteiro junto com
 * o valor real da célula.
 */
function textoDoNo($: cheerio.CheerioAPI, elemento: Element | undefined): string {
  if (!elemento) return "";
  return $(elemento).clone().find("div").remove().end().text().replace(/\s+/g, " ").trim();
}

/**
 * Extrai o valor ao lado de um rótulo no formato `<td>Rótulo:</td><td>valor</td>`
 * — duas células irmãs, rótulo na primeira, comparado por igualdade exata
 * (ignorando maiúsculas/minúsculas). Caminha adiante por até 4 irmãs
 * seguintes procurando a primeira não-vazia: em patente/desenho industrial
 * o rótulo e o valor às vezes têm células `&nbsp;` espaçadoras entre eles
 * (ex.: "Nome do Depositante:", `&nbsp;`, valor), diferente do par direto
 * validado em marca.
 */
function extrairRotuloEmTd($: cheerio.CheerioAPI, rotulo: string): string | null {
  return buscarValorPorRotulo($, (texto) => normalizar(texto) === normalizar(rotulo));
}

/**
 * Mesma ideia de extrairRotuloEmTd, mas casando por SUBSTRING em vez de
 * igualdade exata — necessário pra rótulos que carregam o código INID
 * junto na mesma célula, tipo "(71) Nome do Depositante:" (patente) ou
 * "(71) Depositante:" (desenho industrial), onde a célula nunca é
 * exatamente igual a "Depositante".
 */
function extrairRotuloContendoEmTd($: cheerio.CheerioAPI, trecho: string): string | null {
  return buscarValorPorRotulo($, (texto) => normalizar(texto).includes(normalizar(trecho)));
}

function buscarValorPorRotulo($: cheerio.CheerioAPI, bateComRotulo: (texto: string) => boolean): string | null {
  let valor: string | null = null;
  $("td").each((_, celula) => {
    if (valor !== null) return;
    const texto = textoDoNo($, celula).replace(/:$/, "");
    if (!bateComRotulo(texto)) return;

    let proxima = $(celula).next("td");
    for (let tentativas = 0; tentativas < 4 && proxima.length; tentativas++) {
      const texto2 = textoDoNo($, proxima.get(0));
      if (texto2) {
        valor = texto2;
        return;
      }
      proxima = proxima.next("td");
    }
  });
  return valor;
}

/**
 * Células de uma linha (`<tr>`), só filhas diretas (não desce em tabelas
 * aninhadas dentro de uma célula — ex.: o popup de despacho de patente é
 * uma tabela dentro do `<td>` de Despacho) e expandindo `colspan` (um
 * `<th colspan="2">` vira duas entradas repetidas no array) — sem isso, a
 * contagem de colunas do cabeçalho (que usa colspan) diverge da contagem
 * de colunas das linhas de dados (que não usam), desalinhando todo o
 * mapeamento rótulo→valor por posição.
 */
function celulasExpandidas($: cheerio.CheerioAPI, tr: Element): string[] {
  const resultado: string[] = [];
  $(tr)
    .children("td, th")
    .each((_, celula) => {
      const colspan = parseInt($(celula).attr("colspan") || "1", 10) || 1;
      const texto = textoDoNo($, celula);
      for (let i = 0; i < colspan; i++) resultado.push(texto);
    });
  return resultado;
}

/**
 * Acha a tabela cuja linha de cabeçalho contém `rotuloCabecalho` e devolve
 * uma linha de dados dela como um mapa rótulo→valor (chaves normalizadas,
 * ler com `pegar`), pareado por posição de coluna. Usado tanto pra lista
 * de resultado da busca (achar "Situação", 1 linha só) quanto pra tabela
 * "Publicações"/despachos da página de detalhe (pode ter várias linhas).
 *
 * Se `chaveOrdenacaoData` for passada, ordena as linhas de dados por essa
 * coluna (formato dd/mm/aaaa) e devolve a de data mais recente — a tabela
 * de despachos de marca lista em ordem crescente (última linha = mais
 * recente), mas a de patente aparece em ordem decrescente; ordenar pela
 * data em vez de assumir uma convenção funciona pros dois casos. Sem essa
 * chave (tabelas de Titulares/Classe, sem coluna de data), mantém o
 * comportamento original de pegar a última linha.
 *
 * Cada candidata a tabela é escaneada com as linhas restritas a ela mesma
 * (via `closest("table").is(tabela)`), não ao documento inteiro — o HTML
 * do INPI tem tabelas de tooltip aninhadas dentro de células, e sem essa
 * checagem as linhas da tabela errada vazavam pro resultado.
 */
function extrairUltimaLinhaDaTabela(
  $: cheerio.CheerioAPI,
  rotuloCabecalho: string,
  chaveOrdenacaoData?: string
): Map<string, string> | null {
  let resultado: Map<string, string> | null = null;

  $("table").each((_, tabela) => {
    if (resultado) return;

    const linhas = $(tabela)
      .find("tr")
      .filter((_, tr) => $(tr).closest("table").is(tabela))
      .toArray();
    const textosPorLinha = linhas.map((tr) => celulasExpandidas($, tr));

    const indiceCabecalho = textosPorLinha.findIndex((textos) =>
      textos.some((t) => normalizar(t) === normalizar(rotuloCabecalho))
    );
    if (indiceCabecalho === -1) return;
    const cabecalho = textosPorLinha[indiceCabecalho];

    const linhasDeDados: string[][] = [];
    for (let i = indiceCabecalho + 1; i < textosPorLinha.length; i++) {
      const linha = textosPorLinha[i];
      if (linha.length < cabecalho.length) continue; // linha de estrutura diferente na mesma tabela
      if (linha.every((valor) => !valor)) break; // linha vazia = fim dos dados
      linhasDeDados.push(linha);
    }
    if (linhasDeDados.length === 0) return;

    let linhaEscolhida = linhasDeDados[linhasDeDados.length - 1];
    const indiceData = chaveOrdenacaoData
      ? cabecalho.findIndex((r) => normalizar(r) === normalizar(chaveOrdenacaoData))
      : -1;
    if (indiceData !== -1) {
      const comData = linhasDeDados
        .map((linha) => ({ linha, data: paraDataIso(linha[indiceData]) }))
        .filter((x): x is { linha: string[]; data: string } => x.data !== null);
      if (comData.length > 0) {
        linhaEscolhida = comData.reduce((maisRecente, atual) => (atual.data > maisRecente.data ? atual : maisRecente))
          .linha;
      }
    }

    const mapa = new Map<string, string>();
    cabecalho.forEach((rotulo, i) => {
      if (rotulo) mapa.set(normalizar(rotulo), linhaEscolhida[i] ?? "");
    });
    resultado = mapa;
  });

  return resultado;
}

/** Lê um valor de um mapa de extrairUltimaLinhaDaTabela tentando várias chaves candidatas em ordem. */
function pegar(mapa: Map<string, string> | null | undefined, ...chaves: string[]): string | null {
  if (!mapa) return null;
  for (const chave of chaves) {
    const valor = mapa.get(normalizar(chave));
    if (valor) return valor;
  }
  return null;
}

function extrairRodape($: cheerio.CheerioAPI): { numeroRpi: string | null; dadosAtualizadosAte: string | null } {
  const textoCompleto = $("body").text();
  const revistaMatch = textoCompleto.match(/N[ºo°]\s*da Revista:\s*(\S+)/i);
  const atualizadoMatch = textoCompleto.match(/Dados atualizados\s+at[ée]\s*(\d{2}\/\d{2}\/\d{4})/i);
  return {
    numeroRpi: revistaMatch?.[1]?.trim() || null,
    dadosAtualizadosAte: paraDataIso(atualizadoMatch?.[1]),
  };
}

/**
 * Parser da página de DETALHE (após seguir o link "Action=detail" do
 * resultado da busca).
 *
 * Situação: marca tem um par rótulo/valor direto no bloco de topo;
 * desenho industrial expõe como coluna de uma tabelinha (Pedido/Registro
 * | Número | Data do depósito | Situação); patente não tem Situação
 * nenhuma — usa a descrição do despacho mais recente como proxy, já que é
 * a informação de status mais próxima que a página oferece.
 *
 * Titular: marca tem uma tabela "Titulares" com coluna "Nome"; patente e
 * desenho chamam de "Depositante" e o rótulo carrega o código INID junto
 * na mesma célula (ex.: "(71) Nome do Depositante:"), por isso o
 * casamento por substring em vez de igualdade exata.
 *
 * Despacho/RPI: a tabela "Publicações" existe nos três tipos com uma
 * coluna "RPI" em comum (usada pra achar a tabela certa), mas o resto das
 * colunas varia — "Data RPI" (marca/patente) vs "Data da RPI" (desenho);
 * em marca a coluna "Despacho" já é o texto descritivo, mas em
 * patente/desenho ela é só um código numérico e o texto de verdade fica
 * em "Complemento do Despacho"/"Complemento do despacho".
 */
function parsePaginaDetalhe($: cheerio.CheerioAPI): ResultadoConsultaInpi | null {
  const situacaoSimples = extrairRotuloEmTd($, "Situação") ?? extrairRotuloEmTd($, "Situacao");
  const situacaoTabela = situacaoSimples
    ? null
    : pegar(extrairUltimaLinhaDaTabela($, "Situação") ?? extrairUltimaLinhaDaTabela($, "Situacao"), "Situação", "Situacao");

  const linhaDespacho =
    extrairUltimaLinhaDaTabela($, "RPI", "Data RPI") ?? extrairUltimaLinhaDaTabela($, "RPI", "Data da RPI");
  const despachoDescricao = pegar(
    linhaDespacho,
    "Complemento do Despacho",
    "Complemento do despacho",
    "Descrição do Despacho",
    "Despacho"
  );
  const despachoData = paraDataIso(pegar(linhaDespacho, "Data RPI", "Data da RPI") ?? undefined);

  const situacao = situacaoSimples ?? situacaoTabela ?? despachoDescricao;
  if (!situacao) return null;

  const nome = extrairRotuloEmTd($, "Marca") ?? extrairRotuloEmTd($, "Título") ?? extrairRotuloEmTd($, "Titulo");
  const apresentacao = extrairRotuloEmTd($, "Apresentação") ?? extrairRotuloEmTd($, "Apresentacao");
  const natureza = extrairRotuloEmTd($, "Natureza");

  // "Depositante" primeiro: em patente/desenho industrial o documento tem
  // MAIS DE UMA tabela com cabeçalho "Nome" (Autor, Titular...) — pegar a
  // "última" tabela de Nome pegaria a errada (Autor, não o titular de
  // fato). Rótulo específico de Depositante evita essa ambiguidade; só
  // cai pro fallback genérico de "Nome" (tabela "Titulares") em marca,
  // que não tem conceito de Autor separado do titular.
  const titular =
    extrairRotuloContendoEmTd($, "Nome do Depositante") ??
    extrairRotuloContendoEmTd($, "Depositante") ??
    pegar(extrairUltimaLinhaDaTabela($, "Nome"), "Nome");

  const linhaClasse = extrairUltimaLinhaDaTabela($, "Classe de Nice");
  const classe = pegar(linhaClasse, "Classe de Nice");

  const { numeroRpi, dadosAtualizadosAte } = extrairRodape($);

  return {
    tipo: "encontrado",
    nome,
    situacao,
    titular,
    apresentacao,
    natureza,
    classe,
    despachoDescricao,
    despachoData,
    numeroRpi: pegar(linhaDespacho, "RPI") || numeroRpi,
    dadosAtualizadosAte,
  };
}

/**
 * Parser da página de LISTA de resultado da busca (fallback, usado
 * quando não achamos um link de detalhe pra seguir). Só tem a situação
 * atual, sem histórico de despacho.
 */
function parsePaginaLista($: cheerio.CheerioAPI): ResultadoConsultaInpi | null {
  const linha = extrairUltimaLinhaDaTabela($, "Situação") ?? extrairUltimaLinhaDaTabela($, "Situacao");
  const situacao = pegar(linha, "Situação", "Situacao");
  if (!situacao) return null;

  const { numeroRpi, dadosAtualizadosAte } = extrairRodape($);

  return {
    tipo: "encontrado",
    nome: pegar(linha, "Marca", "Título"),
    situacao,
    titular: pegar(linha, "Titular"),
    apresentacao: null,
    natureza: null,
    classe: pegar(linha, "Classe"),
    despachoDescricao: situacao,
    despachoData: null,
    numeroRpi,
    dadosAtualizadosAte,
  };
}

export async function consultarProcesso({
  cookie,
  numeroProcesso,
  tipo,
}: {
  cookie: string;
  numeroProcesso: string;
  tipo: TipoProcessoInpi;
}): Promise<ResultadoConsultaInpi> {
  const htmlLista = await buscarHtml(SERVLET_POR_TIPO[tipo], cookie, corpoDaConsulta(tipo, numeroProcesso));

  if (PADRAO_NAO_ENCONTRADO.test(htmlLista)) {
    return { tipo: "nao_encontrado" };
  }

  const $lista = cheerio.load(htmlLista);
  const linkDetalhe = $lista("a[href*='Action=detail']").attr("href");

  const $detalhe = linkDetalhe
    ? cheerio.load(await buscarHtml(new URL(linkDetalhe, SERVLET_POR_TIPO[tipo]).toString(), cookie))
    : null;

  const resultado = ($detalhe && parsePaginaDetalhe($detalhe)) ?? parsePaginaLista($lista);
  return resultado ?? { tipo: "nao_reconhecido" };
}
