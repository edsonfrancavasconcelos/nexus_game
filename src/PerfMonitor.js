// Diagnóstico (ativar com ?debug=1 ou tecla F3) + qualidade adaptativa por FPS.
export class PerfMonitor {
    constructor(renderer, scene, { isMobile = false, maxPixelRatio = 1.5, minPixelRatio = 0.6, onScaleChange = null } = {}) {
        this.renderer = renderer;
        this.scene = scene;
        this.isMobile = isMobile;
        this.maxPixelRatio = maxPixelRatio;
        this.minPixelRatio = minPixelRatio;
        this.onScaleChange = onScaleChange;
        this.pixelRatio = maxPixelRatio;
        this.frames = 0;
        this.acc = 0;
        this.worst = 0;
        this.fps = 60;
        this.slowWindows = 0;
        this.fastWindows = 0;
        this.el = null;
        this.enabled = false;

        if (/[?&]debug=1/.test(location.search)) this.setEnabled(true);
        window.addEventListener('keydown', (e) => { if (e.code === 'F3') this.setEnabled(!this.enabled); });
    }

    setEnabled(on) {
        this.enabled = on;
        if (on && !this.el) {
            this.el = document.createElement('pre');
            this.el.style.cssText = 'position:fixed;top:4px;left:4px;margin:0;padding:4px 6px;z-index:99999;'
                + 'font:11px monospace;color:#0f0;background:rgba(0,0,0,.6);pointer-events:none;';
            document.body.appendChild(this.el);
        }
        if (this.el) this.el.style.display = on ? 'block' : 'none';
    }

    // Chamar uma vez por frame renderizado
    tick(dt) {
        this.frames++;
        this.acc += dt;
        if (dt > this.worst) this.worst = dt;
        if (this.acc < 1) return;

        this.fps = this.frames / this.acc;
        this.frames = 0;
        this.acc = 0;
        this._adapt();
        if (this.enabled) this._report();
        this.worst = 0;
    }

    // Escala dinâmica de resolução: baixa rápido ao cair do alvo, sobe devagar quando sobra folga
    _adapt() {
        if (this.fps < 48) { this.slowWindows++; this.fastWindows = 0; }
        else if (this.fps > 57) { this.fastWindows++; this.slowWindows = 0; }
        else { this.slowWindows = 0; this.fastWindows = 0; }

        let next = this.pixelRatio;
        if (this.slowWindows >= 2) { next = Math.max(this.minPixelRatio, this.pixelRatio - 0.15); this.slowWindows = 0; }
        else if (this.fastWindows >= 6) { next = Math.min(this.maxPixelRatio, this.pixelRatio + 0.1); this.fastWindows = 0; }

        if (next !== this.pixelRatio) {
            this.pixelRatio = next;
            this.onScaleChange?.(next);
        }
    }

    _report() {
        const info = this.renderer.info;
        let objects = 0;
        this.scene.traverse(() => { objects++; });
        const mem = performance.memory ? `${(performance.memory.usedJSHeapSize / 1048576).toFixed(0)} MB` : 'n/d';
        this.el.textContent =
            `FPS ${this.fps.toFixed(0)}  frame ${(1000 / this.fps).toFixed(1)}ms (pior ${(this.worst * 1000).toFixed(0)}ms)  res x${this.pixelRatio.toFixed(2)}\n` +
            `Draw calls ${info.render.calls}  Tris ${info.render.triangles}\n` +
            `Geo ${info.memory.geometries}  Tex ${info.memory.textures}  Prog ${info.programs?.length ?? 0}\n` +
            `Objetos ${objects}  JS heap ${mem}`;
    }
}
