import * as THREE from 'three';

export const PATH_SEGMENT = 600;
const POINTS = 12;
const MAX_LATERAL = 80;
const MAX_VERTICAL = 30;

function hash(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
}

// Trajetória 3D da nave: curva Catmull-Rom por pontos determinísticos (x lateral, y altitude, -z avanço).
// A nave percorre a curva à velocidade de voo; os comandos do jogador são deslocamentos em torno dela.
export class FlightPath {
    constructor() {
        this.distance = 0;
        this.position = new THREE.Vector3();
        this.heading = 0;
        this.curvature = 0;
        this.climb = 0;
        this._p = new THREE.Vector3();
        this._t = new THREE.Vector3();
        this._build(0);
        this.update(0, 0, true);
    }

    // Os pontos dependem só do índice: trechos reconstruídos continuam exatamente a mesma curva.
    _build(startIndex) {
        const pts = [];
        for (let i = 0; i < POINTS; i++) {
            const idx = startIndex + i;
            pts.push(new THREE.Vector3(hash(idx) * MAX_LATERAL, hash(idx + 91) * MAX_VERTICAL, -idx * PATH_SEGMENT));
        }
        this._curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
        this._start = startIndex;
    }

    _u(distance) {
        const span = (POINTS - 1) * PATH_SEGMENT;
        return THREE.MathUtils.clamp((distance - this._start * PATH_SEGMENT) / span, 0, 1);
    }

    // Posição lateral/vertical da trajetória numa distância à frente (usada para posicionar inimigos).
    sample(distance, out = new THREE.Vector3()) {
        this._curve.getPoint(this._u(distance), this._p);
        return out.set(this._p.x, this._p.y, -distance);
    }

    update(dt, distance, instant = false) {
        this.distance = distance;
        if (distance - this._start * PATH_SEGMENT > (POINTS - 4) * PATH_SEGMENT) {
            this._build(Math.max(0, Math.floor(distance / PATH_SEGMENT) - 2));
        }
        const u = this._u(distance);
        const du = 150 / ((POINTS - 1) * PATH_SEGMENT);
        this._curve.getPoint(u, this._p);
        this.position.copy(this._p);
        this._curve.getTangent(u, this._t);
        const h0 = Math.atan2(this._t.x, -this._t.z);
        const y0 = this._t.y;
        this._curve.getTangent(Math.min(u + du, 1), this._t);
        const h1 = Math.atan2(this._t.x, -this._t.z);
        const curv = (h1 - h0) / 150 * PATH_SEGMENT;
        const k = instant ? 1 : 1 - Math.exp(-dt * 2);
        this.heading += (h0 - this.heading) * k;
        this.curvature += (curv - this.curvature) * k;
        this.climb += (y0 - this.climb) * k;
    }
}
