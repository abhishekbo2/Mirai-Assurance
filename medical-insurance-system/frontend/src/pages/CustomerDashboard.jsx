import React, { useEffect, useMemo, useState } from "react";
import { Check, Menu, Search, SlidersHorizontal, X } from "lucide-react";
import API from "../api";
import PaymentButton from "../components/PaymentButton";

const CONDITIONS = [
  ["diabetes", "Diabetes"],
  ["hypertension", "Hypertension"],
  ["cardiacIssues", "Cardiac Issues"],
  ["asthma", "Asthma"],
  ["cancer", "Cancer"],
  ["kidneyDisease", "Kidney Disease"],
  ["other", "Other Health Condition"],
];

const EMPTY_FILTERS = {
  applicantType: "individual",
  age: "",
  conditions: [],
  categories: [],
};

const createHealthDeclaration = () =>
  Object.fromEntries(CONDITIONS.map(([key]) => [key, false]));

const getAgeRange = (plan) => ({
  min: plan.minEligibleAge ?? 18,
  max: plan.maxEligibleAge ?? 65,
});

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 className="text-2xl font-black text-blue-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100"
            aria-label="Close modal"
          >
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-black uppercase tracking-wide text-blue-800">
        {label}
      </h3>
      <p className="text-sm leading-6 text-gray-700">{value}</p>
    </div>
  );
}

function PlanCard({ plan, onClick }) {
  const { min, max } = getAgeRange(plan);

  return (
    <button
      key={plan._id}
      onClick={onClick}
      className="rounded-3xl border-t-8 border-blue-600 bg-white p-8 text-left shadow-xl transition-all hover:scale-[1.03] hover:shadow-2xl"
    >
      <h2 className="mb-2 text-2xl font-black uppercase text-blue-800">
        {plan.title}
      </h2>
      <span className="mb-4 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase text-blue-700">
        {plan.category || "General"}
      </span>
      <p className="text-sm font-medium text-gray-500">Coverage Amount</p>
      <p className="mb-3 text-lg font-bold text-gray-800">
        ₹{plan.coverage?.toLocaleString("en-IN")}
      </p>
      <p className="text-sm font-medium text-gray-500">
        Eligible age: {min}-{max}
      </p>
      <div className="mt-4 border-t border-gray-100 pt-4">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
          Premium/year
        </p>
        <p className="text-3xl font-black text-green-600">
          ₹{plan.premium || plan.basePremium}
        </p>
      </div>
    </button>
  );
}

function PlanFilterDrawer({
  isOpen,
  filters,
  categories,
  onChange,
  onToggle,
  onApply,
  onReset,
  onClose,
}) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-full max-w-sm overflow-y-auto bg-white p-6 shadow-2xl transition-transform duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="mb-8 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-2xl font-black text-blue-900">
            <SlidersHorizontal /> Filter Plans
          </h2>
          <button onClick={onClose} aria-label="Close filters">
            <X />
          </button>
        </div>

        <section>
          <h3 className="mb-3 font-black text-gray-800">
            Who is this policy for?
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {["individual", "family"].map((type) => (
              <button
                key={type}
                onClick={() => onChange("applicantType", type)}
                className={`rounded-xl border p-3 font-bold capitalize ${filters.applicantType === type ? "border-blue-700 bg-blue-100 text-blue-900" : "border-gray-200 text-gray-600"}`}
              >
                {type}
              </button>
            ))}
          </div>
        </section>

        {filters.applicantType === "individual" && (
          <section className="mt-7">
            <h3 className="mb-3 font-black text-gray-800">Your age</h3>
            <input
              type="number"
              min="1"
              max="120"
              value={filters.age}
              onChange={(event) => onChange("age", event.target.value)}
              placeholder="Enter your age"
              className="w-full rounded-xl border p-3"
            />
          </section>
        )}

        <section className="mt-7">
          <h3 className="mb-3 font-black text-gray-800">Covered Conditions</h3>
          {CONDITIONS.map(([, label]) => (
            <label
              key={label}
              className="mb-2 flex cursor-pointer items-center gap-3 text-gray-700"
            >
              <input
                type="checkbox"
                checked={filters.conditions.includes(label)}
                onChange={() => onToggle("conditions", label)}
              />
              {label}
            </label>
          ))}
        </section>

        <section className="mt-7">
          <h3 className="mb-3 font-black text-gray-800">Plan Category</h3>
          {categories.map((category) => (
            <label
              key={category}
              className="mb-2 flex cursor-pointer items-center gap-3 text-gray-700"
            >
              <input
                type="checkbox"
                checked={filters.categories.includes(category)}
                onChange={() => onToggle("categories", category)}
              />
              {category}
            </label>
          ))}
        </section>

        <div className="mt-8 grid grid-cols-2 gap-3">
          <button
            onClick={onApply}
            className="rounded-xl bg-blue-900 py-3 font-bold text-white"
          >
            Apply Filters
          </button>
          <button
            onClick={onReset}
            className="rounded-xl border border-blue-200 py-3 font-bold text-blue-900"
          >
            Reset
          </button>
        </div>
      </aside>
    </>
  );
}

