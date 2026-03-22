/**
 * Portal visual stage definitions.
 * Maps progress ranges (0-100) to named stages per PRD.md Section 6.2.
 */

export const PORTAL_STAGES = [
  {
    name: "Dormant",
    minProgress: 0,
    description: "The void is still.",
  },
  {
    name: "Stirring",
    minProgress: 10,
    description: "A crack appears in the fabric of space.",
  },
  {
    name: "Fracturing",
    minProgress: 30,
    description: "The tear widens. Something stirs within.",
  },
  {
    name: "Breaching",
    minProgress: 60,
    description: "The rift is open. Appendages reach through.",
  },
  {
    name: "The Eye Opens",
    minProgress: 80,
    description: "It sees you.",
  },
  {
    name: "Manifestation",
    minProgress: 95,
    description: "IMMINENT.",
  },
] as const;

export type PortalStage = typeof PORTAL_STAGES[number];

export function getStageForProgress(progress: number): PortalStage {
  let stage: PortalStage = PORTAL_STAGES[0];
  for (const s of PORTAL_STAGES) {
    if (progress >= s.minProgress) stage = s;
  }
  return stage;
}
