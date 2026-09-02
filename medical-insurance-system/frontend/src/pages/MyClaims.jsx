import React, { useEffect, useState } from "react";
import API from "../api";

const MyClaims = () => {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchClaims = async () => {
      try {
        const response = await API.get("/claims/my-claims");
        setClaims(response.data);
      } catch (err) {
        console.error("Error fetching claims", err);
        setError(
          "Failed to load claims. Please check if your backend is running on port 1234.",
        );
      } finally {
        setLoading(false);
      }
    };
    fetchClaims();
  }, []);

  if (loading)
    return <div className="p-8 text-center font-black italic">LOADING...</div>;

  return (
    <div className="min-h-screen bg-blue-100 p-8 flex justify-center">
      <div className="max-w-4xl w-full bg-gray-50 rounded-3xl shadow-2xl p-8">
        <h2 className="text-3xl font-black  text-blue-900 mb-8  tracking-tighter border-b-2 border-blue-200 pb-4">
          My Insurance Claims
        </h2>

        {error ? (
          <div className="bg-red-50 border-2 border-red-200 p-6 rounded-2xl text-red-700 font-bold text-center italic">
            {error}
          </div>
        ) : claims.length === 0 ? (
          <div className="bg-white p-16 rounded-3xl border-2 border-dashed border-gray-200 text-center shadow-inner">
            <p className="text-gray-400 font-black uppercase italic tracking-widest text-xl">
              No Claims Filed Yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {claims.map((claim) => (
              <div
                key={claim._id}
                className="bg-white p-6 rounded-2xl shadow-lg border-2 border-black-600 flex justify-between items-center"
              >
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Claim ID: {claim._id}
                  </p>
                  <h3 className="text-xl font-black text-gray-800 uppercase  leading-tight">
                    {claim.type} Claim
                  </h3>
                  <p className="text-2xl font-black text-blue-600">
                    ₹{claim.amount?.toLocaleString()}
                  </p>
                </div>

                <div className="text-right">
                  {/* Status displays with logic-based colors */}
                  <span
                    className={`px-6 py-1.5 rounded-full text-xs font-black uppercase tracking-tighter border-2 ${
                      claim.status === "approved"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : claim.status === "rejected"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-yellow-50 text-yellow-700 border-yellow-200"
                    }`}
                  >
                    {claim.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyClaims;
