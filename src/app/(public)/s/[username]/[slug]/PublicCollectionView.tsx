import Link from "next/link";
import { PreFooterCta } from "../../../../../components/PreFooterCta";
import { PublicFooter } from "../../../../../components/PublicFooter";
import { StickyCtaBar } from "../../../../../components/StickyCtaBar";
import { formatPrice } from "../../../../../lib/formatPrice";
import type { PublishedCollection } from "../../../../../lib/publishedCollectionsDb";
import styles from "../../../view/[id]/page.module.css";
import { MakeCopyButton } from "./MakeCopyButton";

export function PublicCollectionView({
	collection,
	creatorUsername,
}: {
	collection: PublishedCollection;
	creatorUsername?: string;
}) {
	const publicLayout = collection.layout;
	const allProducts = [
		...collection.topLevelProducts,
		...collection.slots.flatMap((s) => s.products),
	];
	const totalItems = allProducts.length;

	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "ItemList",
		name: collection.name,
		...(collection.description && { description: collection.description }),
		numberOfItems: totalItems,
		itemListElement: allProducts.map((product, index) => ({
			"@type": "ListItem",
			position: index + 1,
			item: {
				"@type": "Product",
				name: product.title,
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
								<h1 className={styles.pageTitle}>{collection.name}</h1>
							</div>
							{creatorUsername && (
								<p className={styles.attribution}>
									Created by {creatorUsername}
								</p>
							)}
						</div>
						{collection.allowCloning && (
							<div className={styles.headerAction}>
								<MakeCopyButton neonId={collection.id} />
							</div>
						)}
					</div>
					{collection.description && (
						<p
							className={`${styles.pageDescription} ${publicLayout === "feature" ? styles.pageDescriptionFeature : ""}`}
						>
							{collection.description}
						</p>
					)}
					<div className={styles.pageMeta}>
						<span>
							{totalItems} {totalItems === 1 ? "item" : "items"}
						</span>
						{collection.slots.length > 0 && (
							<span>{collection.slots.length} sections</span>
						)}
					</div>
				</div>
			</header>

			<main className={styles.main}>
				{collection.slots.length === 0 &&
				collection.topLevelProducts.length === 0 ? (
					<div className={styles.emptyState}>
						<p>This collection is empty.</p>
					</div>
				) : (
					<>
						{collection.slots.map((slot) =>
							slot.products.length > 0 ? (
								<div key={slot.id} className={styles.slotSection}>
									<h3 className={styles.slotTitle}>
										{slot.slotName || "Unnamed section"}
									</h3>
									<div className={styles.productGrid}>
										{slot.products.map((product) => (
											<ProductCard key={product.id} product={product} />
										))}
									</div>
								</div>
							) : null,
						)}
						{collection.topLevelProducts.length > 0 && (
							<div className={styles.productGrid}>
								{collection.topLevelProducts.map((product) => (
									<ProductCard key={product.id} product={product} />
								))}
							</div>
						)}
					</>
				)}
			</main>

			<PreFooterCta
				cloneHref={
					collection.allowCloning ? `/clone/${collection.id}` : undefined
				}
			/>
			<StickyCtaBar
				cloneHref={
					collection.allowCloning ? `/clone/${collection.id}` : undefined
				}
			/>

			<PublicFooter />
		</div>
	);
}

function ProductCard({
	product,
}: {
	product: PublishedCollection["topLevelProducts"][number];
}) {
	return (
		<a
			href={product.url ?? undefined}
			target="_blank"
			rel="noopener noreferrer"
			className={styles.productCard}
		>
			{product.imageUrl && (
				<div className={styles.productImage}>
					<img src={product.imageUrl} alt={product.title ?? ""} />
				</div>
			)}
			<div className={styles.productInfo}>
				<h3 className={styles.productName}>{product.title}</h3>
				{product.price && (
					<p className={styles.productPrice}>{formatPrice(product.price)}</p>
				)}
				{product.description && (
					<p className={styles.productDescription}>{product.description}</p>
				)}
			</div>
		</a>
	);
}
