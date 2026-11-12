(() => {
  const pitch = document.querySelector('#pitch');
  const ball = document.querySelector('#ball');
  const shoe = document.querySelector('#shoe-cursor');
  const message = document.querySelector('#hud-message');
  const count = document.querySelector('#kick-counter');
  const flash = document.querySelector('#goal-flash');
  if (!pitch || !ball || !shoe) return;

  const goals = [...pitch.querySelectorAll('.goal')];
  const BALL_SIZE = 36;
  const SHOE_HITBOX = 46;
  const state = {
    x: 0, y: 0, vx: 0.7, vy: -0.25,
    pointerX: null, pointerY: null,
    previousPointerX: null, previousPointerY: null,
    touching: false, lastKick: 0, kicks: 0,
    lastFrame: 0, scored: false
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const setMessage = text => { if (message) message.textContent = text; };
  const pitchRect = () => pitch.getBoundingClientRect();

  function goalRects() {
    const field = pitchRect();
    return goals.map(goal => {
      const rect = goal.querySelector('.goal-mouth').getBoundingClientRect();
      return {
        id: goal.dataset.goal,
        left: rect.left - field.left,
        right: rect.right - field.left,
        top: rect.top - field.top,
        bottom: rect.bottom - field.top
      };
    });
  }

  // The shoe and ball are treated as two axis-aligned square hitboxes.
  function overlapsShoeAndBall(x, y) {
    const halfBall = BALL_SIZE / 2;
    const halfShoe = SHOE_HITBOX / 2;
    return Math.abs(x - state.x) < halfBall + halfShoe &&
           Math.abs(y - state.y) < halfBall + halfShoe;
  }

  function kick(dx, dy, speed) {
    const now = performance.now();
    if (state.scored || now - state.lastKick < 260) return;

    let length = Math.hypot(dx, dy);
    if (length < 0.001) return;
    const nx = dx / length;
    const ny = dy / length;

    // Kick follows the shoe's actual movement direction; speed only changes power.
    const power = clamp(7.5 + speed * 0.22, 7.5, 15);
    state.vx = nx * power;
    state.vy = ny * power;
    state.lastKick = now;
    state.kicks += 1;
    if (count) count.textContent = String(state.kicks).padStart(2, '0');
    setMessage('Kick! Guide the ball toward one of the three goals.');
  }

  function onPointerMove(event) {
    const rect = pitchRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const shoeSize = 48;

    shoe.style.left = event.clientX + 'px';
    shoe.style.top = event.clientY + 'px';
    shoe.classList.add('visible');

    if (state.pointerX !== null) {
      const dx = x - state.pointerX;
      const dy = y - state.pointerY;
      const distance = Math.hypot(dx, dy);
      const speed = distance;

      const touchingNow = overlapsShoeAndBall(x, y);
      if (touchingNow && !state.touching && distance > 1.5) {
        kick(dx, dy, speed);
      }
      state.touching = touchingNow;
    }

    state.pointerX = x;
    state.pointerY = y;
  }

  pitch.addEventListener('pointerenter', () => {
    shoe.classList.add('visible');
    setMessage('Move the shoe into the ball, then sweep in the direction you want to kick.');
  });
  pitch.addEventListener('pointerleave', () => {
    shoe.classList.remove('visible');
    state.pointerX = null;
    state.pointerY = null;
    state.touching = false;
  });
  pitch.addEventListener('pointermove', onPointerMove);

  pitch.addEventListener('pointerdown', event => {
    const rect = pitchRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    shoe.style.left = event.clientX + 'px';
    shoe.style.top = event.clientY + 'px';
    shoe.classList.add('visible');
    if (overlapsShoeAndBall(x, y)) {
      // A tap alone gives a gentle kick toward the ball from the shoe's last position.
      const dx = state.pointerX === null ? 0 : x - state.pointerX;
      const dy = state.pointerY === null ? -1 : y - state.pointerY;
      kick(dx, dy || -1, 4);
    }
    state.pointerX = x;
    state.pointerY = y;
  });

  window.addEventListener('keydown', event => {
    const directions = {
      ArrowUp: [0, -1], ArrowDown: [0, 1],
      ArrowLeft: [-1, 0], ArrowRight: [1, 0]
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    kick(direction[0], direction[1], 10);
  });

  function openGoal(id) {
    const pages = {
      about: 'about.html',
      base: 'journey.html',
      help: 'help.html'
    };
    const destination = pages[id];
    if (!destination || state.scored) return;
    state.scored = true;
    // Navigate immediately when the ball crosses the goal line.
    window.location.href = destination;
  }

  function draw() {
    ball.style.left = state.x + 'px';
    ball.style.top = state.y + 'px';
    ball.style.transform = 'translate(-50%, -50%)';
  }

  function resolveGoalCollision(previousX, previousY) {
    const half = BALL_SIZE / 2;
    const frameThickness = 5;
    const goalDepth = 58;

    for (const goal of goalRects()) {
      const innerLeft = goal.left + frameThickness + half;
      const innerRight = goal.right - frameThickness - half;

      // A clean shot crossing the front opening from the field side is a goal.
      const crossedFront = state.vy < 0 &&
        previousY - half > goal.bottom &&
        state.y - half <= goal.bottom;
      if (crossedFront && state.x > innerLeft && state.x < innerRight) {
        return goal.id;
      }

      // The goal has a solid 3D-like side volume behind its front frame.
      // Balls hitting either side wall are pushed back and reflected.
      const insideGoalDepth =
        state.y + half > goal.top - goalDepth &&
        state.y - half < goal.bottom;

      if (insideGoalDepth) {
        const hitLeftSide =
          state.x - half < goal.left + frameThickness &&
          previousX >= goal.left + frameThickness &&
          state.vx < 0;
        const hitRightSide =
          state.x + half > goal.right - frameThickness &&
          previousX <= goal.right - frameThickness &&
          state.vx > 0;

        if (hitLeftSide) {
          state.x = goal.left + frameThickness + half;
          state.vx = Math.abs(state.vx) * 0.72;
          setMessage('The ball hit the side of the goal and bounced away!');
        } else if (hitRightSide) {
          state.x = goal.right - frameThickness - half;
          state.vx = -Math.abs(state.vx) * 0.72;
          setMessage('The ball hit the side of the goal and bounced away!');
        }
      }

      // Solid back wall: a ball cannot pass through the rear of the goal.
      const insideGoalWidth =
        state.x + half > goal.left + frameThickness &&
        state.x - half < goal.right - frameThickness;
      const backWallY = goal.top - goalDepth;
      const hitBackWall =
        insideGoalWidth &&
        state.y - half < backWallY &&
        previousY >= backWallY &&
        state.vy < 0;

      if (hitBackWall) {
        state.y = backWallY + half;
        state.vy = Math.abs(state.vy) * 0.72;
        setMessage('The ball hit the back of the goal and bounced out!');
      }

      // Front posts and crossbar are solid too.
      const overlapsPostVertically =
        state.y + half > goal.top && state.y - half < goal.bottom;
      if (overlapsPostVertically) {
        const hitLeftPost =
          state.x - half < goal.left + frameThickness &&
          state.x + half > goal.left &&
          previousX >= goal.left + frameThickness &&
          state.vx < 0;
        const hitRightPost =
          state.x + half > goal.right - frameThickness &&
          state.x - half < goal.right &&
          previousX <= goal.right - frameThickness &&
          state.vx > 0;

        if (hitLeftPost) {
          state.x = goal.left + frameThickness + half;
          state.vx = Math.abs(state.vx) * 0.68;
          setMessage('The ball hit the goalpost and bounced away!');
        } else if (hitRightPost) {
          state.x = goal.right - frameThickness - half;
          state.vx = -Math.abs(state.vx) * 0.68;
          setMessage('The ball hit the goalpost and bounced away!');
        }
      }

      const overlapsCrossbarHorizontally =
        state.x + half > goal.left && state.x - half < goal.right;
      const hitCrossbar =
        overlapsCrossbarHorizontally &&
        state.y - half < goal.top + frameThickness &&
        state.y + half > goal.top &&
        previousY >= goal.top + frameThickness &&
        state.vy < 0;

      if (hitCrossbar) {
        state.y = goal.top + frameThickness + half;
        state.vy = Math.abs(state.vy) * 0.68;
        setMessage('Off the crossbar! The ball bounced back.');
      }
    }
    return null;
  }
  function frame(time) {
    if (!state.lastFrame) state.lastFrame = time;
    const dt = Math.min((time - state.lastFrame) / 16.67, 2);
    state.lastFrame = time;

    const width = pitch.clientWidth;
    const height = pitch.clientHeight;

    if (!state.scored) {
      const previousX = state.x;
      const previousY = state.y;

      state.x += state.vx * dt;
      state.y += state.vy * dt;

      // Predictable ground friction: the ball slows down smoothly instead of drifting randomly.
      const friction = Math.pow(0.986, dt);
      state.vx *= friction;
      state.vy *= friction;
      if (Math.abs(state.vx) < 0.035) state.vx = 0;
      if (Math.abs(state.vy) < 0.035) state.vy = 0;

      const half = BALL_SIZE / 2;
      if (state.x < half || state.x > width - half) {
        state.x = clamp(state.x, half, width - half);
        state.vx *= -0.58;
      }
      if (state.y > height - half) {
        state.y = height - half;
        state.vy *= -0.42;
      }

      // The goal frame is solid. Only a clean shot through the front opening scores.
      const scoredGoal = resolveGoalCollision(previousX, previousY);
      if (scoredGoal) openGoal(scoredGoal);

      // Keep the ball in play if it reaches the top between goals.
      if (state.y < half) {
        state.y = half;
        state.vy = Math.abs(state.vy) * 0.45;
      }
      draw();
    }
    requestAnimationFrame(frame);
  }
  function placeBall() {
    state.x = pitch.clientWidth * 0.5;
    state.y = pitch.clientHeight * 0.68;
    state.vx = 0.7;
    state.vy = -0.25;
    draw();
  }

  placeBall();
  requestAnimationFrame(frame);
  window.addEventListener('resize', () => {
    state.x = clamp(state.x, BALL_SIZE / 2, pitch.clientWidth - BALL_SIZE / 2);
    state.y = clamp(state.y, BALL_SIZE / 2, pitch.clientHeight - BALL_SIZE / 2);
    draw();
  });
})();