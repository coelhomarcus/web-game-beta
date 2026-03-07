import { socket } from "../network/socket";
import { getPlayerName } from "../network/events";
import { controls } from "../systems/input";
import { DEFAULT_PLAYER_NAME } from "../utils/playerName";

// ── DOM ──────────────────────────────────────────────────────────────────────
const chatContainer = document.createElement("div");
chatContainer.id = "chat-container";

const chatMessages = document.createElement("div");
chatMessages.id = "chat-messages";

const chatInputWrap = document.createElement("div");
chatInputWrap.id = "chat-input-wrap";
chatInputWrap.style.display = "none";

const chatInput = document.createElement("input");
chatInput.id = "chat-input";
chatInput.type = "text";
chatInput.maxLength = 120;
chatInput.placeholder = "Digite sua mensagem...";
chatInput.autocomplete = "off";

chatInputWrap.appendChild(chatInput);
chatContainer.appendChild(chatMessages);
chatContainer.appendChild(chatInputWrap);
document.body.appendChild(chatContainer);

// ── State ────────────────────────────────────────────────────────────────────
let chatOpen = false;

export function isChatOpen() {
  return chatOpen;
}

export function openChat() {
  chatOpen = true;
  chatInputWrap.style.display = "flex";
  chatContainer.classList.add("active");
  controls.unlock();
  chatInput.focus();
}

export function closeChat() {
  chatOpen = false;
  chatInput.value = "";
  chatInputWrap.style.display = "none";
  chatContainer.classList.remove("active");
  controls.lock();
}

function sendMessage() {
  const text = chatInput.value.trim();
  if (text.length === 0) {
    closeChat();
    return;
  }
  const name = getPlayerName() || DEFAULT_PLAYER_NAME;
  socket.emit("chat_message", { message: text });
  addMessage(name, text, true);
  closeChat();
}

// ── Public API ───────────────────────────────────────────────────────────────
export function addMessage(name: string, text: string, isMe: boolean) {
  const el = document.createElement("div");
  el.className = "chat-msg" + (isMe ? " chat-msg-me" : "");

  const nameSpan = document.createElement("span");
  nameSpan.className = "chat-name";
  nameSpan.textContent = name + ":";

  const textSpan = document.createElement("span");
  textSpan.className = "chat-text";
  textSpan.textContent = text;

  el.appendChild(nameSpan);
  el.appendChild(document.createTextNode(" "));
  el.appendChild(textSpan);

  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Fade out after 8 seconds if chat is not focused
  setTimeout(() => {
    el.classList.add("chat-msg-fade");
    setTimeout(() => {
      if (chatMessages.contains(el)) el.remove();
    }, 1000);
  }, 8000);

  // Keep max 50 messages
  while (chatMessages.children.length > 50) {
    chatMessages.removeChild(chatMessages.firstChild!);
  }
}

// ── Input events ─────────────────────────────────────────────────────────────
chatInput.addEventListener("keydown", (e) => {
  e.stopPropagation(); // prevent game controls from firing
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  }
  if (e.key === "Escape") {
    e.preventDefault();
    closeChat();
  }
});

chatInput.addEventListener("keyup", (e) => {
  e.stopPropagation();
});
