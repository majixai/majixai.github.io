

export const FORMATIONS = {
    I_FORM_TWINS: { C: {x:0, y:0}, QB: {x:-2, y:0}, HB: {x:-4, y:0}, WR1: {x:0, y:20}, WR2: {x:0, y:23}, TE: {x:0, y:-8} },
    SHOTGUN_SPREAD: { C: {x:0, y:0}, QB: {x:-5, y:0}, WR1: {x:0, y:22}, WR2: {x:0, y:-22}, WR3: {x:0, y:12}, WR4: {x:0, y:-12} },
    SHOTGUN_TRIPS: { C: {x:0, y:0}, QB: {x:-5, y:0}, WR1: {x:0, y:22}, WR2: {x:0, y:12}, WR3: {x:0, y:28}, WR4: {x:0, y:-22} },
    SINGLEBACK_ACE: { C: {x:0, y:0}, QB: {x:-2, y:0}, HB: {x:-5, y:0}, WR1: {x:0, y:22}, WR2: {x:0, y:-22} },
    PISTOL_ACE: { C: {x:0, y:0}, QB: {x:-3, y:0}, HB: {x:-5, y:0}, WR1: {x:0, y:22}, WR2: {x:0, y:-22}},
    PUNT_FORMATION: { C: {x:0, y:0}, P: {x:-15, y:0} },
    FG_FORMATION: { C: {x:0, y:0}, H: {x:-8, y:0}, K: {x:-10, y:0} },

    DEF_4_3: { DL1: {x:1, y:3}, DL2: {x:1, y:-3}, DL3: {x:1, y:8}, DL4: {x:1, y:-8}, LB1: {x:5, y:0}, LB2: {x:5, y:10}, LB3: {x:5, y:-10}, CB1: {x:1, y:22}, CB2: {x:1, y:-22}, S1: {x:12, y:8}, S2: {x:12, y:-8} },
    DEF_3_4: { DL1: {x:1, y:0}, DL2: {x:1, y:5}, DL3: {x:1, y:-5}, LB1: {x:5, y:3}, LB2: {x:5, y:-3}, LB3: {x:2, y:10}, LB4: {x:2, y:-10}, CB1: {x:1, y:22}, CB2: {x:1, y:-22}, S1: {x:12, y:0} },
    DEF_NICKEL: { DL1: {x:1, y:3}, DL2: {x:1, y:-3}, DL3: {x:1, y:8}, DL4: {x:1, y:-8}, LB1: {x:5, y:5}, LB2: {x:5, y:-5}, CB1: {x:1, y:22}, CB2: {x:1, y:-22}, CB3: {x:5, y:12}, S1: {x:12, y:8}, S2: {x:12, y:-8} },
    DEF_PUNT_RETURN: { R: {x:40, y:0} },
    DEF_FG_BLOCK: { DL1: {x:1, y:0}, DL2: {x:1, y:3}, DL3: {x:1, y:-3} }
};

export const ROUTES = {
    // Short
    SLANT: [{x:3, y:2}],
    OUT: [{x:5, y:0}, {x:5, y:5}],
    IN: [{x:5, y:0}, {x:5, y:-5}],
    DRAG: [{x:4, y:-8}],
    FLAT: [{x:1, y:4}],
    SCREEN: [{x:-2, y:3}],
    // Medium
    CURL: [{x:12, y:0}, {x:10, y:0}],
    COMEBACK: [{x:15, y:0}, {x:13, y:3}],
    POST: [{x:12, y:0}, {x:20, y:-5}],
    CORNER: [{x:12, y:0}, {x:20, y:5}],
    SEAM: [{x:22, y:0}],
    // Deep
    GO: [{x:30, y:0}],
    FADE: [{x:25, y:3}],
    POST_CORNER: [{x:12, y:0}, {x:20, y:-5}, {x:25, y:0}],
    OUT_AND_UP: [{x:10,y:0},{x:10,y:5},{x:25,y:5}],
    // HB
    DIVE: [{x:3, y:0}],
    SWEEP: [{x:1, y:5}, {x:10, y:5}],
    SWING: [{x:2, y:5}, {x:8, y:5}],
    BLOCK: [],
};

