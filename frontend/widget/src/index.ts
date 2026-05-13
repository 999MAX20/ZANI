type ZaniWidgetOptions = {
  publicToken: string;
  apiUrl?: string;
  position?: "right" | "left";
};

type ConversationResponse = {
  conversation_id: string;
  message_id: number;
  status: string;
};

declare global {
  interface Window {
    ZaniWidget?: {
      init: (options: ZaniWidgetOptions) => void;
    };
  }
}

const styles = `
.zani-widget-root{position:fixed;z-index:2147483000;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.zani-widget-root[data-position="right"]{right:22px;bottom:22px}
.zani-widget-root[data-position="left"]{left:22px;bottom:22px}
.zani-bubble{display:grid;place-items:center;width:64px;height:64px;border:0;border-radius:24px;background:linear-gradient(135deg,#0ea5e9,#4f46e5,#7c3aed);color:white;box-shadow:0 18px 45px rgba(79,70,229,.35);cursor:pointer;transition:transform .18s ease,box-shadow .18s ease}
.zani-bubble:hover{transform:translateY(-2px);box-shadow:0 22px 60px rgba(79,70,229,.42)}
.zani-panel{position:absolute;right:0;bottom:78px;width:min(380px,calc(100vw - 32px));overflow:hidden;border:1px solid rgba(226,232,240,.9);border-radius:28px;background:rgba(255,255,255,.96);box-shadow:0 28px 90px rgba(15,23,42,.22);backdrop-filter:blur(18px)}
.zani-widget-root[data-position="left"] .zani-panel{left:0;right:auto}
.zani-panel[hidden]{display:none}
.zani-header{padding:18px 18px 14px;background:linear-gradient(135deg,#0f172a,#1d4ed8);color:white}
.zani-title{margin:0;font-size:16px;font-weight:800}
.zani-subtitle{margin:4px 0 0;font-size:13px;color:rgba(255,255,255,.72)}
.zani-body{display:grid;gap:10px;max-height:360px;overflow:auto;padding:16px;background:linear-gradient(180deg,#fff,#f8fafc)}
.zani-message{max-width:86%;border-radius:18px;padding:10px 12px;font-size:13px;line-height:1.45}
.zani-message.system{background:#eef2ff;color:#3730a3}
.zani-message.user{justify-self:end;background:#0f172a;color:white}
.zani-message.status{background:#f1f5f9;color:#475569}
.zani-form{display:grid;gap:8px;padding:14px;border-top:1px solid #e2e8f0;background:white}
.zani-input{min-height:42px;border:1px solid #dbe3ef;border-radius:16px;padding:0 12px;font:inherit;font-size:14px;outline:none}
.zani-input:focus{border-color:#2563eb;box-shadow:0 0 0 4px rgba(37,99,235,.12)}
.zani-actions{display:flex;gap:8px}
.zani-actions .zani-input{flex:1}
.zani-send{min-width:92px;border:0;border-radius:16px;background:#0f172a;color:white;font-weight:800;cursor:pointer}
.zani-send:disabled{opacity:.55;cursor:not-allowed}
`;

class ZaniWidgetController {
  private options: ZaniWidgetOptions;
  private conversationId: string | null = null;
  private root: HTMLDivElement;
  private panel: HTMLDivElement;
  private body: HTMLDivElement;
  private input: HTMLInputElement;
  private nameInput: HTMLInputElement;
  private phoneInput: HTMLInputElement;
  private sendButton: HTMLButtonElement;

  constructor(options: ZaniWidgetOptions) {
    this.options = options;
    this.root = document.createElement("div");
    this.panel = document.createElement("div");
    this.body = document.createElement("div");
    this.input = document.createElement("input");
    this.nameInput = document.createElement("input");
    this.phoneInput = document.createElement("input");
    this.sendButton = document.createElement("button");
    this.mount();
  }

