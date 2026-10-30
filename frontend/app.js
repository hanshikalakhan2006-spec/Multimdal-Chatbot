// --- DOM Elements ---
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const chatMessages = document.getElementById('chat-messages');
const loadingIndicator = document.getElementById('loading-indicator');
const errorBanner = document.getElementById('error-banner');
const errorText = document.getElementById('error-text');
const closeErrorBtn = document.getElementById('close-error-btn');
const statusBadge = document.getElementById('status-badge');
const statusText = document.getElementById('status-text');

// Image Elements
const attachImageBtn = document.getElementById('attach-image-btn');
const imageInput = document.getElementById('image-input');
const imagePreviewBar = document.getElementById('image-preview-bar');
const imagePreviewImg = document.getElementById('image-preview-img');
const previewFilename = document.getElementById('preview-filename');
const previewFilesize = document.getElementById('preview-filesize');
const removeImageBtn = document.getElementById('remove-image-btn');

// Audio Elements (Step 3)
const attachAudioBtn = document.getElementById('attach-audio-btn');
const audioInput = document.getElementById('audio-input');
const audioPreviewBar = document.getElementById('audio-preview-bar');
const audioFilename = document.getElementById('audio-filename');
const audioFilesize = document.getElementById('audio-filesize');
const audioPreviewPlayer = document.getElementById('audio-preview-player');
const removeAudioBtn = document.getElementById('remove-audio-btn');

let selectedImageFile = null;
let selectedAudioFile = null;

// --- 1. Check Server Status on Startup ---
async function checkServerStatus() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error('Status endpoint returned an error');
    const data = await res.json();

    if (data.mode === 'live') {
      statusBadge.className = 'badge badge-live';
      statusText.textContent = 'Gemini AI Connected';
    } else {
      statusBadge.className = 'badge badge-mock';
      statusText.textContent = 'Mock Mode (UI Testing)';
    }
  } catch (err) {
    statusBadge.className = 'badge badge-connecting';
    statusText.textContent = 'Server Offline';
    console.warn('Could not connect to /api/status:', err);
  }
}

checkServerStatus();

// --- 2. Error Banner Helpers ---
function showError(msg) {
  errorText.textContent = msg;
  errorBanner.classList.remove('hidden');
}

function hideError() {
  errorBanner.classList.add('hidden');
}

closeErrorBtn.addEventListener('click', hideError);

// --- 3. Image Selection & Validation ---
attachImageBtn.addEventListener('click', () => {
  imageInput.click();
});

imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  hideError();

  // Allowed formats
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  const hasExt = Boolean(file.name.match(/\.(png|jpe?g|webp)$/i));

  if (!allowedTypes.includes(file.type) && !hasExt) {
    showError('Unsupported format. Please select a PNG, JPG, or WEBP image.');
    imageInput.value = '';
    return;
  }

  // 15MB limit
  if (file.size > 15 * 1024 * 1024) {
    showError('Image is too large. Maximum size is 15 MB.');
    imageInput.value = '';
    return;
  }

  // Clear any existing audio selection (one media file per message)
  clearAudioSelection();

  selectedImageFile = file;
  previewFilename.textContent = file.name;
  previewFilesize.textContent = `${(file.size / 1024).toFixed(1)} KB`;
  imagePreviewImg.src = URL.createObjectURL(file);
  imagePreviewBar.classList.remove('hidden');

  messageInput.focus();
});

function clearImageSelection() {
  selectedImageFile = null;
  imageInput.value = '';
  imagePreviewBar.classList.add('hidden');
  imagePreviewImg.src = '';
}

removeImageBtn.addEventListener('click', clearImageSelection);

// --- 4. Audio Selection & Validation (Step 3) ---
attachAudioBtn.addEventListener('click', () => {
  audioInput.click();
});

audioInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  hideError();

  // Validate audio formats: mp3, wav, m4a, aac, ogg, webm
  const isAudioType = file.type.startsWith('audio/') || file.type.includes('mp4');
  const hasAudioExt = Boolean(file.name.match(/\.(mp3|wav|m4a|aac|ogg|webm)$/i));

  if (!isAudioType && !hasAudioExt) {
    showError('Unsupported audio format. Supported files: MP3, WAV, M4A, AAC, and OGG.');
    audioInput.value = '';
    return;
  }

  // Max size: 15MB
  if (file.size > 15 * 1024 * 1024) {
    showError('Audio file is too large. Maximum size is 15 MB.');
    audioInput.value = '';
    return;
  }

  // Clear any existing image selection
  clearImageSelection();

  selectedAudioFile = file;
  audioFilename.textContent = file.name;
  audioFilesize.textContent = `${(file.size / 1024).toFixed(1)} KB`;
  audioPreviewPlayer.src = URL.createObjectURL(file);
  audioPreviewBar.classList.remove('hidden');

  messageInput.focus();
});

function clearAudioSelection() {
  selectedAudioFile = null;
  audioInput.value = '';
  audioPreviewPlayer.pause();
  audioPreviewPlayer.src = '';
  audioPreviewBar.classList.add('hidden');
}

removeAudioBtn.addEventListener('click', clearAudioSelection);

