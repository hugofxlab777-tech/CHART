import * as THREE from 'three';
import { type Card, SUIT_SYMBOLS, RANK_NAMES_LT } from '../engine/types';

export class CardFactory {
  private static textureCache = new Map<string, THREE.CanvasTexture>();
  private static backTexture: THREE.CanvasTexture | null = null;
  private static cardGeometry: THREE.BufferGeometry | null = null;
  private static edgeMaterial: THREE.MeshStandardMaterial | null = null;
  private static backMaterial: THREE.MeshStandardMaterial | null = null;

  public static readonly CARD_WIDTH = 1.4;
  public static readonly CARD_HEIGHT = 2.1;
  public static readonly CARD_THICKNESS = 0.018;

  public static getCardGeometry(): THREE.BufferGeometry {
    if (!this.cardGeometry) {
      this.cardGeometry = new THREE.BoxGeometry(
        this.CARD_WIDTH,
        this.CARD_THICKNESS,
        this.CARD_HEIGHT
      );
    }
    return this.cardGeometry;
  }

  public static createCardMesh(card: Card): THREE.Group {
    const group = new THREE.Group();
    group.name = `card_${card.id}`;

    const frontTex = this.getFrontTexture(card);
    const backTex = this.getBackTexture();

    if (!this.edgeMaterial) {
      this.edgeMaterial = new THREE.MeshStandardMaterial({
        color: 0xd4ccba, // Card border token #D4CCBA
        roughness: 0.85,
        metalness: 0.0,
      });
    }

    if (!this.backMaterial) {
      this.backMaterial = new THREE.MeshStandardMaterial({
        map: backTex,
        roughness: 0.68,
        metalness: 0.0,
      });
    }

    const frontMat = new THREE.MeshStandardMaterial({
      map: frontTex,
      roughness: 0.72,
      metalness: 0.0,
    });

    const edgeMat = this.edgeMaterial!;
    const backMat = this.backMaterial!;

    // Box materials order: [right, left, top(front), bottom(back), front, back]
    const materials: THREE.MeshStandardMaterial[] = [
      edgeMat,
      edgeMat,
      frontMat,
      backMat,
      edgeMat,
      edgeMat,
    ];
    const mesh = new THREE.Mesh(this.getCardGeometry(), materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Subtle restrained selection outline (hidden by default)
    const outlineGeo = new THREE.EdgesGeometry(this.getCardGeometry());
    const outlineMat = new THREE.LineBasicMaterial({
      color: 0xc5a65d, // Muted gold accent token #C5A65D
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const outline = new THREE.LineSegments(outlineGeo, outlineMat);
    outline.name = 'card_outline';
    group.add(outline);

    group.add(mesh);
    group.userData = { card, isCard: true, outline };
    return group;
  }

  public static getBackTexture(): THREE.CanvasTexture {
    if (this.backTexture) return this.backTexture;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 768;
    const ctx = canvas.getContext('2d')!;

    const drawCardBackFrame = (logoImg?: HTMLImageElement) => {
      // Base outer card paper margin (Card front token #F4F0E6)
      ctx.fillStyle = '#F4F0E6';
      ctx.fillRect(0, 0, 512, 768);

      // Inner royal burgundy background (Card back token #8E2635)
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(18, 18, 476, 732, 22);
      ctx.clip();

      const bgGrad = ctx.createRadialGradient(256, 384, 60, 256, 384, 440);
      bgGrad.addColorStop(0, '#9A2A3A');
      bgGrad.addColorStop(0.65, '#8E2635');
      bgGrad.addColorStop(1, '#6E1A26');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(18, 18, 476, 732);

      // Subtle luxury diagonal filigree pattern in background
      ctx.strokeStyle = 'rgba(197, 166, 93, 0.14)';
      ctx.lineWidth = 1.5;
      const step = 28;
      for (let x = -768; x < 1280; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 768, 768);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x + 768, 0);
        ctx.lineTo(x, 768);
        ctx.stroke();
      }

      // Draw User Logo in the center
      if (logoImg) {
        ctx.save();
        // Rotate 180 deg so when card is flipped around Z=Math.PI, the logo appears upright from camera
        ctx.translate(256, 384);
        // Card back is bottom face (-Y). Standard UV on bottom face is already oriented upright along Z,
        // let's draw centered with crisp portrait framing
        const logoSize = 408;
        ctx.beginPath();
        ctx.roundRect(-logoSize / 2, -logoSize / 2 - 10, logoSize, logoSize, 24);
        ctx.clip();
        ctx.drawImage(logoImg, -logoSize / 2, -logoSize / 2 - 10, logoSize, logoSize);
        ctx.restore();

        // Muted gold frame around logo portrait (token #C5A65D)
        ctx.strokeStyle = '#C5A65D';
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.roundRect(256 - logoSize / 2, 384 - logoSize / 2 - 10, logoSize, logoSize, 24);
        ctx.stroke();
      } else {
        // Fallback emblem before image finishes loading
        ctx.fillStyle = '#C5A65D';
        ctx.font = 'bold 42px "Cinzel", Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('HUGOLAB', 256, 370);
      }

      // Top & Bottom Royal Banners
      ctx.fillStyle = '#C5A65D';
      ctx.font = 'bold 22px "Cinzel", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★ HUGOLAB ★', 256, 92);
      ctx.fillText('DURAK • ROYAL EDITION', 256, 668);

      ctx.restore();

      // Outer gold border (Muted gold token #C5A65D)
      ctx.strokeStyle = '#C5A65D';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.roundRect(22, 22, 468, 724, 20);
      ctx.stroke();

      // Inner fine gold pinstripe (Gold border token #78663B)
      ctx.strokeStyle = '#78663B';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(34, 34, 444, 700, 14);
      ctx.stroke();

      // Corner ornaments
      const corners = [
        [48, 48],
        [464, 48],
        [48, 720],
        [464, 720],
      ];
      ctx.fillStyle = '#C5A65D';
      for (const [cx, cy] of corners) {
        ctx.beginPath();
        ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    drawCardBackFrame();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    this.backTexture = tex;

    // Load user's custom logo image asynchronously and refresh canvas texture
    if (typeof Image !== 'undefined') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        drawCardBackFrame(img);
        tex.needsUpdate = true;
      };
      img.src = '/assets/card-back-logo.png';
    }

    return this.backTexture;
  }

