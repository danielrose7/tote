// Patterns to exclude from image URLs (logos, icons, tracking pixels, etc.)
const IMAGE_EXCLUDE_PATTERNS =
	/logo|icon|favicon|sprite|placeholder|spacer|pixel|tracking|badge|avatar|rating|star|wordmark|share.?image/i;

export function isExcludedImage(url: string | undefined): boolean {
	if (!url) return false;
	return IMAGE_EXCLUDE_PATTERNS.test(url);
}

export function filterImageUrl(url: string | undefined): string | undefined {
	if (!url || isExcludedImage(url)) return undefined;
	return url;
}
