import type {
	ClassicMigrationCollection,
	ClassicMigrationMember,
	ClassicMigrationNode,
} from "./migrationPayload";

type JazzValue = {
	$isLoaded?: boolean;
	$jazz?: {
		id?: string;
		owner?: {
			getDirectMembers?: () => Array<{
				id?: string;
				role?: string;
			}>;
		};
	};
	[key: string]: unknown;
};

export type ClassicMemberClerkIdResolver = (
	jazzAccountId: string,
) => Promise<string | null>;

export class ClassicMigrationExportIncompleteError extends Error {
	override name = "ClassicMigrationExportIncompleteError";
}

function values(value: unknown): unknown[] | null {
	if (value == null) return [];
	if (typeof value !== "object") return null;
	try {
		return Array.from(value as Iterable<unknown>);
	} catch {
		return null;
	}
}

function loadedValues(value: unknown): JazzValue[] {
	return (values(value) ?? []).filter(
		(entry): entry is JazzValue =>
			Boolean(entry) &&
			typeof entry === "object" &&
			(entry as JazzValue).$isLoaded === true,
	);
}

function assertCompleteList(value: unknown, label: string) {
	const entries = values(value);
	if (
		entries === null ||
		entries.some(
			(entry) =>
				!entry ||
				typeof entry !== "object" ||
				(entry as JazzValue).$isLoaded !== true,
		)
	) {
		throw new ClassicMigrationExportIncompleteError(
			`${label} is not fully loaded`,
		);
	}
}

function stringValue(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value)
		? value
		: undefined;
}

function positionKey(index: number) {
	return `m${String(index).padStart(8, "0")}`;
}

function migrationRole(role: string): ClassicMigrationMember["role"] | null {
	if (role === "admin" || role === "manager") return "admin";
	if (role === "writer" || role === "writeOnly") return "editor";
	if (role === "reader") return "viewer";
	return null;
}

function productNode(
	block: JazzValue,
	index: number,
	parentLegacyJazzId: string | null,
): ClassicMigrationNode | null {
	const legacyJazzId = stringValue(block.$jazz?.id);
	if (!legacyJazzId) return null;
	const productData = (block.productData ?? {}) as Record<string, unknown>;
	return {
		legacyJazzId,
		parentLegacyJazzId,
		type: "product",
		title: stringValue(block.name)?.slice(0, 500) ?? null,
		properties: {
			...(stringValue(productData.url)
				? { url: stringValue(productData.url) }
				: {}),
			...(stringValue(productData.imageUrl)
				? { imageUrl: stringValue(productData.imageUrl) }
				: {}),
			...(Array.isArray(productData.images)
				? { images: productData.images }
				: {}),
			...(stringValue(productData.price)
				? { price: stringValue(productData.price) }
				: {}),
			...(numberValue(productData.priceValue) !== undefined
				? { priceValue: numberValue(productData.priceValue) }
				: {}),
			...(stringValue(productData.description)
				? { description: stringValue(productData.description) }
				: {}),
			...(stringValue(productData.notes)
				? { notes: stringValue(productData.notes) }
				: {}),
		},
		positionKey: positionKey(index),
	};
}