  public static getFrontTexture(card: Card): THREE.CanvasTexture {
    if (this.textureCache.has(card.id)) {
      return this.textureCache.get(card.id)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 768;
    const ctx = canvas.getContext('2d')!;

    // Card background: Warm matte ivory (Card front token #F4F0E6)
    const bgGrad = ctx.createRadialGradient(256, 384, 80, 256, 384, 460);
    bgGrad.addColorStop(0, '#FAF7EF');
    bgGrad.addColorStop(1, '#F4F0E6');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 512, 768);

    // Outer card border (Card border token #D4CCBA)
    ctx.strokeStyle = '#D4CCBA';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(14, 14, 484, 740, 18);
    ctx.stroke();

    // Inner subtle gold pinstripe (Gold border token #78663B)
    ctx.strokeStyle = 'rgba(120, 102, 59, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(24, 24, 464, 720, 12);
    ctx.stroke();

    const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
    // Exact target design tokens: Red #B62F3D, Black #18201D, Muted Gold #C5A65D
    const mainColor = isRed ? '#B62F3D' : '#18201D';
    const accentGold = '#C5A65D';
    const symbol = SUIT_SYMBOLS[card.suit];
    const rank = card.rank;
    const ltName = RANK_NAMES_LT[card.rank] || '';

    ctx.fillStyle = mainColor;

    // Corner Top-Left
    ctx.font = 'bold 68px "Cinzel", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(rank, 66, 86);

    ctx.font = '52px sans-serif';
    ctx.fillText(symbol, 66, 142);

    if (ltName) {
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(ltName.toUpperCase(), 66, 168);
    }

    // Corner Bottom-Right (rotated)
    ctx.save();
    ctx.translate(446, 682);
    ctx.rotate(Math.PI);
    ctx.font = 'bold 68px "Cinzel", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(rank, 0, 0);

    ctx.font = '52px sans-serif';
    ctx.fillText(symbol, 0, 56);

    if (ltName) {
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(ltName.toUpperCase(), 0, 82);
    }
    ctx.restore();

    // Center Art
    ctx.save();
    ctx.translate(256, 384);

    if (['J', 'Q', 'K', 'A'].includes(rank)) {
      // Royal or Ace ornate frame
      ctx.fillStyle = isRed ? 'rgba(182, 47, 61, 0.04)' : 'rgba(24, 32, 29, 0.04)';
      ctx.beginPath();
      ctx.roundRect(-142, -195, 284, 390, 20);
      ctx.fill();

      ctx.strokeStyle = accentGold;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.roundRect(-142, -195, 284, 390, 20);
      ctx.stroke();

      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(-132, -185, 264, 370, 14);
      ctx.stroke();

      // Decorative crown / diamond motif at top of royal frame
      ctx.fillStyle = accentGold;
      ctx.font = 'bold 34px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(rank === 'A' ? '✦' : '♛', 0, -142);

      ctx.fillStyle = mainColor;
      ctx.font = '155px sans-serif';
      ctx.fillText(symbol, 0, -12);

      // Rank banner
      ctx.fillStyle = mainColor;
      ctx.font = 'bold 34px "Cinzel", Georgia, serif';
      ctx.fillText(ltName ? `${rank} • ${ltName.toUpperCase()}` : rank, 0, 122);
    } else {
      // Pip card representation with subtle inner medallion
      ctx.strokeStyle = 'rgba(197, 166, 93, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -10, 115, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = mainColor;
      ctx.font = '168px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(symbol, 0, -10);

      ctx.font = 'bold 40px "Cinzel", Georgia, serif';
      ctx.fillText(rank, 0, 134);
    }

    // Hugolab watermark subtle at bottom
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = 'rgba(24, 32, 29, 0.32)';
    ctx.fillText('HUGOLAB ROYAL', 0, 172);

    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    this.textureCache.set(card.id, tex);
    return tex;
  }
}
