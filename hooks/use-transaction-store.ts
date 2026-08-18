"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { chatRepository } from "../repositories/chat-repository";
import { demoChatRepository } from "../repositories/demo-chat-repository";
import { transactionRepository } from "../repositories/transaction-repository";
import { demoTransactionRepository } from "../repositories/demo-transaction-repository";
import { supabaseChatRepository } from "../repositories/supabase-chat-repository";
import { supabaseTransactionRepository } from "../repositories/supabase-transaction-repository";
import type { ChatRoom, Transaction } from "../types/transactions";

// Demo mode merges two sources for both transactions and their rooms: this
// browser's own localStorage copies, and the shared, anon-open demo_* backend
// (see repositories/demo-transaction-repository.ts / demo-chat-repository.ts).
// Which room/transaction ids are "shared" is discovered at read time from
// whatever demo_chat_rooms / demo_transactions actually return — not a fixed
// compile-time list — so newly-created demo transactions (v0.3.12+) are
// automatically shared without any code change. Local ids that also appear
// in the shared set are dropped from the local half of the merge so nothing
// is shown twice; this only matters for transactions/rooms created before
// v0.3.12 shipped (or before the migration below was applied) that a browser
// still has sitting in its own localStorage.
async function loadDemoRooms(demoActorId: string): Promise<{ rooms: ChatRoom[]; sharedRoomIds: Set<string> }> {
  const [localRooms, sharedRooms] = await Promise.all([
    Promise.resolve(chatRepository.getAll()),
    demoChatRepository.getAll(demoActorId),
  ]);
  const sharedRoomIds = new Set(sharedRooms.map((room) => room.id));
  return { rooms: [...localRooms.filter((room) => !sharedRoomIds.has(room.id)), ...sharedRooms], sharedRoomIds };
}

async function loadDemoTransactions(schemaReady: boolean): Promise<Transaction[]> {
  const local = transactionRepository.getAll();
  if (!schemaReady) return local;
  const shared = await demoTransactionRepository.getAll();
  const sharedIds = new Set(shared.map((item) => item.id));
  return [...local.filter((item) => !sharedIds.has(item.id)), ...shared];
}

