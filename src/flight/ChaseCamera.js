import * as THREE from 'three';

import { RAPTOR_FLIGHT_FEEL } from './RaptorFlightFeel.js';

const CAM = RAPTOR_FLIGHT_FEEL.camera;
const REF_SPEED = RAPTOR_FLIGHT_FEEL.steer.refSpeed;
const BASE_FOV = CAM.baseFov;

// Câmera de perseguição: segue a nave parcialmente, com atraso natural (molas frame-independentes),
// olha à frente da trajetória, inclina nas curvas e alarga o FOV com a velocidade.
export class ChaseCamera {
    constructor(camera) {
        this.camera = camera;
        this.pos = new THREE.Vector3(0, 8, 75);
        this.look = new THREE.Vector3(0, 2, -5);
        this.roll = 0;
        this.fov = BASE_FOV;
        // Ajustes de sensação (o modo teste altera em tempo real): lag = rigidez da mola de posição.
        this.tuning = { baseFov: BASE_FOV, lag: CAM.lag };
        this.time = 0;
        this._prevVx = 0;
        this.accel = 0;
        this.speedFactor = 1;
        this.altitudeNorm = 0.5;
        this.pitchNorm = 0; // atitude da nave (-1..1): a câmera olha junto com o nariz
        this._alt = 0.5;
        this._target = new THREE.Vector3();
        this._lookT = new THREE.Vector3();
        this._up = new THREE.Vector3();
    }

    reset(x = 0, y = 0) {
        this.pos.set(x * 0.6, 8 + y * 0.6, 75);
        this.look.set(x * 0.6, 2 + y * 0.6, -5);
        this.roll = 0;
    }

    // shipPos: posição de mundo da nave; offset: deslocamento local (ex.: shake); path: FlightPath
    update(dt, shipPos, velocity, path, offset, lookDelta) {
        this.time += dt;
        const vx = THREE.MathUtils.clamp(velocity.x / REF_SPEED, -1.2, 1.2);
        const vy = THREE.MathUtils.clamp(velocity.y / REF_SPEED, -1.2, 1.2);
        const ax = (vx - this._prevVx) / Math.max(dt, 1e-3);
        this._prevVx = vx;
        this.accel += (THREE.MathUtils.clamp(ax, -6, 6) - this.accel) * (1 - Math.exp(-dt * 6));

        this._alt += (this.altitudeNorm - this._alt) * (1 - Math.exp(-dt * 2));
        const altC = this._alt - 0.5;
        const follow = CAM.followX;
        this._target.set(
            shipPos.x * follow - vx * 5,
            8 + shipPos.y * follow - vy * 2 + altC * 4,
            75 - Math.abs(vx) * 2 + altC * 8
        );
        // Mola mais lenta que a nave: atraso natural; a câmera só reage ao que a nave faz.
        const kPos = 1 - Math.exp(-dt * this.tuning.lag);
        this.pos.lerp(this._target, kPos);

        this._lookT.set(shipPos.x * 0.85 + vx * 10, 2 + shipPos.y * 0.75 + this.pitchNorm * CAM.pitchLook, -5);
        this.look.lerp(this._lookT, 1 - Math.exp(-dt * CAM.lookRate));

        // O horizonte inclina junto com a nave (roll da câmera acompanha o lado da curva).
        const rollT = vx * CAM.rollFromSpeed + this.accel * CAM.rollFromAccel;
        this.roll += (rollT - this.roll) * (1 - Math.exp(-dt * CAM.rollRate));

        const fovT = this.tuning.baseFov + Math.abs(vx) * CAM.fovSteerGain + Math.abs(this.accel) * CAM.fovAccelGain + (this.speedFactor - 1) * CAM.fovSpeedGain + altC * 6;
        this.fov += (fovT - this.fov) * (1 - Math.exp(-dt * CAM.fovRate));
        if (Math.abs(this.camera.fov - this.fov) > 0.01) {
            this.camera.fov = this.fov;
            this.camera.updateProjectionMatrix();
        }

        this.camera.position.copy(this.pos);
        if (offset) this.camera.position.add(offset);
        this._up.set(Math.sin(this.roll), Math.cos(this.roll), 0);
        this.camera.up.copy(this._up);
        this._lookT.copy(this.look);
        if (lookDelta) this._lookT.add(lookDelta);
        this.camera.lookAt(this._lookT);
    }
}
