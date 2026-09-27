"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  ArrowUpIcon,
  FileTextIcon,
  MicIcon,
  MicOffIcon,
  PaperclipIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { APP_CONFIG } from "@/lib/config";
import { uid } from "@/lib/helpers";
import type { ChatAttachment } from "@/lib/types";
import { cn } from "@/lib/utils";

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type RecognitionErrorEvent = { error: string };

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;
type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const TEXT_TYPES = new Set([
  "application/json",
  "application/xml",
  "application/yaml",
  "application/x-yaml",
]);
const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".xml",
  ".yaml",
  ".yml",
  ".log",
  ".py",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".css",
  ".html",
  ".sql",
  ".toml",
  ".ini",
]);
const MAX_ATTACHMENTS = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_BYTES = 1024 * 1024;
const MAX_TEXT_CHARACTERS = 200_000;

function readImageData(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read this image."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not read this image."));
        return;
      }
      const separator = reader.result.indexOf(",");
      if (separator < 0) {
        reject(new Error("Could not read this image."));
        return;
      }
      resolve(reader.result.slice(separator + 1));
    };
    reader.readAsDataURL(file);
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Composer({
  onSend,
  onStop,
  streaming,
  disabled,
  placeholder = `Message ${APP_CONFIG.appName}…`,
  autoFocus,
}: {
  onSend: (text: string, attachments?: ChatAttachment[]) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [listening, setListening] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    if (autoFocus && window.matchMedia("(min-width: 768px)").matches) ref.current?.focus();
  }, [autoFocus]);

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
    },
    [],
  );

  const toggleVoiceInput = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const browserWindow = window as SpeechRecognitionWindow;
    const Recognition = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      toast.error("Voice input isn't supported in this browser. Try a recent Chrome or Edge.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        if (result.isFinal) transcript += result[0].transcript;
      }
      const spokenText = transcript.trim();
      if (spokenText) {
        setValue((current) => `${current}${current && !/\s$/.test(current) ? " " : ""}${spokenText}`);
      }
    };
    recognition.onerror = (event) => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setListening(false);
      if (event.error === "aborted") return;
      const message =
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Microphone access was denied. Check your browser permissions."
          : event.error === "audio-capture"
            ? "No microphone was found."
            : event.error === "network"
              ? "Speech recognition needs an internet connection."
              : "Voice input failed. Please try again.";
      toast.error(message);
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setListening(false);
    };
    recognitionRef.current = recognition;

    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setListening(false);
      toast.error("Couldn't start voice input. Please try again.");
    }
  };

  const addFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList);
    const next: ChatAttachment[] = [];
    let totalImageBytes = attachments.reduce(
      (total, attachment) => total + (attachment.data ? attachment.size : 0),
      0,
    );

    for (const file of files) {
      if (attachments.length + next.length >= MAX_ATTACHMENTS) {
        toast.error(`You can attach up to ${MAX_ATTACHMENTS} files per message.`);
        break;
      }

      const mediaType = file.type.toLowerCase();
      const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (IMAGE_TYPES.has(mediaType)) {
        if (!file.size || file.size > MAX_IMAGE_BYTES) {
          toast.error(`${file.name} must be smaller than 5 MB.`);
          continue;
        }
        if (totalImageBytes + file.size > MAX_TOTAL_IMAGE_BYTES) {
          toast.error("Images must total 10 MB or less per message.");
          continue;
        }
        try {
          next.push({
            id: uid(),
            name: file.name,
            mimeType: mediaType,
            size: file.size,
            data: await readImageData(file),
          });
          totalImageBytes += file.size;
        } catch {
          toast.error(`Could not read ${file.name}.`);
        }
        continue;
      }

      if (mediaType.startsWith("text/") || TEXT_TYPES.has(mediaType) || TEXT_EXTENSIONS.has(extension)) {
        if (file.size > MAX_TEXT_BYTES) {
          toast.error(`${file.name} must be 1 MB or smaller.`);
          continue;
        }
        try {
          const text = await file.text();
          if (text.length > MAX_TEXT_CHARACTERS) {
            toast.error(`${file.name} contains too much text.`);
            continue;
          }
          next.push({
            id: uid(),
            name: file.name,
            mimeType: mediaType.startsWith("text/") || TEXT_TYPES.has(mediaType) ? mediaType : "text/plain",
            size: file.size,
            text,
          });
        } catch {
          toast.error(`Could not read ${file.name}.`);
        }
        continue;
      }

      toast.error(`${file.name} isn't a supported image or text file.`);
    }

    if (next.length) setAttachments((current) => [...current, ...next]);
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (streaming) return onStop();
    if ((!value.trim() && !attachments.length) || disabled) return;
    onSend(value, attachments);
    setValue("");
    setAttachments([]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const touch = window.matchMedia("(hover: none)").matches;
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !touch) {
      e.preventDefault();
      submit();
    }
  };

  const canSend = streaming || ((!!value.trim() || attachments.length > 0) && !disabled);

  return (
    <form
      onSubmit={submit}
      className="mx-auto w-full max-w-3xl rounded-3xl border bg-card p-2.5 pl-4 shadow-sm transition-colors focus-within:border-ring"
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/gif,image/webp,text/*,application/json,application/xml,application/yaml,application/x-yaml,.md,.markdown,.csv,.yaml,.yml,.log,.py,.js,.jsx,.ts,.tsx,.css,.html,.sql,.toml,.ini"
        className="hidden"
        tabIndex={-1}
        onChange={(event) => {
          void addFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex max-w-56 items-center gap-2 rounded-lg border bg-background p-1"
              title={`${attachment.name} (${formatFileSize(attachment.size)})`}
            >
              {attachment.data ? (
                <img
                  src={`data:${attachment.mimeType};base64,${attachment.data}`}
                  alt=""
                  className="size-9 rounded-md object-cover"
                />
              ) : (
                <FileTextIcon className="ml-2 size-5 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate text-xs">{attachment.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove ${attachment.name}`}
                onClick={() =>
                  setAttachments((current) => current.filter((item) => item.id !== attachment.id))
                }
              >
                <XIcon />
              </Button>
            </div>
          ))}
        </div>
      )}
      <label htmlFor="composer" className="sr-only">
        Message
      </label>
      <textarea
        id="composer"
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        enterKeyHint="send"
        className="field-sizing-content max-h-52 min-h-7 w-full resize-none bg-transparent py-1.5 text-[15px] leading-6 outline-none placeholder:text-muted-foreground"
      />
      <div className="mt-1 flex items-center justify-end">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Add files, photos, or media"
              onClick={() => fileInputRef.current?.click()}
            >
              <PaperclipIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add files, photos, or media</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={listening ? "Stop voice input" : "Start voice input"}
              aria-pressed={listening}
              onClick={toggleVoiceInput}
            >
              {listening ? <MicOffIcon /> : <MicIcon />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {listening ? "Stop voice input" : "Dictate a message with your microphone"}
          </TooltipContent>
        </Tooltip>
        <Button
          type="submit"
          size="icon"
          disabled={!canSend}
          aria-label={streaming ? "Stop generating" : "Send message"}
          className={cn("rounded-full", !canSend && "opacity-30")}
        >
          {streaming ? <SquareIcon className="size-3.5 fill-current" /> : <ArrowUpIcon />}
        </Button>
      </div>
    </form>
  );
}