export function useTransactionStore(useSupabase = false, demoActorId = "") {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  // null while the one-time capability probe (does demo_transactions exist
  // yet?) is in flight; true/false once known. Only meaningful in Demo mode.
  const [demoSchemaReady, setDemoSchemaReady] = useState<boolean | null>(null);
  const [sharedRoomIds, setSharedRoomIds] = useState<Set<string>>(new Set());
  // The subscription is set up once per useSupabase/demoActorId change; routing
  // through a ref keeps it pointed at the current refreshRoom without making
  // the effect depend on (and so re-subscribe for) every render.
  const refreshRoomRef = useRef<(roomId: string) => Promise<boolean>>(async () => false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const schemaReady = useSupabase ? true : await demoTransactionRepository.isSchemaReady();
        if (!active) return;
        if (!useSupabase) setDemoSchemaReady(schemaReady);
        const [nextTransactions, roomResult] = await Promise.all([
          useSupabase ? supabaseTransactionRepository.getAll() : loadDemoTransactions(schemaReady),
          useSupabase
            ? supabaseChatRepository.getAll().then((value) => ({ rooms: value, sharedRoomIds: new Set<string>() }))
            : loadDemoRooms(demoActorId),
        ]);
        if (!active) return;
        setTransactions(nextTransactions);
        setRooms(roomResult.rooms);
        setSharedRoomIds(roomResult.sharedRoomIds);
        setError("");
      } catch {
        if (active) setError("거래 정보를 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    const frame = requestAnimationFrame(() => {
      setIsLoading(true);
      void load();
    });
    const unsubscribeTransactions = useSupabase
      ? supabaseTransactionRepository.subscribe(() => void load())
      : transactionRepository.subscribe(() => void load());
    const unsubscribeDemoTransactions = useSupabase ? () => {} : demoTransactionRepository.subscribe(() => void load());
    const unsubscribeLocalRooms = useSupabase ? () => {} : chatRepository.subscribe(() => void load());
    // A chat event refreshes only the room it happened in. Without a room id
    // (or if that room isn't in this client's list yet, e.g. a brand-new room)
    // it falls back to the full load so nothing is ever missed.
    const onChatChange = (roomId?: string) => {
      if (!roomId) return void load();
      void refreshRoomRef.current(roomId).then((handled) => {
        if (!handled) void load();
      });
    };
    const unsubscribeSharedRooms = useSupabase
      ? supabaseChatRepository.subscribe(onChatChange)
      : demoChatRepository.subscribe(onChatChange);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      unsubscribeTransactions();
      unsubscribeDemoTransactions();
      unsubscribeLocalRooms();
      unsubscribeSharedRooms();
    };
  }, [useSupabase, demoActorId]);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const schemaReady = useSupabase ? true : await demoTransactionRepository.isSchemaReady();
      const [nextTransactions, roomResult] = await Promise.all([
        useSupabase ? supabaseTransactionRepository.getAll() : loadDemoTransactions(schemaReady),
        useSupabase
          ? supabaseChatRepository.getAll().then((value) => ({ rooms: value, sharedRoomIds: new Set<string>() }))
          : loadDemoRooms(demoActorId),
      ]);
      setTransactions(nextTransactions);
      setRooms(roomResult.rooms);
      setSharedRoomIds(roomResult.sharedRoomIds);
      setError("");
    } catch {
      setError("거래 정보를 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
      throw new Error("거래 정보를 새로고침하지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  };
  /**
   * Refreshes ONE room after a realtime event, instead of rebuilding every
   * room. Merges rather than replaces, for two reasons: history the reader
   * pulled in with "이전 메시지 보기" is not in the newest page and would
   * otherwise vanish under them, and hasMoreMessages must stay true once
   * older pages are in memory.
   *
   * Falls back to a full load() when the event carries no room id, or when the
   * room is local-only (localStorage demo rooms have no remote counterpart).
   */
  const refreshRoom = useCallback(
    async (roomId: string) => {
      const room = useSupabase
        ? await supabaseChatRepository.getRoom(roomId)
        : await demoChatRepository.getRoom(roomId, demoActorId);
      if (!room) return false;
      setRooms((current) => {
        if (!current.some((item) => item.id === roomId)) return current;
        return current.map((item) => {
          if (item.id !== roomId) return item;
          const incoming = new Set(room.messages.map((message) => message.id));
          const kept = item.messages.filter((message) => !incoming.has(message.id));
          const merged = [...kept, ...room.messages].sort(
            (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
          );
          return {
            ...room,
            messages: merged,
            // Older pages already in memory mean there is still history above,
            // regardless of what the newest-page probe reported.
            hasMoreMessages: room.hasMoreMessages || merged.length > room.messages.length,
          };
        });
      });
      return true;
    },
    [useSupabase, demoActorId],
  );

  useEffect(() => {
    refreshRoomRef.current = refreshRoom;
  }, [refreshRoom]);

  /**
   * Prepends one page of history to a single room, in place. Deliberately does
   * NOT go through refresh(): a full reload would rebuild every room from its
   * newest page and silently discard the history the reader just pulled in.
   * Returns false when the room has nothing older left.
   *
   * Only shared/remote rooms paginate. A local (localStorage) demo room holds
   * its whole history in memory already, so hasMoreMessages is never set on it
   * and this is never reached for one.
   */
  const loadOlderMessages = async (roomId: string): Promise<boolean> => {
    const room = rooms.find((item) => item.id === roomId);
    const oldest = room?.messages[0]?.createdAt;
    if (!room || !oldest) return false;
    const page = useSupabase
      ? await supabaseChatRepository.loadOlder(roomId, oldest)
      : await demoChatRepository.loadOlder(roomId, oldest);
    setRooms((current) =>
      current.map((item) => {
        if (item.id !== roomId) return item;
        // Re-dedupe on merge: a realtime refresh landing mid-load could have
        // already inserted some of these ids.
        const seen = new Set(item.messages.map((message) => message.id));
        const older = page.messages.filter((message) => !seen.has(message.id));
        return { ...item, messages: [...older, ...item.messages], hasMoreMessages: page.hasMore };
      }),
    );
    return page.hasMore;
  };

  return { transactions, rooms, isLoading, error, refresh, loadOlderMessages, demoSchemaReady, sharedRoomIds };
}
