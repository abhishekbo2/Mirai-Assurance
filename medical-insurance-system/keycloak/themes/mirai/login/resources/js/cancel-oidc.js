(() => {
  const entryCookieName = "miraiOidcEntry";
  const registrationCookieName = "miraiOidcRegistration";
  const allowedPaths = new Set(["/login", "/signin"]);
  const fallbackUrl = "http://localhost:5173/login";

  const getEntryUrl = () => {
    const cookie = document.cookie
      .split("; ")
      .find((item) => item.startsWith(`${entryCookieName}=`));

    if (!cookie) return fallbackUrl;

    try {
      const url = new URL(decodeURIComponent(cookie.split("=")[1]));
      const isTrustedLocalProject =
        url.protocol === "http:" &&
        url.hostname === "localhost" &&
        url.port === "5173" &&
        allowedPaths.has(url.pathname);

      return isTrustedLocalProject ? url.toString() : fallbackUrl;
    } catch {
      return fallbackUrl;
    }
  };

  const returnToMirai = () => {
    // Leaving Keycloak abandons the pending authorization transaction. No token
    // has been issued to Mirai Assurance at this point.
    document.cookie = `${registrationCookieName}=; Path=/; Max-Age=0; SameSite=Lax`;
    window.location.assign(getEntryUrl());
  };

  const markRegistrationIntent = () => {
    const secureAttribute = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${registrationCookieName}=1; Path=/; SameSite=Lax${secureAttribute}`;
  };

  const watchForRegistrationNavigation = () => {
    document.querySelectorAll("a[href]").forEach((link) => {
      const isRegistrationLink = /registration/i.test(link.href) || /register/i.test(link.textContent);
      if (isRegistrationLink) link.addEventListener("click", markRegistrationIntent, { once: true });
    });
  };

  const addCancelButton = () => {
    if (document.querySelector("[data-mirai-cancel]")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.miraiCancel = "true";
    button.setAttribute("aria-label", "Cancel and return to Mirai");
    button.textContent = "\u00d7";
    button.style.cssText = [
      "position:fixed",
      "top:18px",
      "right:18px",
      "z-index:9999",
      "width:42px",
      "height:42px",
      "border:0",
      "border-radius:50%",
      "background:#ffffff",
      "color:#1d4ed8",
      "font-size:30px",
      "line-height:1",
      "cursor:pointer",
      "box-shadow:0 4px 14px rgba(0,0,0,.25)",
    ].join(";");
    button.addEventListener("click", returnToMirai);
    document.body.appendChild(button);
    watchForRegistrationNavigation();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addCancelButton);
  } else {
    addCancelButton();
  }
})();
