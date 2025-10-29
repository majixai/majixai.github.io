# Texas Hold'em

A simple Texas Hold'em game written in Python.

## Features
- A RESTful API to manage the game state.
- Real-time game updates through a web interface.
- Player actions including betting and folding.
- Automated hand evaluation to determine the winner.

## Project Structure
- **/cards**: Contains the `Card` and `Deck` classes, which represent the game's cards.
- **/game**: Includes the `Game` class, which manages the game logic, including dealing cards and determining the winner.
- **/player**: Defines the `Player` class, which handles player-specific actions and state.
- **/statistics**: Provides hand evaluation and odds calculation functionalities.
- **/web**: Contains the frontend components for the web-based user interface.

## API Overview
- `GET /game_state`: Retrieves the current state of the game, including players, community cards, and the pot.
- `POST /bet`: Allows a player to place a bet.
- `POST /fold`: Allows a player to fold their hand.
- `GET /next_round`: Advances the game to the next round.

## How to Run with Docker

To run the game using Docker, execute the following command from the root directory:

```
./deploy.sh
```

The game will be available at [http://localhost:5000](http://localhost:5000).

## How to Run Locally

To run the game locally, you will need to have Python 3 and pip installed.

First, install the dependencies:

```
pip install -r requirements.txt
```

Then, run the application:

```
python -m texas_holdem.app
```

## How to Run Tests

To run the tests, execute the following command from the root directory:

```
python -m unittest discover texas_holdem
```
