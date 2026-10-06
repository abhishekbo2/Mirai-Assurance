import assert from "node:assert/strict";
import test from "node:test";
import { getRenewalAction } from "./renewalUi.js";

test("shows normal renewal payment during an allowed window", () => {
  assert.equal(getRenewalAction({ normalRenewalPaymentAllowed: true }, null), "PAY_RENEWAL");
});

test("shows late approval action only when the backend allows it", () => {
  assert.equal(getRenewalAction({ lateRenewalRequestAllowed: true }, null), "REQUEST_LATE_APPROVAL");
});

test("shows pending and approved decisions instead of payment actions", () => {
  assert.equal(getRenewalAction({}, { status: "PENDING" }), "APPROVAL_PENDING");
  assert.equal(getRenewalAction({}, { status: "APPROVED", paymentDeadline: new Date(Date.now() + 1000) }), "PAY_RENEWAL");
  assert.equal(getRenewalAction({}, { status: "APPROVED", paymentDeadline: new Date(Date.now() - 1000) }), "EXPIRED");
});

test("shows no action for an expired renewal", () => {
  assert.equal(getRenewalAction({ finallyExpired: true }, null), "EXPIRED");
});
