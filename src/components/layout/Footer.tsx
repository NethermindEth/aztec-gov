import Image from "next/image";

export function Footer() {
  return (
    <footer
      className="w-full border-t mt-auto"
      style={{ borderColor: "var(--border-default)" }}
    >
      {/* Main footer row */}
      <div className="flex flex-col md:flex-row items-center md:justify-between max-w-[1280px] mx-auto px-4 md:px-8 py-6 md:py-8 gap-4 md:gap-0">
        {/* Powered by Nethermind */}
        <a
          href="https://www.nethermind.io"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <span
            className="text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            Powered By
          </span>
          <Image
            src="/nethermind-logo.svg"
            alt="Nethermind"
            width={120}
            height={17}
          />
        </a>

        {/* Legal links */}
        <div
          className="flex flex-col md:flex-row items-center gap-3 md:gap-6 text-sm font-medium tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          <a
            href="https://aztec.network/staking-terms"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-80 transition-opacity"
          >
            Staking Terms &amp; Conditions
          </a>
          <a
            href="https://aztec.network/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-80 transition-opacity"
          >
            Terms of Service
          </a>
          <a
            href="https://aztec.network/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-80 transition-opacity"
          >
            Privacy Policy
          </a>
          <a
            href="https://aztec.network/disclaimer"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-80 transition-opacity"
          >
            Token Sale Disclamer
          </a>
        </div>
      </div>

      {/* Copyright row */}
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-4 md:py-6">
        <p className="text-sm mb-2 text-center md:text-left" style={{ color: "var(--text-secondary)" }}>
          © 2026 Aztec Foundation
        </p>
        <p className="text-sm leading-relaxed text-center md:text-left" style={{ color: "var(--text-secondary)" }}>
          <span style={{ color: "var(--text-primary)" }}>
            Information for Persons in the UK:
          </span>{" "}
          Communications relating to the Aztec token and the Aztec token sale
          made by Aztec Foundation are directed only at persons outside the UK.
          Persons in the UK are not permitted to participate in the Aztec token
          sale and must not act upon any communications made by Aztec Foundation
          in relation to it or the Aztec token.
        </p>
      </div>
    </footer>
  );
}
