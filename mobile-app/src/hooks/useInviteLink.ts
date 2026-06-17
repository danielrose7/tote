import { useEffect, useState } from "react";
import { Linking } from "react-native";

export type InviteParams = {
	token: string;
};

function parseInviteUrl(url: string): InviteParams | null {
	const match = url.match(/\/invite\/([^?/#]+)/);
	if (!match) return null;
	const token = decodeURIComponent(match[1]);
	if (!token || token.length < 10) return null;
	return { token };
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
