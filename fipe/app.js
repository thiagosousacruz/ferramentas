document.addEventListener('DOMContentLoaded', async () => {
  const API_URL = 'https://parallelum.com.br/fipe/api/v1/carros';
  const marcasSelect = document.getElementById('marcas');
  const modelosSelect = document.getElementById('modelos');
  const tabelaPrecos = document.getElementById('tabela-precos');
  const loading = document.getElementById('loading');

  // Carregar marcas
  try {
    const response = await fetch(`${API_URL}/marcas`);
    const marcas = await response.json();
    
    marcasSelect.innerHTML = '<option value="">Selecione a marca</option>' + 
      marcas.map(marca => `<option value="${marca.codigo}">${marca.nome}</option>`).join('');
    
    marcasSelect.disabled = false;
  } catch (error) {
    alert('Erro ao carregar marcas');
  }

  // Ao selecionar marca
  marcasSelect.addEventListener('change', async (e) => {
    const codigoMarca = e.target.value;
    modelosSelect.innerHTML = '<option value="">Carregando modelos...</option>';
    modelosSelect.disabled = true;

    if (!codigoMarca) return;

    try {
      const response = await fetch(`${API_URL}/marcas/${codigoMarca}/modelos`);
      const data = await response.json();
      
      modelosSelect.innerHTML = '<option value="">Selecione o modelo</option>' + 
        data.modelos.map(modelo => `<option value="${modelo.codigo}">${modelo.nome}</option>`).join('');
      
      modelosSelect.disabled = false;
    } catch (error) {
      alert('Erro ao carregar modelos');
    }
  });

  // Ao selecionar modelo
  modelosSelect.addEventListener('change', async (e) => {
    const codigoMarca = marcasSelect.value;
    const codigoModelo = e.target.value;
    
    if (!codigoMarca || !codigoModelo) return;

    loading.classList.remove('hidden');
    tabelaPrecos.innerHTML = '';

    try {
      // Buscar anos disponíveis
      const anosResponse = await fetch(`${API_URL}/marcas/${codigoMarca}/modelos/${codigoModelo}/anos`);
      const anos = await anosResponse.json();

      // Buscar preços para cada ano
      const precosPromises = anos.map(async (ano) => {
        const precoResponse = await fetch(`${API_URL}/marcas/${codigoMarca}/modelos/${codigoModelo}/anos/${ano.codigo}`);
        return precoResponse.json();
      });

      const precos = await Promise.all(precosPromises);

      // Criar tabela com os preços
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
