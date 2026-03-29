import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Lumiere",
	description: "Dashboard de monitoring Lumiere",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="fr" className={`${inter.className} h-full antialiased`}>
			<body className="min-h-full flex flex-col">
				{children}
				<Toaster />
			</body>
		</html>
	);
}
