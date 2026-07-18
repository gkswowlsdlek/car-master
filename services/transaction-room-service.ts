import type { ChatRepository } from "../repositories/chat-repository";
import type { TransactionRepository } from "../repositories/transaction-repository";
import type { ChatRoom, Transaction } from "../types/transactions";

export type TransactionRoom = { transaction: Transaction; chatRoom: ChatRoom | null };

/** Read-only aggregate boundary for a future transaction-room API. */
export class TransactionRoomService {
  private readonly transactions: TransactionRepository;
  private readonly chats: ChatRepository;

  constructor(transactions: TransactionRepository, chats: ChatRepository) {
    this.transactions = transactions;
    this.chats = chats;
  }

  getByTransactionId(transactionId: string): TransactionRoom | null {
    const transaction = this.transactions.getById(transactionId);
    if (!transaction) return null;
    const chatRoom = this.chats.getByTransactionId(transactionId);
    return { transaction, chatRoom: chatRoom?.id === transaction.chatRoomId ? chatRoom : null };
  }
}
