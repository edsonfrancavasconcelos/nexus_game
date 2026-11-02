import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

// Bloom seletivo: só objetos marcados com markBloom() (motores, plasma, mísseis, explosões) brilham.
export const BLOOM_LAYER = 1;

export function markBloom(object) {
    object.traverse((child) => child.layers.enable(BLOOM_LAYER));
    return object;
}

const MIX_SHADER = {
    uniforms: { tDiffuse: { value: null }, tBloom: { value: null } },
    vertexShader: `varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform sampler2D tBloom; varying vec2 vUv;
        void main() { gl_FragColor = texture2D(tDiffuse, vUv) + vec4(texture2D(tBloom, vUv).rgb, 0.0); }`
};

const GRADE_SHADER = {
    uniforms: {
        tDiffuse: { value: null },
        uSpeed: { value: 1 },
        uTint: { value: new THREE.Vector3(1, 1, 1) },
        uSat: { value: 1.05 },
        uCon: { value: 1.05 }
    },
    vertexShader: MIX_SHADER.vertexShader,
    // Blur radial leve nas bordas (poupa o centro, onde fica a nave), tint, saturação, contraste e vinheta.
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uSpeed; uniform vec3 uTint; uniform float uSat; uniform float uCon;
        varying vec2 vUv;
        void main() {
            vec2 d = vUv - 0.5;
            float r2 = dot(d, d);
            vec3 c = vec3(0.0);
            float amt = 0.04 * uSpeed * r2 * smoothstep(0.06, 0.4, r2);
            for (int i = 0; i < 5; i++) c += texture2D(tDiffuse, 0.5 + d * (1.0 - amt * float(i))).rgb;
            c *= 0.2;
            c *= uTint;
            float l = dot(c, vec3(0.299, 0.587, 0.114));
            c = mix(vec3(l), c, uSat);
            c = (c - 0.5) * uCon + 0.5;
            c *= 1.0 - smoothstep(0.18, 0.75, r2) * 0.2;
            gl_FragColor = vec4(max(c, 0.0), 1.0);
        }`
};

export class BloomPipeline {
    constructor(renderer, scene, camera, { strength = 0.55, radius = 0.35, threshold = 0.15, resolutionScale = 0.5, msaaSamples = 0 } = {}) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.resolutionScale = resolutionScale;

        this.bloomComposer = new EffectComposer(renderer);
        this.bloomComposer.renderToScreen = false;
        this.bloomComposer.addPass(new RenderPass(scene, camera));
        this.bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), strength, radius, threshold);
        this.bloomComposer.addPass(this.bloomPass);

        // MSAA no render principal (serrilhado sem borrar detalhes); sem MSAA, cai no FXAA.
        const msaa = Math.min(msaaSamples, renderer.capabilities.maxSamples || 0);
        let finalTarget;
        if (msaa > 0) {
            finalTarget = new THREE.WebGLRenderTarget(256, 256, { type: THREE.HalfFloatType, samples: msaa });
        }
        this.finalComposer = new EffectComposer(renderer, finalTarget);
        this.finalComposer.addPass(new RenderPass(scene, camera));
        const mix = new ShaderPass(new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                tBloom: { value: this.bloomComposer.renderTarget2.texture }
            },
            vertexShader: MIX_SHADER.vertexShader,
            fragmentShader: MIX_SHADER.fragmentShader
        }), 'tDiffuse');
        mix.needsSwap = true;
        this.finalComposer.addPass(mix);
        this.finalComposer.addPass(new OutputPass());
        this.grade = new ShaderPass(new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(GRADE_SHADER.uniforms),
            vertexShader: GRADE_SHADER.vertexShader,
            fragmentShader: GRADE_SHADER.fragmentShader
        }));
        this.finalComposer.addPass(this.grade);
        // FXAA depois do OutputPass, que já entrega a imagem em sRGB (renderer sem MSAA).
        this.fxaaPass = new ShaderPass(FXAAShader);
        this.fxaaPass.enabled = msaa === 0;
        this.finalComposer.addPass(this.fxaaPass);
    }

    setSize(width, height, pixelRatio) {
        this.finalComposer.setPixelRatio(pixelRatio);
        this.finalComposer.setSize(width, height);
        this.bloomComposer.setPixelRatio(pixelRatio * this.resolutionScale);
        this.bloomComposer.setSize(width, height);
        this.fxaaPass.material.uniforms.resolution.value.set(1 / (width * pixelRatio), 1 / (height * pixelRatio));
    }

    render() {
        const { scene, camera } = this;
        const background = scene.background;
        scene.background = null;
        camera.layers.set(BLOOM_LAYER);
        this.bloomComposer.render();
        camera.layers.enableAll();
        scene.background = background;
        this.finalComposer.render();
    }
}
