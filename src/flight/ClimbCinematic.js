import * as THREE from 'three';

// Apresentação da subida: aplicada DEPOIS da ChaseCamera, só como deslocamento visual da câmera
// (recuo, leve inclinação para cima, FOV). Não toca na nave, no mundo nem nos controles.
const MAX_CLIMB = 26; // u/s de referência (mesma ordem do climbGain do perfil de voo)
const PRESENT = {
    pullBack: 14,   // câmera recua e fica menor a nave: sensação de escala
    drop: 3.5,      // câmera fica um pouco abaixo da nave: o caça "sobe" contra o céu
    pitch: 0.075,   // rad: o horizonte desce no quadro
    fov: 5,         // alargamento ao subir
    diveScale: 0.35, // na descida o efeito é mais discreto
    rate: 1.6       // suavização (maior = mais rápido)
};

export class ClimbCinematic {
    constructor(camera) {
        this.camera = camera;
        this.k = 0; // -1..1 suavizado
    }

    apply(dt, climbRate, baseFov) {
        const cam = this.camera;
        const target = THREE.MathUtils.clamp(climbRate / MAX_CLIMB, -1, 1);
        this.k += (target - this.k) * (1 - Math.exp(-dt * PRESENT.rate));
        const k = this.k > 0 ? this.k : this.k * PRESENT.diveScale;
        // Curva suave: pequenas subidas quase não mexem; subidas fortes ganham o efeito cheio.
        const e = Math.sign(k) * Math.pow(Math.abs(k), 1.3);

        cam.position.z += PRESENT.pullBack * e;
        cam.position.y -= PRESENT.drop * e;
        cam.rotateX(PRESENT.pitch * e);

        // Define o FOV a partir do valor-base da ChaseCamera (sem acumular entre quadros).
        const fov = baseFov + PRESENT.fov * e;
        if (Math.abs(cam.fov - fov) > 0.01) {
            cam.fov = fov;
            cam.updateProjectionMatrix();
        }
    }
}
