import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface GameResult {
    remainingScore: bigint;
    dartsThrown: bigint;
    timestamp: Time;
    playerName: string;
    didWin: boolean;
    scoreSubmittedBy: Principal;
}
export type Time = bigint;
export interface backendInterface {
    getLeaderboard(): Promise<Array<GameResult>>;
    getPlayerGames(): Promise<Array<GameResult>>;
    getRecentGames(): Promise<Array<GameResult>>;
    getResult(gameId: bigint): Promise<GameResult>;
    submitGame(playerName: string, remainingScore: bigint, dartsThrown: bigint, didWin: boolean): Promise<bigint>;
}
