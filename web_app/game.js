class GameObject {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
}

class Player extends GameObject {
  constructor(x, y, width, height, speed) {
    super(x, y, width, height);
    this.speed = speed;
  }
}

class Ball extends GameObject {
  constructor(x, y, radius, speed) {
    super(x, y, radius * 2, radius * 2);
    this.radius = radius;
    this.speed = speed;
    this.dx = 0;
    this.dy = 0;
    this.isThrown = false;
    this.color = '#FFFFFF';
  }
}

class Opponent extends GameObject {
  constructor(x, y, width, height, speed) {
    super(x, y, width, height);
    this.speed = speed;
  }
}

class Game {
  #player;
  #ball;
  #opponents;
  #score;
  #touchdownMessage;
  #gameClock;
  #quarter;
  #referee;

  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.#player = new Player(50, 200, 20, 20, 5);
    this.#ball = new Ball(400, 200, 5, 10);
    this.#opponents = [];
    this.#score = 0;
    this.#touchdownMessage = false;
    this.#gameClock = 15 * 60; // 15 minutes per quarter
    this.#quarter = 1;
    this.#referee = new Referee();

    for (let i = 0; i < 5; i++) {
      this.#opponents.push(new Opponent(Math.random() * 2000 - 1000, Math.random() * 1000 - 500, 20, 20, 2));
    }
  }

  static getTeamName() {
    return "The Eagles";
  }

  reset() {
    this.#player.x = 50;
    this.#player.y = 200;
    this.#ball.isThrown = false;
    this.#opponents.forEach(opponent => {
      opponent.x = Math.random() * 2000 - 1000;
      opponent.y = Math.random() * 1000 - 500;
    });
    showPlayCallingScreen();
  }

  getGameState() {
    return {
      player: this.#player,
      ball: this.#ball,
      opponents: this.#opponents,
      score: this.#score,
    };
  }

  setGameState(gameState) {
    this.#player = gameState.player;
    this.#ball = gameState.ball;
    this.#opponents = gameState.opponents;
    this.#score = gameState.score;
  }

  passTo(receiver) {
    // TODO: Implement passing logic
  }

  jump() {
    // TODO: Implement jump logic
  }

  spin() {
    // TODO: Implement spin logic
  }

  dive() {
    // TODO: Implement dive logic
  }

  sendPlayerInMotion(receiver) {
    // TODO: Implement pre-snap motion logic
  }

  audible(direction) {
    // TODO: Implement audible logic
  }

  update() {
    if (this.currentPlay) {
      if (this.currentPlay.type === 'pass') {
        // Passing logic
        if (controller.a) this.passTo('A');
        if (controller.b) this.passTo('B');
        if (controller.c) this.passTo('C');
        if (controller.d) this.passTo('D');
      } else if (this.currentPlay.type === 'run') {
        // Running logic
        if (controller.up) this.#player.y -= this.#player.speed;
        if (controller.down) this.#player.y += this.#player.speed;
        if (controller.left) this.#player.x -= 2;
        if (controller.right) this.#player.x += 2;

        if (controller.a) this.jump();
        if (controller.b) this.spin();
        if (controller.c) this.dive();
      }
    } else {
      // No play selected, wait for user to press 'A'
      if (controller.a) {
        showPlayCallingScreen();
      }

      // Pre-snap motion
      if (controller.b) {
        this.sendPlayerInMotion('B');
      }

      // Audibles
      if (controller.l) {
        this.audible('left');
      }
      if (controller.r) {
        this.audible('right');
      }
    }

    const penalty = this.#referee.check_for_penalties(this.currentPlay);
    if (penalty) {
      // Handle penalty
    }

    // Update game clock
    this.#gameClock -= 1 / 60;
    if (this.#gameClock <= 0) {
      this.#quarter++;
      this.#gameClock = 15 * 60;
    }
  }

  render() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Save the current context state
    this.ctx.save();

    // Translate the canvas to follow the player
    this.ctx.translate(-this.#player.x + this.canvas.width / 2, -this.#player.y + this.canvas.height / 2);

    // Draw field
    this.ctx.fillStyle = '#006400';
    this.ctx.fillRect(-1000, -500, 2000, 1000);

    // Draw yard lines
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 1;
    for (let i = -1000; i <= 1000; i += 50) {
      this.ctx.beginPath();
      this.ctx.moveTo(i, -500);
      this.ctx.lineTo(i, 500);
      this.ctx.stroke();
    }

    // Draw goalposts
    this.ctx.fillStyle = '#FFFF00';
    this.ctx.fillRect(-20, -100, 10, 200);
    this.ctx.fillRect(10, -100, 10, 200);
    this.ctx.fillRect(-20, -100, 40, 10);
    this.ctx.fillRect(1970, -100, 10, 200);
    this.ctx.fillRect(1980, -100, 10, 200);
    this.ctx.fillRect(1970, -100, 20, 10);


    // Draw player
    if (this.currentPlay && this.currentPlay.type === 'pass') {
      this.ctx.drawImage(sprites.player.throwing, this.#player.x, this.#player.y, this.#player.width, this.#player.height);
    } else {
      this.ctx.drawImage(sprites.player.running, this.#player.x, this.#player.y, this.#player.width, this.#player.height);
    }

    // Draw ball
    this.ctx.drawImage(sprites.ball, this.#ball.x, this.#ball.y, this.#ball.width, this.#ball.height);

    // Draw opponents
    this.ctx.fillStyle = '#FF0000';
    this.#opponents.forEach(opponent => {
      this.ctx.fillRect(opponent.x, opponent.y, opponent.width, opponent.height);
    });

    // Restore the context state
    this.ctx.restore();

    // Draw score
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '24px Arial';
    this.ctx.fillText(`Score: ${this.#score}`, 10, 30);

    // Draw game clock and quarter
    const minutes = Math.floor(this.#gameClock / 60);
    const seconds = Math.floor(this.#gameClock % 60);
    this.ctx.fillText(`Q${this.#quarter} ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`, this.canvas.width - 150, 30);

    // Draw touchdown message
    if (this.#touchdownMessage) {
      this.ctx.fillStyle = '#FFFF00';
      this.ctx.font = '48px Arial';
      this.ctx.fillText('Touchdown!', this.canvas.width / 2 - 150, this.canvas.height / 2);
    }
  }

  gameLoop() {
    this.update();
    this.render();
    requestAnimationFrame(() => this.gameLoop());
  }
}
