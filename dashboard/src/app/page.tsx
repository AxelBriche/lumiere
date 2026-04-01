"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatusTab } from "@/components/status-tab";
import { IntuitionsTab } from "@/components/intuitions-tab";
import { ConfigTab } from "@/components/config-tab";
import type { LumiereStatus } from "@/lib/types";

const TABS = ["status", "intuitions", "config"] as const;
type Tab = (typeof TABS)[number];

function getInitialTab(): Tab {
	if (typeof window === "undefined") return "status";
	const hash = window.location.hash.replace("#", "");
	return TABS.includes(hash as Tab) ? (hash as Tab) : "status";
}

export default function LumiereDashboard() {
	const [tab, setTab] = useState<Tab>(getInitialTab);
	const [workspace, setWorkspace] = useState<string>("");

	// Sync le hash sans recharger la page
	useEffect(() => {
		window.location.hash = tab;
	}, [tab]);

	// Récupère le nom du workspace au montage
	useEffect(() => {
		fetch("/api/lumiere/status")
			.then((r) => r.json())
			.then((data: LumiereStatus) => setWorkspace(data.workspace ?? ""))
			.catch(() => {});
	}, []);

	return (
		<div className="mx-auto w-full max-w-5xl p-6">
			<div className="mb-6 flex items-center gap-3">
				<h1 className="text-2xl font-bold">Lumiere</h1>
				{workspace && (
					<Badge variant="secondary" className="text-sm font-normal">
						{workspace}
					</Badge>
				)}
			</div>

			<Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="w-full">
				<TabsList className="w-full">
					<TabsTrigger value="status" className="flex-1">
						Statut
					</TabsTrigger>
					<TabsTrigger value="intuitions" className="flex-1">
						Intuitions
					</TabsTrigger>
					<TabsTrigger value="config" className="flex-1">
						Config
					</TabsTrigger>
				</TabsList>

				<div className="mt-4 min-h-[600px]">
					<TabsContent value="status" className="mt-0">
						<StatusTab />
					</TabsContent>

					<TabsContent value="intuitions" className="mt-0">
						<IntuitionsTab />
					</TabsContent>

					<TabsContent value="config" className="mt-0">
						<ConfigTab />
					</TabsContent>
				</div>
			</Tabs>

			<footer className="mt-8 pt-4 border-t text-sm text-muted-foreground">
				Créé par Axel Briche —{" "}
				<a href="https://x.com/axel_briche" target="_blank" rel="noopener noreferrer" className="underline">X</a>
				{" · "}
				<a href="https://www.malt.fr/profile/axelbriche" target="_blank" rel="noopener noreferrer" className="underline">Malt</a>
			</footer>
		</div>
	);
}
