"use client";

import { useState } from "react";
import { formatPrice } from "../../lib/formatPrice";
import styles from "./ProductSuggestionCard.module.css";

export interface SuggestedProduct {
	title: string | null;
	url: string;
	imageUrl: string | null;
	price: string | null;
	currency: string | null;
	brand: string | null;
	description: string | null;
}

export interface SuggestedCollection {
	type: "collection";
	title: string | null;
	url: string;
	products: SuggestedProduct[];
}

interface ProductSuggestionCardProps {
	product: SuggestedProduct;
	onAdd?: () => void; // undefined = no collection to add to
}

interface CollectionSuggestionCardProps {
	collection: SuggestedCollection;
	onAddProduct?: (product: SuggestedProduct) => void;
}

function formatSuggestedPrice(product: SuggestedProduct): string | null {
	return product.price ? formatPrice(product.price, product.currency) : null;
}

function normalizeDisplayUrl(
	url: string | null,
	baseUrl?: string,
): string | null {
	if (!url) return null;
	try {
		return new URL(url, baseUrl).href;
	} catch {
		return url.startsWith("//") ? `https:${url}` : url;
	}
}

function getHostname(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return "this store";
	}
}

export function ProductSuggestionCard({
	product,
	onAdd,
}: ProductSuggestionCardProps) {
	const [added, setAdded] = useState(false);

	function handleAdd() {
		onAdd?.();
		setAdded(true);
	}

	const displayPrice = formatSuggestedPrice(product);
	const imageUrl = normalizeDisplayUrl(product.imageUrl, product.url);
	const productUrl = normalizeDisplayUrl(product.url) ?? product.url;

	return (
		<div className={styles.card}>
			{imageUrl && (
				<a
					href={productUrl}
					target="_blank"
					rel="noopener noreferrer"
					className={styles.imageLink}
					aria-label={`Open ${product.title ?? "product"}`}
				>
					<img
						src={imageUrl}
						alt={product.title ?? ""}
						className={styles.image}
						loading="lazy"
					/>
					<span className={styles.imageOverlay} aria-hidden="true" />
				</a>
			)}
			<div className={styles.body}>
				<p className={styles.title}>{product.title ?? "Untitled product"}</p>
				<div className={styles.meta}>
					{product.brand && (
						<span className={styles.brand}>{product.brand}</span>
					)}
					{displayPrice && <span className={styles.price}>{displayPrice}</span>}
				</div>
				{product.description && (
					<p className={styles.description}>{product.description}</p>
				)}
				<div className={styles.actions}>
					{onAdd !== undefined && (
						<button
							type="button"
							className={styles.addButton}
							onClick={handleAdd}
							disabled={added}
						>
							{added ? "✓ Added" : "Add to Tote"}
						</button>
					)}
					<a
						href={productUrl}
						target="_blank"
						rel="noopener noreferrer"
						className={styles.visitLink}
					>
						Visit ↗
					</a>
				</div>
			</div>
		</div>
	);
}

function CollectionProductRow({
	product,
	onAdd,
}: {
	product: SuggestedProduct;
	onAdd?: () => void;
}) {
	const [added, setAdded] = useState(false);
	const displayPrice = formatSuggestedPrice(product);
	const imageUrl = normalizeDisplayUrl(product.imageUrl, product.url);
	const productUrl = normalizeDisplayUrl(product.url) ?? product.url;

	function handleAdd() {
		onAdd?.();
		setAdded(true);
	}

	return (
		<div className={styles.collectionProduct}>
			{imageUrl && (
				<a
					href={productUrl}
					target="_blank"
					rel="noopener noreferrer"
					className={styles.collectionImageLink}
					aria-label={`Open ${product.title ?? "product"}`}
				>
					<img
						src={imageUrl}
						alt={product.title ?? ""}
						className={styles.collectionImage}
						loading="lazy"
					/>
					<span className={styles.imageOverlay} aria-hidden="true" />
				</a>
			)}
			<div className={styles.collectionProductBody}>
				<p className={styles.collectionProductTitle}>
					{product.title ?? "Product"}
				</p>
				{displayPrice && (
					<span className={styles.collectionProductPrice}>{displayPrice}</span>
				)}
			</div>
			<div className={styles.collectionProductActions}>
				{onAdd !== undefined && (
					<button
						type="button"
						className={styles.smallAddButton}
						onClick={handleAdd}
						disabled={added}
					>
						{added ? "✓" : "Add"}
					</button>
				)}
				<a
					href={productUrl}
					target="_blank"
					rel="noopener noreferrer"
					className={styles.visitLink}
				>
					Visit ↗
				</a>
			</div>
		</div>
	);
}

export function CollectionSuggestionCard({
	collection,
	onAddProduct,
}: CollectionSuggestionCardProps) {
	const collectionUrl = normalizeDisplayUrl(collection.url) ?? collection.url;
	const host = getHostname(collectionUrl);
	const count = collection.products.length;
	return (
		<div className={styles.collectionCard}>
			<div className={styles.collectionHeader}>
				<div>
					<p className={styles.collectionSource}>From {host}</p>
					<p className={styles.title}>
						{count} {count === 1 ? "option" : "options"} from this store
					</p>
				</div>
				<a
					href={collectionUrl}
					target="_blank"
					rel="noopener noreferrer"
					className={styles.visitLink}
				>
					Open ↗
				</a>
			</div>
			<div className={styles.collectionProducts}>
				{collection.products.map((product) => (
					<CollectionProductRow
						key={product.url}
						product={product}
						onAdd={onAddProduct ? () => onAddProduct(product) : undefined}
					/>
				))}
			</div>
		</div>
	);
}
