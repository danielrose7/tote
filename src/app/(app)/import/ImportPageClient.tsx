"use client";

import { Group } from "jazz-tools";
import { useAccount } from "jazz-tools/react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Header } from "../../../components/Header";
import { useToast } from "../../../components/ToastNotification";
import { Block, BlockList, JazzAccount } from "../../../schema";
import styles from "./import.module.css";

interface ImportItem {
	title: string;
	sourceUrl: string;
	merchant?: string;
	imageUrl?: string;
	price?: string | null;
	currency?: string;
	description?: string;
	note?: string;
	sourceRowId?: string;
	confidence?: number;
}

interface ImportSection {
	title: string;
	description?: string;
	items: ImportItem[];
}

interface ImportPayload {
	title: string;
	intro?: string;
	tags?: string[];
	sections: ImportSection[];
	warnings?: string[];
	sourceMetadata?: {
		sourceType?: string;
		importedAt?: string;
		workspaceVersion?: number;
	};
}

function validatePayload(json: unknown): ImportPayload {
	if (!json || typeof json !== "object" || Array.isArray(json)) {
		throw new Error("Invalid JSON: expected an object");
	}
	const obj = json as Record<string, unknown>;
	if (typeof obj.title !== "string" || !obj.title.trim()) {
		throw new Error("Missing required field: title");
	}
	if (!Array.isArray(obj.sections) || obj.sections.length === 0) {
		throw new Error(
			"Missing required field: sections (must be a non-empty array)",
		);
	}
	for (const section of obj.sections) {
		if (!section || typeof section !== "object")
			throw new Error("Invalid section");
		const s = section as Record<string, unknown>;
		if (typeof s.title !== "string" || !s.title.trim()) {
			throw new Error("Each section must have a title");
		}
		if (!Array.isArray(s.items))
			throw new Error(`Section "${s.title}" is missing items array`);
		for (const item of s.items) {
			if (!item || typeof item !== "object") throw new Error("Invalid item");
			const i = item as Record<string, unknown>;
			if (!i.title && !i.sourceUrl) {
				throw new Error("Each item must have at least a title or sourceUrl");
			}
		}
	}
	return obj as ImportPayload;
}

