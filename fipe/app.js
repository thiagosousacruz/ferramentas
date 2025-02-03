document.addEventListener('DOMContentLoaded', async () => {
  const API_URL = 'https://parallelum.com.br/fipe/api/v1/carros';

  // Elementos dos searchboxes e dropdowns
  const brandSearchBox = document.getElementById('searchbox-brand');
  const brandDropdown = document.getElementById('brand-dropdown');
  const modelSearchBox = document.getElementById('searchbox-model');
  const modelDropdown = document.getElementById('model-dropdown');
  const tabelaPrecos = document.getElementById('tabela-precos');
  const loading = document.getElementById('loading');

  let brandsData = [];
  let modelsData = [];
  let selectedBrand = null;

  // Função que filtra itens (marcas ou modelos) buscando por partes do nome:
  // Divide a query em tokens e verifica se cada token está presente no nome do item.
  function filterItems(query, items) {
    const tokens = query.toLowerCase().split(/\s+/).filter(token => token);
    return items.filter(item => {
      const itemName = item.nome.toLowerCase();
      return tokens.every(token => itemName.includes(token));
    });
  }

  // Função para preencher o dropdown com os itens fornecidos
  function fillDropdown(dropdown, items) {
    dropdown.innerHTML = '';
    items.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item.nome;
      li.dataset.codigo = item.codigo;
      li.addEventListener('click', () => {
        if (dropdown === brandDropdown) {
          // Ao selecionar uma marca:
          brandSearchBox.value = item.nome;
          selectedBrand = item;
          brandDropdown.classList.add('hidden');
          // Habilita o searchbox de veículo e limpa qualquer seleção anterior
          modelSearchBox.disabled = false;
          modelSearchBox.value = '';
          modelDropdown.innerHTML = '';
          // Carrega os modelos para a marca selecionada
          fetchModels(item.codigo);
        } else if (dropdown === modelDropdown) {
          // Ao selecionar um veículo:
          modelSearchBox.value = item.nome;
          modelDropdown.classList.add('hidden');
          // Busca e exibe os preços para a marca e veículo selecionados
          fetchPrices(selectedBrand.codigo, item.codigo);
        }
      });
      dropdown.appendChild(li);
    });
  }

  // Busca as marcas e armazena em brandsData
  async function fetchBrands() {
    try {
      const response = await fetch(`${API_URL}/marcas`);
      brandsData = await response.json();
    } catch (error) {
      alert('Erro ao carregar marcas');
    }
  }

  // Busca os modelos para uma marca específica e armazena em modelsData
  async function fetchModels(brandCode) {
    try {
      const response = await fetch(`${API_URL}/marcas/${brandCode}/modelos`);
      const data = await response.json();
      modelsData = data.modelos;
    } catch (error) {
      alert('Erro ao carregar modelos');
    }
  }

  // Busca os preços do veículo selecionado e exibe a tabela
  async function fetchPrices(brandCode, modelCode) {
    loading.classList.remove('hidden');
    tabelaPrecos.innerHTML = '';
    try {
      const anosResponse = await fetch(`${API_URL}/marcas/${brandCode}/modelos/${modelCode}/anos`);
      const anos = await anosResponse.json();
      const precosPromises = anos.map(async (ano) => {
        const precoResponse = await fetch(`${API_URL}/marcas/${brandCode}/modelos/${modelCode}/anos/${ano.codigo}`);
        return precoResponse.json();
      });
      const precos = await Promise.all(precosPromises);
      tabelaPrecos.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>Ano</th>
              <th>Preço</th>
              <th>Combustível</th>
            </tr>
          </thead>
          <tbody>
            ${precos.map(preco => `
              <tr>
                <td>${preco.AnoModelo}</td>
                <td>${preco.Valor}</td>
                <td>${preco.Combustivel}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (error) {
      tabelaPrecos.innerHTML = '<p>Erro ao buscar preços.</p>';
    } finally {
      loading.classList.add('hidden');
    }
  }

  // Eventos para o searchbox de marcas
  brandSearchBox.addEventListener('input', () => {
    // Se o valor digitado não corresponder à marca selecionada, limpa a seleção e desabilita o searchbox de veículos
    if (selectedBrand && brandSearchBox.value.toLowerCase() !== selectedBrand.nome.toLowerCase()) {
      selectedBrand = null;
      modelSearchBox.value = '';
      modelSearchBox.disabled = true;
      modelDropdown.innerHTML = '';
    }
    const query = brandSearchBox.value;
    const filtered = filterItems(query, brandsData);
    if (filtered.length > 0) {
      fillDropdown(brandDropdown, filtered);
      brandDropdown.classList.remove('hidden');
    } else {
      brandDropdown.classList.add('hidden');
    }
  });

  brandSearchBox.addEventListener('focus', () => {
    if (brandsData.length > 0) {
      fillDropdown(brandDropdown, brandsData);
      brandDropdown.classList.remove('hidden');
    }
  });

  // Eventos para o searchbox de veículos
  modelSearchBox.addEventListener('input', () => {
    const query = modelSearchBox.value;
    const filtered = filterItems(query, modelsData);
    if (filtered.length > 0) {
      fillDropdown(modelDropdown, filtered);
      modelDropdown.classList.remove('hidden');
    } else {
      modelDropdown.classList.add('hidden');
    }
  });

  modelSearchBox.addEventListener('focus', () => {
    if (modelsData.length > 0) {
      fillDropdown(modelDropdown, modelsData);
      modelDropdown.classList.remove('hidden');
    }
  });

  // Fecha os dropdowns caso o clique ocorra fora dos campos e listas
  document.addEventListener('click', (e) => {
    if (!brandSearchBox.contains(e.target) && !brandDropdown.contains(e.target)) {
      brandDropdown.classList.add('hidden');
    }
    if (!modelSearchBox.contains(e.target) && !modelDropdown.contains(e.target)) {
      modelDropdown.classList.add('hidden');
    }
  });

  // Inicialização: busca as marcas e habilita o searchbox de marca;
  // o searchbox de veículo permanece desabilitado até que uma marca seja selecionada.
  await fetchBrands();
  brandSearchBox.disabled = false;
  modelSearchBox.disabled = true;
});
