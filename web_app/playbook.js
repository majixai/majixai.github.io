const playbook = {
  offense: {
    formations: {
      'I-Form': {
        'HB-Dive': {
          routes: {
            'A': 'block',
            'B': 'block',
            'C': 'block',
            'D': 'block',
          },
          run: 'dive',
        },
        'HB-Toss': {
          routes: {
            'A': 'block',
            'B': 'block',
            'C': 'block',
            'D': 'block',
          },
          run: 'toss',
        },
      },
      'Shotgun': {
        'Four-Verticals': {
          routes: {
            'A': 'streak',
            'B': 'streak',
            'C': 'streak',
            'D': 'streak',
          },
        },
        'Slants': {
          routes: {
            'A': 'slant',
            'B': 'slant',
            'C': 'slant',
            'D': 'slant',
          },
        },
      },
    },
  },
  defense: {
    formations: {
      '4-3': {
        'Cover-2': {
          assignments: {
            'DE1': 'pass-rush',
            'DE2': 'pass-rush',
            'DT1': 'pass-rush',
            'DT2': 'pass-rush',
            'LB1': 'zone',
            'LB2': 'zone',
            'LB3': 'zone',
            'CB1': 'man',
            'CB2': 'man',
            'S1': 'deep-half',
            'S2': 'deep-half',
          },
        },
      },
      '3-4': {
        'Cover-3': {
          assignments: {
            'DE1': 'pass-rush',
            'NT': 'pass-rush',
            'DE2': 'pass-rush',
            'LB1': 'zone',
            'LB2': 'zone',
            'LB3': 'zone',
            'LB4': 'zone',
            'CB1': 'deep-third',
            'CB2': 'deep-third',
            'S1': 'deep-third',
            'S2': 'flat',
          },
        },
      },
    },
  },
};
