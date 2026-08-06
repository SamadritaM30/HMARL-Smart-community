"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/", label: "Simulator", icon: "SG" },
  { href: "/guide", label: "Paper Guide", icon: "PG" },
  { href: "/technical", label: "Formulas", icon: "FX" },
  { href: "/algorithm", label: "Algorithm", icon: "DQ" },
  { href: "/implementation", label: "Implementation", icon: "FS" },
  { href: "/results", label: "Results", icon: "RV" },
];

export default function SiteNav() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">("light");

  useEffect(() => {
    const stored = window.localStorage.getItem("hmarl-theme");
    const nextTheme = stored === "dark" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  useEffect(() => {
    document.body.classList.add("motion-intro");
    const timer = window.setTimeout(() => {
      document.body.classList.remove("motion-intro");
    }, 760);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("hmarl-theme", theme);
  }, [theme]);

  return (
    <nav className="top-nav" aria-label="Project navigation">
      <Link className="brand" href="/">
        <span className="brand-mark">H</span>
        <span>HMARL Smart Grid</span>
      </Link>
      <div className="nav-links">
        {links.map((link) => (
          <Link
            key={link.href}
            className={pathname === link.href ? "active-link" : ""}
            href={link.href}
          >
            <span>{link.icon}</span>
            {link.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
        >
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </div>
    </nav>
  );
}
