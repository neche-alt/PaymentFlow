import {
  PAYMENT_STATUS,
  BLOCKCHAIN_STATUS_META,
  getBlockchainStatusMeta,
} from "../../utils/paymentStatus";

describe("BLOCKCHAIN_STATUS_META — issue #110", () => {
  it("is a frozen object", () => {
    expect(Object.isFrozen(BLOCKCHAIN_STATUS_META)).toBe(true);
  });

  it("covers every PAYMENT_STATUS constant", () => {
    for (const status of Object.values(PAYMENT_STATUS)) {
      expect(BLOCKCHAIN_STATUS_META).toHaveProperty(status);
    }
  });

  it("marks SUCCESS, FAILED, REFUNDED, INVALID as isFinal=true", () => {
    const finalStatuses = [
      PAYMENT_STATUS.SUCCESS,
      PAYMENT_STATUS.FAILED,
      PAYMENT_STATUS.REFUNDED,
      PAYMENT_STATUS.INVALID,
    ];
    for (const status of finalStatuses) {
      expect(BLOCKCHAIN_STATUS_META[status].isFinal).toBe(true);
    }
  });

  it("marks PENDING, SUBMITTED, DISPUTED as isFinal=false", () => {
    const nonFinal = [
      PAYMENT_STATUS.PENDING,
      PAYMENT_STATUS.SUBMITTED,
      PAYMENT_STATUS.DISPUTED,
    ];
    for (const status of nonFinal) {
      expect(BLOCKCHAIN_STATUS_META[status].isFinal).toBe(false);
    }
  });

  it("marks SUBMITTED, SUCCESS, FAILED as isOnChain=true", () => {
    const onChain = [
      PAYMENT_STATUS.SUBMITTED,
      PAYMENT_STATUS.SUCCESS,
      PAYMENT_STATUS.FAILED,
    ];
    for (const status of onChain) {
      expect(BLOCKCHAIN_STATUS_META[status].isOnChain).toBe(true);
    }
  });

  it("marks PENDING, DISPUTED, REFUNDED, INVALID as isOnChain=false", () => {
    const notOnChain = [
      PAYMENT_STATUS.PENDING,
      PAYMENT_STATUS.DISPUTED,
      PAYMENT_STATUS.REFUNDED,
      PAYMENT_STATUS.INVALID,
    ];
    for (const status of notOnChain) {
      expect(BLOCKCHAIN_STATUS_META[status].isOnChain).toBe(false);
    }
  });

  it("every entry has a colorClass string", () => {
    for (const [status, meta] of Object.entries(BLOCKCHAIN_STATUS_META)) {
      expect(typeof meta.colorClass).toBe("string");
      expect(meta.colorClass.length).toBeGreaterThan(0);
      // status used in message only
      void status;
    }
  });

  it("every entry has a description string", () => {
    for (const [status, meta] of Object.entries(BLOCKCHAIN_STATUS_META)) {
      expect(typeof meta.description).toBe("string");
      expect(meta.description.length).toBeGreaterThan(0);
      void status;
    }
  });
});

describe("getBlockchainStatusMeta — issue #110", () => {
  it("returns the correct meta for SUCCESS", () => {
    const meta = getBlockchainStatusMeta(PAYMENT_STATUS.SUCCESS);
    expect(meta.isFinal).toBe(true);
    expect(meta.isOnChain).toBe(true);
    expect(meta.colorClass).toBe("success");
  });

  it("returns the correct meta for SUBMITTED", () => {
    const meta = getBlockchainStatusMeta(PAYMENT_STATUS.SUBMITTED);
    expect(meta.isFinal).toBe(false);
    expect(meta.isOnChain).toBe(true);
  });

  it("returns the correct meta for PENDING", () => {
    const meta = getBlockchainStatusMeta(PAYMENT_STATUS.PENDING);
    expect(meta.isFinal).toBe(false);
    expect(meta.isOnChain).toBe(false);
  });

  it("returns the correct meta for FAILED", () => {
    const meta = getBlockchainStatusMeta(PAYMENT_STATUS.FAILED);
    expect(meta.isFinal).toBe(true);
    expect(meta.isOnChain).toBe(true);
    expect(meta.colorClass).toBe("danger");
  });

  it("returns the correct meta for REFUNDED", () => {
    const meta = getBlockchainStatusMeta(PAYMENT_STATUS.REFUNDED);
    expect(meta.isFinal).toBe(true);
    expect(meta.isOnChain).toBe(false);
  });

  it("returns the correct meta for INVALID", () => {
    const meta = getBlockchainStatusMeta(PAYMENT_STATUS.INVALID);
    expect(meta.isFinal).toBe(true);
    expect(meta.isOnChain).toBe(false);
  });

  it("returns the correct meta for DISPUTED", () => {
    const meta = getBlockchainStatusMeta(PAYMENT_STATUS.DISPUTED);
    expect(meta.isFinal).toBe(false);
    expect(meta.isOnChain).toBe(false);
  });

  it("handles unknown status gracefully — returns a safe default", () => {
    const meta = getBlockchainStatusMeta("SOME_UNKNOWN_STATE");
    expect(meta).toBeDefined();
    expect(typeof meta.isFinal).toBe("boolean");
    expect(typeof meta.isOnChain).toBe("boolean");
    expect(typeof meta.colorClass).toBe("string");
    expect(meta.isFinal).toBe(false);
    expect(meta.isOnChain).toBe(false);
  });

  it("handles null and undefined gracefully — returns a safe default", () => {
    for (const bad of [null, undefined, "", 0]) {
      const meta = getBlockchainStatusMeta(bad);
      expect(meta).toBeDefined();
      expect(typeof meta.isFinal).toBe("boolean");
      expect(typeof meta.isOnChain).toBe("boolean");
    }
  });
});
