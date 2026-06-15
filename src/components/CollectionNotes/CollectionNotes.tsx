"use client";

import type { co } from "jazz-tools";
import { Group } from "jazz-tools";
import { useState } from "react";
import { type Block, CollectionNote, CollectionNoteList } from "../../schema";
import styles from "./CollectionNotes.module.css";

type LoadedBlock = co.loaded<typeof Block>;
type LoadedNote = co.loaded<typeof CollectionNote>;

interface CollectionNotesProps {
	collection: LoadedBlock;
	onResolveWithAI?: (seedContext: string) => void;
}

export function CollectionNotes({
	collection,
	onResolveWithAI,
}: CollectionNotesProps) {
	const [open, setOpen] = useState(true);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editText, setEditText] = useState("");
	const [editUrl, setEditUrl] = useState("");
	const [addText, setAddText] = useState("");
	const [addUrl, setAddUrl] = useState("");
	const [showAddUrl, setShowAddUrl] = useState(false);

	const notes = collection.notes;
	const noteItems: LoadedNote[] = [];
	if (notes?.$isLoaded) {
		for (const n of notes) {
			if (n?.$isLoaded) noteItems.push(n);
		}
	}

	const pendingCount = noteItems.filter((n) => !n.done).length;

	async function getOwnerGroup(): Promise<Group> {
		const sharingGroupId = collection.collectionData?.sharingGroupId;
		if (sharingGroupId) {
			const g = await Group.load(sharingGroupId as `co_z${string}`, {});
			if (g) return g;
		}
		return Group.create({ owner: undefined as never });
	}

	async function handleAdd(e: React.FormEvent) {
		e.preventDefault();
		const text = addText.trim();
		if (!text) return;

		const group = await getOwnerGroup();
		const note = CollectionNote.create(
			{
				text,
				url: addUrl.trim() || undefined,
				done: false,
				createdAt: new Date(),
			},
			{ owner: group },
		);

		if (notes?.$isLoaded) {
			notes.$jazz.push(note);
		} else {
			const list = CollectionNoteList.create([note], { owner: group });
			collection.$jazz.set("notes", list);
		}

		setAddText("");
		setAddUrl("");
		setShowAddUrl(false);
	}

	function startEdit(note: LoadedNote) {
		setEditingId(note.$jazz.id);
		setEditText(note.text);
		setEditUrl(note.url ?? "");
	}

	function handleSaveEdit(note: LoadedNote) {
		const text = editText.trim();
		if (!text) return;
		note.$jazz.set("text", text);
		note.$jazz.set("url", editUrl.trim() || undefined);
		setEditingId(null);
	}

	function handleToggleDone(note: LoadedNote) {
		note.$jazz.set("done", !note.done);
	}

	function handleDelete(note: LoadedNote) {
		if (!notes?.$isLoaded) return;
		const idx = noteItems.findIndex((n) => n.$jazz.id === note.$jazz.id);
		if (idx !== -1) notes.$jazz.splice(idx, 1);
	}

	function handleResolve(note: LoadedNote) {
		if (!onResolveWithAI) return;

		const context = note.url
			? `${note.text} (reference: ${note.url})`
			: note.text;
		onResolveWithAI(context);
	}

	if (!notes?.$isLoaded && noteItems.length === 0 && !open) return null;

	return (
		<div className={styles.section}>
			<button
				type="button"
				className={styles.header}
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
			>
				<span className={styles.headerLabel}>Notes</span>
				{pendingCount > 0 && (
					<span className={styles.badge}>{pendingCount}</span>
				)}
				<svg
					className={`${styles.chevron} ${open ? styles.open : ""}`}
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<polyline points="6 9 12 15 18 9" />
				</svg>
			</button>

			{open && (
				<div className={styles.body}>
					{noteItems.map((note) => (
						<div
							key={note.$jazz.id}
							className={`${styles.note} ${note.done ? styles.done : ""}`}
						>
							<input
								type="checkbox"
								className={styles.checkbox}
								checked={!!note.done}
								onChange={() => handleToggleDone(note)}
								aria-label="Mark complete"
							/>

							{editingId === note.$jazz.id ? (
								<div className={styles.editRow}>
									<textarea
										className={styles.editInput}
										value={editText}
										onChange={(e) => setEditText(e.target.value)}
										rows={2}
										autoFocus
									/>
									<input
										type="url"
										className={styles.editUrlInput}
										value={editUrl}
										onChange={(e) => setEditUrl(e.target.value)}
										placeholder="URL (optional)"
									/>
									<div className={styles.editButtons}>
										<button
											type="button"
											className="btn btn-primary btn-sm"
											onClick={() => handleSaveEdit(note)}
										>
											Save
										</button>
										<button
											type="button"
											className="btn btn-secondary btn-sm"
											onClick={() => setEditingId(null)}
										>
											Cancel
										</button>
									</div>
								</div>
							) : (
								<div className={styles.noteBody}>
									<span className={styles.noteText}>{note.text}</span>
									{note.url && (
										<a
											href={note.url}
											target="_blank"
											rel="noopener noreferrer"
											className={styles.noteUrl}
											onClick={(e) => e.stopPropagation()}
										>
											{(() => {
												try {
													return new URL(note.url).hostname;
												} catch {
													return note.url;
												}
											})()}
											{" ↗"}
										</a>
									)}
								</div>
							)}

							{editingId !== note.$jazz.id && (
								<div className={styles.noteActions}>
									{onResolveWithAI && (
										<button
											type="button"
											className={styles.resolveButton}
											onClick={() => handleResolve(note)}
											title="Find products with AI"
										>
											Find with AI
										</button>
									)}
									<button
										type="button"
										className={styles.iconButton}
										onClick={() => startEdit(note)}
										aria-label="Edit"
										title="Edit"
									>
										✏
									</button>
									<button
										type="button"
										className={styles.iconButton}
										onClick={() => handleDelete(note)}
										aria-label="Delete"
										title="Delete"
									>
										✕
									</button>
								</div>
							)}
						</div>
					))}

					<form onSubmit={handleAdd} className={styles.addForm}>
						<div className={styles.addRow}>
							<input
								type="text"
								className={styles.addInput}
								value={addText}
								onChange={(e) => setAddText(e.target.value)}
								placeholder="Add a note…"
								onFocus={() => setShowAddUrl(true)}
							/>
							<button
								type="submit"
								className="btn btn-primary btn-sm"
								disabled={!addText.trim()}
							>
								Add
							</button>
						</div>
						{showAddUrl && (
							<input
								type="url"
								className={styles.addUrlInput}
								value={addUrl}
								onChange={(e) => setAddUrl(e.target.value)}
								placeholder="URL (optional)"
							/>
						)}
					</form>
				</div>
			)}
		</div>
	);
}
