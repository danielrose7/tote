"use client";

import { useChat } from "@ai-sdk/react";
import type { co } from "jazz-tools";
import { Group } from "jazz-tools";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMetadata } from "../../app/utils/metadata";
import { removeFromSelection } from "../../lib/slotHelpers";
import type { Block } from "../../schema";
import { BlockList, Block as BlockSchema } from "../../schema";
import { useToast } from "../ToastNotification";
import styles from "./CollectionChat.module.css";
import {
	CollectionSuggestionCard,
	ProductSuggestionCard,
	type SuggestedCollection,
	type SuggestedProduct,
} from "./ProductSuggestionCard";

type LoadedBlock = co.loaded<typeof Block>;

interface CollectionChatProps {
	collection: LoadedBlock | null;
	seedContext?: string;
	onClose?: () => void;
}

interface CollectionContext {
	title: string;
	description?: string;
	curatorSessionId?: string;
	curatorTopic?: string;
	curatorBriefJson?: string;
	items: {
		id: string;
		title: string;
		url: string;
		price?: string;
		description?: string;
		slotId?: string;
		slotName?: string;
	}[];
	slots: { id: string; name: string; productIds: string[] }[];
}

interface OrganizationSlotProposal {
	name: string;
	rationale: string;
	existingSlotId?: string;
	productIds: string[];
}

interface OrganizationProposal {
	type: "organization_proposal";
	summary: string;
	slots: OrganizationSlotProposal[];
	removeSlotIds?: string[];
	ungroupedProductIds?: string[];
}

function serializeCollection(
	collection: LoadedBlock | null,
): CollectionContext | null {
	if (!collection) return null;
	const items: CollectionContext["items"] = [];
	const slots: CollectionContext["slots"] = [];
	for (const child of collection.children ?? []) {
		if (!child?.$isLoaded) continue;
		if (child.type === "product" && child.productData?.url) {
			items.push({
				id: child.$jazz.id,
				title: child.name ?? "",
				url: child.productData.url,
				price: child.productData.price ?? undefined,
				description: child.productData.description ?? undefined,
			});
		} else if (child.type === "slot") {
			const productIds: string[] = [];
			for (const product of child.children ?? []) {
				if (!product?.$isLoaded || !product.productData?.url) continue;
				productIds.push(product.$jazz.id);
				items.push({
					id: product.$jazz.id,
					title: product.name ?? "",
					url: product.productData.url,
					price: product.productData.price ?? undefined,
					description: product.productData.description ?? undefined,
					slotId: child.$jazz.id,
					slotName: child.name,
				});
			}
			slots.push({
				id: child.$jazz.id,
				name: child.name,
				productIds,
			});
		}
	}
	return {
		title: collection.name ?? "Collection",
		description: collection.collectionData?.description ?? undefined,
		curatorSessionId: collection.collectionData?.curatorSessionId ?? undefined,
		curatorTopic: collection.collectionData?.curatorTopic ?? undefined,
		curatorBriefJson: collection.collectionData?.curatorBriefJson ?? undefined,
		items,
		slots,
	};
}

async function addProductToCollection(
	product: SuggestedProduct,
	collection: LoadedBlock,
): Promise<void> {
	const productUrl = normalizeProductUrl(product.url);
	const imageUrl = normalizeProductUrl(product.imageUrl, productUrl);
	const sharingGroupId = collection.collectionData?.sharingGroupId;
	const ownerGroup = sharingGroupId
		? await Group.load(sharingGroupId as `co_z${string}`, {})
		: null;

	const group = ownerGroup ?? Group.create({ owner: undefined as never });

	const newBlock = BlockSchema.create(
		{
			type: "product",
			name: product.title ?? "Untitled",
			productData: {
				url: productUrl,
				imageUrl: imageUrl ?? undefined,
				price: product.price ?? undefined,
				description: product.description ?? undefined,
			},
			createdAt: new Date(),
		},
		group,
	);

	if (collection.children?.$isLoaded) {
		collection.children.$jazz.push(newBlock);
	} else {
		const list = BlockList.create([newBlock], { owner: group });
		collection.$jazz.set("children", list);
	}
}

