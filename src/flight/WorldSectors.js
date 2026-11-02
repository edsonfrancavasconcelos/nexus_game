export const SECTOR_LENGTH = 2400;
const BEHIND = 1;
const AHEAD = 3;

// Setores ao longo do avanço da nave. O terreno, as florestas e as cidades são gerados por setor
// (a partir da distância percorrida), então só a janela de setores ao redor da nave fica ativa.
export class WorldSectors {
    constructor(onLoad = null, onUnload = null) {
        this.onLoad = onLoad;
        this.onUnload = onUnload;
        this.current = 0;
        this.active = new Set();
        this.update(0);
    }

    indexAt(distance) {
        return Math.floor(distance / SECTOR_LENGTH);
    }

    // Primeira fronteira de setor a pelo menos minAhead de distância.
    boundaryAfter(distance, minAhead) {
        return Math.ceil((distance + minAhead) / SECTOR_LENGTH) * SECTOR_LENGTH;
    }

    update(distance) {
        this.current = this.indexAt(distance);
        const lo = Math.max(0, this.current - BEHIND);
        const hi = this.current + AHEAD;
        for (const i of this.active) {
            if (i < lo || i > hi) {
                this.active.delete(i);
                if (this.onUnload) this.onUnload(i);
            }
        }
        for (let i = lo; i <= hi; i++) {
            if (!this.active.has(i)) {
                this.active.add(i);
                if (this.onLoad) this.onLoad(i);
            }
        }
    }
}
