import React from "react";
import API from "../api";

const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID;

const PaymentButton = ({ applicationId, amount }) => {
  const handlePayment = async () => {
    if (!RAZORPAY_KEY_ID) {
      alert("Payment configuration is unavailable. Please contact support.");
      return;
    }

    try {
      const { data: order } = await API.post("/payments/order", {
        applicationId,
      });

      const options = {
        key: RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: "INR",
        name: "Mirai Assurance",
        description: "Premium Payment",
        order_id: order.id,
        handler: async (response) => {
          try {
            await API.post("/payments/verify", {
              applicationId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });
            alert("Payment Successful! Your policy is now active.");
            window.location.reload(); 
          } catch (err) {
            alert("Payment verification failed.");
          }
        },
        theme: { color: "#1d4ed8" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err);
      alert("Could not initiate payment. Check console.");
    }
  };

  return (
    <button
      onClick={handlePayment}
      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition"
    >
      Pay Premium (₹{amount})
    </button>
  );
};

export default PaymentButton;
