import { NavLink, Outlet } from "react-router";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/", label: "Parking" },
  { to: "/reservations", label: "Reservations" },
  { to: "/vehicles", label: "Vehicles" },
  { to: "/history", label: "History" },
];

export default function RootLayout() {
  const { user, logout } = useAuth();

  return (
    <>
      <header className="site-header">
        <span className="site-header__title">GaŤe Parking</span>
        {user && (
          <nav aria-label="Main" className="main-nav">
            <ul className="main-nav__list">
              {navItems.map(({ to, label }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === "/"}
                    className={({ isActive }) =>
                      "main-nav__link" +
                      (isActive ? " main-nav__link--active" : "")
                    }
                  >
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div className="site-header__user">
          {user ? (
            <>
              <span className="site-header__name">{user.name}</span>
              <button
                type="button"
                className="site-header__logout"
                onClick={logout}
              >
                Sign out
              </button>
            </>
          ) : (
            <NavLink to="/login" className="main-nav__link">
              Sign in
            </NavLink>
          )}
        </div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
    </>
  );
}
