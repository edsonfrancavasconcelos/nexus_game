import * as THREE from 'three';

export class ScorePopup {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.popups = [];
        this.pool = [];
        this._v = new THREE.Vector3();
    }

    show(points, position) {
        const isMobile = window.innerWidth < 900;
        let scoreElement = this.pool.pop();
        if (!scoreElement) {
            scoreElement = document.createElement('div');
            scoreElement.className = 'score-popup';
            Object.assign(scoreElement.style, {
                position: 'absolute',
                left: '0',
                top: '0',
                color: '#ffff00',
                fontWeight: 'bold',
                textShadow: '0 0 8px #ff0000',
                pointerEvents: 'none',
                zIndex: '100',
                whiteSpace: 'nowrap',
                willChange: 'transform, opacity'
            });
        }
        scoreElement.textContent = `+${points}`;
        scoreElement.style.fontSize = isMobile ? '18px' : '24px';
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
                this.pool.push(p.element);
                this.popups.splice(i, 1);
                continue;
            }

            // Atualiza posição na tela (Projeção 3D -> 2D)
            const vector = this._v.copy(p.position).project(this.camera);
            const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;

            // transform/opacity são compostos na GPU (sem relayout)
            p.element.style.opacity = Math.max(0, p.life / 1.8);
            p.element.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${1 + (1.8 - p.life) * 0.15})`;
        }
    }
}