const CustomerDashboard = () => {
  const [plans, setPlans] = useState([]);
  const [applications, setApplications] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [applicantAge, setApplicantAge] = useState("");
  const [healthDeclaration, setHealthDeclaration] = useState(
    createHealthDeclaration,
  );
  const [medicalDocument, setMedicalDocument] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      const [planResponse, applicationResponse] = await Promise.all([
        API.get("/plans"),
        API.get("/applications/my-policies"),
      ]);
      setPlans(planResponse.data);
      setApplications(applicationResponse.data);
    } catch {
      setError("Unable to load plans. Please refresh and try again.");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const categories = useMemo(
    () => [...new Set(plans.map((plan) => plan.category).filter(Boolean))],
    [plans],
  );
  const selectedApplication =
    selectedPlan &&
    applications.find(
      (app) =>
        app.plan?._id === selectedPlan._id || app.plan === selectedPlan._id,
    );

  const filteredPlans = useMemo(
    () =>
      plans.filter((plan) => {
        const matchesSearch = plan.title
          ?.toLowerCase()
          .includes(searchTerm.trim().toLowerCase());
        const matchesAge =
          filters.applicantType === "family" ||
          filters.age === "" ||
          (Number(filters.age) >= getAgeRange(plan).min &&
            Number(filters.age) <= getAgeRange(plan).max);
        const coveredConditions = (plan.coveredConditions || []).map(
          (condition) => condition.toLowerCase(),
        );
        const matchesConditions = filters.conditions.every((condition) =>
          coveredConditions.includes(condition.toLowerCase()),
        );
        const matchesCategory =
          !filters.categories.length ||
          filters.categories.includes(plan.category);
        return (
          matchesSearch && matchesAge && matchesConditions && matchesCategory
        );
      }),
    [plans, searchTerm, filters],
  );

  const changeDraftFilter = (field, value) =>
    setDraftFilters((current) => ({ ...current, [field]: value }));
  const toggleDraftFilter = (field, value) =>
    setDraftFilters((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value],
    }));

  const submitApplication = async (event) => {
    event.preventDefault();
    const isIndividual = filters.applicantType === "individual";
    const age = Number(applicantAge);
    const { min, max } = getAgeRange(selectedPlan);
    if (isIndividual && (!Number.isInteger(age) || age < min || age > max))
      return setError(`Enter an age between ${min} and ${max}.`);
    try {
      setSubmitting(true);
      setError("");
      const formData = new FormData();
      formData.append("planId", selectedPlan._id);
      formData.append("applicantType", filters.applicantType);
      if (isIndividual) formData.append("applicantAge", String(age));
      formData.append("healthDeclaration", JSON.stringify(healthDeclaration));
      if (medicalDocument)
        formData.append("medicalClearanceDocument", medicalDocument);
      await API.post("/applications/apply", formData);
      await loadData();
      setShowApplicationForm(false);
    } catch (requestError) {
      setError(
        requestError.response?.data?.msg || "Could not submit the application.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderPlanAction = () => {
    if (!selectedApplication)
      return (
        <button
          onClick={() => setShowApplicationForm(true)}
          className="w-full rounded-xl bg-blue-900 py-3 font-bold text-white hover:bg-blue-800"
        >
          Apply for this Plan
        </button>
      );
    if (selectedApplication.paymentStatus === "paid")
      return (
        <p className="rounded-xl bg-green-50 p-3 text-center font-bold text-green-700">
          This policy premium has already been paid.
        </p>
      );
    if (selectedApplication.status === "approved")
      return (
        <PaymentButton
          applicationId={selectedApplication._id}
          amount={selectedPlan.premium || selectedPlan.basePremium}
        />
      );
    if (selectedApplication.status === "rejected")
      return (
        <p className="rounded-xl bg-red-50 p-3 text-center font-bold text-red-700">
          This application was not approved.
        </p>
      );
    return (
      <p className="rounded-xl bg-orange-50 p-3 text-center font-bold text-orange-700">
        Application submitted. Please wait for admin approval before payment.
      </p>
    );
  };

  return (
    <div className="min-h-screen bg-blue-100 p-4 sm:p-8">
      <main className="mx-auto max-w-6xl">
        <header className="mb-10 flex flex-col gap-4 md:-ml-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="rounded-xl bg-blue-900 p-3 text-white shadow-md hover:bg-blue-800"
            >
              <Menu size={24} />
            </button>
            <div>
              <h1 className="text-4xl font-black text-blue-900">
                Available Insurance Plans
              </h1>
              <p className="mt-1 text-sm font-medium text-blue-700">
                Review a plan before applying.
              </p>
            </div>
          </div>
          <div className="relative w-full md:w-80">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-blue-500"
              size={20}
            />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by plan name"
              className="w-full rounded-xl border border-blue-200 bg-white py-3 pl-12 pr-4 font-medium text-blue-900 shadow-sm outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </header>
        {error && !showApplicationForm && (
          <p className="mb-6 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>
        )}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {filteredPlans.map((plan) => (
            <PlanCard
              key={plan._id}
              plan={plan}
              onClick={() => {
                setSelectedPlan(plan);
                setError("");
              }}
            />
          ))}
        </div>
      </main>
      <PlanFilterDrawer
        isOpen={isDrawerOpen}
        filters={draftFilters}
        categories={categories}
        onChange={changeDraftFilter}
        onToggle={toggleDraftFilter}
        onApply={() => {
          setFilters(draftFilters);
          setIsDrawerOpen(false);
        }}
        onReset={() => {
          setDraftFilters(EMPTY_FILTERS);
          setFilters(EMPTY_FILTERS);
        }}
        onClose={() => setIsDrawerOpen(false)}
      />
      {selectedPlan && !showApplicationForm && (
        <Modal title={selectedPlan.title} onClose={() => setSelectedPlan(null)}>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-blue-50 p-4">
              <Detail
                label="Coverage"
                value={`₹${selectedPlan.coverage?.toLocaleString("en-IN")}`}
              />
              <Detail
                label="Premium/year"
                value={`₹${selectedPlan.premium || selectedPlan.basePremium}`}
              />
              <Detail
                label="Eligible age"
                value={`${getAgeRange(selectedPlan).min}-${getAgeRange(selectedPlan).max}`}
              />
              <Detail label="Category" value={selectedPlan.category} />
            </div>
            <Detail
              label="Covered conditions"
              value={
                (selectedPlan.coveredConditions || []).join(", ") ||
                "No covered conditions were added."
              }
            />
            <Detail
              label="Terms"
              value={selectedPlan.terms || "No terms were added."}
            />
            <Detail
              label="Exclusions"
              value={selectedPlan.exclusions || "No exclusions were added."}
            />
            <Detail
              label="Network benefits"
              value={
                selectedPlan.networkBenefits ||
                "No network benefits were added."
              }
            />
            {renderPlanAction()}
          </div>
        </Modal>
      )}
      {selectedPlan && showApplicationForm && (
        <Modal
          title="Medical Clearance & Health Declaration"
          onClose={() => setShowApplicationForm(false)}
        >
          <form onSubmit={submitApplication} className="space-y-5">
            <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
              Applying as a{" "}
              <b className="capitalize">{filters.applicantType}</b>.
            </p>
            {filters.applicantType === "individual" && (
              <label className="block font-bold">
                Your age
                <input
                  required
                  type="number"
                  min="1"
                  max="120"
                  value={applicantAge}
                  onChange={(event) => setApplicantAge(event.target.value)}
                  className="mt-2 block w-full rounded-xl border p-3"
                />
              </label>
            )}
            <fieldset>
              <legend className="mb-3 font-bold">Health declaration</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {CONDITIONS.map(([key, label]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-xl border p-3"
                  >
                    <span>{label}</span>
                    <span className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setHealthDeclaration({
                            ...healthDeclaration,
                            [key]: true,
                          })
                        }
                        className={`rounded px-2 py-1 text-xs ${healthDeclaration[key] ? "bg-red-100 text-red-700" : "bg-gray-100"}`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setHealthDeclaration({
                            ...healthDeclaration,
                            [key]: false,
                          })
                        }
                        className={`rounded px-2 py-1 text-xs ${!healthDeclaration[key] ? "bg-green-100 text-green-700" : "bg-gray-100"}`}
                      >
                        No
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </fieldset>
            <label className="block font-bold">
              Medical clearance document{" "}
              <span className="font-normal text-gray-500">
                (optional, PDF/PNG/JPG)
              </span>
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                onChange={(event) =>
                  setMedicalDocument(event.target.files?.[0] || null)
                }
                className="mt-2 block w-full rounded-xl border p-3"
              />
            </label>
            {error && (
              <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>
            )}
            <button
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-900 py-3 font-bold text-white disabled:opacity-60"
            >
              <Check size={18} />
              {submitting ? "Submitting..." : "Submit for Admin Approval"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default CustomerDashboard;
