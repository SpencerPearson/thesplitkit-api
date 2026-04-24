import { Router } from 'express';
import crypto from 'node:crypto';

function encodeUrlParameters(inputString) {
	const parts = String(inputString || '').split('?');
	const basePath = parts[0] || '';
	const params = new URLSearchParams(parts[1] || '');
	const encoded = [];
	for (const [key, value] of params.entries()) {
		encoded.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
	}
	const query = encoded.join('&');
	return query ? `${basePath}?${query}` : basePath;
}

function signPodcastIndex(piApiKey, piApiSecret) {
	const apiHeaderTime = Math.floor(Date.now() / 1000);
	const hash = crypto
		.createHash('sha1')
		.update(`${piApiKey}${piApiSecret}${apiHeaderTime}`)
		.digest('hex');
	return { apiHeaderTime, hash };
}

export function createPodcastIndexRouter({ piApiKey, piApiSecret }) {
	const router = Router();
	const hasCreds = Boolean(piApiKey && piApiSecret);
	const searchCache = new Map();
	const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
	const SEARCH_DEFAULT_MAX = 100;
	const SEARCH_HARD_MAX = 250;

	function buildHeaders() {
		const { apiHeaderTime, hash } = signPodcastIndex(piApiKey, piApiSecret);
		return {
			'X-Auth-Date': String(apiHeaderTime),
			'X-Auth-Key': piApiKey,
			Authorization: hash,
			'User-Agent': 'TheSplitKit'
		};
	}

	function normalizeSearchResult(feed = {}) {
		return {
			id: feed.id,
			podcastGuid: feed.podcastGuid,
			title: feed.title,
			author: feed.author,
			artwork: feed.artwork,
			image: feed.image,
			newestItemPubdate: feed.newestItemPubdate
		};
	}

	function resolveMax(inputMax) {
		const parsed = Number.parseInt(String(inputMax ?? ''), 10);
		if (Number.isNaN(parsed) || parsed <= 0) return SEARCH_DEFAULT_MAX;
		return Math.min(parsed, SEARCH_HARD_MAX);
	}

	function readCache(cacheKey) {
		const cached = searchCache.get(cacheKey);
		if (!cached) return null;
		if (Date.now() - cached.createdAt > SEARCH_CACHE_TTL_MS) {
			searchCache.delete(cacheKey);
			return null;
		}
		return cached.value;
	}

	function writeCache(cacheKey, value) {
		searchCache.set(cacheKey, { createdAt: Date.now(), value });
	}

	router.get('/queryindex/search', async (req, res) => {
		if (!hasCreds) {
			return res.status(503).json({
				error: 'podcast_index_not_configured',
				message: 'Set PI_API_KEY and PI_API_SECRET in thesplitkit-api env.'
			});
		}

		const term = String(req.query.term ?? '').trim();
		const max = resolveMax(req.query.max);
		const cacheKey = `term:${term.toLowerCase()}|max:${max}`;
		const cached = readCache(cacheKey);
		if (cached) {
			return res.json({ feeds: cached, cached: true });
		}

		try {
			let endpoint = '';
			if (term) {
				endpoint = `search/byterm?q=${encodeURIComponent(term)}&max=${max}&clean`;
			} else {
				endpoint = `podcasts/bymedium?medium=music&val=lightning&max=${max}`;
			}

			const piRes = await fetch(`https://api.podcastindex.org/api/1.0/${endpoint}`, {
				method: 'GET',
				headers: buildHeaders()
			});

			const text = await piRes.text();
			let data = {};
			try {
				data = JSON.parse(text);
			} catch {
				data = { raw: text };
			}

			if (piRes.status === 401) {
				return res.status(401).json({
					error: 'podcast_index_auth_failed',
					message:
						'Podcast Index credentials were rejected. Verify PI_API_KEY and PI_API_SECRET in thesplitkit-api env.',
					details: data
				});
			}

			if (!piRes.ok) {
				return res.status(piRes.status).json({
					error: 'podcast_index_search_failed',
					message: 'Podcast Index search request failed.',
					details: data
				});
			}

			const rawFeeds = Array.isArray(data?.feeds)
				? data.feeds
				: Array.isArray(data?.results)
					? data.results
					: [];

			const feeds = rawFeeds
				.map(normalizeSearchResult)
				.filter((feed) => Boolean(feed.id && feed.podcastGuid && feed.title));

			writeCache(cacheKey, feeds);
			return res.json({ feeds, cached: false });
		} catch (error) {
			console.error('queryindex search error:', error.message || error);
			return res.status(500).json({ error: 'queryindex_search_failed' });
		}
	});

	router.get('/queryindex', async (req, res) => {
		if (!hasCreds) {
			return res.status(503).json({
				error: 'podcast_index_not_configured',
				message: 'Set PI_API_KEY and PI_API_SECRET in thesplitkit-api env.'
			});
		}

		try {
			const q = req.query.q ?? '';
			if (!q) return res.status(400).json({ error: 'missing_query' });

			const { apiHeaderTime, hash } = signPodcastIndex(piApiKey, piApiSecret);
			const endpoint = encodeUrlParameters(String(q));
			const url = `https://api.podcastindex.org/api/1.0/${endpoint}`;

			const piRes = await fetch(url, {
				method: 'GET',
				headers: {
					'X-Auth-Date': String(apiHeaderTime),
					'X-Auth-Key': piApiKey,
					Authorization: hash,
					'User-Agent': 'TheSplitKit'
				}
			});

			const text = await piRes.text();
			let data = {};
			try {
				data = JSON.parse(text);
			} catch {
				data = { raw: text };
			}

			if (piRes.status === 401) {
				return res.status(401).json({
					error: 'podcast_index_auth_failed',
					message:
						'Podcast Index credentials were rejected. Verify PI_API_KEY and PI_API_SECRET in thesplitkit-api env.',
					details: data
				});
			}

			if (piRes.status === 404) {
				return res.status(404).json({
					error: 'podcast_index_not_found',
					message:
						'Requested feed/item was not found in Podcast Index. Try adding the feed manually first.',
					details: data
				});
			}

			if (piRes.status === 302) {
				return res.status(302).json({
					description:
						'Feed was not added. Please visit https://podcastindex.org/add and try adding your feed manually.'
				});
			}

			return res.status(piRes.status).json(data);
		} catch (error) {
			console.error('queryindex error:', error.message || error);
			return res.status(500).json({ error: 'queryindex_failed' });
		}
	});

	return router;
}
