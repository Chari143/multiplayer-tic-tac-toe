import { Client, Session, Socket } from "@heroiclabs/nakama-js";

const host = process.env.NEXT_PUBLIC_NAKAMA_HOST || "127.0.0.1";
const port = String(process.env.NEXT_PUBLIC_NAKAMA_PORT || 7350);
const useSSL = (process.env.NEXT_PUBLIC_NAKAMA_SSL || "false").toLowerCase() === "true";

export function createClient() {
  return new Client("defaultkey", host, port, useSSL);
}

export async function authenticateDevice(client: Client, deviceId: string, username?: string): Promise<Session> {
  const create = true;
  return client.authenticateDevice(deviceId, create, username);
}

export async function connectSocket(client: Client, session: Session): Promise<Socket> {
  const socket = client.createSocket(useSSL);
  await socket.connect(session, true);
  return socket;
}

export async function addToMatchmaker(
  socket: Socket,
  query: string = "*",
  min: number = 2,
  max: number = 2,
  stringProps?: Record<string, string>,
  numericProps?: Record<string, number>
) {
  return socket.addMatchmaker(query, min, max, stringProps, numericProps);
}

export async function removeFromMatchmaker(socket: Socket, ticket: string) {
  await socket.removeMatchmaker(ticket);
}

export async function createOrJoinTttMatch(client: Client, session: Session, mode: "classic" | "timed" = "classic") {
  const res = await client.rpc(
    session,
    "create_or_join_ttt",
    (JSON.stringify({ mode }) as unknown) as object
  );
  const payloadStr = typeof res.payload === "string" ? res.payload : JSON.stringify(res.payload || {});
  const payload = JSON.parse(payloadStr);
  return payload.matchId as string;
}

export const OpCode = {
  Move: 1,
  State: 2,
  Error: 3,
  Event: 4,
} as const;

export type TttState = {
  board: ("" | "X" | "O")[];
  next: "X" | "O" | null;
  winner: "X" | "O" | "draw" | null;
  players: Record<string, "X" | "O">;
  playersInfo?: Record<string, { name: string }>;
  mode: "classic" | "timed";
  turnDeadline: number | null;
  started: boolean;
};