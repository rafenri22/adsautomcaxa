const UserAgent = require('user-agents');

function generateUserAgent({
	browserName = 'Chrome',
	deviceCategory = 'desktop',
	platform = 'Win32',
	language = 'en-US'
}) {
	let userAgent;

	try {
		browserName = mapBrowserName(browserName);

		// Create user agent with filters
		const filter = {
			deviceCategory
		};

		// Only add browser filter if it's a recognized browser
		if (['Chrome', 'Firefox', 'Safari'].includes(browserName)) {
			filter.browserName = browserName;
		}

		userAgent = new UserAgent(filter);

	} catch (err) {
		console.warn('⚠️ Specific user agent generation failed, using fallback:', err.message);
		// Fallback to any desktop user agent
		try {
			userAgent = new UserAgent({ deviceCategory: 'desktop' });
		} catch (fallbackErr) {
			console.warn('⚠️ Fallback user agent failed, using default:', fallbackErr.message);
			// Ultimate fallback - return a static but realistic user agent
			return {
				ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				appVersion: '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				platform: 'Win32',
				vendor: 'Google Inc.',
				os: 'Windows',
				browser: 'Chrome'
			};
		}
	}

	// Extract information from the user agent
	const data = userAgent.data || {};
	
	return {
		ua: userAgent.toString(),
		appVersion: data.appVersion || '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
		platform: data.platform || platform,
		vendor: data.vendor || getVendorForBrowser(browserName),
		os: data.os || 'Windows',
		browser: data.browser || browserName
	};
}

function mapBrowserName(engineName) {
	switch (engineName.toLowerCase()) {
		case 'chromium':
			return 'Chrome';
		case 'firefox':
			return 'Firefox';
		case 'webkit':
			return 'Safari';
		default:
			return 'Chrome'; // Default fallback
	}
}

function getVendorForBrowser(browserName) {
	switch (browserName.toLowerCase()) {
		case 'chrome':
		case 'chromium':
			return 'Google Inc.';
		case 'firefox':
			return '';
		case 'safari':
		case 'webkit':
			return 'Apple Computer, Inc.';
		default:
			return 'Google Inc.';
	}
}

module.exports = generateUserAgent;