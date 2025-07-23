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

  // Ball movement (for now, it stays put)

  // Collision detection (TODO)
}

// Render game objects
function render() {
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Save the current context state
  ctx.save();

  // Translate the canvas to follow the player
  ctx.translate(-player.x + canvas.width / 2, -player.y + canvas.height / 2);

  // Draw player
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(player.x, player.y, player.width, player.height);

  // Draw ball
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.closePath();

  // Restore the context state
  ctx.restore();
}

// Start the game loop
gameLoop();
