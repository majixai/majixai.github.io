const probabilities = {
  kicking: {
    extraPoint: 0.94,
    fieldGoal: {
      '20-29': 0.95,
      '30-39': 0.90,
      '40-49': 0.80,
      '50+': 0.60,
    },
    onsideKick: 0.10,
  },
  fourthDown: {
    '1': 0.69,
    '2': 0.55,
    '3': 0.46,
    '4': 0.41,
    '5': 0.38,
    '6': 0.35,
    '7': 0.33,
    '8': 0.31,
    '9': 0.29,
    '10': 0.27,
  },
  twoPointConversion: {
    pass: 0.476,
    run: 0.565,
    overall: 0.494,
  },
  driveOutcomes: {
    score: 0.37,
    touchdown: 0.217,
    fieldGoal: 0.153,
    punt: 0.373,
    turnover: 0.109,
  },
  passing: {
    completion: 0.64,
    interception: 0.022,
    sack: 0.065,
  },
  turnovers: {
    fumbleRush: 0.01,
  },
  specialTeams: {
    kickoffReturnTD: 0.004,
    puntReturnTD: 0.007,
  },
  penalties: {
    anyPlay: 0.0433,
    offensive: 0.54,
    defensive: 0.41,
    specialTeams: 0.05,
  },
  other: {
    driveStartInside10: 0.05,
    scoreFirstWin: 0.625,
    leadAtHalftimeWin: 0.775,
    leadAtFourthQuarterWin: 0.825,
  },
};
