# Expectation Setting as a Service

A background reference on why expectation management is the core design problem in async, long-running product workflows — and what the research says about how to do it well.

---

## The core insight

A former creative director put it plainly: _"We don't sell logos or websites. We sell expectations."_

The deliverable is secondary. What the client actually buys is a felt sense of what they're going to get, when, and what it will mean for them. If that felt sense turns out to be accurate — or better than expected — they're happy. If it misses, the work itself almost doesn't matter.

Morgan Housel arrived at the same place from the other direction in _The Art of Spending Money_ (2025): **"Happiness is contentment. Contentment is what you have relative to what you want."** The gap between expectation and reality is the whole game.

This applies at two levels:

- **Process expectations** — what's happening right now, how long will this phase take, what comes next
- **Scope expectations** — what this tool can actually produce given its constraints; what kind of output, not just when

Both gaps cause dissatisfaction. A user who knows exactly when to expect something but receives the wrong _kind_ of thing is just as disappointed as one who received the right thing with no warning.

---

## What the research says

### Uncertainty is the real enemy, not duration

Users overestimate passive wait times by ~36%. But when a system actively signals what's happening, perceived time drops — not because the clock moves faster, but because cognition is engaged with the feedback rather than the absence of it. A study by Fiona Fui-Hoon Nah found that users with progress indicators waited a median of 22.6 seconds before abandoning, versus just 9 seconds with no indicator. The indicator didn't change the speed. It changed the _story_.

Source: [NN/G — Progress Indicators Make a Slow System Less Insufferable](https://www.nngroup.com/articles/progress-indicators/)

### Anticipation is where the dopamine lives

Research by Cornell's Thomas Gilovich found that anticipating an experience generates more happiness than anticipating a material purchase — and that dopamine peaks during anticipation, not consumption. "Savoring" (relishing a positive outcome before it arrives) is a measurable component of well-being. Waiting phases aren't just something to survive — they're an opportunity to build genuine excitement about what's coming.

Source: [Anticipating Experience-Based Purchases More Enjoyable Than Material Ones — APS](https://www.psychologicalscience.org/news/releases/anticipating-experience-based-purchases-more-enjoyable-than-material-ones.html)

### People remember peaks and endings, not durations

Kahneman's peak-end rule: we judge an experience almost entirely by its most intense moment (the peak) and how it ended. Duration is nearly irrelevant — he called this "duration neglect." A long but well-framed wait followed by a satisfying reveal is remembered more positively than a shorter but opaque one that ends flatly.

The implication for design: the final reveal deserves disproportionate design energy. It's the moment that shapes how the entire session is remembered.

Source: [Peak-End Rule — Laws of UX](https://lawsofux.com/peak-end-rule/) / [NN/G — The Peak–End Rule](https://www.nngroup.com/articles/peak-end-rule/)

### The communication gap is where trust breaks

The "Gap Model of Service Quality" (Parasuraman, Zeithaml, Berry, 1985) identifies the **communication gap** as the difference between what a service promises and what it actually delivers. A service that delivers exactly what it said it would — even if modest — outperforms one that over-promises and nearly delivers. Every workflow makes an implicit promise at the moment a user initiates it. Every transition should feel like that promise being honored.

Source: [The Gap Model of Service Quality — OpenStax](https://openstax.org/books/principles-marketing/pages/11-3-the-gap-model-of-service-quality)

### HITL transitions fail without a good handoff message

Human-in-the-loop research identifies the handoff message — the "here's why I'm pausing, here's what I need, here's what happens next" — as the primary driver of whether users experience a pause as friction or as part of the process. Surprises in workflows feel like setbacks even when they're expected steps. The antidote is naming them before they happen.

Source: [Human-in-the-Loop Workflows — Zapier](https://zapier.com/blog/human-in-the-loop/)

---

## Scope expectations are a separate problem

Process expectations cover _when_ and _how_. Scope expectations cover _what kind of thing_ will be delivered.

This matters most for AI-driven tools with resource constraints. A tool running ~30 web searches can form a considered, opinionated view on a topic — it cannot exhaustively map it. The output is a curated shortlist, not a comprehensive directory. That's a feature: the value is editorial judgment, not coverage. But users don't know that at submission time.

The analogy: a good sommelier doesn't need to taste every wine in the cellar to give a confident recommendation. ~30 searches is enough to have a point of view. The framing should reflect this — _opinionated guide_ rather than _exhaustive reference_.

If the scope isn't named upfront, the result is evaluated against whatever the user imagined. A 20-item shortlist feels thin against an imagined 200-item directory; it feels right against a promised "focused selection."

**Set the output type at the start, not the end.** The worst place to calibrate scope expectations is the result screen, when the user is already looking at the output and forming a reaction.

---

## Principles

**Name what's coming before asking the user to act.** Every human-in-the-loop pause should answer: what just happened, what do I need from you, and what happens after you give it to me.

**Bound the unknown.** For indeterminate waits, ranges are better than estimates ("30–90 seconds" vs. "about a minute"). A wait that finishes at 45 seconds against a "30–90s" range feels like a win.

**Surface artifacts as anticipation moments.** When the system produces something rich — a framing brief, a plan, a shortlist — show it. Each reveal converts a passive wait into active investment: the user is now looking forward to a specific outcome they've seen articulated.

**Keep determinate progress determinate.** A counter with a known denominator is the strongest wait signal. Never let it go to `N / ?`. Pre-populate totals as soon as they're known.

**Don't let the plan over-promise the output.** If the plan shows 8 sections, the user expects ~40 items. Consistency between the plan reveal and the final output matters — both should reflect the same scope.

**The ending is the most important moment.** Design it last in the workflow but first in terms of priority. Echo the original intent back to the user; close the loop between what was implied at submission and what was delivered.

**Errors should name the cause and point to the action.** "Something went wrong" closes no loops. Every error message should say what broke and what to do next.

---

## Sources

- [Morgan Housel — The Art of Spending Money (2025)](https://www.penguinrandomhouse.com/books/741239/the-art-of-spending-money-by-morgan-housel/)
- [NN/G — Progress Indicators Make a Slow System Less Insufferable](https://www.nngroup.com/articles/progress-indicators/)
- [NN/G — The Peak–End Rule: How Impressions Become Memories](https://www.nngroup.com/articles/peak-end-rule/)
- [NN/G — Designing for Long Waits and Interruptions](https://www.nngroup.com/articles/designing-for-waits-and-interruptions/)
- [Laws of UX — Peak-End Rule](https://lawsofux.com/peak-end-rule/)
- [APS — Anticipating Experience-Based Purchases More Enjoyable Than Material Ones](https://www.psychologicalscience.org/news/releases/anticipating-experience-based-purchases-more-enjoyable-than-material-ones.html)
- [The Psychology of Anticipation: How Waiting Shapes Our Happiness](https://vishwamitra-21-286.medium.com/the-psychology-of-anticipation-how-waiting-shapes-our-happiness-40829f629c10)
- [The Gap Model of Service Quality — OpenStax](https://openstax.org/books/principles-marketing/pages/11-3-the-gap-model-of-service-quality)
- [Human-in-the-Loop Workflows — Zapier](https://zapier.com/blog/human-in-the-loop/)
- [UI Patterns for Async Workflows — LogRocket](https://blog.logrocket.com/ux-design/ui-patterns-for-async-workflows-background-jobs-and-data-pipelines/)
