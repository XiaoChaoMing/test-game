import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { disposeObject } from '../../src/render/dispose';
import { cachedGeo } from '../../src/render/characters/rig';

describe('disposeObject', () => {
  it('disposes owned geometries and materials but keeps shared cached geometry', () => {
    const root = new THREE.Group();
    const ownGeo = new THREE.BoxGeometry(1, 1, 1);
    const ownMat = new THREE.MeshBasicMaterial();
    const shared = cachedGeo('test-shared', () => new THREE.BoxGeometry(2, 2, 2));
    root.add(new THREE.Mesh(ownGeo, ownMat), new THREE.Mesh(shared, ownMat));
    const disposed: string[] = [];
    ownGeo.addEventListener('dispose', () => disposed.push('ownGeo'));
    ownMat.addEventListener('dispose', () => disposed.push('ownMat'));
    shared.addEventListener('dispose', () => disposed.push('shared'));
    disposeObject(root);
    expect(disposed).toContain('ownGeo');
    expect(disposed).toContain('ownMat');
    expect(disposed).not.toContain('shared');
  });
  it('disposes a light shadow map', () => {
    const l = new THREE.DirectionalLight();
    let called = false;
    l.shadow.dispose = () => {
      called = true;
    };
    const root = new THREE.Group();
    root.add(l);
    disposeObject(root);
    expect(called).toBe(true);
  });
});
