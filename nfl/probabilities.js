const PROBABILITIES = {
    KICKING: {
        EXTRA_POINT: 0.94,
        FIELD_GOAL: {
            '20-29': 0.95,
            '30-39': 0.90,
            '40-49': 0.80,
            '50+': 0.60,
        },
        ONSIDE_KICK: 0.10,
    },
    FOURTH_DOWN: {
        1: 0.69,
        2: 0.55,
        3: 0.46,
        4: 0.41,
        5: 0.38,
        6: 0.35,
        7: 0.33,
        8: 0.31,
        9: 0.29,
        10: 0.27,
    },
    TWO_POINT_CONVERSION: {
        PASS: 0.476,
        RUN: 0.565,
        OVERALL: 0.494,
    },
    DRIVE_OUTCOMES: {
        SCORE: 0.37,
        TOUCHDOWN: 0.217,
        FIELD_GOAL: 0.153,
        PUNT: 0.373,
        TURNOVER: 0.109,
    },
    PASSING: {
        COMPLETION: 0.64,
        INTERCEPTION: 0.022,
        SACK: 0.065,
    },
    TURNOVERS: {
        FUMBLE_RUSH: 0.01,
    },
    SPECIAL_TEAMS_RETURNS: {
        KICKOFF_RETURN_TD: 0.004,
        PUNT_RETURN_TD: 0.007,
    },
    PENALTIES: {
        ANY_PLAY: 0.0433,
        OFFENSIVE: 0.54,
        DEFENSIVE: 0.41,
        SPECIAL_TEAMS: 0.05,
    },
    OTHER: {
        DRIVE_START_IN_SUDDEN_DEATH: 0.05,
        SCORE_FIRST_WINS: 0.625,
        LEAD_AT_HALFTIME_WINS: 0.775,
        LEAD_AT_START_OF_4TH_WINS: 0.825,
    },
};
