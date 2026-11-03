import * as THREE from 'three';
import { isoOffset } from './camera-math';

export { isoOffset };

const VIEW_HEIGHT = 17;
const ZOOM_MIN = 0.75;
const ZOOM_MAX = 1.4;
const DIST = 60;

export class IsoCamera {
  readonly camera: THREE.OrthographicCamera;
  readonly focus = new THREE.Vector3();
  private aspect = 1;
  private shakeStrength = 0;
  private shakeTime = 0;
  private shakeDuration = 0;
  private readonly offset: THREE.Vector3;
  private readonly raycaster = new THREE.Raycaster();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private targetZoom = 1;
  followSharpness = 6;

  constructor(aspect: number) {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    const o = isoOffset(DIST);
    this.offset = new THREE.Vector3(o.x, o.y, o.z);
    this.resize(aspect);
    this.snapTo(new THREE.Vector3());
  }

  resize(aspect: number): void {
    this.aspect = aspect;
    const h = VIEW_HEIGHT / 2;
    this.camera.left = -h * aspect;
    this.camera.right = h * aspect;
    this.camera.top = h;
    this.camera.bottom = -h;
    this.camera.updateProjectionMatrix();
  }

  get aspectRatio(): number {
    return this.aspect;
  }

  snapTo(target: THREE.Vector3): void {
    this.focus.copy(target);
    this.apply(0);
  }

  follow(target: THREE.Vector3, dt: number): void {
    const k = 1 - Math.exp(-this.followSharpness * dt);
    this.focus.lerp(target, k);
    this.apply(dt);
  }

  zoomBy(delta: number): void {
    this.targetZoom = THREE.MathUtils.clamp(this.targetZoom * (delta > 0 ? 0.9 : 1.1), ZOOM_MIN, ZOOM_MAX);
  }

  setZoom(z: number, immediate = false): void {
    this.targetZoom = z;
    if (immediate) {
      this.camera.zoom = z;
      this.camera.updateProjectionMatrix();
    }
  }

  shake(strength: number, duration: number): void {
    if (strength >= this.shakeStrength * (1 - this.shakeTime / Math.max(this.shakeDuration, 1e-3))) {
      this.shakeStrength = strength;
      this.shakeDuration = duration;
      this.shakeTime = 0;
    }
  }

  private apply(dt: number): void {
    if (Math.abs(this.camera.zoom - this.targetZoom) > 1e-3) {
      this.camera.zoom += (this.targetZoom - this.camera.zoom) * (1 - Math.exp(-8 * dt));
      this.camera.updateProjectionMatrix();
    }
    this.camera.position.copy(this.focus).add(this.offset);
    if (this.shakeTime < this.shakeDuration) {
      this.shakeTime += dt;
      const s = this.shakeStrength * (1 - this.shakeTime / this.shakeDuration);
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.camera.position.z += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(this.camera.position.clone().sub(this.offset));
    this.camera.updateMatrixWorld();
  }

  screenToGround(ndcX: number, ndcY: number, groundY = 0): { x: number; z: number } | null {
    this.groundPlane.constant = -groundY;
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) return null;
    return { x: hit.x, z: hit.z };
  }

  rayFromNdc(ndcX: number, ndcY: number): THREE.Raycaster {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    return this.raycaster;
  }
}
