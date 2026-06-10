/**
 * Sudoku Quest - Motor de Regras e Geração Lógica (js/sudoku.js)
 * Contém a lógica de verificação, resolução backtracking e geração de tabuleiros.
 */

class SudokuEngine {
    constructor() {
        // Nada específico no construtor
    }

    /**
     * Gerador de números pseudo-aleatórios baseado em semente (Mulberry32)
     * Garante que a mesma semente gere sempre o mesmo tabuleiro (ótimo para o Desafio Diário).
     */
    static getPRNG(seed) {
        return function() {
            let t = seed += 0x6D2B79F5;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /**
     * Verifica se o valor pode ser colocado na célula especificada seguindo as regras do Sudoku.
     * @param {Array} grid Tabuleiro linear de 81 elementos.
     * @param {number} index Índice da célula (0 a 80).
     * @param {number} val Valor a ser verificado (1 a 9).
     * @returns {boolean} True se for um movimento válido, False caso contrário.
     */
    static isValid(grid, index, val) {
        const row = Math.floor(index / 9);
        const col = index % 9;

        // Verificar linha
        for (let i = 0; i < 9; i++) {
            if (i !== col && grid[row * 9 + i] === val) return false;
        }

        // Verificar coluna
        for (let i = 0; i < 9; i++) {
            if (i !== row && grid[i * 9 + col] === val) return false;
        }

        // Verificar bloco 3x3
        const boxRowStart = Math.floor(row / 3) * 3;
        const boxColStart = Math.floor(col / 3) * 3;
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                const cellIndex = (boxRowStart + r) * 9 + (boxColStart + c);
                if (cellIndex !== index && grid[cellIndex] === val) return false;
            }
        }

        return true;
    }

    /**
     * Encontra todas as células vazias no tabuleiro.
     */
    static findEmpty(grid) {
        for (let i = 0; i < 81; i++) {
            if (grid[i] === 0) return i;
        }
        return -1;
    }

    /**
     * Resolve o tabuleiro usando backtracking recursivo.
     * @param {Array} grid Tabuleiro linear de 81 elementos (modificado in-place).
     * @returns {boolean} True se resolvido com sucesso.
     */
    static solve(grid) {
        const index = this.findEmpty(grid);
        if (index === -1) return true; // Tabuleiro completo!

        for (let val = 1; val <= 9; val++) {
            if (this.isValid(grid, index, val)) {
                grid[index] = val;
                if (this.solve(grid)) return true;
                grid[index] = 0; // Backtrack
            }
        }
        return false;
    }

    /**
     * Conta a quantidade de soluções possíveis para um tabuleiro (usado para garantir solução única).
     * @param {Array} grid Tabuleiro.
     * @param {number} limit Limite de contagem (geralmente paramos em 2 para otimizar).
     * @returns {number} Número de soluções encontradas.
     */
    static countSolutions(grid, limit = 2) {
        let count = 0;

        const solveHelper = (g) => {
            if (count >= limit) return;

            const index = this.findEmpty(g);
            if (index === -1) {
                count++;
                return;
            }

            for (let val = 1; val <= 9; val++) {
                if (this.isValid(g, index, val)) {
                    g[index] = val;
                    solveHelper(g);
                    g[index] = 0; // Backtrack
                }
            }
        };

        const gridCopy = [...grid];
        solveHelper(gridCopy);
        return count;
    }

