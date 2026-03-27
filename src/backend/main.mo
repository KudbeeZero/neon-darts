import Runtime "mo:core/Runtime";
import Text "mo:core/Text";
import Principal "mo:core/Principal";
import Iter "mo:core/Iter";
import Time "mo:core/Time";
import Int "mo:core/Int";
import Order "mo:core/Order";
import Map "mo:core/Map";
import Array "mo:core/Array";

actor {
  type GameResult = {
    playerName : Text;
    remainingScore : Nat;
    dartsThrown : Nat;
    didWin : Bool;
    timestamp : Time.Time;
    scoreSubmittedBy : Principal;
  };

  module GameResult {
    public func compare(result1 : GameResult, result2 : GameResult) : Order.Order {
      if (result1.remainingScore == 0 and result2.remainingScore == 0) {
        return Nat.compare(result1.dartsThrown, result2.dartsThrown);
      };

      if (result1.didWin and result2.didWin) {
        return Nat.compare(result1.dartsThrown, result2.dartsThrown);
      };

      if (result1.didWin) { return #less };
      if (result2.didWin) { return #greater };

      Int.compare(result2.timestamp, result1.timestamp);
    };

    public func compareByTimestamp(result1 : GameResult, result2 : GameResult) : Order.Order {
      Int.compare(result2.timestamp, result1.timestamp);
    };
  };

  let games = Map.empty<Nat, GameResult>();
  var nextGameId = 0;

  public shared ({ caller }) func submitGame(playerName : Text, remainingScore : Nat, dartsThrown : Nat, didWin : Bool) : async Nat {
    let result : GameResult = {
      playerName;
      remainingScore;
      dartsThrown;
      didWin;
      timestamp = Time.now();
      scoreSubmittedBy = caller;
    };

    games.add(nextGameId, result);
    let id = nextGameId;
    nextGameId += 1;
    id;
  };

  public query func getResult(gameId : Nat) : async GameResult {
    switch (games.get(gameId)) {
      case (null) { Runtime.trap("Game with id " # gameId.toText() # " does not exist.") };
      case (?game) { game };
    };
  };

  public query func getLeaderboard() : async [GameResult] {
    games.values().toArray().sort().sliceToArray(0, 10);
  };

  public query func getRecentGames() : async [GameResult] {
    games.values().toArray().sort(GameResult.compareByTimestamp).sliceToArray(0, 10);
  };

  public query ({ caller }) func getPlayerGames() : async [GameResult] {
    games.entries().filter(
      func(entry) {
        let (_, result) = entry;
        result.scoreSubmittedBy == caller;
      }
    ).map(
      func(entry) {
        let (_, result) = entry;
        result;
      }
    ).toArray();
  };
};
