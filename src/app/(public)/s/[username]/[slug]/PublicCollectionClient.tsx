"use client";

import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";
import { JazzReactProvider, useCoState } from "jazz-tools/react";
import Link from "next/link";
import { apiKey } from "../../../../../apiKey";
import { Block } from "../../../../../schema";
import styles from "../../../view/[id]/page.module.css";

/**
 * Shared client component for rendering a public collection in guest mode.
 * Used by both /s/[username]/[slug] and /view/[id].
 */
export function PublicCollectionClient({
	collectionId,
	creatorUsername,
}: {
	collectionId: string;
	creatorUsername?: string;
}) {
	return (
		<JazzReactProvider
			guestMode
			sync={{
				peer: `wss://cloud.jazz.tools/?key=${apiKey}`,
			}}
		>
			<PublicCollectionViewer
				collectionId={collectionId}
				creatorUsername={creatorUsername}
			/>
		</JazzReactProvider>
	);
}

function PublicCollectionViewer({
	collectionId,
	creatorUsername,
}: {
	collectionId: string;
	creatorUsername?: string;
}) {
	const collection = useCoState(Block, collectionId as `co_z${string}`, {
		resolve: {
			children: {
				$each: {
					children: { $each: {} },
				},
			},
		},
	});

	const isLoading =
		!collection || !collection.$isLoaded || collection.type === undefined;

	if (isLoading) {
		return (
			<div className={styles.container}>
				<div className={styles.card}>
					<div className={styles.spinner} />
					<p className={styles.loadingText}>Loading collection...</p>
				</div>
			</div>
		);
	}

	if (collection.type !== "collection") {
		return (
			<div className={styles.container}>
				<div className={styles.card}>
					<div className={styles.errorIcon}>!</div>
					<h1 className={styles.title}>Not Found</h1>
					<p className={styles.description}>This is not a valid collection.</p>
				</div>
			</div>
		);
	}

	const isPublishedCollection = !!collection.collectionData?.sourceId;
	const publicLayout = collection.collectionData?.publicLayout ?? "minimal";
	if (!isPublishedCollection) {
		return (
			<div className={styles.container}>
				<div className={styles.card}>
					<div className={styles.errorIcon}>!</div>
					<h1 className={styles.title}>Private Collection</h1>
					<p className={styles.description}>
						This collection is not publicly viewable.
					</p>
				</div>
			</div>
		);
	}

	// Build JSON-LD structured data for the collection and its products
	const products = collectProducts(collection);
	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "ItemList",
		name: collection.name,
		...(collection.collectionData?.description && {
			description: collection.collectionData.description,
		}),
		numberOfItems: products.length,
		itemListElement: products.map((product, index) => ({
			"@type": "ListItem",
			position: index + 1,
			item: {
				"@type": "Product",
				name: product.name,
				...(product.url && { url: product.url }),
				...(product.imageUrl && { image: product.imageUrl }),
				...(product.description && { description: product.description }),
				...(product.price && {
					offers: {
						"@type": "Offer",
						price: product.price.replace(/[^0-9.]/g, ""),
						priceCurrency: "USD",
					},
				}),
			},
		})),
	};

	return (
		<div className={styles.pageContainer}>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
			/>
			<header
				className={`${styles.header} ${publicLayout === "feature" ? styles.headerFeature : styles.headerMinimal}`}
			>
				<div
					className={`${styles.headerContent} ${publicLayout === "feature" ? styles.headerContentFeature : ""}`}
				>
					<div className={styles.titleSection}>
						<div className={styles.titleBlock}>
							<div className={styles.titleRow}>
								{collection.collectionData?.color && (
									<div
										className={styles.colorIndicator}
										style={{ backgroundColor: collection.collectionData.color }}
									/>
								)}
								<h1 className={styles.pageTitle}>{collection.name}</h1>
							</div>
							{creatorUsername && (
								<p className={styles.attribution}>
									Created by {creatorUsername}
								</p>
							)}
						</div>
						{collection.collectionData?.allowCloning && (
							<div className={styles.headerAction}>
								<TemplateCta collectionId={collectionId} />
							</div>
						)}
					</div>
					{collection.collectionData?.description && (
						<p
							className={`${styles.pageDescription} ${publicLayout === "feature" ? styles.pageDescriptionFeature : ""}`}
						>
							{collection.collectionData.description}
						</p>
					)}
					<div className={styles.pageMeta}>
						<span>
							{products.length} {products.length === 1 ? "item" : "items"}
						</span>
						{collection.children?.$isLoaded && (
							<span>
								{
									collection.children.filter(
										(child) =>
											child && child.$isLoaded && child.type === "slot",
									).length
								}{" "}
								sections
							</span>
						)}
					</div>
				</div>
			</header>

			<main className={styles.main}>
				<ChildBlocksLoader
					collection={collection}
					childBlockIds={collection.collectionData?.childBlockIds || []}
				/>
			</main>

			<footer className={styles.footer}>
				<p>
					Powered by{" "}
					<a href="/" className={styles.footerLink}>
						Tote
					</a>
				</p>
			</footer>
		</div>
	);
}

