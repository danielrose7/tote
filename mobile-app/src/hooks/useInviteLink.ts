import { useEffect, useState } from "react";
import { Linking } from "react-native";

export type InviteParams = {
  collectionId: string;
  inviteSecret: string;
  role: string;
};

function parseInviteUrl(url: string): InviteParams | null {
  const idMatch = url.match(/\/invite\/([^?/]+)/);
  if (!idMatch) return null;
  const collectionId = idMatch[1];

  const secretMatch = url.match(/[?&]secret=([^&]+)/);
  const roleMatch = url.match(/[?&]role=([^&]+)/);
  const inviteSecret = secretMatch ? decodeURIComponent(secretMatch[1]) : null;
  const role = roleMatch ? decodeURIComponent(roleMatch[1]) : "reader";

  if (!collectionId || !inviteSecret) return null;
  return { collectionId, inviteSecret, role };
}

export function useInviteLink() {
  const [invite, setInvite] = useState<InviteParams | null>(null);

  function handleUrl(url: string) {
    const params = parseInviteUrl(url);
    if (params) setInvite(params);
  }

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  return { invite, clearInvite: () => setInvite(null) };
}
