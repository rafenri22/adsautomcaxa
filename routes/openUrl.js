// routes/openUrl.js
const express = require('express');
const router = express.Router();
const { runAutomation } = require('../automation');

router.post('/', async (req, res) => {
	try {
		console.log('📥 Received automation request:', req.body);

		const {
			blogURL,
			ProxyURL,
			browser,
			openCount,
			profilesAtOnce,
			timeout,
			minWaitTime,
			maxWaitTime,
			directLinkViews,
			directLinkURL
		} = req.body;

		// Determine if this is direct link mode
		const isDirectLinkMode = directLinkViews > 0 && directLinkURL;

		// Input validation
		if (!blogURL) {
			console.error('❌ Missing required field: blogURL');
			return res.status(400).json({
				success: false,
				error: 'Missing blogURL'
			});
		}

		// For direct link mode, ProxyURL is optional (usually empty)
		if (!isDirectLinkMode && !ProxyURL) {
			console.error('❌ Missing required field: ProxyURL');
			return res.status(400).json({
				success: false,
				error: 'Missing ProxyURL'
			});
		}

		// Validate URL format
		try {
			new URL(isDirectLinkMode ? directLinkURL : blogURL);
			console.log('✅ URL is valid:', isDirectLinkMode ? directLinkURL : blogURL);
		} catch (urlError) {
			console.error('❌ Invalid URL:', isDirectLinkMode ? directLinkURL : blogURL, urlError.message);
			return res.status(400).json({
				success: false,
				error: 'Invalid URL format'
			});
		}

		// Validate numeric inputs
		const cycles = parseInt(openCount) || 1;
		const profiles = parseInt(profilesAtOnce) || (isDirectLinkMode ? parseInt(directLinkViews) : 1);
		const pageTimeout = parseInt(timeout) || 30;
		const minWait = parseInt(minWaitTime) || 45;
		const maxWait = parseInt(maxWaitTime) || 55;

		console.log('🔢 Parsed values:', { cycles, profiles, pageTimeout, minWait, maxWait });
		if (isDirectLinkMode) {
			console.log('🔗 Direct link mode - Views:', directLinkViews, 'URL:', directLinkURL);
		}

		// Validation ranges
		const maxCycles = isDirectLinkMode ? 1 : 20; // Direct link mode only uses 1 cycle
		const maxProfiles = isDirectLinkMode ? 50 : 10; // Direct link mode allows more concurrent views

		if (cycles < 1 || cycles > maxCycles) {
			return res.status(400).json({
				success: false,
				error: `openCount must be between 1 and ${maxCycles}`
			});
		}

		if (profiles < 1 || profiles > maxProfiles) {
			return res.status(400).json({
				success: false,
				error: `profilesAtOnce must be between 1 and ${maxProfiles}`
			});
		}

		if (pageTimeout < 10 || pageTimeout > 120) {
			return res.status(400).json({
				success: false,
				error: 'timeout must be between 10 and 120 seconds'
			});
		}

		if (minWait < 5 || minWait > 300) {
			return res.status(400).json({
				success: false,
				error: 'minWaitTime must be between 5 and 300 seconds'
			});
		}

		if (maxWait < 5 || maxWait > 300) {
			return res.status(400).json({
				success: false,
				error: 'maxWaitTime must be between 5 and 300 seconds'
			});
		}

		if (minWait >= maxWait) {
			return res.status(400).json({
				success: false,
				error: 'minWaitTime must be less than maxWaitTime'
			});
		}

		// Handle URL configuration based on mode
		let targetURL = blogURL;
		let finalURL = blogURL;

		if (isDirectLinkMode) {
			// Direct link mode - use the direct URL
			targetURL = directLinkURL;
			finalURL = directLinkURL;
			console.log('🔗 Direct link mode - Target URL:', targetURL);
		} else {
			// Regular ad clicking mode
			if (ProxyURL && ProxyURL.includes('api.scrape.do')) {
				// Use the combination for scrape.do but extract target for direct access
				finalURL = ProxyURL + encodeURIComponent(blogURL);
				targetURL = blogURL; // Keep original URL for direct access
				console.log('🔗 Using scrape.do proxy configuration');
			} else if (ProxyURL) {
				// Regular proxy setup
				finalURL = blogURL;
				targetURL = blogURL;
			}
			
			console.log('🎯 Target URL for direct access:', targetURL);
			console.log('🔗 Proxy URL for reference:', ProxyURL);
		}

		// Send initial response
		res.json({
			success: true,
			started: true,
			mode: isDirectLinkMode ? 'direct_link' : 'ad_clicking',
			targetURL: targetURL,
			proxyURL: ProxyURL || '',
			cycles,
			profiles,
			timeout: pageTimeout,
			minWait,
			maxWait,
			directLinkViews: directLinkViews || 0,
			directLinkURL: directLinkURL || ''
		});

		// Run automation in background with mode-specific configuration
		const automationConfig = {
			url: finalURL,
			proxyURL: ProxyURL || '',
			browser,
			openCount: cycles,
			profilesAtOnce: profiles,
			timeout: pageTimeout,
			minWaitTime: minWait,
			maxWaitTime: maxWait
		};

		// Add direct link parameters if in direct link mode
		if (isDirectLinkMode) {
			automationConfig.directLinkViews = directLinkViews;
			automationConfig.directLinkURL = directLinkURL;
		}

		const modeText = isDirectLinkMode ? 'direct link views' : 'enhanced ad clicking';
		console.log(`🚀 Starting automation with ${modeText}...`);
		
		runAutomation(automationConfig).catch((err) => {
			console.error('💥 Automation error in background:', err);
			console.error('Stack trace:', err.stack);
		});

		console.log(`✅ Automation started successfully with ${modeText} capabilities`);

	} catch (error) {
		console.error('💥 Route error:', error);
		console.error('Stack trace:', error.stack);
		res.status(500).json({
			success: false,
			error: 'Internal server error',
			details: error.message
		});
	}
});

module.exports = router;