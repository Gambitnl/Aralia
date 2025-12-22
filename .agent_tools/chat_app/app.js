const messageList = document.getElementById('message-list');
const refreshBtn = document.getElementById('refresh-btn');
const msgInput = document.getElementById('msg-input');
const currentAgentLabel = document.getElementById('current-agent');

let lastMessageId = 0;

// Set UI to Human mode for user
currentAgentLabel.textContent = 'Human';
currentAgentLabel.style.background = '#ff4081'; // User color

async function fetchMessages() {
    try {
        const response = await fetch('/api/messages');
        const messages = await response.json();
        renderMessages(messages);
    } catch (error) {
        console.error('Failed to fetch messages:', error);
    }
}

async function sendMessage(text) {
    if (!text.trim()) return;

    try {
        const response = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });

        if (response.ok) {
            msgInput.value = '';
            fetchMessages();
        }
    } catch (error) {
        console.error('Failed to send message:', error);
    }
}

function renderMessages(messages) {
    if (messages.length === 0) {
        messageList.innerHTML = `
            <div class="loading-state">
                <p>No messages yet. Use the local_chat.py tool to start communicating.</p>
            </div>
        `;
        return;
    }

    // Clear loading state
    if (messageList.querySelector('.loading-state')) {
        messageList.innerHTML = '';
    }

    // Only append new messages
    const newMessages = messages.filter(m => m.id > lastMessageId);

    newMessages.forEach(msg => {
        const msgEl = document.createElement('div');
        msgEl.className = 'message';
        if (msg.agent === 'Human') msgEl.classList.add('user-message');

        const timestamp = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        msgEl.innerHTML = `
            <div class="msg-header">
                <span class="msg-agent" data-agent="${msg.agent}">${msg.agent}</span>
                <span class="msg-time">${timestamp}</span>
            </div>
            <div class="msg-bubble">
                ${msg.message.replace(/\n/g, '<br>')}
                ${msg.tags && msg.tags.length > 0 ? `
                    <div class="msg-tags">
                        ${msg.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;

        messageList.appendChild(msgEl);
        lastMessageId = msg.id;
    });

    if (newMessages.length > 0) {
        messageList.scrollTop = messageList.scrollHeight;
    }
}

// Event Listeners
msgInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage(msgInput.value);
    }
});

refreshBtn.addEventListener('click', fetchMessages);

// Initial fetch
fetchMessages();

// Auto-refresh every 5 seconds
setInterval(fetchMessages, 5000);
