import * as THREE from 'three';

export class ScorePopup {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.popups = [];
    }

    show(points, position) {
        const scoreElement = document.createElement('div');
        const isMobile = window.innerWidth < 900;

        scoreElement.className = 'score-popup';
        scoreElement.textContent = `+${points}`;
        
        // Estilização básica via JS (pode mover para o CSS se preferir)
        Object.assign(scoreElement.style, {
            position: 'absolute',
            color: '#ffff00',
            fontSize: isMobile ? '18px' : '24px',
            fontWeight: 'bold',
            textShadow: '0 0 8px #ff0000',
            pointerEvents: 'none',
            zIndex: '100',
            whiteSpace: 'nowrap',
            transition: 'opacity 0.1s linear' // Deixa o sumiço suave
        });

        document.body.appendChild(scoreElement);

        this.popups.push({
            element: scoreElement,
            life: 1.8,
            position: position.clone(),
            velocity: new THREE.Vector3(0, isMobile ? 12 : 8, 0)
        });
    }

    update(deltaTime) {
        if (!deltaTime) return;

        for (let i = this.popups.length - 1; i >= 0; i--) {
            const p = this.popups[i];
            p.life -= deltaTime;

            // Movimento vertical do popup
            p.position.y += p.velocity.y * deltaTime;
            p.velocity.y *= 0.90; // Decaimento da velocidade

            // Remove se o tempo acabar
            if (p.life <= 0) {
                if (p.element.parentNode) p.element.remove();
                this.popups.splice(i, 1);
                continue;
            }

            // Atualiza posição na tela (Projeção 3D -> 2D)
            const vector = p.position.clone().project(this.camera);
            const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;

            // Aplica posição ao DOM
            p.element.style.left = `${x}px`;
            p.element.style.top = `${y}px`;
            p.element.style.opacity = Math.max(0, p.life / 1.8);
            p.element.style.transform = `scale(${1 + (1.8 - p.life) * 0.15})`;
        }
    }
}