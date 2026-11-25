import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import Icon, { type IconName } from "../components/Icon";
import { useAuth } from "../context/AuthContext";

type Tab = { to: string; label: string; icon: IconName; end?: boolean };

const adminLinks = [
  { to: "/admin/employees", label: "Employees" },
  { to: "/admin/spots", label: "Spots" },
  { to: "/admin/activity-history", label: "Activity History" },
];

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function Brand({ to }: { to: string }) {
  return (
    <Link className="brand" to={to}>
      <span className="brand-mark" aria-hidden="true">
        P
      </span>
      GaŤe Parking
    </Link>
  );
}

export default function RootLayout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  // The menu belongs to the page it was opened on, so navigating closes it.
  const [menuAt, setMenuAt] = useState<string | null>(null);
  const menuOpen = menuAt === pathname;
  const setMenuOpen = (open: boolean) => setMenuAt(open ? pathname : null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the account menu on Escape and on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuAt(null);
    };
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuAt(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [menuOpen]);

  // Sign-in and activation are full-screen cards with their own brand.
  const isAuthScreen = pathname === "/login" || pathname === "/activate";
  const isAdmin = user?.role === "admin";
  const inAdmin = pathname.startsWith("/admin");

  const tabs: Tab[] = [
    { to: "/", label: "Home", icon: "home", end: true },
    { to: "/book", label: "Book", icon: "plus" },
    { to: "/reservations", label: "My bookings", icon: "cal" },
    { to: "/vehicles", label: "Vehicles", icon: "car" },
    ...(isAdmin
      ? [
          {
            to: "/admin/employees",
            label: "Admin",
            icon: "shield" as IconName,
          },
        ]
      : []),
  ];
  // The Admin tab stays highlighted on every /admin/* page.
  const isTabOn = (tab: Tab, isActive: boolean) =>
    tab.label === "Admin" ? inAdmin : isActive;

  return (
    <>
      {!isAuthScreen && (
        <header className="top">
          <div className="top-in">
            <Brand to="/" />
            {user ? (
              <>
                <nav className="tabs" aria-label="Main">
                  {tabs.map((tab) => (
                    <NavLink
                      key={tab.to}
                      to={tab.to}
                      end={tab.end}
                      className={({ isActive }) =>
                        isTabOn(tab, isActive) ? "on" : ""
                      }
                    >
                      {tab.label}
                    </NavLink>
                  ))}
                </nav>
                <div className="top-right" ref={menuRef}>
                  <NavLink
                    to="/notifications"
                    className={({ isActive }) => `bell ${isActive ? "on" : ""}`}
                    aria-label="Notifications"
                  >
                    <Icon name="bell" />
                  </NavLink>
                  <button
                    type="button"
                    className="me-btn"
                    aria-label="Account"
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                    onClick={() => setMenuOpen(!menuOpen)}
                  >
                    <span className="avatar">{initials(user.name)}</span>
                  </button>
                  {menuOpen && (
                    <div className="menu" role="menu">
                      <div className="menu-head">
                        <b>{user.name}</b>
                        <div className="faint small">{user.email}</div>
                      </div>
                      <Link to="/history" role="menuitem">
                        <Icon name="cal" small />
                        History
                      </Link>
                      <button type="button" role="menuitem" onClick={logout}>
                        <Icon name="out" small />
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="top-right">
                <Link className="btn btn-ghost btn-sm" to="/login">
                  Sign in
                </Link>
              </div>
            )}
          </div>
        </header>
      )}
      {user && isAdmin && inAdmin && (
        <div className="subnav">
          <nav className="seg" aria-label="Admin">
            {adminLinks.map(({ to, label }) => (
              <NavLink key={to} to={to}>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
      <main>
        <Outlet />
      </main>
      {user && !isAuthScreen && (
        <nav className="bottom-tabs" aria-label="Main, mobile">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => (isTabOn(tab, isActive) ? "on" : "")}
            >
              <Icon name={tab.icon} />
              <span>{tab.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </>
  );
}
