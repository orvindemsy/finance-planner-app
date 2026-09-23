import { describe, it, expect } from "vitest";
import { getMonthlyExpense, setMonthlyExpense, getWithdrawalRate, setWithdrawalRate } from "../src/lib/settings-query";

describe("getMonthlyExpense / setMonthlyExpense", () => {
  it("returns 0 when no monthly expense has been set yet", async () => {
    expect(await getMonthlyExpense()).toBe(0);
  });

  it("stores and retrieves the monthly expense, converting yen to cents internally", async () => {
    await setMonthlyExpense(300000);
    expect(await getMonthlyExpense()).toBe(300000);
  });

  it("overwrites the previous value on repeated calls instead of duplicating rows", async () => {
    await setMonthlyExpense(250000);
    await setMonthlyExpense(320000);
    expect(await getMonthlyExpense()).toBe(320000);
  });
});

describe("getWithdrawalRate / setWithdrawalRate", () => {
  it("defaults to 4% when no rate has been set yet", async () => {
    expect(await getWithdrawalRate()).toBe(4);
  });

  it("stores and retrieves a custom withdrawal rate", async () => {
    await setWithdrawalRate(3.5);
    expect(await getWithdrawalRate()).toBe(3.5);
  });

  it("overwrites the previous rate on repeated calls instead of duplicating rows", async () => {
    await setWithdrawalRate(5);
    await setWithdrawalRate(4.5);
    expect(await getWithdrawalRate()).toBe(4.5);
  });
});
