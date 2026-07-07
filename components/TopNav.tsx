// ===================== /components/TopNav.tsx =====================

"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isValidTicket } from "@/lib/validateTicket";

type NavItem = {
  href: string;
  label: string;
  isFundamental?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Trades",
    items: [
      { href: "/trades", label: "Real Trades" },
      { href: "/fake-trades", label: "Fake Trades" },
    ],
  },
  {
    label: "New",
    items: [
      { href: "/trades/new", label: "Real Trade" },
      { href: "/fake-trades/new", label: "Fake Trade" },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/checklist", label: "Checklist" },
      { href: "/calendar", label: "Calendar" },
      { href: "/whatif", label: "What If" },
      { href: "/journal", label: "Journal" },
      { href: "/charts", label: "Charts" },
      { href: "/fundamental", label: "News", isFundamental: true },
      { href: "/field-edits", label: "Field Edits" },
      { href: "/import", label: "Import" },
    ],
  },
];

export default function TopNav() {
  const [ticket, setTicket] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  function goSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = ticket.trim();
    if (!trimmed) return;

    if (!isValidTicket(trimmed)) {
      alert("Ticket inválido. Revisa el formato.");
      return;
    }

    router.push(`/trades/${encodeURIComponent(trimmed)}`);
  }

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  };

  const groupIsActive = (group: NavGroup) => {
    return group.items.some((item) => isActive(item.href));
  };

  const goTo = (href: string) => {
    setOpenMenu(null);
    router.push(href);
  };

  return (
    <nav
      style={{
        width: "100%",
        background: "#020617",
        borderBottom: "1px solid #111827",
        padding: "10px 0",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 16px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <button
          className="btn-nav"
          type="button"
          onClick={() => goTo("/")}
          style={{
            padding: "6px 12px",
            fontSize: 13,
            height: 32,
            borderRadius: 0,
            border: pathname === "/" ? "1px solid #1d4ed8" : "1px solid transparent",
            backgroundColor: pathname === "/" ? "#1d4ed8" : "transparent",
            color: pathname === "/" ? "#ffffff" : "inherit",
            fontWeight: pathname === "/" ? 600 : 400,
            whiteSpace: "nowrap",
          }}
        >
          Home
        </button>

        {NAV_GROUPS.map((group) => {
          const active = groupIsActive(group);
          const open = openMenu === group.label;

          return (
            <div
                key={group.label}
                style={{
                    position: "relative",
                    paddingBottom: 6,
            }}
            onMouseEnter={() => setOpenMenu(group.label)}
            onMouseLeave={() => setOpenMenu(null)}
            >
              <button
                className="btn-nav"
                type="button"
                onClick={() => setOpenMenu(open ? null : group.label)}
                style={{
                  padding: "6px 12px",
                  fontSize: 13,
                  height: 32,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  borderRadius: 0,
                  border: active ? "1px solid #1d4ed8" : "1px solid transparent",
                  backgroundColor: active ? "#1d4ed8" : "transparent",
                  color: active ? "#ffffff" : "inherit",
                  fontWeight: active ? 600 : 400,
                  whiteSpace: "nowrap",
                }}
              >
                {group.label}
                <span style={{ fontSize: 10, opacity: 0.8 }}>▾</span>
              </button>

              {open && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    minWidth: 170,
                    background: "#020617",
                    border: "1px solid #1f2937",
                    boxShadow: "0 14px 30px rgba(0,0,0,0.35)",
                    padding: 6,
                    zIndex: 100,
                  }}
                >
                  {group.items.map((item) => {
                    const itemActive = isActive(item.href);

                    return (
                      <button
                        key={item.href}
                        type="button"
                        onClick={() => goTo(item.href)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          textAlign: "left",
                          padding: "8px 10px",
                          fontSize: 13,
                          border: "1px solid transparent",
                          backgroundColor: item.isFundamental
                            ? "#da3c3c"
                            : itemActive
                            ? "#1d4ed8"
                            : "transparent",
                          color:
                            item.isFundamental || itemActive
                              ? "#ffffff"
                              : "#cbd5e1",
                          fontWeight:
                            item.isFundamental || itemActive ? 600 : 400,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                        onMouseEnter={(e) => {
                          if (!itemActive && !item.isFundamental) {
                            e.currentTarget.style.backgroundColor = "#111827";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!itemActive && !item.isFundamental) {
                            e.currentTarget.style.backgroundColor = "transparent";
                          }
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
