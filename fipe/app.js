document.addEventListener('DOMContentLoaded', async () => {
  const API_URL = 'https://parallelum.com.br/fipe/api/v1/carros';
  
  // Campos de entrada e datalists para marcas e modelos
  const marcasInput = document.getElementById('marcas');
  const marcasDatalist = document.getElementById('marcas-datalist');
  const modelosInput = document.getElementById('modelos');
  const modelosDatalist = document.getElementById('modelos-datalist');
  
  const tabelaPrecos = document.getElementById('tabela-precos');
  const loading = document.getElementById('loading');

  // Variáveis para armazenar os dados das marcas e modelos
  let marcasData = [];
  let modelosData = [];

  // Carregar marcas
  try {
    const response = await fetch(`${API_URL}/marcas`);
    const marcas = await response.json();
    marcasData = marcas;
    
    // Preenche o datalist com as marcas (nome e código ficam armazenados em marcasData)
    marcasDatalist.innerHTML = '<option value="">Selecione a marca</option>' + 
      marcas.map(marca => `<option data-codigo="${marca.codigo}" value="${marca.nome}">`).join('');
    marcasInput.disabled = false;
  } catch (error) {
    alert('Erro ao carregar marcas');
  }

  // Ao selecionar (ou digitar) uma marca válida
  marcasInput.addEventListener('change', async () => {
    const selectedName = marcasInput.value.trim();
    const selectedBrand = marcasData.find(brand => brand.nome.toLowerCase() === selectedName.toLowerCase());
    if (!selectedBrand) {
      // Se a marca não for válida, limpa e desabilita o campo de modelo
      modelosInput.value = "";
      modelosInput.disabled = true;
      modelosDatalist.innerHTML = '<option value="Selecione um modelo">';
      return;
    }
    const codigoMarca = selectedBrand.codigo;
    
    // Limpa o campo de modelo enquanto carrega as opções
    modelosInput.value = "";
    modelosInput.disabled = true;
    modelosDatalist.innerHTML = '<option value="">Carregando modelos...</option>';
    
    try {
      const response = await fetch(`${API_URL}/marcas/${codigoMarca}/modelos`);
      const data = await response.json();
      modelosData = data.modelos;
      modelosDatalist.innerHTML = '<option value="">Selecione o modelo</option>' + 
        modelosData.map(modelo => `<option data-codigo="${modelo.codigo}" value="${modelo.nome}">`).join('');
      modelosInput.disabled = false;
    } catch (error) {
      alert('Erro ao carregar modelos');
    }
  });

  // Ao selecionar (ou digitar) um modelo válido
  modelosInput.addEventListener('change', async () => {
    const selectedName = modelosInput.value.trim();
    const selectedModel = modelosData.find(modelo => modelo.nome.toLowerCase() === selectedName.toLowerCase());
    if (!selectedModel) {
      return;
    }
    const codigoModelo = selectedModel.codigo;
    
    // Recupera o código da marca selecionada
    const selectedBrand = marcasData.find(brand => brand.nome.toLowerCase() === marcasInput.value.trim().toLowerCase());
    if (!selectedBrand) {
      return;
    }
    const codigoMarca = selectedBrand.codigo;
    
    loading.classList.remove('hidden');
    tabelaPrecos.innerHTML = '';
    try {
      // Buscar anos disponíveis para o modelo selecionado
      const anosResponse = await fetch(`${API_URL}/marcas/${codigoMarca}/modelos/${codigoModelo}/anos`);
      const anos = await anosResponse.json();

      // Buscar preços para cada ano
      const precosPromises = anos.map(async (ano) => {
        const precoResponse = await fetch(`${API_URL}/marcas/${codigoMarca}/modelos/${codigoModelo}/anos/${ano.codigo}`);
        return precoResponse.json();
      });

      const precos = await Promise.all(precosPromises);

      // Cria a tabela de preços
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
  });
});
