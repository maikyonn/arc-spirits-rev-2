import { redirect } from '@sveltejs/kit';

export const load = ({ url }) => {
	throw redirect(307, `/hex-spirits/cards${url.search}`);
};
