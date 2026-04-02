import type { Metadata } from "next";
import Script from "next/script";
import { headers } from "next/headers";
import { Inter, Lora } from "next/font/google";
import { Web3Provider } from "@/components/providers/Web3Provider";
import { BetaBanner } from "@/components/layout/BetaBanner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Aztec Governance",
  description: "Aztec Protocol Governance Dashboard",
  icons: {
    icon: "/favicon.ico",
    apple: "/aztec-token.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersObj = await headers();
  const cookies = headersObj.get("cookie");
  const csp = headersObj.get("content-security-policy") ?? "";
  const nonce = csp.match(/'nonce-([^']+)'/)?.[1] ?? "";

  return (
    <html lang="en">
      <head>
        {process.env.NEXT_PUBLIC_CLARITY_TAG && (
          <Script
            id="microsoft-clarity"
            strategy="afterInteractive"
            nonce={nonce}
            dangerouslySetInnerHTML={{
              __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "${process.env.NEXT_PUBLIC_CLARITY_TAG}");`,
            }}
          />
        )}
      </head>
      <body className={`${inter.variable} ${lora.variable} antialiased`}>
        <BetaBanner />
        <Web3Provider cookies={cookies}>{children}</Web3Provider>
      </body>
    </html>
  );
}
