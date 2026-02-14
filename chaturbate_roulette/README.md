# Chaturbate Roulette Game

A roulette-style tipping app for Chaturbate with tracking capabilities. Users tip to spin the wheel and win prizes, bonus tokens, or special rewards.

## Features

- 🎰 **Roulette Wheel Spin**: Visual animated wheel that spins when users tip
- 💰 **Token Prizes**: Configurable prize segments with token bonuses
- 📊 **Full Tracking**: Complete statistics tracking for spins, winners, and prizes
- 🏆 **Leaderboards**: Track top spinners and biggest winners
- ⚙️ **Configurable**: Customize prizes, spin costs, and cooldowns
- 🎨 **Visual Overlay**: Animated wheel overlay for streams

## Installation

### 1. Shared Code Setup

Copy the contents of each file in the `shared/` directory to your app's shared code section:

1. `shared/roulette_config.js` - Configuration management
2. `shared/roulette_tracker.js` - Statistics tracking
3. `shared/roulette.js` - Core game logic

### 2. Event Handler Setup

Copy each event handler to the appropriate section in the Chaturbate app editor:

| File | Location in CB Editor |
|------|----------------------|
| `event_handlers/app_start.js` | Event Handlers → App Lifecycle → App Start |
| `event_handlers/tip_received.js` | Event Handlers → Tips → Tip Received |
| `event_handlers/chat_message.js` | Event Handlers → Chat → Chat Message |
| `event_handlers/callback.js` | Event Handlers → Callbacks → Callback |

### 3. Overlay Setup (Optional)

For the visual wheel animation:

1. Create a new overlay named "Roulette"
2. Copy the contents of `overlay/roulette_wheel.html` to the overlay HTML
3. Optionally include `overlay/roulette_styles.css` for additional styling

## Usage

### For Viewers

| Command | Description |
|---------|-------------|
| `/roulette_help` or `/rhelp` | Show all commands |
| `/roulette_stats` or `/rstats` | View game statistics |
| `/roulette_top` or `/rtop` | View top spinners leaderboard |
| `/roulette_me` or `/rme` | View your personal stats |
| `/roulette_recent` or `/rrecent` | View recent spin results |
| `/roulette_prizes` or `/rprizes` | View available prizes |
| `/roulette_winners` or `/rwinners` | View biggest token winners |

### For Broadcasters/Mods

| Command | Description |
|---------|-------------|
| `/roulette_setcost [tokens]` or `/rsetcost [tokens]` | Set spin cost |
| `/roulette_setcooldown [seconds]` or `/rsetcd [seconds]` | Set cooldown between spins |
| `/roulette_announce [message]` or `/rannounce [message]` | Send game announcement |
| `/roulette_reset confirm` or `/rreset confirm` | Reset all statistics |

## Configuration

### Default Prize Segments

The default configuration includes 10 segments:

| Segment | Prize | Token Bonus | Weight |
|---------|-------|-------------|--------|
| Flash! | Flash for 10 seconds | 0 | 1.5 |
| Dance! | Sexy dance | 0 | 1.2 |
| Bonus 50! | 50 bonus tokens | 50 | 0.3 |
| Tease | Tease for 30 seconds | 0 | 1.8 |
| Song Request | Request a song | 0 | 1.0 |
| Try Again! | Better luck next time | 0 | 2.0 |
| Special Show! | Special 1-min show | 0 | 0.5 |
| Bonus 25! | 25 bonus tokens | 25 | 0.6 |
| Pose | Strike a pose | 0 | 1.4 |
| JACKPOT! | Jackpot - 200 tokens | 200 | 0.1 |

### Weight System

- Higher weight = more likely to land on
- Weight is relative to total weight sum
- Example: A segment with weight 2.0 is twice as likely as weight 1.0

### Customizing Configuration

Edit the `getDefaultRouletteConfig()` function in `shared/roulette_config.js` to customize:

- Segment labels and prizes
- Token amounts
- Colors
- Weights (probability)
- Spin cost
- Cooldown duration
- Animation settings

## Tracking Data

The app automatically tracks:

- **Total Spins**: Number of spins across all users
- **Tokens Collected**: Total tokens spent on spins
- **Tokens Awarded**: Total bonus tokens given out
- **Per-User Stats**: Individual spin counts, amounts, and wins
- **Segment Stats**: How often each segment is hit
- **Spin History**: Last 100 spins with details

## Overlay Integration

The overlay receives events via the Chaturbate overlay API:

### Events Emitted

**`setConfig`** - Sent on app load
```javascript
{
    eventName: 'setConfig',
    payload: {
        segments: [...],  // Array of segment objects
        reelCount: 10     // Number of segments
    }
}
```

**`spin`** - Sent when a spin occurs
```javascript
{
    eventName: 'spin',
    payload: {
        username: 'user123',
        results: [{
            segmentId: 1,
            label: 'Flash!',
            prize: 'Flash for 10 seconds',
            tokens: 0,
            color: '#FF6B6B'
        }],
        animation: {
            angle: 1800,      // Total rotation in degrees
            duration: 4000    // Animation duration in ms
        },
        spinsEarned: 1
    }
}
```

## File Structure

```
chaturbate_roulette/
├── event_handlers/
│   ├── app_start.js         # Initialize app on start
│   ├── tip_received.js      # Process tips and trigger spins
│   ├── chat_message.js      # Handle chat commands
│   └── callback.js          # Scheduled announcements
├── shared/
│   ├── roulette.js          # Core game logic
│   ├── roulette_config.js   # Configuration management
│   └── roulette_tracker.js  # Statistics tracking
├── overlay/
│   ├── roulette_wheel.html  # Visual wheel overlay
│   └── roulette_styles.css  # Additional styles
└── README.md
```

## Testing

The overlay includes a test function. Open `roulette_wheel.html` in a browser and run in console:

```javascript
testSpin();
```

This will simulate a spin animation and result display.

## Customization Tips

### Adding New Segments

Add to the `segments` array in configuration:

```javascript
{
    id: 11,
    label: "New Prize!",
    prize: "Description of prize",
    color: "#123456",
    weight: 1.0,
    tokens: 0  // Set > 0 for token bonus
}
```

### Adjusting Spin Animation

Modify in configuration:
- `spinDuration`: Animation time in milliseconds (default: 4000)
- `spinRotations`: Full rotations before stopping (default: 5)

### Changing Announcement Frequency

Edit `ROULETTE_ANNOUNCEMENT_DELAY` in `callback.js` (value in seconds).

## License

Free to use and modify for Chaturbate applications.

## Support

For issues or feature requests, please open an issue in the repository.
