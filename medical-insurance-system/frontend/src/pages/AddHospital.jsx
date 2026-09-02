import React, { useState, useEffect } from "react";
import API from "../api";

const AddHospital = () => {
  const [formData, setFormData] = useState({
    name: "",
    city: "",
    address: "",
    contact: "",
    isNetwork: false,
    lat: "",
    lng: "",
  });
  const [hospitals, setHospitals] = useState([]);
  const [message, setMessage] = useState("");

  // Fetch all existing hospitals from the database
  const fetchHospitals = async () => {
    try {
      const res = await API.get("/hospitals");
      setHospitals(res.data);
    } catch (err) {
      console.error("Error fetching hospitals", err);
    }
  };

  useEffect(() => {
    fetchHospitals();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const hospitalData = {
        ...formData,
        location: { lat: Number(formData.lat), lng: Number(formData.lng) },
      };

      await API.post("/hospitals/add", hospitalData);
      setMessage("Hospital Added Successfully!");
      setFormData({
        name: "",
        city: "",
        address: "",
        contact: "",
        isNetwork: false,
        lat: "",
        lng: "",
      });
      fetchHospitals(); // Refresh the list normally
    } catch (err) {
      setMessage("Error adding hospital. Check console.");
    }
  };

  return (
    // Style: Full-screen centered blue background
    <div className="flex flex-col items-center justify-center min-h-screen p-1 bg-blue-100">
      {/* THE FORM CARD */}
      <div className="w-full max-w-2xl bg-white p-8 rounded-3xl shadow-xl mt-10">
        <h2 className="text-3xl font-black text-blue-900 mb-6">
          Manage Network Hospitals
        </h2>

        {message && (
          <p className="mb-4 p-3 bg-blue-50 text-red-700 font-bold rounded-xl text-center">
            {message}
          </p>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <input
            className="col-span-2 p-3 border-2 rounded-xl"
            placeholder="Hospital Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <input
            className="p-3 border-2 rounded-xl"
            placeholder="City"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            required
          />
          <input
            className="p-3 border-2 rounded-xl"
            placeholder="Contact Number"
            value={formData.contact}
            onChange={(e) =>
              setFormData({ ...formData, contact: e.target.value })
            }
          />
          <input
            className="col-span-2 p-3 border-2 rounded-xl"
            placeholder="Full Address"
            value={formData.address}
            onChange={(e) =>
              setFormData({ ...formData, address: e.target.value })
            }
            required
          />

          <div className="p-3 border-2 rounded-xl flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isNetwork}
              onChange={(e) =>
                setFormData({ ...formData, isNetwork: e.target.checked })
              }
            />
            <label className="font-bold text-gray-600 uppercase text-xs">
              Is Network Hospital?
            </label>
          </div>

          <div className="flex gap-2 col-span-2">
            <input
              className="w-1/2 p-3 border-2 rounded-xl"
              placeholder="Latitude"
              value={formData.lat}
              onChange={(e) =>
                setFormData({ ...formData, lat: e.target.value })
              }
              required
            />
            <input
              className="w-1/2 p-3 border-2 rounded-xl"
              placeholder="Longitude"
              value={formData.lng}
              onChange={(e) =>
                setFormData({ ...formData, lng: e.target.value })
              }
              required
            />
          </div>

          <button
            type="submit"
            className="col-span-2 bg-blue-600 text-white font-black p-4 rounded-xl uppercase hover:bg-blue-700 transition-all shadow-lg"
          >
            Add to Network
          </button>
        </form>
      </div>

      {/* HOSPITAL LIST (Listed normally at the bottom) */}
      <div className="w-full max-w-2xl mt-8 pb-10">
        <h3 className="text-xl font-black text-blue-900 mb-4  ">
          Existing Network
        </h3>
        <div className="space-y-4">
          {hospitals.map((h) => (
            <div
              key={h._id}
              className="flex justify-between items-center p-5 bg-white rounded-2xl shadow-md border-l-1 "
            >
              <div>
                <p className="font-black text-blue-900 uppercase">{h.name}</p>
                <p className="text-xs font-bold text-gray-500">
                  {h.city} | {h.contact || "No Contact Provided"}
                </p>
              </div>
              <div className="text-right">
                {h.isNetwork ? (
                  <span className="px-3 py-1 bg-green-100 text-green-700 font-black rounded-lg text-xs uppercase">
                    Network
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-red-100 text-red-700 font-black rounded-lg text-xs uppercase">
                    Not in Network
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AddHospital;
