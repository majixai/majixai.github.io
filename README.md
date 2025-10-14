# Texas Hold'em

A simple Texas Hold'em game written in Python.

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
