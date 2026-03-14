import type { Metadata } from "next";
import { AnchorHeading } from "../AnchorHeading";
import styles from "../docs.module.css";

export const metadata: Metadata = {
  title: "Sharing",
  description:
    "Learn how to share collections in Tote. Create invite links for collaborators, make collections public, and manage shared wishlists.",
  alternates: { canonical: "/docs/sharing" },
  openGraph: {
    title: "Sharing — Tote",
    description:
      "Learn how to share collections in Tote with invite links, public pages, and collaborative wishlists.",
  },
};

export default function SharingPage() {
  return (
    <article className={styles.article}>
      <h1>Sharing</h1>
      <p className={styles.lead}>
        Tote is a free cross-store shopping organizer. Share your collections with friends, family, or collaborators for joint wishlists, gift planning, or group projects.
      </p>

      <AnchorHeading as="h2" id="how-sharing-works">How Sharing Works</AnchorHeading>
      <p>
        When you share a collection, you create an invite link that others can use to join. Once someone joins your shared collection, they can view all the products and add their own.
      </p>

      <AnchorHeading as="h2" id="sharing-a-collection">Sharing a Collection</AnchorHeading>
      <ol>
        <li>Open the collection you want to share</li>
        <li>Click the &quot;Share&quot; button in the collection header</li>
        <li>Copy the invite link</li>
        <li>Send the link to anyone you want to collaborate with</li>
      </ol>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Tip:</span>
          Shared collections work great for gift registries. Share a wishlist with family so everyone can see what you&apos;re hoping for—and avoid duplicate gifts.
        </p>
      </div>

      <AnchorHeading as="h2" id="joining-a-shared-collection">Joining a Shared Collection</AnchorHeading>
      <p>
        When someone shares a collection with you:
      </p>
      <ol>
        <li>Click the invite link they sent you</li>
        <li>Sign in to your Tote account (or create one)</li>
        <li>The shared collection appears in your collections list</li>
      </ol>

      <AnchorHeading as="h2" id="what-collaborators-can-do">What Collaborators Can Do</AnchorHeading>
      <p>
        Everyone with access to a shared collection can:
      </p>
      <ul>
        <li><strong>View all products</strong> — see everything in the collection</li>
        <li><strong>Add new products</strong> — contribute their own finds</li>
        <li><strong>Create slots</strong> — organize products into groups</li>
        <li><strong>Refresh prices</strong> — update product information</li>
      </ul>

      <AnchorHeading as="h2" id="leaving-a-shared-collection">Leaving a Shared Collection</AnchorHeading>
      <p>
        If you no longer want access to a collection someone shared with you, you can leave it from your collections page. This removes it from your list but doesn&apos;t affect other collaborators.
      </p>

      <AnchorHeading as="h2" id="public-links">Public Links</AnchorHeading>
      <p>
        In addition to sharing with collaborators, you can make a collection publicly viewable. Public links let anyone see your collection without signing in—perfect for wishlists, registries, or sharing recommendations.
      </p>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Tip:</span>
          Public links are a great way to create a &quot;link in bio&quot; for social media. Curate your favorite products into a collection, make it public, and share the link in your Instagram, TikTok, or anywhere else. Update it anytime with your latest finds.
        </p>
      </div>

      <AnchorHeading as="h3" id="making-a-collection-public">Making a Collection Public</AnchorHeading>
      <ol>
        <li>Open the collection and click &quot;Share&quot;</li>
        <li>In the General Access section, click &quot;Make Public&quot;</li>
        <li>Copy the public link to share anywhere</li>
      </ol>

      <AnchorHeading as="h3" id="your-own-short-link">Your Own Short Link</AnchorHeading>
      <p>
        Every public collection gets your own unique, trustworthy link on tote.tools — with your username right in it so people know it&apos;s from you:
      </p>
      <p>
        <code>tote.tools/s/yourname/summer-wishlist</code>
      </p>
      <p>
        Tote creates this automatically from your collection name when you publish. You can change it to whatever you like in the Share dialog — great for social media bios, texts, or anywhere you want a link that&apos;s easy to recognize and trust.
      </p>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Tip:</span>
          To get your own short link, make sure you&apos;ve set a username in your account settings. Without a username, your public link will still work but will be longer.
        </p>
      </div>

      <AnchorHeading as="h3" id="how-public-links-work">How Public Links Work</AnchorHeading>
      <p>
        When you make a collection public, Tote creates a <strong>snapshot</strong> of your collection. This public copy is separate from your working collection—changes you make won&apos;t automatically appear on the public version.
      </p>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Important:</span>
          After adding or removing products, you need to click &quot;Update Public Version&quot; to push your changes to the public link. This gives you control over what others see.
        </p>
      </div>

      <AnchorHeading as="h3" id="updating-the-public-version">Updating the Public Version</AnchorHeading>
      <p>
        When you&apos;re ready to share your latest changes:
      </p>
      <ol>
        <li>Open the Share dialog</li>
        <li>Click &quot;Update Public Version&quot;</li>
        <li>Your changes are now visible to anyone with the public link</li>
      </ol>

      <AnchorHeading as="h3" id="making-a-collection-private-again">Making a Collection Private Again</AnchorHeading>
      <p>
        You can revoke public access at any time by clicking &quot;Make Private&quot; in the Share dialog. The public link will stop working immediately.
      </p>

      <AnchorHeading as="h2" id="privacy">Privacy</AnchorHeading>
      <p>
        Only people with the invite link can access a shared collection. Your other collections remain completely private. Tote never shares your data with advertisers or third parties.
      </p>

      <AnchorHeading as="h2" id="related-guides">Related Guides</AnchorHeading>
      <ul>
        <li><a href="/docs/collections">Collections</a> — create and organize the collections you share</li>
        <li><a href="/docs/getting-started">Getting Started</a> — set up your account before accepting invite links</li>
        <li><a href="/docs/extension">Chrome Extension</a> — save products to shared collections from any store</li>
      </ul>

      <AnchorHeading as="h2" id="frequently-asked-questions">Frequently Asked Questions</AnchorHeading>

      <AnchorHeading as="h3" id="faq-edit-shared">Can people edit my shared collection?</AnchorHeading>
      <p>
        It depends on the role you assign. When creating an invite link, you choose whether collaborators can view only, edit (add and modify products), or have full admin access. See <a href="/docs/collections">Collections</a> for more on managing your collections.
      </p>

      <AnchorHeading as="h3" id="faq-visible-to-everyone">Is my shared collection visible to everyone?</AnchorHeading>
      <p>
        No. Shared collections are only accessible to people who have the invite link. If you want anyone to see your collection without signing in, you can make it public separately — see the <a href="#public-links">Public Links</a> section above.
      </p>

      <AnchorHeading as="h3" id="faq-stop-sharing">How do I stop sharing a collection?</AnchorHeading>
      <p>
        For public links, open the Share dialog and click &quot;Make Private&quot; to revoke access immediately. For invite-based sharing, collaborators who have already joined retain access — this is a collaborative relationship, not a view-only broadcast.
      </p>

      <AnchorHeading as="h3" id="faq-customize-link">Can I customize my public collection link?</AnchorHeading>
      <p>
        Yes! When you publish a collection, Tote creates a short link from the collection name. You can change it to whatever you like in the Share dialog — for example, <code>tote.tools/s/yourname/summer-wishlist</code>.
      </p>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            { "@type": "Question", "name": "Can people edit my shared collection?", "acceptedAnswer": { "@type": "Answer", "text": "It depends on the role you assign. When creating an invite link, you choose whether collaborators can view only, edit, or have full admin access." } },
            { "@type": "Question", "name": "Is my shared collection visible to everyone?", "acceptedAnswer": { "@type": "Answer", "text": "No. Shared collections are only accessible to people who have the invite link. You can make a collection public separately if you want anyone to see it without signing in." } },
            { "@type": "Question", "name": "How do I stop sharing a collection?", "acceptedAnswer": { "@type": "Answer", "text": "For public links, open the Share dialog and click \"Make Private\" to revoke access immediately. For invite-based sharing, collaborators who have already joined retain access." } },
            { "@type": "Question", "name": "Can I customize my public collection link?", "acceptedAnswer": { "@type": "Answer", "text": "Yes! When you publish a collection, Tote creates a short link from the collection name. You can change it in the Share dialog to whatever you like." } },
          ],
        }) }}
      />
    </article>
  );
}
