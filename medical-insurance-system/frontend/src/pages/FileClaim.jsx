import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";

const FileClaim = () => {
  const [policies, setPolicies] = useState([]);
  const [formData, setFormData] = useState({
    applicationId: "",
    amount: "",
    hospitalName: "",
    type: "Cashless",
  });
  const [file, setFile] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPolicies = async () => {
      try {
        const res = await API.get("/applications/my-policies");
        // Only allow claims for approved policies
        const approved = res.data.filter((app) => app.status === "approved");
        setPolicies(approved);
      } catch (err) {
        console.error("Error fetching policies", err);
      }
    };
    fetchPolicies();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return alert("Please upload a bill");

    const data = new FormData();
    data.append("applicationId", formData.applicationId);
    data.append("amount", formData.amount);
    data.append("hospitalName", formData.hospitalName);
    data.append("type", formData.type);
    data.append("bill", file);

    try {
      await API.post("/claims/file", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Claim filed successfully!");
      navigate("/customer-dashboard");
    } catch (err) {
      alert("Error filing claim. Check if the file is too large.");
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-blue-100 p-1 overflow-hidden">
      <div className="max-w-2xl mx-auto mt-10 p-8 bg-white shadow-lg rounded-lg">
        <h2 className="text-2xl font-bold mb-6 text-blue-900 text-center">
          Submit a New Claim
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <select
            className="w-full p-2 border rounded"
            onChange={(e) =>
              setFormData({ ...formData, applicationId: e.target.value })
            }
            required
          >
            <option value="">Select Approved Policy</option>
            {policies.map((p) => (
              <option key={p._id} value={p._id}>
                {p.plan?.title}
              </option>
            ))}
          </select>

          <input
            type="number"
            placeholder="Claim Amount"
            className="w-full p-2 border rounded"
            onChange={(e) =>
              setFormData({ ...formData, amount: e.target.value })
            }
            required
          />

          <input
            type="text"
            placeholder="Hospital Name"
            className="w-full p-2 border rounded"
            onChange={(e) =>
              setFormData({ ...formData, hospitalName: e.target.value })
            }
            required
          />

          <div className="border-2 border-dashed p-4 text-center cursor-pointer hover:bg-gray-50">
            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
              required
            />
            <p className="text-xs text-gray-500 mt-2">
              Upload Bill (JPG/PNG/PDF)
            </p>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-800 text-white py-3 rounded-lg font-bold hover:bg-blue-900"
          >
            Submit Claim
          </button>
        </form>
      </div>
    </div>
  );
};

export default FileClaim; // This must match the name on Line 5!
