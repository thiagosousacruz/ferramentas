document.addEventListener('DOMContentLoaded', async () => {
  const API_URL = 'https://parallelum.com.br/fipe/api/v1/carros';

  // Elementos dos campos e dropdowns
  const marcasInput = document.getElementById('marcas');
  const marcasDropdown = document.getElementById('marcas-dropdown');
  const modelosInput = document.getElementById('modelos');
  const modelosDropdown = document.getElementById('modelos-dropdown');
  const tabelaPrecos = document.getElementById('tabela-precos');
  const loading = document.getElementById('loading');

  let marcasData = [];
  let modelosData = [];

  // Função para filtrar os itens do dropdown conforme o texto digitado
  function filterDropdown(dropdown, query) {
    const items = dropdown.querySelectorAll('li');
    items.forEach(item => {
      if (item.textContent.toLowerCase().includes(query)) {
        item.classList.remove('hidden');
      } else {
        item.classList.add('hidden');
      }
    });
  }

  // Preenche o dropdown de marcas
  function fillMarcasDropdown(marcas) {
    marcasDropdown.innerHTML = '';
    marcas.forEach(marca => {
      const li = document.createElement('li');
      li.textContent = marca.nome;
      li.dataset.codigo = marca.codigo;
      li.addEventListener('click', () => {
        marcasInput.value = marca.nome;
        marcasInput.dataset.codigo = marca.codigo;
        marcasDropdown.classList.add('hidden');
        // Após selecionar a marca, habilita e carrega os modelos
        fetchModels(marca.codigo);
      });
      marcasDropdown.appendChild(li);
    });
  }

  // Preenche o dropdown de modelos
  function fillModelosDropdown(modelos) {
    modelosDropdown.innerHTML = '';
    modelos.forEach(modelo => {
      const li = document.createElement('li');
      li.textContent = modelo.nome;
      li.dataset.codigo = modelo.codigo;
      li.addEventListener('click', () => {
        modelosInput.value = modelo.nome;
        modelosInput.dataset.codigo = modelo.codigo;
        modelosDropdown.classList.add('hidden');
        // Após selecionar o modelo, busca os preços
        fetchPrices(marcasInput.dataset.codigo, modelo.codigo);
      });
      modelosDropdown.appendChild(li);
    });
  }

  // Busca os modelos para a marca selecionada
  async function fetchModels(codigoMarca) {
    modelosInput.value = '';
    modelosInput.disabled = true;
    modelosDropdown.innerHTML = '';
    modelosDropdown.classList.add('hidden');
    try {
      const response = await fetch(`${API_URL}/marcas/${codigoMarca}/modelos`);
      const data = await response.json();
      modelosData = data.modelos;
      fillModelosDropdown(modelosData);
      modelosInput.disabled = false;
    } catch (error) {
      alert('Erro ao carregar modelos');
    }
  }

  // Busca os preços do modelo selecionado
  async function fetchPrices(codigoMarca, codigoModelo) {
    loading.classList.remove('hidden');
    tabelaPrecos.innerHTML = '';
    try {
      const anosResponse = await fetch(`${API_URL}/marcas/${codigoMarca}/modelos/${codigoModelo}/anos`);
      const anos = await anosResponse.json();

      const precosPromises = anos.map(async (ano) => {
        const precoResponse = await fetch(`${API_URL}/marcas/${codigoMarca}/modelos/${codigoModelo}/anos/${ano.codigo}`);
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

  // Carrega as marcas ao iniciar
  try {
    const response = await fetch(`${API_URL}/marcas`);
    const marcas = await response.json();
    marcasData = marcas;
    fillMarcasDropdown(marcasData);
    marcasInput.disabled = false;
  } catch (error) {
    alert('Erro ao carregar marcas');
  }

  // Exibe e filtra o dropdown de marcas quando o campo recebe foco ou o valor é digitado
  marcasInput.addEventListener('focus', () => {
    marcasDropdown.classList.remove('hidden');
    filterDropdown(marcasDropdown, marcasInput.value.toLowerCase());
  });

  marcasInput.addEventListener('input', () => {
    filterDropdown(marcasDropdown, marcasInput.value.toLowerCase());
    marcasDropdown.classList.remove('hidden');
  });

  // Exibe e filtra o dropdown de modelos quando o campo recebe foco ou o valor é digitado
  modelosInput.addEventListener('focus', () => {
    if (!modelosInput.disabled) {
      modelosDropdown.classList.remove('hidden');
      filterDropdown(modelosDropdown, modelosInput.value.toLowerCase());
    }
  });

  modelosInput.addEventListener('input', () => {
    filterDropdown(modelosDropdown, modelosInput.value.toLowerCase());
    modelosDropdown.classList.remove('hidden');
  });

  // Fecha os dropdowns se o clique ocorrer fora dos campos e das listas
  document.addEventListener('click', (e) => {
    if (!marcasInput.contains(e.target) && !marcasDropdown.contains(e.target)) {
      marcasDropdown.classList.add('hidden');
    }
    if (!modelosInput.contains(e.target) && !modelosDropdown.contains(e.target)) {
      modelosDropdown.classList.add('hidden');
    }
  });
});
