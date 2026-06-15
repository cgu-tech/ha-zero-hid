export class InertiaManager {

  // private constants
  _DEFAULT_VELOCITY_WINDOW = 75;
  _DEFAULT_MAX_IDLE_BEFORE_RELEASE = 150;
  _DEFAULT_MIN_DELAY_BEFORE_MOVE = 300;
  _DEFAULT_VEOLCITY_THRESHOLD = 0.03;
  _DEFAULT_DECAY_PER_MILLISECOND = 0.995;
  _DEFAULT_STOP_VELOCITY_THRESHOLD = 0.01;
  _DEFAULT_ACCUMULATION_THRESHOLD = 6;

  // private configs
  _velocityWindow = this._DEFAULT_VELOCITY_WINDOW;                 // Amount of movement history used to estimate release velocity (in ms)
  _maxIdleBeforeRelease = this._DEFAULT_MAX_IDLE_BEFORE_RELEASE;   // Idle-before-release detection (in ms)
  _minDelayBeforeMove = this._DEFAULT_MIN_DELAY_BEFORE_MOVE;       // Minimum delay between next move
  _velocityThreshold = this._DEFAULT_VEOLCITY_THRESHOLD;           // Minimum release speed required to trigger inertia
  _decayPerMillisecond = this._DEFAULT_DECAY_PER_MILLISECOND;      // Friction factor (closer to 1 = longer glide)
  _stopVelocityThreshold = this._DEFAULT_STOP_VELOCITY_THRESHOLD;  // Velocity below which inertia stops
  _accumulationThreshold = this._DEFAULT_ACCUMULATION_THRESHOLD;   // Number of accumulated movements needed to trigger one move callback

  // private properties
  _positionX = 0;
  _positionY = 0;
  _velocityX = 0;
  _velocityY = 0;
  _samples = [];
  _lastMovementTime = 0;
  _lastEmitedTime = 0;
  _animationFrameId = null;
  _accumulatedMovements = 0;
  _onMove = null; // onMove callback 

  constructor() {
    // Nothing specific to do
  }
  
  // onMove: Callback invoked for both user movement and inertial movement
  setMoveCallback(onMove) {
    this._onMove = onMove;
  }

  // Utility

  now() {
    return performance.now();
  }

  speed(vx, vy) {
    return Math.hypot(vx, vy);
  }

  /*
  shouldEmit() {
    this._accumulatedMovements += 1;
    if (this._accumulatedMovements === this._accumulationThreshold) {
      this._accumulatedMovements = 0;
      return true;
    }
    return false;
  }
  */
  shouldEmit() {
    this._accumulatedMovements += 1;
    if (this._accumulatedMovements === this._accumulationThreshold) {
      this._accumulatedMovements = 0;
      return true;
    }
    
    const lastEmitDelay = this.now() - this._lastEmitedTime;
    if (lastEmitDelay >= this._minDelayBeforeMove) {
      this._accumulatedMovements = 0;
      return true;
    }
    
    return false;
  }

  emitPosition() {
    this._lastEmitedTime = this.now();
    if (!this._onMove) return;

    this._onMove({
      x: this._positionX,
      y: this._positionY,
      vx: this._velocityX,
      vy: this._velocityY
    });
  }

  emitLimitedPosition() {
    if (this.shouldEmit()) this.emitPosition();
  }
  // Inertia control

  cancelInertia() {
    if (this._animationFrameId !== null) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }

    this._velocityX = 0;
    this._velocityY = 0;
    this._accumulatedMovements = 0;
  }

  startInertia(vx, vy) {
    this.cancelInertia();

    this._velocityX = vx;
    this._velocityY = vy;

    let previousTime = this.now();

    const frame = (now) => {
      const dt = now - previousTime;
      previousTime = now;

      this._positionX += this._velocityX * dt;
      this._positionY += this._velocityY * dt;

      const decay = this._decayPerMillisecond ** dt;

      this._velocityX *= decay;
      this._velocityY *= decay;

      this.emitLimitedPosition();

      if (this.speed(this._velocityX, this._velocityY) < this._stopVelocityThreshold) {
        this._animationFrameId = null;
        return;
      }

      this._animationFrameId = requestAnimationFrame(frame);
    };

    this._animationFrameId = requestAnimationFrame(frame);
  }

  // Velocity tracking

  clearSamples() {
    this._samples.length = 0;
  }

  addSample(x, y) {
    const timestamp = this.now();

    const previous = this._samples[this._samples.length - 1];
    if (!previous || previous.x !== x || previous.y !== y) {
      this._lastMovementTime = timestamp;
    }

    this._samples.push({ x, y, timestamp });

    const cutoff = timestamp - this._velocityWindow;
    while (this._samples.length > 1 && this._samples[0].timestamp < cutoff) {
      this._samples.shift();
    }
  }

  computeVelocity() {
    if (this._samples.length < 2) {
      return { vx: 0, vy: 0 };
    }

    const first = this._samples[0];
    const last = this._samples[this._samples.length - 1];

    const dt = last.timestamp - first.timestamp;
    if (dt <= 0) {
      return { vx: 0, vy: 0 };
    }

    return {
      vx: (last.x - first.x) / dt,
      vy: (last.y - first.y) / dt
    };
  }

  // Public API

  moveStart(x, y) {
    this.cancelInertia();
    this.clearSamples();
    this.addSample(x, y);
  }

  move(x, y) {
    const previous = this._samples[this._samples.length - 1];
    if (previous) {
      const dx = x - previous.x;
      const dy = y - previous.y;

      this._positionX += dx;
      this._positionY += dy;
    }

    this.addSample(x, y);

    const velocity = this.computeVelocity();

    this._velocityX = velocity.vx;
    this._velocityY = velocity.vy;

    this.emitLimitedPosition();
  }

  moveStop() {
    const idleTime = this.now() - this._lastMovementTime;
    if (idleTime > this._maxIdleBeforeRelease) return;

    const { vx, vy } = this.computeVelocity();
    if (this.speed(vx, vy) < this._velocityThreshold) return;

    this.startInertia(vx, vy);
  }

  moveCancel() {
    this.cancelInertia();
  }

}