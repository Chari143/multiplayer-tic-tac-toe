/// <reference path="../types/nakama.d.ts" />

interface TttState {
    presences: { [sessionId: string]: nkruntime.Presence };
    players: { [userId: string]: "X" | "O" };
    playersInfo: { [userId: string]: { name: string } };
    board: string[];
    next: "X" | "O" | null;
    winner: "X" | "O" | "draw" | null;
    started: boolean;
    mode: "classic" | "timed";
    turnDeadline: number | null;
}

const OpCode = {
    Move: 1,
    State: 2,
    Error: 3,
};

function encodeState(state: TttState): string {
    return JSON.stringify({
        board: state.board,
        next: state.next,
        winner: state.winner,
        players: state.players,
        playersInfo: state.playersInfo,
        mode: state.mode,
        turnDeadline: state.turnDeadline,
        started: state.started,
    });
}

function matchInit(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, params: { [key: string]: string }): { state: TttState; tickRate: number; label: string } {
    const mode = params.mode === "timed" ? "timed" : "classic";

    logger.info("matchInit called with mode: %s", mode);

    const state: TttState = {
        presences: {},
        players: {},
        playersInfo: {},
        board: ["", "", "", "", "", "", "", "", ""],
        next: null,
        winner: null,
        started: false,
        mode: mode,
        turnDeadline: null,
    };

    return { state, tickRate: 1, label: `ttt:${mode}` };
}

function matchJoinAttempt(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: TttState, presence: nkruntime.Presence, metadata: { [key: string]: any }): { state: TttState; accept: boolean; rejectMessage?: string } | null {
    if (Object.keys(state.players).length >= 2) {
        return { state, accept: false, rejectMessage: "match_full" };
    }
    return { state, accept: true };
}

function matchJoin(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: TttState, presences: nkruntime.Presence[]): { state: TttState } | null {
    for (const p of presences) {
        state.presences[p.sessionId] = p;

        if (!state.players[p.userId]) {
            const assigned = Object.keys(state.players).length === 0 ? "X" : "O";
            state.players[p.userId] = assigned;

            try {
                const account = nk.accountGetId(p.userId);
                const name = account.user.displayName || account.user.username || "Unknown";
                state.playersInfo[p.userId] = { name };
            } catch (e) {
                state.playersInfo[p.userId] = { name: "Unknown" };
            }

            logger.info("Player joined: userId=%s, assigned=%s", p.userId, assigned);
        }
    }

    if (state.winner) {
        state.board = ["", "", "", "", "", "", "", "", ""];
        state.next = "X";
        state.winner = null;
        state.started = false;
        state.turnDeadline = null;
        logger.info("Reset game for new round");
    }

    const count = Object.keys(state.players).length;
    if (count === 2) {
        if (!state.started) {
            state.started = true;
            state.next = "X";
            if (state.mode === "timed") {
                state.turnDeadline = Date.now() + 30000;
            }
            logger.info("Game started: %s", JSON.stringify(state.players));
        }
        dispatcher.broadcastMessage(OpCode.State, encodeState(state));
    } else {
        dispatcher.broadcastMessage(OpCode.State, encodeState(state), presences);
    }

    return { state };
}

function matchLeave(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: TttState, presences: nkruntime.Presence[]): { state: TttState } | null {
    for (const p of presences) {
        delete state.presences[p.sessionId];
        if (state.players[p.userId]) {
            delete state.players[p.userId];
        }
    }

    const remaining = Object.keys(state.players).length;
    if (remaining === 0) {
        return null;
    }

    if (remaining === 1 && !state.winner) {
        const remainingSymbol = Object.values(state.players)[0];
        state.winner = remainingSymbol;
        state.next = null;
        dispatcher.broadcastMessage(OpCode.State, encodeState(state));
    }

    return { state };
}

