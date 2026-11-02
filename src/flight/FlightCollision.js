import * as THREE from 'three';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _box = new THREE.Box3();
const _size = new THREE.Vector3();

// Estrutura de colisão em coordenadas de mundo. Hoje: nave x inimigos (esferas) e limites do mapa.
// Gancho para o ambiente: registre uma função (x, z) => altura do chão para ativar nave x terreno.
export class FlightCollision {
    constructor(ship, radius = 9) {
        this.ship = ship;
        this.radius = radius;
        this.groundProbe = null;
        this.groundClearance = 6;
        this.enabled = false; // colisão desligada: evaluate() só mede
        this.obstacles = null;
        this.bounds = new THREE.Vector3(6, 2, 8);
        this.lookAhead = 0.35;
        this.last = { terrainHit: false, structureHit: false, nearest: null, clearance: Infinity, contact: null };
        this._list = [];
    }

    setGroundProbe(fn) {
        this.groundProbe = fn;
    }

    // Esfera da nave contra um objeto da cena (posição de cena + raio).
    hitsSceneObject(position, radius, shipScenePos) {
        _a.copy(position);
        _b.copy(shipScenePos);
        const r = this.radius + radius;
        return _a.distanceToSquared(_b) <= r * r;
    }

    // Usa a altitude já medida pelo ShipFlight (nave x terreno em coordenadas de cena). Não é chamada ainda.
    hitsGround() {
        if (!this.groundProbe) return false;
        return this.ship.altitude < this.groundClearance;
    }

    hitsBounds() {
        return this.ship.atLimit;
    }

    // Caixa da nave (meia-extensão) a partir do GLB; 0.7 aproxima o casco real dentro do bbox.
    fitToModel(model) {
        if (!model) return;
        _box.setFromObject(model);
        if (_box.isEmpty()) return;
        _box.getSize(_size);
        this.setShipBounds(_size.x * 0.35, _size.y * 0.35, _size.z * 0.35);
    }

    setShipBounds(hx, hy, hz) {
        this.bounds.set(hx, hy, hz);
        this.radius = Math.max(hx, hz);
    }

    setObstacles(world) {
        this.obstacles = world;
    }

    // Consulta (sem efeito colateral) o que a nave tocaria agora ou logo à frente, usando posição de cena,
    // tamanho do GLB e velocidade. Preenche this.last; só retorna `hit` verdadeiro se `enabled`.
    // this.last.contact (só para debug): ponto de contato em cena, obstáculo, distância até o impacto,
    // velocidade e lado (frontal/lateral/casco/vertical). Nunca aplica dano nem altera a nave.
    evaluate(shipScenePos, velocity, cruiseSpeed = 0) {
        const last = this.last;
        last.terrainHit = last.structureHit = false;
        last.nearest = null;
        last.clearance = Infinity;
        last.contact = null;
        if (!this.obstacles) return false;

        const { x: hx, y: hy, z: hz } = this.bounds;
        const look = this.lookAhead;
        const vy = velocity ? velocity.y : 0;
        const vx = velocity ? velocity.x : 0;
        const y0 = shipScenePos.y - hy + Math.min(0, vy * look);
        const y1 = shipScenePos.y + hy + Math.max(0, vy * look);
        const zFront = shipScenePos.z - hz - cruiseSpeed * look;
        const zs = [shipScenePos.z + hz, shipScenePos.z, shipScenePos.z - hz];
        // Amostras a cada ~20 u ao longo do caminho de antecipação, para não pular obstáculos estreitos.
        const reach = shipScenePos.z - hz - zFront;
        const steps = Math.min(12, Math.ceil(reach / 20));
        for (let i = 1; i <= steps; i++) zs.push(shipScenePos.z - hz - (reach * i) / steps);
        const xs = [-hx, 0, hx];
        let bestDist = Infinity;

        for (const dx of xs) {
            for (const z of zs) {
                const list = this._list;
                list.length = 0;
                this.obstacles.sampleScene(shipScenePos.x + dx, z, list);
                for (const o of list) {
                    const gap = o.kind === 'terrain' ? y0 - o.top : (y0 >= o.top ? y0 - o.top : (y1 <= o.bottom ? o.bottom - y1 : -1));
                    if (o.kind === 'terrain') {
                        if (gap < last.clearance) last.clearance = gap;
                        if (gap < 0) last.terrainHit = true;
                    } else if (gap < 0) {
                        last.structureHit = true;
                    }
                    if (gap < 0 && (!last.nearest || o.kind !== 'terrain')) last.nearest = o;
                    if (gap < 0) {
                        const dist = Math.max(0, shipScenePos.z - hz - z);
                        if (dist < bestDist) {
                            bestDist = dist;
                            const c = last.contact || (last.contact = {});
                            const inFront = z < shipScenePos.z - hz;
                            const vertical = o.kind === 'terrain' || (Math.abs(vy) > Math.abs(vx) && z >= shipScenePos.z - hz);
                            c.kind = o.kind;
                            c.x = shipScenePos.x + dx;
                            c.z = z;
                            c.y = o.kind === 'terrain' ? o.top : Math.min(Math.max(shipScenePos.y, o.bottom), o.top);
                            c.distance = dist;
                            c.speed = Math.hypot(cruiseSpeed, vx, vy);
                            c.side = inFront ? 'frontal' : (vertical ? 'vertical' : (dx !== 0 ? 'lateral' : 'casco'));
                            c.obstacle = o;
                        }
                    }
                }
            }
        }
        return this.enabled && (last.terrainHit || last.structureHit);
    }
}
