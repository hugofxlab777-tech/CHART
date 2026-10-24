import * as THREE from 'three';

export interface CardAnimation {
  mesh: THREE.Group;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  startRot: THREE.Euler;
  targetRot: THREE.Euler;
  startScale: number;
  targetScale: number;
  duration: number;
  elapsed: number;
  peakY: number;
  onComplete?: () => void;
}

export class CardAnimator {
  private activeAnimations: CardAnimation[] = [];

  public animateTo(
    mesh: THREE.Group,
    targetPos: THREE.Vector3,
    targetRot: THREE.Euler,
    duration: number = 0.35,
    peakY: number = 0.8,
    onComplete?: () => void,
    targetScale?: number
  ): void {
    // Remove any existing animation for this mesh
    this.activeAnimations = this.activeAnimations.filter((a) => a.mesh !== mesh);

    this.activeAnimations.push({
      mesh,
      startPos: mesh.position.clone(),
      targetPos: targetPos.clone(),
      startRot: mesh.rotation.clone(),
      targetRot: targetRot.clone(),
      startScale: mesh.scale.x,
      targetScale: targetScale ?? mesh.scale.x,
      duration: Math.max(duration, 0.05),
      elapsed: 0,
      peakY,
      onComplete,
    });
  }

  public update(delta: number): void {
    for (let i = this.activeAnimations.length - 1; i >= 0; i--) {
      const anim = this.activeAnimations[i];
      anim.elapsed += delta;
      const t = Math.min(anim.elapsed / anim.duration, 1.0);

      // Smooth ease-out quad
      const ease = 1 - (1 - t) * (1 - t);

      // Parabolic arc for position Y
      const currentPos = new THREE.Vector3().lerpVectors(anim.startPos, anim.targetPos, ease);
      const arc = Math.sin(t * Math.PI) * anim.peakY;
      currentPos.y += arc;
      anim.mesh.position.copy(currentPos);

      // Rotation slerp
      const qStart = new THREE.Quaternion().setFromEuler(anim.startRot);
      const qTarget = new THREE.Quaternion().setFromEuler(anim.targetRot);
      const qCurrent = new THREE.Quaternion().slerpQuaternions(qStart, qTarget, ease);
      anim.mesh.setRotationFromQuaternion(qCurrent);

      const currentScale = anim.startScale + (anim.targetScale - anim.startScale) * ease;
      anim.mesh.scale.setScalar(currentScale);

      if (t >= 1.0) {
        anim.mesh.position.copy(anim.targetPos);
        anim.mesh.rotation.copy(anim.targetRot);
        anim.mesh.scale.setScalar(anim.targetScale);
        if (anim.onComplete) anim.onComplete();
        this.activeAnimations.splice(i, 1);
      }
    }
  }

  public finishAll(): void {
    for (const anim of this.activeAnimations) {
      anim.mesh.position.copy(anim.targetPos);
      anim.mesh.rotation.copy(anim.targetRot);
      anim.mesh.scale.setScalar(anim.targetScale);
      if (anim.onComplete) anim.onComplete();
    }
    this.activeAnimations = [];
  }
}

