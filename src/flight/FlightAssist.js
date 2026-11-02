import * as THREE from 'three';
import { RAPTOR_FLIGHT_FEEL } from './RaptorFlightFeel.js';

const SPEED = RAPTOR_FLIGHT_FEEL.speed;
const REF_SPEED = RAPTOR_FLIGHT_FEEL.steer.refSpeed;

// Flight Assist: cuida só do cruzeiro e da sensação de peso. Nada aqui se move sem comando do jogador.
export class FlightAssist {
    constructor() {
        this.speedFactor = SPEED.cruiseFactor;
    }

    reset() {
        this.speedFactor = SPEED.cruiseFactor;
    }

    update(dt, velocity, forwardSpeed) {
        const vxN = THREE.MathUtils.clamp(velocity.x / REF_SPEED, -1.2, 1.2);
        const vyN = THREE.MathUtils.clamp(velocity.y / REF_SPEED, -1.2, 1.2);

        // Subir gasta energia, mergulhar ganha; virar sangra um pouco. Sem comando: velocidade de cruzeiro.
        const target = 1 - 0.05 * Math.max(vyN, 0) + 0.07 * Math.max(-vyN, 0) - SPEED.turnBleed * Math.abs(vxN);
        this.speedFactor += (target - this.speedFactor) * (1 - Math.exp(-dt * 1.4));
    }
}
