function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}

function getGameUpdate(event, details) {
  const cache = CacheService.getScriptCache();
  const cacheKey = `lastCall_${event}`;
  const lastCall = cache.get(cacheKey);
  const now = new Date().getTime();

  let cooldown = 5000; // Default 5 seconds
  if (event === 'touchdown') {
    cooldown = 10000; // 10 seconds for touchdowns
  }

  if (lastCall && now - lastCall < cooldown) {
    return { commentary: `Commentary for ${event} is cooling down...` };
  }

  cache.put(cacheKey, now, 60); // Cache for 60 seconds

  const apiKey = "YOUR_API_KEY"; // Replace with your actual API key
  let prompt;

  switch (event) {
    case 'update':
      prompt = `You are a football game AI. Generate game logic based on the following details: ${details}. Respond in JSON format with the following keys: 'opponentBehavior', 'playOutcome', 'commentary'.`;
      break;
    case 'play-analysis':
      prompt = `You are a football analyst. Provide a detailed analysis of the following play: ${details}.`;
      break;
    default:
      prompt = `Generate a play-by-play commentary for the following event: ${event}. Details: ${details}`;
  }

  const response = UrlFetchApp.fetch("https://api.generativeai.com/v1/game", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    payload: JSON.stringify({
      prompt: prompt,
      max_tokens: 500,
    }),
  });

  const data = JSON.parse(response.getContentText());
  return JSON.parse(data.choices[0].text.trim());
}

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
  #animationManager;

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
    this.#animationManager = new AnimationManager(sprites.player.running.src, 20, 20);
    this.#animationManager.define('run', [0, 1, 2, 3], 0.1);

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
    this.#animationManager.draw(this.ctx, 'run', this.#player.x, this.#player.y);

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

const dbName = 'footballGameDB';
const dbVersion = 1;
let db;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);

    request.onerror = (event) => {
      reject('Error opening IndexedDB');
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      db.createObjectStore('gameState', { keyPath: 'id' });
    };
  });
}

function saveGameState(gameState) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['gameState'], 'readwrite');
    const store = transaction.objectStore('gameState');
    const request = store.put({ id: 'current', ...gameState });

    request.onerror = (event) => {
      reject('Error saving game state');
    };

    request.onsuccess = (event) => {
      resolve();
    };
  });
}

function loadGameState() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['gameState'], 'readonly');
    const store = transaction.objectStore('gameState');
    const request = store.get('current');

    request.onerror = (event) => {
      reject('Error loading game state');
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
  });
}

const playbook = {
  offense: {
    formations: {
      'I-Form': {
        'HB-Dive': {
          routes: {
            'A': 'block',
            'B': 'block',
            'C': 'block',
            'D': 'block',
          },
          run: 'dive',
        },
        'HB-Toss': {
          routes: {
            'A': 'block',
            'B': 'block',
            'C': 'block',
            'D': 'block',
          },
          run: 'toss',
        },
      },
      'Shotgun': {
        'Four-Verticals': {
          routes: {
            'A': 'streak',
            'B': 'streak',
            'C': 'streak',
            'D': 'streak',
          },
        },
        'Slants': {
          routes: {
            'A': 'slant',
            'B': 'slant',
            'C': 'slant',
            'D': 'slant',
          },
        },
      },
    },
  },
  defense: {
    formations: {
      '4-3': {
        'Cover-2': {
          assignments: {
            'DE1': 'pass-rush',
            'DE2': 'pass-rush',
            'DT1': 'pass-rush',
            'DT2': 'pass-rush',
            'LB1': 'zone',
            'LB2': 'zone',
            'LB3': 'zone',
            'CB1': 'man',
            'CB2': 'man',
            'S1': 'deep-half',
            'S2': 'deep-half',
          },
        },
      },
      '3-4': {
        'Cover-3': {
          assignments: {
            'DE1': 'pass-rush',
            'NT': 'pass-rush',
            'DE2': 'pass-rush',
            'LB1': 'zone',
            'LB2': 'zone',
            'LB3': 'zone',
            'LB4': 'zone',
            'CB1': 'deep-third',
            'CB2': 'deep-third',
            'S1': 'deep-third',
            'S2': 'flat',
          },
        },
      },
    },
  },
};

const specialTeams = {
  kickoff: {
    'Normal': {},
    'Onside': {},
  },
  punt: {
    'Normal': {},
    'Fake': {},
  },
  fieldGoal: {
    'Normal': {},
    'Fake': {},
  },
  extraPoint: {
    'Normal': {},
    'Fake': {},
  },
};

class Referee {
  constructor() {
    this.penalties = {
      'holding': 10,
      'false-start': 5,
      'pass-interference': 15,
    };
  }

  check_for_penalties(play) {
    // TODO: Implement penalty logic
    return null;
  }
}

const settings = {
  player: {
    speed: 5,
  },
  ball: {
    color: '#FFFFFF',
  },
  game: {
    quarterLength: 15 * 60,
  },
};

const sprites = {
  player: {
    running: new Image(),
    throwing: new Image(),
  },
  ball: new Image(),
};

sprites.player.running.src = 'https://www.w3schools.com/w3images/avatar2.png';
sprites.player.throwing.src = 'https://www.w3schools.com/w3images/avatar2.png';
sprites.ball.src = 'https://www.w3schools.com/images/w3lynx_200.png';

class AnimationManager {
  constructor(spriteSheet, frameWidth, frameHeight) {
    this.spriteSheet = spriteSheet;
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;
    this.animations = {};
  }

  define(name, frames, speed) {
    this.animations[name] = {
      frames: frames,
      speed: speed,
      frame: 0,
      timer: 0,
    };
  }

  update(animation, dt) {
    const anim = this.animations[animation];
    anim.timer += dt;
    if (anim.timer >= anim.speed) {
      anim.frame = (anim.frame + 1) % anim.frames.length;
      anim.timer = 0;
    }
  }

  draw(ctx, animation, x, y) {
    const anim = this.animations[animation];
    const frame = anim.frames[anim.frame];
    ctx.drawImage(
      this.spriteSheet,
      frame * this.frameWidth,
      0,
      this.frameWidth,
      this.frameHeight,
      x,
      y,
      this.frameWidth,
      this.frameHeight
    );
  }
}
