class Player:
    def __init__(self, name, chips=1000):
        self.name = name
        self.chips = chips
        self.hand = []
        self.is_playing = True

    def bet(self, amount):
        if amount > self.chips:
            raise ValueError("Not enough chips")
        self.chips -= amount
        return amount

    def fold(self):
        self.is_playing = False

    def __str__(self):
        return f"{self.name} ({self.chips} chips)"
