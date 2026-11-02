export class InputManager {
    constructor() {
        this.moveInput = { x: 0, y: 0 };
        this.keys = {
            ArrowUp: false,
            ArrowDown: false,
            ArrowLeft: false,
            ArrowRight: false,
            Space: false // Certifique-se de que o event.code enviado seja exatamente 'Space'
        };

        this.inputAcceleration = 0.3;
        this.inputRelease = 0.36;
        this.currentX = 0;
        this.currentY = 0;
        this.joystickActive = false;

        this._initKeyboard();
        this._initJoystick();
    }

    _initKeyboard() {
        window.addEventListener('keydown', (event) => {
            if (Object.prototype.hasOwnProperty.call(this.keys, event.code)) {
                event.preventDefault();
                this.keys[event.code] = true;
            }
        });

        window.addEventListener('keyup', (event) => {
            if (Object.prototype.hasOwnProperty.call(this.keys, event.code)) {
                this.keys[event.code] = false;
            }
        });

        window.addEventListener('blur', () => {
            for (let key in this.keys) {
                this.keys[key] = false;
            }
            this.currentX = 0;
            this.currentY = 0;
            this.moveInput.x = 0;
            this.moveInput.y = 0;
        });
    }

    _initJoystick() {
        const joystickArea = document.getElementById('joystick-area');
        const stick = document.getElementById('stick');

        if (!joystickArea || !stick) return;

        let touchStartX = 0;
        let touchStartY = 0;
        const maxDistance = 65;

        joystickArea.addEventListener('touchstart', (event) => {
            this.joystickActive = true;
            const touch = event.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
        }, { passive: false });

        joystickArea.addEventListener('touchmove', (event) => {
            if (!this.joystickActive) return;
            event.preventDefault();

            const touch = event.touches[0];
            const deltaX = touch.clientX - touchStartX;
            const deltaY = touch.clientY - touchStartY;

            const distance = Math.min(Math.sqrt(deltaX * deltaX + deltaY * deltaY), maxDistance);
            const angle = Math.atan2(deltaY, deltaX);

            const moveX = Math.cos(angle) * distance;
            const moveY = Math.sin(angle) * distance;

            stick.style.transform = `translate(${moveX}px, ${moveY}px) scale(1.15)`;
            this.moveInput.x = moveX / maxDistance;
            this.moveInput.y = -(moveY / maxDistance);
        }, { passive: false });

        joystickArea.addEventListener('touchend', () => {
            this.joystickActive = false;
            stick.style.transform = 'translate(0px, 0px) scale(1)';
            this.moveInput.x = 0;
            this.moveInput.y = 0;
        });
    }

    update(deltaTime = 1 / 60) {
        if (!this.joystickActive) {
            let targetX = 0, targetY = 0;
            if (this.keys.ArrowLeft) targetX = -1;
            if (this.keys.ArrowRight) targetX = 1;
            if (this.keys.ArrowUp) targetY = 1;
            if (this.keys.ArrowDown) targetY = -1;

            // Resposta mais rápida e independente do FPS; ao soltar ou inverter, a entrada volta mais depressa.
            const frames = Math.min(deltaTime, 0.1) * 60;
            const rate = (target, current) => {
                const base = Math.abs(target) > Math.abs(current) && target * current >= 0 ? this.inputAcceleration : this.inputRelease;
                return 1 - Math.pow(1 - base, frames);
            };
            this.currentX += (targetX - this.currentX) * rate(targetX, this.currentX);
            this.currentY += (targetY - this.currentY) * rate(targetY, this.currentY);
            
            return { 
                x: this.currentX, 
                y: this.currentY,
                isFiring: this.keys.Space // Adicionei isso caso você precise disparar pelo teclado
            };
        }
        
        return { 
            x: this.moveInput.x * 1.7, 
            y: this.moveInput.y * 1.7,
            isFiring: false // Joystick normalmente não dispara aqui, a menos que tenha botão extra
        };
    }
}