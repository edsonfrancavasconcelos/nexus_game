export class ProgressionManager {
    constructor() {
        this.level = 1;
        this.totalScore = 0;
        this.enemiesDestroyed = 0;
        this.upgradePoints = 0;
        this.maxChancesPerLevel = 5;
        this.maxMissilesPerLevel = 10;
        this.maxPdcBurstsPerLevel = 30;
        this.chancesLeft = this.maxChancesPerLevel;
        
        // Configuração de Progressão
        this.baseEnemiesPerLevel = 10; // Nível 1 precisa de 10
        this.difficultyMultiplier = 1.2; // Aumenta 20% a cada nível
    }

    /**
     * Adiciona pontuação e verifica subida de nível
     * @param {number} points - Pontos ganhos
     * @returns {boolean} - true se subiu de nível
     */
    addScore(points) {
        this.totalScore += points;
        this.enemiesDestroyed++;

        // Cálculo de meta: ex: Nível 1 (10), Nível 2 (12), Nível 3 (15)...
        const enemiesNeeded = Math.floor(this.baseEnemiesPerLevel * Math.pow(this.difficultyMultiplier, this.level - 1));

        if (this.enemiesDestroyed >= enemiesNeeded) {
            this.levelUp();
            return true;
        }
        return false;
    }

    levelUp() {
        this.level++;
        this.upgradePoints++;
        this.enemiesDestroyed = 0; // Reseta o contador para o próximo degrau de dificuldade
        this.resetLevelResources();
        
        console.log(`🚀 Nível UP! Agora no nível ${this.level}. Pontos de Upgrade: ${this.upgradePoints}`);
    }

    resetLevelResources() {
        this.chancesLeft = this.maxChancesPerLevel;
    }

    loseChance() {
        this.chancesLeft = Math.max(0, this.chancesLeft - 1);
        return {
            chancesLeft: this.chancesLeft,
            failed: this.chancesLeft === 0
        };
    }

    failLevel() {
        this.enemiesDestroyed = 0;
        this.resetLevelResources();
        return this.level;
    }

    getChancesLeft() {
        return this.chancesLeft;
    }

    getLevelLoadout() {
        return {
            missiles: this.maxMissilesPerLevel,
            pdcBursts: this.maxPdcBurstsPerLevel,
            chancesLeft: this.chancesLeft
        };
    }

    getLevel() {
        return this.level;
    }

    setLevel(level) {
        const nextLevel = Math.max(1, Math.floor(level || 1));
        this.level = nextLevel;
        this.enemiesDestroyed = 0;
        this.resetLevelResources();
        return this.level;
    }

    getUpgradePoints() {
        return this.upgradePoints;
    }

    canUpgrade() {
        return this.upgradePoints > 0;
    }

    useUpgradePoint() {
        if (this.upgradePoints > 0) {
            this.upgradePoints--;
            return true;
        }
        return false;
    }

    // Retorna o progresso atual do nível de 0 a 1 (para barras de XP na UI)
    getLevelProgress() {
        const enemiesNeeded = Math.floor(this.baseEnemiesPerLevel * Math.pow(this.difficultyMultiplier, this.level - 1));
        return Math.min(this.enemiesDestroyed / enemiesNeeded, 1);
    }
}