export function exportClassicCollection(
	block: unknown,
	positionKeyValue = positionKey(0),
): ClassicMigrationCollection | null {
	if (!block || typeof block !== "object") return null;
	const collectionBlock = block as JazzValue;
	if (
		collectionBlock.$isLoaded !== true ||
		collectionBlock.type !== "collection" ||
		collectionBlock.parentId ||
		(collectionBlock.collectionData as Record<string, unknown> | undefined)
			?.sourceId
	) {
		return null;
	}
	const legacyJazzId = stringValue(collectionBlock.$jazz?.id);
	const name = stringValue(collectionBlock.name);
	if (!legacyJazzId || !name) return null;
	const collectionData = (collectionBlock.collectionData ?? {}) as Record<
		string,
		unknown
	>;
	const nodes: ClassicMigrationNode[] = [];
	assertCompleteList(
		collectionBlock.children,
		`Collection ${legacyJazzId} children`,
	);
	assertCompleteList(collectionBlock.notes, `Collection ${legacyJazzId} notes`);

	for (const [childIndex, child] of loadedValues(
		collectionBlock.children,
	).entries()) {
		if (child.type === "product") {
			const node = productNode(child, childIndex, null);
			if (node) nodes.push(node);
			continue;
		}
		if (child.type !== "slot") continue;
		const sectionLegacyJazzId = stringValue(child.$jazz?.id);
		if (!sectionLegacyJazzId) continue;
		const slotData = (child.slotData ?? {}) as Record<string, unknown>;
		nodes.push({
			legacyJazzId: sectionLegacyJazzId,
			parentLegacyJazzId: null,
			type: "section",
			title: stringValue(child.name)?.slice(0, 500) ?? "Section",
			properties: {
				...(numberValue(slotData.budget) !== undefined
					? { budgetCents: numberValue(slotData.budget) }
					: {}),
				...(numberValue(slotData.maxSelections) !== undefined
					? { maxSelections: numberValue(slotData.maxSelections) }
					: {}),
				...(Array.isArray(slotData.selectedProductIds)
					? { selectedProductIds: slotData.selectedProductIds }
					: {}),
			},
			positionKey: positionKey(childIndex),
		});
		assertCompleteList(
			child.children,
			`Collection ${legacyJazzId} section ${sectionLegacyJazzId} children`,
		);
		for (const [productIndex, product] of loadedValues(
			child.children,
		).entries()) {
			if (product.type !== "product") continue;
			const node = productNode(product, productIndex, sectionLegacyJazzId);
			if (node) nodes.push(node);
		}
	}

	for (const [noteIndex, note] of loadedValues(
		collectionBlock.notes,
	).entries()) {
		const noteLegacyJazzId = stringValue(note.$jazz?.id);
		const text = stringValue(note.text);
		if (!noteLegacyJazzId || !text) continue;
		nodes.push({
			legacyJazzId: noteLegacyJazzId,
			parentLegacyJazzId: null,
			type: "note",
			title: text.split("\n")[0]?.slice(0, 500) || "Note",
			properties: {
				body: text,
				...(stringValue(note.url) ? { url: stringValue(note.url) } : {}),
				...(typeof note.done === "boolean" ? { isDone: note.done } : {}),
			},
			positionKey: `n${String(noteIndex).padStart(8, "0")}`,
		});
	}

	return {
		legacyJazzId,
		name: name.slice(0, 200),
		description:
			stringValue(collectionData.description)?.slice(0, 2_000) ?? null,
		color: stringValue(collectionData.color)?.slice(0, 100) ?? null,
		budgetCents: numberValue(collectionData.budget) ?? null,
		defaultViewMode:
			collectionData.viewMode === "grid" || collectionData.viewMode === "table"
				? collectionData.viewMode
				: null,
		publicLayout:
			collectionData.publicLayout === "feature" ? "feature" : "minimal",
		copyPolicy: collectionData.allowCloning === true ? "public" : "disabled",
		positionKey: positionKeyValue,
		nodes,
	};
}

export function exportClassicCollections(
	rootBlocks: unknown,
): ClassicMigrationCollection[] {
	return loadedValues(rootBlocks).flatMap((block, collectionIndex) => {
		const collection = exportClassicCollection(
			block,
			positionKey(collectionIndex),
		);
		return collection ? [collection] : [];
	});
}

export async function exportClassicCollectionsWithMembers(
	rootBlocks: unknown,
	actorUserId: string,
	resolveClerkUserId: ClassicMemberClerkIdResolver,
): Promise<ClassicMigrationCollection[]> {
	assertCompleteList(rootBlocks, "Classic Jazz collections");
	const exported = exportClassicCollections(rootBlocks);
	const blocksById = new Map(
		loadedValues(rootBlocks).flatMap((block) => {
			const id = stringValue(block.$jazz?.id);
			return id ? [[id, block] as const] : [];
		}),
	);

	return Promise.all(
		exported.map(async (collection) => {
			const sourceBlock = blocksById.get(collection.legacyJazzId);
			const directMembers =
				sourceBlock?.$jazz?.owner?.getDirectMembers?.() ?? [];
			const members = (
				await Promise.all(
					directMembers.map(async (member) => {
						const jazzAccountId = stringValue(member.id);
						const role =
							typeof member.role === "string"
								? migrationRole(member.role)
								: null;
						if (!jazzAccountId || !role) return null;
						const userId = await resolveClerkUserId(jazzAccountId);
						if (!userId || userId === actorUserId) return null;
						return { userId, role };
					}),
				)
			).filter((member): member is ClassicMigrationMember => member !== null);

			return {
				...collection,
				members: Array.from(
					new Map(members.map((member) => [member.userId, member])).values(),
				),
			};
		}),
	);
}
