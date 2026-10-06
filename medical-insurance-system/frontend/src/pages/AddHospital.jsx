import React, { useState, useEffect } from "react";
import { Edit3, RotateCcw, Trash2 } from "lucide-react";
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
  const [editingHospital, setEditingHospital] = useState(null);
  const [message, setMessage] = useState("");

  // Fetch all existing hospitals from the database
  const fetchHospitals = async () => {
    try {
      const res = await API.get("/hospitals/admin/all");
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

      if (editingHospital) {
        await API.put(`/hospitals/${editingHospital._id}`, hospitalData);
        setMessage("Hospital Updated Successfully!");
      } else {
        await API.post("/hospitals/add", hospitalData);
        setMessage("Hospital Added Successfully!");
      }
      setFormData({
        name: "",
        city: "",
        address: "",
        contact: "",
        isNetwork: false,
        lat: "",
        lng: "",
      });
      setEditingHospital(null);
      fetchHospitals(); // Refresh the list normally
    } catch {
      setMessage("Error adding hospital. Check console.");
    }
  };

  const beginEdit = (hospital) => {
    setEditingHospital(hospital);
    setFormData({
      name: hospital.name || "",
      city: hospital.city || "",
      address: hospital.address || "",
      contact: hospital.contact || "",
      isNetwork: Boolean(hospital.isNetwork),
      lat: hospital.location?.lat ?? "",
      lng: hospital.location?.lng ?? "",
    });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingHospital(null);
    setFormData({ name: "", city: "", address: "", contact: "", isNetwork: false, lat: "", lng: "" });
    setMessage("");
  };

  const setHospitalActive = async (hospital) => {
    const nextState = !hospital.isActive;
    if (!nextState && !window.confirm("Are you sure you want to remove this hospital from availability? Existing claims will not be affected.")) return;

    try {
      await API.patch(`/hospitals/${hospital._id}/status`, { isActive: nextState });
      setMessage(nextState ? "Hospital Restored Successfully!" : "Hospital Removed From Availability!");
      fetchHospitals();
    } catch (err) {
      setMessage(err.response?.data?.msg || "Unable to update hospital status.");
    }
  };

  return (
    // Style: Full-screen centered blue background
    <div className="flex flex-col items-center justify-center min-h-screen p-1 bg-blue-100">
      {/* THE FORM CARD */}
      <div className="w-full max-w-2xl bg-white p-8 rounded-3xl shadow-xl mt-10">
        <h2 className="text-3xl font-black text-blue-900 mb-6">
          {editingHospital ? `Edit ${editingHospital.name}` : "Manage Network Hospitals"}
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
            {editingHospital ? "Save Hospital Changes" : "Add to Network"}
          </button>
          {editingHospital && (
            <button type="button" onClick={cancelEdit} className="col-span-2 rounded-xl border border-blue-200 p-3 font-bold text-blue-900 hover:bg-blue-50">
              Cancel Edit
            </button>
          )}
        </form>
      </div>

      {/* HOSPITAL LIST (Listed normally at the bottom) */}
      <div className="w-full max-w-2xl mt-8 pb-10">
        <h3 className="text-xl font-black text-blue-900 mb-4">
          Hospital Management
        </h3>
        <div className="space-y-4">
          {hospitals.map((h) => (
            <div
              key={h._id}
              className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-md sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-black text-blue-900 uppercase">{h.name}</p>
                <p className="text-xs font-bold text-gray-500">
                  {h.city} | {h.contact || "No Contact Provided"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {h.isNetwork ? (
                    <span className="rounded-lg bg-green-100 px-3 py-1 text-xs font-black uppercase text-green-700">
                      Network
                    </span>
                  ) : (
                    <span className="rounded-lg bg-red-100 px-3 py-1 text-xs font-black uppercase text-red-700">
                      Not in Network
                    </span>
                  )}
                  <span className={`rounded-lg px-3 py-1 text-xs font-black uppercase ${h.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {h.isActive ? "Active" : "Removed"}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 gap-2 sm:justify-end">
                <button type="button" onClick={() => beginEdit(h)} className="flex items-center gap-1 rounded-lg bg-blue-100 px-2 py-2 text-xs font-black uppercase text-blue-800 hover:bg-blue-200">
                  <Edit3 size={14} /> Edit
                </button>
                <button type="button" onClick={() => setHospitalActive(h)} className={`flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-black uppercase ${h.isActive ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-green-100 text-green-700 hover:bg-green-200"}`}>
                  {h.isActive ? <Trash2 size={14} /> : <RotateCcw size={14} />}
                  {h.isActive ? "Remove" : "Restore"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AddHospital;