export function ImportPageClient() {
	const router = useRouter();
	const { showToast } = useToast();
	const [json, setJson] = useState("");
	const [preview, setPreview] = useState<ImportPayload | null>(null);
	const [parseError, setParseError] = useState<string | null>(null);
	const [importing, setImporting] = useState(false);

	const me = useAccount(JazzAccount, {
		resolve: { root: { blocks: true } },
	});

	const handleParse = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setParseError(null);
		setPreview(null);

		try {
			const parsed = JSON.parse(json);
			const validated = validatePayload(parsed);
			setPreview(validated);
		} catch (err) {
			setParseError(
				err instanceof Error ? err.message : "Failed to parse JSON",
			);
		}
	};

	const handleImport = async () => {
		if (!preview || !me.$isLoaded || !me.root) return;
		setImporting(true);

		try {
			const ownerGroup = Group.create({ owner: me });
			ownerGroup.addMember(me, "admin");

			const sectionBlocks: InstanceType<typeof Block>[] = [];

			for (const section of preview.sections) {
				const productBlocks: InstanceType<typeof Block>[] = section.items.map(
					(item) =>
						Block.create(
							{
								type: "product",
								name: item.title || item.sourceUrl || "Untitled",
								productData: {
									url: item.sourceUrl || "",
									imageUrl: item.imageUrl,
									price: item.price ?? undefined,
									description: item.description,
									notes: item.note,
								},
								createdAt: new Date(),
							},
							{ owner: ownerGroup },
						),
				);

				const slotChildren = BlockList.create(productBlocks, {
					owner: ownerGroup,
				});

				const slotBlock = Block.create(
					{
						type: "slot",
						name: section.title,
						slotData: {},
						children: slotChildren,
						createdAt: new Date(),
					},
					{ owner: ownerGroup },
				);

				sectionBlocks.push(slotBlock);
			}

			const collectionChildren = BlockList.create(sectionBlocks, {
				owner: ownerGroup,
			});

			const collectionBlock = Block.create(
				{
					type: "collection",
					name: preview.title,
					collectionData: {
						description: preview.intro,
						color: "#6366f1",
						viewMode: "grid",
						publicLayout: "minimal",
						allowCloning: true,
						sharingGroupId: ownerGroup.$jazz.id,
					},
					children: collectionChildren,
					createdAt: new Date(),
				},
				{ owner: ownerGroup },
			);

			if (!me.root.blocks) {
				const blocksList = BlockList.create([collectionBlock], me);
				me.root.$jazz.set("blocks", blocksList);
			} else if (me.root.blocks.$isLoaded) {
				me.root.blocks.$jazz.push(collectionBlock);
			}

			const totalItems = preview.sections.reduce(
				(sum, section) => sum + section.items.length,
				0,
			);
			showToast({
				title: "Collection imported",
				description: `"${preview.title}" — ${preview.sections.length} sections, ${totalItems} items`,
				variant: "success",
			});

			router.push(`/collections/${collectionBlock.$jazz.id}`);
		} catch (err) {
			console.error("Import failed", err);
			showToast({
				title: "Import failed",
				description: err instanceof Error ? err.message : "Unknown error",
				variant: "error",
			});
		} finally {
			setImporting(false);
		}
	};

	const totalItems =
		preview?.sections.reduce((sum, section) => sum + section.items.length, 0) ??
		0;

	return (
		<>
			<Header />
			<main className={styles.main}>
				<div className={styles.container}>
					<h1 className={styles.heading}>Import Collection</h1>
					<p className={styles.subheading}>
						Paste a Tote Draft Import Payload JSON to create a collection.
					</p>

					<form className={styles.form} onSubmit={handleParse}>
						<div className={styles.inputGroup}>
							<label className={styles.label} htmlFor="json-input">
								Import JSON
							</label>
							<textarea
								id="json-input"
								className={styles.textarea}
								value={json}
								onChange={(e) => {
									setJson(e.target.value);
									setPreview(null);
									setParseError(null);
								}}
								placeholder={`{\n  "title": "My Collection",\n  "intro": "...",\n  "sections": [\n    {\n      "title": "Section 1",\n      "items": [\n        { "title": "Item", "sourceUrl": "https://..." }\n      ]\n    }\n  ]\n}`}
								rows={16}
								spellCheck={false}
							/>
						</div>

						{parseError && <p className={styles.error}>{parseError}</p>}

						<div className={styles.parseActions}>
							<p className={styles.parseHint}>
								Paste your payload, then submit to preview before importing.
							</p>
							<button
								className={styles.parseButton}
								type="submit"
								disabled={!json.trim()}
							>
								Preview Import
							</button>
						</div>
					</form>

					{preview && (
						<div className={styles.preview}>
							<h2 className={styles.previewTitle}>{preview.title}</h2>
							{preview.intro && (
								<p className={styles.previewIntro}>{preview.intro}</p>
							)}
							<p className={styles.previewMeta}>
								{preview.sections.length} section
								{preview.sections.length !== 1 ? "s" : ""}, {totalItems} item
								{totalItems !== 1 ? "s" : ""}
							</p>

							{preview.warnings && preview.warnings.length > 0 && (
								<div className={styles.warnings}>
									{preview.warnings.map((warning) => (
										<p key={warning} className={styles.warning}>
											{warning}
										</p>
									))}
								</div>
							)}

							<div className={styles.sections}>
								{preview.sections.map((section) => (
									<div key={section.title} className={styles.section}>
										<h3 className={styles.sectionTitle}>{section.title}</h3>
										<ul className={styles.itemList}>
											{section.items.map((item) => (
												<li
													key={item.sourceRowId || item.sourceUrl || item.title}
													className={styles.item}
												>
													<span className={styles.itemName}>
														{item.title || item.sourceUrl}
													</span>
													{item.sourceUrl && item.title && (
														<span className={styles.itemUrl}>
															{item.sourceUrl}
														</span>
													)}
													{item.price && (
														<span className={styles.itemPrice}>
															{item.price}
														</span>
													)}
												</li>
											))}
										</ul>
									</div>
								))}
							</div>

							<div className={styles.actions}>
								<button
									className={styles.cancelButton}
									onClick={() => {
										setPreview(null);
										setParseError(null);
									}}
									type="button"
								>
									Back
								</button>
								<button
									className={styles.importButton}
									onClick={handleImport}
									disabled={importing || !me.$isLoaded || !me.root}
									type="button"
								>
									{importing ? "Importing..." : `Import "${preview.title}"`}
								</button>
							</div>
						</div>
					)}
				</div>
			</main>
		</>
	);
}