async function applyOrganizationProposal(
	proposal: OrganizationProposal,
	collection: LoadedBlock,
): Promise<void> {
	const collectionChildren = collection.children;
	if (!collectionChildren?.$isLoaded) {
		throw new Error("Collection children are not loaded");
	}

	let ownerGroup: Group | null = null;
	const sharingGroupId = collection.collectionData?.sharingGroupId;
	if (sharingGroupId) {
		ownerGroup = await Group.load(sharingGroupId as `co_z${string}`, {});
	}
	const owner = ownerGroup ?? Group.create({ owner: undefined as never });

	const productById = new Map<string, LoadedBlock>();
	const slotById = new Map<string, LoadedBlock>();

	for (const child of collectionChildren) {
		if (!child?.$isLoaded) continue;
		if (child.type === "product") {
			productById.set(child.$jazz.id, child);
		} else if (child.type === "slot") {
			slotById.set(child.$jazz.id, child);
			if (child.children?.$isLoaded) {
				for (const product of child.children) {
					if (product?.$isLoaded && product.type === "product") {
						productById.set(product.$jazz.id, product);
					}
				}
			}
		}
	}

	const removeFromCurrentParent = (productId: string) => {
		for (let i = collectionChildren.length - 1; i >= 0; i--) {
			const child = collectionChildren[i];
			if (!child?.$isLoaded) continue;
			if (child.type === "product" && child.$jazz.id === productId) {
				collectionChildren.$jazz.splice(i, 1);
				return;
			}
			if (child.type === "slot" && child.children?.$isLoaded) {
				for (let j = child.children.length - 1; j >= 0; j--) {
					const product = child.children[j];
					if (product?.$isLoaded && product.$jazz.id === productId) {
						removeFromSelection(productId, child);
						child.children.$jazz.splice(j, 1);
						return;
					}
				}
			}
		}
	};

	const ensureSlot = (slotProposal: OrganizationSlotProposal): LoadedBlock => {
		const existingSlot = slotProposal.existingSlotId
			? slotById.get(slotProposal.existingSlotId)
			: null;
		if (existingSlot) {
			if (existingSlot.name !== slotProposal.name) {
				existingSlot.$jazz.set("name", slotProposal.name);
			}
			if (!existingSlot.children?.$isLoaded) {
				const children = BlockList.create([], { owner });
				existingSlot.$jazz.set("children", children);
			}
			return existingSlot;
		}

		const slotChildren = BlockList.create([], { owner });
		const slot = BlockSchema.create(
			{
				type: "slot",
				name: slotProposal.name,
				slotData: {},
				children: slotChildren,
				createdAt: new Date(),
			},
			owner,
		) as LoadedBlock;
		collectionChildren.$jazz.push(slot);
		slotById.set(slot.$jazz.id, slot);
		return slot;
	};

	const assignedIds = new Set<string>();
	for (const slotProposal of proposal.slots) {
		const slot = ensureSlot(slotProposal);
		if (!slot.children?.$isLoaded) continue;

		for (const productId of slotProposal.productIds) {
			const product = productById.get(productId);
			if (!product || assignedIds.has(productId)) continue;
			removeFromCurrentParent(productId);
			slot.children.$jazz.push(product);
			assignedIds.add(productId);
		}
	}

	for (const productId of proposal.ungroupedProductIds ?? []) {
		const product = productById.get(productId);
		if (!product || assignedIds.has(productId)) continue;
		removeFromCurrentParent(productId);
		collectionChildren.$jazz.push(product);
		assignedIds.add(productId);
	}

	for (const slotId of proposal.removeSlotIds ?? []) {
		const slot = slotById.get(slotId);
		if (!slot) continue;
		const hasProducts =
			slot.children?.$isLoaded &&
			Array.from(slot.children).some(
				(child) => child?.$isLoaded && child.type === "product",
			);
		if (hasProducts) continue;
		const index = collectionChildren.findIndex(
			(child) => child?.$isLoaded && child.$jazz.id === slotId,
		);
		if (index !== -1) collectionChildren.$jazz.splice(index, 1);
	}
}

function normalizeProductUrl(
	url: string | null | undefined,
	baseUrl?: string,
): string | null {
	if (!url) return null;
	try {
		return new URL(url, baseUrl).href;
	} catch {
		return url.startsWith("//") ? `https:${url}` : url;
	}
}

