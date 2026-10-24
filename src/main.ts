import './styles.css';
import { Game } from './game/Game';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) {
  throw new Error('Could not find #game-canvas element.');
}

const game = new Game(canvas);
game.start();

window.addEventListener('beforeunload', () => {
  game.dispose();
});
