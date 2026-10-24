import * as THREE from 'three';

interface ActivePulse {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  elapsed: number;
  duration: number;
  maxScale: number;
}

interface ActiveSparkBurst {
  points: THREE.Points;
  velocities: Float32Array;
  material: THREE.PointsMaterial;
  elapsed: number;
  duration: number;
}

export class VfxSystem {
  public readonly group = new THREE.Group();
  private pulses: ActivePulse[] = [];
  private bursts: ActiveSparkBurst[] = [];
  private ringGeometry = new THREE.RingGeometry(0.35, 0.55, 32);

  constructor() {
    this.ringGeometry.rotateX(-Math.PI / 2);
  }

  public emitCardImpact(position: THREE.Vector3, isTrump: boolean = false, reducedMotion: boolean = false): void {
    if (reducedMotion) return;

    const colorHex = isTrump ? 0xc5a65d : 0x78663b;

    // 1. Expanding subtle golden shockwave ring on the felt
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const ring = new THREE.Mesh(this.ringGeometry, mat);
    ring.position.set(position.x, 0.04, position.z);
    this.group.add(ring);

    this.pulses.push({
      mesh: ring,
      material: mat,
      elapsed: 0,
      duration: isTrump ? 0.5 : 0.35,
      maxScale: isTrump ? 2.8 : 2.0,
    });

    // 2. Subtle golden spark burst (restrained warm casino sparks)
    const count = isTrump ? 18 : 10;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const speed = (isTrump ? 2.2 : 1.5) + Math.random() * 1.0;
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y + 0.08;
      positions[i * 3 + 2] = position.z;

      velocities[i * 3] = Math.cos(angle) * speed;
      velocities[i * 3 + 1] = 1.0 + Math.random() * 1.2;
      velocities[i * 3 + 2] = Math.sin(angle) * speed;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const pMat = new THREE.PointsMaterial({
      color: isTrump ? 0xdbaf54 : 0xc5a65d,
      size: isTrump ? 0.1 : 0.08,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });

    const points = new THREE.Points(geo, pMat);
    this.group.add(points);

    this.bursts.push({
      points,
      velocities,
      material: pMat,
      elapsed: 0,
      duration: 0.45,
    });
  }

  public update(delta: number): void {
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i];
      p.elapsed += delta;
      const t = Math.min(p.elapsed / p.duration, 1.0);
      const easeOut = 1 - Math.pow(1 - t, 3);

      const scale = 0.6 + (p.maxScale - 0.6) * easeOut;
      p.mesh.scale.set(scale, 1, scale);
      p.material.opacity = (1 - t) * 0.85;

      if (t >= 1.0) {
        this.group.remove(p.mesh);
        p.material.dispose();
        this.pulses.splice(i, 1);
      }
    }

    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.elapsed += delta;
      const t = Math.min(b.elapsed / b.duration, 1.0);

      const posAttr = b.points.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const count = arr.length / 3;

      for (let j = 0; j < count; j++) {
        arr[j * 3] += b.velocities[j * 3] * delta;
        arr[j * 3 + 1] += b.velocities[j * 3 + 1] * delta;
        arr[j * 3 + 2] += b.velocities[j * 3 + 2] * delta;
        b.velocities[j * 3 + 1] -= 5.5 * delta; // gravity
      }
      posAttr.needsUpdate = true;
      b.material.opacity = 1 - t;

      if (t >= 1.0) {
        this.group.remove(b.points);
        b.points.geometry.dispose();
        b.material.dispose();
        this.bursts.splice(i, 1);
      }
    }
  }

  public clear(): void {
    for (const p of this.pulses) {
      this.group.remove(p.mesh);
      p.material.dispose();
    }
    this.pulses = [];
    for (const b of this.bursts) {
      this.group.remove(b.points);
      b.points.geometry.dispose();
      b.material.dispose();
    }
    this.bursts = [];
  }
}

