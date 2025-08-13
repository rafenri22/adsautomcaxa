const UserAgent = require('user-agents');

// Enhanced user agent generation - Chrome and Edge only, with mobile support
function generateUserAgent({
	browserName = 'Chrome',
	deviceCategory = 'desktop',
	platform = 'Win32',
	language = 'en-US'
}) {
	// Simplify to only Chrome and Edge with mobile support
	const currentDate = new Date();
	
	// Current Chrome versions (last 3 versions)
	const chromeVersions = [
		'120.0.0.0', '119.0.0.0', '118.0.0.0'
	];
	
	// Current Edge versions 
	const edgeVersions = [
		'120.0.0.0', '119.0.0.0', '118.0.0.0'
	];

	let userAgentString;
	let appVersion;
	let platformStr;
	let vendor;
	let os;
	let browser;

	// Determine if mobile or desktop
	const isMobile = deviceCategory === 'mobile';
	const useEdge = Math.random() < 0.3; // 30% chance for Edge, 70% Chrome

	if (isMobile) {
		// Mobile user agents
		const mobileDevices = [
			'iPhone; CPU iPhone OS 17_1 like Mac OS X',
			'iPhone; CPU iPhone OS 16_6 like Mac OS X', 
			'iPhone; CPU iPhone OS 17_0 like Mac OS X',
			'Linux; Android 13; SM-G991B',
			'Linux; Android 12; SM-G996B',
			'Linux; Android 13; Pixel 7',
			'Linux; Android 12; Pixel 6'
		];
		
		const device = mobileDevices[Math.floor(Math.random() * mobileDevices.length)];
		const isAndroid = device.includes('Android');
		const version = useEdge ? edgeVersions[0] : chromeVersions[0];
		
		if (isAndroid) {
			if (useEdge) {
				userAgentString = `Mozilla/5.0 (${device}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Mobile Safari/537.36 EdgA/${version}`;
				browser = 'Edge';
				vendor = 'Microsoft Corporation';
			} else {
				userAgentString = `Mozilla/5.0 (${device}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Mobile Safari/537.36`;
				browser = 'Chrome';
				vendor = 'Google Inc.';
			}
			platformStr = 'Linux armv7l';
			os = 'Android';
		} else {
			// iPhone
			if (useEdge) {
				userAgentString = `Mozilla/5.0 (${device}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 EdgiOS/${version.split('.')[0]}.0.${version.split('.')[1]} Mobile/15E148 Safari/604.1`;
				browser = 'Edge';
				vendor = 'Microsoft Corporation';
			} else {
				userAgentString = `Mozilla/5.0 (${device}) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/${version} Mobile/15E148 Safari/604.1`;
				browser = 'Chrome';
				vendor = 'Google Inc.';
			}
			platformStr = 'iPhone';
			os = 'iOS';
		}
	} else {
		// Desktop user agents
		const desktopPlatforms = [
			'Windows NT 10.0; Win64; x64',
			'Windows NT 11.0; Win64; x64', 
			'Macintosh; Intel Mac OS X 10_15_7',
			'Macintosh; Intel Mac OS X 12_6_0'
		];
		
		const platform = desktopPlatforms[Math.floor(Math.random() * desktopPlatforms.length)];
		const version = useEdge ? edgeVersions[Math.floor(Math.random() * edgeVersions.length)] : chromeVersions[Math.floor(Math.random() * chromeVersions.length)];
		
		if (useEdge) {
			userAgentString = `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36 Edg/${version}`;
			browser = 'Edge';
			vendor = 'Microsoft Corporation';
		} else {
			userAgentString = `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
			browser = 'Chrome';
			vendor = 'Google Inc.';
		}
		
		if (platform.includes('Windows')) {
			platformStr = 'Win32';
			os = 'Windows';
		} else {
			platformStr = 'MacIntel';
			os = 'Mac';
		}
	}

	appVersion = userAgentString.substring(userAgentString.indexOf('/') + 1);

	return {
		ua: userAgentString,
		appVersion: appVersion,
		platform: platformStr,
		vendor: vendor,
		os: os,
		browser: browser,
		isMobile: isMobile,
		hasTouch: isMobile
	};
}

module.exports = generateUserAgent;