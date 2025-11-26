import { useState, useRef, useEffect, useCallback } from "react";
import { Client, Session, Socket, MatchmakerMatched } from "@heroiclabs/nakama-js";
import {
  createClient,
  authenticateDevice,
  connectSocket,
  addToMatchmaker,
  removeFromMatchmaker,
  createOrJoinTttMatch,
  OpCode,
  TttState,
} from "../lib/nakama";

export type View = "entry" | "matching" | "playing" | "gameOver";

export const useGame = () => {
  const [client] = useState<Client>(() => createClient());
  const [username, setUsername] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [view, setView] = useState<View>("entry");
  const [ticket, setTicket] = useState<string | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [state, setState] = useState<TttState | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [gameMode, setGameMode] = useState<"classic" | "timed">("classic");
  const mmTimerRef = useRef<number | null>(null);
  const matchingRef = useRef<boolean>(false);
  const matchedRef = useRef<boolean>(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  const fetchLeaderboard = useCallback(async () => {
    if (!session) return;
    try {
      const result = await client.listLeaderboardRecords(session, "global_wins", [], 10);
      setLeaderboard(result.records || []);
    } catch {
      setLeaderboard([]);
    }
  }, [client, session]);

  const attachSocketHandlers = useCallback((sock: Socket) => {
    sock.onmatchdata = (result) => {
      const op = result.op_code;
      const text = new TextDecoder().decode(result.data);
      if (op === OpCode.State) {
        try {
          const s = JSON.parse(text) as TttState;
          setState(s);

          if (s.started && !s.winner) {
            setView("playing");
          }

          if (s.winner) {
            setView("gameOver");
          }
        } catch (e) { }
      } else if (op === OpCode.Error) {
        setLastError(text);
      }
    };

    sock.onmatchpresence = (presenceEvent) => {
      // Handle when a player leaves the match
      if (presenceEvent.leaves && presenceEvent.leaves.length > 0) {
        // Backend will set the winner when a player leaves
        // The state update will be received via onmatchdata
      }
    };

    sock.ondisconnect = () => {
      setLastError("Disconnected from server");
      setView("entry");
      setSession(null);
      setMatchId(null);
      setState(null);
      socketRef.current = null;
    };
  }, []);

  // We need to trigger leaderboard fetch when entering gameOver view
  useEffect(() => {
    if (view === "gameOver") {
      fetchLeaderboard();
    }
  }, [view, fetchLeaderboard]);

  const joinMatchWithRetry = async (sock: Socket, sess: Session, mode: "classic" | "timed", excludeMatchId?: string) => {
    const label = `ttt:${mode}`;

    // Attempt 1: Try to find existing match
    try {
      const matches = await client.listMatches(sess, 10, true, label, 0, 1);
      const validMatch = matches.matches?.find(m => m.match_id !== excludeMatchId);
      if (validMatch) {
        return await sock.joinMatch(validMatch.match_id);
      }
    } catch (e) { }

    // Wait random time to reduce race condition
    const jitter = 500 + Math.floor(Math.random() * 1000);
    await new Promise(r => setTimeout(r, jitter));

    // Attempt 2: Try to find existing match again
    try {
      const matches = await client.listMatches(sess, 10, true, label, 0, 1);
      const validMatch = matches.matches?.find(m => m.match_id !== excludeMatchId);
      if (validMatch) {
        return await sock.joinMatch(validMatch.match_id);
      }
    } catch (e) { }

    // Attempt 3: Use RPC to create/join (fallback)
    let attempts = 0;
    while (attempts < 3) {
      try {
        const id = await createOrJoinTttMatch(client, sess, mode);
        // Ensure we don't join the excluded match if RPC returns it (unlikely but possible)
        if (id === excludeMatchId) {
          attempts++;
          await new Promise(r => setTimeout(r, 500));
          continue;
        }
        const m = await sock.joinMatch(id);
        return m;
      } catch (e: any) {
        // Retry on "Invalid match ID" (Code 3) or similar
        if (e?.code === 3 || String(e).includes("Invalid match ID") || String(e).includes("match_full")) {
          // RPC join/create attempt failed, retry if needed
          attempts++;
          await new Promise(r => setTimeout(r, 500));
          continue;
        }
        throw e;
      }
    }
    throw new Error("Failed to join match after multiple attempts");
  };

  const queueMatchmaking = useCallback(async (sock: Socket, sess: Session) => {
    try {
      // Clear any existing timer first
      if (mmTimerRef.current) {
        clearTimeout(mmTimerRef.current);
        mmTimerRef.current = null;
      }

      setView("matching");
      matchingRef.current = true;
      matchedRef.current = false;
      const mm = await addToMatchmaker(sock, "*", 2, 2, { mode: gameMode });
      setTicket(mm.ticket);

      sock.onmatchmakermatched = async (matched: MatchmakerMatched) => {
        if (matchedRef.current) return;
        matchedRef.current = true;
        try {
          if (mmTimerRef.current) {
            clearTimeout(mmTimerRef.current);
            mmTimerRef.current = null;
          }

          // Initialize fresh state BEFORE joining to avoid overwriting backend state
          setState({
            board: ["", "", "", "", "", "", "", "", ""],
            next: null,
            winner: null,
            players: {},
            playersInfo: {},
            mode: gameMode,
            turnDeadline: null,
            started: false,
          });

          const m = await sock.joinMatch(undefined, matched.token);
          setTicket(null);
          setMatchId(m.match_id);

          // Don't set view to "playing" yet - wait for backend to broadcast initial state
        } catch (err) {
          try {
            // Initialize fresh state BEFORE joining
            setState({
              board: ["", "", "", "", "", "", "", "", ""],
              next: null,
              winner: null,
              players: {},
              playersInfo: {},
              mode: gameMode,
              turnDeadline: null,
              started: false,
            });

            const m2 = await sock.joinMatch(matched.match_id);
            setTicket(null);
            setMatchId(m2.match_id);

            // Wait for backend state broadcast
          } catch (err2) {
            matchedRef.current = false;
            matchingRef.current = false;
            await queueMatchmaking(sock, sess);
            return;
          }
        } finally {
          matchingRef.current = false;
        }
      };

      // Fallback timer
      mmTimerRef.current = window.setTimeout(async () => {
        if (matchedRef.current) return;
        try {
          if (!sock || !sess) return;
          await removeFromMatchmaker(sock, mm.ticket);
          setTicket(null);

          // Fallback to RPC create/join with retry logic (with jitter)
          const jitter = 200 + Math.floor(Math.random() * 800);
          await new Promise(r => setTimeout(r, jitter));

          // Initialize fresh state BEFORE joining
          setState({
            board: ["", "", "", "", "", "", "", "", ""],
            next: null,
            winner: null,
            players: {},
            playersInfo: {},
            mode: gameMode,
            turnDeadline: null,
            started: false,
          });

          const m = await joinMatchWithRetry(sock, sess, gameMode);
          setMatchId(m.match_id);

          // Wait for backend state broadcast to switch view

        } catch (e) {
          setLastError(e instanceof Error ? e.message : JSON.stringify(e));
          setView("entry");
        } finally {
          if (mmTimerRef.current) {
            clearTimeout(mmTimerRef.current);
            mmTimerRef.current = null;
          }
          matchingRef.current = false;
        }
      }, 5000);
    } catch (e) {
      matchingRef.current = false;
      setLastError(e instanceof Error ? e.message : JSON.stringify(e));
      setView("entry");
    }
  }, [client, state, gameMode]); // state dependency might be tricky here, but it's only used for check `!state`

  const connectAndMatch = useCallback(async () => {
    if (!username.trim()) {
      setLastError("Please enter a nickname");
      return;
    }
    try {
      setLastError(null);

      // Always use a random device ID to ensure unique player identity per session/tab
      // This allows testing in two tabs with the same username and ensures the Matchmaker treats them as distinct players.
      const deviceId = `device_${crypto.randomUUID()}`;

      // Authenticate without username to let Nakama assign a unique one
      // Then update the display name to what the user entered
      const s = await authenticateDevice(client, deviceId);
      setSession(s);

      // Update display name
      try {
        await client.updateAccount(s, { display_name: username });
      } catch (e) { }

      const sock = await connectSocket(client, s);
      socketRef.current = sock;
      attachSocketHandlers(sock);

      // Set view to matching before starting matchmaking
      setView("matching");

      // Start matchmaking immediately
      await queueMatchmaking(sock, s);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to connect";
      setLastError(msg);
    }
  }, [client, username, attachSocketHandlers, queueMatchmaking]);

  const cancelMatchmaking = useCallback(async () => {
    if (mmTimerRef.current) {
      clearTimeout(mmTimerRef.current);
      mmTimerRef.current = null;
    }
    if (socketRef.current && ticket) {
      try {
        await removeFromMatchmaker(socketRef.current, ticket);
      } catch { }
    }
    setTicket(null);
    setView("entry");
    matchingRef.current = false;
    matchedRef.current = false;
  }, [ticket]);

  const leaveMatch = useCallback(async () => {
    if (socketRef.current && matchId) {
      try {
        await socketRef.current.leaveMatch(matchId);
      } catch { }
    }
    setMatchId(null);
    setState(null);
    setView("entry");
  }, [matchId]);

  const sendMove = useCallback(async (cell: number) => {
    if (!socketRef.current || !matchId) return;
    const bytes = new TextEncoder().encode(JSON.stringify({ cell }));
    await socketRef.current.sendMatchState(matchId, OpCode.Move, bytes);
  }, [matchId]);

  const playAgain = useCallback(async () => {
    if (!session || !socketRef.current) return;
    try {
      if (matchId) {
        try {
          await socketRef.current.leaveMatch(matchId);
        } catch { }
      }
      setMatchId(null);
      setState(null);
      setLeaderboard([]); // clear leaderboard

      // Clear any existing timer
      if (mmTimerRef.current) {
        clearTimeout(mmTimerRef.current);
        mmTimerRef.current = null;
      }

      setView("matching");
      matchingRef.current = true;
      matchedRef.current = false;

      // Use robust joinMatchWithRetry directly
      try {
        // Initialize fresh state BEFORE joining
        setState({
          board: ["", "", "", "", "", "", "", "", ""],
          next: null,
          winner: null,
          players: {},
          playersInfo: {},
          mode: gameMode,
          turnDeadline: null,
          started: false,
        });

        // Pass matchId to exclude it from being rejoined
        const m = await joinMatchWithRetry(socketRef.current, session, gameMode, matchId || undefined);
        setMatchId(m.match_id);

        // Wait for backend state broadcast to switch view
      } catch (err) {
        setLastError(String(err));
        setView("entry");
      }
    } catch (e) {
      setLastError(String(e));
      setView("entry");
    }
  }, [session, matchId, gameMode]);

  const getNames = useCallback(() => {
    if (!state || !session || !session.user_id)
      return { myName: "You", oppName: "Opponent", mySymbol: undefined, oppSymbol: undefined };
    const myId = session.user_id;
    const mySymbol = state.players[myId];
    const oppId = Object.keys(state.players).find((id) => id !== myId);
    const oppSymbol = oppId ? state.players[oppId] : undefined;

    const myName = (state.playersInfo && state.playersInfo[myId]?.name) || "You";
    const oppName = (oppId && state.playersInfo?.[oppId]?.name) || "Opponent";

    return { myName, oppName, mySymbol, oppSymbol };
  }, [state, session]);

  return {
    username,
    setUsername,
    gameMode,
    setGameMode,
    view,
    state,
    lastError,
    leaderboard,
    connectAndMatch,
    cancelMatchmaking,
    leaveMatch,
    sendMove,
    playAgain,
    getNames,
  };
};
