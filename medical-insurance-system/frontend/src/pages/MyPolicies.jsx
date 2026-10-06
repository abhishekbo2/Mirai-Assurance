import React, { useEffect, useState } from "react";
import API from "../api";
import PaymentButton from "../components/PaymentButton";
import RenewalPaymentButton from "../components/RenewalPaymentButton";
import { formatDate, getRenewalAction } from "./renewalUi";

const statusStyles = {
  ACTIVE: "bg-green-100 text-green-700",
  EXPIRED: "bg-red-100 text-red-700",
  AWAITING_LATE_RENEWAL_REQUEST: "bg-amber-100 text-amber-700",
  LATE_RENEWAL_APPROVED: "bg-sky-100 text-sky-700",
};

const MyPolicies = () => {
  const [applications, setApplications] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [renewalStates, setRenewalStates] = useState({});
  const [approvalRequests, setApprovalRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPolicies = async () => {
    setLoading(true);
    setError("");
    try {
      const [policyResponse, applicationResponse, requestResponse] = await Promise.all([
        API.get("/policies"),
        API.get("/applications/my-policies"),
        API.get("/renewal-approvals/my"),
      ]);
      const nextPolicies = policyResponse.data || [];
      const stateEntries = await Promise.all(nextPolicies.map(async (policy) => {
        try {
          const response = await API.get(`/policies/${policy._id}/renewal-state`);
          return [policy._id, response.data];
        } catch {
          return [policy._id, null];
        }
      }));
      setPolicies(nextPolicies);
      setApplications(applicationResponse.data || []);
      setApprovalRequests(requestResponse.data || []);
      setRenewalStates(Object.fromEntries(stateEntries));
    } catch (loadError) {
      console.error("Error fetching customer policies:", loadError);
      setError("Could not load your policies. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicies();
  }, []);

  if (loading) return <div className="p-8 text-center font-bold">Loading your policies...</div>;

  return (
    <div className="min-h-screen bg-blue-50 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-8 border-b-2 border-blue-200 pb-4 text-4xl font-black tracking-tighter text-blue-900">
          My Insurance Portfolio
        </h2>

        {error && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</div>}

        {policies.length > 0 && (
          <div className="grid gap-6">
            {policies.map((policy) => {
              const state = renewalStates[policy._id];
              const request = approvalRequests.find((item) => String(item.policy) === String(policy._id));
              const action = getRenewalAction(state, request);
              const renewalPremium = policy.purchasedTerms?.premium;

              return (
                <article key={policy._id} className="rounded-3xl border border-blue-100 bg-white p-5 shadow-lg sm:p-8">
                  <div className="flex flex-col justify-between gap-6 lg:flex-row">
                    <div className="space-y-3">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-500">Policy {policy.policyNumber}</p>
                      <h3 className="text-2xl font-black uppercase leading-tight text-blue-900">
                        {policy.purchasedTerms?.title || policy.plan?.title || "Insurance Policy"}
                      </h3>
                      <p className="text-sm font-semibold text-slate-600">
                        {policy.purchasedTerms?.category || policy.plan?.category || "Health coverage"}
                      </p>
                      <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                        <span>Current period: <strong>{formatDate(policy.currentPeriodStart)} - {formatDate(policy.currentPeriodEnd)}</strong></span>
                        <span>Next renewal: <strong>{formatDate(policy.nextRenewalDate)}</strong></span>
                        <span>Renewal count: <strong>{policy.renewalCount || 0}</strong></span>
                        <span>Sequence: <strong>{policy.renewalSequence || 0}</strong></span>
                      </div>
                    </div>

                    <div className="flex min-w-[220px] flex-col items-start gap-3 lg:items-end">
                      <span className={`rounded-full px-4 py-1 text-xs font-black uppercase tracking-widest ${statusStyles[policy.status] || "bg-slate-100 text-slate-700"}`}>
                        {policy.status}
                      </span>
                      <p className="text-3xl font-black text-blue-700">
                        ₹{Number(policy.initialPremium || policy.purchasedTerms?.premium || 0).toLocaleString("en-IN")}
                      </p>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Renewal premium: ₹{Number(renewalPremium || 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-slate-100 pt-5">
                    {!state ? (
                      <p className="text-sm font-bold text-slate-500">Renewal state unavailable.</p>
                    ) : (
                      <RenewalPanel
                        policy={policy}
                        state={state}
                        request={request}
                        action={action}
                        onRefresh={loadPolicies}
                      />
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {policies.length === 0 && <EmptyPolicyState />}
        {applications.filter((application) => !application.policy).length > 0 && (
          <div className="mt-8 grid gap-4">
            <h3 className="text-xl font-black text-blue-900">Applications in progress</h3>
            {applications.filter((application) => !application.policy).map((application) => (
              <div key={application._id} className="flex flex-col justify-between gap-4 rounded-2xl bg-white p-5 shadow sm:flex-row sm:items-center">
                <div>
                  <h4 className="font-black text-blue-900">{application.plan?.title || "Plan application"}</h4>
                  <p className="text-sm font-semibold text-slate-500">Application status: {application.status}</p>
                </div>
                {application.paymentStatus === "unpaid" && application.status === "approved" && (
                  <PaymentButton applicationId={application._id} amount={application.plan?.premium} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const RenewalPanel = ({ policy, state, request, action, onRefresh }) => {
  const [reason, setReason] = useState("");
  const [supportingDocument, setSupportingDocument] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submitLateRequest = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await API.post("/renewal-approvals", { renewalId: state.renewalId, reason, supportingDocument });
      await onRefresh();
    } catch (submitError) {
      setError(submitError.response?.data?.msg || "Could not submit the late-renewal request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
        <span>Renewal window: <strong>{formatDate(state.renewalWindowStart)} - {formatDate(state.renewalWindowEnd)}</strong></span>
        <span>Grace period: <strong>{formatDate(state.gracePeriodStart)} - {formatDate(state.gracePeriodEnd)}</strong></span>
        <span>Late request: <strong>{formatDate(state.lateRequestStart)} - {formatDate(state.lateRequestEnd)}</strong></span>
        <span>State: <strong>{state.renewalState}</strong></span>
      </div>

      {request && (
        <div className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
          Approval request: <strong>{request.status}</strong>
          {request.paymentDeadline && <> · Payment deadline: <strong>{formatDate(request.paymentDeadline)}</strong></>}
          {request.rejectionReason && <> · {request.rejectionReason}</>}
        </div>
      )}

      {action === "PAY_RENEWAL" && state.renewalId && (
        <RenewalPaymentButton renewalId={state.renewalId} premium={policy.purchasedTerms?.premium} onComplete={onRefresh} />
      )}
      {action === "REQUEST_LATE_APPROVAL" && state.renewalId && (
        <form onSubmit={submitLateRequest} className="grid gap-3 rounded-2xl bg-amber-50 p-4 sm:grid-cols-2">
          <label className="text-sm font-bold text-slate-700">
            Reason
            <textarea required value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-24 w-full rounded-lg border border-amber-200 p-2" />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Supporting document reference
            <input required value={supportingDocument} onChange={(event) => setSupportingDocument(event.target.value)} className="mt-1 w-full rounded-lg border border-amber-200 p-2" />
            <button type="submit" disabled={submitting} className="mt-3 rounded-lg bg-amber-600 px-4 py-2 font-bold text-white disabled:opacity-60">
              {submitting ? "Submitting..." : "Request Late Renewal Approval"}
            </button>
          </label>
          {error && <p className="text-sm font-bold text-red-600 sm:col-span-2">{error}</p>}
        </form>
      )}
      {action === "APPROVAL_PENDING" && <p className="font-bold text-amber-700">Late-renewal approval is pending. Normal renewal payment is unavailable.</p>}
      {action === "APPROVAL_APPROVED" && <p className="font-bold text-sky-700">Approval granted. Payment deadline: {formatDate(request.paymentDeadline)}.</p>}
      {action === "EXPIRED" && <p className="font-bold text-red-700">This renewal is expired. No payment or approval request is available.</p>}
      {action === "NOT_OPEN" && <p className="font-bold text-slate-500">Renewal actions will appear when the backend opens the renewal window.</p>}
    </div>
  );
};

const EmptyPolicyState = () => (
  <div className="rounded-3xl bg-white p-10 text-center shadow">
    <p className="font-bold text-slate-500">You do not have an active policy yet.</p>
  </div>
);

export default MyPolicies;
// {
//   "_id": {
//     "$oid": "69b162815f424cfe936c6234"
//   },
//   "user": {
//     "$oid": "69b14f9389975584f48ed71a"
//   },
//   "plan": {
//     "$oid": "69b15cf4ecfdab022c10fd0c"
//   },
//   "status": "pending",
//   "paymentStatus": "unpaid",
//   "appliedDate": {
//     "$date": "2026-03-11T12:39:29.117Z"
//   },
//   "__v": 0
// }

// {
//   "_id": {
//     "$oid": "69b19020e238cdd191656445"
//   },
//   "user": {
//     "$oid": "69b14f9389975584f48ed71a"
//   },
//   "plan": {
//     "$oid": "69b15cf4ecfdab022c10fd0b"
//   },
//   "status": "pending",
//   "paymentStatus": "unpaid",
//   "appliedDate": {
//     "$date": "2026-03-11T15:54:08.983Z"
//   },
//   "__v": 0
// }
