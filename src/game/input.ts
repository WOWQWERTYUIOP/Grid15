import { PlayerInput } from '../types/game';

export class InputManager {
  private keyState: { [key: string]: boolean } = {};
  public touchInput: PlayerInput = {
    throttle: 0,
    brake: 0,
    steer: 0,
    boost: false,
    usePowerUp: false,
    respawn: false,
  };

  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;

  constructor() {
    this.boundKeyDown = (e: KeyboardEvent) => {
      // Prevent default page scrolling for racing keys
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyE', 'KeyR', 'ShiftLeft'].includes(e.code)) {
        e.preventDefault();
      }
      this.keyState[e.code] = true;
    };

    this.boundKeyUp = (e: KeyboardEvent) => {
      this.keyState[e.code] = false;
    };

    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
  }

  public getInput(): PlayerInput {
    // Keyboard inputs
    const isW = this.keyState['KeyW'] || this.keyState['ArrowUp'];
    const isS = this.keyState['KeyS'] || this.keyState['ArrowDown'];
    const isA = this.keyState['KeyA'] || this.keyState['ArrowLeft'];
    const isD = this.keyState['KeyD'] || this.keyState['ArrowRight'];
    const isSpace = this.keyState['Space'];
    const isE = this.keyState['KeyE'];
    const isShift = this.keyState['ShiftLeft'] || this.keyState['ShiftRight'] || this.keyState['KeyN'];
    const isR = this.keyState['KeyR'];

    let throttle = isW ? 1.0 : 0;
    let brake = isS ? 1.0 : 0;
    let steer = 0;

    // A / Left Arrow = Steer Left (-1.0)
    // D / Right Arrow = Steer Right (+1.0)
    if (isA && !isD) steer = -1.0;
    else if (isD && !isA) steer = 1.0;

    // Space / E = Use Power-up
    const usePowerUp = isSpace || isE || false;

    // Shift / N = Nitro Boost
    let boost = isShift || false;
    let respawn = isR || false;

    // Merge mobile touch inputs
    if (this.touchInput.throttle > 0) throttle = Math.max(throttle, this.touchInput.throttle);
    if (this.touchInput.brake > 0) brake = Math.max(brake, this.touchInput.brake);
    if (Math.abs(this.touchInput.steer) > 0.05) steer = this.touchInput.steer;
    if (this.touchInput.boost) boost = true;
    if (this.touchInput.usePowerUp) boost = false; // prioritize power-up
    if (this.touchInput.usePowerUp) {
      // touch power up flag handled
    }
    if (this.touchInput.respawn) respawn = true;

    return {
      throttle,
      brake,
      steer,
      boost,
      usePowerUp: usePowerUp || this.touchInput.usePowerUp,
      respawn,
    };
  }

  public dispose() {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
  }
}

