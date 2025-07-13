from texas_holdem.game.game import Game
from texas_holdem.player.player import Player

def main():
    players = [Player("Alice"), Player("Bob")]
    game = Game(players)
    game.play_round()

    print("Community cards:", ", ".join(str(card) for card in game.community_cards))
    for player in game.players:
        print(f"{player.name}'s hand:", ", ".join(str(card) for card in player.hand))
        print(f"{player.name}'s chips:", player.chips)
    print("Pot:", game.pot)


if __name__ == "__main__":
    main()
