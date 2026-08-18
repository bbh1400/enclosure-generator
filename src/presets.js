// Selecting a drive type loads its `dev` values as the STARTING POINT; every
// value remains editable afterwards. Lengths/widths are SFF maximums so any
// in-spec drive fits once clearance is added.
export const DRIVE_PRESETS = {
  '2.5-7':   { label: '2.5" SSD (7 mm)',        dev: { driveW: 69.85, driveL: 100.45, driveH: 7.0,  gap: 5,  bumps: true } },
  '2.5-9.5': { label: '2.5" SSD/HDD (9.5 mm)',  dev: { driveW: 69.85, driveL: 100.45, driveH: 9.5,  gap: 5,  bumps: true } },
  '2.5-15':  { label: '2.5" HDD (15 mm)',       dev: { driveW: 69.85, driveL: 100.45, driveH: 15.0, gap: 6,  bumps: true } },
  '3.5':     { label: '3.5" HDD',               dev: { driveW: 101.6, driveL: 147.0,  driveH: 26.1, gap: 10, bumps: false, wallT: 3.0, railDepth: 6.0, railT: 2.5 } },
};

// Global starting values (merged with the selected preset's `dev`).
export const DEFAULTS = {
  preset: '2.5-7',
  // drive envelope
  driveW: 69.85, driveL: 100.45, driveH: 7.0,
  nDrives: 6, gap: 5,
  // fit
  slotClr: 0.5, sideClr: 0.6,
  // structure
  wallT: 3.0, railDepth: 5.0, railT: 2.0, baseT: 3.0, backT: 3.0, topCap: 3.0,
  // retention
  bumps: true, bumpH: 0.4, bumpHalf: 3.0, bumpYc: 11.0,
  // options
  baseVent: true, backWindow: true,
};

// Fields that are device-specific and get reset when the drive type changes.
// (nDrives is preserved across type switches.)
export const DEVICE_FIELDS = [
  'driveW', 'driveL', 'driveH', 'gap', 'slotClr', 'sideClr',
  'wallT', 'railDepth', 'railT', 'baseT', 'backT', 'topCap',
  'bumps', 'bumpH', 'bumpHalf', 'bumpYc',
];
