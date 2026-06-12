/**
 * Sudoku Quest - Gerenciador de Interface e Eventos (js/ui.js)
 * Desenha a grade, atualiza atalhos, cronômetro, modais, conquistas, temas e confetes.
 */

class UIManager {
    constructor() {
        this.game = null;
        this.selectedCellIndex = -1;
        this.isNoteMode = false;
        this.activeNumber = -1; // Mantém o número travado no modo anotações (lápis)
        this.timerInterval = null;
        this.confettiActive = false;
        
        // Configurações ativas na interface
        this.settings = StorageManager.getSettings();
        
        this.cacheDOM();
        this.bindEvents();
        this.initTheme();
        this.syncSettingsUI();
    }

    /**
     * Cacheia os elementos DOM importantes para acesso rápido.
     */
    cacheDOM() {
        this.boardEl = document.getElementById('sudoku-board');
        this.keypadEl = document.getElementById('keypad');
        this.timerEl = document.getElementById('game-timer');
        this.timerWrapper = document.getElementById('timer-wrapper');
        this.mistakesEl = document.getElementById('mistakes-count');
        this.mistakesWrapper = document.getElementById('mistakes-wrapper');
        this.notesIndicator = document.getElementById('notes-indicator');
        this.profileBtn = document.getElementById('profile-button');
        
        // Detalhes do Perfil no Topo
        this.levelBadge = document.getElementById('player-level-badge');
        this.rankName = document.getElementById('player-rank-name');
        this.xpFill = document.getElementById('player-xp-fill');
        
        // Botões de Ações do Sudoku
        this.btnUndo = document.getElementById('btn-undo');
        this.btnErase = document.getElementById('btn-erase');
        this.btnNotes = document.getElementById('btn-notes');
        this.btnHint = document.getElementById('btn-hint');
        this.btnPause = document.getElementById('btn-pause');
        this.btnResume = document.getElementById('btn-resume');
        this.pauseOverlay = document.getElementById('pause-overlay');
        
        // Botões de Menus do Topo
        this.btnStats = document.getElementById('btn-stats');
        this.btnSettings = document.getElementById('btn-settings');
        this.btnHelp = document.getElementById('btn-help');
        this.btnOpenModes = document.getElementById('btn-open-modes');
        
        // Modais
        this.modalModes = document.getElementById('modal-modes');
        this.modalStats = document.getElementById('modal-stats');
        this.modalSettings = document.getElementById('modal-settings');
        this.modalHelp = document.getElementById('modal-help');
        this.modalGameOver = document.getElementById('modal-gameover');
        
        // Abas no seletor de modo
        this.tabBtns = document.querySelectorAll('#modal-modes .tab-btn');
        this.tabContents = document.querySelectorAll('#modal-modes .tab-content');
        
        // Diário
        this.dailyChallengeDate = document.getElementById('daily-challenge-date');
        this.dailyChallengeStatus = document.getElementById('daily-challenge-status');
        this.btnStartDaily = document.getElementById('btn-start-daily');
        
        // Estatísticas
        this.statGamesPlayed = document.getElementById('stat-games-played');
        this.statWinRate = document.getElementById('stat-win-rate');
        this.statWinStreak = document.getElementById('stat-win-streak');
        this.statMaxStreak = document.getElementById('stat-max-streak');
        this.achievementsContainer = document.getElementById('achievements-container');
        this.campaignLevelsContainer = document.getElementById('campaign-levels-container');
        
        // GameOver Modal Details
        this.goTitle = document.getElementById('gameover-title');
        this.goMessage = document.getElementById('gameover-message');
        this.goMode = document.getElementById('go-stat-mode');
        this.goTime = document.getElementById('go-stat-time');
        this.goMistakes = document.getElementById('go-stat-mistakes');
        this.goXPGain = document.getElementById('go-xp-gain');
        this.goXPBarFill = document.getElementById('go-xp-bar-fill');
        this.goLevelCurrent = document.getElementById('go-level-current');
        this.goLevelNext = document.getElementById('go-level-next');
        this.levelUpAlert = document.getElementById('level-up-alert');
        this.levelUpNewVal = document.getElementById('level-up-new-val');
        this.btnGoRestart = document.getElementById('btn-go-restart');
        this.btnGoHome = document.getElementById('btn-go-home');
        
        // Canvas Confete
        this.confettiCanvas = document.getElementById('confetti-canvas');
    }