    /**
     * Embarraalha um array de forma aleatória ou controlada por semente.
     */
    static shuffle(array, randomFn = Math.random) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(randomFn() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Gera um tabuleiro de Sudoku completo e válido com números aleatórios.
     */
    static generateFullGrid(randomFn = Math.random) {
        const grid = new Array(81).fill(0);

        const fillGrid = (g) => {
            const index = this.findEmpty(g);
            if (index === -1) return true;

            const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
            this.shuffle(numbers, randomFn);

            for (const val of numbers) {
                if (this.isValid(g, index, val)) {
                    g[index] = val;
                    if (fillGrid(g)) return true;
                    g[index] = 0;
                }
            }
            return false;
        };

        fillGrid(grid);
        return grid;
    }

    /**
     * Remove números de um tabuleiro completo mantendo a unicidade da solução.
     * @param {Array} fullGrid Tabuleiro completo resolvido.
     * @param {number} targetClues Quantidade de pistas (dicas) que devem sobrar.
     * @param {function} randomFn Função geradora de números aleatórios.
     * @returns {Array} Tabuleiro gerado (com 0s nas células vazias).
     */
    static createPuzzle(fullGrid, targetClues, randomFn = Math.random) {
        const puzzle = [...fullGrid];
        const cellIndices = Array.from({ length: 81 }, (_, i) => i);
        this.shuffle(cellIndices, randomFn);

        let cluesRemoved = 0;
        const maxRemoval = 81 - targetClues;

        for (const index of cellIndices) {
            if (cluesRemoved >= maxRemoval) break;

            const temp = puzzle[index];
            puzzle[index] = 0;

            // Se a remoção criar múltiplas soluções, recoloca o número
            if (this.countSolutions(puzzle, 2) !== 1) {
                puzzle[index] = temp;
            } else {
                cluesRemoved++;
            }
        }

        return puzzle;
    }

    /**
     * Gera um novo jogo completo (original, gabarito e semente opcional).
     * @param {string|number} difficulty Dificuldade (easy, medium, hard, expert, ou número da fase de campanha).
     * @param {number} [seed] Semente de geração diária opcional.
     * @returns {Object} { puzzleGrid, solvedGrid }
     */
    static generateGame(difficulty, seed = null) {
        const randomFn = seed !== null ? this.getPRNG(seed) : Math.random;
        const solvedGrid = this.generateFullGrid(randomFn);
        
        let targetClues = 35; // Padrão Médio
        
        if (typeof difficulty === 'number') {
            // Campanha: Dificuldade Gradual (Nível 1 a 100)
            // Nível 1: 48 pistas (muito fácil)
            // Nível 100: 18 pistas (extremamente difícil, perto do limite teórico de 17)
            const level = Math.max(1, Math.min(100, difficulty));
            const range = 48 - 18; // Diferença de 30 pistas
            const fraction = (level - 1) / 99; // 0 no lvl 1, 1 no lvl 100
            targetClues = Math.round(48 - (fraction * range));
        } else {
            // Clássico
            switch (difficulty) {
                case 'easy':
                    targetClues = 43; // 40 a 45
                    break;
                case 'medium':
                    targetClues = 33; // 32 a 35
                    break;
                case 'hard':
                    targetClues = 27; // 26 a 29
                    break;
                case 'expert':
                    targetClues = 22; // 21 a 24
                    break;
                default:
                    targetClues = 33;
            }
        }

        const puzzleGrid = this.createPuzzle(solvedGrid, targetClues, randomFn);

        return {
            puzzleGrid,
            solvedGrid
        };
    }
}

/**
 * Representa uma partida ativa de Sudoku.
 */
class SudokuGame {
    constructor(mode, difficulty, savedState = null) {
        this.mode = mode; // 'classic', 'campaign', 'daily'
        this.difficulty = difficulty; // 'easy', 'medium', 'hard', 'expert' ou número da fase
        
        if (savedState) {
            this.loadFromState(savedState);
        } else {
            this.initNewGame();
        }
    }

    /**
     * Inicializa uma nova partida do zero.
     */
    initNewGame() {
        let seed = null;
        if (this.mode === 'daily') {
            // Semente baseada na data YYYYMMDD
            const d = new Date();
            seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
        }

        const { puzzleGrid, solvedGrid } = SudokuEngine.generateGame(this.difficulty, seed);

        this.originalGrid = [...puzzleGrid]; // Pistas fixas originais (nunca mudam)
        this.currentGrid = [...puzzleGrid];  // Estado atual do tabuleiro
        this.solvedGrid = [...solvedGrid];   // Gabarito correto
        
        // Inicializar anotações de lápis (grid de 81 arrays, um para cada célula, contendo valores 1-9)
        this.notes = Array.from({ length: 81 }, () => new Array(9).fill(false));
        
        this.mistakes = 0;
        this.timer = 0; // segundos
        this.history = []; // Pilha de ações para Desfazer: { index, oldVal, newVal, oldNotes, newNotes }
        this.isPaused = false;
        this.isFinished = false;
        this.startTime = Date.now();
    }

