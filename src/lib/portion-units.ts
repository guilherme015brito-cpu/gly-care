export const PORTION_UNIT_IDS = [
  "g",
  "ml",
  "un",
  "fatia",
  "colher",
  "colher_sopa",
  "colher_cha",
  "concha",
  "copo",
  "xicara",
  "pote",
] as const;
export type PortionUnit = (typeof PORTION_UNIT_IDS)[number];
export const PORTION_UNITS: Record<PortionUnit, string> = {
  g: "g",
  ml: "ml",
  un: "unidade (un)",
  fatia: "fatia",
  colher: "colher",
  colher_sopa: "colher de sopa",
  colher_cha: "colher de chá",
  concha: "concha",
  copo: "copo",
  xicara: "xícara",
  pote: "pote",
};