    /**
     * Registra escutas de eventos.
     */
    bindEvents() {
        // Cliques em Modais (Fechar clicando no X ou fora do card)
        const closeBtns = document.querySelectorAll('.close-modal-btn');
        closeBtns.forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        const overlays = [this.modalModes, this.modalStats, this.modalSettings, this.modalHelp];
        overlays.forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.closeAllModals();
            });
        });

        // Eventos dos botões do cabeçalho
        this.btnStats.addEventListener('click', () => this.openStatsModal());
        this.profileBtn.addEventListener('click', () => this.openStatsModal());
        this.btnSettings.addEventListener('click', () => this.openSettingsModal());
        this.btnHelp.addEventListener('click', () => this.modalHelp.classList.remove('hidden'));
        this.btnOpenModes.addEventListener('click', () => this.openModesModal());

        // Controle de Abas no Modal de Modos
        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.tabBtns.forEach(b => b.classList.remove('active'));
                this.tabContents.forEach(c => c.classList.add('hidden'));
                
                btn.classList.add('active');
                const targetId = btn.getAttribute('data-tab');
                document.getElementById(targetId).classList.remove('hidden');
            });
        });

        // Configuração de Dificuldade Clássica
        const diffBtns = document.querySelectorAll('.diff-btn');
        diffBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const diff = btn.getAttribute('data-diff');
                this.startNewGame('classic', diff);
                this.closeAllModals();
            });
        });

        // Configuração de Desafio Diário
        this.btnStartDaily.addEventListener('click', () => {
            this.startNewGame('daily', 'medium');
            this.closeAllModals();
        });

        // Teclado Numérico Virtual (com suporte a toque, clique e pressionamento longo)
        const keys = this.keypadEl.querySelectorAll('.key-btn');
        keys.forEach(keyBtn => {
            const val = parseInt(keyBtn.getAttribute('data-val'));
            let holdTimer = null;
            let longPressedTriggered = false;

            const startPress = (e) => {
                if (keyBtn.classList.contains('completed-key') || this.game.isFinished || this.game.isPaused) return;
                longPressedTriggered = false;
                
                // Configura o timer para clique longo (500ms)
                holdTimer = setTimeout(() => {
                    this.handleKeypadLongPress(val);
                    longPressedTriggered = true;
                }, 500);
            };

            const endPress = (e) => {
                if (holdTimer) {
                    clearTimeout(holdTimer);
                    holdTimer = null;
                }
                
                if (!longPressedTriggered && !keyBtn.classList.contains('completed-key')) {
                    // Foi um clique rápido normal
                    this.handleKeypadClick(val);
                }
                
                // Evita cliques fantasmas no celular
                if (e.cancelable) {
                    e.preventDefault();
                }
            };

            // Eventos para Desktop
            keyBtn.addEventListener('mousedown', startPress);
            keyBtn.addEventListener('mouseup', endPress);
            keyBtn.addEventListener('mouseleave', () => {
                if (holdTimer) {
                    clearTimeout(holdTimer);
                    holdTimer = null;
                }
            });

            // Eventos para Celulares (Mobile First)
            keyBtn.addEventListener('touchstart', startPress, { passive: true });
            keyBtn.addEventListener('touchend', endPress);
        });

        // Ações Rápidas do Tabuleiro
        this.btnUndo.addEventListener('click', () => this.handleUndo());
        this.btnErase.addEventListener('click', () => this.handleErase());
        this.btnNotes.addEventListener('click', () => this.toggleNotesMode());
        this.btnHint.addEventListener('click', () => this.handleHint());

        // Pausa
        this.btnPause.addEventListener('click', () => this.togglePause(true));
        this.btnResume.addEventListener('click', () => this.togglePause(false));

        // Toggles das Configurações
        document.getElementById('set-auto-check').addEventListener('change', (e) => {
            this.settings.autoCheck = e.target.checked;
            StorageManager.saveSettings(this.settings);
            this.renderBoard(); // Redesenha para limpar/aplicar marcações de erro
        });

        document.getElementById('set-mistake-limit').addEventListener('change', (e) => {
            this.settings.mistakeLimit = e.target.checked;
            StorageManager.saveSettings(this.settings);
            this.updateMistakesUI();
        });

        document.getElementById('set-highlight-same').addEventListener('change', (e) => {
            this.settings.highlightSame = e.target.checked;
            StorageManager.saveSettings(this.settings);
            this.highlightCells();
        });

        document.getElementById('set-highlight-area').addEventListener('change', (e) => {
            this.settings.highlightArea = e.target.checked;
            StorageManager.saveSettings(this.settings);
            this.highlightCells();
        });

        document.getElementById('set-show-timer').addEventListener('change', (e) => {
            this.settings.showTimer = e.target.checked;
            StorageManager.saveSettings(this.settings);
            if (this.settings.showTimer) {
                this.timerWrapper.classList.remove('hidden');
            } else {
                this.timerWrapper.classList.add('hidden');
            }
        });

        // Seletor de Temas
        const themeOpts = document.querySelectorAll('.theme-option');
        themeOpts.forEach(opt => {
            opt.addEventListener('click', () => {
                themeOpts.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                const themeName = opt.getAttribute('data-theme');
                this.applyTheme(themeName);
            });
        });

        // Cliques em botões de Fim de Jogo
        this.btnGoRestart.addEventListener('click', () => {
            this.modalGameOver.classList.add('hidden');
            this.startNewGame(this.game.mode, this.game.difficulty);
        });

        this.btnGoHome.addEventListener('click', () => {
            this.modalGameOver.classList.add('hidden');
            this.openModesModal();
        });

        // Entrada do Teclado Físico
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    // ==================== INICIALIZAÇÃO DE TEMAS E CONFIGURAÇÕES ====================

    initTheme() {
        const theme = this.settings.theme || 'dark';
        this.applyTheme(theme);
        
        // Ativar botão correto nas configs
        const activeOpt = document.querySelector(`.theme-option[data-theme="${theme}"]`);
        if (activeOpt) {
            document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('active'));
            activeOpt.classList.add('active');
        }
    }

    applyTheme(themeName) {
        document.body.className = ''; // Limpa classes do body
        document.body.classList.add(`theme-${themeName}`);
        this.settings.theme = themeName;
        StorageManager.saveSettings(this.settings);
    }

    syncSettingsUI() {
        document.getElementById('set-auto-check').checked = this.settings.autoCheck;
        document.getElementById('set-mistake-limit').checked = this.settings.mistakeLimit;
        document.getElementById('set-highlight-same').checked = this.settings.highlightSame;
        document.getElementById('set-highlight-area').checked = this.settings.highlightArea;
        document.getElementById('set-show-timer').checked = this.settings.showTimer;

        if (this.settings.showTimer) {
            this.timerWrapper.classList.remove('hidden');
        } else {
            this.timerWrapper.classList.add('hidden');
        }
    }

    /**
     * Atualiza os destaques visuais do teclado numérico para refletir o número travado.
     */
    updateKeypadActiveUI() {
        const keys = this.keypadEl.querySelectorAll('.key-btn');
        keys.forEach(k => {
            const val = parseInt(k.getAttribute('data-val'));
            if (this.activeNumber === val) {
                k.classList.add('active-number');
            } else {
                k.classList.remove('active-number');
            }
        });
    }

    /**
     * Trata o clique rápido normal no botão do teclado numérico.
     */
    handleKeypadClick(val) {
        if (this.game.isFinished || this.game.isPaused) return;

        // Se estiver no modo Notas, o clique rápido trava o número para notas
        if (this.isNoteMode) {
            if (this.activeNumber === val) {
                // Clique rápido no mesmo número travado: NÃO destrava. Apenas insere nota se houver célula selecionada
                if (this.selectedCellIndex !== -1) {
                    this.handleNumberInput(val);
                }
            } else {
                this.activeNumber = val; // Trava o novo número selecionado (transfere a trava)
                if (this.selectedCellIndex !== -1) {
                    this.handleNumberInput(val);
                }
            }
            this.updateKeypadActiveUI();
        } else {
            // Se algum número já está travado
            if (this.activeNumber !== -1) {
                if (this.activeNumber === val) {
                    // Clique rápido no mesmo número travado: NÃO destrava. Apenas insere na célula selecionada
                    if (this.selectedCellIndex !== -1) {
                        this.handleNumberInput(val);
                    }
                } else {
                    // Clique rápido em OUTRO número: transfere a trava para o novo número, SEM inserir imediatamente
                    this.activeNumber = val;
                }
                this.updateKeypadActiveUI();
            } else {
                // Comportamento normal sem trava: apenas insere na célula selecionada
                this.handleNumberInput(val);
            }
        }
    }

    /**
     * Trata o pressionamento longo (Hold) no botão do teclado numérico.
     * Trava o número para inserção em massa tanto no modo normal quanto anotações.
     */
    handleKeypadLongPress(val) {
        if (this.game.isFinished || this.game.isPaused) return;

        // Vibração física rápida no celular para indicar que travou/destravou (feedback premium)
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }

        if (this.activeNumber === val) {
            this.activeNumber = -1; // SÓ destrava se o botão for segurado de novo pelo tempo do clique longo!
        } else {
            this.activeNumber = val; // Trava o número
            // NÃO insere imediatamente na célula selecionada para evitar erros acidentais
        }
        
        this.updateKeypadActiveUI();
    }

    /**
     * Verifica quais números de 1 a 9 foram adicionados corretamente em todos os 9 lugares
     * e desativa/inativa as respectivas teclas do teclado numérico.
     */
    updateCompletedNumbers() {
        if (!this.game) return;
        const counts = new Array(10).fill(0);

        // Conta quantos números estão posicionados CORRETAMENTE
        for (let i = 0; i < 81; i++) {
            const currentVal = this.game.currentGrid[i];
            const solvedVal = this.game.solvedGrid[i];
            
            // Um número está correto se ele é igual ao gabarito resolvido
            if (currentVal !== 0 && currentVal === solvedVal) {
                counts[currentVal]++;
            }
        }

        // Atualiza o teclado
        for (let num = 1; num <= 9; num++) {
            const keyBtn = this.keypadEl.querySelector(`.key-btn[data-val="${num}"]`);
            if (!keyBtn) continue;

            if (counts[num] === 9) {
                // Número completo! Fica inativo no teclado
                keyBtn.classList.add('completed-key');
                keyBtn.disabled = true;

                // Se o número concluído era o número travado ativo, destrava ele
                if (this.activeNumber === num) {
                    this.activeNumber = -1;
                    this.updateKeypadActiveUI();
                }
            } else {
                // Caso contrário, garante que está ativo
                keyBtn.classList.remove('completed-key');
                keyBtn.disabled = false;
            }
        }
    }

    // ==================== CONTROLE DO JOGO E TABULEIRO ====================

    /**
     * Vincula uma instância de SudokuGame ao UIManager.
     */
    setGame(game) {
        this.game = game;
        this.selectedCellIndex = -1;
        this.isNoteMode = false;
        this.activeNumber = -1; // Limpa o número travado anterior
        this.notesIndicator.classList.remove('active');
        this.notesIndicator.innerText = 'OFF';
        this.btnNotes.classList.remove('active');
        this.updateKeypadActiveUI(); // Limpa visual do teclado
        
        this.updateHeaderProfile();
        this.updateStatusUI();
        this.renderBoard();
        this.updateCompletedNumbers(); // Inativa números completos na carga inicial
        this.startTimer();
        
        if (this.game.isPaused) {
            this.togglePause(true);
        } else {
            this.togglePause(false);
        }

        // Salva estado inicial imediatamente no auto-save
        StorageManager.saveActiveGame(this.game.saveState());
    }

    /**
     * Inicia uma nova partida configurada.
     */
    startNewGame(mode, difficulty) {
        const game = new SudokuGame(mode, difficulty);
        this.setGame(game);
    }

    /**
     * Desenha a grade 9x9 e popula com os valores/anotações correspondentes.
     */
    renderBoard() {
        this.boardEl.innerHTML = '';
        
        for (let i = 0; i < 81; i++) {
            const cellVal = this.game.currentGrid[i];
            const isClue = this.game.originalGrid[i] !== 0;
            
            const cellEl = document.createElement('div');
            cellEl.className = 'sudoku-cell';
            cellEl.setAttribute('data-index', i);
            cellEl.setAttribute('role', 'gridcell');

            if (isClue) {
                cellEl.classList.add('clue');
            } else if (cellVal !== 0) {
                cellEl.classList.add('user-entered');
            }

            // Criar container de valor principal
            const valEl = document.createElement('div');
            valEl.className = 'cell-value';
            
            if (cellVal !== 0) {
                valEl.innerText = cellVal;
                
                // Exibe erro imediatamente se Auto-Check estiver ativo
                if (this.settings.autoCheck && !isClue && cellVal !== this.game.solvedGrid[i]) {
                    cellEl.classList.add('invalid');
                }
            }
            cellEl.appendChild(valEl);

            // Criar grade de anotações (pencil marks)
            const notesGrid = document.createElement('div');
            notesGrid.className = 'cell-notes-grid';
            
            // Só exibe anotações se a célula não tiver valor definitivo
            if (cellVal === 0) {
                for (let n = 1; n <= 9; n++) {
                    const spot = document.createElement('div');
                    spot.className = 'note-spot';
                    if (this.game.notes[i][n - 1]) {
                        spot.innerText = n;
                    }
                    notesGrid.appendChild(spot);
                }
            }
            cellEl.appendChild(notesGrid);

            // Evento de seleção da célula
            cellEl.addEventListener('click', () => this.selectCell(i));

            this.boardEl.appendChild(cellEl);
        }

        this.highlightCells();
    }

    /**
     * Atualiza as anotações visuais de uma célula específica para otimizar renderizações.
     */
    renderCellNotes(index) {
        const cellEl = this.boardEl.querySelector(`[data-index="${index}"]`);
        if (!cellEl) return;

        const notesGrid = cellEl.querySelector('.cell-notes-grid');
        if (!notesGrid) return;

        notesGrid.innerHTML = '';
        for (let n = 1; n <= 9; n++) {
            const spot = document.createElement('div');
            spot.className = 'note-spot';
            if (this.game.notes[index][n - 1]) {
                spot.innerText = n;
            }
            notesGrid.appendChild(spot);
        }
    }

    /**
     * Executa a seleção de uma célula na tela.
     */
    selectCell(index) {
        if (this.game.isFinished || this.game.isPaused) return;

        this.selectedCellIndex = index;
        
        // Atualiza estilo nas células
        const cells = this.boardEl.querySelectorAll('.sudoku-cell');
        cells.forEach(c => c.classList.remove('selected'));

        const targetCell = this.boardEl.querySelector(`[data-index="${index}"]`);
        if (targetCell) {
            targetCell.classList.add('selected');
        }

        // Se houver um número travado (activeNumber), insere-o imediatamente na célula
        if (this.activeNumber !== -1 && this.game.originalGrid[index] === 0) {
            if (this.isNoteMode) {
                // No modo anotações, só insere nota se a célula não tiver valor definitivo
                if (this.game.currentGrid[index] === 0) {
                    this.handleNumberInput(this.activeNumber);
                } else {
                    this.highlightCells();
                }
            } else {
                // No modo normal, insere o valor na célula
                this.handleNumberInput(this.activeNumber);
            }
        } else {
            this.highlightCells();
        }
    }

    /**
     * Destaca linha, coluna, bloco 3x3 e números idênticos ao selecionado.
     */
    highlightCells() {
        const cells = this.boardEl.querySelectorAll('.sudoku-cell');
        
        // Limpar destaques anteriores
        cells.forEach(c => {
            c.classList.remove('highlighted', 'same-number');
        });

        if (this.selectedCellIndex === -1) return;

        const index = this.selectedCellIndex;
        const row = Math.floor(index / 9);
        const col = index % 9;
        const selectedVal = this.game.currentGrid[index];

        for (let i = 0; i < 81; i++) {
            if (i === index) continue;

            const cRow = Math.floor(i / 9);
            const cCol = i % 9;
            const cVal = this.game.currentGrid[i];

            // 1. Destacar Área (Mesma linha, coluna ou bloco)
            if (this.settings.highlightArea) {
                const sameRow = cRow === row;
                const sameCol = cCol === col;
                const sameBox = Math.floor(cRow / 3) === Math.floor(row / 3) && Math.floor(cCol / 3) === Math.floor(col / 3);

                if (sameRow || sameCol || sameBox) {
                    cells[i].classList.add('highlighted');
                }
            }

            // 2. Destacar Números Iguais
            if (this.settings.highlightSame && selectedVal !== 0 && cVal === selectedVal) {
                cells[i].classList.add('same-number');
            }
        }
    }

    // ==================== ENTRADAS E AÇÕES DE COMANDO ====================

    /**
     * Processa a inserção do número na célula atualmente selecionada.
     */
    handleNumberInput(val) {
        if (this.selectedCellIndex === -1 || this.game.isFinished || this.game.isPaused) return;

        const index = this.selectedCellIndex;
        const res = this.game.makeMove(index, val, this.isNoteMode);

        if (!res.success) return;

        const cellEl = this.boardEl.querySelector(`[data-index="${index}"]`);
        
        if (res.isNoteUpdate) {
            // Apenas atualiza anotações
            this.renderCellNotes(index);
        } else {
            // Inseriu número definitivo
            const valEl = cellEl.querySelector('.cell-value');
            
            if (res.newVal !== 0) {
                valEl.innerText = res.newVal;
                valEl.className = 'cell-value cell-value-pop';
                
                // Remover notes visíveis
                const notesGrid = cellEl.querySelector('.cell-notes-grid');
                if (notesGrid) notesGrid.innerHTML = '';
                
                cellEl.classList.remove('clue');
                cellEl.classList.add('user-entered');

                // Validar erro
                if (res.isError) {
                    cellEl.classList.add('invalid', 'invalid-shake');
                    // Remove animação de tremer após 300ms
                    setTimeout(() => {
                        cellEl.classList.remove('invalid-shake');
                    }, 300);
                    
                    this.updateMistakesUI();
                    
                    // Condição de Derrota por Limite de Erros
                    if (this.settings.mistakeLimit && this.game.mistakes >= 3) {
                        this.triggerGameOver(false);
                    }
                } else {
                    cellEl.classList.remove('invalid');
                    // Limpa notas da linha/col/bloco que foram afetadas
                    this.cleanRelatedNotesOnBoard(index, val);
                }
            } else {
                // Efeito de toggle limpou a célula
                valEl.innerText = '';
                cellEl.classList.remove('user-entered', 'invalid');
                // Restaura visualizador de notas
                this.renderCellNotes(index);
            }
        }

        this.updateCompletedNumbers(); // Inativa números completos no teclado
        this.highlightCells();
        
        // Auto-save a cada jogada
        StorageManager.saveActiveGame(this.game.saveState());

        // Condição de Vitória
        if (res.isWin) {
            this.triggerGameOver(true);
        }
    }

    /**
     * Limpa anotações em outras células após uma jogada definitiva válida (sincroniza a grade visual).
     */
    cleanRelatedNotesOnBoard(index, val) {
        const row = Math.floor(index / 9);
        const col = index % 9;

        const checkAndClean = (idx) => {
            if (this.game.currentGrid[idx] === 0) {
                this.renderCellNotes(idx);
            }
        };

        // Limpar Linha e Coluna
        for (let i = 0; i < 9; i++) {
            checkAndClean(row * 9 + i);
            checkAndClean(i * 9 + col);
        }

        // Limpar Bloco 3x3
        const boxRowStart = Math.floor(row / 3) * 3;
        const boxColStart = Math.floor(col / 3) * 3;
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                checkAndClean((boxRowStart + r) * 9 + (boxColStart + c));
            }
        }
    }

    /**
     * Apaga o valor/notas da célula selecionada.
     */
    handleErase() {
        if (this.selectedCellIndex === -1 || this.game.isFinished || this.game.isPaused) return;

        const index = this.selectedCellIndex;
        const res = this.game.eraseCell(index);

        if (res.success) {
            const cellEl = this.boardEl.querySelector(`[data-index="${index}"]`);
            const valEl = cellEl.querySelector('.cell-value');
            valEl.innerText = '';
            cellEl.classList.remove('user-entered', 'invalid');
            
            // Destrava o número selecionado no teclado
            this.activeNumber = -1;
            this.updateKeypadActiveUI();

            this.renderCellNotes(index);
            this.updateCompletedNumbers(); // Atualiza números completos no teclado
            this.highlightCells();
            
            StorageManager.saveActiveGame(this.game.saveState());
        }
    }

    /**
     * Desfaz a última ação realizada.
     */
    handleUndo() {
        if (this.game.isFinished || this.game.isPaused) return;

        const res = this.game.undo();
        if (res.success) {
            this.selectedCellIndex = res.index;
            
            // Destrava o número selecionado no teclado
            this.activeNumber = -1;
            this.updateKeypadActiveUI();

            // Re-renderiza a célula modificada
            const cellEl = this.boardEl.querySelector(`[data-index="${res.index}"]`);
            const valEl = cellEl.querySelector('.cell-value');
            
            if (res.val !== 0) {
                valEl.innerText = res.val;
                cellEl.classList.add('user-entered');
                
                // Se auto-check estiver ativo, valida novamente
                if (this.settings.autoCheck && res.val !== this.game.solvedGrid[res.index]) {
                    cellEl.classList.add('invalid');
                } else {
                    cellEl.classList.remove('invalid');
                }
                
                const notesGrid = cellEl.querySelector('.cell-notes-grid');
                if (notesGrid) notesGrid.innerHTML = '';
            } else {
                valEl.innerText = '';
                cellEl.classList.remove('user-entered', 'invalid');
                this.renderCellNotes(res.index);
            }

            // Seleciona a célula desfeita
            const allCells = this.boardEl.querySelectorAll('.sudoku-cell');
            allCells.forEach(c => c.classList.remove('selected'));
            cellEl.classList.add('selected');

            this.updateCompletedNumbers(); // Atualiza números completos no teclado
            this.highlightCells();
            this.updateMistakesUI(); // Recalcula se o erro foi desfeito
            
            StorageManager.saveActiveGame(this.game.saveState());
        }
    }

    /**
     * Concede uma dica ao jogador na célula selecionada.
     */
    handleHint() {
        if (this.selectedCellIndex === -1 || this.game.isFinished || this.game.isPaused) return;

        const index = this.selectedCellIndex;
        const res = this.game.getHint(index);

        if (res.success) {
            const cellEl = this.boardEl.querySelector(`[data-index="${index}"]`);
            const valEl = cellEl.querySelector('.cell-value');
            
            valEl.innerText = res.val;
            valEl.className = 'cell-value cell-value-pop';
            
            const notesGrid = cellEl.querySelector('.cell-notes-grid');
            if (notesGrid) notesGrid.innerHTML = '';
            
            cellEl.classList.remove('user-entered', 'invalid');
            cellEl.classList.add('clue'); // Transforma em pista para bloquear novos inputs nela

            // Destrava o número selecionado no teclado
            this.activeNumber = -1;
            this.updateKeypadActiveUI();

            this.cleanRelatedNotesOnBoard(index, res.val);
            this.updateCompletedNumbers(); // Atualiza números completos no teclado
            this.highlightCells();
            
            StorageManager.saveActiveGame(this.game.saveState());

            // Conquistar sem dicas é validado no GameOver
            if (res.isWin) {
                this.triggerGameOver(true);
            }
        }
    }

    /**
     * Alterna o modo de escrita de anotações (Notas / Lápis).
     */
    toggleNotesMode() {
        this.isNoteMode = !this.isNoteMode;
        if (this.isNoteMode) {
            this.notesIndicator.classList.add('active');
            this.notesIndicator.innerText = 'ON';
            this.btnNotes.classList.add('active');
        } else {
            this.notesIndicator.classList.remove('active');
            this.notesIndicator.innerText = 'OFF';
            this.btnNotes.classList.remove('active');
            
            // Limpa o número travado ao desativar anotações
            this.activeNumber = -1;
            this.updateKeypadActiveUI();
        }
    }

    /**
     * Controla os atalhos de teclado.
     */
    handleKeyDown(e) {
        // Ignorar atalhos se o jogador estiver focado em algum input real de modal
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') {
            return;
        }

        const key = e.key;

        // Atalhos de números 1-9
        if (/^[1-9]$/.test(key)) {
            const val = parseInt(key);
            
            // Ignorar números já concluídos
            const keyBtn = this.keypadEl.querySelector(`.key-btn[data-val="${val}"]`);
            if (keyBtn && keyBtn.classList.contains('completed-key')) return;

            if (this.isNoteMode) {
                if (this.activeNumber === val) {
                    // Clique rápido no mesmo número: não destrava, apenas insere se tiver célula selecionada
                    if (this.selectedCellIndex !== -1) {
                        this.handleNumberInput(val);
                    }
                } else {
                    this.activeNumber = val; // Transfere a trava
                    if (this.selectedCellIndex !== -1) {
                        this.handleNumberInput(val);
                    }
                }
                this.updateKeypadActiveUI();
            } else {
                if (this.activeNumber !== -1) {
                    if (this.activeNumber === val) {
                        // Clique rápido no mesmo número: não destrava, apenas insere se tiver célula selecionada
                        if (this.selectedCellIndex !== -1) {
                            this.handleNumberInput(val);
                        }
                    } else {
                        this.activeNumber = val; // Transfere a trava
                    }
                    this.updateKeypadActiveUI();
                } else {
                    // Sem trava: comportamento normal de inserir na célula selecionada
                    this.handleNumberInput(val);
                }
            }
            return;
        }

        // Apagar (Delete, Backspace, 0)
        if (key === 'Backspace' || key === 'Delete' || key === '0') {
            this.handleErase();
            return;
        }

        // Desfazer (Ctrl + Z ou U)
        if ((e.ctrlKey && key.toLowerCase() === 'z') || key.toLowerCase() === 'u') {
            e.preventDefault();
            this.handleUndo();
            return;
        }

        // Modo Notas (N)
        if (key.toLowerCase() === 'n') {
            this.toggleNotesMode();
            return;
        }

        // Dica (H)
        if (key.toLowerCase() === 'h') {
            this.handleHint();
            return;
        }

        // Pausa (Space)
        if (key === ' ') {
            e.preventDefault();
            if (this.game && !this.game.isFinished) {
                this.togglePause(!this.game.isPaused);
            }
            return;
        }

        // Fechar modal (Esc)
        if (key === 'Escape') {
            this.closeAllModals();
            if (this.game && this.game.isPaused) {
                this.togglePause(false);
            }
            return;
        }

        // Movimentação pelas setas
        if (this.selectedCellIndex !== -1) {
            let index = this.selectedCellIndex;
            let row = Math.floor(index / 9);
            let col = index % 9;

            if (key === 'ArrowUp' || key.toLowerCase() === 'w') {
                row = (row - 1 + 9) % 9;
            } else if (key === 'ArrowDown' || key.toLowerCase() === 's') {
                row = (row + 1) % 9;
            } else if (key === 'ArrowLeft' || key.toLowerCase() === 'a') {
                col = (col - 1 + 9) % 9;
            } else if (key === 'ArrowRight' || key.toLowerCase() === 'd') {
                col = (col + 1) % 9;
            } else {
                return; // Ignora outras teclas
            }

            e.preventDefault();
            this.selectCell(row * 9 + col);
        }
    }

    // ==================== INTERFACE GERAL E TIMERS ====================

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        this.timerInterval = setInterval(() => {
            if (this.game && !this.game.isPaused && !this.game.isFinished) {
                const secs = this.game.incrementTimer();
                this.timerEl.innerText = this.formatTime(secs);
                
                // Salvar de vez em quando o tempo
                if (secs % 10 === 0) {
                    StorageManager.saveActiveGame(this.game.saveState());
                }
            }
        }, 1000);
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    updateStatusUI() {
        // Modo
        if (this.game.mode === 'campaign') {
            document.getElementById('current-mode-badge').innerText = 'Campanha';
            document.getElementById('difficulty-text').innerText = `Fase ${this.game.difficulty}`;
        } else if (this.game.mode === 'daily') {
            document.getElementById('current-mode-badge').innerText = 'Diário';
            document.getElementById('difficulty-text').innerText = 'Desafio de Hoje';
        } else {
            document.getElementById('current-mode-badge').innerText = 'Clássico';
            const diffMap = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil', expert: 'Especialista' };
            document.getElementById('difficulty-text').innerText = diffMap[this.game.difficulty] || 'Médio';
        }

        this.updateMistakesUI();
        this.timerEl.innerText = this.formatTime(this.game.timer);
    }

    updateMistakesUI() {
        if (this.settings.mistakeLimit) {
            this.mistakesWrapper.classList.remove('hidden');
            this.mistakesEl.innerText = `${this.game.mistakes}/3`;
        } else {
            this.mistakesWrapper.classList.add('hidden');
        }
    }

    updateHeaderProfile() {
        const profile = StorageManager.getProfile();
        this.levelBadge.innerText = profile.level;
        this.rankName.innerText = StorageManager.getRankName(profile.level);
        
        const xpNeeded = StorageManager.getXPNeededForNextLevel(profile.level);
        const percent = Math.min(100, (profile.xp / xpNeeded) * 100);
        this.xpFill.style.width = `${percent}%`;
    }

    togglePause(pauseState) {
        if (!this.game) return;
        this.game.isPaused = pauseState;
        
        // Destrava o número selecionado ao pausar
        this.activeNumber = -1;
        this.updateKeypadActiveUI();

        const pauseIcon = document.getElementById('pause-icon');

        if (pauseState) {
            this.pauseOverlay.classList.remove('hidden');
            pauseIcon.innerHTML = '<path d="M8 5v14l11-7z" fill="currentColor"/>'; // Troca ícone para play
            this.btnPause.title = 'Retomar';
        } else {
            this.pauseOverlay.classList.add('hidden');
            pauseIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor"/>'; // Troca ícone para pause
            this.btnPause.title = 'Pausar';
            // Ajusta o cronômetro para compensar o tempo pausado
            this.game.startTime = Date.now() - (this.game.timer * 1000);
        }

        StorageManager.saveActiveGame(this.game.saveState());
    }

    closeAllModals() {
        this.modalModes.classList.add('hidden');
        this.modalStats.classList.add('hidden');
        this.modalSettings.classList.add('hidden');
        this.modalHelp.classList.add('hidden');
        this.modalGameOver.classList.add('hidden');
    }

    // ==================== MODAIS ESPECÍFICOS ====================

    openModesModal() {
        this.closeAllModals();
        this.modalModes.classList.remove('hidden');
        
        // Atualizar informações da aba campanha
        const campaign = StorageManager.getCampaignProgress();
        document.getElementById('campaign-unlocked-count').innerText = `Progresso: Fase ${campaign.highestUnlocked}/100`;

        // Renderizar Grade de Níveis da Campanha
        this.campaignLevelsContainer.innerHTML = '';
        for (let lvl = 1; lvl <= 100; lvl++) {
            const btn = document.createElement('button');
            btn.className = 'campaign-lvl-btn';
            btn.innerText = lvl;

            if (campaign.completedLevels.includes(lvl)) {
                btn.classList.add('completed');
            } else if (lvl <= campaign.highestUnlocked) {
                btn.classList.add('unlocked');
            } else {
                btn.classList.add('locked');
                btn.disabled = true;
            }

            if (lvl <= campaign.highestUnlocked) {
                btn.addEventListener('click', () => {
                    this.startNewGame('campaign', lvl);
                    this.closeAllModals();
                });
            }
            this.campaignLevelsContainer.appendChild(btn);
        }

        // Atualizar aba Diário
        const todayStr = new Date().toISOString().split('T')[0];
        const day = new Date().getDate();
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const month = monthNames[new Date().getMonth()];
        const year = new Date().getFullYear();

        this.dailyChallengeDate.innerText = `${day} de ${month}, ${year}`;

        const completedDailies = StorageManager.getDailyChallenges();
        if (completedDailies.includes(todayStr)) {
            this.dailyChallengeStatus.innerHTML = '✨ <span class="success-text" style="color:var(--success-color);font-weight:700">Desafio de Hoje Concluído!</span>';
            this.btnStartDaily.disabled = true;
            this.btnStartDaily.innerText = 'Desafio Concluído';
            this.btnStartDaily.style.opacity = '0.5';
        } else {
            this.dailyChallengeStatus.innerText = 'Você ainda não completou o desafio de hoje.';
            this.btnStartDaily.disabled = false;
            this.btnStartDaily.innerText = 'Jogar Desafio de Hoje';
            this.btnStartDaily.style.opacity = '1';
        }
    }

    openStatsModal() {
        this.closeAllModals();
        this.modalStats.classList.remove('hidden');

        const profile = StorageManager.getProfile();
        
        // Dados do Perfil do Modal
        document.getElementById('player-level-badge-lg').innerText = profile.level;
        document.getElementById('player-rank-lg').innerText = `Sudoku ${StorageManager.getRankName(profile.level)}`;
        
        const xpNeeded = StorageManager.getXPNeededForNextLevel(profile.level);
        document.getElementById('player-xp-text-lg').innerText = `${profile.xp} / ${xpNeeded} XP`;
        
        const percent = Math.min(100, (profile.xp / xpNeeded) * 100);
        document.getElementById('player-xp-fill-lg').style.width = `${percent}%`;

        // Cartões Rápidos
        this.statGamesPlayed.innerText = profile.gamesPlayed;
        
        const winRate = profile.gamesPlayed > 0 ? Math.round((profile.gamesWon / profile.gamesPlayed) * 100) : 0;
        this.statWinRate.innerText = `${winRate}%`;
        
        this.statWinStreak.innerText = profile.currentStreak;
        this.statMaxStreak.innerText = profile.maxStreak;

        // Recordes
        const records = StorageManager.getRecords();
        document.getElementById('record-time-easy').innerText = records.easy ? this.formatTime(records.easy) : '--:--';
        document.getElementById('record-time-medium').innerText = records.medium ? this.formatTime(records.medium) : '--:--';
        document.getElementById('record-time-hard').innerText = records.hard ? this.formatTime(records.hard) : '--:--';
        document.getElementById('record-time-expert').innerText = records.expert ? this.formatTime(records.expert) : '--:--';

        // Renderizar Conquistas
        const unlockedList = StorageManager.getUnlockedAchievements();
        this.achievementsContainer.innerHTML = '';

        ACHIEVEMENTS_LIST.forEach(ach => {
            const isUnlocked = unlockedList.includes(ach.id);
            const achEl = document.createElement('div');
            achEl.className = `ach-item ${isUnlocked ? 'unlocked' : ''}`;

            achEl.innerHTML = `
                <div class="ach-badge">${ach.icon}</div>
                <div class="ach-info">
                    <span class="ach-title">${ach.title}</span>
                    <span class="ach-desc">${ach.desc} (+${ach.xp} XP)</span>
                </div>
            `;
            this.achievementsContainer.appendChild(achEl);
        });
    }

    openSettingsModal() {
        this.closeAllModals();
        this.modalSettings.classList.remove('hidden');
    }

    // ==================== FIM DE JOGO (GAMEOVER & PROGRESSÃO) ====================

    /**
     * Aciona o fim de jogo (Vitória ou Derrota) com cálculo de XP e animações de perfil.
     */
    triggerGameOver(isWin) {
        this.closeAllModals();
        this.modalGameOver.classList.remove('hidden');
        
        // Para cronômetro
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        // Remove jogo salvo do auto-save
        StorageManager.clearSavedGame();

        // Configuração de Título e Mensagem de Acordo com Fim de Jogo
        const goArtContainer = document.getElementById('gameover-animation-container');
        
        if (isWin) {
            this.goTitle.innerText = 'Vitória!';
            this.goMessage.innerText = 'Você completou o tabuleiro de forma perfeita.';
            this.goTitle.style.color = 'var(--primary-color)';
            
            // Ícone do Troféu
            goArtContainer.innerHTML = `
                <svg viewBox="0 0 24 24" class="trophy-svg">
                    <path fill="currentColor" d="M18 2H6v2H2v6c0 3.31 2.69 6 6 6h1.22c.93 2.01 2.87 3.52 5.18 3.9V20H10v2h4v-2h-3.4c2.31-.38 4.25-1.89 5.18-3.9H16c3.31 0 6-2.69 6-6V4h-4V2zM8 12c-2.21 0-4-1.79-4-4V6h4v6zm12-4c0 2.21-1.79 4-4 4V6h4v2z"/>
                </svg>
            `;

            // Lançar Confetes
            this.startConfetti();

            // Salvar Progresso de Modos Especiais
            const todayStr = new Date().toISOString().split('T')[0];
            if (this.game.mode === 'campaign') {
                StorageManager.completeCampaignLevel(this.game.difficulty);
            } else if (this.game.mode === 'daily') {
                StorageManager.completeDailyChallenge(todayStr);
            } else {
                // Clássico: Verificar se quebrou o recorde de tempo
                const isNewRecord = StorageManager.checkAndSaveRecord(this.game.difficulty, this.game.timer);
                if (isNewRecord) {
                    this.goMessage.innerText = '⭐ Novo Recorde de Tempo Registrado!';
                }
            }

            // Validar Conquistas Básicas
            StorageManager.unlockAchievement('first_win');
            if (this.game.mistakes === 0) {
                StorageManager.unlockAchievement('flawless');
            }
            if (this.game.timer < 300) {
                StorageManager.unlockAchievement('speed_demon');
            }
            if (this.game.difficulty === 'expert') {
                StorageManager.unlockAchievement('expert_conqueror');
            }
            
            // Checar conquista "Sem Rodinhas" (sem dicas no Médio+)
            const usedHints = this.game.history.some(a => a.newVal === this.game.solvedGrid[a.index] && a.oldVal !== a.newVal && !this.game.originalGrid[a.index] && !this.game.history.slice(0, this.game.history.indexOf(a)).some(prev => prev.index === a.index && prev.newVal !== 0));
            // A lógica de dica gera um histórico onde newVal é preenchido e não foi uma jogada do teclado.
            // Para simplificar, a classe SudokuGame não tem contagem de dicas direto, mas podemos descobrir se a dica foi usada na partida de forma fácil:
            // Verificamos se houve alguma ação de dica no histórico. O botão de dica preenche a célula como pista (clue) e adiciona ao histórico.
            // O getHint adiciona ao histórico com newVal = gabarito. Vamos ver se usou dicas.
            const hasDica = this.game.history.some(action => {
                // Ação de dica: inseriu o valor correto no grid mas a célula virou 'clue'
                return this.game.originalGrid[action.index] !== 0 && action.oldVal === 0;
            });
            
            if (!hasDica && (this.game.difficulty === 'medium' || this.game.difficulty === 'hard' || this.game.difficulty === 'expert')) {
                StorageManager.unlockAchievement('no_hints');
            }

            // Calcular ganho de XP
            let xpGained = 0;
            if (this.game.mode === 'campaign') {
                xpGained = this.game.difficulty * 5 + 50; // XP escala com a fase
            } else if (this.game.mode === 'daily') {
                xpGained = 300;
            } else {
                const xpMap = { easy: 50, medium: 100, hard: 200, expert: 400 };
                xpGained = xpMap[this.game.difficulty] || 100;
            }

            // Bônus de Erro Zero
            if (this.game.mistakes === 0) xpGained += 50;
            
            // Bônus de Velocidade
            if (this.game.timer < 400) xpGained += 50;

            this.goXPGain.innerText = `+${xpGained} XP`;
            this.goXPGain.style.color = 'var(--accent-color)';

            // Adiciona XP ao Perfil e executa animações
            const xpRes = StorageManager.addXP(xpGained);
            StorageManager.updateGameStats(true, this.game.mistakes);

            this.animateXPProgress(xpRes, xpGained);
        } else {
            // DERROTA
            this.goTitle.innerText = 'Derrota!';
            this.goMessage.innerText = 'Você cometeu erros demais nesta rodada.';
            this.goTitle.style.color = 'var(--error-color)';
            this.goXPGain.innerText = '+10 XP';
            this.goXPGain.style.color = 'var(--text-muted)';

            // Ícone da Derrota
            goArtContainer.innerHTML = `
                <svg viewBox="0 0 24 24" class="trophy-svg" style="color:var(--error-color)">
                    <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
            `;

            // Adiciona apenas XP simbólico
            const xpRes = StorageManager.addXP(10);
            StorageManager.updateGameStats(false, this.game.mistakes);
            
            this.animateXPProgress(xpRes, 10);
        }

        // Atualizar Painel de Detalhes
        if (this.game.mode === 'campaign') {
            this.goMode.innerText = `Campanha - Fase ${this.game.difficulty}`;
        } else if (this.game.mode === 'daily') {
            this.goMode.innerText = 'Desafio Diário';
        } else {
            const diffMap = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil', expert: 'Especialista' };
            this.goMode.innerText = `Clássico - ${diffMap[this.game.difficulty]}`;
        }

        this.goTime.innerText = this.formatTime(this.game.timer);
        this.goMistakes.innerText = `${this.game.mistakes}/${this.settings.mistakeLimit ? 3 : 'Sem Limite'}`;
        
        // Atualiza cabeçalho principal logo
        this.updateHeaderProfile();
    }

    /**
     * Executa animação na barra de XP do modal GameOver.
     */
    animateXPProgress(xpRes, xpGained) {
        const profile = StorageManager.getProfile();
        this.levelUpAlert.classList.add('hidden');

        // Configuração dos Níveis de rótulo no modal
        this.goLevelCurrent.innerText = `Nível ${xpRes.oldLevel}`;
        this.goLevelNext.innerText = `Nível ${xpRes.oldLevel + 1}`;

        // Se subiu de nível
        if (xpRes.leveledUp) {
            // Faz a barra encher até 100% no nível anterior
            this.goXPBarFill.style.transition = 'width 0.8s ease-in';
            this.goXPBarFill.style.width = '100%';

            setTimeout(() => {
                // Reseta a barra para 0 instantaneamente
                this.goXPBarFill.style.transition = 'none';
                this.goXPBarFill.style.width = '0%';
                
                // Muda os rótulos de nível
                this.goLevelCurrent.innerText = `Nível ${xpRes.newLevel}`;
                this.goLevelNext.innerText = `Nível ${xpRes.newLevel + 1}`;

                // Mostra Alerta de Level Up com efeito sonoro visual
                this.levelUpAlert.classList.remove('hidden');
                this.levelUpNewVal.innerText = xpRes.newLevel;

                // Enche a barra com o XP restante no nível novo
                setTimeout(() => {
                    const nextXPNeed = StorageManager.getXPNeededForNextLevel(xpRes.newLevel);
                    const finalPercent = (xpRes.newXP / nextXPNeed) * 100;
                    this.goXPBarFill.style.transition = 'width 0.8s ease-out';
                    this.goXPBarFill.style.width = `${finalPercent}%`;
                }, 100);
            }, 800);
        } else {
            // Apenas enche até a porcentagem atual
            const xpNeed = StorageManager.getXPNeededForNextLevel(xpRes.oldLevel);
            const prevXP = Math.max(0, profile.xp - xpGained);
            const prevPercent = (prevXP / xpNeed) * 100;
            const targetPercent = (xpRes.newXP / xpNeed) * 100;

            this.goXPBarFill.style.transition = 'none';
            this.goXPBarFill.style.width = `${prevPercent}%`;

            setTimeout(() => {
                this.goXPBarFill.style.transition = 'width 1s cubic-bezier(0.1, 0.8, 0.3, 1)';
                this.goXPBarFill.style.width = `${targetPercent}%`;
            }, 100);
        }
    }

    // ==================== CONFETES DE VITÓRIA (CANVAS PURA) ====================

    startConfetti() {
        this.confettiCanvas.classList.remove('hidden');
        this.confettiActive = true;
        
        const canvas = this.confettiCanvas;
        const ctx = canvas.getContext('2d');
        
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        const colors = ['#6366f1', '#fbbf24', '#10b981', '#ff007f', '#00ffff', '#ffd700'];
        const particles = [];
        
        for (let i = 0; i < 120; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height - canvas.height,
                size: Math.random() * 6 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                speedX: Math.random() * 3 - 1.5,
                speedY: Math.random() * 4 + 2,
                rotation: Math.random() * 360,
                rotationSpeed: Math.random() * 4 - 2
            });
        }
        
        const update = () => {
            if (!this.confettiActive) return;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            let alive = false;
            particles.forEach(p => {
                p.y += p.speedY;
                p.x += p.speedX;
                p.rotation += p.rotationSpeed;
                
                if (p.y < canvas.height) {
                    alive = true;
                }
                
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation * Math.PI / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
            });
            
            if (alive && this.confettiActive) {
                requestAnimationFrame(update);
            } else {
                this.stopConfetti();
            }
        };
        
        update();
        
        // Auto-encerra geração ativa de confetes após 5 segundos
        setTimeout(() => this.stopConfetti(), 5000);
    }

    stopConfetti() {
        this.confettiActive = false;
        this.confettiCanvas.classList.add('hidden');
    }
}
