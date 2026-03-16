import {
  AccountId,
  AccountInterface,
  Address,
  Felt,
  InputNoteRecord,
  NetworkId,
  NoteTag,
  Word,
} from "@miden-sdk/miden-sdk";
import {
  CONTACTS_STORAGE_KEY,
  MESSENGER_TAG,
  SENT_MESSAGES_STORAGE_KEY,
} from "@/config";

export type MessageKind = "root" | "reply";
export type MessageDirection = "sent" | "received";

export interface Contact {
  id: string;
  label: string;
  accountId: string;
  lastUsedAt?: number;
}

export interface DraftMessage {
  recipientAccountId: string;
  body: string;
  threadId?: string;
  parentMessageId?: string;
}

export interface MessageRecord {
  messageId: string;
  threadId: string;
  parentMessageId?: string;
  from: string;
  to: string;
  body: string;
  direction: MessageDirection;
  observedAt: number;
}

export interface SentMessageRecord extends MessageRecord {
  ownerAccountId: string;
}

export interface ConversationSummary {
  threadId: string;
  peerAccountId: string;
  peerLabel?: string;
  lastMessage: MessageRecord;
  lastObservedAt: number;
}

export interface ResolvedRecipient {
  accountId: AccountId;
  address: Address;
  canonicalAccountId: string;
  canonicalAddress: string;
}

const VERSION = 1n;
const KIND_ROOT = 0n;
const KIND_REPLY = 1n;
const WORD_SEPARATOR = ":";
const TESTNET = NetworkId.testnet();

export function buildMessagePayload(
  recipientAccountId: string | AccountId,
  body: string,
  threadId?: string,
  parentMessageId?: string,
): Felt[] {
  const recipient =
    typeof recipientAccountId === "string"
      ? parseAccountIdLike(recipientAccountId)
      : recipientAccountId;
  const payloadThreadId = threadId ? parseWordString(threadId) : randomWord();
  const parentWord = parentMessageId
    ? NoteIdLike.toWord(parentMessageId)
    : zeroWord();
  const bodyBytes = new TextEncoder().encode(body);

  return cloneFelts([
    new Felt(VERSION),
    new Felt(parentMessageId ? KIND_REPLY : KIND_ROOT),
    ...wordToFelts(payloadThreadId),
    ...wordToFelts(parentWord),
    recipient.suffix(),
    recipient.prefix(),
    new Felt(BigInt(bodyBytes.length)),
    ...Array.from(bodyBytes, (byte) => new Felt(BigInt(byte))),
  ]);
}

export function decodeMessageRecord(
  note: InputNoteRecord,
  ownedAccountIds: Set<string>,
): MessageRecord | null {
  try {
    const metadata = note.metadata();
    if (!metadata || metadata.tag().asU32() !== MESSENGER_TAG) {
      return null;
    }

    const values = note.details().recipient().inputs().values();
    if (values.length < 13 || values[0].asInt() !== VERSION) {
      return null;
    }

    const bodyLength = Number(values[12].asInt());
    if (values.length !== 13 + bodyLength) {
      return null;
    }

    const sender = accountIdToBech32(metadata.sender());
    if (ownedAccountIds.has(sender)) {
      return null;
    }

    const threadId = formatWord(wordFromValues(values.slice(2, 6)));
    const parentWord = wordFromValues(values.slice(6, 10));
    const parentMessageId = isZeroWord(parentWord)
      ? undefined
      : formatWord(parentWord);
    const body = new TextDecoder().decode(
      Uint8Array.from(values.slice(13), (value) => Number(value.asInt())),
    );

    return {
      messageId: note.id().toString(),
      threadId,
      parentMessageId,
      from: sender,
      to: "",
      body,
      direction: "received",
      observedAt: Date.now(),
    };
  } catch (error) {
    console.warn("Skipping undecodable messenger note", error);
    return null;
  }
}

export function messengerTag(): NoteTag {
  return new NoteTag(MESSENGER_TAG);
}

