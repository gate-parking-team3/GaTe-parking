import { NavLink, Outlet } from "react-router";

const navItems = [
  { to: "/", label: "Parking" },
  { to: "/reservations", label: "Reservations" },
  { to: "/vehicles", label: "Vehicles" },
  { to: "/history", label: "History" },
];

export default function RootLayout() {
  return (
    <>
      <header className="site-header">
        <span className="site-header__title">GaŤe Parking</span>
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
      </header>
      <main className="main-content">
        <Outlet />
      </main>
    </>
  );
}
