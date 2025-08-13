const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const openUrlRoute = require('./routes/openUrl');
const logsRoute = require('./routes/logs');
const automationStatusRoute = require('./routes/status');
const stopRoute = require('./routes/stop');

// Add process error handlers
process.on('uncaughtException', (error) => {
	console.error('🔥 Uncaught Exception:', error);
	console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
	console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Add request logging
app.use((req, res, next) => {
	console.log(`📥 ${req.method} ${req.path}`, req.body ? `- Body: ${JSON.stringify(req.body).substring(0, 200)}` : '');
	next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Store connected clients for SSE
const connectedClients = new Set();

// SSE endpoint for real-time logs
app.get('/logs/stream', (req, res) => {
	console.log('🔌 New SSE connection established');
	
	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		Connection: 'keep-alive',
		'Access-Control-Allow-Origin': '*'
	});

	// Send initial connection message
	res.write(
		`data: ${JSON.stringify({ type: 'connection', message: 'Connected to log stream' })}\n\n`
	);

	// Add client to connected clients
	connectedClients.add(res);

	// Handle client disconnect
	req.on('close', () => {
		console.log('🔌 SSE connection closed');
		connectedClients.delete(res);
	});

	req.on('error', (err) => {
		console.log('🔌 SSE connection error:', err.message);
		connectedClients.delete(res);
	});
});

// Function to broadcast logs to all connected clients
function broadcastLog(profileIndex, message, cycleChangeData = null) {
	let logData;

	if (cycleChangeData) {
		// Handle cycle change event
		if (cycleChangeData.type === 'cycle_change') {
			logData = {
				type: 'cycle_change',
				cycle: cycleChangeData.cycle
			};
		} else if (cycleChangeData.type === 'status_change') {
			// Handle status change event
			logData = {
				type: 'status_change',
				profileIndex: cycleChangeData.profileIndex,
				status: cycleChangeData.status
			};
		}
	} else {
		// Handle regular log event
		logData = {
			type: 'log',
			profileIndex,
			message,
			timestamp: new Date().toISOString()
		};
	}

	const dataString = `data: ${JSON.stringify(logData)}\n\n`;
	
	// Send to all connected clients, remove failed connections
	const failedConnections = [];
	
	connectedClients.forEach((client) => {
		try {
			client.write(dataString);
		} catch (error) {
			console.log('🔌 Failed to write to SSE client:', error.message);
			failedConnections.push(client);
		}
	});

	// Remove failed connections
	failedConnections.forEach(client => connectedClients.delete(client));
}

// Make broadcastLog available globally
global.broadcastLog = broadcastLog;

// Routes
app.use('/open-url', openUrlRoute);
app.use('/logs', logsRoute.router);
app.use('/automation-status', automationStatusRoute);
app.use('/stop-automation', stopRoute);

// Root UI page
app.get('/', (req, res) => {
	try {
		res.sendFile(path.join(__dirname, 'public', 'index.html'));
	} catch (error) {
		console.error('Error serving index.html:', error);
		res.status(500).send('Internal server error');
	}
});

// Health check endpoint
app.get('/health', (req, res) => {
	res.json({ 
		status: 'healthy', 
		timestamp: new Date().toISOString(),
		uptime: process.uptime()
	});
});

// Error handling middleware
app.use((error, req, res, next) => {
	console.error('💥 Unhandled error in middleware:', error);
	console.error('Stack:', error.stack);
	res.status(500).json({
		success: false,
		error: 'Internal server error',
		details: error.message
	});
});

// 404 handler
app.use((req, res) => {
	console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
	res.status(404).json({
		success: false,
		error: 'Route not found'
	});
});

// Start server with error handling
const server = app
	.listen(PORT, () => {
		console.log(`✅ Server running at http://localhost:${PORT}`);
		console.log(`🌐 Web interface available at http://localhost:${PORT}`);
		console.log(`📊 SSE logs endpoint at http://localhost:${PORT}/logs/stream`);
	})
	.on('error', (error) => {
		console.error('❌ Server failed to start:', error);
		process.exit(1);
	});

// Graceful shutdown
function gracefulShutdown(signal) {
	console.log(`🔄 Received ${signal}, shutting down gracefully...`);
	
	// Close all SSE connections
	connectedClients.forEach(client => {
		try {
			client.end();
		} catch (e) {
			console.log('Error closing SSE client:', e.message);
		}
	});
	connectedClients.clear();
	
	server.close(() => {
		console.log('✅ Server closed');
		process.exit(0);
	});
	
	// Force close after 10 seconds
	setTimeout(() => {
		console.log('❌ Forced shutdown after timeout');
		process.exit(1);
	}, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;