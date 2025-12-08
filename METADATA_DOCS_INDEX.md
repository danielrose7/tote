# Metadata Extraction Documentation Index

Complete guide to improving metadata extraction quality for Tote.

---

## 🚀 Start Here

### If you want to start testing right now:
→ **[QUICK_START_TESTING.md](./QUICK_START_TESTING.md)**
- 5-minute setup
- Testing checklist
- What to test and how

### If you want to understand the big picture:
→ **[METADATA_TESTING_SETUP.md](./METADATA_TESTING_SETUP.md)**
- Infrastructure overview
- What we built
- How it all fits together
- Next steps

### If you want to see today's progress:
→ **[SESSION_SUMMARY.md](./SESSION_SUMMARY.md)**
- What we accomplished
- Key decisions
- Impact on roadmap
- Next steps in priority order

---

## 📖 Documentation by Purpose

### For Planning & Strategy

**[PLAN.md](./PLAN.md)** - Project roadmap
- Complete feature roadmap
- Current status (Phase 3.5 in progress)
- MVP scope
- Architecture decisions

**[METADATA_INVESTIGATION.md](./METADATA_INVESTIGATION.md)** - Research plan
- 5 phases of investigation
- Problem collection strategy
- Extraction strategies
- Technical architecture options
- Implementation plan

### For Collecting Test Data

**[tests/FINDING_INDIE_SITES.md](./tests/FINDING_INDIE_SITES.md)** - Finding test URLs
- How to identify Shopify themes (Dawn, Debut, etc.)
- How to identify Squarespace templates (Bedford, Brine, etc.)
- Where to find indie sites (Google, Instagram, Reddit)
- Detection methods and tools
- Priority distribution for test suite

**[tests/PLATFORM_METADATA_PATTERNS.md](./tests/PLATFORM_METADATA_PATTERNS.md)** - Extraction reference
- Shopify metadata structure and patterns
- Squarespace patterns by template
- Big Cartel, Gumroad, Ko-fi, Wix, Webflow
- Priority matrix by platform
- Common HTML selectors
- Image URL optimization tricks

### For Using the Test Lab

**[app/dev/metadata-test/README.md](./app/dev/metadata-test/README.md)** - Test Lab features
- How to access the Test Lab
- Feature walkthrough
- File storage details
- Use cases
- Keyboard shortcuts
- API endpoints

**[app/dev/metadata-test/NAVIGATION.md](./app/dev/metadata-test/NAVIGATION.md)** - Navigation guide
- How to access via header menu
- Visual indicators
- Production safety
- Navigation flow

### For Implementation

**[tests/metadata-test-schema.json](./tests/metadata-test-schema.json)** - JSON schema
- Test case structure
- Field definitions
- Validation rules

**[tests/metadata-test-cases.json](./tests/metadata-test-cases.json)** - Test data
- Saved test cases
- Version controlled
- Used for building extraction logic

---

## 🎯 By User Goal

### "I want to start testing URLs"
1. [QUICK_START_TESTING.md](./QUICK_START_TESTING.md) - Quick start
2. [app/dev/metadata-test/README.md](./app/dev/metadata-test/README.md) - Test Lab features
3. [tests/FINDING_INDIE_SITES.md](./tests/FINDING_INDIE_SITES.md) - Finding URLs

### "I want to understand the infrastructure"
1. [METADATA_TESTING_SETUP.md](./METADATA_TESTING_SETUP.md) - Overview
2. [SESSION_SUMMARY.md](./SESSION_SUMMARY.md) - What we built
3. [app/dev/metadata-test/README.md](./app/dev/metadata-test/README.md) - Details

### "I want to understand extraction strategies"
1. [tests/PLATFORM_METADATA_PATTERNS.md](./tests/PLATFORM_METADATA_PATTERNS.md) - Patterns
2. [METADATA_INVESTIGATION.md](./METADATA_INVESTIGATION.md) - Research plan
3. [tests/FINDING_INDIE_SITES.md](./tests/FINDING_INDIE_SITES.md) - Detection methods

### "I want to build custom extraction"
1. [METADATA_INVESTIGATION.md](./METADATA_INVESTIGATION.md) - Phase 3 & 4
2. [tests/PLATFORM_METADATA_PATTERNS.md](./tests/PLATFORM_METADATA_PATTERNS.md) - Reference
3. [tests/metadata-test-cases.json](./tests/metadata-test-cases.json) - Test against these

### "I want to understand the roadmap"
1. [PLAN.md](./PLAN.md) - Complete roadmap
2. [SESSION_SUMMARY.md](./SESSION_SUMMARY.md) - Recent progress
3. [METADATA_INVESTIGATION.md](./METADATA_INVESTIGATION.md) - Next phases

---

## 📂 File Locations

### Documentation (Root)
```
├── README.md                      # Project overview
├── PLAN.md                        # Complete roadmap
├── METADATA_INVESTIGATION.md      # Research plan
├── METADATA_TESTING_SETUP.md      # Infrastructure overview
├── SESSION_SUMMARY.md             # Today's progress
├── QUICK_START_TESTING.md         # Quick start guide
└── METADATA_DOCS_INDEX.md         # This file
```

### Test Infrastructure
```
tests/
├── metadata-test-cases.json       # Saved test cases (version controlled)
├── metadata-test-schema.json      # JSON schema
├── FINDING_INDIE_SITES.md         # How to find test URLs
└── PLATFORM_METADATA_PATTERNS.md  # Extraction strategies
```

