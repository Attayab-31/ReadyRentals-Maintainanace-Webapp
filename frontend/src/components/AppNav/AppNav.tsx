import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { clearStoredToken } from "../../api/client";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useTheme } from "../../hooks/useTheme";
import styles from "./AppNav.module.css";

export function AppNav({
  title,
  home,
  showLogout,
}: {
  title: string;
  home: string;
  showLogout?: boolean;
}) {
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const currentUser = useCurrentUser();
  const isOwner = currentUser.data?.role === "owner";
  const location = useLocation();

  const getBreadcrumb = (pathname: string, defaultTitle: string) => {
    if (pathname === "/dashboard" || pathname === "/") {
      return { parent: defaultTitle, current: null };
    }
    if (pathname === "/work-orders/new") {
      return { parent: defaultTitle, current: "New" };
    }
    if (pathname.startsWith("/work-orders/")) {
      return { parent: defaultTitle, current: "Details" };
    }
    if (pathname.startsWith("/settings/categories")) {
      return { parent: "Settings", current: "Categories" };
    }
    if (pathname.startsWith("/settings/admins")) {
      return { parent: "Settings", current: "Admins" };
    }
    if (pathname.startsWith("/audit-logs")) {
      return { parent: defaultTitle, current: "Audit Log" };
    }
    return { parent: defaultTitle, current: null };
  };

  const breadcrumb = getBreadcrumb(location.pathname, title);

  // Close menu on Escape key
  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header className={`${styles.nav} no-print`}>
      <div className={styles.brandRow}>
        <div className={styles.breadcrumbWrap}>
          <Link className={styles.brand} to={home} onClick={() => setMenuOpen(false)}>
            <span className={styles.logoMark} aria-hidden="true">
              RR
            </span>
            <span className={styles.brandText}>{breadcrumb.parent}</span>
          </Link>
          {breadcrumb.current ? (
            <span className={styles.mobileBreadcrumb}>
              <span className={styles.breadcrumbDivider} aria-hidden="true">
                /
              </span>
              <span className={styles.breadcrumbCurrent}>{breadcrumb.current}</span>
            </span>
          ) : null}
        </div>
        {showLogout && currentUser.data ? (
          <span className={styles.userBadge} title={`${currentUser.data.name} (${currentUser.data.role})`}>
            <span className={styles.userName}>{currentUser.data.name}</span>
            <span className={styles.userRole}>({currentUser.data.role})</span>
          </span>
        ) : null}
      </div>

      {/* Desktop Navigation Links */}
      {showLogout ? (
        <nav className={styles.desktopLinks} aria-label="Main Navigation">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/work-orders/new"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`
            }
          >
            New work order
          </NavLink>
          <NavLink
            to="/settings/categories"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`
            }
          >
            Categories
          </NavLink>
          {isOwner ? (
            <>
              <NavLink
                to="/settings/admins"
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`
                }
              >
                Admins
              </NavLink>
              <NavLink
                to="/audit-logs"
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`
                }
              >
                Audit Log
              </NavLink>
            </>
          ) : null}
        </nav>
      ) : null}

      {/* Header Utilities */}
      <div className={styles.headerUtils}>
        <button
          type="button"
          className={`btn ${styles.themeButton} theme-toggle`}
          onClick={toggle}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? (
            <svg
              className={styles.themeIcon}
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg
              className={styles.themeIcon}
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {showLogout ? (
          <>
            <button
              type="button"
              className={`btn ${styles.desktopLogout}`}
              onClick={() => {
                clearStoredToken();
                window.location.assign("/login");
              }}
            >
              Log out
            </button>
            <button
              type="button"
              className={`btn ${styles.menuButton}`}
              aria-label={menuOpen ? "Close menu" : "Open navigation menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className={styles.menuIcon} aria-hidden="true">
                {menuOpen ? "✕" : "☰"}
              </span>
              <span>{menuOpen ? "Close" : "Menu"}</span>
            </button>
          </>
        ) : null}
      </div>

      {/* Mobile Drawer Menu & Backdrop */}
      {showLogout && menuOpen ? (
        <>
          <div
            className={styles.backdrop}
            role="presentation"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className={styles.mobileMenu} role="dialog" aria-modal="true" aria-label="Mobile Navigation">
            <div className={styles.mobileMenuHeader}>
              <div className={styles.mobileUser}>
                {currentUser.data ? (
                  <>
                    <strong>{currentUser.data.name}</strong>
                    <span className={styles.userRoleTag}>{currentUser.data.role}</span>
                  </>
                ) : null}
              </div>
              <button
                type="button"
                className={styles.mobileCloseBtn}
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            <nav className={styles.mobileNavLinks}>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `${styles.mobileNavLink} ${isActive ? styles.mobileNavLinkActive : ""}`
                }
                onClick={() => setMenuOpen(false)}
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/work-orders/new"
                className={({ isActive }) =>
                  `${styles.mobileNavLink} ${isActive ? styles.mobileNavLinkActive : ""}`
                }
                onClick={() => setMenuOpen(false)}
              >
                New work order
              </NavLink>
              <NavLink
                to="/settings/categories"
                className={({ isActive }) =>
                  `${styles.mobileNavLink} ${isActive ? styles.mobileNavLinkActive : ""}`
                }
                onClick={() => setMenuOpen(false)}
              >
                Categories
              </NavLink>
              {isOwner ? (
                <>
                  <NavLink
                    to="/settings/admins"
                    className={({ isActive }) =>
                      `${styles.mobileNavLink} ${isActive ? styles.mobileNavLinkActive : ""}`
                    }
                    onClick={() => setMenuOpen(false)}
                  >
                    Admins
                  </NavLink>
                  <NavLink
                    to="/audit-logs"
                    className={({ isActive }) =>
                      `${styles.mobileNavLink} ${isActive ? styles.mobileNavLinkActive : ""}`
                    }
                    onClick={() => setMenuOpen(false)}
                  >
                    Audit Log
                  </NavLink>
                </>
              ) : null}
            </nav>

            <div className={styles.mobileMenuFooter}>
              <button
                type="button"
                className={`btn ${styles.mobileThemeBtn} theme-toggle`}
                onClick={toggle}
              >
                {theme === "dark" ? (
                  <>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                    <span>Switch to Light mode</span>
                  </>
                ) : (
                  <>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                    <span>Switch to Dark mode</span>
                  </>
                )}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ width: "100%" }}
                onClick={() => {
                  clearStoredToken();
                  window.location.assign("/login");
                }}
              >
                Log out
              </button>
            </div>
          </div>
        </>
      ) : null}
    </header>
  );
}
