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
			maxWaitTime
		} = req.body;

		// Input validation
		if (!blogURL || !ProxyURL) {
			console.error('❌ Missing required fields:', { blogURL: !!blogURL, ProxyURL: !!ProxyURL });
			return res.status(400).json({
				success: false,
				error: 'Missing blogURL or ProxyURL'
			});
		}

		// Validate URL format
		try {
			new URL(blogURL);
			console.log('✅ Blog URL is valid:', blogURL);
		} catch (urlError) {
			console.error('❌ Invalid blog URL:', blogURL, urlError.message);
			return res.status(400).json({
				success: false,
				error: 'Invalid blogURL format'
			});
		}

		// Validate numeric inputs
		const cycles = parseInt(openCount) || 1;
		const profiles = parseInt(profilesAtOnce) || 1;
		const pageTimeout = parseInt(timeout) || 30;
		const minWait = parseInt(minWaitTime) || 45;
		const maxWait = parseInt(maxWaitTime) || 55;

		console.log('🔢 Parsed values:', { cycles, profiles, pageTimeout, minWait, maxWait });

		if (cycles < 1 || cycles > 20) {
			return res.status(400).json({
				success: false,
				error: 'openCount must be between 1 and 20'
			});
		}

		if (profiles < 1 || profiles > 10) {
			return res.status(400).json({
				success: false,
				error: 'profilesAtOnce must be between 1 and 10'
			});
		}

		if (pageTimeout < 10 || pageTimeout > 120) {
			return res.status(400).json({
				success: false,
				error: 'timeout must be between 10 and 120 seconds'
			});
		}

		if (minWait < 10 || minWait > 120) {
			return res.status(400).json({
				success: false,
				error: 'minWaitTime must be between 10 and 120 seconds'
			});
		}

		if (maxWait < 10 || maxWait > 120) {
			return res.status(400).json({
				success: false,
				error: 'maxWaitTime must be between 10 and 120 seconds'
			});
		}

		if (minWait >= maxWait) {
			return res.status(400).json({
				success: false,
				error: 'minWaitTime must be less than maxWaitTime'
			});
		}

		// For better website loading, we'll handle proxy differently
		// If using scrape.do proxy, we'll extract the target URL and use it directly
		let targetURL = blogURL;
		let finalURL = blogURL;

		if (ProxyURL.includes('api.scrape.do')) {
			// Use the combination for scrape.do but extract target for direct access
			finalURL = ProxyURL + encodeURIComponent(blogURL);
			targetURL = blogURL; // Keep original URL for direct access
			console.log('🔗 Using scrape.do proxy configuration');
		} else {
			// Regular proxy setup
			finalURL = blogURL;
			targetURL = blogURL;
		}

		console.log('🎯 Target URL for direct access:', targetURL);
		console.log('🔗 Proxy URL for reference:', finalURL);

		// Send initial response
		res.json({
			success: true,
			started: true,
			targetURL: targetURL,
			proxyURL: ProxyURL,
			cycles,
			profiles,
			timeout: pageTimeout,
			minWait,
			maxWait
		});

		// Run automation in background with enhanced ad clicking
		console.log('🚀 Starting automation with aggressive ad clicking...');
		
		runAutomation({
			url: finalURL, // This will be parsed in the automation
			proxyURL: ProxyURL,
			browser,
			openCount: cycles,
			profilesAtOnce: profiles,
			timeout: pageTimeout,
			minWaitTime: minWait,
			maxWaitTime: maxWait
		}).catch((err) => {
			console.error('💥 Automation error in background:', err);
			console.error('Stack trace:', err.stack);
		});

		console.log('✅ Automation started successfully with enhanced ad clicking capabilities');

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