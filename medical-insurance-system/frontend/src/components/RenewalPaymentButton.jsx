import React, { useState } from "react";
import API from "../api";

const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID;

const RenewalPaymentButton = ({ renewalId, premium, onComplete }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handlePayment = async () => {
    if (!RAZORPAY_KEY_ID) {
      setError("Payment configuration is unavailable. Please contact support.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const { data: order } = await API.post("/payments/renewal/order", { renewalId });
      const options = {
        key: RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency || "INR",
        name: "Mirai Assurance",
        description: "Policy renewal premium",
        order_id: order.id,
        handler: async (response) => {
          try {
            await API.post("/payments/renewal/verify", {
              renewalId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });
            onComplete?.();
          } catch {
            setError("Payment verification failed. Please check your policy status.");
          } finally {
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
        theme: { color: "#1d4ed8" },
      };

      if (!window.Razorpay) throw new Error("Razorpay checkout is unavailable.");
      new window.Razorpay(options).open();
    } catch (paymentError) {
      setBusy(false);
      setError(paymentError.response?.data?.msg || "Could not initiate renewal payment.");
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handlePayment}
        disabled={busy}
        className="rounded-lg bg-green-600 px-4 py-2 font-bold text-white transition hover:bg-green-700 disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? "Opening checkout..." : `Pay Renewal (₹${Number(premium || 0).toLocaleString("en-IN")})`}
      </button>
      {error && <p className="max-w-xs text-xs font-bold text-red-600">{error}</p>}
    </div>
  );
};

export default RenewalPaymentButton;
