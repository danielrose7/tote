"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CollectionNode } from "../../db/schema";
import styles from "../SlotSelector/SlotSelector.module.css";

interface NeonSectionSelectorProps {
	value: string | null;
	onChange: (sectionId: string | null) => void;
	sections: CollectionNode[];
	onCreateSection: (name: string) => Promise<string>;
	disabled?: boolean;
}

export function NeonSectionSelector({
	value,
	onChange,
	sections,
	onCreateSection,
	disabled = false,
}: NeonSectionSelectorProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [inputValue, setInputValue] = useState("");
	const [highlightedIndex, setHighlightedIndex] = useState(-1);
	const [isCreating, setIsCreating] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLUListElement>(null);

	const selectedSection = value ? sections.find((s) => s.id === value) : null;

	const filteredSections = inputValue
		? sections.filter((s) =>
				(s.title ?? "").toLowerCase().includes(inputValue.toLowerCase()),
			)
		: sections;

	const exactMatch = sections.some(
		(s) => (s.title ?? "").toLowerCase() === inputValue.toLowerCase(),
	);
	const showCreateOption = inputValue.trim() !== "" && !exactMatch;

	const totalItems = filteredSections.length + (showCreateOption ? 1 : 0);

	useEffect(() => {
		setHighlightedIndex(-1);
	}, [inputValue]);

	useEffect(() => {
		if (highlightedIndex >= 0 && listRef.current) {
			const item = listRef.current.children[highlightedIndex] as HTMLElement;
			item?.scrollIntoView({ block: "nearest" });
		}
	}, [highlightedIndex]);

	const handleSelect = useCallback(
		(sectionId: string) => {
			onChange(sectionId);
			setInputValue("");
			setIsOpen(false);
			setHighlightedIndex(-1);
		},
		[onChange],
	);

	const handleCreate = useCallback(async () => {
		if (!inputValue.trim() || isCreating) return;
		setIsCreating(true);
		try {
			const newId = await onCreateSection(inputValue.trim());
			onChange(newId);
			setInputValue("");
			setIsOpen(false);
		} finally {
			setIsCreating(false);
		}
	}, [inputValue, isCreating, onCreateSection, onChange]);

	const handleClear = useCallback(() => {
		onChange(null);
		setInputValue("");
	}, [onChange]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (disabled) return;
		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				if (!isOpen) {
					setIsOpen(true);
				} else {
					setHighlightedIndex((prev) =>
						prev < totalItems - 1 ? prev + 1 : prev,
					);
				}
				break;
			case "ArrowUp":
				e.preventDefault();
				setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
				break;
			case "Enter":
				e.preventDefault();
				if (highlightedIndex >= 0) {
					if (highlightedIndex < filteredSections.length) {
						handleSelect(filteredSections[highlightedIndex].id);
					} else if (showCreateOption) {
						void handleCreate();
					}
				} else if (showCreateOption) {
					void handleCreate();
				}
				break;
			case "Escape":
				setIsOpen(false);
				setHighlightedIndex(-1);
				break;
		}
	};

	return (
		<div className={styles.container}>
			<div className={styles.inputWrapper}>
				{selectedSection && !isOpen ? (
					<div className={styles.selectedValue}>
						<span className={styles.selectedText}>
							{selectedSection.title || "Untitled section"}
						</span>
						{!disabled && (
							<button
								type="button"
								className={styles.clearButton}
								onClick={handleClear}
								aria-label="Clear selection"
							>
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
								>
									<line x1="18" y1="6" x2="6" y2="18" />
									<line x1="6" y1="6" x2="18" y2="18" />
								</svg>
							</button>
						)}
					</div>
				) : (
					<input
						ref={inputRef}
						type="text"
						value={inputValue}
						onChange={(e) => {
							setInputValue(e.target.value);
							if (!isOpen) setIsOpen(true);
						}}
						onFocus={() => setIsOpen(true)}
						onBlur={() => setTimeout(() => setIsOpen(false), 150)}
						onKeyDown={handleKeyDown}
						placeholder="Add to section (optional)"
						className={styles.input}
						disabled={disabled}
						aria-expanded={isOpen}
						aria-haspopup="listbox"
						role="combobox"
					/>
				)}
			</div>

			{isOpen && !disabled && (
				<ul ref={listRef} className={styles.dropdown} role="listbox">
					{filteredSections.map((section, index) => (
						<li
							key={section.id}
							className={`${styles.option} ${highlightedIndex === index ? styles.highlighted : ""} ${value === section.id ? styles.selected : ""}`}
							onClick={() => handleSelect(section.id)}
							role="option"
							aria-selected={value === section.id}
						>
							{section.title || "Untitled section"}
						</li>
					))}
					{showCreateOption && (
						<li
							className={`${styles.option} ${styles.createOption} ${highlightedIndex === filteredSections.length ? styles.highlighted : ""}`}
							onClick={() => void handleCreate()}
							role="option"
						>
							{isCreating ? (
								"Creating..."
							) : (
								<>
									<svg
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
									>
										<line x1="12" y1="5" x2="12" y2="19" />
										<line x1="5" y1="12" x2="19" y2="12" />
									</svg>
									Create &ldquo;{inputValue.trim()}&rdquo;
								</>
							)}
						</li>
					)}
					{filteredSections.length === 0 && !showCreateOption && (
						<li className={styles.empty}>
							{sections.length === 0
								? "No sections yet. Type to create one."
								: "No matching sections"}
						</li>
					)}
				</ul>
			)}
		</div>
	);
}
