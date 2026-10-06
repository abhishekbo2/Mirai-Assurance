export const getRenewalAction = (renewalState, approvalRequest) => {
  if (renewalState?.finallyExpired || renewalState?.status === "EXPIRED") return "EXPIRED";
  if (approvalRequest?.status === "PENDING") return "APPROVAL_PENDING";
  if (approvalRequest?.status === "APPROVED") {
    const deadline = approvalRequest.paymentDeadline && new Date(approvalRequest.paymentDeadline);
    if (deadline && !Number.isNaN(deadline.getTime()) && new Date() <= deadline) return "PAY_RENEWAL";
    return "EXPIRED";
  }
  if (renewalState?.normalRenewalPaymentAllowed) return "PAY_RENEWAL";
  if (renewalState?.lateRenewalRequestAllowed) return "REQUEST_LATE_APPROVAL";
  return "NOT_OPEN";
};

export const formatDate = (value) => (
  value ? new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "Not available"
);
