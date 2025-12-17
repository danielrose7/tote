/**
 * Learn about schemas here:
 * https://jazz.tools/docs/react/schemas/covalues
 */

import { Group, co, z } from "jazz-tools";

/** Product link data */
export const ProductLink = co.map({
  url: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  price: z.string().optional(),
  addedAt: z.date(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

/** Collection for organizing product links */
export const Collection = co.map({
  name: z.string(),
  description: z.string().optional(),
  color: z.string().optional(),
  links: co.list(ProductLink),
  createdAt: z.date(),
});

/** API token for extension authentication */
export const ApiToken = co.map({
  token: z.string(),
  name: z.string(),
  createdAt: z.date(),
  lastUsedAt: z.date().optional(),
  isActive: z.boolean(),
});

/** The account profile is an app-specific per-user public `CoMap`
 *  where you can store top-level objects for that user */
export const JazzProfile = co.profile({
  firstName: z.string(),
});

/** The account root is an app-specific per-user private `CoMap`
 *  where you can store top-level objects for that user */
export const AccountRoot = co.map({
  links: co.list(ProductLink),
  collections: co.list(Collection),
  defaultCollectionId: z.string().optional(),
  apiTokens: co.list(ApiToken),
});

export const JazzAccount = co
  .account({
    profile: JazzProfile,
    root: AccountRoot,
  })
  .withMigration(async (account) => {
    /** The account migration is run on account creation and on every log-in.
     *  You can use it to set up the account root and any other initial CoValues you need.
     */
    if (!account.$jazz.has("root")) {
      // Create default "My Links" collection
      const defaultCollection = Collection.create(
        {
          name: "My Links",
          description: "Your personal collection of product links",
          color: "#6366f1",
          links: [],
          createdAt: new Date(),
        },
        account.$jazz,
      );

      account.$jazz.set("root", {
        links: [],
        collections: [defaultCollection],
        defaultCollectionId: defaultCollection.$jazz.id,
        apiTokens: [],
      });
    } else {
      // Migrate existing accounts
      const root = account.root;
      if (root && root.$isLoaded) {
        // Add collections array if missing
        if (!root.collections) {
          root.collections = [];
        }

        // Add apiTokens array if missing
        if (!root.apiTokens) {
          root.apiTokens = [];
        }

        // Create default collection if none exists
        if (root.collections.$isLoaded && root.collections.length === 0) {
          const defaultCollection = Collection.create(
            {
              name: "My Links",
              description: "Your personal collection of product links",
              color: "#6366f1",
              links: [],
              createdAt: new Date(),
            },
            account.$jazz,
          );
          root.collections.$jazz.push(defaultCollection);
          root.defaultCollectionId = defaultCollection.$jazz.id;
        } else if (!root.defaultCollectionId && root.collections.$isLoaded && root.collections.length > 0) {
          // Set first collection as default if no default is set
          const firstCollection = root.collections[0];
          if (firstCollection && firstCollection.$isLoaded) {
            root.defaultCollectionId = firstCollection.$jazz.id;
          }
        }
      }
    }

    if (!account.$jazz.has("profile")) {
      const group = Group.create();
      group.addMember("everyone", "reader"); // The profile info is visible to everyone

      account.$jazz.set(
        "profile",
        JazzProfile.create(
          {
            name: "Anonymous user",
            firstName: "",
          },
          group,
        ),
      );
    }
  });
