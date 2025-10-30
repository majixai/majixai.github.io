from collections import Counter
from cards.card import Card

def evaluate_hand(hand):
    """
    Evaluates a 7-card hand and returns its rank.
    The hand is a list of 7 Card objects.
    """
    ranks = '2345678910JQKA'
    suits = '♠♥♦♣'

    # Convert hand to a more usable format
    hand_ranks = sorted([ranks.index(c.rank) for c in hand], reverse=True)
    hand_suits = [c.suit for c in hand]

    # Check for flush
    suit_counts = Counter(hand_suits)
    is_flush = any(c >= 5 for c in suit_counts.values())
    flush_suit = None
    if is_flush:
        flush_suit = suit_counts.most_common(1)[0][0]

    # Check for straight
    is_straight = False
    unique_ranks = sorted(list(set(hand_ranks)), reverse=True)
    if len(unique_ranks) >= 5:
        for i in range(len(unique_ranks) - 4):
            if unique_ranks[i] - unique_ranks[i+4] == 4:
                is_straight = True
                break
        # Ace-low straight
        if not is_straight and set([12, 0, 1, 2, 3]).issubset(set(unique_ranks)):
            is_straight = True


    # Straight flush
    if is_straight and is_flush:
        flush_cards = sorted([ranks.index(c.rank) for c in hand if c.suit == flush_suit], reverse=True)
        if len(flush_cards) >= 5:
            # Check for ace-low straight flush
            if set([12, 0, 1, 2, 3]).issubset(set(flush_cards)):
                is_straight_flush = True
                straight_flush_rank = 3
            for i in range(len(flush_cards) - 4):
                if flush_cards[i] - flush_cards[i+4] == 4:
                    is_straight_flush = True
                    straight_flush_rank = flush_cards[i]
                    break
            if is_straight_flush:
                return (8, straight_flush_rank)

    # Four of a kind
    rank_counts = Counter(hand_ranks)
    if 4 in rank_counts.values():
        four_of_a_kind_rank = rank_counts.most_common(1)[0][0]
        kickers = [r for r in hand_ranks if r != four_of_a_kind_rank]
        return (7, four_of_a_kind_rank, kickers[0])

    # Full house
    if 3 in rank_counts.values() and 2 in rank_counts.values():
        three_of_a_kind_rank = rank_counts.most_common(1)[0][0]
        pair_rank = rank_counts.most_common(2)[1][0]
        return (6, three_of_a_kind_rank, pair_rank)

    # Flush
    if is_flush:
        flush_cards = sorted([ranks.index(c.rank) for c in hand if c.suit == flush_suit], reverse=True)
        return (5, tuple(flush_cards[:5]))

    # Straight
    if is_straight:
        return (4, unique_ranks[0])

    # Three of a kind
    if 3 in rank_counts.values():
        three_of_a_kind_rank = rank_counts.most_common(1)[0][0]
        kickers = [r for r in hand_ranks if r != three_of_a_kind_rank]
        return (3, three_of_a_kind_rank, tuple(kickers[:2]))

    # Two pair
    if list(rank_counts.values()).count(2) >= 2:
        pairs = [r for r, c in rank_counts.items() if c == 2]
        pairs.sort(reverse=True)
        kickers = [r for r in hand_ranks if r not in pairs]
        return (2, tuple(pairs[:2]), kickers[0])

    # One pair
    if 2 in rank_counts.values():
        pair_rank = rank_counts.most_common(1)[0][0]
        kickers = [r for r in hand_ranks if r != pair_rank]
        return (1, pair_rank, tuple(kickers[:3]))

    # High card
    return (0, tuple(hand_ranks[:5]))
