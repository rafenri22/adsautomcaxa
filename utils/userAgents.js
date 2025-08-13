const UserAgent = require('user-agents');

// Enhanced user agent generation with more realistic patterns
function generateUserAgent({
	browserName = 'Chrome',
	deviceCategory = 'desktop',
	platform = 'Win32',
	language = 'en-US'
}) {
	let userAgent;

	try {
		browserName = mapBrowserName(browserName);

		// Create more specific filters for realistic user agents
		const filter = {
			deviceCategory
		};

		// Add specific constraints for better realism
		if (deviceCategory === 'desktop') {
			filter.platform = /^(Win32|MacIntel|Linux x86_64)$/;
		}

		// Only add browser filter if it's a recognized browser
		if (['Chrome', 'Firefox', 'Safari', 'Edge'].includes(browserName)) {
			filter.browserName = browserName;
		}

		userAgent = new UserAgent(filter);

		// Validate the generated user agent
		const ua = userAgent.toString();
		if (!ua || ua.length < 50) {
			throw new Error('Generated user agent too short or invalid');
		}

	} catch (err) {
		console.warn('⚠️ Specific user agent generation failed, using realistic fallback:', err.message);
		
		// Enhanced fallback with current, realistic user agents
		const fallbackAgents = generateFallbackUserAgents(browserName, deviceCategory);
		const selectedUA = fallbackAgents[Math.floor(Math.random() * fallbackAgents.length)];
		
		return parseUserAgent(selectedUA);
	}

	// Extract information from the generated user agent
	const data = userAgent.data || {};
	
	return {
		ua: userAgent.toString(),
		appVersion: data.appVersion || extractAppVersion(userAgent.toString()),
		platform: data.platform || extractPlatform(userAgent.toString()),
		vendor: data.vendor || getVendorForBrowser(browserName),
		os: data.os || extractOS(userAgent.toString()),
		browser: data.browser || browserName
	};
}

// Generate current and realistic fallback user agents
function generateFallbackUserAgents(browserName, deviceCategory) {
	const currentDate = new Date();
	const currentYear = currentDate.getFullYear();
	const currentMonth = currentDate.getMonth() + 1;
	
	// Chrome versions (current and recent)
	const chromeVersions = [
		'120.0.0.0', '119.0.0.0', '118.0.0.0', '117.0.0.0', '116.0.0.0'
	];
	
	// Firefox versions
	const firefoxVersions = [
		'120.0', '119.0', '118.0', '117.0', '116.0'
	];
	
	// Safari versions
	const safariVersions = [
		'17.1', '17.0', '16.6', '16.5', '16.4'
	];

	let agents = [];

	if (deviceCategory === 'desktop') {
		if (browserName.toLowerCase().includes('chrome') || browserName.toLowerCase() === 'chromium') {
			// Chrome on Windows
			agents = agents.concat(chromeVersions.map(v => 
				`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v} Safari/537.36`
			));
			
			// Chrome on macOS
			agents = agents.concat(chromeVersions.slice(0, 2).map(v => 
				`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v} Safari/537.36`
			));
			
		} else if (browserName.toLowerCase() === 'firefox') {
			// Firefox on Windows
			agents = agents.concat(firefoxVersions.map(v => 
				`Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${v}) Gecko/20100101 Firefox/${v}`
			));
			
			// Firefox on macOS
			agents = agents.concat(firefoxVersions.slice(0, 2).map(v => 
				`Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:${v}) Gecko/20100101 Firefox/${v}`
			));
			
		} else if (browserName.toLowerCase() === 'safari' || browserName.toLowerCase() === 'webkit') {
			// Safari on macOS
			agents = agents.concat(safariVersions.map(v => 
				`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${v} Safari/605.1.15`
			));
		}
	}

	// If no specific agents or fallback needed, provide comprehensive list
	if (agents.length === 0) {
		agents = [
			// Chrome Windows
			`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`,
			`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36`,
			
			// Chrome macOS
			`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`,
			
			// Firefox Windows
			`Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0`,
			`Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:119.0) Gecko/20100101 Firefox/119.0`,
			
			// Firefox macOS  
			`Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0`,
			
			// Safari macOS
			`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15`,
			`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15`,
			
			// Edge Windows
			`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0`
		];
	}

	return agents;
}

function parseUserAgent(userAgentString) {
	return {
		ua: userAgentString,
		appVersion: extractAppVersion(userAgentString),
		platform: extractPlatform(userAgentString),
		vendor: extractVendor(userAgentString),
		os: extractOS(userAgentString),
		browser: extractBrowser(userAgentString)
	};
}

function extractAppVersion(ua) {
	const match = ua.match(/Mozilla\/(\d+\.\d+)/);
	return match ? ua.substring(ua.indexOf('/') + 1) : '5.0 (compatible)';
}

function extractPlatform(ua) {
	if (ua.includes('Windows NT 10.0')) return 'Win32';
	if (ua.includes('Macintosh')) return 'MacIntel';
	if (ua.includes('X11')) return 'Linux x86_64';
	if (ua.includes('Linux')) return 'Linux x86_64';
	return 'Win32'; // Default
}

function extractVendor(ua) {
	if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Google Inc.';
	if (ua.includes('Firefox')) return '';
	if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Apple Computer, Inc.';
	if (ua.includes('Edg')) return 'Microsoft Corporation';
	return 'Google Inc.'; // Default
}

function extractOS(ua) {
	if (ua.includes('Windows')) return 'Windows';
	if (ua.includes('Macintosh') || ua.includes('Mac OS X')) return 'Mac';
	if (ua.includes('Linux') || ua.includes('X11')) return 'Linux';
	return 'Windows'; // Default
}

function extractBrowser(ua) {
	if (ua.includes('Edg')) return 'Edge';
	if (ua.includes('Chrome')) return 'Chrome';
	if (ua.includes('Firefox')) return 'Firefox';
	if (ua.includes('Safari')) return 'Safari';
	return 'Chrome'; // Default
}

function mapBrowserName(engineName) {
	const mapping = {
		'chromium': 'Chrome',
		'firefox': 'Firefox', 
		'webkit': 'Safari',
		'chrome': 'Chrome',
		'safari': 'Safari',
		'edge': 'Edge'
	};
	
	return mapping[engineName.toLowerCase()] || 'Chrome';
}

function getVendorForBrowser(browserName) {
	const vendors = {
		'chrome': 'Google Inc.',
		'chromium': 'Google Inc.',
		'firefox': '',
		'safari': 'Apple Computer, Inc.',
		'webkit': 'Apple Computer, Inc.',
		'edge': 'Microsoft Corporation'
	};
	
	return vendors[browserName.toLowerCase()] || 'Google Inc.';
}

module.exports = generateUserAgent;