/**
 * Sudoku Quest - Gerenciador de Armazenamento e Estatísticas (js/storage.js)
 * Gerencia persistência local no LocalStorage, perfil de XP/Níveis, recordes e conquistas.
 */

const STORAGE_KEYS = {
    SAVE_GAME: 'sudoku_quest_save_game',
    PROFILE: 'sudoku_quest_profile',
    RECORDS: 'sudoku_quest_records',
    ACHIEVEMENTS: 'sudoku_quest_achievements',
    SETTINGS: 'sudoku_quest_settings',
    CAMPAIGN: 'sudoku_quest_campaign',
    DAILY: 'sudoku_quest_daily'
};

// Lista de Conquistas do Jogo
const ACHIEVEMENTS_LIST = [
    {
        id: 'first_win',
        title: 'Primeiro Passo',
        desc: 'Vencer o primeiro jogo clássico de Sudoku.',
        icon: '🌱',
        xp: 50
    },
    {
        id: 'flawless',
        title: 'Mente Brilhante',
        desc: 'Completar um tabuleiro sem cometer nenhum erro.',
        icon: '⭐',
        xp: 100
    },
    {
        id: 'speed_demon',
        title: 'Veloz como o Vento',
        desc: 'Resolver qualquer jogo em menos de 5 minutos.',
        icon: '⚡',
        xp: 100
    },
    {
        id: 'expert_conqueror',
        title: 'Conquistador Supremo',
        desc: 'Completar um jogo na dificuldade Especialista.',
        icon: '👑',
        xp: 250
    },
    {
        id: 'no_hints',
        title: 'Sem Rodinhas',
        desc: 'Vencer um jogo Médio ou superior sem usar dicas.',
        icon: '🧠',
        xp: 100
    },
    {
        id: 'campaign_10',
        title: 'Desbravador da Grade',
        desc: 'Alcançar e completar a fase 10 da Campanha.',
        icon: '🗺️',
        xp: 100
    },
    {
        id: 'campaign_50',
        title: 'Lenda da Jornada',
        desc: 'Completar a fase 50 da Campanha.',
        icon: '🏆',
        xp: 250
    },
    {
        id: 'campaign_100',
        title: 'O Mestre Supremo',
        desc: 'Completar todas as 100 fases da Campanha.',
        icon: '🌌',
        xp: 500
    },
    {
        id: 'daily_3',
        title: 'Hábito Diário',
        desc: 'Completar 3 desafios diários no total.',
        icon: '📅',
        xp: 100
    },
    {
        id: 'daily_10',
        title: 'Consistência Pura',
        desc: 'Completar 10 desafios diários no total.',
        icon: '🔥',
        xp: 250
    }
];

class StorageManager {
    // ==================== CONFIGURAÇÕES ====================
    static getSettings() {
        const defaultSettings = {
            theme: 'dark',
            autoCheck: true,
            mistakeLimit: true,
            highlightSame: true,
            highlightArea: true,
            showTimer: true
        };
        const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    }

