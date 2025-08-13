const axios = require('axios');
const crypto = require('crypto');
const generateUserAgent = require('./userAgents.js');

function shuffleArray(arr) {
	const a = arr.slice();
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

// Generate more realistic geolocation based on timezone
function generateGeolocationForTimezone(timezone) {
	const locations = {
		'America/New_York': [40.7128, -74.0060], // NYC
		'America/Los_Angeles': [34.0522, -118.2437], // LA
		'America/Chicago': [41.8781, -87.6298], // Chicago
		'America/Denver': [39.7392, -104.9903], // Denver
		'Europe/London': [51.5074, -0.1278], // London
		'Europe/Paris': [48.8566, 2.3522], // Paris
		'Europe/Berlin': [52.5200, 13.4050], // Berlin
		'Europe/Rome': [41.9028, 12.4964], // Rome
		'Asia/Tokyo': [35.6762, 139.6503], // Tokyo
		'Asia/Shanghai': [31.2304, 121.4737], // Shanghai
		'Asia/Singapore': [1.3521, 103.8198], // Singapore
		'Australia/Sydney': [-33.8688, 151.2093], // Sydney
		'UTC': [40.7128, -74.0060] // Default to NYC for UTC
	};
	
	const coords = locations[timezone] || locations['UTC'];
	// Add small random variation to exact coordinates
	return {
		latitude: coords[0] + (Math.random() * 0.1 - 0.05),
		longitude: coords[1] + (Math.random() * 0.1 - 0.05),
		accuracy: 10 + Math.random() * 90 // Random accuracy between 10-100 meters
	};
}

async function generateFingerprint(proxyURL = '', browserName, deviceCategory) {
	// Enhanced device category support
	const isMobile = deviceCategory === 'mobile' || Math.random() < 0.3; // 30% mobile traffic
	
	const mobileScreenProfiles = [
		{ width: 375, height: 667 }, // iPhone SE
		{ width: 375, height: 812 }, // iPhone X/11/12/13 mini
		{ width: 414, height: 896 }, // iPhone 11/XR
		{ width: 428, height: 926 }, // iPhone 12/13/14 Pro Max
		{ width: 360, height: 640 }, // Android standard
		{ width: 412, height: 915 }, // Pixel
		{ width: 384, height: 854 }  // Samsung Galaxy
	];
	
	const desktopScreenProfiles = [
		{ width: 1920, height: 1080 },
		{ width: 1366, height: 768 },
		{ width: 1536, height: 864 },
		{ width: 1600, height: 900 },
		{ width: 1440, height: 900 },
		{ width: 1280, height: 720 },
		{ width: 2560, height: 1440 }, // 2K
		{ width: 3840, height: 2160 }  // 4K
	];
	
	const screen = isMobile ? 
		mobileScreenProfiles[Math.floor(Math.random() * mobileScreenProfiles.length)] :
		desktopScreenProfiles[Math.floor(Math.random() * desktopScreenProfiles.length)];
	
	const languageProfiles = [
		['en-US', 'en'],
		['en-GB', 'en'],
		['id-ID', 'id', 'en'], // Indonesian
		['ms-MY', 'ms', 'en'], // Malaysian  
		['th-TH', 'th', 'en'], // Thai
		['vi-VN', 'vi', 'en'], // Vietnamese
		['zh-CN', 'zh', 'en']
	];
	
	const fontPool = isMobile ? [
		'Arial', 'Helvetica', 'Times New Roman', 'Times', 'Courier New',
		'Verdana', 'Georgia', 'Trebuchet MS', 'Tahoma', 'Impact'
	] : [
		'Arial', 'Helvetica', 'Times New Roman', 'Times', 'Courier New', 'Courier',
		'Verdana', 'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS',
		'Trebuchet MS', 'Arial Black', 'Impact', 'Lucida Sans Unicode', 
		'Tahoma', 'Lucida Console', 'Monaco', 'Bradley Hand ITC',
		'Brush Script MT', 'Luminari', 'Chalkduster'
	];
	
	const webGLList = isMobile ? [
		{ vendor: 'ARM', renderer: 'Mali-G78 MP14' },
		{ vendor: 'ARM', renderer: 'Mali-G77 MP11' },
		{ vendor: 'Qualcomm', renderer: 'Adreno (TM) 640' },
		{ vendor: 'Qualcomm', renderer: 'Adreno (TM) 650' },
		{ vendor: 'Apple', renderer: 'Apple A15 GPU' },
		{ vendor: 'Apple', renderer: 'Apple A14 GPU' }
	] : [
		{ vendor: 'Intel Inc.', renderer: 'Intel Iris Pro OpenGL Engine' },
		{ vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce RTX 3070/PCIe/SSE2' },
		{ vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce RTX 3060/PCIe/SSE2' },
		{ vendor: 'AMD', renderer: 'AMD Radeon Pro 5500 XT OpenGL Engine' },
		{ vendor: 'Intel Inc.', renderer: 'Intel HD Graphics 620' },
		{ vendor: 'Apple', renderer: 'Apple M1 Pro' }
	];

	const timezones = [
		'Asia/Jakarta', 'Asia/Singapore', 'Asia/Bangkok', 'Asia/Manila',
		'America/New_York', 'America/Los_Angeles', 'Europe/London'
	];

	let timezone = timezones[Math.floor(Math.random() * timezones.length)];
	let countryCode = 'ID'; // Default to Indonesia
	
	// Try to get timezone and country from proxy
	if (proxyURL && proxyURL.trim()) {
		try {
			const urlMatch = proxyURL.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
			if (urlMatch) {
				const ip = urlMatch[1];
				const geo = await axios.get(`http://ip-api.com/json/${ip}?fields=timezone,countryCode,country,regionName,city,lat,lon`, { 
					timeout: 3000,
					validateStatus: () => true
				});
				if (geo.data && geo.data.timezone) {
					timezone = geo.data.timezone;
					countryCode = geo.data.countryCode || 'ID';
					console.log(`🌍 Location from IP ${ip}: ${geo.data.city}, ${geo.data.regionName}, ${geo.data.country}`);
				}
			}
		} catch (e) {
			console.warn('⚠️ Timezone lookup failed, using random:', e.message);
		}
	}

	const languages = languageProfiles[Math.floor(Math.random() * languageProfiles.length)];
	const dpr = isMobile ? [1, 2, 3][Math.floor(Math.random() * 3)] : [1, 1.25, 1.5, 2][Math.floor(Math.random() * 4)];
	const webgl = webGLList[Math.floor(Math.random() * webGLList.length)];
	const geolocation = generateGeolocationForTimezone(timezone);

	let uaMeta;
	try {
		uaMeta = await generateUserAgent({
			browserName: browserName || 'Chrome',
			deviceCategory: isMobile ? 'mobile' : 'desktop',
			platform: isMobile ? 'mobile' : 'Win32',
			language: languages[0]
		});
	} catch (uaError) {
		console.warn('⚠️ User agent generation failed, using fallback:', uaError.message);
		
		// Enhanced fallback with mobile support
		const fallbackAgents = isMobile ? [
			'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
			'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
		] : [
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
		];
		
		const selectedUA = fallbackAgents[Math.floor(Math.random() * fallbackAgents.length)];
		
		uaMeta = {
			ua: selectedUA,
			appVersion: selectedUA.split('Mozilla/')[1],
			platform: isMobile ? (selectedUA.includes('iPhone') ? 'iPhone' : 'Linux armv7l') : 'Win32',
			vendor: selectedUA.includes('Edg') ? 'Microsoft Corporation' : 'Google Inc.',
			os: isMobile ? (selectedUA.includes('iPhone') ? 'iOS' : 'Android') : 'Windows',
			browser: selectedUA.includes('Edg') ? 'Edge' : 'Chrome',
			isMobile: isMobile,
			hasTouch: isMobile
		};
	}

	// Enhanced plugin simulation for mobile/desktop
	const plugins = isMobile ? [
		// Mobile plugins are limited
	] : [
		{ name: 'Chrome PDF Plugin', description: 'Portable Document Format', filename: 'internal-pdf-viewer' },
		{ name: 'Chrome PDF Viewer', description: 'PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
		{ name: 'Native Client', description: 'Native Client Executable', filename: 'internal-nacl-plugin' }
	];

	const mimeTypes = isMobile ? [] : [
		{ type: 'application/pdf', description: 'PDF Viewer', suffixes: 'pdf' },
		{ type: 'application/x-google-chrome-pdf', description: 'Chrome PDF Viewer', suffixes: 'pdf' }
	];

	return {
		userAgent: uaMeta.ua,
		appVersion: uaMeta.appVersion,
		platform: uaMeta.platform,
		vendor: uaMeta.vendor,
		os: uaMeta.os,
		browser: uaMeta.browser,
		browserLanguages: languages,
		screen: { 
			width: screen.width, 
			height: screen.height, 
			colorDepth: 24, 
			pixelDepth: 24,
			availWidth: screen.width,
			availHeight: screen.height - (isMobile ? 0 : 40)
		},
		devicePixelRatio: dpr,
		timezone,
		geolocation,
		countryCode,
		fonts: shuffleArray(fontPool).slice(0, 8 + Math.floor(Math.random() * 5)),
		deviceMemory: isMobile ? [2, 3, 4, 6, 8][Math.floor(Math.random() * 5)] : [4, 8, 16, 32][Math.floor(Math.random() * 4)],
		hardwareConcurrency: isMobile ? [4, 6, 8][Math.floor(Math.random() * 3)] : [2, 4, 6, 8, 12, 16][Math.floor(Math.random() * 6)],
		plugins,
		mimeTypes,
		webglVendor: webgl.vendor,
		webglRenderer: webgl.renderer,
		canvasNoise: crypto.randomBytes(16).toString('hex'),
		audioFingerprint: Math.random().toFixed(16),
		connection: {
			effectiveType: isMobile ? ['4g', '3g', 'slow-2g'][Math.floor(Math.random() * 3)] : ['4g', 'fast-3g'][Math.floor(Math.random() * 2)],
			downlink: isMobile ? +(Math.random() * 10 + 1).toFixed(1) : +(Math.random() * 15 + 5).toFixed(1),
			rtt: isMobile ? Math.floor(Math.random() * 100 + 20) : Math.floor(Math.random() * 50 + 10),
			type: isMobile ? 'cellular' : ['wifi', 'ethernet'][Math.floor(Math.random() * 2)]
		},
		battery: {
			charging: Math.random() < 0.7,
			level: +(Math.random() * 0.7 + 0.2).toFixed(2),
			chargingTime: Math.random() < 0.5 ? Math.floor(Math.random() * 7200) : Infinity,
			dischargingTime: Math.floor(Math.random() * 28800 + 3600)
		},
		maxTouchPoints: isMobile ? [5, 10][Math.floor(Math.random() * 2)] : 0,
		isMobile: isMobile,
		hasTouch: isMobile,
		doNotTrack: Math.random() < 0.3 ? '1' : null,
		cookieEnabled: true,
		onLine: true
	};
}

module.exports = generateFingerprint;