function productIdentity(product: Pick<SuggestedProduct, "url" | "title">): string {
	const url = normalizeProductUrl(product.url);
	if (url) {
		try {
			const parsed = new URL(url);
			parsed.hash = "";
			parsed.searchParams.sort();
			return parsed.href.replace(/\/$/, "").toLowerCase();
		} catch {
			return url.replace(/\/$/, "").toLowerCase();
		}
	}
	return (product.title ?? "").trim().toLowerCase();
}

const URL_RE = /https?:\/\/[^\s"')>]+/g;

function isGenericOptionsIntro(text: string): boolean {
	return /^here (are|is) (a few|some|several|the) (options|option|picks|results):?$/i.test(
		text.trim(),
	);
}

function isOrganizeSeed(seedContext?: string): boolean {
	return Boolean(
		seedContext &&
			/\b(organize|tidy|group|slots?|sections?|restructure|sort)\b/i.test(
				seedContext,
			),
	);
}

function getSuggestedProducts(output: unknown): SuggestedProduct[] {
	if (
		output &&
		typeof output === "object" &&
		(output as { type?: unknown }).type === "collection"
	) {
		return [];
	}
	const products = Array.isArray(output) ? output : [output];
	const seen = new Set<string>();
	return products.filter((product): product is SuggestedProduct => {
		if (
			!(
				product &&
				typeof product === "object" &&
				"url" in product &&
				typeof product.url === "string"
			)
		) {
			return false;
		}
		const key = productIdentity(product as SuggestedProduct);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function getSuggestedCollection(output: unknown): SuggestedCollection | null {
	if (
		!output ||
		typeof output !== "object" ||
		(output as { type?: unknown }).type !== "collection"
	) {
		return null;
	}
	const candidate = output as {
		title?: unknown;
		url?: unknown;
		products?: unknown;
	};
	if (typeof candidate.url !== "string" || !Array.isArray(candidate.products)) {
		return null;
	}
	const products = getSuggestedProducts(candidate.products);
	if (products.length === 0) return null;
	return {
		type: "collection",
		title: typeof candidate.title === "string" ? candidate.title : null,
		url: candidate.url,
		products,
	};
}

function getOrganizationProposal(output: unknown): OrganizationProposal | null {
	if (
		!output ||
		typeof output !== "object" ||
		(output as { type?: unknown }).type !== "organization_proposal"
	) {
		return null;
	}
	const candidate = output as {
		summary?: unknown;
		slots?: unknown;
		removeSlotIds?: unknown;
		ungroupedProductIds?: unknown;
	};
	if (
		typeof candidate.summary !== "string" ||
		!Array.isArray(candidate.slots)
	) {
		return null;
	}

	const slots = candidate.slots
		.map((slot): OrganizationSlotProposal | null => {
			if (!slot || typeof slot !== "object") return null;
			const s = slot as {
				name?: unknown;
				rationale?: unknown;
				existingSlotId?: unknown;
				productIds?: unknown;
			};
			if (
				typeof s.name !== "string" ||
				typeof s.rationale !== "string" ||
				!Array.isArray(s.productIds)
			) {
				return null;
			}
			const productIds = s.productIds.filter(
				(id): id is string => typeof id === "string",
			);
			return {
				name: s.name,
				rationale: s.rationale,
				existingSlotId:
					typeof s.existingSlotId === "string" ? s.existingSlotId : undefined,
				productIds,
			};
		})
		.filter((slot): slot is OrganizationSlotProposal => slot !== null);

	return {
		type: "organization_proposal",
		summary: candidate.summary,
		slots,
		removeSlotIds: Array.isArray(candidate.removeSlotIds)
			? candidate.removeSlotIds.filter(
					(id): id is string => typeof id === "string",
				)
			: undefined,
		ungroupedProductIds: Array.isArray(candidate.ungroupedProductIds)
			? candidate.ungroupedProductIds.filter(
					(id): id is string => typeof id === "string",
				)
			: undefined,
	};
}

function getClarificationQuestion(output: unknown): string | null {
	if (
		!output ||
		typeof output !== "object" ||
		(output as { type?: unknown }).type !== "clarification"
	) {
		return null;
	}
	const question = (output as { question?: unknown }).question;
	return typeof question === "string" && question.trim() ? question : null;
}

function formatCreditBalance(cents: number | null): string {
	if (cents === null) return "Credits";
	return `$${(cents / 100).toFixed(2)}`;
}

function hashString(value: string): string {
	let hash = 0;
	for (let i = 0; i < value.length; i++) {
		hash = (hash * 31 + value.charCodeAt(i)) | 0;
	}
	return Math.abs(hash).toString(36);
}

function stringifyPartValue(value: unknown): string {
	if (!value) return "";
	if (typeof value !== "object") return String(value);
	try {
		return JSON.stringify(value);
	} catch {
		return "";
	}
}

function getPartKey(messageId: string, part: unknown): string {
	const p = part as {
		type?: string;
		state?: string;
		text?: string;
		input?: unknown;
		output?: unknown;
	};
	const input = stringifyPartValue(p.input);
	const output = stringifyPartValue(p.output);
	return `${messageId}-${p.type ?? "part"}-${p.state ?? "state"}-${hashString(
		`${p.text ?? ""}:${input}:${output}`,
	)}`;
}

function OrganizationProposalCard({
	proposal,
	collectionContext,
	onApply,
}: {
	proposal: OrganizationProposal;
	collectionContext: CollectionContext | null;
	onApply?: () => Promise<void>;
}) {
	const [status, setStatus] = useState<"idle" | "applying" | "applied">("idle");
	const [error, setError] = useState<string | null>(null);
	const productTitleById = new Map(
		(collectionContext?.items ?? []).map((item) => [item.id, item.title]),
	);

	async function handleApply() {
		if (!onApply || status !== "idle") return;
		setStatus("applying");
		setError(null);
		try {
			await onApply();
			setStatus("applied");
		} catch {
			setStatus("idle");
			setError("Could not apply this organization. Try refreshing first.");
		}
	}

	const moveCount = proposal.slots.reduce(
		(total, slot) => total + slot.productIds.length,
		0,
	);
	const removeCount = proposal.removeSlotIds?.length ?? 0;

	return (
		<div className={styles.organizeCard}>
			<div className={styles.organizeHeader}>
				<div>
					<span className={styles.clarificationLabel}>Organize</span>
					<p className={styles.organizeTitle}>{proposal.summary}</p>
				</div>
				<span className={styles.organizeStats}>
					{proposal.slots.length} slots · {moveCount} moves
				</span>
			</div>

			<div className={styles.organizeSlots}>
				{proposal.slots.map((slot) => (
					<div
						key={`${slot.existingSlotId ?? slot.name}-${slot.productIds.join("-")}`}
						className={styles.organizeSlot}
					>
						<div className={styles.organizeSlotHeader}>
							<span className={styles.organizeSlotName}>{slot.name}</span>
							<span className={styles.organizeSlotCount}>
								{slot.productIds.length}
							</span>
						</div>
						<p className={styles.organizeRationale}>{slot.rationale}</p>
						<div className={styles.organizeProducts}>
							{slot.productIds.slice(0, 4).map((productId) => (
								<span key={productId} className={styles.organizeProduct}>
									{productTitleById.get(productId) ?? "Product"}
								</span>
							))}
							{slot.productIds.length > 4 && (
								<span className={styles.organizeProduct}>
									+{slot.productIds.length - 4} more
								</span>
							)}
						</div>
					</div>
				))}
			</div>

			{removeCount > 0 && (
				<p className={styles.organizeNote}>
					Also removes {removeCount} empty or redundant{" "}
					{removeCount === 1 ? "slot" : "slots"}.
				</p>
			)}
			{error && <p className={styles.organizeError}>{error}</p>}

			<div className={styles.organizeActions}>
				<button
					type="button"
					className={styles.organizeApplyButton}
					onClick={handleApply}
					disabled={!onApply || status !== "idle"}
				>
					{status === "applied"
						? "Applied"
						: status === "applying"
							? "Applying..."
							: "Apply organization"}
				</button>
			</div>
		</div>
	);
}

function TextWithAddButtons({
	text,
	collection,
	onAdd,
}: {
	text: string;
	collection: LoadedBlock | null;
	onAdd: (url: string) => Promise<void>;
}) {
	const [adding, setAdding] = useState<Record<string, boolean>>({});

	const urls = Array.from(new Set(text.match(URL_RE) ?? []));
	if (!collection || urls.length === 0) {
		return <span>{text}</span>;
	}

	async function handleAdd(url: string) {
		setAdding((p) => ({ ...p, [url]: true }));
		await onAdd(url);
	}

	// Split text into segments, inserting an Add button after each URL
	const parts: React.ReactNode[] = [];
	let last = 0;
	for (const match of text.matchAll(URL_RE)) {
		const url = match[0];
		const start = match.index ?? 0;
		if (start > last) parts.push(text.slice(last, start));
		parts.push(
			<span key={url} className={styles.inlineUrlGroup}>
				<a
					href={url}
					target="_blank"
					rel="noopener noreferrer"
					className={styles.inlineUrl}
				>
					{url}
				</a>
				<button
					type="button"
					className={styles.inlineAddButton}
					disabled={adding[url]}
					onClick={() => handleAdd(url)}
				>
					{adding[url] ? "✓" : "+ Add"}
				</button>
			</span>,
		);
		last = start + url.length;
	}
	if (last < text.length) parts.push(text.slice(last));
	return <span>{parts}</span>;
}

export function CollectionChat({
	collection,
	seedContext,
	onClose,
}: CollectionChatProps) {
	const [open, setOpen] = useState(false);
	const { showToast } = useToast();
	const [chatError, setChatError] = useState<string | null>(null);
	const [balanceCents, setBalanceCents] = useState<number | null>(null);
	const [draft, setDraft] = useState("");
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	const collectionContext = serializeCollection(collection);
	const organizeMode = isOrganizeSeed(seedContext);
	const chatRequestBody = {
		collectionContext,
		collectionId: collection?.$jazz?.id,
		seedContext,
	};

	const fetchBalance = useCallback(async () => {
		try {
			const res = await fetch("/api/billing/credits");
			if (!res.ok) return;
			const { balanceCents: nextBalance } = await res.json();
			setBalanceCents(nextBalance);
		} catch {
			// Non-critical display only.
		}
	}, []);

	const chatFetch = useCallback<typeof fetch>(
		async (input, init) => {
			const res = await fetch(input, init);
			if (res.status === 402) {
				setChatError("Add credits to keep using AI chat.");
				fetchBalance();
			} else if (!res.ok) {
				setChatError("Chat request failed. Try again in a minute.");
			} else {
				setChatError(null);
			}
			return res;
		},
		[fetchBalance],
	);

	const { messages, sendMessage, stop, status } = useChat({
		api: "/api/chat",
		fetch: chatFetch,
	});

	const autoSubmittedRef = useRef<string | null>(null);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	});

	useEffect(() => {
		if (open) {
			fetchBalance();
		}
	}, [fetchBalance, open]);

	const previousStatusRef = useRef(status);
	useEffect(() => {
		const previousStatus = previousStatusRef.current;
		previousStatusRef.current = status;
		if (
			open &&
			(previousStatus === "submitted" || previousStatus === "streaming") &&
			status === "ready"
		) {
			fetchBalance();
		}
	}, [fetchBalance, open, status]);

	// Auto-open and auto-submit when seedContext arrives
	const sendMessageRef = useRef(sendMessage);
	useEffect(() => {
		sendMessageRef.current = sendMessage;
	});

	useEffect(() => {
		if (!seedContext) {
			autoSubmittedRef.current = null;
			return;
		}
		if (
			isOrganizeSeed(seedContext) &&
			(!collectionContext || collectionContext.items.length === 0)
		) {
			return;
		}
		if (autoSubmittedRef.current === seedContext) return;
		autoSubmittedRef.current = seedContext;
		setOpen(true);
		sendMessageRef.current(
			{ text: seedContext },
			{
				body: {
					collectionContext,
					collectionId: collection?.$jazz?.id,
					seedContext,
				},
			},
		);
	}, [collection, collectionContext, seedContext]);

	function handleOpen() {
		setOpen(true);
		setTimeout(() => inputRef.current?.focus(), 100);
	}

	function handleClose() {
		setOpen(false);
		onClose?.();
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			submitDraft();
		}
	}

	function submitDraft(e?: React.FormEvent<HTMLFormElement>) {
		e?.preventDefault();
		const text = draft.trim();
		if (!text || status === "submitted" || status === "streaming") return;
		setDraft("");
		sendMessage({ text }, { body: chatRequestBody });
	}

	async function handleAddUrl(url: string) {
		if (!collection) return;
		try {
			const meta = await fetchMetadata(url);
			const product: SuggestedProduct = {
				url,
				title: meta?.title ?? null,
				imageUrl: meta?.imageUrl ?? null,
				price: meta?.price ?? null,
				description: meta?.description ?? null,
			};
			await addProductToCollection(product, collection);
			showToast({
				title: "Added to collection",
				description: product.title ?? url,
				variant: "success",
			});
		} catch (err) {
			console.error("[CollectionChat] add url failed", err);
			showToast({
				title: "Could not add product",
				description: "Try adding it manually via the + button.",
				variant: "error",
			});
		}
	}

	async function handleAddProduct(product: SuggestedProduct) {
		if (!collection) return;
		try {
			await addProductToCollection(product, collection);
			showToast({
				title: "Added to collection",
				description: product.title ?? "Product added",
				variant: "success",
			});
		} catch (err) {
			console.error("[CollectionChat] add failed", err);
			showToast({
				title: "Could not add product",
				description: "Try adding it manually via the + button.",
				variant: "error",
			});
		}
	}

	if (!open) {
		return (
			<button type="button" className={styles.trigger} onClick={handleOpen}>
				<span>🔍</span>
				<span>Find products</span>
			</button>
		);
	}

	return (
		<div className={styles.panel}>
			<div className={styles.panelHeader}>
				<div className={styles.panelHeading}>
					<span className={styles.panelTitle}>
						{organizeMode
							? "Organize collection"
							: seedContext
								? "Find better option"
								: "Find products"}
					</span>
					<a href="/settings" className={styles.creditLink}>
						{formatCreditBalance(balanceCents)}
					</a>
				</div>
				<button
					type="button"
					className={styles.closeButton}
					onClick={handleClose}
					aria-label="Close"
				>
					✕
				</button>
			</div>

			<div className={styles.messages}>
				{messages.length === 0 && (
					<div className={styles.empty}>
						<span className={styles.emptyIcon}>🔍</span>
						<span>
							Ask me to find products, or start broad and I’ll help narrow it.
						</span>
					</div>
				)}

				{messages.map((message) => {
					const renderedProducts = new Set<string>();
					const hasProductCards = message.parts.some((part) => {
						const p = part as {
							type: string;
							state?: string;
							output?: unknown;
						};
						return (
							p.type === "tool-extract_product" &&
							p.state === "output-available" &&
							(getSuggestedProducts(p.output).length > 0 ||
								getSuggestedCollection(p.output) !== null)
						);
					});

					return (
						<div
							key={message.id}
							className={`${styles.message} ${
								message.role === "user"
									? styles.messageUser
									: styles.messageAssistant
							}`}
						>
							{message.parts.map((part) => {
								const partKey = getPartKey(message.id, part);
								if (part.type === "text" && part.text) {
									if (
										message.role === "assistant" &&
										hasProductCards &&
										isGenericOptionsIntro(part.text)
									) {
										return null;
									}

									return (
										<div key={partKey} className={styles.messageBubble}>
											<TextWithAddButtons
												text={part.text}
												collection={
													message.role === "assistant" ? collection : null
												}
												onAdd={handleAddUrl}
											/>
										</div>
									);
								}

								// AI SDK v6: typed server tools come through as 'tool-{name}' parts
								// (not 'dynamic-tool'). Check by type string directly.
								const p = part as {
									type: string;
									state?: string;
									input?: unknown;
									output?: unknown;
								};
								const isClarification =
									p.type === "tool-clarify_search_direction";
								const isOrganize = p.type === "tool-organize_collection";
								const isSearch = p.type === "tool-search_products";
								const isExtract = p.type === "tool-extract_product";

								if (
									!isOrganize &&
									!isClarification &&
									!isSearch &&
									!isExtract &&
									p.type !== "dynamic-tool" &&
									p.type !== "step-start"
								)
									return null;

								if (
									isOrganize &&
									(p.state === "input-streaming" ||
										p.state === "input-available")
								) {
									return (
										<div key={partKey} className={styles.toolStatus}>
											<span className={styles.spinner} />
											Planning slots…
										</div>
									);
								}

								if (isOrganize && p.state === "output-available") {
									const proposal = getOrganizationProposal(p.output);
									if (!proposal) return null;
									return (
										<OrganizationProposalCard
											key={partKey}
											proposal={proposal}
											collectionContext={collectionContext}
											onApply={
												collection
													? () =>
															applyOrganizationProposal(
																proposal,
																collection,
															).then(() => {
																showToast({
																	title: "Collection organized",
																	description:
																		"Slots and product placement were updated.",
																	variant: "success",
																});
															})
													: undefined
											}
										/>
									);
								}

								if (
									isClarification &&
									(p.state === "input-streaming" ||
										p.state === "input-available")
								) {
									return (
										<div key={partKey} className={styles.toolStatus}>
											<span className={styles.spinner} />
											Choosing a useful direction…
										</div>
									);
								}

								if (isClarification && p.state === "output-available") {
									const question = getClarificationQuestion(p.output);
									if (!question) return null;
									return (
										<div key={partKey} className={styles.clarificationBubble}>
											<span className={styles.clarificationLabel}>
												Direction
											</span>
											<TextWithAddButtons
												text={question}
												collection={null}
												onAdd={handleAddUrl}
											/>
										</div>
									);
								}

								if (
									isSearch &&
									(p.state === "input-streaming" ||
										p.state === "input-available")
								) {
									const query = (p.input as { query?: string })?.query;
									return (
										<div key={partKey} className={styles.toolStatus}>
											<span className={styles.spinner} />
											{query ? `Searching for "${query}"…` : "Searching…"}
										</div>
									);
								}

								if (
									isExtract &&
									(p.state === "input-streaming" ||
										p.state === "input-available")
								) {
									const url = (p.input as { url?: string })?.url;
									let hostname = url ?? "";
									try {
										if (url) hostname = new URL(url).hostname;
									} catch {}
									return (
										<div key={partKey} className={styles.toolStatus}>
											<span className={styles.spinner} />
											Looking up {hostname}…
										</div>
									);
								}

								if (isExtract && p.state === "output-available") {
									const suggestedCollection = getSuggestedCollection(p.output);
									if (suggestedCollection) {
										return (
											<CollectionSuggestionCard
												key={partKey}
												collection={suggestedCollection}
												onAddProduct={collection ? handleAddProduct : undefined}
											/>
										);
									}

									const products = getSuggestedProducts(p.output);
									const uniqueProducts = products.filter((product) => {
										const key = productIdentity(product);
										if (renderedProducts.has(key)) return false;
										renderedProducts.add(key);
										return true;
									});
									if (uniqueProducts.length === 0) return null;
									return (
										<div key={partKey} className={styles.productResults}>
											{uniqueProducts.map((product) => (
												<ProductSuggestionCard
													key={productIdentity(product)}
													product={product}
													onAdd={
														collection
															? () => handleAddProduct(product)
															: undefined
													}
												/>
											))}
										</div>
									);
								}

								return null;
							})}
						</div>
					);
				})}

				{(status === "submitted" || status === "streaming") && (
					<div className={`${styles.message} ${styles.messageAssistant}`}>
						<div className={styles.toolStatus}>
							<span className={styles.spinner} />
							{status === "submitted" ? "Thinking…" : "Working…"}
						</div>
					</div>
				)}

				{chatError && (
					<div className={`${styles.message} ${styles.messageAssistant}`}>
						<div className={styles.errorBubble}>
							{chatError}{" "}
							<a href="/settings" className={styles.errorLink}>
								Manage credits
							</a>
						</div>
					</div>
				)}

				<div ref={messagesEndRef} />
			</div>

			<form onSubmit={submitDraft} className={styles.inputArea}>
				<textarea
					ref={inputRef}
					className={styles.input}
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Find a giftable indoor garden, or ask for ideas…"
					rows={1}
				/>
				{status === "submitted" || status === "streaming" ? (
					<button
						type="button"
						className={styles.stopButton}
						onClick={() => stop()}
					>
						Stop
					</button>
				) : (
					<button
						type="submit"
						className={styles.sendButton}
						disabled={!draft.trim()}
					>
						Send
					</button>
				)}
			</form>
		</div>
	);
}