// --- 5. Message Bubble Rendering ---
function appendMessage(sender, text, media = {}) {
  const isUser = sender === 'user';
  const row = document.createElement('div');
  row.className = `message-row ${isUser ? 'user-row' : 'bot-row'}`;

  const avatar = document.createElement('div');
  avatar.className = `avatar ${isUser ? 'user-avatar' : 'bot-avatar'}`;
  avatar.textContent = isUser ? '👤' : '🤖';

  const bubble = document.createElement('div');
  bubble.className = `message-bubble ${isUser ? 'user-bubble' : 'bot-bubble'}`;

  const header = document.createElement('div');
  header.className = 'bubble-header';
  header.textContent = isUser ? 'You' : 'Study Buddy';
  bubble.appendChild(header);

  // If user uploaded an image, display thumbnail
  if (media.imageUrl) {
    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'bubble-image-wrapper';
    const img = document.createElement('img');
    img.src = media.imageUrl;
    img.alt = 'Uploaded study image';
    img.className = 'bubble-image';
    imgWrapper.appendChild(img);
    bubble.appendChild(imgWrapper);
  }

  // If user uploaded an audio file, display playable audio in chat history
  if (media.audioUrl) {
    const audioWrapper = document.createElement('div');
    audioWrapper.className = 'bubble-audio-wrapper';

    const audioTag = document.createElement('span');
    audioTag.className = 'bubble-audio-tag';
    audioTag.textContent = media.mode === 'transcribe'
      ? '🎙️ Audio (Verbatim Transcript Request)'
      : '🎙️ Audio (Summarize & Study Guide Request)';

    const audioPlayer = document.createElement('audio');
    audioPlayer.src = media.audioUrl;
    audioPlayer.controls = true;
    audioPlayer.className = 'bubble-audio-player';

    audioWrapper.appendChild(audioTag);
    audioWrapper.appendChild(audioPlayer);
    bubble.appendChild(audioWrapper);
  }

  if (text) {
    const content = document.createElement('div');
    content.className = 'bubble-content';
    content.textContent = text;
    bubble.appendChild(content);
  }

  row.appendChild(avatar);
  row.appendChild(bubble);

  chatMessages.appendChild(row);
  scrollToBottom();
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- 6. Loading State Controls ---
function setLoading(isLoading) {
  if (isLoading) {
    loadingIndicator.classList.remove('hidden');
    sendButton.disabled = true;
    attachImageBtn.disabled = true;
    attachAudioBtn.disabled = true;
    messageInput.disabled = true;
    scrollToBottom();
  } else {
    loadingIndicator.classList.add('hidden');
    sendButton.disabled = false;
    attachImageBtn.disabled = false;
    attachAudioBtn.disabled = false;
    messageInput.disabled = false;
    messageInput.focus();
  }
}

// --- 7. Auto-expand Textarea & Handle Enter Key ---
messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 120)}px`;
});

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

// --- 8. Form Submission (Text, Image, and Audio) ---
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const text = messageInput.value.trim();
  const imageToSend = selectedImageFile;
  const audioToSend = selectedAudioFile;

  // Validation: Must have at least text OR an image OR an audio file
  if (!text && !imageToSend && !audioToSend) {
    showError('Please enter a question or upload a file (image or audio).');
    return;
  }

  // Get selected audio mode if audio is attached
  const selectedMode = document.querySelector('input[name="audio-mode"]:checked')?.value || 'summarize';

  // Prepare display media for the user's bubble
  const mediaPayload = {};
  if (imageToSend) {
    mediaPayload.imageUrl = URL.createObjectURL(imageToSend);
  }
  if (audioToSend) {
    mediaPayload.audioUrl = URL.createObjectURL(audioToSend);
    mediaPayload.mode = selectedMode;
  }

  // Render user bubble in chat
  let defaultUserText = '';
  if (!text) {
    if (audioToSend) {
      defaultUserText = selectedMode === 'transcribe'
        ? '(Transcribe uploaded audio)'
        : '(Summarize uploaded audio lecture)';
    } else if (imageToSend) {
      defaultUserText = '(Analyze uploaded image)';
    }
  }

  appendMessage('user', text || defaultUserText, mediaPayload);

  // Clear inputs and previews immediately
  messageInput.value = '';
  messageInput.style.height = 'auto';
  clearImageSelection();
  clearAudioSelection();

  // Show loading indicator
  setLoading(true);

  try {
    // Build FormData
    const formData = new FormData();
    if (text) {
      formData.append('message', text);
    }
    if (imageToSend) {
      formData.append('image', imageToSend);
    }
    if (audioToSend) {
      formData.append('audio', audioToSend);
      formData.append('mode', selectedMode);
    }

    // Send request to server
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Server returned an error.');
    }

    // Display Study Buddy response
    appendMessage('bot', data.reply);

  } catch (err) {
    console.error('Chat error:', err);
    showError(err.message || 'Could not connect to the Study Buddy server.');
    appendMessage('bot', '⚠️ Sorry, I could not process your request. Please check the error message above.');
  } finally {
    setLoading(false);
  }
});

