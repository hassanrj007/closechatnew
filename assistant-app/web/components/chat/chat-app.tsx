"use client";

import { useCallback, useEffect, useState } from "react";
import { PanelLeftIcon, SquarePenIcon } from "lucide-react";
import { toast } from "sonner";

import { AppSidebar } from "@/components/chat/app-sidebar";
import { AmbientBackground } from "@/components/chat/ambient-background";
import { Composer } from "@/components/chat/composer";
import { EmptyState, SuggestionGrid } from "@/components/chat/empty-state";
import { MessageList } from "@/components/chat/message-list";
import { ModelPicker } from "@/components/chat/model-picker";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useChat } from "@/hooks/use-chat";
import { useModels } from "@/hooks/use-models";
import { cn } from "@/lib/utils";

export function ChatApp() {
  const models = useModels();
  const chat = useChat(models.selection);
  const [sidebarOpen, setSidebarOpen] = useState(true); // desktop
  const [mobileOpen, setMobileOpen] = useState(false); // mobile sheet
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const empty = !chat.active || chat.active.messages.length === 0;
  const noModels = !models.loading && !models.effective;

  const newChat = useCallback((projectId?: string) => {
    chat.newChat();
    setActiveProjectId(projectId ?? null);
    setMobileOpen(false);
  }, [chat]);

  const openChat = (id: string) => {
    chat.openChat(id);
    setActiveProjectId(chat.conversations.find((conversation) => conversation.id === id)?.projectId ?? null);
    setMobileOpen(false);
  };

  const selectProject = (projectId: string | null) => {
    setActiveProjectId(projectId);
    if (projectId && chat.active?.projectId !== projectId) chat.newChat();
  };

  const createProject = (name: string) => {
    return chat.createProject(name);
  };

  const deleteChat = (id: string) => {
    const undo = chat.deleteChat(id);
    toast("Chat deleted", { action: { label: "Undo", onClick: undo } });
  };

  const clearAll = () => {
    const undo = chat.clearAll();
    toast("All chats deleted", { action: { label: "Undo", onClick: undo } });
  };

  // Global shortcuts: new chat, search, stop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        newChat();
      } else if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSidebarOpen(true);
        setMobileOpen(true);
        requestAnimationFrame(() => document.getElementById("chat-search")?.focus());
      } else if (e.key === "Escape" && chat.streaming) {
        chat.stop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chat, newChat]);

  const sidebarProps = {
    conversations: chat.conversations,
    projects: chat.projects,
    activeProjectId,
    onSelectProject: selectProject,
    onCreateProject: createProject,
    onDeleteProject: chat.deleteProject,
    onMoveToProject: chat.moveToProject,
    activeId: chat.activeId,
    onNewChat: (projectId?: string) => newChat(projectId ?? activeProjectId ?? undefined),
    onOpen: openChat,
    onDelete: deleteChat,
    onClearAll: clearAll,
    apiOnline: !models.error,
  };

  const composer = (
    <Composer
      onSend={(text, attachments) => chat.send(text, attachments, activeProjectId ?? undefined)}
      onStop={chat.stop}
      streaming={chat.streaming}
      disabled={noModels}
      autoFocus
      placeholder={noModels ? "No AI model available — see the model menu" : undefined}
    />
  );

  return (
    <div className="chat-shell relative isolate flex h-dvh overflow-hidden">
      <AmbientBackground />
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "relative z-10 hidden shrink-0 border-r transition-[margin] duration-200 md:block md:w-72",
          !sidebarOpen && "md:-ml-72",
        )}
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
      >
        <AppSidebar {...sidebarProps} onCollapse={() => setSidebarOpen(false)} />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" showClose={false} className="w-72 p-0 md:hidden">
          <SheetTitle className="sr-only">Conversations</SheetTitle>
          <SheetDescription className="sr-only">Your chat history</SheetDescription>
          <AppSidebar {...sidebarProps} onCollapse={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-1 px-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open sidebar"
                className={cn(sidebarOpen && "md:hidden")}
                onClick={() => {
                  setSidebarOpen(true);
                  setMobileOpen(true);
                }}
              >
                <PanelLeftIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open sidebar</TooltipContent>
          </Tooltip>
          <ModelPicker models={models} />
          <div className="flex-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="New chat"
                className={cn(sidebarOpen && "md:hidden")}
                onClick={() => newChat(activeProjectId ?? undefined)}
              >
                <SquarePenIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New chat</TooltipContent>
          </Tooltip>
        </header>

        {empty ? (
          <div className="flex flex-1 flex-col justify-center overflow-y-auto px-3 pb-[8vh] sm:px-6">
            <EmptyState />
            {composer}
            <SuggestionGrid
              onPick={(prompt) => chat.send(prompt, [], activeProjectId ?? undefined)}
            />
          </div>
        ) : (
          <>
            <MessageList
              conversation={chat.active!}
              streaming={chat.streaming}
              onRegenerate={chat.regenerate}
              onFeedback={chat.setFeedback}
            />
            <div className="shrink-0 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-6">
              {composer}
            </div>
          </>
        )}
        <p className="shrink-0 pb-2 text-center text-xs text-muted-foreground">
          AI can make mistakes. Check important information.
        </p>
      </main>
    </div>
  );
}
