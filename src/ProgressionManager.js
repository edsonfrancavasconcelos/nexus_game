export class ProgressionManager {
    constructor() {
        this.level = 1;
        this.totalScore = 0;
        this.upgradePoints = 0;
        this.chancesLeft = 5;
        this.maxLevel = 100;
        this.levelProgressTarget = 10000; 
        this.levelProgressScore = 0;
        this.activeBoss = null;
    }

    shouldSpawnBoss() {
        return this.level >= 50 && this.level % 5 === 0 && !this.activeBoss;
    }

    getBossScale() {
        if (this.level < 50) return 1;
        const progress = (this.level - 50) / (this.maxLevel - 50);
        return 1.0 + (progress * 1.0); 
    }

    registerBoss(bossInstance) {
        this.activeBoss = bossInstance;
        // NÃO zera o progresso — deixa o nível continuar avançando
    }

    addScore(points) {
        // REMOVIDA a trava do boss — o nível sobe mesmo com a Nave Mãe viva

        this.totalScore += points;
        this.levelProgressScore += points;

        if (this.levelProgressScore < this.levelProgressTarget || this.level >= this.maxLevel) {
            return false;
        }

        this.levelProgressScore = Math.max(0, this.levelProgressScore - this.levelProgressTarget);
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

    getScoreNeededForNextLevel() {
        return 10000;
    }

    resetLevelResources() {
        this.chancesLeft = 5;
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
        // NÃO zera o totalScore — evita conflito com o score do index.js
        this.levelProgressScore = 0;
        this.resetLevelResources();
        // Mantém activeBoss se já existir (não limpa automaticamente)
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
        return { 
            missiles: 8 + missileBonus, 
            pdcBursts: 25 + pdcBonus, 
            chancesLeft: this.chancesLeft 
        };
    }
}