function checkWin(board: string[]): string | null {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    for (const [a, b, c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }

    if (board.every(v => v !== "")) {
        return "draw";
    }

    return null;
}

function matchLoop(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: TttState, messages: nkruntime.MatchMessage[]): { state: TttState } | null {
    if (state.mode === "timed" && state.turnDeadline && !state.winner) {
        if (Date.now() > state.turnDeadline) {
            state.winner = state.next === "X" ? "O" : "X";
            state.next = null;
            dispatcher.broadcastMessage(OpCode.State, encodeState(state));
        }
    }

    for (const m of messages) {
        if (m.opCode !== OpCode.Move) continue;

        const userId = m.sender.userId;
        const playerSymbol = state.players[userId];

        if (!playerSymbol) {
            dispatcher.broadcastMessage(OpCode.Error, JSON.stringify({ error: "not_in_match" }), [m.sender]);
            continue;
        }

        if (state.next !== playerSymbol) {
            dispatcher.broadcastMessage(OpCode.Error, JSON.stringify({ error: "not_your_turn" }), [m.sender]);
            continue;
        }

        let cell: number;
        try {
            const payload = JSON.parse(nk.binaryToString(m.data));
            cell = Number(payload.cell);
        } catch (e) {
            dispatcher.broadcastMessage(OpCode.Error, JSON.stringify({ error: "bad_payload" }), [m.sender]);
            continue;
        }

        if (!Number.isInteger(cell) || cell < 0 || cell > 8 || state.board[cell] !== "") {
            dispatcher.broadcastMessage(OpCode.Error, JSON.stringify({ error: "invalid_move" }), [m.sender]);
            continue;
        }

        state.board[cell] = playerSymbol;
        const win = checkWin(state.board);

        if (win) {
            state.winner = win === "draw" ? "draw" : (win as "X" | "O");
            state.next = null;

            if (state.winner !== "draw") {
                const winnerId = Object.keys(state.players).find(uid => state.players[uid] === state.winner);
                if (winnerId) {
                    try {
                        const records = nk.leaderboardRecordsList("global_wins", [winnerId], 1);
                        let score = 1;
                        if (records && records.records && records.records.length > 0) {
                            score = records.records[0].score + 1;
                        }
                        const name = state.playersInfo[winnerId]?.name || "Unknown";
                        nk.leaderboardRecordWrite("global_wins", winnerId, name, score);
                    } catch (e) { }
                }
            }
        } else {
            state.next = playerSymbol === "X" ? "O" : "X";
            if (state.mode === "timed") {
                state.turnDeadline = Date.now() + 30000;
            }
        }

        dispatcher.broadcastMessage(OpCode.State, encodeState(state));
    }

    return { state };
}

function matchTerminate(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: TttState, graceSeconds: number): { state: TttState } | null {
    return { state };
}

function matchSignal(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: TttState, data: string): { state: TttState; result: string } | null {
    return { state, result: "" };
}

function rpcCreateOrJoinMatch(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    let mode = "classic";
    try {
        const p = JSON.parse(payload || "{}");
        if (p.mode === "timed") mode = "timed";
    } catch (e) { }

    const label = `ttt:${mode}`;
    const matches = nk.matchList(10, true, label, 0, 1);

    let matchId: string;
    if (matches && matches.length > 0) {
        matchId = matches[0].matchId;
    } else {
        matchId = nk.matchCreate("ttt", { mode });
    }

    return JSON.stringify({ matchId });
}

function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, initializer: nkruntime.Initializer) {
    initializer.registerMatch("ttt", {
        matchInit,
        matchJoinAttempt,
        matchJoin,
        matchLeave,
        matchLoop,
        matchTerminate,
        matchSignal,
    });

    initializer.registerRpc("create_or_join_ttt", rpcCreateOrJoinMatch);

    try {
        nk.leaderboardCreate("global_wins", "desc", "best", "0 0 * * *", {}, false);
    } catch (e) { }

    logger.info("Tic-Tac-Toe module loaded successfully");
}
