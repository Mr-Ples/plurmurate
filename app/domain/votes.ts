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
