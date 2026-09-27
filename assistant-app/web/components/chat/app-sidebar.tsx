"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeftIcon,
  CheckIcon,
  EllipsisIcon,
  FilePlus2Icon,
  FolderIcon,
  MonitorIcon,
  MoonIcon,
  PanelLeftIcon,
  PlusIcon,
  SearchIcon,
  SquarePenIcon,
  SunIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { APP_CONFIG, initialsOf } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { Conversation, Project } from "@/lib/types";

const DAY = 86_400_000;

function groupByDate(list: Conversation[]) {
  const today = new Date().setHours(0, 0, 0, 0);
  const groups: [string, Conversation[]][] = [
    ["Today", []],
    ["Yesterday", []],
    ["Previous 7 days", []],
    ["Previous 30 days", []],
    ["Older", []],
  ];
  for (const c of list) {
    const t = c.updatedAt;
    const i = t >= today ? 0 : t >= today - DAY ? 1 : t >= today - 7 * DAY ? 2 : t >= today - 30 * DAY ? 3 : 4;
    groups[i][1].push(c);
  }
  return groups.filter(([, items]) => items.length);
}

export function AppSidebar({
  conversations,
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onMoveToProject,
  activeId,
  onNewChat,
  onOpen,
  onDelete,
  onClearAll,
  onCollapse,
  apiOnline,
}: {
  conversations: Conversation[];
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
  onCreateProject: (name: string) => Project | null;
  onDeleteProject: (projectId: string) => void;
  onMoveToProject: (conversationId: string, projectId?: string) => void;
  activeId: string | null;
  onNewChat: (projectId?: string) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onCollapse?: () => void;
  apiOnline: boolean;
}) {
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<"chats" | "projects">("chats");
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectName, setProjectName] = useState("");
  const { theme, setTheme } = useTheme();
  const activeProject = projects.find((project) => project.id === activeProjectId);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible =
      section === "chats"
        ? conversations
        : activeProjectId
          ? conversations.filter((conversation) => conversation.projectId === activeProjectId)
          : [];
    const list = [...visible]
      .filter(
        (c) =>
          !q ||
          c.title.toLowerCase().includes(q) ||
          c.messages.some((m) => m.content.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return groupByDate(list);
  }, [activeProjectId, conversations, query, section]);

  const createProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const project = onCreateProject(projectName);
    if (!project) return;
    setProjectName("");
    setCreatingProject(false);
    onSelectProject(project.id);
  };

  const renderConversations = () => (
    <nav
      aria-label={activeProject ? `${activeProject.name} conversations` : "Conversations"}
      className="min-h-0 flex-1 overflow-y-auto px-2 pb-3"
    >
      {groups.length === 0 && (
        <p className="px-3 py-4 text-sm text-muted-foreground">
          {query
            ? "No chats match your search."
            : activeProject
              ? "No chats in this project yet."
              : "Your conversations will appear here."}
        </p>
      )}
      {groups.map(([label, items]) => (
        <section key={label} className="mt-3">
          <h3 className="px-3 pb-1 text-xs font-medium text-muted-foreground">{label}</h3>
          <ul>
            {items.map((conversation) => {
              const active = conversation.id === activeId;
              return (
                <li key={conversation.id} className="group/item relative">
                  <button
                    type="button"
                    onClick={() => onOpen(conversation.id)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "w-full truncate rounded-md py-1.5 pr-9 pl-3 text-left text-sm transition-colors hover:bg-sidebar-accent",
                      active && "bg-sidebar-accent font-medium",
                    )}
                  >
                    {conversation.title}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Options for ${conversation.title}`}
                        className={cn(
                          "absolute top-1/2 right-1 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
                          active && "[@media(hover:none)]:opacity-100",
                        )}
                      >
                        <EllipsisIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => onDelete(conversation.id)}
                      >
                        <Trash2Icon />
                        Delete
                      </DropdownMenuItem>
                      {projects.length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <FolderIcon />
                              Move to project
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem
                                onSelect={() => onMoveToProject(conversation.id)}
                              >
                                {conversation.projectId ? <FolderIcon /> : <CheckIcon />}
                                All chats
                              </DropdownMenuItem>
                              {projects.map((project) => (
                                <DropdownMenuItem
                                  key={project.id}
                                  onSelect={() => onMoveToProject(conversation.id, project.id)}
                                >
                                  {conversation.projectId === project.id ? (
                                    <CheckIcon />
                                  ) : (
                                    <FolderIcon />
                                  )}
                                  {project.name}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2.5 pl-1 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-[10px] font-bold text-primary-foreground">
            RJ
          </span>
          {APP_CONFIG.appName}
        </div>
        {onCollapse && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close sidebar" onClick={onCollapse}>
                <PanelLeftIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Close sidebar</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1 px-3 pb-2" role="tablist" aria-label="Workspace">
        <button
          type="button"
          role="tab"
          aria-selected={section === "chats"}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors",
            section === "chats" ? "bg-sidebar-accent font-medium" : "text-muted-foreground hover:bg-sidebar-accent",
          )}
          onClick={() => {
            setSection("chats");
            onSelectProject(null);
          }}
        >
          Chats
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === "projects"}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors",
            section === "projects" ? "bg-sidebar-accent font-medium" : "text-muted-foreground hover:bg-sidebar-accent",
          )}
          onClick={() => {
            setSection("projects");
            onSelectProject(null);
          }}
        >
          Projects
        </button>
      </div>

      {section === "chats" && (
        <div className="flex flex-col gap-1.5 px-3 pb-2">
          <Button variant="outline" className="justify-start bg-background" onClick={() => onNewChat()}>
            <SquarePenIcon />
            New chat
            <kbd className="ml-auto hidden text-xs font-normal text-muted-foreground md:inline">
              Ctrl ⇧ O
            </kbd>
          </Button>
        </div>
      )}

      {(section === "chats" || activeProject) && (
        <div className="px-3 pb-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="chat-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats"
              aria-label="Search chats"
              className="border-transparent bg-transparent pl-8 shadow-none hover:bg-sidebar-accent focus-visible:bg-background dark:bg-transparent"
            />
          </div>
        </div>
      )}

      {section === "chats" ? (
        renderConversations()
      ) : activeProject ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="px-3 pb-2">
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 -ml-2"
              onClick={() => onSelectProject(null)}
            >
              <ArrowLeftIcon />
              All projects
            </Button>
            <h2 className="truncate px-1 text-sm font-semibold">{activeProject.name}</h2>
            <p className="px-1 text-xs text-muted-foreground">
              {conversations.filter((conversation) => conversation.projectId === activeProject.id).length} chats
            </p>
            <Button
              variant="outline"
              className="mt-3 w-full justify-start bg-background"
              onClick={() => onNewChat(activeProject.id)}
            >
              <PlusIcon />
              New chat in project
            </Button>
          </div>
          {renderConversations()}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3" role="tabpanel">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold">Projects</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreatingProject(true)}
              disabled={creatingProject}
            >
              <FilePlus2Icon />
              New project
            </Button>
          </div>
          {creatingProject && (
            <form onSubmit={createProject} className="mb-3 flex items-center gap-1.5">
              <Input
                autoFocus
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="Project name"
                aria-label="Project name"
                maxLength={60}
              />
              <Button type="submit" size="icon-sm" aria-label="Create project" disabled={!projectName.trim()}>
                <CheckIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Cancel project creation"
                onClick={() => {
                  setCreatingProject(false);
                  setProjectName("");
                }}
              >
                <XIcon />
              </Button>
            </form>
          )}
          {projects.length === 0 && !creatingProject ? (
            <p className="px-1 py-4 text-sm text-muted-foreground">Your project workspaces will appear here.</p>
          ) : (
            <ul className="space-y-1">
              {projects.map((project) => (
                <li key={project.id} className="group/project relative">
                  <button
                    type="button"
                    onClick={() => onSelectProject(project.id)}
                    className="flex w-full items-center gap-2.5 rounded-md py-2 pr-9 pl-2 text-left text-sm hover:bg-sidebar-accent"
                  >
                    <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{project.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {conversations.filter((conversation) => conversation.projectId === project.id).length} chats
                      </span>
                    </span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Options for ${project.name}`}
                        className="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 group-hover/project:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
                      >
                        <EllipsisIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => {
                          if (project.id === activeProjectId) onSelectProject(null);
                          onDeleteProject(project.id);
                        }}
                      >
                        <Trash2Icon />
                        Delete project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="border-t p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-md p-2 text-left text-sm hover:bg-sidebar-accent"
            >
              <span className="grid size-8 place-items-center rounded-full bg-foreground text-xs font-semibold text-background">
                {initialsOf(APP_CONFIG.user.name)}
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate font-medium">{APP_CONFIG.user.name}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      apiOnline ? "bg-success" : "bg-destructive",
                    )}
                  />
                  {apiOnline ? "Connected" : "API offline"}
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width)">
            <DropdownMenuLabel>Appearance</DropdownMenuLabel>
            {(
              [
                ["light", "Light", SunIcon],
                ["dark", "Dark", MoonIcon],
                ["system", "System", MonitorIcon],
              ] as const
            ).map(([value, label, Icon]) => (
              <DropdownMenuItem key={value} onSelect={() => setTheme(value)}>
                <Icon />
                {label}
                {theme === value && <CheckIcon className="ml-auto" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={!conversations.length}
              onSelect={onClearAll}
            >
              <Trash2Icon />
              Delete all chats
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
