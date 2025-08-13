// routes/stop.js
const express = require('express');
const router = express.Router();
const { stopAutomation, stopAllBrowsers } = require('../automation');

router.post('/', async (req, res) => {
	try {
		// Stop the automation
		stopAutomation();

		// Close all active browsers
		await stopAllBrowsers();

		res.json({
			success: true,
			message: 'Automation stopped successfully'
		});
	} catch (error) {
		console.error('Stop automation error:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to stop automation',
			details: error.message
		});
	}
});

module.exports = router;
