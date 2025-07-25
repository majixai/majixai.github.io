import json

def generate_playbook():
    playbook = []
    formations = ["Shotgun", "Pistol", "I-Form", "Single Back", "Empty"]
    play_types = ["Inside Zone", "Outside Zone", "Power", "Counter", "Draw", "Slants", "Curl/Flat", "Four Verticals", "Mesh", "Screen"]
    downs = ["1st", "2nd", "3rd", "4th"]
    distances = ["1-3 yards", "4-7 yards", "8-12 yards", "13+ yards"]
    times = ["1st Quarter", "2nd Quarter", "3rd Quarter", "4th Quarter"]

    for i in range(100):
        formation = formations[i % len(formations)]
        play_type = play_types[i % len(play_types)]
        play_name = f"{formation} - {play_type}"
        description = f"A {play_type} play out of the {formation} formation."

        has_shift = (i % 5 == 0)
        has_motion = (i % 4 == 0)

        shift_and_motion_details = None
        if has_shift or has_motion:
            shift_and_motion_details = ""
            if has_shift:
                shift_and_motion_details += "The formation shifts from a balanced set to an overloaded set. "
            if has_motion:
                shift_and_motion_details += "A receiver goes in motion across the formation."

        play = {
            "play_name": play_name,
            "formation": formation,
            "description": description,
            "recommendations": {
                "down": downs[i % len(downs)],
                "distance": distances[i % len(distances)],
                "time": times[i % len(times)]
            },
            "has_shift": has_shift,
            "has_motion": has_motion,
            "shift_and_motion_details": shift_and_motion_details
        }
        playbook.append(play)

    return playbook

if __name__ == "__main__":
    playbook = generate_playbook()
    with open("nfl_offensive_playbook/playbook.json", "w") as f:
        json.dump(playbook, f, indent=2)
