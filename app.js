document.addEventListener('DOMContentLoaded', async () => {
    const marcasSelect = document.getElementById('marcas');
    const modelosSelect = document.getElementById('modelos');
    const tabelaPrecos = document.getElementById('tabela-precos');
  
    // Carregar marcas
    try {
      const response = await fetch('/api/marcas');
      const marcas = await response.json();
      marcasSelect.innerHTML = '<option value="">Selecione a Marca</option>' + 
        marcas.map(marca => `<option value="${marca.codigo}">${marca.nome}</option>`).join('');
      marcasSelect.disabled = false;
    } catch (error) {
      console.error(error);
    }
  
    // Ao selecionar marca
    marcasSelect.addEventListener('change', async (e) => {
      const codigoMarca = e.target.value;
      if (!codigoMarca) return;
      
      try {
        const response = await fetch(`/api/marcas/${codigoMarca}/modelos`);
        const modelos = await response.json();
        modelosSelect.innerHTML = '<option value="">Selecione o Modelo</option>' + 
          modelos.map(modelo => `<option value="${modelo.codigo}">${modelo.nome}</option>`).join('');
        modelosSelect.disabled = false;
      } catch (error) {
        console.error(error);
      }
    });
  
    // Ao selecionar modelo: buscar preços automaticamente
    modelosSelect.addEventListener('change', async (e) => {
      const codigoModelo = e.target.value;
      const codigoMarca = marcasSelect.value;
      
      if (!codigoModelo || !codigoMarca) return;
  
      try {
        const response = await fetch(`/api/precos/${codigoMarca}/${codigoModelo}`);
        const precos = await response.json();
  
        // Gerar tabela HTML
        tabelaPrecos.innerHTML = `
          <table>
            <thead>
              <tr>
                <th>Ano do Veículo</th>
                <th>Preço Atual FIPE</th>
              </tr>
            </thead>
            <tbody>
              ${precos.map(preco => `
                <tr>
                  <td>${preco.ano}</td>
                  <td>${preco.preco}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      } catch (error) {
        console.error(error);
        tabelaPrecos.innerHTML = '<p>Erro ao carregar preços.</p>';
      }
    });
  });