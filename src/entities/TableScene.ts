import * as THREE from 'three';

export class TableScene {
  public readonly group = new THREE.Group();
  public readonly feltMesh: THREE.Mesh;
  public readonly chipsGroup = new THREE.Group();
  private readonly deckTrayGroup = new THREE.Group();

  constructor() {
    const tableWidth = 18;
    const tableDepth = 12;

    // 1. Dark Casino Floor / Pedestal Under-layer for Depth (Background token #141B18)
    const floorGeo = new THREE.PlaneGeometry(46, 36);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x141b18,
      roughness: 0.95,
      metalness: 0.0,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.35;
    floorMesh.receiveShadow = true;
    this.group.add(floorMesh);

    // 2. Emerald Casino Felt Surface (Table felt token #183E30)
    const feltTexture = this.createFeltTexture();
    feltTexture.wrapS = THREE.RepeatWrapping;
    feltTexture.wrapT = THREE.RepeatWrapping;
    feltTexture.repeat.set(4, 3);
    feltTexture.anisotropy = 8;

    const feltGeo = new THREE.PlaneGeometry(tableWidth, tableDepth, 32, 32);
    const feltMat = new THREE.MeshPhysicalMaterial({
      color: 0x183e30,
      roughness: 0.94,
      metalness: 0.0,
      sheen: 0.12,
      sheenRoughness: 0.9,
      sheenColor: new THREE.Color(0x225542),
      map: feltTexture,
    });

    this.feltMesh = new THREE.Mesh(feltGeo, feltMat);
    this.feltMesh.rotation.x = -Math.PI / 2;
    this.feltMesh.receiveShadow = true;
    this.group.add(this.feltMesh);

    // 3. Multi-layered Mahogany Wood Rails & Brass Corner Brackets
    this.buildMahoganyRails(tableWidth, tableDepth);

    // 4. Center Emblem & Play Zone Markings (Deck Slot, Bita Slot, Battle Arena Ring)
    this.addTableMarkings();

    // 5. Authored 3D Props: Brass Deck Shoe Holder & Casino Chip Stacks
    this.addDeckTray();
    this.addCasinoChipStacks();
    this.group.add(this.deckTrayGroup);
    this.group.add(this.chipsGroup);
  }

  public setMobileLayout(isMobilePortrait: boolean): void {
    if (isMobilePortrait) {
      this.chipsGroup.visible = false;
      this.deckTrayGroup.position.set(3.4, 0.01, -2.4);
    } else {
      this.chipsGroup.visible = true;
      this.deckTrayGroup.position.set(5.8, 0.01, 0);
    }
  }

