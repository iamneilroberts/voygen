/**
 * Enhanced Mobile Chat Interface Template
 * Provides Claude/LibreChat-like experience
 */

export function getMobileChatHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>Voygen Chat - AI Travel Assistant</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8f9fa; color: #333; line-height: 1.5;
            height: 100vh; overflow: hidden;
        }
        
        .chat-container {
            display: flex; flex-direction: column; height: 100vh;
            background: white;
        }
        
        .header {
            background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
            color: white; padding: 12px 16px; display: flex;
            justify-content: space-between; align-items: center;
            box-shadow: 0 2px 10px rgba(0,123,255,0.2);
            position: sticky; top: 0; z-index: 100;
        }
        
        .header h1 {
            font-size: 18px; font-weight: 600; display: flex; align-items: center;
        }
        
        .header h1::before {
            content: '🤖'; margin-right: 8px; font-size: 20px;
        }
        
        .status-indicator {
            width: 8px; height: 8px; border-radius: 50%;
            background: #28a745; margin-left: 8px;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        
        .auth-screen {
            flex: 1; display: flex; flex-direction: column;
            justify-content: center; align-items: center; padding: 20px;
        }
        
        .auth-card {
            background: white; padding: 30px; border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            max-width: 400px; width: 100%;
        }
        
        .chat-area {
            flex: 1; overflow-y: auto; padding: 16px;
            background: #f8f9fa;
        }
        
        .message {
            margin-bottom: 16px; animation: fadeIn 0.3s ease;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .message-user {
            display: flex; justify-content: flex-end;
        }
        
        .message-assistant {
            display: flex; justify-content: flex-start;
        }
        
        .message-content {
            max-width: 85%; padding: 12px 16px; border-radius: 18px;
            word-wrap: break-word;
        }
        
        .message-user .message-content {
            background: #007bff; color: white;
            border-bottom-right-radius: 4px;
        }
        
        .message-assistant .message-content {
            background: white; color: #333;
            border: 1px solid #e9ecef;
            border-bottom-left-radius: 4px;
        }
        
        .message-time {
            font-size: 11px; opacity: 0.6; margin-top: 4px;
            text-align: right;
        }
        
        .message-assistant .message-time {
            text-align: left;
        }
        
        .typing-indicator {
            display: flex; align-items: center; padding: 12px 16px;
            background: white; border-radius: 18px; margin-bottom: 16px;
            max-width: 85px; border: 1px solid #e9ecef;
        }
        
        .typing-dots {
            display: flex; gap: 4px;
        }
        
        .typing-dot {
            width: 8px; height: 8px; border-radius: 50%;
            background: #666; animation: typing 1.4s infinite;
        }
        
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        
        @keyframes typing {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
            30% { transform: translateY(-10px); opacity: 1; }
        }
        
        .input-area {
            padding: 16px; background: white;
            border-top: 1px solid #e9ecef;
            display: flex; gap: 12px; align-items: flex-end;
        }
        
        .message-input {
            flex: 1; border: 1px solid #ddd; border-radius: 20px;
            padding: 12px 16px; font-size: 16px; resize: none;
            max-height: 120px; min-height: 44px;
            font-family: inherit;
        }
        
        .message-input:focus {
            outline: none; border-color: #007bff;
            box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
        }
        
        .send-button {
            width: 44px; height: 44px; border-radius: 50%;
            background: #007bff; color: white; border: none;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; transition: all 0.2s;
            font-size: 18px;
        }
        
        .send-button:hover:not(:disabled) { background: #0056b3; }
        .send-button:disabled { background: #ccc; cursor: not-allowed; }
        
        .quick-actions {
            padding: 8px 16px; background: white;
            border-top: 1px solid #e9ecef;
            display: flex; gap: 8px; overflow-x: auto;
        }
        
        .quick-action {
            background: #f8f9fa; color: #666; border: 1px solid #ddd;
            padding: 6px 12px; border-radius: 16px; font-size: 14px;
            cursor: pointer; white-space: nowrap; transition: all 0.2s;
        }
        
        .quick-action:hover {
            background: #e9ecef; color: #333;
        }
        
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; margin-bottom: 6px; font-weight: 500; }
        .form-group input { 
            width: 100%; padding: 12px; border: 1px solid #ddd;
            border-radius: 8px; font-size: 16px;
        }
        
        .btn {
            background: #007bff; color: white; padding: 12px 24px;
            border: none; border-radius: 8px; cursor: pointer;
            font-size: 16px; transition: background 0.3s;
        }
        .btn:hover { background: #0056b3; }
        
        .error-message {
            background: #f8d7da; color: #721c24; padding: 12px;
            border-radius: 8px; margin: 16px; font-size: 14px;
        }
        
        .welcome-message {
            text-align: center; padding: 40px 20px; color: #666;
        }
        
        .welcome-message h3 {
            color: #007bff; margin-bottom: 12px;
        }
        
        .suggestions {
            background: white; margin: 16px; padding: 16px;
            border-radius: 12px; border: 1px solid #e9ecef;
        }
        
        .suggestions h4 {
            color: #666; font-size: 14px; margin-bottom: 12px;
            text-transform: uppercase; letter-spacing: 0.5px;
        }
        
        .suggestion-item {
            background: #f8f9fa; padding: 10px; margin-bottom: 8px;
            border-radius: 8px; cursor: pointer; transition: background 0.2s;
        }
        
        .suggestion-item:hover {
            background: #e9ecef;
        }
        
        .hidden { display: none !important; }
        
        /* Mobile responsive */
        @media (max-width: 480px) {
            .header { padding: 10px 12px; }
            .header h1 { font-size: 16px; }
            .chat-area { padding: 12px; }
            .message-content { max-width: 90%; padding: 10px 14px; }
            .input-area { padding: 12px; gap: 8px; }
        }
    </style>
</head>
<body>
    <div class="chat-container">
        <!-- Header -->
        <div class="header">
            <h1>Voygen AI <span class="status-indicator" id="statusIndicator"></span></h1>
            <div style="font-size: 12px; opacity: 0.8;">
                <span id="connectionStatus">Connecting...</span>
            </div>
        </div>

        <!-- Authentication Screen -->
        <div id="authScreen" class="auth-screen">
            <div class="auth-card">
                <h2 style="text-align: center; margin-bottom: 20px;">🔐 Access Required</h2>
                <p style="text-align: center; margin-bottom: 20px; color: #666;">
                    Enter your API token to access Voygen's AI travel assistant
                </p>
                <div class="form-group">
                    <label for="apiToken">API Token:</label>
                    <input type="password" id="apiToken" placeholder="Enter your token" value="dev-secret">
                </div>
                <button id="connectBtn" class="btn" style="width: 100%;">Connect to Voygen</button>
                <div id="authError" class="error-message hidden"></div>
            </div>
        </div>

        <!-- Main Chat Interface -->
        <div id="chatInterface" class="hidden">
            <!-- Chat Area -->
            <div id="chatArea" class="chat-area">
                <div class="welcome-message">
                    <h3>Welcome to Voygen AI! 🛫</h3>
                    <p>I'm your AI travel assistant. I can help you manage trips, clients, bookings, and create travel proposals.</p>
                </div>
                
                <div class="suggestions">
                    <h4>Try saying:</h4>
                    <div class="suggestion-item" onclick="sendSuggestion('Show me all my trips')">
                        "Show me all my trips"
                    </div>
                    <div class="suggestion-item" onclick="sendSuggestion('Continue working on the Paris trip')">
                        "Continue working on the Paris trip"
                    </div>
                    <div class="suggestion-item" onclick="sendSuggestion('Create a new trip for John Smith to London')">
                        "Create a new trip for John Smith to London"
                    </div>
                    <div class="suggestion-item" onclick="sendSuggestion('Publish my latest proposal')">
                        "Publish my latest proposal"
                    </div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="quick-actions">
                <div class="quick-action" onclick="sendSuggestion('Show trips')">📋 Show Trips</div>
                <div class="quick-action" onclick="sendSuggestion('New trip')">➕ New Trip</div>
                <div class="quick-action" onclick="sendSuggestion('Continue last')">▶️ Continue</div>
                <div class="quick-action" onclick="sendSuggestion('Publish')">🚀 Publish</div>
            </div>

            <!-- Input Area -->
            <div class="input-area">
                <textarea id="messageInput" class="message-input" 
                          placeholder="Ask me about trips, clients, or travel planning..." 
                          rows="1"></textarea>
                <button id="sendButton" class="send-button" disabled>
                    ➤
                </button>
            </div>
        </div>
    </div>

    <script>
        class VoygenChat {
            constructor() {
                this.apiToken = '';
                this.sessionId = 'session_' + Date.now();
                this.context = {};
                this.isAuthenticated = false;
                this.init();
            }

            init() {
                this.setupEventListeners();
                this.setupAutoResize();
                
                // Check for saved token
                const savedToken = localStorage.getItem('voygen_token');
                if (savedToken) {
                    document.getElementById('apiToken').value = savedToken;
                }
            }

            setupEventListeners() {
                // Auth
                document.getElementById('connectBtn').addEventListener('click', () => this.authenticate());
                document.getElementById('apiToken').addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.authenticate();
                });

                // Chat
                document.getElementById('sendButton').addEventListener('click', () => this.sendMessage());
                document.getElementById('messageInput').addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        this.sendMessage();
                    }
                });

                // Enable send button when there's text
                document.getElementById('messageInput').addEventListener('input', (e) => {
                    const button = document.getElementById('sendButton');
                    button.disabled = !e.target.value.trim();
                });
            }

            setupAutoResize() {
                const textarea = document.getElementById('messageInput');
                textarea.addEventListener('input', function() {
                    this.style.height = 'auto';
                    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
                });
            }

            async authenticate() {
                const token = document.getElementById('apiToken').value;
                if (!token) {
                    this.showAuthError('Please enter an API token');
                    return;
                }

                try {
                    this.updateConnectionStatus('Connecting...');
                    
                    // Test connection with an authenticated endpoint
                    const response = await fetch('/trips', {
                        headers: {
                            'Authorization': 'Bearer ' + token
                        }
                    });

                    if (response.ok) {
                        this.apiToken = token;
                        this.isAuthenticated = true;
                        localStorage.setItem('voygen_token', token);
                        this.showChatInterface();
                        this.updateConnectionStatus('Connected');
                    } else {
                        const errorData = await response.json().catch(() => ({ error: 'Authentication failed' }));
                        throw new Error(errorData.error || 'Invalid token or server error');
                    }
                } catch (error) {
                    this.showAuthError('Connection failed: ' + error.message);
                    this.updateConnectionStatus('Disconnected');
                }
            }

            showAuthError(message) {
                const errorDiv = document.getElementById('authError');
                errorDiv.textContent = message;
                errorDiv.classList.remove('hidden');
            }

            showChatInterface() {
                document.getElementById('authScreen').classList.add('hidden');
                document.getElementById('chatInterface').classList.remove('hidden');
                document.getElementById('messageInput').focus();
            }

            updateConnectionStatus(status) {
                document.getElementById('connectionStatus').textContent = status;
                const indicator = document.getElementById('statusIndicator');
                
                if (status === 'Connected') {
                    indicator.style.background = '#28a745';
                } else if (status === 'Connecting...') {
                    indicator.style.background = '#ffc107';
                } else {
                    indicator.style.background = '#dc3545';
                }
            }

            async sendMessage() {
                const input = document.getElementById('messageInput');
                const message = input.value.trim();
                if (!message || !this.isAuthenticated) return;

                // Clear input and disable send
                input.value = '';
                input.style.height = 'auto';
                document.getElementById('sendButton').disabled = true;

                // Add user message
                this.addMessage('user', message);
                
                // Show typing indicator
                this.showTypingIndicator();

                try {
                    const response = await fetch('/chat/enhanced', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + this.apiToken
                        },
                        body: JSON.stringify({
                            message: message,
                            session_id: this.sessionId,
                            context: this.context
                        })
                    });

                    if (!response.ok) {
                        throw new Error('Server error: ' + response.status);
                    }

                    const data = await response.json();
                    
                    // Hide typing indicator
                    this.hideTypingIndicator();
                    
                    // Add assistant response
                    if (data.messages && data.messages.length > 1) {
                        const assistantMessage = data.messages[1];
                        this.addMessage('assistant', assistantMessage.content);
                    }
                    
                    // Update context if provided
                    if (data.context) {
                        this.context = { ...this.context, ...data.context };
                    }

                } catch (error) {
                    this.hideTypingIndicator();
                    this.addMessage('assistant', 
                        '❌ Sorry, I encountered an error: ' + error.message + 
                        '\\n\\nTry rephrasing your question or check your connection.');
                }
            }

            addMessage(role, content) {
                const chatArea = document.getElementById('chatArea');
                const messageDiv = document.createElement('div');
                messageDiv.className = 'message message-' + role;
                
                const contentDiv = document.createElement('div');
                contentDiv.className = 'message-content';
                
                // Convert markdown-like formatting
                let formattedContent = content
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/\\n/g, '<br>')
                    .replace(/\n/g, '<br>');
                
                contentDiv.innerHTML = formattedContent;
                
                const timeDiv = document.createElement('div');
                timeDiv.className = 'message-time';
                timeDiv.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                messageDiv.appendChild(contentDiv);
                messageDiv.appendChild(timeDiv);
                chatArea.appendChild(messageDiv);
                
                // Scroll to bottom
                chatArea.scrollTop = chatArea.scrollHeight;
                
                // Remove suggestions after first message
                const suggestions = chatArea.querySelector('.suggestions');
                if (suggestions && role === 'user') {
                    suggestions.remove();
                }
                
                const welcome = chatArea.querySelector('.welcome-message');
                if (welcome && role === 'user') {
                    welcome.remove();
                }
            }

            showTypingIndicator() {
                const chatArea = document.getElementById('chatArea');
                const typingDiv = document.createElement('div');
                typingDiv.id = 'typingIndicator';
                typingDiv.className = 'typing-indicator';
                typingDiv.innerHTML = '<div class="typing-dots"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
                chatArea.appendChild(typingDiv);
                chatArea.scrollTop = chatArea.scrollHeight;
            }

            hideTypingIndicator() {
                const indicator = document.getElementById('typingIndicator');
                if (indicator) indicator.remove();
            }
        }

        // Global function for suggestions
        function sendSuggestion(text) {
            const input = document.getElementById('messageInput');
            input.value = text;
            input.focus();
            document.getElementById('sendButton').disabled = false;
            
            // Auto-send after short delay
            setTimeout(() => {
                if (window.voygenChat) {
                    window.voygenChat.sendMessage();
                }
            }, 100);
        }

        // Initialize when DOM is loaded
        document.addEventListener('DOMContentLoaded', () => {
            window.voygenChat = new VoygenChat();
        });
    </script>
</body>
</html>`;
}