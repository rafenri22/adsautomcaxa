// routes/status.js
const express = require('express');
const router = express.Router();
const { getStatus } = require('../automation');

router.get('/', (req, res) => {
	try {
		const status = getStatus();
		res.json(status);
	} catch (error) {
		console.error('Status route error:', error);
		res.status(500).json({
			error: 'Failed to get automation status',
			details: error.message
		});
	}
});

module.exports = router;
