type ReorderableItem = {
	$jazz?: {
		id?: string;
	};
} | null;

type ReorderableList = {
	$isLoaded?: boolean;
	length: number;
	[index: number]: ReorderableItem;
	$jazz: {
		splice: (
			start: number,
			deleteCount: number,
			...items: ReorderableItem[]
		) => void;
	};
};

export function reorderBlockList(
	list: ReorderableList,
	fromIndex: number,
	toIndex: number,
): void {
	if (list.$isLoaded === false) return;
	if (fromIndex === toIndex) return;
	if (fromIndex < 0 || fromIndex >= list.length) return;
	if (toIndex < 0 || toIndex >= list.length) return;

	const item = list[fromIndex];
	if (!item) return;

	list.$jazz.splice(fromIndex, 1);
	list.$jazz.splice(toIndex, 0, item);
}

export function reorderIdsFromPositions<T extends { $jazz?: { id?: string } }>(
	items: T[],
	positions?: Record<string, number>,
): string[] {
	if (!positions) {
		return items
			.map((item) => item.$jazz?.id)
			.filter((id): id is string => Boolean(id));
	}

	return [...items]
		.sort((a, b) => {
			const aId = a.$jazz?.id ?? "";
			const bId = b.$jazz?.id ?? "";
			return (positions[aId] ?? 0) - (positions[bId] ?? 0);
		})
		.map((item) => item.$jazz?.id)
		.filter((id): id is string => Boolean(id));
}

export function applySubsetOrderByIds(
	list: ReorderableList,
	orderedIds: string[],
	predicate: (item: ReorderableItem) => boolean,
): void {
	if (list.$isLoaded === false) return;

	const subsetPositions: number[] = [];
	for (let index = 0; index < list.length; index += 1) {
		if (predicate(list[index])) {
			subsetPositions.push(index);
		}
	}

	if (subsetPositions.length !== orderedIds.length) return;

	const orderedItems = orderedIds
		.map((id) => {
			for (let index = 0; index < list.length; index += 1) {
				const item = list[index];
				if (item?.$jazz?.id === id) return item;
			}
			return null;
		})
		.filter((item): item is Exclude<ReorderableItem, null> => Boolean(item));

	if (orderedItems.length !== orderedIds.length) return;

	const desiredIds = new Array<string>(list.length);
	let subsetCursor = 0;

	for (let index = 0; index < list.length; index += 1) {
		const item = list[index];
		if (!item?.$jazz?.id) continue;

		if (predicate(item)) {
			desiredIds[index] = orderedItems[subsetCursor].$jazz?.id ?? "";
			subsetCursor += 1;
		} else {
			desiredIds[index] = item.$jazz.id;
		}
	}

	for (let targetIndex = 0; targetIndex < desiredIds.length; targetIndex += 1) {
		const targetId = desiredIds[targetIndex];
		if (!targetId) continue;

		let currentIndex = -1;
		for (let index = 0; index < list.length; index += 1) {
			if (list[index]?.$jazz?.id === targetId) {
				currentIndex = index;
				break;
			}
		}

		if (currentIndex !== -1 && currentIndex !== targetIndex) {
			reorderBlockList(list, currentIndex, targetIndex);
		}
	}
}
