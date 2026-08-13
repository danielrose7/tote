import type { Metadata } from 'next';
import { AnchorHeading } from '../AnchorHeading';
import styles from '../docs.module.css';

export const metadata: Metadata = {
  title: 'iOS App',
  description:
    "Install and use the Tote iOS app to save products with your phone's Share button from Safari or any app, browse your collections, and sign in with Apple. Covers setup, saving, syncing, and troubleshooting.",
  alternates: { canonical: '/docs/ios-app' },
  openGraph: {
    title: 'iOS App — Tote',
    description:
      'Tap Share, then Tote, to save a product from Safari or any app, then browse and organize your collections on the go.',
  },
};

export default function IosAppDocsPage() {
  return (
    <article className={styles.article}>
      <h1>iOS App</h1>
      <p className={styles.lead}>
        The Tote iOS app brings your collections to your phone and hooks into
        the <strong>Share</strong> button, so you can save a product from Safari
        — or from any app that can share a link — without opening a browser.
      </p>
      <p>
        Looking for the short version? Visit the{' '}
        <a href="/ios-app">Tote iOS app landing page</a> for a quick overview
        and the current App Store status.
      </p>

      <AnchorHeading as="h2" id="getting-the-app">
        Getting the App
      </AnchorHeading>
      <p>
        Tote for iOS is finishing App Store review. Once it's approved, it will
        be a free universal download — one app that runs on both iPhone and
        iPad, with the iPad layout using the extra width for a wider collection
        grid. In the meantime, everything you save is stored in your Tote
        account, so it will be there the moment you sign in on the app — nothing
        to migrate or import.
      </p>

      <AnchorHeading as="h2" id="signing-in">
        Signing In
      </AnchorHeading>
      <p>
        Open the app and sign in with the same account you use on tote.tools —
        email, or Sign in with Apple if that's how you created your account.
        Your collections, saved products, and selections sync automatically
        between the app, the web app, and the browser extension.
      </p>

      <AnchorHeading as="h2" id="saving-with-the-share-button">
        Saving with the Share Button
      </AnchorHeading>
      <p>
        The fastest way to save on iOS is the <strong>Share</strong> button —
        the square with an arrow pointing out of it. It works anywhere iOS lets
        you share a link: Safari, Instagram, Messages, a retailer's own app, and
        more.
      </p>
      <ol>
        <li>
          On a product page or post, tap the <strong>Share</strong> icon
        </li>
        <li>
          Choose <strong>Tote</strong> from the row of apps that slides up
          (scroll that row if you don't see it, then tap <strong>More</strong>{' '}
          to enable it once)
        </li>
        <li>Pick a collection, and a slot if the collection has one</li>
        <li>
          Tote saves the product without switching apps or opening a browser tab
        </li>
      </ol>
      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Tip:</span>
          Sharing to Tote works before you've opened the main Tote app that
          session — it saves directly using your signed-in account.
        </p>
      </div>

      <AnchorHeading as="h2" id="what-gets-captured">
        What Gets Captured
      </AnchorHeading>
      <p>
        Sharing a link to Tote reads the page the same way the browser extension
        does:
      </p>
      <ul>
        <li>
          <strong>Product name</strong> — the title of the product
        </li>
        <li>
          <strong>Image</strong> — the main product photo
        </li>
        <li>
          <strong>Price</strong> — the current listed price
        </li>
        <li>
          <strong>URL</strong> — a link back to the original page
        </li>
      </ul>

      <AnchorHeading as="h2" id="using-the-app">
        Using the App
      </AnchorHeading>
      <p>
        Beyond saving, the app mirrors the web experience: browse collections,
        mark selections, track budgets, and refresh prices from your phone.
        Anything you change in the app shows up in the web app and vice versa.
      </p>

      <AnchorHeading as="h2" id="troubleshooting">
        Troubleshooting
      </AnchorHeading>

      <AnchorHeading as="h3" id="tote-missing-from-share-options">
        Tote isn't in my Share options
      </AnchorHeading>
      <p>
        Tap <strong>More</strong> at the end of the row of apps, find{' '}
        <strong>Tote</strong>, and turn it on. iOS remembers this choice, and
        Tote will appear in the main row from then on. If Tote still doesn't
        appear, confirm the app is installed and you've opened it at least once.
      </p>

      <AnchorHeading as="h3" id="share-not-signed-in">
        The share extension asks me to sign in again
      </AnchorHeading>
      <p>
        Open the main Tote app and sign in there first. The share extension uses
        the same signed-in session as the app, so signing in from the app
        resolves this for both.
      </p>

      <AnchorHeading as="h3" id="missing-price-or-image">
        Missing price, image, or brand
      </AnchorHeading>
      <p>
        Some stores hide product data or load it after a delay, which the share
        extension can't always wait for. Save the item anyway if the title,
        image, or URL is enough to recognize it later — you can edit the saved
        product in the app, or refresh the page in Safari and share again.
      </p>

      <AnchorHeading as="h3" id="saved-item-not-showing-up">
        A saved item isn't showing up
      </AnchorHeading>
      <p>
        Pull to refresh the collection in the app. If it's still missing, check
        that you saved to the collection you expected — the save screen
        remembers your last-used collection by default.
      </p>

      <AnchorHeading as="h3" id="app-out-of-sync">
        The app looks out of date compared to the web app
      </AnchorHeading>
      <p>
        Changes sync automatically when the app has a network connection. Pull
        to refresh any screen to force a sync, and check that the app has
        permission to use cellular data or Wi-Fi in iOS Settings.
      </p>

      <AnchorHeading as="h2" id="related-guides">
        Related Guides
      </AnchorHeading>
      <ul>
        <li>
          <a href="/docs/extension">Browser Extension</a> — the equivalent
          one-click and right-click saving on desktop
        </li>
        <li>
          <a href="/docs/adding-links">Adding Links</a> — other ways to save
          products, including manual URL entry
        </li>
        <li>
          <a href="/docs/collections">Collections</a> — how to organize your
          saved products
        </li>
        <li>
          <a href="/docs/selections-and-budgets">Selections &amp; Budgets</a> —
          mark favorites and track spending from the app
        </li>
      </ul>

      <AnchorHeading as="h2" id="frequently-asked-questions">
        Frequently Asked Questions
      </AnchorHeading>

      <AnchorHeading as="h3" id="faq-android">
        Is there an Android app?
      </AnchorHeading>
      <p>
        No, and there isn't one on the current roadmap. The web app works in any
        Android browser in the meantime. If you'd like an Android app, tell us
        at{' '}
        <a href="mailto:support@gobloom.io?subject=Android%20app%20request">
          support@gobloom.io
        </a>{' '}
        — requests are how we decide what to build next.
      </p>

      <AnchorHeading as="h3" id="faq-same-account">
        Do I need a separate account for the app?
      </AnchorHeading>
      <p>
        No. Sign in with the same account you use on tote.tools or in the
        browser extension, and everything you've already saved is there. One
        account covers all of Tote — the web app, the browser extension, and the
        iPhone and iPad app all talk to each other, so a change in one shows up
        in the others.
      </p>

      <AnchorHeading as="h3" id="faq-offline">
        Does the app work offline?
      </AnchorHeading>
      <p>
        You can browse previously loaded collections without a connection.
        Saving a new product, syncing changes, and refreshing prices all require
        a network connection.
      </p>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'Is there an Android app?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: "No, and there isn't one on the current roadmap. The web app works in any Android browser in the meantime. If you'd like an Android app, tell us at support@gobloom.io — requests are how we decide what to build next.",
                },
              },
              {
                '@type': 'Question',
                name: 'Do I need a separate account for the app?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: "No. Sign in with the same account you use on tote.tools or in the browser extension, and everything you've already saved is there. One account covers all of Tote — the web app, the browser extension, and the iPhone and iPad app all talk to each other, so a change in one shows up in the others.",
                },
              },
              {
                '@type': 'Question',
                name: 'Does the app work offline?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'You can browse previously loaded collections without a connection. Saving a new product, syncing changes, and refreshing prices all require a network connection.',
                },
              },
            ],
          }),
        }}
      />
    </article>
  );
}