export const PLAYBOOK: { [key: string]: any } = {
    // --- OFFENSE: I-FORM ---
    'hb_dive': { id: 'hb_dive', name: 'HB Dive', description: 'A direct run up the middle.', type: 'offense_run', formation: FORMATIONS.I_FORM_TWINS, formationName: 'I-Form', playCategory: 'Run', audibles: ['play_action', 'pitch_right'], routes: { HB: ROUTES.DIVE } },
    'play_action': { id: 'play_action', name: 'PA Boot', description: 'Fake the run, QB rolls out to pass.', type: 'offense_pass', formation: FORMATIONS.I_FORM_TWINS, formationName: 'I-Form', playCategory: 'Deep Pass', audibles: ['deep_bomb', 'hb_dive'], routes: { WR1: ROUTES.POST, TE: ROUTES.FLAT }, assignments: { WR1: { passButton: 'c' }, TE: { passButton: 'b' } } },
    'pitch_right': { id: 'pitch_right', name: 'HB Toss', description: 'Toss the ball to the HB running wide.', type: 'offense_run', formation: FORMATIONS.I_FORM_TWINS, formationName: 'I-Form', playCategory: 'Run', audibles: ['hb_dive', 'qb_sneak'], routes: { HB: ROUTES.SWEEP } },
    'te_attack': { id: 'te_attack', name: 'TE Attack', description: 'Routes designed to get the TE open.', type: 'offense_pass', formation: FORMATIONS.I_FORM_TWINS, formationName: 'I-Form', playCategory: 'Short Pass', audibles: ['hb_dive', 'pitch_right'], routes: { TE: ROUTES.CORNER, WR1: ROUTES.SLANT, WR2: ROUTES.GO }, assignments: { TE: { passButton: 'c' }, WR1: { passButton: 'b' } } },

    // --- OFFENSE: SHOTGUN ---
    'four_verts': { id: 'four_verts', name: 'Four Verticals', description: 'All four receivers run deep go routes.', type: 'offense_pass', formation: FORMATIONS.SHOTGUN_SPREAD, formationName: 'Shotgun', playCategory: 'Deep Pass', audibles: ['stick', 'wr_screen'], routes: { WR1: ROUTES.GO, WR2: ROUTES.GO, WR3: ROUTES.SEAM, WR4: ROUTES.SEAM }, assignments: { WR1: { passButton: 'd' }, WR2: { passButton: 'b' }, WR3: { passButton: 'c' } } },
    'stick': { id: 'stick', name: 'Stick', description: 'Quick pass concept with a vertical and a flat route.', type: 'offense_pass', formation: FORMATIONS.SHOTGUN_TRIPS, formationName: 'Shotgun', playCategory: 'Short Pass', audibles: ['four_verts', 'hb_draw'], routes: { WR1: ROUTES.GO, WR2: ROUTES.OUT, WR3: ROUTES.FLAT }, assignments: { WR2: { passButton: 'c' }, WR3: { passButton: 'b' } } },
    'wr_screen': { id: 'wr_screen', name: 'WR Screen', description: 'Quick throw to a WR behind blockers.', type: 'offense_pass', formation: FORMATIONS.SHOTGUN_SPREAD, formationName: 'Shotgun', playCategory: 'Short Pass', audibles: ['four_verts', 'hb_draw'], routes: { WR1: ROUTES.SCREEN, WR2: ROUTES.BLOCK, WR3: ROUTES.BLOCK }, assignments: { WR1: { passButton: 'b' } } },
    'hb_draw': { id: 'hb_draw', name: 'HB Draw', description: 'Fake a pass and hand off to the HB for a delayed run.', type: 'offense_run', formation: FORMATIONS.SHOTGUN_SPREAD, formationName: 'Shotgun', playCategory: 'Run', audibles: ['four_verts', 'stick'], routes: { HB: ROUTES.DIVE } },
    'mesh': { id: 'mesh', name: 'Mesh', description: 'Two receivers cross paths over the middle.', type: 'offense_pass', formation: FORMATIONS.SHOTGUN_SPREAD, formationName: 'Shotgun', playCategory: 'Short Pass', audibles: ['four_verts', 'stick'], routes: { WR3: [{x:10, y:-10}], WR4: [{x:10, y:10}], WR1: ROUTES.GO, WR2: ROUTES.CURL }, assignments: { WR3: { passButton: 'b' }, WR4: { passButton: 'c' } } },
    'qb_sneak': { id: 'qb_sneak', name: 'QB Sneak', description: 'QB runs forward for a short gain.', type: 'offense_run', formation: FORMATIONS.SHOTGUN_SPREAD, formationName: 'Shotgun', playCategory: 'Run', audibles: [], routes: { QB: [{x:2,y:0}] } },
    'double_outs': { id: 'double_outs', name: 'Double Outs', description: 'Both outside receivers run 10 yard out routes.', type: 'offense_pass', formation: FORMATIONS.SHOTGUN_SPREAD, formationName: 'Shotgun', playCategory: 'Short Pass', audibles: ['mesh', 'hb_draw'], routes: { WR1: ROUTES.OUT, WR2: ROUTES.OUT, WR3: ROUTES.SEAM, WR4: ROUTES.SEAM }, assignments: { WR1: { passButton: 'd' }, WR2: { passButton: 'b' } } },

    // --- OFFENSE: SINGLEBACK ---
    'levels': { id: 'levels', name: 'Levels', description: 'Two receivers run in-breaking routes at different depths.', type: 'offense_pass', formation: FORMATIONS.SINGLEBACK_ACE, formationName: 'Singleback', playCategory: 'Short Pass', audibles: ['pa_cross', 'hb_stretch'], routes: { WR1: ROUTES.IN, WR2: ROUTES.DRAG }, assignments: { WR1: { passButton: 'c' }, WR2: { passButton: 'b' } } },
    'pa_crossers': { id: 'pa_crossers', name: 'PA Crossers', description: 'Play action with receivers crossing deep.', type: 'offense_pass', formation: FORMATIONS.SINGLEBACK_ACE, formationName: 'Singleback', playCategory: 'Deep Pass', audibles: ['levels', 'hb_stretch'], routes: { WR1: ROUTES.POST, WR2: [{x:15, y:15}]}, assignments: { WR1: { passButton: 'c' }, WR2: { passButton: 'b' } } },
    'hb_stretch': { id: 'hb_stretch', name: 'HB Stretch', description: 'Outside run for the halfback.', type: 'offense_run', formation: FORMATIONS.SINGLEBACK_ACE, formationName: 'Singleback', playCategory: 'Run', audibles: ['levels', 'pa_crossers'], routes: { HB: ROUTES.SWEEP } },
    'sluggo': { id: 'sluggo', name: 'Slant and Go', description: 'Receiver fakes a slant then goes deep.', type: 'offense_pass', formation: FORMATIONS.SINGLEBACK_ACE, formationName: 'Singleback', playCategory: 'Deep Pass', audibles: ['levels', 'hb_stretch'], routes: { WR1: [{x:3, y:2}, {x:25,y:2}], WR2: ROUTES.DRAG }, assignments: { WR1: { passButton: 'c' }, WR2: { passButton: 'b' } } },

    // --- OFFENSE: PISTOL ---
    'pistol_pa_seam': { id: 'pistol_pa_seam', name: 'Pistol PA Seams', description: 'Deep shot to the seams out of the pistol formation.', type: 'offense_pass', formation: FORMATIONS.PISTOL_ACE, formationName: 'Pistol', playCategory: 'Deep Pass', audibles: ['pistol_dive', 'pistol_read'], routes: { WR1: ROUTES.SEAM, WR2: ROUTES.SEAM }, assignments: { WR1: { passButton: 'c' }, WR2: { passButton: 'b' } } },
    'pistol_dive': { id: 'pistol_dive', name: 'Pistol Dive', description: 'Quick handoff up the middle from the pistol.', type: 'offense_run', formation: FORMATIONS.PISTOL_ACE, formationName: 'Pistol', playCategory: 'Run', audibles: ['pistol_pa_seam', 'pistol_read'], routes: { HB: ROUTES.DIVE } },

    // --- SPECIAL TEAMS ---
    'field_goal': { id: 'field_goal', name: 'Field Goal', description: 'Attempt a field goal.', type: 'special_teams', formation: FORMATIONS.FG_FORMATION, formationName: 'Field Goal', playCategory: 'Special Teams' },
    'punt': { id: 'punt', name: 'Punt', description: 'Punt the ball downfield.', type: 'special_teams', formation: FORMATIONS.PUNT_FORMATION, formationName: 'Punt', playCategory: 'Special Teams' },

    // --- DEFENSE ---
    'cover_2': { id: 'cover_2', name: 'Cover 2', description: 'Two deep safeties, corners cover the flats.', type: 'defense', formation: FORMATIONS.DEF_4_3, formationName: '4-3', playCategory: 'Zone', assignments: { S1: { cover: 'zone', area: 'deep_half_right' }, S2: { cover: 'zone', area: 'deep_half_left' }, CB1: { cover: 'zone', area: 'flat' }, CB2: { cover: 'zone', area: 'flat' } } },
    'cover_3': { id: 'cover_3', name: 'Cover 3', description: 'Three deep defenders, four underneath.', type: 'defense', formation: FORMATIONS.DEF_4_3, formationName: '4-3', playCategory: 'Zone', assignments: { S1: { cover: 'zone', area: 'deep_middle' }, CB1: { cover: 'zone', area: 'deep_third' }, CB2: { cover: 'zone', area: 'deep_third' } } },
    'man_2_under': { id: 'man_2_under', name: '2 Man Under', description: 'Man coverage with two deep safeties.', type: 'defense', formation: FORMATIONS.DEF_4_3, formationName: '4-3', playCategory: 'Man', assignments: { S1: { cover: 'zone', area: 'deep_half_right' }, S2: { cover: 'zone', area: 'deep_half_left' }, CB1: { cover: 'man', target: 'WR1' }, CB2: { cover: 'man', target: 'WR2' }, LB1: {cover: 'man', target: 'HB'} } },
    'ss_blitz': { id: 'ss_blitz', name: 'SS Blitz', description: 'Strong safety blitzes from the edge.', type: 'defense', formation: FORMATIONS.DEF_4_3, formationName: '4-3', playCategory: 'Blitz', assignments: { S1: { cover: 'blitz' }, CB1: { cover: 'man', target: 'WR1' }, CB2: { cover: 'man', target: 'WR2' } } },
    'cover_1_man': { id: 'cover_1_man', name: 'Cover 1 Man', description: 'Man coverage with a single high safety.', type: 'defense', formation: FORMATIONS.DEF_3_4, formationName: '3-4', playCategory: 'Man', assignments: { S1: { cover: 'zone', area: 'deep_middle' }, CB1: { cover: 'man', target: 'WR1' }, CB2: { cover: 'man', target: 'WR2' }, LB1: {cover: 'man', target: 'HB'}, LB2: {cover: 'man', target: 'TE'} } },
    'olb_fire': { id: 'olb_fire', name: 'OLB Fire', description: 'Outside linebackers blitz.', type: 'defense', formation: FORMATIONS.DEF_3_4, formationName: '3-4', playCategory: 'Blitz', assignments: { LB3: { cover: 'blitz' }, LB4: { cover: 'blitz' }, S1: { cover: 'zone', area: 'deep_middle' } } },
    'nickel_blitz': { id: 'nickel_blitz', name: 'Nickel Blitz', description: 'The nickel corner blitzes from the slot.', type: 'defense', formation: FORMATIONS.DEF_NICKEL, formationName: 'Nickel', playCategory: 'Blitz', assignments: { CB3: { cover: 'blitz' }, S1: { cover: 'zone', area: 'deep_half' }, S2: { cover: 'zone', area: 'deep_half' } } },
    'cover_0_blitz': { id: 'cover_0_blitz', name: 'Cover 0 Blitz', description: 'All-out blitz with no deep help.', type: 'defense', formation: FORMATIONS.DEF_NICKEL, formationName: 'Nickel', playCategory: 'Blitz', assignments: { CB1: { cover: 'man', target: 'WR1' }, CB2: { cover: 'man', target: 'WR2' }, LB1: { cover: 'blitz' }, S1: { cover: 'blitz' } } },
    'punt_return': { id: 'punt_return', name: 'Punt Return', description: 'Set up a return for a punt.', type: 'defense', formation: FORMATIONS.DEF_PUNT_RETURN, formationName: 'Punt Return', playCategory: 'Special Teams' },
    'fg_block': { id: 'fg_block', name: 'FG Block', description: 'Attempt to block a field goal.', type: 'defense', formation: FORMATIONS.DEF_FG_BLOCK, formationName: 'FG Block', playCategory: 'Special Teams' }
};
