import * as THREE from 'three';
import { RAPTOR_FLIGHT_FEEL } from './RaptorFlightFeel.js';

// Limites do mapa.
// minY/maxY são só a faixa LOCAL de manobra na tela (o enquadramento da nave). A altitude de verdade é
// do mundo: ao encostar na faixa, subir/descer move a origem vertical (renderOrigin.y), sem teto baixo.
// worldCeiling: acima do relevo mais alto; minClearance: folga mínima sobre o chão enquanto a colisão está desligada.
export const MAP_LIMITS = {
    halfWidth: 100, localHalfWidth: 160, minY: -45, maxY: 90,
    worldCeiling: 2600, minClearance: 14, climbGain: RAPTOR_FLIGHT_FEEL.speed.climbGain
};

const _up = new THREE.Vector3(0, 1, 0);
const WORLD_DRIFT = RAPTOR_FLIGHT_FEEL.speed.worldDrift;
const HEADING_RATE = RAPTOR_FLIGHT_FEEL.speed.headingRate;
const CLIMB_RESPONSE = RAPTOR_FLIGHT_FEEL.speed.climbResponse;
const PITCH_RESPONSE = RAPTOR_FLIGHT_FEEL.speed.pitchResponse;
const PITCH_DEADZONE = RAPTOR_FLIGHT_FEEL.speed.pitchDeadzone;
const REF_SPEED = RAPTOR_FLIGHT_FEEL.steer.refSpeed;
const ALTITUDE_RANGE = 700;

// Estado real da nave no mundo 3D. O mundo é "world space" absoluto (Z negativo = avanço);
// a cena usa origem flutuante: posição de cena = posição de mundo - renderOrigin.
// O jogador comanda (velocity local x/y); a nave avança em Z pela velocidade de cruzeiro e
// o rumo (heading), que nasce do comando, muda a trajetória real.
export class ShipFlight {
    constructor() {
        this.worldPosition = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.forward = new THREE.Vector3(0, 0, -1);
        this.right = new THREE.Vector3(1, 0, 0);
        this.quaternion = new THREE.Quaternion();
        this.renderOrigin = new THREE.Vector3();
        this.heading = 0;
        this.distance = 0;
        this.cruiseSpeed = 0;
        this.atLimit = false;
        this._originDx = 0;
        // Altitude real: Y do mundo menos a altura do chão (fornecida pelo ambiente; só informativa).
        this.groundProbe = null;
        this.groundY = -85;
        this.altitude = 130;
        this.altitudeNorm = 0.5;
        this.climbRate = 0;
        this.pitchCmd = 0; // atitude (pitch) normalizada -1..1: o comando move o nariz, e a altitude segue o nariz
        this.terrainFloor = true; // piso suave sobre o relevo enquanto a colisão real não está ligada
        this._originDy = 0;
    }

    // Quanto a origem vertical andou neste quadro (objetos do mundo na cena compensam isso).
    get originShiftY() { return this._originDy; }

    setGroundProbe(fn) {
        this.groundProbe = fn;
    }

    // Altitude real: Y de cena da nave menos a altura visual do terreno sob ela (relevo, bioma e montanhas).
    // O terreno vive nas coordenadas de cena, então a sonda recebe x/z de cena.
    _updateAltitude(meshPosition) {
        this.groundY = this.groundProbe ? this.groundProbe(meshPosition.x, meshPosition.z) : -85;
        this.altitude = meshPosition.y - this.groundY;
        // 0 = rasante, 1 = altura de cruzeiro alta (ALTITUDE_RANGE acima do chão).
        this.altitudeNorm = THREE.MathUtils.clamp(this.altitude / ALTITUDE_RANGE, 0, 1);
    }

    reset() {
        this.heading = 0;
        this.renderOrigin.x = 0;
        this.renderOrigin.y = 0;
        this._originDx = 0;
        this._originDy = 0;
        this.climbRate = 0;
        this.pitchCmd = 0;
        this.atLimit = false;
    }

