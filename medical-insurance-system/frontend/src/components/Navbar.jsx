import React, { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { User } from "lucide-react";
import logoImg from "../assets/logo.png";
import ProfileSidebar from "./ProfileSidebar";
import API from "../api";
import {
  getUserRole,
  isAuthenticated,
  isOidcRegistrationFlowActive,
} from "../auth/keycloak";

const Navbar = () => {
  const location = useLocation();
  const role = getUserRole();
  const authenticated = isAuthenticated();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/signin";
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [profileAccessReady, setProfileAccessReady] = useState(false);

  const profileImageUrl = profileImage || null;

  useEffect(() => {
    if (
      !authenticated ||
      isAuthPage ||
      isOidcRegistrationFlowActive()
    ) return;

    API.get("/auth/profile")
      .then((res) => {
        setProfileImage(res.data?.user?.profileImage || null);
        setProfileAccessReady(true);
      })
      .catch(() => {
        setProfileImage(null);
        setProfileAccessReady(false);
      });
  }, [authenticated, isAuthPage, location.pathname]);

  const navLinkClass = ({ isActive }) =>
    `rounded-lg px-3 py-2 font-medium transition-all duration-200 ${
      isActive
        ? "bg-white text-blue-600 shadow-sm"
        : "hover:bg-blue-400 hover:text-white"
    }`;

  return (
    <>
      {/* We wrap everything in a fragment or a div to include the white bar below the nav */}
      <div className="w-full">
        <nav className="flex items-center justify-between p-2 ps-10 pe-10 bg-blue-500 text-white shadow-lg relative z-20">
          {/* Brand Logo Section */}
          <div className="flex items-center space-x-3 group">
            <div className="bg-white h-10 w-10 flex items-center justify-center rounded-full shadow-sm overflow-hidden transition-shadow">
              <img
                src={logoImg}
                alt="Mirai Assurance logo"
                className="h-full w-full object-contain scale-[1.3] transform"
                onError={(e) => {
                  e.target.src = "https://via.placeholder.com/44?text=M";
                }}
              />
            </div>
            <span className="text-2xl font-bold tracking-tight">
              Mirai Assurance
            </span>
          </div>

          <div className="flex items-center space-x-6">
            {authenticated && !isAuthPage && role === "customer" && (
              <>
                <NavLink to="/customer-dashboard" className={navLinkClass}>
                  Plans
                </NavLink>
                <NavLink to="/file-claim" className={navLinkClass}>
                  File Claim
                </NavLink>
                <NavLink to="/my-claims" className={navLinkClass}>
                  My Claims
                </NavLink>
                <NavLink to="/hospitals" className={navLinkClass}>
                  Hospital Map
                </NavLink>
              </>
            )}

            {authenticated && !isAuthPage && role === "admin" && (
              <>
                <NavLink to="/admin-dashboard" className={navLinkClass}>
                  Control Panel
                </NavLink>
                <NavLink to="/add-hospital" className={navLinkClass}>
                  Manage Network
                </NavLink>
                <NavLink to="/add-plan" className={navLinkClass}>
                  Add Plans
                </NavLink>
              </>
            )}

            {profileAccessReady && !isAuthPage && (
              <button
                onClick={() => setIsProfileOpen(true)}
                className="h-10 w-10 overflow-hidden rounded-full bg-white text-blue-500 shadow-md transition-all duration-200 hover:bg-blue-100 active:scale-95"
                title="User Profile"
              >
                {profileImageUrl ? (
                  <img
                    src={profileImageUrl}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User size={24} className="mx-auto" />
                )}
              </button>
            )}
          </div>
        </nav>

        {/* THE WHITE BAR: This creates the separation seen in your screenshots */}
      </div>

      {/* Profile Sidebar */}
      <ProfileSidebar
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onProfileImageChange={setProfileImage}
      />
    </>
  );
};

export default Navbar;
