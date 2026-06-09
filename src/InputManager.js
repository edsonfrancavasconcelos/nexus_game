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

        this.inputAcceleration = 0.22;
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

    update() {
        if (!this.joystickActive) {
            let targetX = 0, targetY = 0;
            if (this.keys.ArrowLeft) targetX = -1;
            if (this.keys.ArrowRight) targetX = 1;
            if (this.keys.ArrowUp) targetY = 1;
            if (this.keys.ArrowDown) targetY = -1;

            this.currentX += (targetX - this.currentX) * this.inputAcceleration;
            this.currentY += (targetY - this.currentY) * this.inputAcceleration;
            
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