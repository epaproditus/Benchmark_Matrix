'use client';

import {
    ThreadContent,
    ThreadContentMessages
} from "./thread-content";
import {
    MessageInput,
    MessageInputTextarea,
    MessageInputToolbar,
    MessageInputSubmitButton,
    MessageInputError
} from "./message-input";
import {
    MessageSuggestions,
    MessageSuggestionsList,
    MessageSuggestionsStatus
} from "./message-suggestions";
import { ScrollableMessageContainer } from "./scrollable-message-container";
import { useState } from "react";
import { MessageCircle, X, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function TamboChatPopup() {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-primary rounded-full shadow-2xl flex items-center justify-center text-primary-foreground hover:scale-110 z-50 group transition-all"
            >
                <MessageCircle className="w-7 h-7" />
                <span className="absolute right-16 bg-container text-foreground px-3 py-1.5 rounded-lg text-sm font-medium shadow-md opacity-0 group-hover:opacity-100 transition-opacity border border-border pointer-events-none whitespace-nowrap">
                    How can I help you?
                </span>
            </button>
        );
    }

    return (
        <div
            className={cn(
                "fixed bottom-6 right-6 w-96 max-w-[calc(100vw-3rem)] bg-background rounded-2xl shadow-2xl border border-border flex flex-col z-50 transition-all overflow-hidden",
                isMinimized ? "h-16" : "h-[600px] max-h-[calc(100vh-6rem)]"
            )}
        >
            {/* Header */}
            <div className="bg-secondary p-4 flex justify-between items-center text-secondary-foreground shrink-0 border-b border-border">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="font-semibold text-foreground">Student Assistant</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="p-1.5 hover:bg-foreground/10 rounded-lg transition-colors"
                    >
                        <Minus className="w-4 h-4 text-foreground" />
                    </button>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1.5 hover:bg-foreground/10 rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4 text-foreground" />
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <>
                    {/* Thread Content */}
                    <ScrollableMessageContainer className="flex-1 p-4">
                        <ThreadContent>
                            <ThreadContentMessages />
                        </ThreadContent>
                    </ScrollableMessageContainer>

                    {/* Suggestions Status */}
                    <MessageSuggestions>
                        <MessageSuggestionsStatus />
                    </MessageSuggestions>

                    {/* Message Input */}
                    <div className="p-4 bg-backdrop border-t border-border">
                        <MessageInput>
                            <MessageInputTextarea
                                placeholder="Ask me to update a score..."
                                className="min-h-[80px] bg-container text-foreground"
                            />
                            <MessageInputToolbar>
                                <MessageInputSubmitButton className="bg-primary text-primary-foreground hover:bg-primary/90" />
                            </MessageInputToolbar>
                            <MessageInputError />
                        </MessageInput>
                    </div>

                    {/* Initial Suggestions */}
                    <div className="px-4 pb-4 bg-backdrop">
                        <MessageSuggestions
                            initialSuggestions={[
                                {
                                    id: "suggest-group",
                                    title: "Group by Teacher",
                                    detailedSuggestion: "Group the missing students list by teacher",
                                    messageId: "initial-suggest-1"
                                },
                                {
                                    id: "suggest-sort",
                                    title: "Sort by Grade",
                                    detailedSuggestion: "Sort the student list by grade level",
                                    messageId: "initial-suggest-2"
                                },
                                {
                                    id: "suggest-view",
                                    title: "Show RLA View",
                                    detailedSuggestion: "Switch the dashboard to Reading Language Arts",
                                    messageId: "initial-suggest-3"
                                }
                            ]}
                        >
                            <MessageSuggestionsList />
                        </MessageSuggestions>
                    </div>
                </>
            )}
        </div>
    );
}
