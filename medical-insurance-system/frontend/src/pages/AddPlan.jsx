import React, { useEffect, useState } from "react";
import { Edit3, Plus, X } from "lucide-react";
import API from "../api";

const createEmptyPlan = () => ({
  title: "",
  category: "",
  premium: "",
  coverage: "",
  minEligibleAge: "18",
  maxEligibleAge: "65",
  coveredConditions: "",
  terms: "",
  exclusions: "",
  networkBenefits: "",
});

const normalisePlanForForm = (plan) => ({
  ...createEmptyPlan(),
  ...plan,
  coveredConditions: Array.isArray(plan.coveredConditions)
    ? plan.coveredConditions.join(", ")
    : plan.coveredConditions || "",
});

const PlanForm = ({
  formData,
  onChange,
  onSubmit,
  submitLabel,
  onCancel,
  message,
}) => (
  <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
    {message && (
      <p className="md:col-span-2 rounded-xl bg-blue-50 p-3 text-center font-bold text-blue-700">
        {message}
      </p>
    )}

    <input
      className="md:col-span-2 rounded-xl border-2 p-3 font-bold"
      placeholder="PLAN TITLE"
      value={formData.title}
      onChange={onChange("title")}
      required
    />
    <input
      className="rounded-xl border-2 p-3 font-bold"
      placeholder="CATEGORY"
      value={formData.category}
      onChange={onChange("category")}
      required
    />
    <input
      className="rounded-xl border-2 p-3 font-bold"
      type="number"
      min="1"
      placeholder="PREMIUM (₹)"
      value={formData.premium}
      onChange={onChange("premium")}
      required
    />
    <input
      className="md:col-span-2 rounded-xl border-2 p-3 font-bold"
      type="number"
      min="1"
      placeholder="MAX COVERAGE (₹)"
      value={formData.coverage}
      onChange={onChange("coverage")}
      required
    />
    <input
      className="rounded-xl border-2 p-3 font-bold"
      type="number"
      min="1"
      max="120"
      placeholder="MIN ELIGIBLE AGE"
      value={formData.minEligibleAge}
      onChange={onChange("minEligibleAge")}
      required
    />
    <input
      className="rounded-xl border-2 p-3 font-bold"
      type="number"
      min="1"
      max="120"
      placeholder="MAX ELIGIBLE AGE"
      value={formData.maxEligibleAge}
      onChange={onChange("maxEligibleAge")}
      required
    />
    <input
      className="md:col-span-2 rounded-xl border-2 p-3 font-bold"
      placeholder="COVERED CONDITIONS (comma separated)"
      value={formData.coveredConditions}
      onChange={onChange("coveredConditions")}
    />
    <textarea
      className="md:col-span-2 min-h-24 rounded-xl border-2 p-3 font-bold"
      placeholder="PLAN TERMS"
      value={formData.terms}
      onChange={onChange("terms")}
    />
    <textarea
      className="md:col-span-2 min-h-24 rounded-xl border-2 p-3 font-bold"
      placeholder="EXCLUSIONS"
      value={formData.exclusions}
      onChange={onChange("exclusions")}
    />
    <textarea
      className="md:col-span-2 min-h-24 rounded-xl border-2 p-3 font-bold"
      placeholder="NETWORK BENEFITS"
      value={formData.networkBenefits}
      onChange={onChange("networkBenefits")}
    />

    <div className="md:col-span-2 flex gap-3">
      <button
        type="submit"
        className="flex-1 rounded-xl bg-blue-900 p-4 font-black uppercase italic text-white shadow-lg transition hover:bg-blue-800"
      >
        {submitLabel}
      </button>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-blue-200 px-5 font-bold text-blue-900 hover:bg-blue-50"
        >
          Cancel
        </button>
      )}
    </div>
  </form>
);

const AddPlan = () => {
  const [formData, setFormData] = useState(createEmptyPlan);
  const [plans, setPlans] = useState([]);
  const [editingPlan, setEditingPlan] = useState(null);
  const [message, setMessage] = useState("");

  const fetchPlans = async () => {
    try {
      const response = await API.get("/plans");
      setPlans(response.data);
    } catch {
      setMessage("Unable to load plans.");
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const updateField = (field) => (event) => {
    setFormData((current) => ({ ...current, [field]: event.target.value }));
  };

  const savePlan = async (event) => {
    event.preventDefault();
    if (Number(formData.minEligibleAge) > Number(formData.maxEligibleAge)) {
      setMessage("Minimum age cannot be greater than maximum age.");
      return;
    }

    const payload = {
      ...formData,
      coveredConditions: formData.coveredConditions
        .split(",")
        .map((condition) => condition.trim())
        .filter(Boolean),
    };

    try {
      if (editingPlan) {
        await API.put(`/plans/${editingPlan._id}`, payload);
        setMessage("PLAN UPDATED SUCCESSFULLY!");
      } else {
        await API.post("/plans/add", payload);
        setMessage("PLAN ADDED SUCCESSFULLY!");
      }
      setFormData(createEmptyPlan());
      setEditingPlan(null);
      fetchPlans();
    } catch (err) {
      setMessage(err.response?.data?.message || "UNABLE TO SAVE PLAN.");
    }
  };

  const beginEdit = (plan) => {
    setEditingPlan(plan);
    setFormData(normalisePlanForForm(plan));
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingPlan(null);
    setFormData(createEmptyPlan());
    setMessage("");
  };

  return (
    <div className="min-h-screen bg-blue-100 p-4">
      <div className="mx-auto mt-10 w-full max-w-2xl rounded-3xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          {editingPlan ? (
            <Edit3 className="text-blue-900" />
          ) : (
            <Plus className="text-blue-900" />
          )}
          <h2 className="text-3xl font-black uppercase text-blue-900">
            {editingPlan
              ? `Edit ${editingPlan.title}`
              : "Create Insurance Plan"}
          </h2>
        </div>

        <PlanForm
          formData={formData}
          onChange={updateField}
          onSubmit={savePlan}
          submitLabel={editingPlan ? "Save Plan Changes" : "Save New Plan"}
          onCancel={editingPlan ? cancelEdit : null}
          message={message}
        />
      </div>

      <div className="mx-auto w-full max-w-2xl pb-10 pt-8">
        <h3 className="mb-4 text-xl font-black text-blue-900">Active Plans</h3>
        <div className="space-y-4">
          {plans.map((plan) => (
            <article
              key={plan._id}
              className="flex items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-md"
            >
              <div>
                <p className="font-black uppercase text-blue-900">
                  {plan.title}
                </p>
                <p className="mt-1 text-xs font-bold text-gray-500">
                  {plan.category} · Age {plan.minEligibleAge ?? 18}-
                  {plan.maxEligibleAge ?? 65} · Premium: ₹{plan.premium}
                </p>
              </div>
              <button
                onClick={() => beginEdit(plan)}
                className="flex shrink-0 items-center gap-2 rounded-xl bg-blue-100 px-3 py-2 text-xs font-black uppercase text-blue-800 transition hover:bg-blue-200"
              >
                <Edit3 size={15} /> Edit
              </button>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AddPlan;
