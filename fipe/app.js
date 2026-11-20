// Consulta FIPE
// - Preços atuais: API pública parallelum (limite de 500 consultas/dia por IP).
// - Histórico de 12 meses: API do site oficial da FIPE (veiculos.fipe.org.br).
//   Os códigos de marca/modelo/ano são os mesmos nas duas.
// - Tudo que é consultado fica em cache no IndexedDB do navegador.

const API_URL = 'https://parallelum.com.br/fipe/api/v1/carros';
const FIPE_URL = 'https://veiculos.fipe.org.br/api/veiculos';
const CHART_JS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const TTL_LISTAS = 7 * DIA;      // marcas e modelos mudam pouco
const TTL_PRECOS = DIA;          // preço atual: FIPE publica uma vez por mês
const TTL_REFERENCIAS = 12 * HORA;
const TTL_SEM_DADO = 7 * DIA;    // "nada encontrado" na FIPE para um mês
const MAX_ITENS_LISTA = 50;
const CONCORRENCIA_PRECOS = 4;
const CONCORRENCIA_HISTORICO = 3;
const MESES_HISTORICO = 12;

// ---------- Cache (IndexedDB com fallback em memória) ----------
const cache = (() => {
  const memoria = new Map();
  let conexao = null;

  function abrir() {
    if (!conexao) {
      conexao = new Promise((resolve) => {
        try {
          const req = indexedDB.open('fipe-cache', 1);
          req.onupgradeneeded = () => req.result.createObjectStore('respostas');
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
          req.onblocked = () => resolve(null);
        } catch (erro) {
          resolve(null);
        }
      });
    }
    return conexao;
  }

  async function lerDoBanco(chave) {
    const db = await abrir();
    if (!db) return undefined;
    return new Promise((resolve) => {
      try {
        const req = db.transaction('respostas').objectStore('respostas').get(chave);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
      } catch (erro) {
        resolve(undefined);
      }
    });
  }

  async function get(chave) {
    let item = memoria.get(chave);
    if (!item) {
      item = await lerDoBanco(chave);
      if (item) memoria.set(chave, item);
    }
    if (!item || (item.expira && item.expira < Date.now())) return undefined;
    return item.valor;
  }

  async function set(chave, valor, ttl) {
    const item = { valor, expira: ttl ? Date.now() + ttl : 0 };
    memoria.set(chave, item);
    const db = await abrir();
    if (!db) return;
    try {
      db.transaction('respostas', 'readwrite').objectStore('respostas').put(item, chave);
    } catch (erro) {
      // Sem espaço ou modo privado: segue só com a memória.
    }
  }

  return { get, set };
})();

// ---------- Utilitários ----------
function mensagemDeErro(erro) {
  if (erro && erro.status === 429) {
    return 'O limite diário de consultas da API foi atingido. Tente de novo amanhã (o que já foi consultado continua disponível).';
  }
  if (erro instanceof TypeError) {
    return 'Não foi possível conectar. Confira a internet e tente de novo.';
  }
  return 'A consulta falhou. Tente de novo em instantes.';
}

async function buscarJSON(url, ttl) {
  const emCache = await cache.get(url);
  if (emCache !== undefined) return emCache;

  const resposta = await fetch(url);
  if (!resposta.ok) {
    const erro = new Error(`HTTP ${resposta.status}`);
    erro.status = resposta.status;
    throw erro;
  }
  const dados = await resposta.json();
  if (dados && dados.error) throw new Error(dados.error);

  await cache.set(url, dados, ttl);
  return dados;
}

// Executa fn em todos os itens com no máximo `limite` chamadas simultâneas.
// Nunca rejeita: devolve { ok, valor } ou { ok: false, erro } por item.
async function emLotes(itens, limite, fn) {
  const resultados = new Array(itens.length);
  let proximo = 0;

  async function trabalhador() {
    while (proximo < itens.length) {
      const indice = proximo++;
      try {
        resultados[indice] = { ok: true, valor: await fn(itens[indice]) };
      } catch (erro) {
        resultados[indice] = { ok: false, erro };
      }
    }
  }

  const total = Math.min(limite, itens.length);
  await Promise.all(Array.from({ length: total }, trabalhador));
  return resultados;
}