function TemplateCta({ collectionId }: { collectionId: string }) {
	const cloneHref = `/clone/${collectionId}`;

	return (
		<>
			<SignedIn>
				<Link href={cloneHref} className={styles.headerActionButton}>
					<CopyIcon />
					<span>Make a copy</span>
				</Link>
			</SignedIn>
			<SignedOut>
				<SignUpButton mode="modal" fallbackRedirectUrl={cloneHref}>
					<button type="button" className={styles.headerActionButton}>
						<CopyIcon />
						<span>Make a copy</span>
					</button>
				</SignUpButton>
			</SignedOut>
		</>
	);
}

function CopyIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
			<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
		</svg>
	);
}

/** Extract all product data from a loaded collection for structured data */
function collectProducts(collection: any): Array<{
	name: string;
	url?: string;
	imageUrl?: string;
	price?: string;
	description?: string;
}> {
	const products: Array<{
		name: string;
		url?: string;
		imageUrl?: string;
		price?: string;
		description?: string;
	}> = [];

	if (!collection.children?.$isLoaded) return products;

	for (const child of collection.children) {
		if (!child || !child.$isLoaded) continue;

		if (child.type === "product") {
			products.push({
				name: child.name,
				url: child.productData?.url,
				imageUrl: child.productData?.imageUrl,
				price: child.productData?.price,
				description: child.productData?.description,
			});
		} else if (child.type === "slot" && child.children?.$isLoaded) {
			for (const slotChild of child.children) {
				if (slotChild && slotChild.$isLoaded && slotChild.type === "product") {
					products.push({
						name: slotChild.name,
						url: slotChild.productData?.url,
						imageUrl: slotChild.productData?.imageUrl,
						price: slotChild.productData?.price,
						description: slotChild.productData?.description,
					});
				}
			}
		}
	}

	return products;
}

function ChildBlocksLoader({
	collection,
	childBlockIds,
}: {
	collection: any;
	childBlockIds: string[];
}) {
	const childrenFromList: any[] = [];
	if (collection.children?.$isLoaded) {
		for (const child of collection.children) {
			if (child && child.$isLoaded) {
				childrenFromList.push(child);
			}
		}
	}

	const hasChildrenList = childrenFromList.length > 0;

	if (!hasChildrenList && childBlockIds.length === 0) {
		return (
			<div className={styles.emptyState}>
				<p>This collection is empty.</p>
			</div>
		);
	}

	if (hasChildrenList) {
		const slots = childrenFromList.filter((b) => b.type === "slot");
		const products = childrenFromList.filter((b) => b.type === "product");

		return (
			<>
				{slots.map((slot: any) => (
					<SlotRenderer key={slot.$jazz.id} slot={slot} />
				))}
				{products.length > 0 && (
					<div className={styles.productGrid}>
						{products.map((block: any) => (
							<ProductRenderer key={block.$jazz.id} block={block} />
						))}
					</div>
				)}
			</>
		);
	}

	return (
		<div className={styles.productGrid}>
			{childBlockIds.map((blockId) => (
				<ChildBlockRenderer key={blockId} blockId={blockId} />
			))}
		</div>
	);
}

function SlotRenderer({ slot }: { slot: any }) {
	const products: any[] = [];
	if (slot.children?.$isLoaded) {
		for (const child of slot.children) {
			if (child && child.$isLoaded && child.type === "product") {
				products.push(child);
			}
		}
	}

	if (products.length === 0) return null;

	return (
		<div className={styles.slotSection}>
			<h3 className={styles.slotTitle}>{slot.name || "Unnamed slot"}</h3>
			<div className={styles.productGrid}>
				{products.map((block: any) => (
					<ProductRenderer key={block.$jazz.id} block={block} />
				))}
			</div>
		</div>
	);
}

function ProductRenderer({ block }: { block: any }) {
	const productData = block.productData;

	return (
		<a
			href={productData?.url}
			target="_blank"
			rel="noopener noreferrer"
			className={styles.productCard}
		>
			{productData?.imageUrl && (
				<div className={styles.productImage}>
					<img src={productData.imageUrl} alt={block.name} />
				</div>
			)}
			<div className={styles.productInfo}>
				<h3 className={styles.productName}>{block.name}</h3>
				{productData?.price && (
					<p className={styles.productPrice}>{productData.price}</p>
				)}
				{productData?.description && (
					<p className={styles.productDescription}>{productData.description}</p>
				)}
				{productData?.notes && (
					<p className={styles.productNote}>{productData.notes}</p>
				)}
			</div>
		</a>
	);
}

function ChildBlockRenderer({ blockId }: { blockId: string }) {
	const block = useCoState(Block, blockId as `co_z${string}`, {});

	if (!block) {
		return <div className={styles.productCard}>Loading...</div>;
	}

	if (block.type !== "product") return null;

	return <ProductRenderer block={block} />;
}
