-- Some published_collections rows ended up with updated_at/published_at set to
-- the Postgres special value 'infinity' (or '-infinity'). The sitemap serializes
-- that as the literal text "Infinity" inside <lastmod>, which Google Search
-- Console rejects as an invalid date. Reset any such rows to the current time.
UPDATE published_collections
SET updated_at = now()
WHERE updated_at = 'infinity' OR updated_at = '-infinity';

UPDATE published_collections
SET published_at = now()
WHERE published_at = 'infinity' OR published_at = '-infinity';
