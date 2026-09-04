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
  // A página não bateu com nenhum padrão conhecido (marcação do INPI
  // mudou, ou patente/desenho usam uma marcação diferente de marca, ainda
  // não confirmada). O chamador trata isso como falha e não mexe no
  // snapshot salvo, em vez de arriscar gravar um "não encontrado" ou
  // "sem mudança" errado.
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
  body.set("botao", " pesquisar ");
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

/** Converte "dd/mm/aaaa" (formato usado pelo INPI) pra "aaaa-mm-dd" (ISO). */
function paraDataIso(valor: string | undefined): string | null {
  const match = valor?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

/**
 * Texto de uma célula, sem o conteúdo de tooltips escondidos que o INPI
 * embute como `<div>` dentro da própria célula (ex.: a explicação da
 * classe de Nice some no hover) — sem remover isso, `.text()` traz o
 * tooltip inteiro junto com o valor real da célula.
 */
function textoDoNo($: cheerio.CheerioAPI, elemento: Element | undefined): string {
  if (!elemento) return "";
  return $(elemento).clone().find("div").remove().end().text().replace(/\s+/g, " ").trim();
}

/**
 * Extrai o valor ao lado de um rótulo no formato usado no bloco de topo
 * da página de detalhe: `<td>Situação:</td><td>valor</td>` — duas
 * células irmãs, rótulo na primeira. Validado contra o HTML real da
 * página de detalhe de marca.
 */
function extrairRotuloEmTd($: cheerio.CheerioAPI, rotulo: string): string | null {
  let valor: string | null = null;
  $("td").each((_, celula) => {
    if (valor !== null) return;
    const texto = textoDoNo($, celula).replace(/:$/, "");
    if (texto !== rotulo) return;
    const proxima = $(celula).next("td");
    const texto2 = textoDoNo($, proxima.get(0));
    if (texto2) valor = texto2;
  });
  return valor;
}

/**
 * Acha a tabela cuja linha de cabeçalho contém `rotuloCabecalho` e devolve
 * a ÚLTIMA linha de dados dela (a mais recente, no caso da tabela de
 * despachos/publicações) como um mapa rótulo→valor, pareado por posição
 * de coluna. Usado tanto pra lista de resultado da busca (achar
 * "Situação", 1 linha só) quanto pra tabela "Publicações" da página de
 * detalhe (achar "RPI", pode ter várias linhas).
 *
 * Cada candidata a tabela é escaneada com as linhas restritas a ela mesma
 * (via `closest("table")`), não ao documento inteiro — o HTML do INPI tem
 * tabelas de tooltip aninhadas dentro de células (ex.: a tabela de
 * Classificação de Produtos tem um tooltip com outra tabela dentro de
 * cada célula), e sem essa checagem as linhas da tabela errada vazavam
 * pro resultado.
 */
function extrairUltimaLinhaDaTabela($: cheerio.CheerioAPI, rotuloCabecalho: string): Map<string, string> | null {
  let resultado: Map<string, string> | null = null;

  $("table").each((_, tabela) => {
    if (resultado) return;

    const linhas = $(tabela)
      .find("tr")
      .filter((_, tr) => $(tr).closest("table").is(tabela))
      .toArray();
    const textosPorLinha = linhas.map((tr) =>
      $(tr)
        .find("td, th")
        .toArray()
        .map((celula) => textoDoNo($, celula))
    );

    const indiceCabecalho = textosPorLinha.findIndex((textos) => textos.includes(rotuloCabecalho));
    if (indiceCabecalho === -1) return;
    const cabecalho = textosPorLinha[indiceCabecalho];

    let ultimaLinha: string[] | undefined;
    for (let i = indiceCabecalho + 1; i < textosPorLinha.length; i++) {
      const linha = textosPorLinha[i];
      if (linha.length < cabecalho.length) continue; // linha de estrutura diferente na mesma tabela
      if (linha.every((valor) => !valor)) break; // linha vazia = fim dos dados
      ultimaLinha = linha;
    }
    if (!ultimaLinha) return;

    const mapa = new Map<string, string>();
    cabecalho.forEach((rotulo, i) => {
      if (rotulo) mapa.set(rotulo, ultimaLinha![i] ?? "");
    });
    resultado = mapa;
  });

  return resultado;
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
 * resultado da busca) — validado contra uma consulta real de marca.
 * Situação/Marca/Apresentação/Natureza vêm do bloco de topo
 * (rótulo/valor em `<td>` irmãs); Titular, da tabela "Titulares"; o
 * despacho mais recente, da tabela "Publicações" (colunas RPI, Data RPI,
 * Despacho).
 */
function parsePaginaDetalhe($: cheerio.CheerioAPI): ResultadoConsultaInpi | null {
  const situacao = extrairRotuloEmTd($, "Situação") ?? extrairRotuloEmTd($, "Situacao");
  if (!situacao) return null;

  const nome = extrairRotuloEmTd($, "Marca") ?? extrairRotuloEmTd($, "Título") ?? extrairRotuloEmTd($, "Titulo");
  const apresentacao = extrairRotuloEmTd($, "Apresentação") ?? extrairRotuloEmTd($, "Apresentacao");
  const natureza = extrairRotuloEmTd($, "Natureza");

  const linhaTitular = extrairUltimaLinhaDaTabela($, "Nome");
  const titular = linhaTitular?.get("Nome") ?? null;

  const linhaClasse = extrairUltimaLinhaDaTabela($, "Classe de Nice");
  const classe = linhaClasse?.get("Classe de Nice") ?? null;

  const linhaDespacho = extrairUltimaLinhaDaTabela($, "RPI");
  const despachoDescricao = linhaDespacho?.get("Despacho") || null;
  const despachoData = paraDataIso(linhaDespacho?.get("Data RPI"));

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
    numeroRpi: linhaDespacho?.get("RPI") || numeroRpi,
    dadosAtualizadosAte,
  };
}

/**
 * Parser da página de LISTA de resultado da busca (fallback, usado
 * quando não achamos um link de detalhe pra seguir — ex.: patente/desenho
 * ainda não confirmados, ou marca sem link por algum motivo). Só tem a
 * situação atual, sem histórico de despacho.
 */
function parsePaginaLista($: cheerio.CheerioAPI): ResultadoConsultaInpi | null {
  const linha = extrairUltimaLinhaDaTabela($, "Situação") ?? extrairUltimaLinhaDaTabela($, "Situacao");
  if (!linha) return null;

  const situacao = linha.get("Situação") || linha.get("Situacao") || null;
  const { numeroRpi, dadosAtualizadosAte } = extrairRodape($);

  return {
    tipo: "encontrado",
    nome: linha.get("Marca") || linha.get("Título") || null,
    situacao,
    titular: linha.get("Titular") || null,
    apresentacao: null,
    natureza: null,
    classe: linha.get("Classe") || null,
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
