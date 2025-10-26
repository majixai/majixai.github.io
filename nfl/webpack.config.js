const path = require('path');

module.exports = {
  entry: './game.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
  },
};
