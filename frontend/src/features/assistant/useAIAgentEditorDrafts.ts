import { useCallback, useEffect, useState } from "react";
import { useBlocker } from "react-router";

import type { AgentProfile, Bot as BotType } from "../../types";
import type { AgentFormState, BotDraftState } from "./aiAgentsTypes";
import { createDefaultProfile, formFromProfile } from "./aiAgentsUtils";

function botDraftFromBot(bot: BotType | null | undefined): BotDraftState {
  return {
    name: bot?.name || "",
    default_language: bot?.default_language || "ru",
  };
}

function sameDraft<T>(left: T, right: T) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function useAIAgentEditorDrafts({
  selectedBot,
  selectedProfile,
  t,
}: {
  selectedBot: BotType | null;
  selectedProfile: AgentProfile | null;
  t: (key: string) => string;
}) {
  const [profileForm, setProfileForm] = useState<AgentFormState>(() => createDefaultProfile(selectedBot, t));
  const [savedProfileForm, setSavedProfileForm] = useState<AgentFormState>(() => createDefaultProfile(selectedBot, t));
  const [botDraft, setBotDraft] = useState<BotDraftState>(() => botDraftFromBot(selectedBot));
  const [savedBotDraft, setSavedBotDraft] = useState<BotDraftState>(() => botDraftFromBot(selectedBot));
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");

  useEffect(() => {
    const nextProfile = selectedProfile
      ? formFromProfile(selectedProfile)
      : createDefaultProfile(selectedBot, t);
    setProfileForm(nextProfile);
    setSavedProfileForm(nextProfile);
    setSaveState("idle");
  }, [selectedBot?.id, selectedProfile?.id]);

  useEffect(() => {
    const nextBot = botDraftFromBot(selectedBot);
    setBotDraft(nextBot);
    setSavedBotDraft(nextBot);
    setSaveState("idle");
  }, [selectedBot?.id]);

  const editorDirty = Boolean(
    selectedBot
    && (!sameDraft(profileForm, savedProfileForm) || !sameDraft(botDraft, savedBotDraft)),
  );

  useEffect(() => {
    if (editorDirty) setSaveState("idle");
  }, [editorDirty]);

  const navigationBlocker = useBlocker(useCallback(
    ({ nextLocation }: { nextLocation: { pathname: string } }) => {
      if (!editorDirty || !selectedBot) return false;
      const currentAgentRoute = `/app/ai-agents/${selectedBot.id}`;
      return !(
        nextLocation.pathname === currentAgentRoute
        || nextLocation.pathname.startsWith(`${currentAgentRoute}/`)
      );
    },
    [editorDirty, selectedBot],
  ));

  useEffect(() => {
    if (!editorDirty) return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [editorDirty]);

  const resetEditorDrafts = useCallback(() => {
    setProfileForm(savedProfileForm);
    setBotDraft(savedBotDraft);
    setSaveState("idle");
  }, [savedBotDraft, savedProfileForm]);

  const markBotSaved = useCallback((bot: BotType) => {
    const nextDraft = botDraftFromBot(bot);
    setBotDraft(nextDraft);
    setSavedBotDraft(nextDraft);
  }, []);

  const markProfileSaved = useCallback((profile: AgentProfile) => {
    const nextProfile = formFromProfile(profile);
    setProfileForm(nextProfile);
    setSavedProfileForm(nextProfile);
  }, []);

  return {
    botDraft,
    editorDirty,
    markBotSaved,
    markProfileSaved,
    navigationBlocker,
    profileForm,
    resetEditorDrafts,
    saveState,
    setBotDraft,
    setProfileForm,
    setSaveState,
  };
}
