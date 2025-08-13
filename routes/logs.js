// routes/logs.js
const express = require('express');
const router = express.Router();
const {
	getLogs,
	getProfileLogs,
	getAllProfileLogs,
	getAllProfileStatuses,
	getCurrentCycleProfileLogs,
	getCurrentCycleProfileStatuses,
	getGlobalCycleInfo
} = require('../utils/helpers');

router.get('/', (req, res) => {
	try {
		const logs = getLogs();
		res.setHeader('Content-Type', 'text/plain');
		res.send(logs);
	} catch (error) {
		console.error('Logs route error:', error);
		res.status(500).send('Failed to retrieve logs');
	}
});

// Get logs for a specific profile
router.get('/profile/:profileIndex', (req, res) => {
	try {
		const profileIndex = parseInt(req.params.profileIndex);
		if (isNaN(profileIndex) || profileIndex < 1) {
			return res.status(400).json({
				success: false,
				error: 'Invalid profile index'
			});
		}

		const logs = getProfileLogs(profileIndex);
		res.setHeader('Content-Type', 'text/plain');
		res.send(logs);
	} catch (error) {
		console.error('Profile logs route error:', error);
		res.status(500).send('Failed to retrieve profile logs');
	}
});

// Get all profile logs
router.get('/profiles', (req, res) => {
	try {
		const cycleInfo = getGlobalCycleInfo();
		let allProfileLogs, allProfileStatuses;

		if (cycleInfo.currentCycle > 0 && cycleInfo.profilesPerCycle > 0) {
			// Use current cycle logs
			allProfileLogs = getCurrentCycleProfileLogs(
				cycleInfo.profilesPerCycle,
				cycleInfo.currentCycle
			);
			allProfileStatuses = getCurrentCycleProfileStatuses(
				cycleInfo.profilesPerCycle,
				cycleInfo.currentCycle
			);
		} else {
			// Fallback to all profile logs
			allProfileLogs = getAllProfileLogs();
			allProfileStatuses = getAllProfileStatuses();
		}

		res.json({
			success: true,
			profileLogs: allProfileLogs,
			profileStatuses: allProfileStatuses,
			currentCycle: cycleInfo.currentCycle,
			profilesPerCycle: cycleInfo.profilesPerCycle
		});
	} catch (error) {
		console.error('All profile logs route error:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to retrieve all profile logs'
		});
	}
});

module.exports = { router };
