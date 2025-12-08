# Quick Start - Metadata Testing

**Goal:** Collect 30-50 test cases to improve metadata extraction

---

## 🚀 Getting Started (5 minutes)

### 1. Start the app
```bash
npm run dev
```

### 2. Open Test Lab
- Look for **"🧪 Test Lab"** button in header
- Or visit: `http://localhost:3000/dev/metadata-test`

### 3. Find your first test URL
**Quick option:** Google search
```
"powered by shopify" ceramic mug
```

Pick any product page from results

---

## ✅ Testing Checklist

For each URL, do this:

### Step 1: Add Test
1. Paste product URL
2. Enter site name (e.g., "Cool Ceramics Co")
3. Select category: **Shopify (Indie/Small Business)**
4. Add theme/template if you can identify it
5. Click **"Test URL"**

### Step 2: Document Expected Values
Fill in what you see on the actual product page:
- ✏️ **Title** - Product name
- ✏️ **Description** - Product description
- ✏️ **Image URL** - Best product image
- ✏️ **Price** - As shown on site (e.g., "$29.99")
- ✏️ **Currency** - Usually USD
- ✏️ **Brand** - If visible

### Step 3: Tag Issues
Click on any that apply:
- No price
- No image
- Wrong image (logo instead of product)
- No description
- Wrong title
- Low-res image
- Truncated description
- Other issues

### Step 4: Rate & Save
1. Select severity (critical/major/minor)
2. Add notes if helpful
3. Click **"💾 Save to File"**

**Done!** Repeat for more URLs.

---

## 🎯 What to Test (Priority Order)

### High Priority (60% of tests)

**Shopify Indie Stores:**
- [ ] Dawn theme (current default)
- [ ] Debut theme (older default)
- [ ] Brooklyn theme
- [ ] Minimal theme
- [ ] Prestige theme
- [ ] Custom/modified themes
- Aim for: **10+ different themes**

**Squarespace Indie Stores:**
- [ ] Bedford template
- [ ] Brine template family
- [ ] Avenue template
- [ ] Five template
- [ ] Custom templates
- Aim for: **5+ templates**

**Other Indie Platforms:**
- [ ] Big Cartel
- [ ] Gumroad
- [ ] Ko-fi Shop
- [ ] Wix e-commerce
- [ ] Webflow e-commerce

### Medium Priority (30%)
- [ ] DTC brands (Warby Parker style)
- [ ] Fashion/apparel sites
- [ ] WooCommerce sites

### Low Priority (10%)
- [ ] Amazon (baseline)
- [ ] Etsy (baseline)
- [ ] Edge cases

---

## 🔍 How to Identify Platform/Theme

### Shopify Detection
1. View page source (right-click → View Source)
2. Search for: `cdn.shopify.com`
3. Look for: `Shopify.theme = {"name":"ThemeName"}`

**Or use:** https://whatshopifytheme.com/

### Squarespace Detection
1. View source
2. Search for: `static1.squarespace.com`
3. Check body class: `<body class="... template-name-...">`

**Or use:** https://isitsquarespace.com/

### More details
See: `tests/FINDING_INDIE_SITES.md`

---

## 📊 Track Your Progress

### Target Goals
- **30-50 total test cases**
- **15+ Shopify** (different themes)
- **8+ Squarespace** (different templates)
- **5+ other indie** platforms
- **Rest:** DTC/major/edge cases

### After 10-15 tests
Look for patterns:
- Which platforms never have prices?
- Which always return logos?
- Where is JSON-LD present?
- Common issues?

Document patterns in notes!

---

## 💾 Saving & Workflow

### Saving
- **Auto-save:** Changes saved to localStorage automatically
- **Manual save:** Click "💾 Save to File" to persist to `tests/metadata-test-cases.json`
- **Version control:** The JSON file is tracked in git

### Export/Import
- **Export:** Download JSON backup anytime
- **Import:** Upload JSON from another session
- **Load from File:** Reload saved test cases

### Re-testing
After you improve extraction:
1. Select any test case
2. Click **"🔄 Re-test"**
3. Compare new results
4. Measure improvement!

---

## 🎯 What Makes a Good Test Case?

### Good
✅ Indie Shopify store with Dawn theme
✅ Product with price visible
✅ Clear product image
✅ All expected fields documented
✅ Theme/template identified
✅ Issues tagged
✅ Notes about patterns

### Not as useful
❌ Amazon (already works well)
❌ Site with no products
❌ Missing expected values
❌ No platform identified
❌ No issue tagging

---

## 🆘 Common Issues

### "I can't find indie sites"
- Try: `"powered by shopify" [niche]`
- Browse Instagram shop links
- Check r/Entrepreneur for site showcases

### "How do I know the theme?"
- View source, search "theme"
- Use detection tools (links above)
- If unclear, note "Unknown" and move on

### "Should I test sold-out products?"
Yes! They're interesting edge cases.

### "What if Microlink times out?"
- Note as "error" in test case
- Add to issues: "Microlink timeout"
- Still document expected values
- Very useful for building fallbacks!

---

## 📚 Full Documentation

**Quick guides:**
- This file - Quick start
- `tests/FINDING_INDIE_SITES.md` - How to find URLs
- `tests/PLATFORM_METADATA_PATTERNS.md` - What to look for

**Detailed:**
- `METADATA_INVESTIGATION.md` - Full research plan
- `METADATA_TESTING_SETUP.md` - Complete infrastructure guide
- `app/dev/metadata-test/README.md` - Test Lab features

---

## ⏱️ Time Estimates

**Per test case:** 2-3 minutes
- Find URL: 30 sec
- Test: 10 sec
- Document: 60-90 sec
- Tag & save: 30 sec

**Session:** 30-45 minutes
- Collect 10-15 test cases
- Good stopping point

**Total:** 2-3 hours
- Complete 30-50 test case suite
- Can spread across multiple sessions

---

## 🎉 You're Ready!

1. Start dev server
2. Open Test Lab
3. Find Shopify indie store
4. Test & document
5. Repeat 30-50 times
6. Build awesome extraction!

**Let's go! 🚀**
