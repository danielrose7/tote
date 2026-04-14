"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { AuthButton } from "../../AuthButton";
import styles from "./Header.module.css";

interface Breadcrumb {
	label: string;
	href?: string;
}

interface HeaderProps {
	onAddLinkClick?: () => void;
	onAddCollectionClick?: () => void;
	onSaveTabsClick?: () => void;
	showAddLink?: boolean;
	showAddCollection?: boolean;
	showSaveTabs?: boolean;
	showImport?: boolean;
	breadcrumbs?: Breadcrumb[];
}

export function Header({
	onAddLinkClick,
	onAddCollectionClick,
	onSaveTabsClick,
	showAddLink = false,
	showAddCollection = false,
	showSaveTabs = false,
	showImport = false,
	breadcrumbs,
}: HeaderProps) {
	const { user } = useUser();
	const isCurator = user?.publicMetadata?.curator === true;

	return (
		<header className={styles.header}>
			<div className={styles.container}>
				<div className={styles.brandSection}>
					<Link href="/collections" className={styles.brand}>
						<h1 className={styles.title}>tote</h1>
					</Link>
					{breadcrumbs && breadcrumbs.length > 0 && (
						<nav className={styles.breadcrumbs} aria-label="Breadcrumb">
							{breadcrumbs.map((crumb, index) => (
								<span key={crumb.label} className={styles.breadcrumbItem}>
									<span className={styles.breadcrumbSeparator}>/</span>
									{crumb.href ? (
										<Link href={crumb.href} className={styles.breadcrumbLink}>
											{crumb.label}
										</Link>
									) : (
										<span className={styles.breadcrumbCurrent}>
											{crumb.label}
										</span>
									)}
								</span>
							))}
						</nav>
					)}
				</div>

				<div className={styles.actions}>
					{isCurator && (
						<Link href="/curate" className={styles.curatorLink}>
							Curator
						</Link>
					)}
					{showAddLink && onAddLinkClick && (
						<button
							type="button"
							onClick={onAddLinkClick}
							className={styles.addButton}
						>
							+ Add Link
						</button>
					)}
					{showAddCollection && onAddCollectionClick && (
						<button
							type="button"
							onClick={onAddCollectionClick}
							className={styles.addButton}
						>
							+ Add Collection
						</button>
					)}
					{showSaveTabs && onSaveTabsClick && (
						<button
							type="button"
							onClick={onSaveTabsClick}
							className={styles.addButton}
						>
							Save My Tabs
						</button>
					)}
					<AuthButton />
				</div>
			</div>
		</header>
	);
}
