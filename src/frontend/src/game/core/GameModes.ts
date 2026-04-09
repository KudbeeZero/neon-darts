import type { ZoneResult } from "./ScoringGrid";

export type GameModeType = "301" | "around_world" | "doubles" | "triples";

export interface ModeState {
  type: GameModeType;
  /** 301: remaining score; practice: hit count */
  score: number;
  /** Score at start of current round (for 301 bust revert) */
  roundStartScore: number;
  /** Current target segment (1-20). 0 = any (301 mode). */
  target: number;
  targetLabel: string;
  /** Darts thrown this round (0-3) */
  dartsThisRound: number;
  /** Round number (1-indexed) */
  round: number;
  isComplete: boolean;
  isBust: boolean;
  message: string;
  feedback: string;
}

export function createInitialState(mode: GameModeType): ModeState {
  switch (mode) {
    case "301":
      return {
        type: mode,
        score: 301,
        roundStartScore: 301,
        target: 0,
        targetLabel: "Any",
        dartsThisRound: 0,
        round: 1,
        isComplete: false,
        isBust: false,
        message: "Score exactly 0 to win!",
        feedback: "",
      };
    case "around_world":
      return {
        type: mode,
        score: 0,
        roundStartScore: 0,
        target: 1,
        targetLabel: "1",
        dartsThisRound: 0,
        round: 1,
        isComplete: false,
        isBust: false,
        message: "Hit 1→20 in order!",
        feedback: "",
      };
    case "doubles":
      return {
        type: mode,
        score: 0,
        roundStartScore: 0,
        target: 1,
        targetLabel: "D1",
        dartsThisRound: 0,
        round: 1,
        isComplete: false,
        isBust: false,
        message: "Hit all doubles D1→D20!",
        feedback: "",
      };
    case "triples":
      return {
        type: mode,
        score: 0,
        roundStartScore: 0,
        target: 1,
        targetLabel: "T1",
        dartsThisRound: 0,
        round: 1,
        isComplete: false,
        isBust: false,
        message: "Hit all triples T1→T20!",
        feedback: "",
      };
  }
}

/** Called each time a dart lands. Returns the new state. */
export function processThrow(
  zone: ZoneResult,
  state: ModeState,
): { newState: ModeState; feedback: string; isHit: boolean } {
  const dartsAfter = state.dartsThisRound + 1;
  const ns: ModeState = {
    ...state,
    dartsThisRound: dartsAfter,
    isBust: false,
  };

  switch (state.type) {
    case "301": {
      const attempted = state.score - zone.score;
      if (attempted < 0) {
        // BUST — revert score to round start, mark bust
        ns.score = state.roundStartScore;
        ns.isBust = true;
        ns.feedback = "BUST!";
        ns.message = `${state.roundStartScore} remaining`;
        return { newState: ns, feedback: "BUST!", isHit: false };
      }
      ns.score = attempted;
      ns.isComplete = attempted === 0;
      ns.feedback = zone.score > 0 ? `+${zone.score}` : "Miss";
      ns.message = attempted === 0 ? "🏆 YOU WIN!" : `${attempted} remaining`;
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
        ns.message = ns.isComplete ? "🏆 YOU WIN!" : `Next: ${next}`;
        ns.feedback = `${state.target} ✓`;
      } else {
        ns.feedback = zone.ring === "miss" ? "Miss!" : `Need ${state.target}`;
        ns.message = `Hit: ${state.target}`;
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
        ns.message = `Hit: D${state.target}`;
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
        ns.message = `Hit: T${state.target}`;
      }
      return { newState: ns, feedback: ns.feedback, isHit: hit };
    }
  }
}

/** Called when a round ends (3 darts thrown or game complete). Advances round counter and resets per-round tracking. */
export function advanceRound(state: ModeState): ModeState {
  return {
    ...state,
    round: state.round + 1,
    dartsThisRound: 0,
    // For 301: snapshot current score as new round start (for bust revert)
    roundStartScore: state.type === "301" ? state.score : state.roundStartScore,
    isBust: false,
    message: state.type === "301" ? `${state.score} remaining` : state.message,
  };
}
