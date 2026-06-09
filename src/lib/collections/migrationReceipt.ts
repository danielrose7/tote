export type MigrationVerificationInput = {
	sourceCollectionCount: number;
	sourceItemCount: number;
	importedCollectionCount: number;
	importedItemCount: number;
	sourceFingerprint: string;
	importFingerprint: string;
};

export type MigrationVerificationResult =
	| { verified: true }
	| {
			verified: false;
			reasons: string[];
	  };

export function verifyMigrationReceipt(
	input: MigrationVerificationInput,
): MigrationVerificationResult {
	const reasons: string[] = [];

	if (input.sourceCollectionCount !== input.importedCollectionCount) {
		reasons.push("collection_count_mismatch");
	}

	if (input.sourceItemCount !== input.importedItemCount) {
		reasons.push("item_count_mismatch");
	}

	if (
		input.sourceFingerprint.length === 0 ||
		input.sourceFingerprint !== input.importFingerprint
	) {
		reasons.push("fingerprint_mismatch");
	}

	return reasons.length === 0
		? { verified: true }
		: { verified: false, reasons };
}

export function getRollbackExpiration(
	cutoverAt: Date,
	retentionDays = 14,
): Date {
	if (!Number.isInteger(retentionDays) || retentionDays <= 0) {
		throw new RangeError("retentionDays must be a positive integer");
	}

	return new Date(cutoverAt.getTime() + retentionDays * 24 * 60 * 60 * 1000);
}
