"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
	h2: ({ children }) => <h2 className="mt-8 mb-4 text-xl font-semibold first:mt-0">{children}</h2>,
	h3: ({ children }) => <h3 className="mt-6 mb-3 text-lg font-semibold">{children}</h3>,
	p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
	ul: ({ children }) => <ul className="mb-4 ml-6 list-disc space-y-1">{children}</ul>,
	ol: ({ children }) => <ol className="mb-4 ml-6 list-decimal space-y-1">{children}</ol>,
	li: ({ children }) => <li className="leading-relaxed">{children}</li>,
	strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
	table: ({ children }) => (
		<div className="mb-6 overflow-x-auto">
			<table className="w-full border-collapse text-sm">{children}</table>
		</div>
	),
	thead: ({ children }) => <thead className="border-b">{children}</thead>,
	th: ({ children }) => (
		<th className="px-3 py-2 text-left font-medium text-muted-foreground">{children}</th>
	),
	td: ({ children }) => <td className="border-t px-3 py-2">{children}</td>,
	blockquote: ({ children }) => (
		<blockquote className="mb-4 border-l-2 pl-4 text-muted-foreground">{children}</blockquote>
	),
	hr: () => <hr className="my-6" />,
};

export function ReportMarkdown({ content }: { content: string }) {
	return (
		<div className="max-w-none text-sm leading-relaxed">
			<ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
				{content}
			</ReactMarkdown>
		</div>
	);
}
