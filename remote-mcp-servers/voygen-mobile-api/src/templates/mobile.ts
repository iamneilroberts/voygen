/**
 * Mobile interface HTML template
 * 
 * NOTE: This template avoids complex template literals to prevent JavaScript
 * display issues. All JavaScript strings use concatenation instead of template literals.
 */

export function getMobileInterfaceHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Voygen Mobile - Trip Management</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5; color: #333; line-height: 1.6;
        }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header {
            background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
            color: white; padding: 20px; border-radius: 12px; margin-bottom: 30px;
            text-align: center; box-shadow: 0 4px 15px rgba(0, 123, 255, 0.3);
        }
        .header h1 { margin-bottom: 8px; font-weight: 600; }
        .header p { opacity: 0.9; }
        .auth-section, .trips-section {
            background: white; padding: 20px; border-radius: 12px;
            margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .trips-section { display: none; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: 500; color: #555; }
        input, select, textarea {
            width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px;
            font-size: 16px; transition: border-color 0.3s ease;
        }
        input:focus, select:focus, textarea:focus {
            outline: none; border-color: #007bff;
            box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
        }
        .btn {
            background: #007bff; color: white; padding: 12px 24px; border: none;
            border-radius: 8px; cursor: pointer; font-size: 16px;
            transition: background 0.3s ease; margin-right: 10px; margin-bottom: 10px;
        }
        .btn:hover { background: #0056b3; }
        .btn-success { background: #28a745; }
        .btn-success:hover { background: #1e7e34; }
        .btn-danger { background: #dc3545; }
        .btn-danger:hover { background: #c82333; }
        .trip-card {
            background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px;
            padding: 15px; margin-bottom: 15px; transition: box-shadow 0.3s ease;
        }
        .trip-card:hover { box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .trip-header {
            display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;
        }
        .trip-title { font-weight: 600; font-size: 18px; color: #007bff; }
        .status-badge {
            padding: 4px 12px; border-radius: 16px; font-size: 12px;
            font-weight: 600; text-transform: uppercase;
        }
        .status-planning { background: #fff3cd; color: #856404; }
        .status-confirmed { background: #d1ecf1; color: #0c5460; }
        .status-in_progress { background: #d4edda; color: #155724; }
        .status-completed { background: #d1ecf1; color: #0c5460; }
        .trip-details { margin-bottom: 10px; color: #666; }
        .trip-actions { display: flex; flex-wrap: wrap; gap: 8px; }
        .trip-actions .btn { font-size: 14px; padding: 8px 16px; margin: 0; }
        .error { background: #f8d7da; color: #721c24; padding: 12px; border-radius: 8px; margin-bottom: 15px; }
        .success { background: #d4edda; color: #155724; padding: 12px; border-radius: 8px; margin-bottom: 15px; }
        .loading { text-align: center; padding: 40px; color: #666; }
        .modal {
            display: none; position: fixed; z-index: 1000; left: 0; top: 0;
            width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.4);
        }
        .modal-content {
            background-color: #fefefe; margin: 15% auto; padding: 20px;
            border: none; border-radius: 12px; width: 90%; max-width: 500px;
        }
        .close { color: #aaa; float: right; font-size: 28px; font-weight: bold; cursor: pointer; }
        .close:hover { color: black; }
        @media (max-width: 600px) {
            .container { padding: 10px; }
            .trip-header { flex-direction: column; align-items: flex-start; }
            .trip-actions { margin-top: 10px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛫 Voygen Mobile</h1>
            <p>Trip Management Interface</p>
        </div>

        <div id="authSection" class="auth-section">
            <h3>Authentication Required</h3>
            <p>Please enter your API token to access trip management features.</p>
            <div class="form-group">
                <label for="authToken">API Token:</label>
                <input type="password" id="authToken" value="dev-secret" placeholder="Enter your API token">
            </div>
            <button id="connectBtn" class="btn">Connect</button>
        </div>

        <div id="mainInterface" class="trips-section">
            <div class="trip-header">
                <h3>Your Trips</h3>
                <button id="newTripBtn" class="btn btn-success">+ New Trip</button>
            </div>
            <div id="tripsContainer">
                <div class="loading">Loading trips...</div>
            </div>
        </div>

        <div id="createTripModal" class="modal">
            <div class="modal-content">
                <span id="modalClose" class="close">&times;</span>
                <h3>Create New Trip</h3>
                <form id="createTripForm">
                    <div class="form-group">
                        <label for="tripName">Trip Name:</label>
                        <input type="text" id="tripName" required>
                    </div>
                    <div class="form-group">
                        <label for="startDate">Start Date:</label>
                        <input type="date" id="startDate" required>
                    </div>
                    <div class="form-group">
                        <label for="endDate">End Date:</label>
                        <input type="date" id="endDate" required>
                    </div>
                    <div class="form-group">
                        <label for="destinations">Destinations:</label>
                        <input type="text" id="destinations" placeholder="e.g. Paris, Rome, Barcelona">
                    </div>
                    <div class="form-group">
                        <label for="status">Status:</label>
                        <select id="status">
                            <option value="planning">Planning</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                    <button type="submit" class="btn">Create Trip</button>
                </form>
            </div>
        </div>
    </div>

    <script>
        const API_BASE = '/';
        let authToken = '';
        let somotravelTripsOrder = [];

        // Authentication
        function authenticate() {
            const token = document.getElementById('authToken').value;
            if (!token) {
                showError('Please enter an API token');
                return;
            }
            authToken = token;
            fetchTrips();
        }

        // API Helper - Using string concatenation instead of template literals
        async function apiCall(endpoint, options = {}) {
            const headers = { 'Content-Type': 'application/json', ...options.headers };
            if (authToken) {
                headers['Authorization'] = 'Bearer ' + authToken;
            }
            
            const response = await fetch(API_BASE + endpoint, { ...options, headers });
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Network error' }));
                throw new Error(error.error || ('HTTP ' + response.status));
            }
            return await response.json();
        }

        // Fetch and display trips
        async function fetchTrips() {
            try {
                const data = await apiCall('trips');
                displayTrips(data.trips);
                showMainInterface();
            } catch (error) {
                showError('Authentication failed: ' + error.message);
            }
        }

        // Display trips using string concatenation to avoid template literal issues
        function displayTrips(trips) {
            const container = document.getElementById('tripsContainer');
            if (trips.length === 0) {
                container.innerHTML = '<p>No trips found. Create your first trip!</p>';
                return;
            }
            
            let html = '';
            trips.forEach(trip => {
                html += '<div class="trip-card">';
                html += '<div class="trip-header">';
                html += '<div class="trip-title">' + trip.trip_name + '</div>';
                html += '<span class="status-badge status-' + trip.status + '">' + trip.status + '</span>';
                html += '</div>';
                html += '<div class="trip-details">';
                html += '<strong>📍</strong> ' + (trip.destinations || 'No destinations set') + '<br>';
                html += '<strong>📅</strong> ' + formatDate(trip.start_date) + ' - ' + formatDate(trip.end_date) + '<br>';
                if (trip.total_cost) html += '<strong>💰</strong> $' + trip.total_cost;
                html += '</div>';
                html += '<div class="trip-actions">';
                html += '<button class="btn" onclick="viewTrip(' + trip.trip_id + ')">Summary</button>';
                html += '<button class="btn" onclick="viewTripDetails(' + trip.trip_id + ')">Details</button>';
                html += '<button class="btn" onclick="viewProposal(\'' + trip.trip_name + '\')">Preview</button>';
                html += '<button class="btn btn-success" onclick="publishTrip(' + trip.trip_id + ')">Publish</button>';
                html += '</div>';
                html += '</div>';
            });
            container.innerHTML = html;
        }

        // Trip actions - simplified to avoid template literal issues
        async function viewTrip(tripId) {
            try {
                const data = await apiCall('trips/' + tripId);
                const trip = data.trip;
                
                let details = '📊 Trip Details\\n\\n';
                details += '🎫 Name: ' + trip.trip_name + '\\n';
                details += '📍 Destinations: ' + (trip.destinations || 'Not set') + '\\n';
                details += '📅 Dates: ' + formatDate(trip.start_date) + ' - ' + formatDate(trip.end_date) + '\\n';
                details += '🏷️ Status: ' + trip.status + '\\n';
                details += '💰 Cost: $' + (trip.total_cost || 0) + '\\n';
                details += '👥 Group: ' + (trip.group_name || 'None') + '\\n\\n';
                
                alert(details);
            } catch (error) {
                showError('Failed to fetch trip: ' + error.message);
            }
        }

        function viewTripDetails(tripId) {
            alert('Detailed view temporarily disabled. Use Summary for basic trip information.');
        }

        function viewProposal(tripName) {
            alert('Proposal preview temporarily disabled. Use Publish to create and view proposals.');
        }

        async function publishTrip(tripId) {
            try {
                if (!confirm('Are you sure you want to publish this trip?')) return;
                
                showSuccess('Publishing trip...');
                const data = await apiCall('publish/' + tripId, { method: 'POST' });
                
                if (data.html_url) {
                    showSuccess('Trip published successfully! <a href="' + data.html_url + '" target="_blank">View Published Trip</a>');
                } else {
                    showSuccess('Trip published successfully!');
                }
            } catch (error) {
                showError('Failed to publish trip: ' + error.message);
            }
        }

        // Create trip form handler (will be attached in DOMContentLoaded)
        function setupCreateTripForm() {
            document.getElementById('createTripForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = {
                    trip_name: document.getElementById('tripName').value,
                    start_date: document.getElementById('startDate').value,
                    end_date: document.getElementById('endDate').value,
                    destinations: document.getElementById('destinations').value,
                    status: document.getElementById('status').value,
                    owner: 'mobile-user'
                };
                
                try {
                    await apiCall('trips', { method: 'POST', body: JSON.stringify(formData) });
                    showSuccess('Trip created successfully!');
                    hideCreateTripModal();
                    fetchTrips();
                    document.getElementById('createTripForm').reset();
                } catch (error) {
                    showError('Failed to create trip: ' + error.message);
                }
            });
        }

        // UI helpers
        function showMainInterface() {
            document.getElementById('authSection').style.display = 'none';
            document.getElementById('mainInterface').style.display = 'block';
        }

        function showCreateTripModal() {
            document.getElementById('createTripModal').style.display = 'block';
        }

        function hideCreateTripModal() {
            document.getElementById('createTripModal').style.display = 'none';
        }

        function showError(message) {
            removeMessages();
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error';
            errorDiv.innerHTML = message;
            document.querySelector('.container').insertBefore(errorDiv, document.querySelector('.container').firstChild);
        }

        function showSuccess(message) {
            removeMessages();
            const successDiv = document.createElement('div');
            successDiv.className = 'success';
            successDiv.innerHTML = message;
            document.querySelector('.container').insertBefore(successDiv, document.querySelector('.container').firstChild);
        }

        function removeMessages() {
            const messages = document.querySelectorAll('.error, .success');
            messages.forEach(msg => msg.remove());
        }

        function formatDate(dateString) {
            return new Date(dateString).toLocaleDateString();
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            document.getElementById('authToken').value = 'dev-secret';
            localStorage.setItem('authToken', 'dev-secret');
            setupCreateTripForm();
            
            // Attach event listeners
            document.getElementById('connectBtn').addEventListener('click', authenticate);
            document.getElementById('newTripBtn').addEventListener('click', showCreateTripModal);
            document.getElementById('modalClose').addEventListener('click', hideCreateTripModal);
        });
    </script>
</body>
</html>`;
}