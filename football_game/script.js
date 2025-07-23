const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game variables
const player = {
  x: 50,
  y: 200,
  width: 20,
  height: 20,
  speed: 5,
};

const ball = {
  x: 400,
  y: 200,
  radius: 5,
  dx: 0,
  dy: 0,
  speed: 10,
  isThrown: false,
};

// Set canvas dimensions
canvas.width = 800;
canvas.height = 400;

// Handle keyboard input
const keys = {};
document.addEventListener('keydown', (e) => {
  keys[e.key] = true;
});
document.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});

// Game loop
function gameLoop() {
  // Update game state
  update();

  // Render game objects
  render();

  // Request next frame
  requestAnimationFrame(gameLoop);
}

// Update game state
function update() {
  // Player movement
  if (keys['w']) {
    player.y -= player.speed;
  }
  if (keys['s']) {
    player.y += player.speed;
  }
  if (keys['a']) {
    player.x -= player.speed;
  }
  if (keys['d']) {
    player.x += player.speed;
  }

  // Throw ball
  if (keys[' '] && !ball.isThrown) {
    ball.isThrown = true;
    // Get the angle between the player and the mouse
    const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
    ball.dx = Math.cos(angle) * ball.speed;
    ball.dy = Math.sin(angle) * ball.speed;
  }

  // Ball movement
  if (ball.isThrown) {
    ball.x += ball.dx;
    ball.y += ball.dy;
  }

  // Collision detection (player and ball)
  const distPlayerBall = Math.hypot(player.x - ball.x, player.y - ball.y);
  if (distPlayerBall < player.width / 2 + ball.radius && ball.isThrown) {
    ball.isThrown = false;
    ball.dx = 0;
    ball.dy = 0;
  }

  // Opponent AI and collision
  opponents.forEach(opponent => {
    // Move opponent towards the ball
    const angle = Math.atan2(ball.y - opponent.y, ball.x - opponent.x);
    opponent.x += Math.cos(angle) * opponent.speed;
    opponent.y += Math.sin(angle) * opponent.speed;

    // Collision detection (opponent and player)
    const distOpponentPlayer = Math.hypot(opponent.x - player.x, opponent.y - player.y);
    if (distOpponentPlayer < opponent.width / 2 + player.width / 2) {
      // TODO: Implement tackle
    }

    // Collision detection (opponent and ball)
    const distOpponentBall = Math.hypot(opponent.x - ball.x, opponent.y - ball.y);
    if (distOpponentBall < opponent.width / 2 + ball.radius && ball.isThrown) {
      // TODO: Implement interception
    }
  });

  // Keep the ball with the player if not thrown
  if (!ball.isThrown) {
    ball.x = player.x + player.width / 2;
    ball.y = player.y + player.height / 2;
  }

  // Scoring
  if (ball.x > 2000) {
    score++;
    touchdownMessage = true;
    setTimeout(() => {
      touchdownMessage = false;
      reset();
    }, 2000);
  }
}

// Score
let score = 0;

// Reset the game
function reset() {
  player.x = 50;
  player.y = 200;
  ball.isThrown = false;
  opponents.forEach(opponent => {
    opponent.x = Math.random() * 2000 - 1000;
    opponent.y = Math.random() * 1000 - 500;
  });
}

// Mouse position
const mouse = {
  x: 0,
  y: 0,
};
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});

// Render game objects
function render() {
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Save the current context state
  ctx.save();

  // Translate the canvas to follow the player
  ctx.translate(-player.x + canvas.width / 2, -player.y + canvas.height / 2);

  // Draw field
  ctx.fillStyle = '#006400';
  ctx.fillRect(-1000, -500, 2000, 1000);

  // Draw yard lines
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  for (let i = -1000; i <= 1000; i += 50) {
    ctx.beginPath();
    ctx.moveTo(i, -500);
    ctx.lineTo(i, 500);
    ctx.stroke();
  }

  // Draw goalposts
  ctx.fillStyle = '#FFFF00';
  ctx.fillRect(-20, -100, 10, 200);
  ctx.fillRect(10, -100, 10, 200);
  ctx.fillRect(-20, -100, 40, 10);
  ctx.fillRect(1970, -100, 10, 200);
  ctx.fillRect(1980, -100, 10, 200);
  ctx.fillRect(1970, -100, 20, 10);


  // Draw player
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(player.x, player.y, player.width, player.height);

  // Draw ball
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.closePath();

  // Draw opponents
  ctx.fillStyle = '#FF0000';
  opponents.forEach(opponent => {
    ctx.fillRect(opponent.x, opponent.y, opponent.width, opponent.height);
  });

  // Restore the context state
  ctx.restore();

  // Draw score
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '24px Arial';
  ctx.fillText(`Score: ${score}`, 10, 30);

  // Draw touchdown message
  if (touchdownMessage) {
    ctx.fillStyle = '#FFFF00';
    ctx.font = '48px Arial';
    ctx.fillText('Touchdown!', canvas.width / 2 - 150, canvas.height / 2);
  }
}

// Touchdown message
let touchdownMessage = false;

// Opponents array
const opponents = [];
for (let i = 0; i < 5; i++) {
  opponents.push({
    x: Math.random() * 2000 - 1000,
    y: Math.random() * 1000 - 500,
    width: 20,
    height: 20,
    speed: 2,
  });
}

// Start the game loop
gameLoop();
