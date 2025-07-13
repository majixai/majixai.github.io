def calculate_pot_odds(pot, amount_to_call):
    """
    Calculates the pot odds.
    """
    if amount_to_call == 0:
        return float('inf')
    return pot / amount_to_call

def calculate_win_probability(hand_strength, num_opponents):
    """
    A very simplistic calculation for win probability.
    In a real application, this would be a much more complex calculation.
    """
    return hand_strength / (num_opponents + 1)