    /**
     * Restaura o estado salvo do LocalStorage.
     */
    loadFromState(state) {
        this.originalGrid = state.originalGrid;
        this.currentGrid = state.currentGrid;
        this.solvedGrid = state.solvedGrid;
        this.notes = state.notes;
        this.mistakes = state.mistakes;
        this.timer = state.timer || 0;
        this.history = state.history || [];
        this.isPaused = state.isPaused || false;
        this.isFinished = state.isFinished || false;
        this.startTime = Date.now() - (this.timer * 1000); // Ajusta o tempo de início baseado no timer
    }

    /**
     * Exporta o estado atual para ser salvo.
     */
    saveState() {
        return {
            mode: this.mode,
            difficulty: this.difficulty,
            originalGrid: this.originalGrid,
            currentGrid: this.currentGrid,
            solvedGrid: this.solvedGrid,
            notes: this.notes,
            mistakes: this.mistakes,
            timer: this.timer,
            history: this.history,
            isPaused: this.isPaused,
            isFinished: this.isFinished
        };
    }

    /**
     * Executa a jogada de inserir um número na célula.
     * @param {number} index Célula alvo (0-80).
     * @param {number} val Número inserido (1-9).
     * @param {boolean} isNoteMode Se está escrevendo anotações (lápis) ou número definitivo.
     * @returns {Object} Resultado do movimento: { success: boolean, isError: boolean, isGameOver: boolean, isWin: boolean }
     */
    makeMove(index, val, isNoteMode = false) {
        // Ignorar se a célula for uma pista original ou se o jogo acabou
        if (this.originalGrid[index] !== 0 || this.isFinished || this.isPaused) {
            return { success: false };
        }

        const oldVal = this.currentGrid[index];
        const oldNotes = [...this.notes[index]];

        if (isNoteMode) {
            // Modo Anotação: não insere valor definitivo, apenas liga/desliga anotação do número
            if (oldVal !== 0) {
                // Se a célula já tiver um valor definitivo, ignorar notas
                return { success: false };
            }
            
            // Alternar valor da anotação
            this.notes[index][val - 1] = !this.notes[index][val - 1];
            
            // Gravar histórico
            this.history.push({
                index,
                oldVal,
                newVal: 0,
                oldNotes,
                newNotes: [...this.notes[index]]
            });

            return { success: true, isNoteUpdate: true };
        } else {
            // Modo Valor Definitivo
            // Se já tem o mesmo valor inserido, limpa a célula (toggle behavior)
            const targetVal = oldVal === val ? 0 : val;
            
            // Se colocar um valor, limpar notas dessa célula
            const newNotes = new Array(9).fill(false);

            this.currentGrid[index] = targetVal;
            this.notes[index] = newNotes;

            let isError = false;
            let isGameOver = false;

            if (targetVal !== 0) {
                // Verificar erro comparando com o gabarito (Sudoku sempre tem solução única)
                if (targetVal !== this.solvedGrid[index]) {
                    isError = true;
                    this.mistakes++;
                }
            }

            // Registrar histórico
            this.history.push({
                index,
                oldVal,
                newVal: targetVal,
                oldNotes,
                newNotes
            });

            // Limpar automaticamente anotações equivalentes na mesma linha, coluna e bloco
            if (targetVal !== 0 && !isError) {
                this.clearRowColBlockNotes(index, targetVal);
            }

            // Verificar se o tabuleiro foi preenchido corretamente
            const isWin = this.checkWinCondition();
            if (isWin) {
                this.isFinished = true;
            }

            return {
                success: true,
                isNoteUpdate: false,
                newVal: targetVal,
                isError,
                isWin
            };
        }
    }

