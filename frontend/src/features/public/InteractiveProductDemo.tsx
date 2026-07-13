import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  CalendarCheck,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  MessageCircle,
  Pause,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useI18n } from "../../lib/i18n";
import { trackFrontendEvent } from "../../lib/monitoring";
import { demoScenarios, type DemoScenario } from "./interactiveDemoScenarios";
import "./interactiveProductDemo.css";

type DemoMode = "guided" | "manual";
type DemoPhase = 0 | 1 | 2 | 3 | 4;
type DemoView = "chat" | "crm" | "result";

type ChatMessage = {
  id: string;
  sender: "client" | "bot";
  text: string;
};

export function InteractiveProductDemo() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<DemoMode>("guided");
  const [scenarioId, setScenarioId] = useState<DemoScenario>("beauty");
  const [phase, setPhase] = useState<DemoPhase>(0);
  const [mobileView, setMobileView] = useState<DemoView>("chat");
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [assigned, setAssigned] = useState(false);
  const [taskCreated, setTaskCreated] = useState(false);
  const [guidedPaused, setGuidedPaused] = useState(false);
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [selectedTimeKey, setSelectedTimeKey] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const scenario = demoScenarios.find((item) => item.id === scenarioId) ?? demoScenarios[0];
  const selectedTime = selectedTimeKey ? t(selectedTimeKey) : "";
  const clientReady = phase >= 1;
  const appointmentReady = phase >= 2;
  const crmReady = phase >= 1;

  const messages = useMemo<ChatMessage[]>(() => {
    const result: ChatMessage[] = [
      { id: "welcome", sender: "bot", text: t(scenario.welcomeKey) },
    ];
    result.push(...conversation);
    if (phase >= 2 && selectedTime) {
      result.push(
        { id: "time", sender: "client", text: selectedTime },
        { id: "confirmed", sender: "bot", text: t(scenario.confirmedKey) },
      );
    }
    return result;
  }, [conversation, phase, scenario, selectedTime, t]);

  const resetDemo = useCallback((nextMode: DemoMode) => {
    requestIdRef.current += 1;
    setMode(nextMode);
    setPhase(0);
    setMobileView("chat");
    setInput("");
    setIsTyping(false);
    setAssigned(false);
    setTaskCreated(false);
    setGuidedPaused(false);
    setConversation([]);
    setSelectedTimeKey(null);
  }, []);

  const advanceGuided = useCallback(() => {
    if (phase === 0) {
      setConversation([{ id: "guided-client", sender: "client", text: t(scenario.clientMessageKey) }]);
      setIsTyping(true);
      setMobileView("chat");
      window.setTimeout(() => {
        setConversation((current) => [...current, { id: "guided-slots", sender: "bot", text: t(scenario.slotsKey) }]);
        setIsTyping(false);
        setPhase(1);
      }, reduceMotion ? 100 : 1050);
    } else if (phase === 1) {
      setSelectedTimeKey(scenario.timeKeys[0]);
      setPhase(2);
      setMobileView("crm");
    } else if (phase === 2) {
      setAssigned(true);
      setPhase(3);
      setMobileView("crm");
    } else if (phase === 3) {
      setTaskCreated(true);
      setPhase(4);
      setMobileView("result");
      trackFrontendEvent("landing_demo_completed", { mode, scenario: scenario.id });
    }
  }, [mode, phase, reduceMotion, scenario, t]);

  useEffect(() => {
    if (mode !== "guided" || guidedPaused || phase >= 4) return undefined;
    const timer = window.setTimeout(advanceGuided, reduceMotion ? 300 : 3900);
    return () => window.clearTimeout(timer);
  }, [advanceGuided, guidedPaused, mode, phase, reduceMotion]);

  useEffect(() => {
    const openManualDemo = (event: Event) => {
      const requestedScenario = (event as CustomEvent<{ scenario?: DemoScenario }>).detail?.scenario;
      const nextScenario = demoScenarios.some((item) => item.id === requestedScenario) ? requestedScenario : undefined;
      if (nextScenario) setScenarioId(nextScenario);
      resetDemo("manual");
      trackFrontendEvent("landing_demo_opened_from_hero", { scenario: nextScenario ?? scenario.id });
    };
    window.addEventListener("zani:demo-manual", openManualDemo);
    return () => window.removeEventListener("zani:demo-manual", openManualDemo);
  }, [resetDemo, scenario.id]);

  function switchMode(nextMode: DemoMode) {
    resetDemo(nextMode);
    trackFrontendEvent("landing_demo_mode_changed", { mode: nextMode, scenario: scenario.id });
  }

  function selectScenario(nextScenario: DemoScenario) {
    setScenarioId(nextScenario);
    resetDemo(mode);
    trackFrontendEvent("landing_demo_scenario_changed", { mode, scenario: nextScenario });
  }

  function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const message = input.trim();
    if (!message || phase > 0 || isTyping) return;

    setInput("");
    const messageId = `client-${Date.now()}`;
    setConversation((current) => [...current, { id: messageId, sender: "client", text: message }]);
    setIsTyping(true);
    trackFrontendEvent("landing_demo_message_sent", { scenario: scenario.id });
    const requestId = ++requestIdRef.current;
    const normalized = message.toLocaleLowerCase();
    const isGreeting = /^(привет|здрав|добрый|hello|hi|сәлем)/i.test(normalized);
    const isPriceQuestion = /(цен|стоим|сколько|price|cost|баға)/i.test(normalized);
    const hasBookingIntent = /(запис|хочу|нуж|маник|стомат|кондиц|book|appointment|install|орнат)/i.test(normalized);
    const reply = isGreeting
      ? t("landing.demo.chat.greetingReply")
      : isPriceQuestion
        ? t("landing.demo.chat.priceReply")
        : hasBookingIntent
          ? t(scenario.slotsKey)
          : t("landing.demo.chat.unknownReply");

    window.setTimeout(() => {
      if (requestId !== requestIdRef.current) return;
      setConversation((current) => [...current, { id: `bot-${Date.now()}`, sender: "bot", text: reply }]);
      if (hasBookingIntent) setPhase(1);
      setIsTyping(false);
    }, reduceMotion ? 80 : 620);
  }

  function selectTime(timeKey: string) {
    setIsTyping(true);
    window.setTimeout(() => {
      setSelectedTimeKey(timeKey);
      setPhase(2);
      setIsTyping(false);
      setMobileView("crm");
      trackFrontendEvent("landing_demo_time_selected", { scenario: scenario.id, time: timeKey });
    }, reduceMotion ? 80 : 420);
  }

  function assignManager() {
    setAssigned(true);
    setPhase(3);
    trackFrontendEvent("landing_demo_manager_assigned", { scenario: scenario.id });
  }

  function createTask() {
    setTaskCreated(true);
    setPhase(4);
    setMobileView("result");
    trackFrontendEvent("landing_demo_completed", { mode, scenario: scenario.id });
  }

  function startSignup() {
    try {
      window.sessionStorage.setItem("zani_signup_intent", "interactive_demo");
    } catch {
      // Signup remains available when storage is blocked.
    }
    trackFrontendEvent("landing_demo_signup_clicked", { scenario: scenario.id });
    navigate("/signup");
  }

  const nextHint = phase === 0
    ? t("landing.demo.hint.message")
    : phase === 1
      ? t("landing.demo.hint.time")
      : phase === 2
        ? t("landing.demo.hint.assign")
        : phase === 3
          ? t("landing.demo.hint.task")
          : t("landing.demo.hint.complete");

  return (
    <section className="zani-live-demo" id="agent">
      <div className="zani-shell">
        <header className="zani-live-demo-heading">
          <div>
            <p className="zani-eyebrow">{t("landing.demo.kicker")}</p>
            <h2>{t("landing.demo.title")}</h2>
            <p>{t("landing.demo.text")}</p>
          </div>
          <div className="zani-demo-mode" role="group" aria-label={t("landing.demo.mode.aria")}>
            <button type="button" className={mode === "guided" ? "is-active" : undefined} aria-pressed={mode === "guided"} onClick={() => switchMode("guided")}>
              <Sparkles size={16} />{t("landing.demo.mode.guided")}
            </button>
            <button type="button" className={mode === "manual" ? "is-active" : undefined} aria-pressed={mode === "manual"} onClick={() => switchMode("manual")}>
              <MessageCircle size={16} />{t("landing.demo.mode.manual")}
            </button>
          </div>
        </header>

        <div className="zani-demo-controls">
          <div className="zani-demo-scenario" aria-label={t("landing.demo.scenario.aria")}>
            <span>{t("landing.demo.scenario.label")}</span>
            <div>
              {demoScenarios.map((item) => (
                <button type="button" className={scenario.id === item.id ? "is-active" : undefined} aria-pressed={scenario.id === item.id} key={item.id} onClick={() => selectScenario(item.id)}>{t(item.labelKey)}</button>
              ))}
            </div>
            <small><ShieldCheck size={14} />{t("landing.demo.privacy")}</small>
          </div>

          <div className="zani-demo-guide">
            <span><i>{phase + 1}</i>{nextHint}</span>
            {mode === "guided" ? (
              <div>
                <small>{Math.min(phase + 1, 5)} / 5</small>
                <button type="button" aria-label={guidedPaused ? t("landing.demo.guide.play") : t("landing.demo.guide.pause")} onClick={() => setGuidedPaused((value) => !value)}>{guidedPaused ? <Play size={15} /> : <Pause size={15} />}</button>
                <button type="button" aria-label={t("landing.demo.guide.next")} disabled={phase >= 4} onClick={advanceGuided}><ChevronRight size={16} /></button>
                <button type="button" aria-label={t("landing.demo.repeat")} onClick={() => resetDemo("guided")}><RotateCcw size={15} /></button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="zani-demo-mobile-tabs" role="tablist" aria-label={t("landing.demo.mobileTabs.aria")}>
          {(["chat", "crm", "result"] as const).map((view) => (
            <button type="button" role="tab" aria-selected={mobileView === view} className={mobileView === view ? "is-active" : undefined} key={view} onClick={() => setMobileView(view)}>{t(`landing.demo.mobileTabs.${view}`)}</button>
          ))}
        </div>

        <div className="zani-demo-workspace">
          <article className={`zani-demo-chat${mobileView === "chat" ? " is-mobile-active" : ""}`} aria-label={t("landing.demo.chat.aria")}>
            <div className="zani-demo-panel-head">
              <span className="zani-demo-avatar"><Bot size={20} /></span>
              <div><b>ZANI Bot</b><small><i />{t("landing.experience.phone.online")}</small></div>
              <span className="zani-demo-channel">WhatsApp</span>
            </div>

            <div className="zani-demo-messages" aria-live="polite">
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <motion.p className={`zani-demo-message is-${message.sender}`} key={message.id} initial={reduceMotion ? false : { opacity: 0, y: 9, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
                    {message.text}
                  </motion.p>
                ))}
              </AnimatePresence>
              {isTyping ? <span className="zani-demo-typing" aria-label={t("landing.demo.chat.typing")}><i /><i /><i /></span> : null}
            </div>

            {mode === "manual" && phase === 0 ? (
              <div className="zani-demo-quick-replies">
                <button type="button" onClick={() => setInput(t(scenario.clientMessageKey))}>{t("landing.demo.chat.quickAppointment")}</button>
                <button type="button" onClick={() => setInput(t("landing.demo.chat.quickPrice"))}>{t("landing.demo.chat.quickPrice")}</button>
              </div>
            ) : null}

            {mode === "manual" && phase === 1 ? (
              <div className="zani-demo-slots">
                {scenario.timeKeys.map((timeKey) => <button type="button" key={timeKey} onClick={() => selectTime(timeKey)}>{t(timeKey)}</button>)}
              </div>
            ) : null}

            <form className="zani-demo-input" onSubmit={sendMessage}>
              <input aria-label={t("landing.experience.phone.chat.input")} value={input} maxLength={240} disabled={mode === "guided" || phase > 0 || isTyping} placeholder={mode === "guided" ? t("landing.demo.chat.guidedHint") : t("landing.experience.phone.chat.input")} onChange={(event) => setInput(event.target.value)} />
              <button type="submit" aria-label={t("conversations.send")} disabled={mode === "guided" || phase > 0 || !input.trim() || isTyping}><Send size={18} /></button>
            </form>
          </article>

          <div className="zani-demo-transfer" aria-hidden="true">
            <motion.span animate={appointmentReady && !reduceMotion ? { x: [0, 9, 0] } : undefined}><ArrowRight size={20} /></motion.span>
            <small>{t("landing.demo.transfer")}</small>
          </div>

          <article className={`zani-demo-crm${mobileView === "crm" ? " is-mobile-active" : ""}`} aria-label={t("landing.demo.crm.aria")}>
            <div className="zani-demo-panel-head">
              <span className="zani-demo-avatar is-dark">Z</span>
              <div><b>CRM</b><small>{t("landing.demo.crm.live")}</small></div>
              <span className={`zani-demo-status${crmReady ? " is-ready" : ""}`}><i />{crmReady ? t("landing.demo.crm.ready") : t("landing.demo.crm.waiting")}</span>
            </div>

            <div className="zani-demo-client-card">
              <div className="zani-demo-client-main">
                <span className={`zani-demo-client-avatar${clientReady ? " is-ready" : ""}`}>{clientReady ? scenario.initials : <Users size={20} />}</span>
                <div><small>{t("landing.demo.crm.client")}</small><b>{clientReady ? t(scenario.clientNameKey) : t("landing.demo.crm.newClient")}</b></div>
                {clientReady ? <span className="zani-demo-source">WhatsApp</span> : null}
              </div>
              <dl>
                <div className={clientReady ? "is-filled" : undefined}><dt>{t("landing.demo.crm.request")}</dt><dd>{clientReady ? t(scenario.requestKey) : "—"}</dd></div>
                <div className={appointmentReady ? "is-filled" : undefined}><dt>{t("landing.demo.crm.appointment")}</dt><dd>{appointmentReady ? selectedTime : "—"}</dd></div>
                <div className={assigned ? "is-filled" : undefined}><dt>{t("landing.demo.crm.responsible")}</dt><dd>{assigned ? t(scenario.managerKey) : t("landing.demo.crm.notAssigned")}</dd></div>
              </dl>
            </div>

            <div className="zani-demo-pipeline" aria-label={t("landing.demo.crm.stage")}>
              {[t("landing.demo.crm.stageNew"), t("landing.demo.crm.stageWork"), t("landing.demo.crm.stageBooked")].map((label, index) => (
                <span className={phase >= index + 1 ? "is-done" : undefined} key={label}><i>{phase > index + 1 ? <Check size={13} /> : index + 1}</i>{label}</span>
              ))}
            </div>

            <div className="zani-demo-actions">
              <button type="button" disabled={!appointmentReady || assigned} onClick={assignManager}><UserCheck size={17} />{assigned ? t("landing.demo.crm.assigned") : t("landing.demo.crm.assign")}</button>
              <button type="button" disabled={!assigned || taskCreated} onClick={createTask}><CalendarCheck size={17} />{taskCreated ? t("landing.demo.crm.taskReady") : t("landing.demo.crm.createTask")}</button>
            </div>
          </article>
        </div>

        <div className={`zani-demo-result${taskCreated ? " is-complete" : ""}${mobileView === "result" ? " is-mobile-active" : ""}`} aria-live="polite">
          <div><span><Users size={18} /></span><small>{t("landing.demo.result.client")}</small><b>{clientReady ? "1" : "0"}</b></div>
          <div><span><CalendarCheck size={18} /></span><small>{t("landing.demo.result.appointment")}</small><b>{appointmentReady ? selectedTime : "—"}</b></div>
          <div><span><CircleDollarSign size={18} /></span><small>{t("landing.demo.result.value")}</small><b>{appointmentReady ? scenario.value : "—"}</b></div>
          <div className="zani-demo-result-message">
            {taskCreated ? <Check size={18} /> : <Clock3 size={18} />}
            <p><b>{taskCreated ? t("landing.demo.result.ownerTitle") : t("landing.demo.result.progressTitle")}</b>{taskCreated ? t("landing.demo.result.complete") : t("landing.demo.result.progress")}</p>
            {taskCreated ? (
              <span className="zani-demo-complete-actions">
                <button type="button" onClick={() => resetDemo("manual")}><RotateCcw size={15} />{t("landing.demo.repeat")}</button>
                <button type="button" className="is-primary" onClick={startSignup}>{t("landing.demo.cta")}<ArrowRight size={15} /></button>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
