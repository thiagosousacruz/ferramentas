/**
 * Sudoku Quest - Ponto de Entrada Principal (js/app.js)
 * Inicializa a interface e tenta carregar o progresso do jogo salvo.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar o Gerenciador de UI
    const ui = new UIManager();

    try {
        // Tentar carregar jogo salvo do LocalStorage (Auto-Save)
        const savedState = StorageManager.getSavedGame();

        if (savedState) {
            // Reconstrói o jogo a partir do estado salvo
            const restoredGame = new SudokuGame(savedState.mode, savedState.difficulty, savedState);
            ui.setGame(restoredGame);
        } else {
            // Se não houver jogo salvo, gera um jogo padrão (Clássico - Médio)
            // Isso garante que o usuário caia direto no jogo em vez de uma tela vazia
            const defaultGame = new SudokuGame('classic', 'medium');
            ui.setGame(defaultGame);
            
            // Abre o modal de escolha de modos para apresentar as opções caso ele queira trocar
            ui.openModesModal();
        }
    } catch (error) {
        console.error("Erro ao carregar o jogo salvo:", error);
        // Em caso de falha catastrófica, limpa o save corrompido e inicia novo jogo limpo
        StorageManager.clearSavedGame();
        const fallbackGame = new SudokuGame('classic', 'medium');
        ui.setGame(fallbackGame);
    }
});
