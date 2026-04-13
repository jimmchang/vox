import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import Link from "next/link";
import { cn } from "@/lib/utils";
import "@/app/globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
	title: "Vox",
	description: "Product experience simulation tool",
};

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
	return (
		<Link href={href} className="text-sm text-muted-foreground hover:text-foreground">
			{children}
		</Link>
	);
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className={cn("font-sans", dmSans.variable)}>
			<body>
				<nav className="border-b">
					<div className="mx-auto flex max-w-[1200px] items-center gap-6 px-6 py-3">
						<Link href="/" className="font-semibold">
							Vox
						</Link>
						<NavLink href="/simulations">Simulations</NavLink>
						<NavLink href="/personas">Personas</NavLink>
						<NavLink href="/compare">Compare</NavLink>
					</div>
				</nav>
				{children}
			</body>
		</html>
	);
}
