import type { Metadata } from 'next';
import { CHROME_WEB_STORE_URL } from '../../../../lib/constants';
import { AnchorHeading } from '../AnchorHeading';
import styles from '../docs.module.css';

export const metadata: Metadata = {
  title: 'Getting Started',
  description:
    'Get started with Tote in minutes. Sign up, install the Chrome extension, save your first product, and organize your shopping across every store.',
  alternates: { canonical: '/docs/getting-started' },
  openGraph: {
    title: 'Getting Started — Tote',
    description:
      'Get started with Tote in minutes. Sign up, install the Chrome extension, and save your first product.',
  },
};

export default function GettingStartedPage() {
  return (
    <article className={styles.article}>
      <h1>Getting Started</h1>
      <p className={styles.lead}>
        Tote is a free tool that saves products from any online store in one
        place. Set it up in a few minutes and start organizing your shopping.
      </p>

      <AnchorHeading as="h2" id="1-create-your-account">
        1. Create Your Account
      </AnchorHeading>
      <p>
        Head to <a href="https://tote.tools">tote.tools</a> and sign up with
        your email or Google account. Your account keeps your saved products
        synced across all your devices.
      </p>

      <AnchorHeading as="h2" id="2-install-the-browser-extension">
        2. Install the Browser Extension
      </AnchorHeading>
      <p>
        The browser extension is the fastest way to save products.{' '}
        <a
          href={CHROME_WEB_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Install it from the Chrome Web Store
        </a>{' '}
        — it works on Chrome, Edge, Brave, and Arc. Then sign in with the same
        account you just created.
      </p>
      <p>
        See the <a href="/docs/extension">Browser Extension guide</a> for
        detailed setup instructions.
      </p>

      <AnchorHeading as="h2" id="3-save-your-first-product">
        3. Save Your First Product
      </AnchorHeading>
      <p>
        Navigate to any product page — a pair of shoes, a piece of furniture, a
        kitchen gadget — and click the Tote extension icon in your toolbar.
        Choose a collection (or use the default one) and the product is saved
        instantly.
      </p>
      <p>
        Tote automatically captures the product name, image, price, and link
        back to the original page.
      </p>

      <AnchorHeading as="h2" id="4-organize-with-collections">
        4. Organize with Collections
      </AnchorHeading>
      <p>
        Collections are folders for your saved products. You might create one
        for "Living Room Furniture", another for "Gift Ideas", and another for
        "Wardrobe". Create as many as you need.
      </p>
      <p>
        Learn more in the <a href="/docs/collections">Collections guide</a>.
      </p>

      <AnchorHeading as="h2" id="5-keep-shopping">
        5. Keep Shopping
      </AnchorHeading>
      <p>
        As you browse different stores, keep saving products to Tote. Everything
        stays in one place regardless of which store it came from. Come back
        anytime to review, compare, or buy.
      </p>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Tip:</span>
          You can also right-click any product page and select "Save to Tote"
          from the context menu — no need to open the extension popup.
        </p>
      </div>

      <AnchorHeading as="h2" id="next-steps">
        Next Steps
      </AnchorHeading>
      <ul>
        <li>
          <a href="/docs/collections">Collections</a> — organize products into
          groups
        </li>
        <li>
          <a href="/docs/slots">Slots</a> — subdivide collections for more
          detail
        </li>
        <li>
          <a href="/docs/selections-and-budgets">Selections &amp; Budgets</a> —
          pick favorites and track spending
        </li>
        <li>
          <a href="/docs/sharing">Sharing</a> — collaborate on wishlists with
          others
        </li>
      </ul>

      <AnchorHeading as="h2" id="frequently-asked-questions">
        Frequently Asked Questions
      </AnchorHeading>

      <AnchorHeading as="h3" id="faq-is-tote-free">
        Is Tote free?
      </AnchorHeading>
      <p>
        Yes. Tote is free to use — create an account, install the extension, and
        start saving products at no cost.
      </p>

      <AnchorHeading as="h3" id="faq-what-stores">
        What stores does Tote work with?
      </AnchorHeading>
      <p>
        Tote works with virtually any online store. It reads standard product
        metadata (images, titles, prices) from the page, so it works on Amazon,
        IKEA, Etsy, Zara, small boutiques, and everything in between.
      </p>

      <AnchorHeading as="h3" id="faq-need-extension">
        Do I need the browser extension?
      </AnchorHeading>
      <p>
        No. The extension makes saving products faster (one click) and works on
        Chrome, Edge, Brave, and Arc, but you can also add products manually by
        pasting a URL in the web app. See{' '}
        <a href="/docs/adding-links">Adding Links</a> for details.
      </p>

      <AnchorHeading as="h3" id="faq-mobile">
        Does Tote work on my phone?
      </AnchorHeading>
      <p>
        The Tote web app works on any device with a browser. The Chrome
        extension is desktop-only, but you can add links manually from your
        phone by pasting product URLs.
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
                name: 'Is Tote free?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. Tote is free to use — create an account, install the extension, and start saving products at no cost.',
                },
              },
              {
                '@type': 'Question',
                name: 'What stores does Tote work with?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Tote works with virtually any online store. It reads standard product metadata from the page, so it works on Amazon, IKEA, Etsy, Zara, small boutiques, and everything in between.',
                },
              },
              {
                '@type': 'Question',
                name: 'Do I need the browser extension?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'No. The extension makes saving products faster (one click) and works on Chrome, Edge, Brave, and Arc, but you can also add products manually by pasting a URL in the web app.',
                },
              },
              {
                '@type': 'Question',
                name: 'Does Tote work on my phone?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'The Tote web app works on any device with a browser. The Chrome extension is desktop-only, but you can add links manually from your phone by pasting product URLs.',
                },
              },
            ],
          }),
        }}
      />
    </article>
  );
}
