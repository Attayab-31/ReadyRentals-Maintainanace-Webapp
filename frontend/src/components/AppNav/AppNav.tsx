import { useState } from "react";
import { Link } from "react-router-dom";
import { clearStoredToken } from "../../api/client";
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

    return (
        <header className={`${styles.nav} no-print`}>
            <Link className={styles.brand} to={home}>
                {title}
            </Link>
            {showLogout ? (
                <button
                    type="button"
                    className={`btn ${styles.menuButton}`}
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((open) => !open)}
                >
                    {menuOpen ? "Close" : "Menu"}
                </button>
            ) : null}
            <div className={`${styles.actions} ${menuOpen ? styles.open : ""}`}>
                {showLogout ? (
                    <>
                        <Link className="btn" to="/dashboard" onClick={() => setMenuOpen(false)}>
                            Dashboard
                        </Link>
                        <Link className="btn" to="/work-orders/new" onClick={() => setMenuOpen(false)}>
                            New work order
                        </Link>
                        <Link className="btn" to="/settings/categories" onClick={() => setMenuOpen(false)}>
                            Categories
                        </Link>
                    </>
                ) : null}
                <button type="button" className="btn theme-toggle" onClick={toggle}>
                    {theme === "dark" ? "Light" : "Dark"}
                </button>
                {showLogout ? (
                    <button
                        type="button"
                        className="btn"
                        onClick={() => {
                            clearStoredToken();
                            window.location.assign("/login");
                        }}
                    >
                        Log out
                    </button>
                ) : null}
            </div>
        </header>
    );
}
