# Curation: How Many Items to Show

Research summary informing item counts in the curate-collection skill.

## Core findings

**The jam study (Iyengar & Lepper, 2000)** is the landmark data point: 24 options → 3% purchase rate, 6 options → 30%. That's the outer bound of the effect — real ecommerce rarely replicates this magnitude, but the direction is consistent.

**Etsy's A/B test (2012)** is the clearest real-world signal: switching to infinite scroll dropped conversion 22%. They reverted. The engineer's post-mortem: "We thought that more items, faster was obviously better." It wasn't.

**Baymard Institute** recommends 24–48 items as the default initial load for standard ecommerce grids, interrupted by "Load More" (not infinite scroll). Lazy load + Load More consistently outperforms both pagination and infinite scroll in usability tests.

**Scheibehenne et al. meta-analysis (2010)** of 50 experiments: mean effect size of choice overload is near zero — meaning the effect is real but conditional, not guaranteed. Context matters enormously.

## When fewer options matter most

Choice overload is strongest when:
- The buyer has no clear preference going in (gift buying, unfamiliar category)
- Options are hard to compare across different dimensions
- Stakes feel high
- The buyer is a "maximizer" who feels compelled to evaluate everything

It's weakest when:
- The buyer has domain knowledge and intent
- Options are clearly differentiated from each other
- It's a repeat or low-consideration purchase

**Gift buying specifically** amplifies overload — the buyer is uncertain about the recipient's preferences, raising decision anxiety. Research (Papadopoulou, 2019) found 2 gift options outperformed 5 in a controlled experiment.

## Platform behavior

| Platform | Approach | Notes |
|---|---|---|
| Amazon | 24 per page, paginated | Persistent choice — never moved to infinite scroll |
| Etsy | ~48 per page, paginated | Reverted from infinite scroll after 22% conversion drop |
| Google Shopping | Infinite scroll (as of Oct 2024) | Outlier among transactional platforms |
| Net-a-Porter / SSENSE | Load More, editorial grids | Luxury platforms deliberately limit visible product density |

## Implications for curated collections

The key insight: **the number of items matters less than whether the set is pre-screened for relevance**. A curated 12-item gift guide outperforms a 200-item catalog not primarily because 12 < 200, but because the 12 have been filtered for the buyer's context.

For editorial shortlists (what the curate-collection skill produces), item count should be calibrated to the collection's purpose:

| Context | Target per section | Rationale |
|---|---|---|
| Public demo / gift / low-familiarity buyer | 3–5 | Decision anxiety is high; pre-screening does the heavy lifting |
| Personal reference (buyer has domain knowledge) | 5–8 | Buyer can scan efficiently; more options aid comparison |
| High-consideration item (furniture, tools, electronics) | Fewer, more differentiated | Comparison fatigue; clear differentiation > more options |
| Low-consideration item (consumables, basics) | Can go wider | Familiar domain, lower stakes |

Uniform section counts (every section has exactly 3) are a red flag — they signal template-filling, not genuine curation. Section depth should reflect how many options genuinely earn their place.

## Sources

- Iyengar & Lepper (2000) — [APA PsycNet](https://psycnet.apa.org/record/2000-16701-012)
- Scheibehenne, Greifeneder & Todd (2010) — [PDF](https://scheibehenne.com/ScheibehenneGreifenederTodd2010.pdf)
- Chernev et al. (2015) choice overload meta-analysis — [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S1057740814000916)
- Baymard Institute: [Number of products to load by default](https://baymard.com/blog/number-of-items-loaded-by-default)
- Etsy infinite scroll post-mortem — [danwin.com](https://danwin.com/2013/01/infinite-scroll-fail-etsy/)
- Papadopoulou (2019) gift choice overload — [Wiley](https://onlinelibrary.wiley.com/doi/10.1002/mar.21207)
- CXL: [Does offering more choices tank conversions?](https://cxl.com/blog/does-offering-more-choices-actually-tank-conversions/)
