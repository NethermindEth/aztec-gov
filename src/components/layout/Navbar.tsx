"use client";

import { useState } from "react";
import Link from "next/link";
import { WalletButton } from "@/components/ui/WalletButton";

type NavLink = "POSITIONS" | "GOVERNANCE" | "DOCS";

interface NavbarProps {
  activeLink?: NavLink;
}

const links: { label: NavLink; href: string; external?: boolean }[] = [
  { label: "POSITIONS", href: "https://stake.aztec.network/my-position", external: true },
  { label: "GOVERNANCE", href: "/" },
  { label: "DOCS", href: "https://docs.aztec.network/", external: true },
];

export function Navbar({ activeLink = "GOVERNANCE" }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header
        className="w-full border-b shrink-0 h-[60px] md:h-[80px]"
        style={{
          borderColor: "var(--border-default)",
          backgroundColor: "var(--background-primary)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 h-full">
          <div className="flex items-center justify-between h-full">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              {/* Mobile: text logo */}
              <span
                className="md:hidden text-lg font-medium tracking-wider"
                style={{ color: "var(--accent-primary)" }}
              >
                AZTEC
              </span>
              {/* Desktop: image logo */}
              <img
                className="hidden md:block"
                src="/aztec-logo.svg"
                alt="Aztec"
                height={32}
                width={125}
              />
            </Link>

            {/* Desktop nav links + wallet */}
            <nav className="hidden md:flex items-center space-x-6 lg:space-x-8">
              {links.map((link) => {
                const isActive = link.label === activeLink;
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className="text-sm font-medium tracking-wider uppercase transition-colors"
                    style={{
                      color: isActive
                        ? "var(--accent-primary)"
                        : "var(--text-secondary)",
                    }}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <WalletButton />
            </nav>

            {/* Mobile: hamburger + compact wallet */}
            <div className="flex md:hidden items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="flex flex-col gap-1 items-center justify-center w-6 h-6 cursor-pointer"
                aria-label="Toggle menu"
              >
                <span
                  className="block w-[18px] h-[2px] rounded-sm"
                  style={{ backgroundColor: "var(--text-primary)" }}
                />
                <span
                  className="block w-[18px] h-[2px] rounded-sm"
                  style={{ backgroundColor: "var(--text-primary)" }}
                />
                <span
                  className="block w-[18px] h-[2px] rounded-sm"
                  style={{ backgroundColor: "var(--text-primary)" }}
                />
              </button>
              <WalletButton />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div
          className="md:hidden border-b"
          style={{
            borderColor: "var(--border-default)",
            backgroundColor: "var(--background-primary)",
          }}
        >
          <nav className="flex flex-col max-w-7xl mx-auto px-4 py-3 gap-3">
            {links.map((link) => {
              const isActive = link.label === activeLink;
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sm font-medium tracking-wider uppercase py-2 transition-colors"
                  style={{
                    color: isActive
                      ? "var(--accent-primary)"
                      : "var(--text-secondary)",
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
