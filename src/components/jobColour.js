export const JOB_COLOUR_PALETTE = [
  "#4f7cff",
  "#24bfa5",
  "#9a72f2",
  "#e3a83b",
  "#df6b8f",
  "#50aee8",
  "#78b957",
  "#ee7d55",
  "#6c83e6",
  "#c18a5a",
  "#39a8bd",
  "#b06ecf",
];

export function normaliseJobColour(value) {
  const colour = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(colour)) return colour.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(colour)) {
    return `#${colour
      .slice(1)
      .split("")
      .map((digit) => `${digit}${digit}`)
      .join("")}`.toLowerCase();
  }
  return "";
}

function colourIndex(seed) {
  let hash = 0;
  for (const character of String(seed || "JNR job")) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return Math.abs(hash) % JOB_COLOUR_PALETTE.length;
}

export function getJobColour(job) {
  const selected = normaliseJobColour(
    job?.color || job?.colour || job?.jobColor,
  );
  if (selected) return selected;
  const seed = `${job?.id || ""}:${job?.name || job?.title || "JNR job"}`;
  return JOB_COLOUR_PALETTE[colourIndex(seed)];
}
