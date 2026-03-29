"use client";

import { useState } from "react";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Intuition } from "@/lib/types";

interface Props {
	intuition: Intuition;
	onClose: () => void;
	onSave: () => void;
}

export function IntuitionEditor({ intuition, onClose, onSave }: Props) {
	const [id, setId] = useState(intuition.id);
	const [trigger, setTrigger] = useState(intuition.trigger);
	const [domain, setDomain] = useState(intuition.domain);
	const [confidence, setConfidence] = useState(
		String(intuition.confidence)
	);
	const [content, setContent] = useState(intuition.content);

	const handleSave = async () => {
		// Reconstruire le fichier .md avec frontmatter
		const md = `---
id: ${id}
trigger: "${trigger}"
confidence: ${parseFloat(confidence)}
domain: ${domain}
source: session-observation
---

${content}
`;
		await fetch("/api/lumiere/intuitions", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				filename: intuition.filename,
				content: md,
			}),
		});
		onSave();
	};

	return (
		<Sheet open onOpenChange={onClose}>
			<SheetContent className="overflow-y-auto sm:max-w-lg">
				<SheetHeader className="px-6 pt-6">
					<SheetTitle>Éditer l&apos;intuition</SheetTitle>
				</SheetHeader>

				<div className="grid gap-4 px-6 py-4">
					<div className="grid gap-2">
						<Label>ID</Label>
						<Input value={id} onChange={(e) => setId(e.target.value)} />
					</div>
					<div className="grid gap-2">
						<Label>Trigger</Label>
						<Input
							value={trigger}
							onChange={(e) => setTrigger(e.target.value)}
						/>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div className="grid gap-2">
							<Label>Domaine</Label>
							<Input
								value={domain}
								onChange={(e) => setDomain(e.target.value)}
							/>
						</div>
						<div className="grid gap-2">
							<Label>Confiance</Label>
							<Input
								type="number"
								step="0.1"
								min="0"
								max="1"
								value={confidence}
								onChange={(e) => setConfidence(e.target.value)}
							/>
						</div>
					</div>

					<Separator />

					<div className="grid gap-2">
						<Label>Contenu (Markdown)</Label>
						<textarea
							className="min-h-[300px] w-full rounded-md border bg-transparent px-3 py-2 text-sm font-mono"
							value={content}
							onChange={(e) => setContent(e.target.value)}
						/>
					</div>
				</div>

				<SheetFooter className="px-6 pb-6">
					<Button variant="outline" onClick={onClose}>
						Annuler
					</Button>
					<Button onClick={handleSave}>Enregistrer</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
