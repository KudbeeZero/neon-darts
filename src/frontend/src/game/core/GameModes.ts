import type { ZoneResult } from "./ScoringGrid";

export type GameModeType = "301" | "around_world" | "doubles" | "triples";

export interface ModeState {
  type: GameModeType;
  /** 301: remaining score; practice: hit count */
  score: number;
  /** Current target segment (1-20). 0 = any (301 mode). */
  target: number;
  targetLabel: string;
  dartsThisRound: number;
  isComplete: boolean;
  message: string;
  feedback: string;
}

export function createInitialState(mode: GameModeType): ModeState {
  switch (mode) {
    case "301":
      return {
        type: mode,
        score: 301,
        target: 0,
        targetLabel: "Any",
        dartsThisRound: 0,
        isComplete: false,
        message: "Score exactly 0 to win!",
        feedback: "",
      };
    case "around_world":
      return {
        type: mode,
        score: 0,
        target: 1,
        targetLabel: "1",
        dartsThisRound: 0,
        isComplete: false,
        message: "Hit 1→20 in order!",
        feedback: "",
      };
    case "doubles":
      return {
        type: mode,
        score: 0,
        target: 1,
        targetLabel: "D1",
        dartsThisRound: 0,
        isComplete: false,
        message: "Hit all doubles D1→D20!",
        feedback: "",
      };
    case "triples":
      return {
        type: mode,
        score: 0,
        target: 1,
        targetLabel: "T1",
        dartsThisRound: 0,
        isComplete: false,
        message: "Hit all triples T1→T20!",
        feedback: "",
      };
  }
}

export function processThrow(
  zone: ZoneResult,
  state: ModeState,
): { newState: ModeState; feedback: string; isHit: boolean } {
  const ns: ModeState = { ...state, dartsThisRound: state.dartsThisRound + 1 };

  switch (state.type) {
    case "301": {
      const newScore = state.score - zone.score;
      if (newScore < 0) {
        ns.feedback = "BUST!";
        ns.message = `${state.score} remaining`;
        return { newState: ns, feedback: "BUST!", isHit: false };
      }
      ns.score = newScore;
      ns.isComplete = newScore === 0;
      ns.feedback = zone.score > 0 ? `+${zone.score}` : "Miss";
      ns.message = newScore === 0 ? "🏆 YOU WIN!" : `${newScore} remaining`;
      return { newState: ns, feedback: ns.feedback, isHit: zone.score > 0 };
    }

    case "around_world": {
      const hit = zone.segment === state.target && zone.ring !== "miss";
      if (hit) {
        const next = state.target < 20 ? state.target + 1 : 21;
        ns.target = next;
        ns.targetLabel = next > 20 ? "DONE" : String(next);
        ns.score = state.score + 1;
        ns.isComplete = state.target === 20;
        ns.message = ns.isComplete
          ? "🏆 YOU WIN!"
          : `Hit: ${next > 20 ? "done" : next}`;
        ns.feedback = `${state.target} ✓`;
      } else {
        ns.feedback = zone.ring === "miss" ? "Miss!" : `Need ${state.target}`;
      }
      return { newState: ns, feedback: ns.feedback, isHit: hit };
    }

    case "doubles": {
      const hit = zone.segment === state.target && zone.ring === "double";
      if (hit) {
        const next = state.target < 20 ? state.target + 1 : 21;
        ns.target = next;
        ns.targetLabel = next > 20 ? "DONE" : `D${next}`;
        ns.score = state.score + 1;
        ns.isComplete = state.target === 20;
        ns.message = ns.isComplete ? "🏆 YOU WIN!" : `Next: D${next}`;
        ns.feedback = `D${state.target} ✓`;
      } else {
        ns.feedback = `Need D${state.target}`;
      }
      return { newState: ns, feedback: ns.feedback, isHit: hit };
    }

    case "triples": {
      const hit = zone.segment === state.target && zone.ring === "triple";
      if (hit) {
        const next = state.target < 20 ? state.target + 1 : 21;
        ns.target = next;
        ns.targetLabel = next > 20 ? "DONE" : `T${next}`;
        ns.score = state.score + 1;
        ns.isComplete = state.target === 20;
        ns.message = ns.isComplete ? "🏆 YOU WIN!" : `Next: T${next}`;
        ns.feedback = `T${state.target} ✓`;
      } else {
        ns.feedback = `Need T${state.target}`;
      }
      return { newState: ns, feedback: ns.feedback, isHit: hit };
    }
  }
}
