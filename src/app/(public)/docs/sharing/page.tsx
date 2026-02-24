import type { Metadata } from "next";
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

      <h2>How Sharing Works</h2>
      <p>
        When you share a collection, you create an invite link that others can use to join. Once someone joins your shared collection, they can view all the products and add their own.
      </p>

      <h2>Sharing a Collection</h2>
      <ol>
        <li>Open the collection you want to share</li>
        <li>Click the "Share" button in the collection header</li>
        <li>Copy the invite link</li>
        <li>Send the link to anyone you want to collaborate with</li>
      </ol>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Tip:</span>
          Shared collections work great for gift registries. Share a wishlist with family so everyone can see what you're hoping for—and avoid duplicate gifts.
        </p>
      </div>

      <h2>Joining a Shared Collection</h2>
      <p>
        When someone shares a collection with you:
      </p>
      <ol>
        <li>Click the invite link they sent you</li>
        <li>Sign in to your Tote account (or create one)</li>
        <li>The shared collection appears in your collections list</li>
      </ol>

      <h2>What Collaborators Can Do</h2>
      <p>
        Everyone with access to a shared collection can:
      </p>
      <ul>
        <li><strong>View all products</strong> — see everything in the collection</li>
        <li><strong>Add new products</strong> — contribute their own finds</li>
        <li><strong>Create slots</strong> — organize products into groups</li>
        <li><strong>Refresh prices</strong> — update product information</li>
      </ul>

      <h2>Leaving a Shared Collection</h2>
      <p>
        If you no longer want access to a collection someone shared with you, you can leave it from your collections page. This removes it from your list but doesn't affect other collaborators.
      </p>

      <h2>Public Links</h2>
      <p>
        In addition to sharing with collaborators, you can make a collection publicly viewable. Public links let anyone see your collection without signing in—perfect for wishlists, registries, or sharing recommendations.
      </p>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Tip:</span>
          Public links are a great way to create a "link in bio" for social media. Curate your favorite products into a collection, make it public, and share the link in your Instagram, TikTok, or anywhere else. Update it anytime with your latest finds.
        </p>
      </div>

      <h3>Making a Collection Public</h3>
      <ol>
        <li>Open the collection and click "Share"</li>
        <li>In the General Access section, click "Make Public"</li>
        <li>Copy the public link to share anywhere</li>
      </ol>

      <h3>How Public Links Work</h3>
      <p>
        When you make a collection public, Tote creates a <strong>snapshot</strong> of your collection. This public copy is separate from your working collection—changes you make won't automatically appear on the public version.
      </p>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Important:</span>
          After adding or removing products, you need to click "Update Public Version" to push your changes to the public link. This gives you control over what others see.
        </p>
      </div>

      <h3>Updating the Public Version</h3>
      <p>
        When you're ready to share your latest changes:
      </p>
      <ol>
        <li>Open the Share dialog</li>
        <li>Click "Update Public Version"</li>
        <li>Your changes are now visible to anyone with the public link</li>
      </ol>

      <h3>Making a Collection Private Again</h3>
      <p>
        You can revoke public access at any time by clicking "Make Private" in the Share dialog. The public link will stop working immediately.
      </p>

      <h2>Privacy</h2>
      <p>
        Only people with the invite link can access a shared collection. Your other collections remain completely private. Tote never shares your data with advertisers or third parties.
      </p>

      <h2>Related Guides</h2>
      <ul>
        <li><a href="/docs/collections">Collections</a> — create and organize the collections you share</li>
        <li><a href="/docs/getting-started">Getting Started</a> — set up your account before accepting invite links</li>
        <li><a href="/docs/extension">Chrome Extension</a> — save products to shared collections from any store</li>
      </ul>

      <h2>Frequently Asked Questions</h2>

      <h3>Can people edit my shared collection?</h3>
      <p>
        It depends on the role you assign. When creating an invite link, you choose whether collaborators can view only, edit (add and modify products), or have full admin access. See <a href="/docs/collections">Collections</a> for more on managing your collections.
      </p>

      <h3>Is my shared collection visible to everyone?</h3>
      <p>
        No. Shared collections are only accessible to people who have the invite link. If you want anyone to see your collection without signing in, you can make it public separately — see the Public Links section above.
      </p>

      <h3>How do I stop sharing a collection?</h3>
      <p>
        For public links, open the Share dialog and click "Make Private" to revoke access immediately. For invite-based sharing, collaborators who have already joined retain access — this is a collaborative relationship, not a view-only broadcast.
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
          ],
        }) }}
      />
    </article>
  );
}
