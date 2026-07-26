export class ProgressionManager {
    constructor() {
        this.level = 1;
        this.totalScore = 0;
        this.upgradePoints = 0;
        this.chancesLeft = 5;
        this.maxLevel = 100;
        // Fixado em 10.000 pontos por nível
        this.levelProgressTarget = 10000; 
        this.levelProgressScore = 0;
        this.activeBoss = null;
    }

    // Método para o index.js avisar o gerenciador que o boss nasceu
    registerBoss(bossInstance) {
        this.activeBoss = bossInstance;
        this.levelProgressScore = 0;
    }

    addScore(points) {
        // TRAVA DO BOSS
        if (this.activeBoss && this.activeBoss.isAlive && this.activeBoss.isActive) {
            return false;
        }

        this.totalScore += points;
        this.levelProgressScore += points;

        // Se não atingiu os 10 mil pontos ou já está no nível máximo, não sobe
        if (this.levelProgressScore < this.levelProgressTarget || this.level >= this.maxLevel) {
            return false;
        }

        // Subtrai exatamente os 10 mil pontos da barra de progresso do nível atual
        this.levelProgressScore = Math.max(0, this.levelProgressScore - this.levelProgressTarget);

        // Executa a subida de nível física do jogo
        this.levelUp();
        return true;
    }

    levelUp() {
        if (this.level >= this.maxLevel) return false;
        this.level++;
        this.upgradePoints += 2;
        this.resetLevelResources();
        console.log(`🚀 NÍVEL ${this.level} ALCANÇADO!`);
        return true;
    }

    // Mantido por compatibilidade, mas agora retorna sempre o valor fixo
    getScoreNeededForNextLevel() {
        return 10000;
    }

    resetLevelResources() {
        this.chancesLeft = 5;
        // Mantém a meta fixa em 10.000
        this.levelProgressTarget = 10000; 
    }

    loseChance() {
        this.chancesLeft = Math.max(0, this.chancesLeft - 1);
        return { chancesLeft: this.chancesLeft, failed: this.chancesLeft === 0 };
    }

    failLevel() {
        this.levelProgressScore = 0;
        this.resetLevelResources();
        return this.level;
    }

    resetLevelProgress() {
        this.levelProgressScore = 0;
        this.levelProgressTarget = 10000;
        this.chancesLeft = 5;
        this.activeBoss = null;
    }

    getLevel() {
        return this.level;
    }

    setLevel(level) {
        this.level = Math.max(1, Math.min(this.maxLevel, Math.floor(level)));
        this.totalScore = 0;
        this.upgradePoints = 0;
        this.levelProgressScore = 0;
        this.resetLevelResources();
        this.activeBoss = null;
    }

    getChancesLeft() {
        return this.chancesLeft;
    }

    getProgressPercent() {
        return Math.min(1, this.levelProgressScore / this.levelProgressTarget);
    }

    getLevelLoadout() {
        const missileBonus = Math.floor(this.level / 6);
        const pdcBonus = Math.floor(this.level / 4);
        return { missiles: 8 + missileBonus, pdcBursts: 25 + pdcBonus, chancesLeft: this.chancesLeft };
    }
}
