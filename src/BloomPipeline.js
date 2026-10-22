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

export class BloomPipeline {
    constructor(renderer, scene, camera, { strength = 0.55, radius = 0.35, threshold = 0.15, resolutionScale = 0.5 } = {}) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.resolutionScale = resolutionScale;

        this.bloomComposer = new EffectComposer(renderer);
        this.bloomComposer.renderToScreen = false;
        this.bloomComposer.addPass(new RenderPass(scene, camera));
        this.bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), strength, radius, threshold);
        this.bloomComposer.addPass(this.bloomPass);

        this.finalComposer = new EffectComposer(renderer);
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
        // FXAA depois do OutputPass, que já entrega a imagem em sRGB (renderer sem MSAA).
        this.fxaaPass = new ShaderPass(FXAAShader);
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