    // steer: player.velocity (Vector2, u/s). mesh: posição local da nave na cena.
    update(dt, steer, cruiseSpeed, meshPosition, vertInput = 0) {
        this.cruiseSpeed = cruiseSpeed;

        // Altitude do mundo: ao chegar na borda da faixa local, o comando vertical passa a mover a origem
        // vertical (o mundo desce/sobe em volta da nave), então não há teto baixo nem piso fixo.
        // Atitude: o comando move o nariz (pitch) com atraso; a subida/descida só nasce do pitch já formado.
        const climbInput = THREE.MathUtils.clamp(vertInput, -1, 1);
        this.pitchCmd += (climbInput - this.pitchCmd) * (1 - Math.exp(-dt * PITCH_RESPONSE));
        const pAbs = Math.max(0, Math.abs(this.pitchCmd) - PITCH_DEADZONE) / (1 - PITCH_DEADZONE);
        const attitude = Math.sign(this.pitchCmd) * pAbs * pAbs * (3 - 2 * pAbs);
        const my = meshPosition.y;
        // A altitude do mundo responde em qualquer ponto da faixa local (40% no centro, 100% nas bordas),
        // para a subida/descida ser rápida sem a nave precisar cruzar a tela inteira antes.
        const upF = 0.4 + 0.6 * THREE.MathUtils.smoothstep(my, 20, 70);
        const downF = 0.4 + 0.6 * (1 - THREE.MathUtils.smoothstep(my, -30, 10));
        let climbTarget = attitude > 0 ? attitude * upF : attitude * downF;
        climbTarget *= MAP_LIMITS.climbGain;
        if (this.terrainFloor && climbTarget < 0 && this.altitude < MAP_LIMITS.minClearance + 2) climbTarget = 0;
        this.climbRate += (climbTarget - this.climbRate) * (1 - Math.exp(-dt * CLIMB_RESPONSE));
        const prevY = this.renderOrigin.y;
        const maxOriginY = MAP_LIMITS.worldCeiling - MAP_LIMITS.maxY;
        const oy = Math.min(prevY + this.climbRate * dt, maxOriginY);
        this._originDy = dt > 0 ? oy - prevY : 0;

        // Piso suave sobre o relevo (some quando a colisão for ligada).
        if (this.terrainFloor && this.groundProbe) {
            const floorY = this.groundProbe(meshPosition.x, meshPosition.z) + MAP_LIMITS.minClearance;
            if (meshPosition.y < floorY) { meshPosition.y = floorY; if (steer.y < 0) steer.y = 0; }
        }

        // Limites locais: a nave não sai do espaço jogável; a velocidade contra a parede é zerada.
        this.atLimit = false;
        const lw = MAP_LIMITS.localHalfWidth;
        if (meshPosition.x > lw) { meshPosition.x = lw; if (steer.x > 0) steer.x = 0; this.atLimit = true; }
        else if (meshPosition.x < -lw) { meshPosition.x = -lw; if (steer.x < 0) steer.x = 0; this.atLimit = true; }
        if (meshPosition.y > MAP_LIMITS.maxY) { meshPosition.y = MAP_LIMITS.maxY; if (steer.y > 0) steer.y = 0; }
        else if (meshPosition.y < MAP_LIMITS.minY && !(this.terrainFloor && this.groundProbe)) { meshPosition.y = MAP_LIMITS.minY; if (steer.y < 0) steer.y = 0; }

        // Rumo: o nariz aponta para onde o jogador está indo.
        const vxN = THREE.MathUtils.clamp(steer.x / REF_SPEED, -1.2, 1.2);
        this.heading += (vxN * 0.2 - this.heading) * (1 - Math.exp(-dt * HEADING_RATE));
        const s = Math.sin(this.heading);
        const c = Math.cos(this.heading);
        this.forward.set(s, 0, -c);
        this.right.set(c, 0, s);
        this.quaternion.setFromAxisAngle(_up, -this.heading);

        // Avanço real em Z; a componente lateral do rumo move a nave no corredor do mundo.
        this.distance += cruiseSpeed * c * dt;
        const prevX = this.renderOrigin.x;
        let ox = prevX + s * cruiseSpeed * WORLD_DRIFT * dt;
        if (Math.abs(ox) > MAP_LIMITS.halfWidth) {
            ox = Math.sign(ox) * MAP_LIMITS.halfWidth;
            this.atLimit = true;
        }
        this.renderOrigin.set(ox, oy, -this.distance);
        this._originDx = dt > 0 ? ox - prevX : 0;

        this.worldPosition.set(
            this.renderOrigin.x + meshPosition.x,
            this.renderOrigin.y + meshPosition.y,
            this.renderOrigin.z + meshPosition.z
        );
        this._updateAltitude(meshPosition);
        this.velocity.set(
            this._originDx / Math.max(dt, 1e-4) + steer.x,
            steer.y + this._originDy / Math.max(dt, 1e-4),
            this.forward.z * cruiseSpeed
        );
    }

    // Quanto a origem lateral andou neste quadro (objetos do mundo na cena compensam isso).
    get originShiftX() { return this._originDx; }

    toScene(world, out = new THREE.Vector3()) {
        return out.copy(world).sub(this.renderOrigin);
    }

    toWorld(scene, out = new THREE.Vector3()) {
        return out.copy(scene).add(this.renderOrigin);
    }

    // Ponto do mundo relativo à nave: distância à frente, lateral e altura. Retorna em coordenadas de mundo.
    worldPointAhead(dist, lateral, vertical, out = new THREE.Vector3()) {
        return out.copy(this.worldPosition)
            .addScaledVector(this.forward, dist)
            .addScaledVector(this.right, lateral)
            .addScaledVector(_up, vertical);
    }
}
