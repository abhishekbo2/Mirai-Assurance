import React, { useEffect, useState } from "react";
import API from "../api";
import PaymentButton from "../components/PaymentButton";

const MyPolicies = () => {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPolicies = async () => {
      try {
        const res = await API.get("/applications/my-policies");
        setPolicies(res.data);
      } catch (err) {
        console.error("Error fetching policies:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPolicies();
  }, []);

  if (loading)
    return <div className="p-8 text-center">Loading your policies...</div>;

  return (
    <div className="p-8 bg-blue-50 min-h-screen">
      <h2 className="text-4xl font-black  text-blue-900 mb-8 border-b-2 border-blue-200 pb-4  tracking-tighter">
        My Insurance Portfolio
      </h2>

      <div className="grid gap-6">
        {policies.length === 0 ? (
          <div className="p-10 bg-white rounded-3xl shadow text-center">
            <p className="text-gray-500 font-bold">
              You haven't applied for any plans yet.
            </p>
          </div>
        ) : (
          policies.map((app) => (
            <div
              key={app._id}
              className="p-8 bg-white border-none rounded-3xl shadow-lg flex justify-between items-center hover:shadow-xl transition-all duration-300 border-l-8 border-blue-600"
            >
              <div className="space-y-2">
                {/* Plan Title */}
                <h3 className="font-black text-2xl text-blue-900  uppercase leading-tight">
                  {app.plan?.title || "Plan Details Missing"}
                </h3>

                {/* NEW: Category and Coverage Details */}
                <div className="flex gap-4 items-center">
                  <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase">
                    {app.plan?.category || "General"}
                  </span>
                  <span className="text-gray-500 text-sm font-semibold">
                    Coverage:{" "}
                    <span className="text-gray-800">
                      ₹{app.plan?.coverage?.toLocaleString("en-IN")}
                    </span>
                  </span>
                </div>

                {/* Status Badge */}
                <p
                  className={`mt-3 inline-block px-4 py-1 rounded-full text-xs font-black tracking-widest ${
                    app.paymentStatus === "paid"
                      ? "bg-green-100 text-green-700"
                      : "bg-orange-100 text-orange-700"
                  }`}
                >
                  STATUS: {app.paymentStatus.toUpperCase()}
                </p>
              </div>

              <div className="text-right">
                {/* Updated to use .premium as per your database screenshot */}
                <p className="text-3xl font-black text-blue-700 mb-4 tracking-tighter">
                  ₹{app.plan?.premium || app.plan?.basePremium || "0"}
                </p>

                {app.paymentStatus === "unpaid" &&
                  app.status === "approved" && (
                    <PaymentButton
                      applicationId={app._id}
                      amount={app.plan?.premium || app.plan?.basePremium}
                    />
                  )}
                {app.paymentStatus === "unpaid" &&
                  app.status !== "approved" && (
                    <p className="max-w-40 text-xs font-bold text-orange-600">
                      Payment will be available after admin approval.
                    </p>
                  )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

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
