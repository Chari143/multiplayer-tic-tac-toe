/**
 * Nakama Runtime Type Definitions
 * Auto-generated from Nakama server runtime API
 */

declare namespace nkruntime {
    interface Context {
        env: { [key: string]: string };
        executionMode: string;
        headers: { [key: string]: string };
        queryParams: { [key: string]: string };
        userId: string;
        username: string;
        vars: { [key: string]: string };
        userSessionExp: number;
        sessionId: string;
        lang: string;
    }

    interface Logger {
        debug(format: string, ...args: any[]): void;
        info(format: string, ...args: any[]): void;
        warn(format: string, ...args: any[]): void;
        error(format: string, ...args: any[]): void;
    }

    interface Presence {
        userId: string;
        sessionId: string;
        username: string;
        node: string;
    }

    interface MatchMessage {
        sender: Presence;
        opCode: number;
        data: Uint8Array;
        reliable: boolean;
        receiveTimeMs: number;
    }

    interface MatchDispatcher {
        broadcastMessage(
            opCode: number,
            data: string | Uint8Array,
            presences?: Presence[] | null,
            sender?: Presence | null,
            reliable?: boolean
        ): void;
        matchKick(presences: Presence[]): void;
        matchLabelUpdate(label: string): void;
        matchTerminate(graceSeconds: number): void;
    }

    interface Match {
        matchId: string;
        authoritative: boolean;
        label: string;
        size: number;
    }

    interface LeaderboardRecord {
        leaderboardId: string;
        ownerId: string;
        username: string;
        score: number;
        subscore: number;
        numScore: number;
        metadata: any;
        createTime: number;
        updateTime: number;
        expiryTime: number;
        rank: number;
        maxNumScore: number;
    }

    interface LeaderboardRecordList {
        records: LeaderboardRecord[];
        ownerRecords: LeaderboardRecord[];
        nextCursor: string;
        prevCursor: string;
    }

    interface Nakama {
        binaryToString(data: Uint8Array): string;
        stringToBinary(str: string): Uint8Array;

        matchCreate(module: string, params?: any): string;
        matchGet(matchId: string): Match | null;
        matchList(
            limit: number,
            authoritative: boolean,
            label?: string | null,
            minSize?: number | null,
            maxSize?: number | null,
            query?: string | null
        ): Match[];

        accountGetId(userId: string): nkruntime.Account;
        authenticateDevice(id: string, username?: string, create?: boolean): {
            userId: string;
            username: string;
            create: boolean;
        };

        leaderboardCreate(
            id: string,
            authoritative: boolean,
            sortOrder?: string,
            operator?: string,
            resetSchedule?: string,
            metadata?: any
        ): void;
        
        // Overload for the call in code: nk.leaderboardCreate("global_wins", "desc", "best", "0 0 * * *", {}, false);
        // Signature: (id: string, sort: string, operator: string, reset: string, metadata: any, authoritative: boolean)
        leaderboardCreate(
            id: string,
            sort: string,
            operator: string,
            reset: string,
            metadata: any,
            authoritative: boolean
        ): void;

        leaderboardRecordsList(
            leaderboardId: string,
            ownerIds?: string[],
            limit?: number,
            cursor?: string,
            expiry?: number
        ): LeaderboardRecordList;

        leaderboardRecordWrite(
            leaderboardId: string,
            ownerId: string,
            username?: string,
            score?: number,
            subscore?: number,
            metadata?: any,
            overrideOperator?: string
        ): LeaderboardRecord;
    }

    interface Account {
        user: User;
        wallet: string;
        email: string;
        devices: { [key: string]: string }[];
    }

    interface User {
        userId: string;
        username: string;
        displayName: string;
        avatarUrl: string;
        langTag: string;
        location: string;
        timezone: string;
        metadata: { [key: string]: any };
        createTime: number;
        updateTime: number;
        expiryTime: number;
    }

    interface Initializer {
        registerMatch(
            name: string,
            handlers: {
                matchInit: MatchInitFunction;
                matchJoinAttempt?: MatchJoinAttemptFunction;
                matchJoin?: MatchJoinFunction;
                matchLeave?: MatchLeaveFunction;
                matchLoop?: MatchLoopFunction;
                matchTerminate?: MatchTerminateFunction;
                matchSignal?: MatchSignalFunction;
            }
        ): void;

        registerRpc(name: string, fn: RpcFunction): void;
        registerRtBefore(name: string, fn: Function): void;
        registerRtAfter(name: string, fn: Function): void;
    }

    type MatchInitFunction<T = any> = (
        ctx: Context,
        logger: Logger,
        nk: Nakama,
        params: { [key: string]: string }
    ) => {
        state: T;
        tickRate: number;
        label: string;
    };

    type MatchJoinAttemptFunction<T = any> = (
        ctx: Context,
        logger: Logger,
        nk: Nakama,
        dispatcher: MatchDispatcher,
        tick: number,
        state: T,
        presence: Presence,
        metadata: { [key: string]: any }
    ) => { state: T; accept: boolean; rejectMessage?: string } | null;

    type MatchJoinFunction<T = any> = (
        ctx: Context,
        logger: Logger,
        nk: Nakama,
        dispatcher: MatchDispatcher,
        tick: number,
        state: T,
        presences: Presence[]
    ) => { state: T } | null;

    type MatchLeaveFunction<T = any> = (
        ctx: Context,
        logger: Logger,
        nk: Nakama,
        dispatcher: MatchDispatcher,
        tick: number,
        state: T,
        presences: Presence[]
    ) => { state: T } | null;

    type MatchLoopFunction<T = any> = (
        ctx: Context,
        logger: Logger,
        nk: Nakama,
        dispatcher: MatchDispatcher,
        tick: number,
        state: T,
        messages: MatchMessage[]
    ) => { state: T } | null;

    type MatchTerminateFunction<T = any> = (
        ctx: Context,
        logger: Logger,
        nk: Nakama,
        dispatcher: MatchDispatcher,
        tick: number,
        state: T,
        graceSeconds: number
    ) => { state: T } | null;

    type MatchSignalFunction<T = any> = (
        ctx: Context,
        logger: Logger,
        nk: Nakama,
        dispatcher: MatchDispatcher,
        tick: number,
        state: T,
        data: string
    ) => { state: T; data?: string; result?: string } | null;

    type RpcFunction = (
        ctx: Context,
        logger: Logger,
        nk: Nakama,
        payload: string
    ) => string;

    type InitModule = (
        ctx: Context,
        logger: Logger,
        nk: Nakama,
        initializer: Initializer
    ) => void;
}
