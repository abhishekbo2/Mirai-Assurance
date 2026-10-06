import React, { useEffect, useRef, useState } from "react";
import { BarChart3, Camera, FileText, User, X } from "lucide-react";
import API from "../api";
import PaymentButton from "./PaymentButton";
import RenewalPaymentButton from "./RenewalPaymentButton";
import { formatDate, getRenewalAction } from "../pages/renewalUi";
import { getLocalSession, linkOidcAccount, logout } from "../auth/keycloak";

const SectionHeader = ({ icon, label, count, onClick }) => (
  <button
    onClick={onClick}
    className="flex w-full items-center justify-between rounded-xl bg-gray-100 p-3 font-semibold text-gray-800 transition hover:bg-gray-200"
  >
    <span className="flex items-center gap-2">
      {icon}
      {label}
    </span>
    <span className="rounded bg-blue-600 px-2 py-1 text-xs text-white">
      {count}
    </span>
  </button>
);

const ProfileSidebar = ({ isOpen, onClose, onProfileImageChange }) => {
  const [profileData, setProfileData] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [renewalStates, setRenewalStates] = useState({});
  const [approvalRequests, setApprovalRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openSections, setOpenSections] = useState({
    applications: false,
    claims: false,
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linking, setLinking] = useState(false);
  const imageInputRef = useRef(null);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError("");
      const profileResponse = await API.get("/auth/profile");
      setProfileData(profileResponse.data);
      if (profileResponse.data.user.role !== "customer") return;

      const [policyResponse, approvalResponse] = await Promise.all([
        API.get("/policies"),
        API.get("/renewal-approvals/my"),
      ]);
      const nextPolicies = policyResponse.data || [];
      const stateEntries = await Promise.all(nextPolicies.map(async (policy) => {
        try {
          const stateResponse = await API.get(`/policies/${policy._id}/renewal-state`);
          return [policy._id, stateResponse.data];
        } catch {
          return [policy._id, null];
        }
      }));
      setPolicies(nextPolicies);
      setRenewalStates(Object.fromEntries(stateEntries));
      setApprovalRequests(approvalResponse.data || []);
    } catch (requestError) {
      setError(requestError.response?.data?.msg || "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchProfile();
  }, [isOpen]);

  const toggleSection = (section) => {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const handleLogout = () => {
    onClose();
    logout();
  };

  const handleLinkKeycloak = async () => {
    try {
      setLinking(true);
      setLinkError("");
      const localSession = getLocalSession();
      const response = await API.post("/auth/link-oidc/start", null, {
        headers: { "X-Local-Authorization": `Bearer ${localSession.token}` },
      });
      await linkOidcAccount(response.data.transactionId, "/customer-dashboard");
    } catch (linkRequestError) {
      setLinkError(linkRequestError.message || "Unable to start Keycloak linking.");
      setLinking(false);
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/"))
      return setImageError("Please choose an image file.");
    if (file.size > 5 * 1024 * 1024)
      return setImageError("Profile image must be 5 MB or smaller.");
    try {
      setUploadingImage(true);
      setImageError("");
      const formData = new FormData();
      formData.append("profileImage", file);
      const response = await API.post("/auth/profile/image", formData);
      const profileImage = response.data.profileImage;
      setProfileData((current) => ({
        ...current,
        user: { ...current.user, profileImage },
      }));
      onProfileImageChange?.(profileImage);
    } catch (requestError) {
      setImageError(
        requestError.response?.data?.msg || "Unable to upload profile image.",
      );
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[998] bg-black/50" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-[999] flex max-h-screen w-full max-w-md flex-col overflow-hidden rounded-l-3xl bg-white shadow-2xl">
        <header className="flex items-center justify-between bg-blue-600 p-4 text-white">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <User size={24} />
            Profile
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-blue-700"
          >
            <X size={24} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <p className="py-8 text-center text-gray-500">Loading profile...</p>
          )}
          {error && (
            <div className="py-8 text-center">
              <p className="font-semibold text-red-500">{error}</p>
              <button
                onClick={fetchProfile}
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white"
              >
                Retry
              </button>
            </div>
          )}
          {profileData && (
            <>
              <div className="mb-6 flex items-start justify-between gap-4 border-b pb-6">
                <div className="min-w-0">
                  <h3 className="mb-2 text-lg font-bold text-gray-800">
                    {profileData.user.name}
                  </h3>
                  <p className="break-words text-sm text-gray-600">
                    {profileData.user.email}
                  </p>
                  <span className="mt-3 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
                    {profileData.user.role}
                  </span>
                </div>
                <div className="relative shrink-0">
                  <div className="h-20 w-20 overflow-hidden rounded-full border-4 border-blue-100 bg-blue-50 text-blue-600">
                    {profileData.user.profileImage ? (
                      <img
                        src={profileData.user.profileImage}
                        alt="Profile"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="m-5" size={40} />
                    )}
                  </div>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="absolute -right-1 -top-1 rounded-full border-2 border-white bg-blue-600 p-2 text-white"
                  >
                    <Camera size={16} />
                  </button>
                </div>
              </div>
              {uploadingImage && (
                <p className="-mt-4 mb-4 text-sm text-blue-600">
                  Uploading profile photo...
                </p>
              )}
              {imageError && (
                <p className="-mt-4 mb-4 text-sm text-red-600">{imageError}</p>
              )}
              {getLocalSession() && profileData.user.authProvider === "local" && (
                <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="font-semibold text-blue-800">Link Keycloak</p>
                  <p className="mt-1 text-sm text-blue-700">
                    Sign in to Keycloak to enable both login methods for this account.
                  </p>
                  <button
                    onClick={handleLinkKeycloak}
                    disabled={linking}
                    className="mt-3 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
                  >
                    {linking ? "Opening Keycloak..." : "Link Keycloak account"}
                  </button>
                  {linkError && <p className="mt-2 text-sm text-red-600">{linkError}</p>}
                </div>
              )}
              {profileData.user.role === "customer" && (
                <div className="space-y-4">
                  <div>
                    <SectionHeader
                      icon={<BarChart3 size={18} />}
                      label="Insurance Plans"
                      count={(profileData.applications || []).length}
                      isOpen={openSections.applications}
                      onClick={() => toggleSection("applications")}
                    />
                    {openSections.applications && (
                      <div className="mt-2 space-y-3">
                        {profileData.applications?.length ? (
                          profileData.applications.map((app) => {
                            const policyId = app.policy?._id || app.policy;
                            const policy = policies.find((item) => (
                              String(item._id) === String(policyId) ||
                              String(item.application) === String(app._id)
                            ));
                            const renewalState = policy && renewalStates[policy._id];
                            const approvalRequest = approvalRequests.find((item) => (
                              String(item.policy) === String(policy?._id)
                            ));
                            const renewalAction = getRenewalAction(renewalState, approvalRequest);

                            return (
                            <article
                              key={app._id}
                              className="rounded-xl border border-blue-200 bg-blue-50 p-4"
                            >
                              <p className="font-semibold text-gray-800">
                                {app.plan?.title || "Plan details unavailable"}
                              </p>
                              <p className="mt-1 text-xs text-gray-600">
                                Coverage: ₹
                                {app.plan?.coverage?.toLocaleString("en-IN") ||
                                  "N/A"}
                              <p className="mt-1 text-xs text-gray-500">
                                Next renewal: {formatDate(policy?.nextRenewalDate)}
                              </p>
                              {renewalAction === "PAY_RENEWAL" && renewalState?.renewalId && (
                                <div className="mt-3">
                                  <RenewalPaymentButton
                                    renewalId={renewalState.renewalId}
                                    premium={policy?.purchasedTerms?.premium || app.plan?.premium || app.plan?.basePremium}
                                    onComplete={fetchProfile}
                                  />
                                </div>
                              )}
                              </p>
                              <p className="mt-1 text-xs text-gray-600">
                                Premium: ₹
                                {app.plan?.premium ||
                                  app.plan?.basePremium ||
                                  "N/A"}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <span className="rounded bg-blue-200 px-2 py-1 text-xs text-blue-800">
                                  {app.status}
                                </span>
                                <span
                                  className={`rounded px-2 py-1 text-xs ${app.paymentStatus === "paid" ? "bg-green-200 text-green-800" : "bg-orange-200 text-orange-800"}`}
                                >
                                  {app.paymentStatus}
                                </span>
                              </div>
                              <p className="mt-2 text-xs text-gray-500">
                                Applied:{" "}
                                {new Date(app.appliedDate).toLocaleDateString()}
                              </p>
                              {app.paymentStatus === "unpaid" &&
                                app.status === "approved" && (
                                  <div className="mt-3">
                                    <PaymentButton
                                      applicationId={app._id}
                                      amount={
                                        app.plan?.premium ||
                                        app.plan?.basePremium
                                      }
                                    />
                                  </div>
                                )}
                              {app.paymentStatus === "unpaid" &&
                                app.status !== "approved" &&
                                app.status !== "rejected" && (
                                  <p className="mt-3 text-xs font-bold text-orange-700">
                                    Please wait for admin approval before
                                    payment.
                                  </p>
                                )}
                              {app.status === "rejected" && (
                                <p className="mt-3 text-xs font-bold text-red-700">
                                  This application was not approved.
                                </p>
                              )}
                            </article>
                            );
                          })
                        ) : (
                          <p className="py-3 text-center text-sm text-gray-500">
                            No insurance plans yet.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <SectionHeader
                      icon={<FileText size={18} />}
                      label="My Claims"
                      count={(profileData.claims || []).length}
                      isOpen={openSections.claims}
                      onClick={() => toggleSection("claims")}
                    />
                    {openSections.claims && (
                      <div className="mt-2 space-y-3">
                        {profileData.claims?.length ? (
                          profileData.claims.map((claim) => (
                            <article
                              key={claim._id}
                              className="rounded-xl border border-purple-200 bg-purple-50 p-3"
                            >
                              <p className="font-semibold text-gray-800">
                                Claim Amount: ₹
                                {claim.amount?.toLocaleString("en-IN") || "N/A"}
                              </p>
                              <p className="mt-1 text-xs text-gray-600">
                                Type: {claim.type || "N/A"}
                              </p>
                              <span className="mt-2 inline-block rounded bg-yellow-200 px-2 py-1 text-xs text-yellow-800">
                                {claim.status}
                              </span>
                            </article>
                          ))
                        ) : (
                          <p className="py-3 text-center text-sm text-gray-500">
                            No claims filed yet.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="mt-6 w-full rounded-xl bg-red-500 py-3 font-bold text-white shadow-md hover:bg-red-600"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
};

export default ProfileSidebar;
