export class ProgressionManager {
    constructor() {
        this.level = 1;
        this.totalScore = 0;
        this.upgradePoints = 0;
        this.chancesLeft = 5;
        this.maxLevel = 100;

        this.baseScorePerLevel = 900;
        this.difficultyMultiplier = 1.02;
        this.levelProgressScore = 0;
        this.levelProgressTarget = this.getScoreNeededForNextLevel();
    }

    addScore(points) {
        this.totalScore += points;
        this.levelProgressScore += points;

        let leveled = false;
        while (this.levelProgressScore >= this.levelProgressTarget && this.level < this.maxLevel) {
            this.levelProgressScore -= this.levelProgressTarget;
            this.levelUp();
            leveled = true;
            this.levelProgressTarget = this.getScoreNeededForNextLevel();
        }

        return leveled;
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
        return Math.max(650, Math.floor(this.baseScorePerLevel * Math.pow(this.difficultyMultiplier, this.level - 1)));
    }

    resetLevelResources() {
        this.chancesLeft = 5;
        this.levelProgressTarget = this.getScoreNeededForNextLevel();
    }

    loseChance() {
        this.chancesLeft = Math.max(0, this.chancesLeft - 1);
        return {
            chancesLeft: this.chancesLeft,
            failed: this.chancesLeft === 0
        };
    }

    failLevel() {
        this.levelProgressScore = 0;
        this.levelProgressTarget = this.getScoreNeededForNextLevel();
        this.resetLevelResources();
        return this.level;
    }

    resetLevelProgress() {
        this.levelProgressScore = 0;
        this.levelProgressTarget = this.getScoreNeededForNextLevel();
        this.chancesLeft = 5;
    }

    getLevel() {
        return this.level;
    }

    setLevel(level) {
        this.level = Math.max(1, Math.min(this.maxLevel, Math.floor(level)));
        this.totalScore = 0;
        this.upgradePoints = 0;
        this.levelProgressScore = 0;
        this.levelProgressTarget = this.getScoreNeededForNextLevel();
        this.resetLevelResources();
    }

    getChancesLeft() {
        return this.chancesLeft;
    }

    getProgressPercent() {
        return Math.min(1, this.levelProgressScore / Math.max(this.levelProgressTarget, 1));
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