function normalizar(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function precoParaNumero(valor) {
  return Number(String(valor).replace(/[^\d,]/g, '').replace(',', '.'));
}

const formatoMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatoPercentual = new Intl.NumberFormat('pt-BR', {
  style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero'
});

function rotuloAno(anoModelo) {
  return Number(anoModelo) === 32000 ? 'Zero km' : String(anoModelo);
}

// "novembro/2026" -> "nov/26"
function mesCurto(mes) {
  const [nome, ano] = mes.trim().split('/');
  return `${nome.slice(0, 3)}/${(ano || '').slice(-2)}`;
}

function criar(tag, classe, texto) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function carregarScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(script);
  });
}

// ---------- API oficial da FIPE (histórico) ----------
async function postFipe(metodo, parametros) {
  const resposta = await fetch(`${FIPE_URL}/${metodo}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(parametros).toString()
  });
  if (!resposta.ok) {
    const erro = new Error(`HTTP ${resposta.status}`);
    erro.status = resposta.status;
    throw erro;
  }
  const texto = await resposta.text();
  if (!texto) throw new Error('Resposta vazia da FIPE');
  return JSON.parse(texto);
}

async function buscarReferencias() {
  const chave = 'fipe:referencias';
  const emCache = await cache.get(chave);
  if (emCache !== undefined) return emCache;

  const referencias = await postFipe('ConsultarTabelaDeReferencia', {});
  const lista = referencias.map(r => ({ codigo: r.Codigo, mes: r.Mes.trim() }));
  await cache.set(chave, lista, TTL_REFERENCIAS);
  return lista;
}

// Devolve o preço (número) ou null quando a FIPE não tem dado para aquele mês.
async function buscarPrecoNoMes(referencia, marca, modelo, anoCodigo) {
  const chave = `fipe:valor:${referencia}:${marca}:${modelo}:${anoCodigo}`;
  const emCache = await cache.get(chave);
  if (emCache !== undefined) return emCache;

  const [ano, combustivel] = anoCodigo.split('-');
  const dados = await postFipe('ConsultarValorComTodosParametros', {
    codigoTabelaReferencia: referencia,
    codigoMarca: marca,
    codigoModelo: modelo,
    codigoTipoVeiculo: 1,
    anoModelo: ano,
    codigoTipoCombustivel: combustivel,
    tipoVeiculo: 'carro',
    tipoConsulta: 'tradicional'
  });

  if (dados.erro) {
    await cache.set(chave, null, TTL_SEM_DADO);
    return null;
  }

  const valor = precoParaNumero(dados.Valor);
  // Meses passados não mudam: fica em cache para sempre.
  await cache.set(chave, valor, 0);
  return valor;
}

// ---------- Interface ----------
document.addEventListener('DOMContentLoaded', () => {
  const brandSearchBox = document.getElementById('searchbox-brand');
  const brandDropdown = document.getElementById('brand-dropdown');
  const modelSearchBox = document.getElementById('searchbox-model');
  const modelDropdown = document.getElementById('model-dropdown');
  const tabelaPrecos = document.getElementById('tabela-precos');
  const loading = document.getElementById('loading');

  // Blocos criados aqui para funcionar mesmo com um fipe.html antigo em cache.
  const mensagem = criar('div', 'mensagem hidden');
  mensagem.setAttribute('role', 'status');
  tabelaPrecos.before(mensagem);
  const historico = criar('section', 'historico hidden');
  tabelaPrecos.after(historico);

  let brandsData = [];
  let modelsData = [];
  let selectedBrand = null;
  let selectedModel = null;
  let grafico = null;

  // Contadores para descartar respostas de seleções antigas.
  let versaoModelos = 0;
  let versaoPrecos = 0;
  let versaoHistorico = 0;

  function mostrarMensagem(texto, { tipo = 'erro', tentarDeNovo } = {}) {
    mensagem.className = `mensagem ${tipo}`;
    mensagem.replaceChildren(criar('p', '', texto));
    if (tentarDeNovo) {
      const botao = criar('button', 'btn-secundario', 'Tentar de novo');
      botao.type = 'button';
      botao.addEventListener('click', tentarDeNovo);
      mensagem.appendChild(botao);
    }
  }

  function esconderMensagem() {
    mensagem.className = 'mensagem hidden';
    mensagem.replaceChildren();
  }

  function limparResultados() {
    versaoPrecos++;
    versaoHistorico++;
    tabelaPrecos.replaceChildren();
    limparHistorico();
    loading.classList.add('hidden');
  }

  function limparHistorico() {
    if (grafico) {
      grafico.destroy();
      grafico = null;
    }
    historico.replaceChildren();
    historico.classList.add('hidden');
  }

  // Filtra por partes do nome, ignorando acentos e maiúsculas.
  function filterItems(query, items) {
    const tokens = normalizar(query).split(/\s+/).filter(Boolean);
    return items.filter(item => {
      const nome = item.busca || (item.busca = normalizar(item.nome));
      return tokens.every(token => nome.includes(token));
    });
  }

  function fillDropdown(dropdown, items, onSelect) {
    dropdown.replaceChildren();
    items.slice(0, MAX_ITENS_LISTA).forEach(item => {
      const li = criar('li', '', item.nome);
      li.addEventListener('click', () => onSelect(item));
      dropdown.appendChild(li);
    });
    if (items.length > MAX_ITENS_LISTA) {
      dropdown.appendChild(criar('li', 'mais', `+${items.length - MAX_ITENS_LISTA} resultados, continue digitando…`));
    }
    dropdown.classList.toggle('hidden', items.length === 0);
  }

  function atualizarDropdown(searchBox, dropdown, items, onSelect) {
    fillDropdown(dropdown, filterItems(searchBox.value, items), onSelect);
  }

  function resetModelo(placeholder = 'Digite para buscar veículo...') {
    selectedModel = null;
    modelsData = [];
    modelSearchBox.value = '';
    modelSearchBox.disabled = true;
    modelSearchBox.placeholder = placeholder;
    modelDropdown.replaceChildren();
    modelDropdown.classList.add('hidden');
  }

  function selecionarMarca(marca) {
    brandSearchBox.value = marca.nome;
    selectedBrand = marca;
    brandDropdown.classList.add('hidden');
    limparResultados();
    esconderMensagem();
    fetchModels(marca);
  }

  function selecionarModelo(modelo) {
    modelSearchBox.value = modelo.nome;
    selectedModel = modelo;
    modelDropdown.classList.add('hidden');
    esconderMensagem();
    fetchPrices(selectedBrand, modelo);
  }

  async function fetchBrands() {
    brandSearchBox.disabled = true;
    brandSearchBox.placeholder = 'Carregando marcas…';
    try {
      brandsData = await buscarJSON(`${API_URL}/marcas`, TTL_LISTAS);
      brandSearchBox.disabled = false;
      brandSearchBox.placeholder = 'Digite para buscar marca...';
      esconderMensagem();
    } catch (erro) {
      console.error(erro);
      brandSearchBox.placeholder = 'Marcas indisponíveis';
      mostrarMensagem(`Não foi possível carregar as marcas. ${mensagemDeErro(erro)}`, { tentarDeNovo: fetchBrands });
    }
  }

  async function fetchModels(marca) {
    const versao = ++versaoModelos;
    resetModelo('Carregando modelos…');
    try {
      const data = await buscarJSON(`${API_URL}/marcas/${marca.codigo}/modelos`, TTL_LISTAS);
      if (versao !== versaoModelos) return;
      modelsData = Array.isArray(data.modelos) ? data.modelos : [];
      modelSearchBox.disabled = false;
      modelSearchBox.placeholder = 'Digite para buscar veículo...';
      modelSearchBox.focus();
    } catch (erro) {
      if (versao !== versaoModelos) return;
      console.error(erro);
      resetModelo('Modelos indisponíveis');
      mostrarMensagem(`Não foi possível carregar os modelos. ${mensagemDeErro(erro)}`, {
        tentarDeNovo: () => fetchModels(marca)
      });
    }
  }

  async function fetchPrices(marca, modelo) {
    const versao = ++versaoPrecos;
    versaoHistorico++;
    limparHistorico();
    tabelaPrecos.replaceChildren();
    loading.classList.remove('hidden');

    try {
      const base = `${API_URL}/marcas/${marca.codigo}/modelos/${modelo.codigo}/anos`;
      const anos = await buscarJSON(base, TTL_PRECOS);
      if (versao !== versaoPrecos) return;

      const resultados = await emLotes(anos, CONCORRENCIA_PRECOS,
        ano => buscarJSON(`${base}/${ano.codigo}`, TTL_PRECOS));
      if (versao !== versaoPrecos) return;

      const linhas = [];
      const falhas = [];
      resultados.forEach((resultado, i) => {
        if (resultado.ok && resultado.valor && resultado.valor.Valor) {
          linhas.push({ ano: anos[i], preco: resultado.valor });
        } else {
          falhas.push(resultado.erro);
        }
      });

      if (!linhas.length) {
        mostrarMensagem(`Não foi possível buscar os preços. ${mensagemDeErro(falhas[0])}`, {
          tentarDeNovo: () => fetchPrices(marca, modelo)
        });
        return;
      }

      renderTabela(marca, modelo, linhas);

      if (falhas.length) {
        mostrarMensagem(
          `${falhas.length} de ${anos.length} anos não puderam ser carregados. ${mensagemDeErro(falhas[0])}`,
          { tipo: 'aviso', tentarDeNovo: () => fetchPrices(marca, modelo) }
        );
      }
    } catch (erro) {
      if (versao !== versaoPrecos) return;
      console.error(erro);
      mostrarMensagem(`Não foi possível buscar os preços. ${mensagemDeErro(erro)}`, {
        tentarDeNovo: () => fetchPrices(marca, modelo)
      });
    } finally {
      if (versao === versaoPrecos) loading.classList.add('hidden');
    }
  }

  function renderTabela(marca, modelo, linhas) {
    // Zero km primeiro, depois do mais novo para o mais antigo.
    linhas.sort((a, b) => b.preco.AnoModelo - a.preco.AnoModelo);

    const referencia = linhas[0].preco.MesReferencia;
    const fragmento = document.createDocumentFragment();
    if (referencia) {
      fragmento.appendChild(criar('p', 'referencia', `Tabela FIPE de ${referencia.trim()}`));
    }

    const tabela = criar('table');
    const cabecalho = criar('tr');
    ['Ano', 'Combustível', 'Preço', ''].forEach(titulo => cabecalho.appendChild(criar('th', '', titulo)));
    tabela.appendChild(criar('thead')).appendChild(cabecalho);

    const corpo = criar('tbody');
    linhas.forEach(({ ano, preco }) => {
      const tr = criar('tr');
      tr.appendChild(criar('td', '', rotuloAno(preco.AnoModelo)));
      tr.appendChild(criar('td', '', preco.Combustivel));
      tr.appendChild(criar('td', 'preco', preco.Valor));

      const tdBotao = criar('td', 'acoes');
      const botao = criar('button', 'btn-historico', '📈');
      botao.appendChild(criar('span', 'rotulo-botao', ' 12 meses'));
      botao.type = 'button';
      botao.title = `Histórico de preços de ${rotuloAno(preco.AnoModelo)} ${preco.Combustivel}`;
      botao.setAttribute('aria-label', botao.title);
      botao.addEventListener('click', () => carregarHistorico(marca, modelo, ano, preco));
      tdBotao.appendChild(botao);
      tr.appendChild(tdBotao);

      corpo.appendChild(tr);
    });
    tabela.appendChild(corpo);
    fragmento.appendChild(tabela);
    tabelaPrecos.replaceChildren(fragmento);
  }

  // ---------- Histórico de 12 meses ----------
  async function carregarHistorico(marca, modelo, ano, preco) {
    const versao = ++versaoHistorico;
    limparHistorico();
    historico.classList.remove('hidden');

    const titulo = `${modelo.nome} · ${rotuloAno(preco.AnoModelo)} ${preco.Combustivel}`;
    historico.append(criar('h2', '', 'Histórico de 12 meses'), criar('p', 'historico-veiculo', titulo));
    const status = criar('p', 'historico-status', 'Carregando histórico…');
    historico.appendChild(status);
    historico.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
      const referencias = (await buscarReferencias()).slice(0, MESES_HISTORICO).reverse();
      if (versao !== versaoHistorico) return;

      const resultados = await emLotes(referencias, CONCORRENCIA_HISTORICO,
        ref => buscarPrecoNoMes(ref.codigo, marca.codigo, modelo.codigo, ano.codigo));
      if (versao !== versaoHistorico) return;

      const pontos = referencias.map((ref, i) => ({
        mes: ref.mes,
        valor: resultados[i].ok ? resultados[i].valor : null,
        falhou: !resultados[i].ok
      }));
      const falhas = pontos.filter(p => p.falhou).length;
      const comValor = pontos.filter(p => p.valor !== null);

      if (!comValor.length) {
        status.textContent = falhas
          ? `Não foi possível consultar o histórico. ${mensagemDeErro(resultados.find(r => !r.ok).erro)}`
          : 'A FIPE não tem histórico deste veículo nos últimos 12 meses.';
        if (falhas) historico.appendChild(botaoTentarDeNovo(marca, modelo, ano, preco));
        return;
      }

      status.remove();
      await renderHistorico(pontos, comValor, versao);

      if (falhas) {
        const aviso = criar('p', 'historico-status', `${falhas} ${falhas === 1 ? 'mês não pôde' : 'meses não puderam'} ser consultados.`);
        historico.append(aviso, botaoTentarDeNovo(marca, modelo, ano, preco));
      }
    } catch (erro) {
      if (versao !== versaoHistorico) return;
      console.error(erro);
      status.textContent = `Não foi possível consultar o histórico. ${mensagemDeErro(erro)}`;
      historico.appendChild(botaoTentarDeNovo(marca, modelo, ano, preco));
    }
  }

  function botaoTentarDeNovo(marca, modelo, ano, preco) {
    const botao = criar('button', 'btn-secundario', 'Tentar de novo');
    botao.type = 'button';
    botao.addEventListener('click', () => carregarHistorico(marca, modelo, ano, preco));
    return botao;
  }

  async function renderHistorico(pontos, comValor, versao) {
    const primeiro = comValor[0];
    const ultimo = comValor[comValor.length - 1];
    const variacao = ultimo.valor / primeiro.valor - 1;

    const resumo = criar('div', 'resumo');
    resumo.append(
      cartao(`Em ${primeiro.mes}`, formatoMoeda.format(primeiro.valor)),
      cartao(`Em ${ultimo.mes}`, formatoMoeda.format(ultimo.valor)),
      cartao('Variação no período', formatoPercentual.format(variacao),
        variacao > 0 ? 'positiva' : variacao < 0 ? 'negativa' : '')
    );
    historico.appendChild(resumo);

    const areaGrafico = criar('div', 'grafico');
    const canvas = criar('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Gráfico do preço FIPE nos últimos 12 meses');
    areaGrafico.appendChild(canvas);
    historico.appendChild(areaGrafico);

    historico.appendChild(tabelaHistorico(pontos));

    try {
      if (!window.Chart) await carregarScript(CHART_JS_URL);
    } catch (erro) {
      areaGrafico.remove(); // sem gráfico, a tabela continua
      return;
    }
    if (versao !== versaoHistorico) return;

    grafico = new window.Chart(canvas, {
      type: 'line',
      data: {
        labels: pontos.map(p => mesCurto(p.mes)),
        datasets: [{
          label: 'Preço FIPE',
          data: pontos.map(p => p.valor),
          borderColor: '#007BFF',
          backgroundColor: 'rgba(0, 123, 255, 0.08)',
          fill: true,
          tension: 0.3,
          spanGaps: true,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => formatoMoeda.format(ctx.parsed.y) } }
        },
        scales: {
          y: {
            ticks: {
              callback: valor => formatoMoeda.format(valor).replace(/,\d{2}$/, '')
            }
          }
        }
      }
    });
  }

  function cartao(rotulo, valor, classe = '') {
    const div = criar('div', 'cartao');
    div.append(criar('span', 'cartao-rotulo', rotulo), criar('strong', classe, valor));
    return div;
  }

  function tabelaHistorico(pontos) {
    const tabela = criar('table', 'tabela-historico');
    const cabecalho = criar('tr');
    ['Mês', 'Preço', 'Variação'].forEach(t => cabecalho.appendChild(criar('th', '', t)));
    tabela.appendChild(criar('thead')).appendChild(cabecalho);

    const corpo = criar('tbody');
    let anterior = null;
    // Mais recente no topo.
    const linhas = pontos.map(p => {
      const variacao = p.valor !== null && anterior !== null ? p.valor / anterior - 1 : null;
      if (p.valor !== null) anterior = p.valor;
      return { ...p, variacao };
    }).reverse();

    linhas.forEach(p => {
      const tr = criar('tr');
      tr.appendChild(criar('td', '', p.mes));
      tr.appendChild(criar('td', 'preco', p.valor === null ? (p.falhou ? 'falhou' : '—') : formatoMoeda.format(p.valor)));
      const classe = p.variacao > 0 ? 'positiva' : p.variacao < 0 ? 'negativa' : '';
      tr.appendChild(criar('td', classe, p.variacao === null ? '' : formatoPercentual.format(p.variacao)));
      corpo.appendChild(tr);
    });
    tabela.appendChild(corpo);
    return tabela;
  }

  // ---------- Eventos ----------
  brandSearchBox.addEventListener('input', () => {
    if (selectedBrand && brandSearchBox.value !== selectedBrand.nome) {
      selectedBrand = null;
      versaoModelos++;
      resetModelo();
      limparResultados();
    }
    atualizarDropdown(brandSearchBox, brandDropdown, brandsData, selecionarMarca);
  });

  // No foco, se já há uma seleção, mostra a lista inteira para facilitar a troca.
  brandSearchBox.addEventListener('focus', () => {
    if (selectedBrand) fillDropdown(brandDropdown, brandsData, selecionarMarca);
    else atualizarDropdown(brandSearchBox, brandDropdown, brandsData, selecionarMarca);
  });

  modelSearchBox.addEventListener('input', () => {
    if (selectedModel && modelSearchBox.value !== selectedModel.nome) {
      selectedModel = null;
      limparResultados();
    }
    atualizarDropdown(modelSearchBox, modelDropdown, modelsData, selecionarModelo);
  });

  modelSearchBox.addEventListener('focus', () => {
    if (selectedModel) fillDropdown(modelDropdown, modelsData, selecionarModelo);
    else atualizarDropdown(modelSearchBox, modelDropdown, modelsData, selecionarModelo);
  });

  // Fecha os dropdowns ao clicar fora dos campos e das listas.
  document.addEventListener('click', (e) => {
    if (!brandSearchBox.contains(e.target) && !brandDropdown.contains(e.target)) {
      brandDropdown.classList.add('hidden');
    }
    if (!modelSearchBox.contains(e.target) && !modelDropdown.contains(e.target)) {
      modelDropdown.classList.add('hidden');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      brandDropdown.classList.add('hidden');
      modelDropdown.classList.add('hidden');
    }
  });

  resetModelo();
  fetchBrands();
});