export function createConversationSummaries(
  messages: MessageRecord[],
  contacts: Contact[],
): ConversationSummary[] {
  const latestByThread = new Map<string, MessageRecord>();

  for (const message of messages) {
    const current = latestByThread.get(message.threadId);
    if (!current || message.observedAt > current.observedAt) {
      latestByThread.set(message.threadId, message);
    }
  }

  return Array.from(latestByThread.values())
    .map((message) => {
      const peerAccountId = tryNormalizeAccountIdLike(
        message.direction === "sent" ? message.to : message.from,
      ) ?? (message.direction === "sent" ? message.to : message.from);
      const contact = findContactByAccountId(contacts, peerAccountId);
      return {
        threadId: message.threadId,
        peerAccountId: contact?.accountId ?? peerAccountId,
        peerLabel: contact?.label,
        lastMessage: message,
        lastObservedAt: message.observedAt,
      };
    })
    .sort((left, right) => right.lastObservedAt - left.lastObservedAt);
}

export function messagesForThread(
  messages: MessageRecord[],
  threadId: string | null,
): MessageRecord[] {
  if (!threadId) {
    return [];
  }

  return messages
    .filter((message) => message.threadId === threadId)
    .sort((left, right) => left.observedAt - right.observedAt);
}

export function loadSentMessages(ownerAccountId: string | null | undefined): SentMessageRecord[] {
  if (typeof window === "undefined" || !ownerAccountId) {
    return [];
  }

  return readStoredSentMessages().filter((message) => message.ownerAccountId === ownerAccountId);
}

export function saveSentMessages(
  ownerAccountId: string | null | undefined,
  messages: SentMessageRecord[],
) {
  if (typeof window === "undefined" || !ownerAccountId) {
    return;
  }

  const preservedMessages = readStoredSentMessages().filter(
    (message) => message.ownerAccountId !== ownerAccountId,
  );

  window.localStorage.setItem(
    SENT_MESSAGES_STORAGE_KEY,
    JSON.stringify(
      [...preservedMessages, ...messages].sort(
        (left, right) => right.observedAt - left.observedAt,
      ),
    ),
  );
}

export function upsertSentMessage(
  messages: SentMessageRecord[],
  message: SentMessageRecord,
): SentMessageRecord[] {
  const filtered = messages.filter(
    (entry) =>
      !(entry.ownerAccountId === message.ownerAccountId && entry.messageId === message.messageId),
  );

  return [...filtered, message].sort((left, right) => right.observedAt - left.observedAt);
}

export function loadContacts(): Contact[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(CONTACTS_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Contact[];
    return Array.isArray(parsed)
      ? parsed.map((contact) => normalizeStoredContact(contact))
      : [];
  } catch {
    return [];
  }
}