    /**
     * Limpa a célula (apagador).
     */
    eraseCell(index) {
        if (this.originalGrid[index] !== 0 || this.isFinished || this.isPaused) {
            return { success: false };
        }

        const oldVal = this.currentGrid[index];
        const oldNotes = [...this.notes[index]];

        // Limpar tudo
        this.currentGrid[index] = 0;
        this.notes[index] = new Array(9).fill(false);

        this.history.push({
            index,
            oldVal,
            newVal: 0,
            oldNotes,
            newNotes: this.notes[index]
        });

        return { success: true };
    }

    /**
     * Desfaz a última ação realizada.
     */
    undo() {
        if (this.history.length === 0 || this.isFinished || this.isPaused) {
            return { success: false };
        }

        const lastAction = this.history.pop();
        const { index, oldVal, oldNotes } = lastAction;

        this.currentGrid[index] = oldVal;
        this.notes[index] = [...oldNotes];

        return {
            success: true,
            index,
            val: oldVal,
            notes: this.notes[index]
        };
    }

    /**
     * Concede uma dica: preenche a célula selecionada com a resposta correta do gabarito.
     * @param {number} index Índice da célula selecionada.
     * @returns {Object} Resultado do movimento de dica.
     */
    getHint(index) {
        if (index < 0 || index > 80 || this.originalGrid[index] !== 0 || this.isFinished || this.isPaused) {
            return { success: false };
        }

        const correctVal = this.solvedGrid[index];
        const oldVal = this.currentGrid[index];

        // Se a célula já estiver preenchida corretamente com o gabarito, não gastamos dica
        if (oldVal === correctVal) {
            return { success: false, alreadyCorrect: true };
        }

        const oldNotes = [...this.notes[index]];
        const newNotes = new Array(9).fill(false);

        // Preenche com o gabarito
        this.currentGrid[index] = correctVal;
        this.notes[index] = newNotes;

        this.history.push({
            index,
            oldVal,
            newVal: correctVal,
            oldNotes,
            newNotes
        });

        // Limpa notas correspondentes na linha, coluna e bloco
        this.clearRowColBlockNotes(index, correctVal);

        const isWin = this.checkWinCondition();
        if (isWin) {
            this.isFinished = true;
        }

        return {
            success: true,
            index,
            val: correctVal,
            isWin
        };
    }

    /**
     * Limpa anotações do número inserido na linha, coluna e bloco correspondente.
     */
    clearRowColBlockNotes(index, val) {
        const row = Math.floor(index / 9);
        const col = index % 9;

        // Limpar Linha
        for (let i = 0; i < 9; i++) {
            const idx = row * 9 + i;
            if (idx !== index) this.notes[idx][val - 1] = false;
        }

        // Limpar Coluna
        for (let i = 0; i < 9; i++) {
            const idx = i * 9 + col;
            if (idx !== index) this.notes[idx][val - 1] = false;
        }

        // Limpar Bloco 3x3
        const boxRowStart = Math.floor(row / 3) * 3;
        const boxColStart = Math.floor(col / 3) * 3;
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                const idx = (boxRowStart + r) * 9 + (boxColStart + c);
                if (idx !== index) this.notes[idx][val - 1] = false;
            }
        }
    }

    /**
     * Verifica se o tabuleiro foi preenchido totalmente e sem erros de acordo com o gabarito.
     */
    checkWinCondition() {
        for (let i = 0; i < 81; i++) {
            if (this.currentGrid[i] !== this.solvedGrid[i]) {
                return false;
            }
        }
        return true;
    }

    /**
     * Incrementa o tempo de jogo.
     */
    incrementTimer() {
        if (!this.isPaused && !this.isFinished) {
            this.timer = Math.floor((Date.now() - this.startTime) / 1000);
        }
        return this.timer;
    }
}
