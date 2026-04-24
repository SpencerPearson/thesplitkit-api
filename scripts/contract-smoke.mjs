const baseUrl = process.env.SK_API_BASE_URL || 'http://localhost:8010';

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

function extractCookie(setCookieHeader) {
	if (!setCookieHeader) return '';
	return String(setCookieHeader).split(';')[0];
}

async function request(path, options = {}, cookie = '') {
	const headers = {
		'content-type': 'application/json',
		...(options.headers || {})
	};
	if (cookie) headers.cookie = cookie;

	const response = await fetch(`${baseUrl}${path}`, {
		...options,
		headers
	});

	let body = {};
	try {
		body = await response.json();
	} catch {
		body = {};
	}

	return { response, body };
}

async function run() {
	const email = `smoke-${Date.now()}@example.com`;
	const password = 'pass1234';

	const register = await request('/api/sk/register', {
		method: 'POST',
		body: JSON.stringify({ email, password })
	});
	assert(register.response.ok, 'register failed');

	const cookie = extractCookie(register.response.headers.get('set-cookie'));
	assert(cookie.includes('sk_session='), 'missing session cookie');

	const createEvent = await request(
		'/api/sk/generateguid',
		{
			method: 'POST',
			body: JSON.stringify({ eventName: 'Contract Smoke Event' })
		},
		cookie
	);
	assert(createEvent.response.ok, 'generateguid failed');
	assert(createEvent.body.guid, 'generateguid missing guid');

	const guid = createEvent.body.guid;
	const block = {
		blockGuid: guid,
		eventGuid: guid,
		title: 'Default',
		value: { destinations: [] },
		settings: { default: true }
	};

	const saveBlocks = await request(
		'/api/sk/saveblocks',
		{
			method: 'POST',
			body: JSON.stringify({ guid, blocks: [block] })
		},
		cookie
	);
	assert(saveBlocks.response.ok, 'saveblocks failed');

	const getBlocks = await request(`/api/sk/getblocks?guid=${guid}`);
	assert(getBlocks.response.ok, 'getblocks failed');
	assert(Array.isArray(getBlocks.body.blocks), 'getblocks blocks not array');
	assert(getBlocks.body.activeBlockGuid === guid, 'activeBlockGuid mismatch');

	const verifyOwner = await request(
		'/api/sk/verifyowner',
		{
			method: 'POST',
			body: JSON.stringify({ guid })
		},
		cookie
	);
	assert(verifyOwner.response.ok, 'verifyowner failed');

	const lookup = await request(`/api/sk/event/lookup?eventGuid=${guid}`);
	assert(lookup.response.ok, 'event lookup failed');
	assert(lookup.body.eventGuid === guid, 'event lookup guid mismatch');

	console.log('Contract smoke test passed.');
}

run().catch((error) => {
	console.error('Contract smoke test failed:', error.message);
	process.exit(1);
});
