export class ProgressionManager {
    constructor() {
        this.level = 1;
        this.totalScore = 0;
        this.upgradePoints = 0;
        this.chancesLeft = 5;
        this.maxLevel = 100;

        this.baseScorePerLevel = 800;          // ← Reduzido (era 1200)
        this.difficultyMultiplier = 1.07;      // ← Mais suave (era 1.085)
    }

    addScore(points) {
        this.totalScore += points;

        const scoreNeeded = this.getScoreNeededForNextLevel();

        if (this.totalScore >= scoreNeeded) {
            this.levelUp();
            return true;
        }
        return false;
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
        return Math.floor(this.baseScorePerLevel * Math.pow(this.difficultyMultiplier, this.level - 1));
    }

    resetLevelResources() {
        this.chancesLeft = 5;
    }

    loseChance() {
        this.chancesLeft = Math.max(0, this.chancesLeft - 1);
        return {
            chancesLeft: this.chancesLeft,
            failed: this.chancesLeft === 0
        };
    }

    failLevel() {
        this.level = Math.max(1, this.level - 3);
        this.resetLevelResources();
        return this.level;
    }

    getLevel() {
        return this.level;
    }

    setLevel(level) {
        this.level = Math.max(1, Math.min(this.maxLevel, Math.floor(level)));
        this.resetLevelResources();
    }

    getChancesLeft() {
        return this.chancesLeft;
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