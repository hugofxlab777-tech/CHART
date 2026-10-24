import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { type GraphicsSettings } from './GraphicsQuality';

export function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

export function applyGraphicsSettingsToRenderer(
  renderer: THREE.WebGLRenderer,
  settings: GraphicsSettings
): void {
  renderer.shadowMap.enabled = settings.shadowMapEnabled;
  if (renderer.shadowMap.enabled) {
    renderer.shadowMap.type = settings.effectivePreset === 'high' ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
  }
}

export function setupEnvironmentAndPost(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera
): EffectComposer {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.22; // Subtle ambient reflections without washing out card surfaces
  pmrem.dispose();

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // Note: UnrealBloomPass intentionally omitted to completely eliminate overexposed white glow and halos around cards and table rails
  composer.addPass(new OutputPass());

  return composer;
}

export interface ViewportFramingInfo {
  isMobilePortrait: boolean;
  isMobileLandscape: boolean;
}

export function updateCameraFraming(
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number
): ViewportFramingInfo {
  const aspect = width / height;
  const isPortrait = aspect < 1.0;
  const isShortLandscape = height <= 520 && aspect >= 1.4;

  if (isPortrait) {
    // Narrow portrait phone: elevated camera framing to keep table, center bouts, deck and hand in view
    camera.fov = 54;
    camera.position.set(0, 15.6, 12.8);
    camera.lookAt(0, 0, 0.4);
    return { isMobilePortrait: true, isMobileLandscape: false };
  } else if (isShortLandscape) {
    // Wide short landscape phone (e.g. 844x390, 932x430)
    camera.fov = 42;
    camera.position.set(0, 9.4, 8.8);
    camera.lookAt(0, 0, 0.4);
    return { isMobilePortrait: false, isMobileLandscape: true };
  } else {
    // Standard desktop or tablet
    camera.fov = 44;
    camera.position.set(0, 11.2, 10.6);
    camera.lookAt(0, 0, 0.45);
    return { isMobilePortrait: false, isMobileLandscape: false };
  }
}

export function resizeRenderer(
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
  composer?: EffectComposer,
  maxDpr = 2,
): boolean {
  const canvas = renderer.domElement;
  const width = Math.max(1, Math.floor(canvas.clientWidth));
  const height = Math.max(1, Math.floor(canvas.clientHeight));
  const isMobile = width < 768;
  const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? Math.min(maxDpr, 1.5) : maxDpr);
  const bufferWidth = Math.floor(width * dpr);
  const bufferHeight = Math.floor(height * dpr);
  const needsResize = canvas.width !== bufferWidth || canvas.height !== bufferHeight;

  if (needsResize) {
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    if (composer) {
      composer.setPixelRatio(dpr);
      composer.setSize(width, height);
    }
    camera.aspect = width / height;
    updateCameraFraming(camera, width, height);
    camera.updateProjectionMatrix();
  }

  return needsResize;
}
