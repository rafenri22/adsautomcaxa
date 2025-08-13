// utils/helpers.js
const { chromium, firefox, webkit } = require('playwright');

const logs = [];
const profileLogs = new Map(); // Track logs for each profile
const profileStatus = new Map(); // Track status for each profile

// Global cycle tracking variables
let globalCurrentCycle = 0;
let globalProfilesPerCycle = 0;

// Track current cycle info for logging
let currentCycleForLogging = 0;
let profilesPerCycleForLogging = 0;

function log(message, profileIndex = null) {
	console.log(message);
	logs.push(message);

	// If profileIndex is provided, also log to that specific profile
	if (profileIndex !== null) {
		// Convert global profile index to cycle-specific index for logging
		let cycleSpecificIndex = profileIndex;
		if (currentCycleForLogging > 0 && profilesPerCycleForLogging > 0) {
			cycleSpecificIndex = ((profileIndex - 1) % profilesPerCycleForLogging) + 1;
		}

		if (!profileLogs.has(cycleSpecificIndex)) {
			profileLogs.set(cycleSpecificIndex, []);
		}
		// Store logs without timestamp for cleaner display
		const cleanMessage = message;
		profileLogs.get(cycleSpecificIndex).push(cleanMessage);

		// Broadcast log to connected frontend clients for real-time display
		if (global.broadcastLog) {
			global.broadcastLog(cycleSpecificIndex, cleanMessage);
		}
	}
}

// Function to update global cycle info
function updateGlobalCycleInfo(cycle, profiles) {
	globalCurrentCycle = cycle;
	globalProfilesPerCycle = profiles;
	currentCycleForLogging = cycle;
	profilesPerCycleForLogging = profiles;

	// Clear previous cycle logs when starting a new cycle
	if (cycle > 1) {
		clearProfileLogs();
		// Broadcast cycle change to frontend
		if (global.broadcastLog) {
			global.broadcastLog(null, null, { type: 'cycle_change', cycle: cycle });
		}
	}
}

// Function to get global cycle info
function getGlobalCycleInfo() {
	return {
		currentCycle: globalCurrentCycle,
		profilesPerCycle: globalProfilesPerCycle
	};
}

// Function to update profile status
function updateProfileStatus(profileIndex, status) {
	// Convert global profile index to cycle-specific index for status tracking
	let cycleSpecificIndex = profileIndex;
	if (currentCycleForLogging > 0 && profilesPerCycleForLogging > 0) {
		cycleSpecificIndex = ((profileIndex - 1) % profilesPerCycleForLogging) + 1;
	}
	profileStatus.set(cycleSpecificIndex, status);

	// Broadcast status change to frontend for real-time updates
	if (global.broadcastLog) {
		global.broadcastLog(null, null, {
			type: 'status_change',
			profileIndex: cycleSpecificIndex,
			status: status
		});
	}
}

// Function to get profile status
function getProfileStatus(profileIndex) {
	// Convert global profile index to cycle-specific index for status retrieval
	let cycleSpecificIndex = profileIndex;
	if (currentCycleForLogging > 0 && profilesPerCycleForLogging > 0) {
		cycleSpecificIndex = ((profileIndex - 1) % profilesPerCycleForLogging) + 1;
	}
	return profileStatus.get(cycleSpecificIndex) || 'waiting';
}

// Function to get all profile statuses
function getAllProfileStatuses() {
	const result = {};
	if (currentCycleForLogging > 0 && profilesPerCycleForLogging > 0) {
		// Return only current cycle statuses
		for (let i = 1; i <= profilesPerCycleForLogging; i++) {
			result[i] = profileStatus.get(i) || 'waiting';
		}
	} else {
		// Fallback to all statuses
		for (const [profileIndex, status] of profileStatus.entries()) {
			result[profileIndex] = status;
		}
	}
	return result;
}

function getLogs() {
	return logs.join('\n');
}

function getProfileLogs(profileIndex) {
	const profileLog = profileLogs.get(profileIndex);
	return profileLog ? profileLog.join('\n') : '';
}

function getAllProfileLogs() {
	const result = {};
	for (const [profileIndex, logs] of profileLogs.entries()) {
		result[profileIndex] = logs.join('\n');
	}
	return result;
}

// Function to get profile logs for current cycle only
function getCurrentCycleProfileLogs(profilesPerCycle, currentCycle) {
	const result = {};
	for (let i = 1; i <= profilesPerCycle; i++) {
		const logs = profileLogs.get(i);
		if (logs) {
			result[i] = logs.join('\n');
		}
	}
	return result;
}

// Function to get profile statuses for current cycle only
function getCurrentCycleProfileStatuses(profilesPerCycle, currentCycle) {
	const result = {};
	for (let i = 1; i <= profilesPerCycle; i++) {
		const status = profileStatus.get(i);
		if (status) {
			result[i] = status;
		}
	}
	return result;
}

function clearProfileLogs() {
	profileLogs.clear();
	profileStatus.clear();
}

function shuffleArray(arr) {
	return arr
		.map((a) => [Math.random(), a])
		.sort((a, b) => a[0] - b[0])
		.map((a) => a[1]);
}

function getRandomBrowser() {
	const browsers = [
		{ name: 'chromium', launcher: chromium },
		{ name: 'firefox', launcher: firefox },
		{ name: 'webkit', launcher: webkit }
	];
	return browsers[Math.floor(Math.random() * browsers.length)];
}

function getBrowserByName(name) {
	switch (name) {
		case 'chromium':
			return { name: 'chromium', launcher: chromium };
		case 'firefox':
			return { name: 'firefox', launcher: firefox };
		case 'webkit':
			return { name: 'webkit', launcher: webkit };
		default:
			return null;
	}
}

function getRandomWaitTimes(count, min = 45, max = 55) {
	return Array.from({ length: count }, () => Math.floor(Math.random() * (max - min + 1)) + min);
}

module.exports = {
	log,
	getLogs,
	getProfileLogs,
	getAllProfileLogs,
	getCurrentCycleProfileLogs,
	getCurrentCycleProfileStatuses,
	clearProfileLogs,
	updateProfileStatus,
	getProfileStatus,
	getAllProfileStatuses,
	updateGlobalCycleInfo,
	getGlobalCycleInfo,
	shuffleArray,
	getRandomBrowser,
	getBrowserByName,
	getRandomWaitTimes
};