    static saveSettings(settings) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    }

    // ==================== PERFIL DO JOGADOR (XP/NÍVEL) ====================
    static getProfile() {
        const defaultProfile = {
            level: 1,
            xp: 0,
            gamesPlayed: 0,
            gamesWon: 0,
            currentStreak: 0,
            maxStreak: 0,
            totalMistakes: 0
        };
        const saved = localStorage.getItem(STORAGE_KEYS.PROFILE);
        return saved ? { ...defaultProfile, ...JSON.parse(saved) } : defaultProfile;
    }

    static saveProfile(profile) {
        localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    }

    /**
     * Calcula o XP necessário para passar do nível atual para o próximo.
     * Progressão: Nível * 150 XP
     */
    static getXPNeededForNextLevel(level) {
        return level * 150;
    }

    /**
     * Retorna o título da patente do jogador baseado no seu nível.
     */
    static getRankName(level) {
        if (level < 5) return 'Iniciante';
        if (level < 10) return 'Aprendiz';
        if (level < 15) return 'Especialista';
        if (level < 20) return 'Mestre';
        if (level < 30) return 'Grão-Mestre';
        return 'Lenda do Sudoku';
    }

    /**
     * Adiciona XP ao perfil e verifica se houve subida de nível.
     * @param {number} xpAmount Quantidade de XP ganha.
     * @returns {Object} { newLevel, leveledUp: boolean, oldLevel, newXP }
     */
    static addXP(xpAmount) {
        const profile = this.getProfile();
        let oldLevel = profile.level;
        profile.xp += xpAmount;

        let leveledUp = false;
        let xpNeeded = this.getXPNeededForNextLevel(profile.level);

        while (profile.xp >= xpNeeded) {
            profile.xp -= xpNeeded;
            profile.level++;
            leveledUp = true;
            xpNeeded = this.getXPNeededForNextLevel(profile.level);
        }

        this.saveProfile(profile);

        return {
            newLevel: profile.level,
            leveledUp,
            oldLevel,
            newXP: profile.xp
        };
    }

    /**
     * Atualiza as estatísticas globais ao finalizar uma partida.
     */
    static updateGameStats(isWin, mistakesCommitted) {
        const profile = this.getProfile();
        
        profile.gamesPlayed++;
        profile.totalMistakes += mistakesCommitted;

        if (isWin) {
            profile.gamesWon++;
            profile.currentStreak++;
            if (profile.currentStreak > profile.maxStreak) {
                profile.maxStreak = profile.currentStreak;
            }
        } else {
            profile.currentStreak = 0;
        }

        this.saveProfile(profile);
    }

    // ==================== RECORDES DE TEMPO ====================
    static getRecords() {
        const saved = localStorage.getItem(STORAGE_KEYS.RECORDS);
        return saved ? JSON.parse(saved) : {
            easy: null,
            medium: null,
            hard: null,
            expert: null
        };
    }

    /**
     * Salva o tempo se for o novo recorde da dificuldade.
     * @returns {boolean} True se for um novo recorde.
     */
    static checkAndSaveRecord(difficulty, timeInSeconds) {
        if (typeof difficulty === 'number') return false; // Campanha não salva recorde de tempo clássico

        const records = this.getRecords();
        const currentRecord = records[difficulty];

        if (currentRecord === null || timeInSeconds < currentRecord) {
            records[difficulty] = timeInSeconds;
            localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
            return true;
        }
        return false;
    }

    // ==================== CAMPANHA E DESAFIOS DIÁRIOS ====================
    static getCampaignProgress() {
        const defaultProgress = {
            highestUnlocked: 1, // Fase 1 liberada por padrão
            completedLevels: []
        };
        const saved = localStorage.getItem(STORAGE_KEYS.CAMPAIGN);
        return saved ? { ...defaultProgress, ...JSON.parse(saved) } : defaultProgress;
    }

    static saveCampaignProgress(progress) {
        localStorage.setItem(STORAGE_KEYS.CAMPAIGN, JSON.stringify(progress));
    }

    /**
     * Completa uma fase da campanha e destrava a próxima.
     */
    static completeCampaignLevel(level) {
        const progress = this.getCampaignProgress();
        if (!progress.completedLevels.includes(level)) {
            progress.completedLevels.push(level);
        }
        
        // Se concluiu a maior que tinha liberada, abre a próxima
        if (level === progress.highestUnlocked && level < 100) {
            progress.highestUnlocked = level + 1;
        }

        this.saveCampaignProgress(progress);

        // Checar conquistas da campanha
        if (level >= 10) this.unlockAchievement('campaign_10');
        if (level >= 50) this.unlockAchievement('campaign_50');
        if (level >= 100) this.unlockAchievement('campaign_100');
    }

    static getDailyChallenges() {
        const saved = localStorage.getItem(STORAGE_KEYS.DAILY);
        return saved ? JSON.parse(saved) : []; // Array de datas tipo ['2026-06-09']
    }

    /**
     * Registra o desafio diário de hoje como concluído.
     */
    static completeDailyChallenge(dateStr) {
        const completed = this.getDailyChallenges();
        if (!completed.includes(dateStr)) {
            completed.push(dateStr);
            localStorage.setItem(STORAGE_KEYS.DAILY, JSON.stringify(completed));
            
            // Verificar conquistas diárias
            if (completed.length >= 3) this.unlockAchievement('daily_3');
            if (completed.length >= 10) this.unlockAchievement('daily_10');
            return true;
        }
        return false;
    }

    // ==================== SISTEMA DE CONQUISTAS ====================
    static getUnlockedAchievements() {
        const saved = localStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS);
        return saved ? JSON.parse(saved) : []; // Array de IDs tipo ['first_win']
    }

    /**
     * Desbloqueia uma conquista por ID e adiciona seu respectivo bônus de XP.
     * @returns {boolean} True se a conquista acabou de ser destravada (não estava destravada antes).
     */
    static unlockAchievement(id) {
        const unlocked = this.getUnlockedAchievements();
        if (!unlocked.includes(id)) {
            unlocked.push(id);
            localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(unlocked));

            // Achar recompensa de XP
            const ach = ACHIEVEMENTS_LIST.find(a => a.id === id);
            if (ach) {
                // Adiciona o bônus de XP diretamente
                this.addXP(ach.xp);
            }
            return true;
        }
        return false;
    }

    // ==================== JOGO EM ANDAMENTO (AUTO-SAVE) ====================
    static getSavedGame() {
        const saved = localStorage.getItem(STORAGE_KEYS.SAVE_GAME);
        return saved ? JSON.parse(saved) : null;
    }

    static saveActiveGame(gameState) {
        localStorage.setItem(STORAGE_KEYS.SAVE_GAME, JSON.stringify(gameState));
    }

    static clearSavedGame() {
        localStorage.removeItem(STORAGE_KEYS.SAVE_GAME);
    }
}
