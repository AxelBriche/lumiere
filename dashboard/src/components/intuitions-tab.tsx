"use client";

import { useEffect, useState } from "react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Intuition } from "@/lib/types";
import { IntuitionEditor } from "./intuition-editor";

function formatDate(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleDateString("fr-FR", {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function IntuitionsTab() {
	const [intuitions, setIntuitions] = useState<Intuition[]>([]);
	const [search, setSearch] = useState("");
	const [editing, setEditing] = useState<Intuition | null>(null);
	const [deleting, setDeleting] = useState<string | null>(null);

	const fetchIntuitions = async () => {
		const res = await fetch("/api/lumiere/intuitions");
		setIntuitions(await res.json());
	};

	useEffect(() => {
		fetchIntuitions();
		const interval = setInterval(fetchIntuitions, 30_000);
		return () => clearInterval(interval);
	}, []);

	const filtered = intuitions.filter(
		(i) =>
			i.id.includes(search.toLowerCase()) ||
			i.domain.toLowerCase().includes(search.toLowerCase()) ||
			i.trigger.toLowerCase().includes(search.toLowerCase())
	);

	const confirmDelete = async () => {
		if (!deleting) return;
		await fetch("/api/lumiere/intuitions", {
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ filename: deleting }),
		});
		setDeleting(null);
		fetchIntuitions();
	};

	return (
		<div className="grid gap-4">
			<Input
				placeholder="Rechercher une intuition..."
				value={search}
				onChange={(e) => setSearch(e.target.value)}
			/>

			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Date</TableHead>
						<TableHead>Intuition</TableHead>
						<TableHead>Domaine</TableHead>
						<TableHead>Confiance</TableHead>
						<TableHead>Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{filtered.map((intuition) => (
						<TableRow key={intuition.filename}>
							<TableCell className="text-sm text-muted-foreground whitespace-nowrap">
								{formatDate(intuition.createdAt)}
							</TableCell>
							<TableCell className="max-w-[300px]">
								<p className="truncate text-sm font-medium">
									{intuition.content.split("\n").find((l: string) => l.startsWith("# "))?.replace("# ", "") ?? intuition.id}
								</p>
							</TableCell>
							<TableCell>
								<Badge variant="secondary">
									{intuition.domain}
								</Badge>
							</TableCell>
							<TableCell>
								<div className="flex items-center gap-2">
									<div className="h-2 w-20 rounded-full bg-muted">
										<div
											className={`h-2 rounded-full ${
												intuition.confidence >= 0.7
													? "bg-green-500"
													: intuition.confidence >= 0.5
														? "bg-yellow-500"
														: intuition.confidence >= 0.3
															? "bg-orange-500"
															: "bg-red-500"
											}`}
											style={{
												width: `${intuition.confidence * 100}%`,
											}}
										/>
									</div>
									<span className="text-sm text-muted-foreground">
										{Math.round(intuition.confidence * 100)}%
									</span>
								</div>
							</TableCell>
							<TableCell>
								<div className="flex gap-1">
									<Button
										size="sm"
										variant="ghost"
										onClick={() => setEditing(intuition)}
									>
										Éditer
									</Button>
									<Button
										size="sm"
										variant="ghost"
										onClick={() =>
											setDeleting(intuition.filename)
										}
									>
										×
									</Button>
								</div>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>

			{deleting && (
				<div className="flex items-center gap-3 rounded-lg border p-4">
					<p className="flex-1 text-sm">
						Supprimer cette intuition ? Cette action est
						irréversible.
					</p>
					<Button
						size="sm"
						variant="outline"
						onClick={() => setDeleting(null)}
					>
						Annuler
					</Button>
					<Button
						size="sm"
						variant="destructive"
						onClick={confirmDelete}
					>
						Supprimer
					</Button>
				</div>
			)}

			{editing && (
				<IntuitionEditor
					intuition={editing}
					onClose={() => setEditing(null)}
					onSave={() => {
						setEditing(null);
						fetchIntuitions();
					}}
				/>
			)}
		</div>
	);
}