  private buildMahoganyRails(tableWidth: number, tableDepth: number): void {
    // Satin casino wood rail (Table border token #102B21 - eliminates white specular rail streak)
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x102b21,
      roughness: 0.72,
      metalness: 0.05,
    });

    const leatherCushionMat = new THREE.MeshStandardMaterial({
      color: 0x0c1e17,
      roughness: 0.85,
      metalness: 0.0,
    });

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xc5a65d, // Muted gold accent token #C5A65D
      roughness: 0.42,
      metalness: 0.65,
    });

    const rimThickness = 0.68;
    const rimHeight = 0.42;

    const northRim = new THREE.Mesh(
      new THREE.BoxGeometry(tableWidth + rimThickness * 2, rimHeight, rimThickness),
      woodMat
    );
    northRim.position.set(0, rimHeight / 2 - 0.04, -tableDepth / 2 - rimThickness / 2);
    northRim.castShadow = true;
    northRim.receiveShadow = true;

    const southRim = new THREE.Mesh(
      new THREE.BoxGeometry(tableWidth + rimThickness * 2, rimHeight, rimThickness),
      woodMat
    );
    southRim.position.set(0, rimHeight / 2 - 0.04, tableDepth / 2 + rimThickness / 2);
    southRim.castShadow = true;
    southRim.receiveShadow = true;

    const westRim = new THREE.Mesh(
      new THREE.BoxGeometry(rimThickness, rimHeight, tableDepth),
      woodMat
    );
    westRim.position.set(-tableWidth / 2 - rimThickness / 2, rimHeight / 2 - 0.04, 0);
    westRim.castShadow = true;
    westRim.receiveShadow = true;

    const eastRim = new THREE.Mesh(
      new THREE.BoxGeometry(rimThickness, rimHeight, tableDepth),
      woodMat
    );
    eastRim.position.set(tableWidth / 2 + rimThickness / 2, rimHeight / 2 - 0.04, 0);
    eastRim.castShadow = true;
    eastRim.receiveShadow = true;

    this.group.add(northRim, southRim, westRim, eastRim);

    // Inner padded leather lip
    const innerLipWidth = 0.18;
    const lipN = new THREE.Mesh(new THREE.BoxGeometry(tableWidth, 0.22, innerLipWidth), leatherCushionMat);
    lipN.position.set(0, 0.1, -tableDepth / 2 + innerLipWidth / 2);
    const lipS = new THREE.Mesh(new THREE.BoxGeometry(tableWidth, 0.22, innerLipWidth), leatherCushionMat);
    lipS.position.set(0, 0.1, tableDepth / 2 - innerLipWidth / 2);
    const lipW = new THREE.Mesh(new THREE.BoxGeometry(innerLipWidth, 0.22, tableDepth), leatherCushionMat);
    lipW.position.set(-tableWidth / 2 + innerLipWidth / 2, 0.1, 0);
    const lipE = new THREE.Mesh(new THREE.BoxGeometry(innerLipWidth, 0.22, tableDepth), leatherCushionMat);
    lipE.position.set(tableWidth / 2 - innerLipWidth / 2, 0.1, 0);
    this.group.add(lipN, lipS, lipW, lipE);

    // Brass inlay strips along top of rails
    const stripN = new THREE.Mesh(new THREE.BoxGeometry(tableWidth - 1, 0.03, 0.07), brassMat);
    stripN.position.set(0, rimHeight - 0.02, -tableDepth / 2 - rimThickness / 2);
    const stripS = new THREE.Mesh(new THREE.BoxGeometry(tableWidth - 1, 0.03, 0.07), brassMat);
    stripS.position.set(0, rimHeight - 0.02, tableDepth / 2 + rimThickness / 2);
    const stripW = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, tableDepth - 1), brassMat);
    stripW.position.set(-tableWidth / 2 - rimThickness / 2, rimHeight - 0.02, 0);
    const stripE = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, tableDepth - 1), brassMat);
    stripE.position.set(tableWidth / 2 + rimThickness / 2, rimHeight - 0.02, 0);
    this.group.add(stripN, stripS, stripW, stripE);

    // 4 Brass Corner Plaques with decorative studs
    const cornerPositions = [
      [-tableWidth / 2 - rimThickness / 2, -tableDepth / 2 - rimThickness / 2],
      [tableWidth / 2 + rimThickness / 2, -tableDepth / 2 - rimThickness / 2],
      [-tableWidth / 2 - rimThickness / 2, tableDepth / 2 + rimThickness / 2],
      [tableWidth / 2 + rimThickness / 2, tableDepth / 2 + rimThickness / 2],
    ];

    const cornerGeo = new THREE.BoxGeometry(rimThickness * 1.15, rimHeight + 0.04, rimThickness * 1.15);
    for (const [cx, cz] of cornerPositions) {
      const plaque = new THREE.Mesh(cornerGeo, brassMat);
      plaque.position.set(cx, rimHeight / 2 - 0.03, cz);
      plaque.castShadow = true;
      this.group.add(plaque);
    }
  }

  private addTableMarkings(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 682;
    const ctx = canvas.getContext('2d')!;

    ctx.strokeStyle = 'rgba(197, 166, 93, 0.28)'; // Muted gold token #C5A65D
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(45, 45, 934, 592, 36);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(120, 102, 59, 0.18)'; // Gold border token #78663B
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(58, 58, 908, 566, 28);
    ctx.stroke();

    // Center Royal Medallion
    ctx.save();
    ctx.translate(512, 341);

    ctx.strokeStyle = 'rgba(197, 166, 93, 0.32)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 145, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(120, 102, 59, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 160, 0, Math.PI * 2);
    ctx.stroke();

    // Diamond compass points
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 4);
      ctx.fillStyle = 'rgba(197, 166, 93, 0.25)';
      ctx.beginPath();
      ctx.moveTo(0, -160);
      ctx.lineTo(5, -148);
      ctx.lineTo(0, -138);
      ctx.lineTo(-5, -148);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = 'rgba(197, 166, 93, 0.52)';
    ctx.font = 'bold 34px "Cinzel", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HUGOLAB', 0, -18);

    ctx.fillStyle = 'rgba(184, 191, 180, 0.45)'; // Secondary text token #B8BFB4
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('ROYAL DURAK CLUB', 0, 22);
    ctx.restore();

    // Left Zone: BITA (Discard pile) outline
    ctx.save();
    ctx.translate(160, 341);
    ctx.strokeStyle = 'rgba(197, 166, 93, 0.26)';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-55, -80, 110, 160, 12);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(197, 166, 93, 0.35)';
    ctx.font = 'bold 16px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.fillText('BITA', 0, 102);
    ctx.restore();

    // Right Zone: KALADĖ (Deck & Trump) outline
    ctx.save();
    ctx.translate(842, 341);
    ctx.strokeStyle = 'rgba(197, 166, 93, 0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-55, -80, 110, 160, 12);
    ctx.stroke();
    ctx.fillStyle = 'rgba(197, 166, 93, 0.38)';
    ctx.font = 'bold 16px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.fillText('KALADĖ', 0, 102);
    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;

    const markingsPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(17.2, 11.4),
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0.75, // Non-emissive, subtle integration into felt
        depthWrite: false,
      })
    );
    markingsPlane.rotation.x = -Math.PI / 2;
    markingsPlane.position.y = 0.004;
    this.group.add(markingsPlane);
  }

  private addDeckTray(): void {
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0x78663b, // Gold border token #78663B
      roughness: 0.52,
      metalness: 0.6,
    });

    // Subtle brass framing tray underneath the deck at (5.8, 0, 0)
    this.deckTrayGroup.position.set(5.8, 0.01, 0);

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.015, 2.35), brassMat);
    base.receiveShadow = true;
    this.deckTrayGroup.add(base);

    const railGeo = new THREE.BoxGeometry(0.05, 0.09, 2.35);
    const leftRail = new THREE.Mesh(railGeo, brassMat);
    leftRail.position.set(-0.8, 0.04, 0);
    const rightRail = new THREE.Mesh(railGeo, brassMat);
    rightRail.position.set(0.8, 0.04, 0);
    this.deckTrayGroup.add(leftRail, rightRail);
  }

  private addCasinoChipStacks(): void {
    // Decorative casino chip stacks near table corners to frame the scene
    const chipGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.045, 24);
    const goldChipMat = new THREE.MeshStandardMaterial({
      color: 0xc5a65d, // Muted gold token #C5A65D
      roughness: 0.42,
      metalness: 0.65,
    });
    const crimsonChipMat = new THREE.MeshStandardMaterial({
      color: 0x8e2635, // Card back royal burgundy token #8E2635
      roughness: 0.55,
      metalness: 0.15,
    });
    const obsidianChipMat = new THREE.MeshStandardMaterial({
      color: 0x18201d, // Black suit token #18201D
      roughness: 0.6,
      metalness: 0.15,
    });

    const stacks = [
      { x: -7.4, z: 4.3, count: 7, mat: crimsonChipMat },
      { x: -6.75, z: 4.55, count: 5, mat: goldChipMat },
      { x: -7.1, z: 3.75, count: 4, mat: obsidianChipMat },
      { x: 7.3, z: 4.2, count: 8, mat: goldChipMat },
      { x: 6.65, z: 4.5, count: 5, mat: crimsonChipMat },
      { x: 7.2, z: -4.2, count: 6, mat: obsidianChipMat },
      { x: -7.2, z: -4.1, count: 5, mat: goldChipMat },
    ];

    for (const s of stacks) {
      for (let i = 0; i < s.count; i++) {
        const chip = new THREE.Mesh(chipGeo, s.mat);
        const jitterX = Math.sin(i * 1.7 + s.x) * 0.018;
        const jitterZ = Math.cos(i * 2.3 + s.z) * 0.018;
        chip.position.set(s.x + jitterX, 0.025 + i * 0.046, s.z + jitterZ);
        chip.castShadow = true;
        chip.receiveShadow = true;
        this.chipsGroup.add(chip);
      }
    }
  }

  private createFeltTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#183E30'; // Table felt token #183E30
    ctx.fillRect(0, 0, 256, 256);

    // Cross-woven felt subtle micro-texture (calm, non-reflective)
    for (let i = 0; i < 18000; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const isLight = i % 2 === 0;
      const alpha = Math.random() * 0.025;
      ctx.fillStyle = isLight ? `rgba(255, 255, 255, ${alpha})` : `rgba(0, 0, 0, ${alpha * 1.2})`;
      ctx.fillRect(x, y, 1.5, 1.5);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
}