  private mount() {
    injectStyles();
    this.root.className = "zani-widget-root";
    this.root.dataset.position = this.options.position || "right";

    const bubble = document.createElement("button");
    bubble.className = "zani-bubble";
    bubble.type = "button";
    bubble.innerHTML = "✦";
    bubble.ariaLabel = "Open Zani chat";

    this.panel.className = "zani-panel";
    this.panel.hidden = true;
    this.panel.innerHTML = `
      <div class="zani-header">
        <p class="zani-title">Zani chat</p>
        <p class="zani-subtitle">Напишите нам, и менеджер увидит сообщение в CRM.</p>
      </div>
    `;

    this.body.className = "zani-body";
    this.panel.appendChild(this.body);
    this.addMessage("system", "Здравствуйте! Чем можем помочь?");

    const form = document.createElement("form");
    form.className = "zani-form";
    this.nameInput.className = "zani-input";
    this.nameInput.placeholder = "Ваше имя";
    this.phoneInput.className = "zani-input";
    this.phoneInput.placeholder = "Телефон";
    this.input.className = "zani-input";
    this.input.placeholder = "Сообщение...";
    this.sendButton.className = "zani-send";
    this.sendButton.type = "submit";
    this.sendButton.textContent = "Send";

    const actions = document.createElement("div");
    actions.className = "zani-actions";
    actions.append(this.input, this.sendButton);
    form.append(this.nameInput, this.phoneInput, actions);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.send();
    });
    this.panel.appendChild(form);

    bubble.addEventListener("click", () => {
      this.panel.hidden = !this.panel.hidden;
      if (!this.panel.hidden) this.input.focus();
    });

    this.root.append(this.panel, bubble);
    document.body.appendChild(this.root);
  }

  private async send() {
    const text = this.input.value.trim();
    if (!text || this.sendButton.disabled) return;
    this.sendButton.disabled = true;
    this.addMessage("user", text);
    this.input.value = "";

    try {
      const response = this.conversationId ? await this.appendMessage(text) : await this.createConversation(text);
      this.conversationId = response.conversation_id;
      this.addMessage("status", "Сообщение отправлено. Мы скоро ответим.");
    } catch (error) {
      this.addMessage("status", "Не удалось отправить сообщение. Попробуйте позже.");
    } finally {
      this.sendButton.disabled = false;
    }
  }

  private async createConversation(message: string) {
    return this.request<ConversationResponse>(`/api/public/website-chat/${this.options.publicToken}/conversations/`, {
      full_name: this.nameInput.value.trim(),
      phone: this.phoneInput.value.trim(),
      message,
      external_user_id: getVisitorId(),
    });
  }

  private async appendMessage(message: string) {
    return this.request<ConversationResponse>(
      `/api/public/website-chat/${this.options.publicToken}/conversations/${this.conversationId}/messages/`,
      { message, external_user_id: getVisitorId() },
    );
  }

  private async request<T>(path: string, payload: Record<string, unknown>) {
    const response = await fetch(`${this.apiUrl()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Zani widget request failed: ${response.status}`);
    return response.json() as Promise<T>;
  }

  private apiUrl() {
    return (this.options.apiUrl || "").replace(/\/$/, "");
  }

  private addMessage(type: "system" | "user" | "status", text: string) {
    const node = document.createElement("div");
    node.className = `zani-message ${type}`;
    node.textContent = text;
    this.body.appendChild(node);
    this.body.scrollTop = this.body.scrollHeight;
  }
}

function injectStyles() {
  if (document.getElementById("zani-widget-styles")) return;
  const style = document.createElement("style");
  style.id = "zani-widget-styles";
  style.textContent = styles;
  document.head.appendChild(style);
}

function getVisitorId() {
  const key = "zani_widget_visitor_id";
  const current = localStorage.getItem(key);
  if (current) return current;
  const value = crypto.randomUUID ? crypto.randomUUID() : `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(key, value);
  return value;
}

function init(options: ZaniWidgetOptions) {
  if (!options.publicToken) {
    console.warn("ZaniWidget: publicToken is required.");
    return;
  }
  new ZaniWidgetController(options);
}

window.ZaniWidget = { init };

const currentScript = document.currentScript as HTMLScriptElement | null;
const token = currentScript?.dataset.zaniToken;
if (token) {
  init({
    publicToken: token,
    apiUrl: currentScript?.dataset.zaniApi || "",
    position: currentScript?.dataset.zaniPosition === "left" ? "left" : "right",
  });
}
