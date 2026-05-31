import type { VoteDisplayMode } from "./settings";

export const voteValues = ["A", "B", "U"] as const;
export type VoteValue = (typeof voteValues)[number];

export interface VoteSummary {
  a: number;
  b: number;
  u: number;
  positive: number;
  negative: number;
  total: number;
  positiveRatio: number;
  positiveMargin: number;
}

export interface VoteDisplayOption {
  value: VoteValue;
  label: string;
  count: number;
  active: boolean;
}

export function getVoteDisplayOptions(
  mode: VoteDisplayMode,
  voteCounts: { voteA: number; voteB: number; voteU: number; userVote: VoteValue | null },
): VoteDisplayOption[] {
  if (mode === "up_down") {
    return [
      {
        value: voteCounts.userVote === "A" ? "A" : "B",
        label: "Up",
        count: voteCounts.voteA + voteCounts.voteB,
        active: voteCounts.userVote === "A" || voteCounts.userVote === "B",
      },
      {
        value: "U",
        label: "Down",
        count: voteCounts.voteU,
        active: voteCounts.userVote === "U",
      },
    ];
  }

  return [
    { value: "A", label: "A", count: voteCounts.voteA, active: voteCounts.userVote === "A" },
    { value: "B", label: "B", count: voteCounts.voteB, active: voteCounts.userVote === "B" },
    { value: "U", label: "U", count: voteCounts.voteU, active: voteCounts.userVote === "U" },
  ];
}

export function voteDisplayLabel(mode: VoteDisplayMode, value: VoteValue) {
  if (mode === "up_down") return value === "U" ? "Down" : "Up";
  return value;
}
