/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");
const CHAT_HISTORY_KEY = "loreal-chat-history";

/* OpenAI settings */
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const WORKER_URL = "https://lorealproject.wyattschaub.workers.dev/";

// This system prompt keeps the assistant focused on L'Oréal topics only.
const systemPrompt = `You are a helpful L'Oreal beauty advisor.
Only answer questions related to L'Oreal products, routines, beauty concerns, ingredients, shades, and usage recommendations.
If a question is not about L'Oreal beauty topics, politely refuse and ask the user to ask a L'Oreal-related question.
Keep answers concise, practical, and easy to understand.`;

// We store the conversation as a messages array because Chat Completions uses this format.
const messages = [
  {
    role: "system",
    content: systemPrompt,
  },
];

// Helper: add one message bubble to the chat window.
function addMessage(role, content, shouldScrollToBottom = true) {
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("msg", role);
  messageDiv.textContent = content;

  chatWindow.appendChild(messageDiv);

  if (shouldScrollToBottom) {
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  return messageDiv;
}

// Keep the latest user question pinned at the top of the visible chat box.
function pinMessageToTop(messageElement) {
  requestAnimationFrame(() => {
    const containerTop = chatWindow.getBoundingClientRect().top;
    const messageTop = messageElement.getBoundingClientRect().top;
    const offsetWithinContainer = messageTop - containerTop;
    chatWindow.scrollTop += offsetWithinContainer;
  });
}

// Save only user/assistant turns, not the system instruction.
function saveChatHistory() {
  const chatTurns = messages.filter((message) => message.role !== "system");
  localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chatTurns));
}

// Load previous turns so the conversation context is preserved across refreshes.
function loadChatHistory() {
  try {
    const rawHistory = localStorage.getItem(CHAT_HISTORY_KEY);
    if (!rawHistory) return [];

    const parsedHistory = JSON.parse(rawHistory);
    if (!Array.isArray(parsedHistory)) return [];

    return parsedHistory.filter(
      (turn) =>
        (turn.role === "user" || turn.role === "assistant") &&
        typeof turn.content === "string",
    );
  } catch (error) {
    console.error("Could not load saved chat history:", error);
    return [];
  }
}

const savedTurns = loadChatHistory();

if (savedTurns.length > 0) {
  savedTurns.forEach((turn) => {
    messages.push(turn);
    addMessage(turn.role === "assistant" ? "ai" : "user", turn.content, false);
  });

  chatWindow.scrollTop = chatWindow.scrollHeight;
} else {
  // Starter greeting from the assistant.
  addMessage(
    "ai",
    "Hello. Ask me about L'Oreal products, routines, and recommendations.",
  );
}

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userText = userInput.value.trim();
  if (!userText) return;

  // Add newest question and keep it pinned at top of the visible chat box.
  const userMessageElement = addMessage("user", userText, false);
  const thinkingMessage = addMessage("ai", "Thinking...", false);
  pinMessageToTop(userMessageElement);

  // Add user message to conversation history.
  messages.push({
    role: "user",
    content: userText,
  });
  saveChatHistory();

  // Clear input and lock controls while waiting for the API.
  userInput.value = "";
  userInput.focus();
  sendBtn.disabled = true;

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: messages,
      }),
    });

    const data = await response.json();

    // Show a readable error if the API request fails.
    if (!response.ok) {
      const apiError =
        data.error?.message || "Something went wrong with the API request.";
      const errorText = `Sorry, I could not complete that request. ${apiError}`;
      thinkingMessage.textContent = errorText;

      messages.push({
        role: "assistant",
        content: errorText,
      });
      saveChatHistory();
      pinMessageToTop(userMessageElement);
      return;
    }

    // Read the assistant message from data.choices[0].message.content.
    const aiText = data.choices?.[0]?.message?.content?.trim();

    if (!aiText) {
      const emptyText =
        "Sorry, I received an empty response. Please try again.";
      thinkingMessage.textContent = emptyText;

      messages.push({
        role: "assistant",
        content: emptyText,
      });
      saveChatHistory();
      pinMessageToTop(userMessageElement);
      return;
    }

    // Add assistant message to history and display it.
    messages.push({
      role: "assistant",
      content: aiText,
    });
    saveChatHistory();

    thinkingMessage.textContent = aiText;
    pinMessageToTop(userMessageElement);
  } catch (error) {
    const connectionError =
      "Sorry, I could not connect to OpenAI. Please check your internet connection.";
    thinkingMessage.textContent = connectionError;

    messages.push({
      role: "assistant",
      content: connectionError,
    });
    saveChatHistory();
    pinMessageToTop(userMessageElement);

    console.error("Request error:", error);
  } finally {
    sendBtn.disabled = false;
  }
});
