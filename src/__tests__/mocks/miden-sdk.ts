const knownAccountIds = new Map<string, string>();

class MockFelt {
  constructor(private readonly value: bigint) {}

  asInt() {
    return this.value;
  }
}

class MockWord {
  private readonly values: bigint[];

  constructor(values: bigint[] | BigUint64Array) {
    this.values = Array.from(values, (value) => BigInt(value));
  }

  static newFromFelts(felts: MockFelt[]) {
    return new MockWord(felts.map((felt) => felt.asInt()));
  }

  static fromHex(hex: string) {
    const normalized = hex.replace(/^0x/, "").padStart(64, "0");
    const chunks = [0, 1, 2, 3].map((index) =>
      BigInt(`0x${normalized.slice(index * 16, (index + 1) * 16)}`),
    );
    return new MockWord(chunks);
  }

  toU64s() {
    return BigUint64Array.from(this.values);
  }

  toFelts() {
    return this.values.map((value) => new MockFelt(value));
  }
}

class MockAccountId {
  private readonly bech32: string;
  private readonly hex: string;
  private readonly prefixValue: bigint;
  private readonly suffixValue: bigint;

  private constructor(bech32: string, hex: string) {
    this.bech32 = bech32;
    this.hex = hex;
    this.prefixValue = BigInt(`0x${hex.slice(2, 18)}`);
    this.suffixValue = BigInt(`0x${hex.slice(18, 34)}`);
  }

  static fromBech32(bech32: string) {
    const encoded = Array.from(bech32)
      .map((char) => char.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("")
      .padEnd(32, "0")
      .slice(0, 32);
    const hex = `0x${encoded}`;
    knownAccountIds.set(hex, bech32);
    return new MockAccountId(bech32, hex);
  }

  static fromHex(hex: string) {
    const normalized = `0x${hex.replace(/^0x/, "").padStart(32, "0").slice(0, 32)}`;
    return new MockAccountId(
      knownAccountIds.get(normalized) ?? `mock-${normalized.slice(2)}`,
      normalized,
    );
  }

  prefix() {
    return new MockFelt(this.prefixValue);
  }

  suffix() {
    return new MockFelt(this.suffixValue);
  }

  toBech32() {
    return this.bech32;
  }

  toString() {
    return this.hex;
  }
}

class MockAddress {
  constructor(private readonly account: MockAccountId) {}

  static fromBech32(bech32: string) {
    const [accountPart] = bech32.split("_");
    return new MockAddress(MockAccountId.fromBech32(accountPart));
  }

  static fromAccountId(accountId: MockAccountId) {
    return new MockAddress(accountId);
  }

  accountId() {
    return this.account;
  }

  toBech32() {
    return `${this.account.toBech32()}_mock`;
  }
}

class MockNoteTag {
  constructor(private readonly value: number) {}

  asU32() {
    return this.value;
  }
}

class MockNetworkId {
  static testnet() {
    return new MockNetworkId();
  }
}

export const Felt = MockFelt;
export const Word = MockWord;
export const AccountId = MockAccountId;
export const Address = MockAddress;
export const NoteTag = MockNoteTag;
export const NetworkId = MockNetworkId;
export const AccountInterface = {
  BasicWallet: "BasicWallet",
};
