// velocityWindowMs: Amount of movement history used to estimate release velocity
// maxIdleBeforeReleaseMs: Idle-before-release detection
// velocityThreshold: Minimum release speed required to trigger inertia
// decayPerMs: Friction factor (closer to 1 = longer glide)
// stopVelocityThreshold: Velocity below which inertia stops
export class InertiaManager {

  constructor({
    velocityWindowMs = 100,
    maxIdleBeforeReleaseMs = 150;
    velocityThreshold = 0.03,
    decayPerMs = 0.998,
    stopVelocityThreshold = 0.005,
  } = {}) {
    this._velocityWindowMs = velocityWindowMs;
    this._maxIdleBeforeReleaseMs = maxIdleBeforeReleaseMs;
    this._velocityThreshold = velocityThreshold;
    this._decayPerMs = decayPerMs;
    this._stopVelocityThreshold = stopVelocityThreshold;

    this.positionX = 0;
    this.positionY = 0;

    this.velocityX = 0;
    this.velocityY = 0;

    this.samples = [];

    this.lastMovementTime = 0;

    this.animationFrameId = null;
  }
  
  // onMove: Callback invoked for both user movement and inertial movement
  setMoveCallback(onMove) {
    this._onMove = onMove;
  }

  // ----------------------------------------------------------
  // Utility
  // ----------------------------------------------------------

  now() {
    return performance.now();
  }

  speed(vx, vy) {
    return Math.hypot(vx, vy);
  }

  emitPosition() {
    if (!this._onMove) return;

    this._onMove({
      x: this.positionX,
      y: this.positionY,
      vx: this.velocityX,
      vy: this.velocityY
    });
  }

  // ----------------------------------------------------------
  // Inertia control
  // ----------------------------------------------------------

  cancelInertia() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.velocityX = 0;
    this.velocityY = 0;
  }

  startInertia(vx, vy) {
    this.cancelInertia();

    this.velocityX = vx;
    this.velocityY = vy;

    let previousTime = this.now();

    const frame = (now) => {
      const dt = now - previousTime;
      previousTime = now;

      this.positionX += this.velocityX * dt;
      this.positionY += this.velocityY * dt;

      const decay = this._decayPerMs ** dt;

      this.velocityX *= decay;
      this.velocityY *= decay;

      this.emitPosition();

      if (this.speed(this.velocityX, this.velocityY) < this._stopVelocityThreshold) {
        this.animationFrameId = null;
        return;
      }

      this.animationFrameId = requestAnimationFrame(frame);
    };

    this.animationFrameId = requestAnimationFrame(frame);
  }

  // ----------------------------------------------------------
  // Velocity tracking
  // ----------------------------------------------------------

  clearSamples() {
    this.samples.length = 0;
  }

  addSample(x, y) {
    const timestamp = this.now();

    const previous = this.samples[this.samples.length - 1];
    if (!previous || previous.x !== x || previous.y !== y) {
      this.lastMovementTime = timestamp;
    }

    this.samples.push({ x, y, timestamp });

    const cutoff = timestamp - this._velocityWindowMs;
    while (this.samples.length > 1 && this.samples[0].timestamp < cutoff) {
      this.samples.shift();
    }
  }

  computeVelocity() {
    if (this.samples.length < 2) {
      return { vx: 0, vy: 0 };
    }

    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];

    const dt = last.timestamp - first.timestamp;
    if (dt <= 0) {
      return { vx: 0, vy: 0 };
    }

    return {
      vx: (last.x - first.x) / dt,
      vy: (last.y - first.y) / dt
    };
  }

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------

  moveStart(x, y) {
    this.cancelInertia();
    this.clearSamples();
    this.addSample(x, y);
  }

  move(x, y) {
    const previous = this.samples[this.samples.length - 1];
    if (previous) {
      const dx = x - previous.x;
      const dy = y - previous.y;

      this.positionX += dx;
      this.positionY += dy;
    }

    this.addSample(x, y);

    const velocity = this.computeVelocity();

    this.velocityX = velocity.vx;
    this.velocityY = velocity.vy;

    this.emitPosition();
  }

  moveStop() {
    const idleTime = this.now() - this.lastMovementTime;
    if (idleTime > this._maxIdleBeforeReleaseMs) return;

    const { vx, vy } = this.computeVelocity();
    if (this.speed(vx, vy) < this._velocityThreshold) return;

    this.startInertia(vx, vy);
  }

}