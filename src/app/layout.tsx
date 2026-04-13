export const metadata = {
	title: "Vox",
	description: "Product experience simulation tool",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
