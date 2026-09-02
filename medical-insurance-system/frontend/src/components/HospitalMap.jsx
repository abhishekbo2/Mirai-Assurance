import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import API from "../api";

// Red Icon Definition
const redIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Green Icon Definition (for Network Hospitals)
const greenIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function HospitalMap() {
  const [hospitals, setHospitals] = useState([]);
  const geoapifyKey = import.meta.env.VITE_GEOAPIFY_KEY;

  useEffect(() => {
    API.get("/hospitals").then((res) => setHospitals(res.data));
  }, []);

  return (
    <div className="flex flex-col items-center min-h-[calc(100vh-80px)] bg-blue-100 p-8">
      <div className="w-full max-w-5xl p-6 bg-white shadow-2xl rounded-3xl">
        <div className="text-center mb-4">
          <h2 className="text-2xl font-black text-blue-800  tracking-tight">
            Hospitals Near to You
          </h2>
          <p className="text-sm text-gray-500">
            Locate InNetwork 🟢 Reimbursement 🔴{" "}
          </p>
        </div>

        <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-inner h-[450px] relative z-0">
          <MapContainer
            center={[12.9716, 77.5946]}
            zoom={11}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
          >
            {geoapifyKey && <TileLayer
              attribution='&copy; <a href="https://www.geoapify.com/">Geoapify</a>'
              url={`https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${geoapifyKey}`}
            />}

            {hospitals.map((hosp) => (
              <Marker
                key={hosp._id}
                position={[hosp.location.lat, hosp.location.lng]}
                // LOGIC: Use green icon if isNetwork is true, otherwise use red icon
                icon={hosp.isNetwork ? greenIcon : redIcon}
              >
                <Popup>
                  <div className="font-bold">{hosp.name}</div>
                  <div className="text-xs">
                    {hosp.isNetwork
                      ? "🟢 Cashless Facility"
                      : "🔴 Reimbursement Only"}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* ... Footer Legend ... */}
      </div>
    </div>
  );
}

export default HospitalMap;
