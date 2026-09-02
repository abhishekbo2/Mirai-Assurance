import React, { useEffect, useState } from "react";
import API, { API_ORIGIN } from "../api";

const AdminDashboard = () => {
  const [applications, setApplications] = useState([]);
  const [claims, setClaims] = useState([]);

  // Fetch both Applications and Claims when the page loads
  useEffect(() => {
    API.get("/applications/admin/all")
      .then((res) => setApplications(res.data))
      .catch((err) => console.error("Error fetching applications:", err));

    API.get("/claims/admin/all")
      .then((res) => setClaims(res.data))
      .catch((err) => console.error("Error fetching claims:", err));
  }, []);

  // Update Application Status
  const updateStatus = async (id, newStatus) => {
    try {
      await API.put(`/applications/${id}/status`, { status: newStatus });
      setApplications(
        applications.map((app) =>
          app._id === id ? { ...app, status: newStatus } : app,
        ),
      );
    } catch (err) {
      alert("Failed to update status");
    }
  };

  // Update Claim Status
  const updateClaimStatus = async (id, newStatus) => {
    try {
      await API.put(`/claims/${id}/status`, { status: newStatus });
      setClaims(
        claims.map((c) => (c._id === id ? { ...c, status: newStatus } : c)),
      );
    } catch (err) {
      alert("Failed to update claim status");
    }
  };

  // Helper to format date as YYYY-MM-DD and Time as HH:MM
  const formatDateTime = (dateString) => {
    if (!dateString) return "—";
    const dateObj = new Date(dateString);
    if (isNaN(dateObj.getTime())) return "—";

    const ymd = dateObj.toISOString().split("T")[0];
    const hm = dateObj.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    return (
      <div className="flex flex-col">
        <span className="text-gray-800 font-bold">{ymd}</span>
        <span className="text-blue-500 text-[10px] font-black">{hm}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-blue-100 p-6">
      <div className="max-w-7xl mx-auto bg-gray-50 rounded-3xl shadow-xl p-8">
        <h1 className="text-3xl font-black italic text-gray-800 border-b-2 border-blue-200 pb-4 mb-8 uppercase tracking-tighter">
          Admin Control Panel
        </h1>

        {/* --- TABLE 1: INSURANCE APPLICATIONS --- */}
        <div className="mb-12">
          <h2 className="text-xl font-bold mb-4 text-blue-900 uppercase italic">
            Plan Applications
          </h2>
          <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100">
            <table className="min-w-full text-left">
              <thead className="bg-blue-50 border-b">
                <tr>
                  <th className="p-4 font-black text-blue-900 uppercase text-xs">
                    Customer
                  </th>
                  <th className="p-4 font-black text-blue-900 uppercase text-xs">
                    Plan
                  </th>
                  <th className="p-4 font-black text-blue-900 uppercase text-xs">
                    Medical Review
                  </th>
                  <th className="p-4 font-black text-blue-900 uppercase text-xs">
                    Payment
                  </th>
                  <th className="p-4 font-black text-blue-900 uppercase text-xs">
                    Paid Date & Time
                  </th>
                  <th className="p-4 font-black text-blue-900 uppercase text-xs">
                    Status
                  </th>
                  <th className="p-4 font-black text-blue-900 uppercase text-xs text-center">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr
                    key={app._id}
                    className="border-b hover:bg-blue-50/50 transition-colors"
                  >
                    <td className="p-4 text-sm">{app.user?.name || "User"}</td>
                    <td className="p-4 font-bold text-gray-700 text-sm">
                      {app.plan?.title}
                    </td>
                    <td className="p-4 text-xs text-gray-600">
                      <p>
                        <b>Age:</b> {app.applicantAge ?? "Not provided"}
                      </p>
                      <p className="mt-1">
                        <b>Conditions:</b>{" "}
                        {Object.entries(app.healthDeclaration || {})
                          .filter(([, value]) => value)
                          .map(([key]) => key.replace(/([A-Z])/g, " $1"))
                          .join(", ") || "None declared"}
                      </p>
                      {app.medicalClearanceDocument && (
                        <a
                          href={`${API_ORIGIN}${app.medicalClearanceDocument}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block font-bold text-blue-600 underline"
                        >
                          VIEW CLEARANCE
                        </a>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded-full text-[10px] font-black tracking-widest ${app.paymentStatus === "paid" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                      >
                        {app.paymentStatus.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 text-sm uppercase">
                      {app.paymentStatus === "paid"
                        ? formatDateTime(app.paymentDate)
                        : "—"}
                    </td>
                    <td
                      className={`p-4 font-black text-xs uppercase ${app.status === "approved" ? "text-green-600" : "text-blue-600"}`}
                    >
                      {app.status}
                    </td>
                    <td className="p-4 text-center space-x-2">
                      {/* Only show Approve if the status is NOT approved */}
                      {app.status !== "approved" && (
                        <button
                          onClick={() => updateStatus(app._id, "approved")}
                          className="bg-green-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold hover:bg-green-700 transition uppercase"
                        >
                          Approve
                        </button>
                      )}
                      <button
                        onClick={() => updateStatus(app._id, "rejected")}
                        className="bg-red-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold hover:bg-red-700 transition uppercase"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* --- TABLE 2: FILED CLAIMS --- */}
        <div>
          <h2 className="text-xl font-bold mb-4 text-red-900 uppercase italic">
            Hospital Claims
          </h2>
          <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100">
            <table className="min-w-full text-left">
              <thead className="bg-red-50 border-b">
                <tr>
                  <th className="p-4 font-black text-red-900 uppercase text-xs">
                    Customer
                  </th>
                  <th className="p-4 font-black text-red-900 uppercase text-xs">
                    Amount
                  </th>
                  <th className="p-4 font-black text-red-900 uppercase text-xs">
                    Bill
                  </th>
                  <th className="p-4 font-black text-red-900 uppercase text-xs">
                    Status
                  </th>
                  <th className="p-4 font-black text-red-900 uppercase text-xs text-center">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {claims.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="p-8 text-center text-gray-400 font-bold uppercase italic"
                    >
                      No claims filed yet.
                    </td>
                  </tr>
                ) : (
                  claims.map((claim) => (
                    <tr
                      key={claim._id}
                      className="border-t hover:bg-red-50/50 transition-colors"
                    >
                      <td className="p-4 text-sm">{claim.user?.name}</td>
                      <td className="p-4 font-black text-red-600 text-sm">
                        ₹{claim.amount}
                      </td>
                      <td className="p-4">
                        <a
                          href={`${API_ORIGIN}/${claim.documents?.[0]?.replace(/\\/g, "/")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-500 underline text-xs font-bold"
                        >
                          {claim.documents?.[0] ? "VIEW BILL" : "NO FILE"}
                        </a>
                      </td>
                      <td
                        className={`p-4 uppercase text-[10px] font-black ${claim.status === "approved" ? "text-green-600" : "text-gray-600"}`}
                      >
                        {claim.status}
                      </td>
                      <td className="p-4 text-center space-x-2">
                        {/* Only show Approve if the claim is NOT approved */}
                        {claim.status !== "approved" && (
                          <button
                            onClick={() =>
                              updateClaimStatus(claim._id, "approved")
                            }
                            className="bg-green-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold hover:bg-green-700 transition uppercase"
                          >
                            Approve
                          </button>
                        )}
                        <button
                          onClick={() =>
                            updateClaimStatus(claim._id, "rejected")
                          }
                          className="bg-red-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold hover:bg-red-700 transition uppercase"
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

// import React, { useEffect, useState } from 'react';
// import API from '../api';

// const AdminDashboard = () => {
//   const [applications, setApplications] = useState([]);
//   const [claims, setClaims] = useState([]);

//   // Fetch both Applications and Claims when the page loads
//   useEffect(() => {
//     API.get('/applications/admin/all').then(res => setApplications(res.data));
//     API.get('/claims/admin/all').then(res => setClaims(res.data));
//   }, []);

//   // Update Application Status
//   const updateStatus = async (id, newStatus) => {
//     try {
//       await API.put(`/applications/${id}/status`, { status: newStatus });
//       setApplications(applications.map(app => app._id === id ? { ...app, status: newStatus } : app));
//     } catch (err) {
//       alert("Failed to update status");
//     }
//   };

//   // Update Claim Status
//   const updateClaimStatus = async (id, newStatus) => {
//     try {
//       await API.put(`/claims/${id}/status`, { status: newStatus });
//       setClaims(claims.map(c => c._id === id ? { ...c, status: newStatus } : c));
//     } catch (err) {
//       alert("Failed to update claim status");
//     }
//   };

//   return (
//             <div className="flex items-center justify-center h-screen bg-blue-100 p-1 overflow-hidden">

//     <div className="p-8 bg-gray-50 min-h-screen">
//       <h1 className="text-3xl font-bold mb-8 text-gray-800 border-b pb-4">Admin Control Panel</h1>

//       {/* --- TABLE 1: INSURANCE APPLICATIONS --- */}
//       <div className="mb-12">
//         <h2 className="text-xl font-semibold mb-4 text-blue-900">Plan Applications</h2>
//         <div className="bg-white rounded-lg shadow overflow-hidden">
//           <table className="min-w-full text-left">
//             <thead className="bg-gray-100 border-b">
//               <tr>
//                 <th className="p-4">Customer</th>
//                 <th className="p-4">Plan</th>
//                 <th className="p-4">Payment</th>
//                 <th className="p-4">Status</th>
//                 <th className="p-4 text-center">Actions</th>
//               </tr>
//             </thead>
//             <tbody>
//               {applications.map(app => (
//                 <tr key={app._id} className="border-b hover:bg-gray-50">
//                   <td className="p-4">{app.user?.name || "User"}</td>
//                   <td className="p-4 font-medium">{app.plan?.title}</td>
//                   <td className="p-4">
//                     <span className={`px-2 py-1 rounded text-xs font-bold ${app.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
//                       {app.paymentStatus.toUpperCase()}
//                     </span>
//                   </td>
//                   <td className="p-4 font-semibold text-blue-600 uppercase text-sm">{app.status}</td>
//                   <td className="p-4 text-center space-x-2">
//                     <button onClick={() => updateStatus(app._id, 'approved')} className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">Approve</button>
//                     <button onClick={() => updateStatus(app._id, 'rejected')} className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700">Reject</button>
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//       </div>

//       {/* --- TABLE 2: FILED CLAIMS --- */}
//       <div>
//         <h2 className="text-xl font-semibold mb-4 text-red-900">Hospital Claims</h2>
//         <div className="bg-white rounded-lg shadow overflow-hidden">
//           <table className="min-w-full text-left">
//             <thead className="bg-gray-100 border-b">
//               <tr>
//                 <th className="p-4">Customer</th>
//                 <th className="p-4">Amount</th>
//                 <th className="p-4">Bill/Proof</th>
//                 <th className="p-4">Status</th>
//                 <th className="p-4 text-center">Actions</th>
//               </tr>
//             </thead>
//             <tbody>
//               {claims.length === 0 ? <tr><td colSpan="5" className="p-4 text-center text-gray-500">No claims filed yet.</td></tr> : claims.map(claim => (
//                 <tr key={claim._id} className="border-t hover:bg-gray-50">
//                   <td className="p-4">{claim.user?.name}</td>
//                   <td className="p-4 font-bold text-red-600">₹{claim.amount}</td>
//                   <td className="p-4">
//       target="_blank"
//       rel="noreferrer"
//   className="text-blue-500 underline font-medium"
// >
//   {claim.documents?.[0] ? "View Bill" : "No File"}
// </a>
//                   </td>
//                   <td className="p-4 uppercase text-xs font-bold">{claim.status}</td>
//                   <td className="p-4 text-center space-x-2">
//                     <button onClick={() => updateClaimStatus(claim._id, 'approved')} className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">Approve</button>
//                     <button onClick={() => updateClaimStatus(claim._id, 'rejected')} className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700">Reject</button>
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//       </div>
//     </div>
//     </div>
//   );
// };

// export default AdminDashboard;
