import * as THREE from 'three';

/**
 * Free GPU resources under `root`. Geometry from cachedGeo() and materials flagged
 * userData.shared are reused across scenes and are left alone.
 */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((o) => {
    const light = o as THREE.Light & { shadow?: THREE.LightShadow };
    if (light.isLight && light.shadow) light.shadow.dispose();
    const m = o as THREE.Mesh;
    if (!m.geometry && !m.material) return;
    if (m.geometry && !m.geometry.userData.cached) m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) if (!mat.userData.shared) mat.dispose();
  });
}

export function markShared<T extends THREE.Material>(mat: T): T {
  mat.userData.shared = true;
  return mat;
}