export function saveContacts(contacts: Contact[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
}

export function upsertContact(
  contacts: Contact[],
  contact: Omit<Contact, "id"> & { id?: string },
): Contact[] {
  const accountId = tryNormalizeAccountIdLike(contact.accountId) ?? contact.accountId.trim();
  const next: Contact = {
    id: contact.id ?? slugifyContact(contact.label, accountId),
    label: contact.label.trim(),
    accountId,
    lastUsedAt: contact.lastUsedAt,
  };

  const withoutDuplicate = contacts.filter(
    (entry) => entry.id !== next.id && !identityEquals(entry.accountId, next.accountId),
  );
  return [...withoutDuplicate, next].sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

export function removeContact(contacts: Contact[], id: string): Contact[] {
  return contacts.filter((entry) => entry.id !== id);
}

export function touchContact(contacts: Contact[], accountId: string): Contact[] {
  return contacts.map((entry) =>
    identityEquals(entry.accountId, accountId)
      ? { ...entry, lastUsedAt: Date.now() }
      : entry,
  );
}

export function randomWord(): Word {
  return new Word(
    BigUint64Array.from(
      Array.from({ length: 4 }, () => BigInt(Math.floor(Math.random() * 2 ** 32))),
    ),
  );
}

export function createThreadId(): string {
  return formatWord(randomWord());
}

export function formatWord(word: Word): string {
  return word.toU64s().join(WORD_SEPARATOR);
}

export function accountIdToBech32(accountId: AccountId): string {
  try {
    return accountId.toBech32(TESTNET, AccountInterface.BasicWallet);
  } catch {
    return accountId.toString();
  }
}

export function addressToBech32(address: Address): string {
  try {
    return address.toBech32(TESTNET);
  } catch {
    return accountIdToBech32(address.accountId());
  }
}

export function addressToExplorerAccount(value: string): string {
  const trimmed = value.trim();

  try {
    return accountIdToBech32(Address.fromBech32(trimmed).accountId());
  } catch {
    return normalizeAccountIdLike(trimmed);
  }
}

export function normalizeRecipient(value: string): string {
  return resolveRecipient(value).canonicalAccountId;
}

export function normalizeAccountIdLike(value: string): string {
  return resolveRecipient(value).canonicalAccountId;
}

export function tryNormalizeAccountIdLike(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return normalizeAccountIdLike(value);
  } catch {
    return value;
  }
}

export function parseAccountIdLike(value: string): AccountId {
  return resolveRecipient(value).accountId;
}

export function parseAddressLike(value: string, accountId?: AccountId): Address {
  const trimmed = value.trim();

  if (trimmed.includes("_")) {
    return Address.fromBech32(trimmed);
  }

  return Address.fromAccountId(accountId ?? parseAccountIdLike(trimmed));
}

export function tryParseAccountIdLike(value: string | null | undefined): AccountId | null {
  if (!value) {
    return null;
  }

  try {
    return parseAccountIdLike(value);
  } catch {
    return null;
  }
}

export function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

export function shortAddress(accountId: string): string {
  if (accountId.length <= 18) {
    return accountId;
  }

  return `${accountId.slice(0, 10)}…${accountId.slice(-6)}`;
}

export function isCanonicalNoteId(value: string | null | undefined): value is string {
  return typeof value === "string" && /^0x[0-9a-f]{64}$/i.test(value.trim());
}

function wordToFelts(word: Word): Felt[] {
  return cloneFelts(word.toFelts());
}

function zeroWord(): Word {
  return new Word(BigUint64Array.from([0n, 0n, 0n, 0n]));
}

function isZeroWord(word: Word): boolean {
  return word.toU64s().every((value) => value === 0n);
}

function parseWordString(value: string): Word {
  const chunks = value.split(WORD_SEPARATOR);
  if (chunks.length !== 4) {
    throw new Error("Thread ID must contain four words");
  }

  return new Word(BigUint64Array.from(chunks.map((chunk) => BigInt(chunk))));
}

function wordFromValues(values: Felt[]): Word {
  return new Word(BigUint64Array.from(values.map((value) => value.asInt())));
}

function cloneFelts(values: Felt[]): Felt[] {
  return values.map((value) => new Felt(value.asInt()));
}

function readStoredSentMessages(): SentMessageRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(SENT_MESSAGES_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as SentMessageRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeStoredContact(contact: Contact): Contact {
  return {
    ...contact,
    accountId: tryNormalizeAccountIdLike(contact.accountId) ?? contact.accountId.trim(),
  };
}

function identityEquals(left: string, right: string): boolean {
  const normalizedLeft = stableIdentityKey(left) ?? left.trim();
  const normalizedRight = stableIdentityKey(right) ?? right.trim();
  return normalizedLeft === normalizedRight;
}

export function findContactByAccountId(
  contacts: Contact[],
  accountId: string,
): Contact | undefined {
  return contacts.find((entry) => identityEquals(entry.accountId, accountId));
}

export function resolveRecipient(value: string): ResolvedRecipient {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Recipient is required");
  }

  if (trimmed.startsWith("0x")) {
    const accountId = AccountId.fromHex(trimmed);
    const address = Address.fromAccountId(accountId);
    return {
      accountId,
      address,
      canonicalAccountId: accountIdToBech32(accountId),
      canonicalAddress: addressToBech32(address),
    };
  }

  if (trimmed.includes("_")) {
    const address = Address.fromBech32(trimmed);
    const accountId = address.accountId();
    return {
      accountId,
      address,
      canonicalAccountId: accountIdToBech32(accountId),
      canonicalAddress: addressToBech32(address),
    };
  }

  const accountId = AccountId.fromBech32(trimmed);
  const address = Address.fromAccountId(accountId);
  return {
    accountId,
    address,
    canonicalAccountId: accountIdToBech32(accountId),
    canonicalAddress: addressToBech32(address),
  };
}

function stableIdentityKey(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return resolveRecipient(value).accountId.toString();
  } catch {
    return value.trim();
  }
}

function slugifyContact(label: string, accountId: string): string {
  return `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${accountId.slice(-6)}`;
}

const NoteIdLike = {
  toWord(noteId: string): Word {
    const hex = noteId.replace(/^0x/, "");
    if (hex.length !== 64) {
      throw new Error("Note ID must be 32 bytes");
    }

    const parts = [0, 1, 2, 3].map((index) => {
      const start = index * 16;
      return BigInt(`0x${hex.slice(start, start + 16)}`);
    });

    return new Word(BigUint64Array.from(parts));
  },
};