### Test Lab Application
```
app/dev/metadata-test/
├── page.tsx                       # Main UI component
├── MetadataTestPage.module.css    # Styling
├── README.md                      # Usage guide
└── NAVIGATION.md                  # Navigation guide
```

### API Routes
```
app/api/dev/test-cases/
└── route.ts                       # File persistence API
```

### Current Extraction Code
```
src/utils/
├── metadata.ts                    # Current Microlink integration
└── metadataExtractor.ts           # Helper functions
```

---

## 🔄 Workflow Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    METADATA IMPROVEMENT WORKFLOW             │
└─────────────────────────────────────────────────────────────┘

Phase 1: Test Collection
├─ Read: QUICK_START_TESTING.md
├─ Read: tests/FINDING_INDIE_SITES.md
├─ Use: /dev/metadata-test
└─ Output: tests/metadata-test-cases.json

Phase 2: Pattern Analysis
├─ Read: tests/PLATFORM_METADATA_PATTERNS.md
├─ Review: tests/metadata-test-cases.json
├─ Identify: Common failure modes
└─ Document: Extraction strategies

Phase 3: Build Custom Extractor
├─ Read: METADATA_INVESTIGATION.md (Phase 3 & 4)
├─ Reference: tests/PLATFORM_METADATA_PATTERNS.md
├─ Implement: Serverless scraper
└─ Test against: tests/metadata-test-cases.json

Phase 4: Test & Iterate
├─ Use: /dev/metadata-test (Re-test button)
├─ Compare: Before vs after results
├─ Measure: Improvement rate
└─ Iterate: Fix failures, add extractors

Phase 5: Production
├─ Deploy: Custom extraction service
├─ Monitor: Success rates
├─ Expand: Add more platform support
└─ Maintain: Update as sites change
```

---

## 📊 Documentation Status

| Document | Status | Purpose |
|----------|--------|---------|
| README.md | ✅ Updated | Project overview |
| PLAN.md | ✅ Updated | Roadmap with Phase 3.5 |
| METADATA_INVESTIGATION.md | ✅ Complete | Research plan |
| METADATA_TESTING_SETUP.md | ✅ Complete | Infrastructure guide |
| SESSION_SUMMARY.md | ✅ Complete | Session progress |
| QUICK_START_TESTING.md | ✅ Complete | Quick start |
| METADATA_DOCS_INDEX.md | ✅ Complete | This index |
| tests/FINDING_INDIE_SITES.md | ✅ Complete | Finding URLs |
| tests/PLATFORM_METADATA_PATTERNS.md | ✅ Complete | Extraction patterns |
| app/dev/metadata-test/README.md | ✅ Complete | Test Lab guide |
| app/dev/metadata-test/NAVIGATION.md | ✅ Complete | Navigation guide |

**All documentation complete!** Ready for test collection phase.

---

## 🎓 Learning Path

### New to the project?
1. [README.md](./README.md) - What is Tote?
2. [PLAN.md](./PLAN.md) - Current roadmap
3. [SESSION_SUMMARY.md](./SESSION_SUMMARY.md) - Recent progress
4. [QUICK_START_TESTING.md](./QUICK_START_TESTING.md) - Start testing

### Want to understand metadata extraction?
1. [METADATA_INVESTIGATION.md](./METADATA_INVESTIGATION.md) - Big picture
2. [tests/PLATFORM_METADATA_PATTERNS.md](./tests/PLATFORM_METADATA_PATTERNS.md) - Patterns
3. [tests/FINDING_INDIE_SITES.md](./tests/FINDING_INDIE_SITES.md) - Detection

### Ready to build?
1. [METADATA_INVESTIGATION.md](./METADATA_INVESTIGATION.md) - Phase 3 & 4
2. Review: [tests/metadata-test-cases.json](./tests/metadata-test-cases.json)
3. Reference: [tests/PLATFORM_METADATA_PATTERNS.md](./tests/PLATFORM_METADATA_PATTERNS.md)
4. Test: `/dev/metadata-test`

---

## 🔗 External Resources

### Metadata Standards
- [Open Graph Protocol](https://ogp.me/)
- [Schema.org Product](https://schema.org/Product)
- [Twitter Cards](https://developer.twitter.com/en/docs/twitter-for-websites/cards)

### Platform Documentation
- [Shopify Product JSON](https://shopify.dev/docs/api/liquid/objects/product)
- [Squarespace Developer Platform](https://developers.squarespace.com/)

### Tools
- [What Shopify Theme](https://whatshopifytheme.com/) - Theme detection
- [Is It Squarespace](https://isitsquarespace.com/) - Template detection

### Deployment Options
- [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless (100k req/day free)
- [Vercel Edge Functions](https://vercel.com/docs/functions/edge-functions) - Serverless (100k req/month free)

---

## 💡 Quick Tips

**Testing:**
- Aim for 30-50 test cases
- Prioritize indie Shopify/Squarespace (60%)
- Test diverse themes/templates
- Save frequently

**Patterns:**
- Look for JSON-LD first
- Shopify has product JSON API
- Images: prefer larger dimensions
- Prices: check multiple sources

**Building:**
- Start with Shopify (most common)
- Use serverless to bypass CORS
- Test against saved cases
- Iterate based on failures

---

**Last Updated:** December 8, 2024
**Status:** Documentation complete, ready for test collection
