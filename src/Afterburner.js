import * as THREE from 'three';

// Exaustão de pós-combustão: 3 cones com ShaderMaterial aditivo + um InstancedMesh
// de riscos alongados. Tudo é criado uma única vez; o update só altera uniforms
// e matrizes de instâncias já existentes (sem alocação por frame).

const VERT = /* glsl */`
uniform float uTime;
uniform float uDistort;
varying float vT;
varying float vA;
void main() {
    vT = uv.y;
    vA = uv.x;
    vec3 p = position;
    float ang = atan(p.x, p.y);
    float w = sin(vT * 14.0 - uTime * 28.0 + ang * 3.0) * 0.5
            + sin(vT * 31.0 - uTime * 41.0 + ang * 5.0) * 0.5;
    p.xy *= 1.0 + w * uDistort * vT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const FRAG = /* glsl */`
precision mediump float;
uniform float uTime;
uniform float uIntensity;
uniform float uFalloff;
uniform float uDiamonds;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorTip;
varying float vT;
varying float vA;
void main() {
    float fade = pow(clamp(1.0 - vT, 0.0, 1.0), uFalloff);
    float nozzle = smoothstep(0.0, 0.07, vT);
    float flick = 0.86 + 0.14 * sin(uTime * 40.0 + vT * 20.0);
    float turb = 0.88 + 0.12 * sin(vA * 31.4159 + uTime * 22.0 - vT * 12.0);
    float diamonds = uDiamonds * pow(max(0.0, sin(vT * 34.0 - uTime * 5.0)), 6.0) * (1.0 - vT);
    vec3 col = mix(uColorA, uColorB, smoothstep(0.0, 0.65, vT));
    col = mix(col, uColorTip, smoothstep(0.5, 1.0, vT));
    col *= 1.0 + diamonds;
    float a = fade * nozzle * uIntensity * flick * turb;
    gl_FragColor = vec4(col, a);
}`;

function makeConeGeometry(radius, radial, tip) {
    // Ponta (raio ~0) em -z, bocal em z=0, comprimento unitário.
    const g = new THREE.CylinderGeometry(radius * tip, radius, 1, radial, 6, true);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -0.5);
    return g;
}

const LAYERS = [
    { name: 'plasma', radius: 1.8, tip: 0.45, length: 8.0, falloff: 1.3, intensity: 0.75, diamonds: 0.0, distort: 0.16,
      a: [0.45, 0.2, 1.0], b: [0.1, 0.45, 1.0], tc: [0.2, 0.9, 1.0] },
    { name: 'mid', radius: 1.2, tip: 0.3, length: 6.0, falloff: 1.1, intensity: 1.1, diamonds: 0.0, distort: 0.1,
      a: [0.2, 0.55, 1.0], b: [0.3, 0.8, 1.0], tc: [0.3, 0.95, 1.0] },
    { name: 'core', radius: 0.55, tip: 0.2, length: 4.2, falloff: 1.1, intensity: 1.15, diamonds: 0.6, distort: 0.05,
      a: [1.0, 1.0, 1.0], b: [0.55, 0.8, 1.0], tc: [0.15, 0.4, 1.0] }
];

export class Afterburner {
    constructor(parent, position, { mobile = false } = {}) {
        this.group = new THREE.Group();
        this.group.position.copy(position);
        this.group.renderOrder = 5;
        parent.add(this.group);

        this.throttle = 0.3;
        this.time = 0;
        this.layers = LAYERS.map((cfg, i) => {
            const material = new THREE.ShaderMaterial({
                vertexShader: VERT,
                fragmentShader: FRAG,
                transparent: true,
                depthWrite: false,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                uniforms: {
                    uTime: { value: 0 },
                    uDistort: { value: cfg.distort },
                    uIntensity: { value: cfg.intensity },
                    uFalloff: { value: cfg.falloff },
                    uDiamonds: { value: cfg.diamonds },
                    uColorA: { value: new THREE.Color(...cfg.a) },
                    uColorB: { value: new THREE.Color(...cfg.b) },
                    uColorTip: { value: new THREE.Color(...cfg.tc) }
                }
            });
            const mesh = new THREE.Mesh(makeConeGeometry(cfg.radius, mobile ? 10 : 16, cfg.tip), material);
            mesh.renderOrder = 5 + i;
            mesh.frustumCulled = false;
            this.group.add(mesh);
            return { cfg, mesh, material };
        });

        // Riscos finos e alongados (cilindros de 3 faces), uma única draw call.
        this.streakCount = mobile ? 8 : 14;
        const geo = new THREE.CylinderGeometry(0.025, 0.025, 1, 3, 1, true);
        geo.rotateX(Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.streaks = new THREE.InstancedMesh(geo, mat, this.streakCount);
        this.streaks.frustumCulled = false;
        this.streaks.renderOrder = 9;
        this.streaks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.streaks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.streakCount * 3), 3);
        this.group.add(this.streaks);

        this._state = Array.from({ length: this.streakCount }, () => ({ phase: Math.random(), x: 0, y: 0, speed: 1, len: 1 }));
        this._state.forEach((s) => this._respawn(s));
        this._dummy = new THREE.Object3D();
        this._tint = new THREE.Color();
    }

    _respawn(s) {
        const a = Math.random() * Math.PI * 2;
        const r = 0.2 + Math.random() * 0.9;
        s.x = Math.cos(a) * r;
        s.y = Math.sin(a) * r;
        s.speed = 1.6 + Math.random() * 1.4;
        s.len = 0.8 + Math.random() * 1.2;
        s.phase = 0;
    }

    setActive(active) {
        this.group.visible = !!active;
    }

    // target: 0..1 (aceleração atual). Suaviza subida e descida.
    update(dt, target) {
        if (!this.group.visible) return;
        this.time += dt;
        const k = 1 - Math.exp(-(target > this.throttle ? 8 : 3) * dt);
        this.throttle += (target - this.throttle) * k;

        const th = this.throttle;
        const pulse = 1 + Math.sin(this.time * 31) * 0.03 + Math.sin(this.time * 13) * 0.02;
        for (const { cfg, mesh, material } of this.layers) {
            const u = material.uniforms;
            u.uTime.value = this.time;
            u.uIntensity.value = cfg.intensity * (0.55 + 0.6 * th);
            const w = (0.82 + 0.3 * th) * pulse;
            mesh.scale.set(w, w, cfg.length * (0.5 + 0.95 * th) * pulse);
        }

        const dummy = this._dummy;
        const reach = 7 * (0.5 + 0.9 * th);
        for (let i = 0; i < this.streakCount; i++) {
            const s = this._state[i];
            s.phase += dt * s.speed;
            if (s.phase >= 1) this._respawn(s);
            const p = s.phase;
            const z = -p * reach;
            const len = s.len * (0.6 + th);
            dummy.position.set(s.x * (1 + p * 0.6), s.y * (1 + p * 0.6), z - len * 0.5);
            dummy.scale.set(1, 1, len);
            dummy.updateMatrix();
            this.streaks.setMatrixAt(i, dummy.matrix);
            const v = Math.max(0, 1 - p) * 0.55 * (0.4 + th);
            this.streaks.setColorAt(i, this._tint.setRGB(0.55 * v, 0.85 * v, v));
        }
        this.streaks.instanceMatrix.needsUpdate = true;
        this.streaks.instanceColor.needsUpdate = true;
    }

    dispose() {
        this.group.parent?.remove(this.group);
        for (const { mesh, material } of this.layers) {
            mesh.geometry.dispose();
            material.dispose();
        }
        this.streaks.geometry.dispose();
        this.streaks.material.dispose();
        this.streaks.dispose();
    }
}
