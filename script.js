/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");

/* OpenAI settings */
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

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
function addMessage(role, content) {
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("msg", role);

  // Friendly labels to make messages clearer for beginners.
  if (role === "user") {
    messageDiv.textContent = `You: ${content}`;
  } else {
    messageDiv.textContent = `Advisor: ${content}`;
  }

  chatWindow.appendChild(messageDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Starter greeting from the assistant.
addMessage(
  "ai",
  "Hello. Ask me about L'Oreal products, routines, and recommendations.",
);

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userText = userInput.value.trim();
  if (!userText) return;

  // Show user message in the UI.
  addMessage("user", userText);

  // Add user message to conversation history.
  messages.push({
    role: "user",
    content: userText,
  });

  // Clear input and lock controls while waiting for the API.
  userInput.value = "";
  userInput.focus();
  sendBtn.disabled = true;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: messages,
        max_completion_tokens: 300,
      }),
    });

    const data = await response.json();

    // Show a readable error if the API request fails.
    if (!response.ok) {
      const apiError =
        data.error?.message || "Something went wrong with the API request.";
      addMessage("ai", `Sorry, I could not complete that request. ${apiError}`);
      return;
    }

    // Read the assistant message from data.choices[0].message.content.
    const aiText = data.choices?.[0]?.message?.content?.trim();

    if (!aiText) {
      addMessage(
        "ai",
        "Sorry, I received an empty response. Please try again.",
      );
      return;
    }

    // Add assistant message to history and display it.
    messages.push({
      role: "assistant",
      content: aiText,
    });

    addMessage("ai", aiText);
  } catch (error) {
    addMessage(
      "ai",
      "Sorry, I could not connect to OpenAI. Please check your internet connection.",
    );
    console.error("Request error:", error);
  } finally {
    sendBtn.disabled = false;
  }
});
