import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus,
  Send,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { postTicketPanel } from "@/lib/send.functions";

import {
  Field,
  MultiPicker,
  PickerSelect,
  ToggleRow,
} from "./fields";

type Option = {
  id: string;
  name: string;
};

type Question = {
  id: string;
  label: string;
  placeholder: string;
  required: boolean;
  style: "short" | "paragraph";
};

type PanelButton = {
  label: string;
  emoji: string;
  style: "primary" | "secondary" | "success" | "danger";

  categoryId: string | null;
  category: string;

  supportRoleIds: string[];
  accessRoleIds: string[];

  requiredPermission:
    | "everyone"
    | "manage_channels"
    | "manage_guild"
    | "administrator";

  formQuestions: Question[];
};

const STYLES: Array<{
  value: PanelButton["style"];
  label: string;
}> = [
  {
    value: "primary",
    label: "Blurple",
  },
  {
    value: "secondary",
    label: "Grey",
  },
  {
    value: "success",
    label: "Green",
  },
  {
    value: "danger",
    label: "Red",
  },
];

const PERMISSIONS: Array<{
  value: PanelButton["requiredPermission"];
  label: string;
  description: string;
}> = [
  {
    value: "everyone",
    label: "Everyone",
    description: "Anyone can use this button.",
  },
  {
    value: "manage_channels",
    label: "Manage Channels",
    description: "Requires Manage Channels permission.",
  },
  {
    value: "manage_guild",
    label: "Manage Server",
    description: "Requires Manage Server permission.",
  },
  {
    value: "administrator",
    label: "Administrator",
    description: "Requires Administrator permission.",
  },
];

function makeQuestion(index: number): Question {
  return {
    id: `q${Date.now()}-${index}`,
    label: "",
    placeholder: "",
    required: true,
    style: "short",
  };
}

function makeButton(index: number): PanelButton {
  return {
    label: index === 0 ? "General support" : "",
    emoji: index === 1 ? "🚩" : "🎫",
    style: index === 1 ? "danger" : "primary",

    categoryId: null,
    category: "",

    supportRoleIds: [],
    accessRoleIds: [],

    requiredPermission: "everyone",

    formQuestions: [],
  };
}

export function TicketPanelPublisher({
  guildId,
  channels,
  categories,
  roles,
  defaultChannelId,
  transcriptsEnabled,
  transcriptChannelId,
  dmTranscriptEnabled,
}: {
  guildId: string;
  channels: Option[];
  categories: Option[];
  roles: Option[];
  defaultChannelId: string | null;
  transcriptsEnabled: boolean;
  transcriptChannelId: string | null;
  dmTranscriptEnabled: boolean;
}) {
  const post = useServerFn(postTicketPanel);

  const [channelId, setChannelId] =
    useState<string | null>(
      defaultChannelId,
    );


  const [title, setTitle] =
    useState("Need a hand?");

  const [description, setDescription] =
    useState(
      "Pick the option that matches your request. A private channel will be created for you and the crew only.",
    );

  const [buttons, setButtons] =
    useState<PanelButton[]>([
      makeButton(0),
      makeButton(1),
    ]);

  const [expanded, setExpanded] =
    useState<number | null>(0);

  const [sending, setSending] =
    useState(false);

  const updateButton = (
    index: number,
    patch: Partial<PanelButton>,
  ) => {
    setButtons((rows) =>
      rows.map((row, i) =>
        i === index
          ? {
              ...row,
              ...patch,
            }
          : row,
      ),
    );
  };

  const updateQuestion = (
    buttonIndex: number,
    questionIndex: number,
    patch: Partial<Question>,
  ) => {
    setButtons((rows) =>
      rows.map((button, index) => {
        if (index !== buttonIndex) {
          return button;
        }

        return {
          ...button,
          formQuestions:
            button.formQuestions.map(
              (question, qIndex) =>
                qIndex === questionIndex
                  ? {
                      ...question,
                      ...patch,
                    }
                  : question,
            ),
        };
      }),
    );
  };

  const addQuestion = (
    buttonIndex: number,
  ) => {
    setButtons((rows) =>
      rows.map((button, index) => {
        if (index !== buttonIndex) {
          return button;
        }

        if (
          button.formQuestions.length >= 5
        ) {
          toast.error(
            "Discord forms can contain a maximum of 5 questions.",
          );
          return button;
        }

        return {
          ...button,
          formQuestions: [
            ...button.formQuestions,
            makeQuestion(
              button.formQuestions.length + 1,
            ),
          ],
        };
      }),
    );
  };

  const removeQuestion = (
    buttonIndex: number,
    questionIndex: number,
  ) => {
    setButtons((rows) =>
      rows.map((button, index) => {
        if (index !== buttonIndex) {
          return button;
        }

        return {
          ...button,
          formQuestions:
            button.formQuestions.filter(
              (_, qIndex) =>
                qIndex !== questionIndex,
            ),
        };
      }),
    );
  };

  const addButton = () => {
    if (buttons.length >= 20) {
      toast.error(
        "Discord ticket panels support up to 20 buttons.",
      );
      return;
    }

    setButtons((rows) => [
      ...rows,
      makeButton(rows.length),
    ]);

    setExpanded(buttons.length);
  };

  const removeButton = (
    index: number,
  ) => {
    setButtons((rows) =>
      rows.filter(
        (_, i) => i !== index,
      ),
    );

    setExpanded(null);
  };

  async function send() {
    if (!channelId) {
      toast.error(
        "Pick a channel for the panel first.",
      );
      return;
    }

    const clean = buttons.filter(
      (button) =>
        button.label.trim().length > 0,
    );

    if (clean.length === 0) {
      toast.error(
        "Add at least one ticket button.",
      );
      return;
    }

    for (
      let index = 0;
      index < clean.length;
      index++
    ) {
      const button = clean[index];

      if (
        button?.formQuestions.some(
          (question) =>
            !question.label.trim(),
        )
      ) {
        toast.error(
          `Button ${index + 1} has a form question without a label.`,
        );
        return;
      }
    }

    setSending(true);

    try {
      await post({
        data: {
          guildId,
          channelId,

          title:
            title.trim() ||
            undefined,

          description:
            description.trim() ||
            undefined,

          transcriptChannelId,

          dmTranscriptEnabled,

          buttons: clean.map(
            (button) => ({
              label:
                button.label.trim(),

              emoji:
                button.emoji.trim() ||
                undefined,

              style:
                button.style,

              categoryId:
                button.categoryId,

              category:
                button.category.trim() ||
                button.label.trim(),

              supportRoleIds:
                button.supportRoleIds,

              accessRoleIds:
                button.accessRoleIds,

              requiredPermission:
                button.requiredPermission,

              formQuestions:
                button.formQuestions.map(
                  (question) => ({
                    id:
                      question.id,

                    label:
                      question.label.trim(),

                    placeholder:
                      question.placeholder.trim() ||
                      undefined,

                    required:
                      question.required,

                    style:
                      question.style,
                  }),
                ),

              transcriptEnabled:
                transcriptsEnabled,

              transcriptChannelId: null,

              dmTranscriptEnabled,
            }),
          ),
        },
      });

      toast.success(
        "Ticket panel queued successfully. !PIRATE will publish it shortly.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not send the ticket panel.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-5 rounded-xl border border-border/70 bg-surface-2/40 p-4">
      <div>
        <p className="text-sm font-semibold">
          Post a ticket panel
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          Every button can now have its own
          category, staff roles, access rules,
          form and transcript settings.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Post to channel">
          <PickerSelect
            value={channelId}
            options={channels}
            onChange={setChannelId}
            placeholder="Select a channel"
          />
        </Field>

        <Field label="Panel title">
          <Input
            value={title}
            onChange={(event) =>
              setTitle(
                event.target.value,
              )
            }
            maxLength={256}
          />
        </Field>
      </div>

      <Field label="Panel description">
        <Textarea
          rows={3}
          value={description}
          onChange={(event) =>
            setDescription(
              event.target.value,
            )
          }
          maxLength={2000}
        />
      </Field>

      <div className="rounded-xl border border-border/60 bg-background/30 p-4">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold">
              Default transcript settings
            </p>

            <p className="text-xs text-muted-foreground">
              These are used when a button does
              not have its own transcript destination.
            </p>
          </div>

          <Field label="Transcript channel">
            <PickerSelect
              value={
                transcriptChannelId
              }
              options={channels}
              onChange={
                setTranscriptChannelId
              }
              placeholder="Select transcript channel"
            />
          </Field>

          <ToggleRow
            label="DM transcript to ticket owner"
            description="Send the closed ticket transcript to the member's Discord DM."
            checked={
              dmTranscriptEnabled
            }
            onChange={
              setDmTranscriptEnabled
            }
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              Ticket buttons (
              {buttons.length}/20)
            </p>

            <p className="text-xs text-muted-foreground">
              Each button is independently configured.
            </p>
          </div>

          <Button
            size="sm"
            variant="secondary"
            className="gap-1"
            disabled={
              buttons.length >= 20
            }
            onClick={addButton}
          >
            <Plus className="size-4" />
            Add button
          </Button>
        </div>

        {buttons.map(
          (button, index) => {
            const isExpanded =
              expanded === index;

            return (
              <div
                key={index}
                className="overflow-hidden rounded-xl border border-border/60 bg-background/40"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                  onClick={() =>
                    setExpanded(
                      isExpanded
                        ? null
                        : index,
                    )
                  }
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-xl">
                      {button.emoji ||
                        "🎫"}
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {button.label ||
                          `Ticket button ${index + 1}`}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {button.categoryId
                          ? "Custom category configured"
                          : "Uses default category"}
                        {" • "}
                        {button.formQuestions.length}
                        {" form question"}
                        {button.formQuestions.length ===
                        1
                          ? ""
                          : "s"}
                      </p>
                    </div>
                  </div>

                  {isExpanded ? (
                    <ChevronUp className="size-4 shrink-0" />
                  ) : (
                    <ChevronDown className="size-4 shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="space-y-5 border-t border-border/60 p-4">
                    <div className="grid gap-3 md:grid-cols-[80px_1fr_150px_auto] md:items-end">
                      <Field label="Emoji">
                        <Input
                          value={
                            button.emoji
                          }
                          maxLength={8}
                          onChange={(
                            event,
                          ) =>
                            updateButton(
                              index,
                              {
                                emoji:
                                  event
                                    .target
                                    .value,
                              },
                            )
                          }
                        />
                      </Field>

                      <Field label="Label">
                        <Input
                          value={
                            button.label
                          }
                          maxLength={80}
                          placeholder="General support"
                          onChange={(
                            event,
                          ) =>
                            updateButton(
                              index,
                              {
                                label:
                                  event
                                    .target
                                    .value,
                              },
                            )
                          }
                        />
                      </Field>

                      <Field label="Colour">
                        <Select
                          value={
                            button.style
                          }
                          onValueChange={(
                            value,
                          ) =>
                            updateButton(
                              index,
                              {
                                style:
                                  value as PanelButton["style"],
                              },
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent>
                            {STYLES.map(
                              (
                                style,
                              ) => (
                                <SelectItem
                                  key={
                                    style.value
                                  }
                                  value={
                                    style.value
                                  }
                                >
                                  {
                                    style.label
                                  }
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </Field>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove button"
                        onClick={() =>
                          removeButton(
                            index,
                          )
                        }
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>


                    <div className="rounded-xl border border-border/60 p-4">
                      <p className="mb-4 text-sm font-semibold">
                        Ticket routing
                      </p>

                      <div className="grid gap-4 md:grid-cols-2">
                        <Field
                          label="Discord ticket category"
                          hint="This button will create tickets inside this exact Discord category."
                        >
                          <PickerSelect
                            value={
                              button.categoryId
                            }
                            options={
                              categories
                            }
                            onChange={(
                              value,
                            ) =>
                              updateButton(
                                index,
                                {
                                  categoryId:
                                    value,
                                },
                              )
                            }
                            placeholder="Select category"
                          />
                        </Field>

                        <Field
                          label="Internal ticket type"
                          hint="Used for ticket records and transcripts."
                        >
                          <Input
                            value={
                              button.category
                            }
                            placeholder={
                              button.label ||
                              "General support"
                            }
                            maxLength={
                              80
                            }
                            onChange={(
                              event,
                            ) =>
                              updateButton(
                                index,
                                {
                                  category:
                                    event
                                      .target
                                      .value,
                                },
                              )
                            }
                          />
                        </Field>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/60 p-4">
                      <p className="mb-4 text-sm font-semibold">
                        Support team
                      </p>

                      <div className="space-y-4">
                        <Field
                          label="Support roles"
                          hint="These roles can see and manage this ticket and will be tagged when the ticket opens."
                        >
                          <MultiPicker
                            values={
                              button.supportRoleIds
                            }
                            options={
                              roles
                            }
                            onChange={(
                              value,
                            ) =>
                              updateButton(
                                index,
                                {
                                  supportRoleIds:
                                    value,
                                },
                              )
                            }
                            emptyLabel="No Discord roles available."
                          />
                        </Field>

                        <Field
                          label="Members allowed to use this button"
                          hint="If roles are selected, a member needs at least one of these roles."
                        >
                          <MultiPicker
                            values={
                              button.accessRoleIds
                            }
                            options={
                              roles
                            }
                            onChange={(
                              value,
                            ) =>
                              updateButton(
                                index,
                                {
                                  accessRoleIds:
                                    value,
                                },
                              )
                            }
                            emptyLabel="Everyone can use this button."
                          />
                        </Field>

                        <Field
                          label="Required Discord permission"
                          hint="Controls who can click this ticket option."
                        >
                          <Select
                            value={
                              button.requiredPermission
                            }
                            onValueChange={(
                              value,
                            ) =>
                              updateButton(
                                index,
                                {
                                  requiredPermission:
                                    value as PanelButton["requiredPermission"],
                                },
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>

                            <SelectContent>
                              {PERMISSIONS.map(
                                (
                                  permission,
                                ) => (
                                  <SelectItem
                                    key={
                                      permission.value
                                    }
                                    value={
                                      permission.value
                                    }
                                  >
                                    {
                                      permission.label
                                    }
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">
                            Ticket form
                          </p>

                          <p className="text-xs text-muted-foreground">
                            The member must complete this form before the private ticket is created.
                            Maximum 5 questions.
                          </p>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="gap-1"
                          disabled={
                            button
                              .formQuestions
                              .length >=
                            5
                          }
                          onClick={() =>
                            addQuestion(
                              index,
                            )
                          }
                        >
                          <Plus className="size-4" />
                          Add question
                        </Button>
                      </div>

                      <div className="mt-4 space-y-3">
                        {button.formQuestions.length ===
                          0 && (
                          <div className="rounded-lg border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
                            No form questions.
                            Clicking the button
                            will create the
                            ticket immediately.
                          </div>
                        )}

                        {button.formQuestions.map(
                          (
                            question,
                            questionIndex,
                          ) => (
                            <div
                              key={
                                question.id
                              }
                              className="rounded-lg border border-border/60 p-3"
                            >
                              <div className="grid gap-3 md:grid-cols-[1fr_1fr_150px_auto]">
                                <Field label="Question">
                                  <Input
                                    value={
                                      question.label
                                    }
                                    maxLength={
                                      45
                                    }
                                    placeholder="What do you need help with?"
                                    onChange={(
                                      event,
                                    ) =>
                                      updateQuestion(
                                        index,
                                        questionIndex,
                                        {
                                          label:
                                            event
                                              .target
                                              .value,
                                        },
                                      )
                                    }
                                  />
                                </Field>

                                <Field label="Placeholder">
                                  <Input
                                    value={
                                      question.placeholder
                                    }
                                    maxLength={
                                      100
                                    }
                                    placeholder="Enter your answer..."
                                    onChange={(
                                      event,
                                    ) =>
                                      updateQuestion(
                                        index,
                                        questionIndex,
                                        {
                                          placeholder:
                                            event
                                              .target
                                              .value,
                                        },
                                      )
                                    }
                                  />
                                </Field>

                                <Field label="Answer type">
                                  <Select
                                    value={
                                      question.style
                                    }
                                    onValueChange={(
                                      value,
                                    ) =>
                                      updateQuestion(
                                        index,
                                        questionIndex,
                                        {
                                          style:
                                            value as Question["style"],
                                        },
                                      )
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>

                                    <SelectContent>
                                      <SelectItem value="short">
                                        Short answer
                                      </SelectItem>

                                      <SelectItem value="paragraph">
                                        Paragraph
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </Field>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Remove question"
                                  onClick={() =>
                                    removeQuestion(
                                      index,
                                      questionIndex,
                                    )
                                  }
                                >
                                  <Trash2 className="size-4 text-destructive" />
                                </Button>
                              </div>

                              <div className="mt-3">
                                <ToggleRow
                                  label="Required"
                                  checked={
                                    question.required
                                  }
                                  onChange={(
                                    value,
                                  ) =>
                                    updateQuestion(
                                      index,
                                      questionIndex,
                                      {
                                        required:
                                          value,
                                      },
                                    )
                                  }
                                />
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </div>

                  </div>
                )}
              </div>
            );
          },
        )}
      </div>

      <Button
        onClick={send}
        disabled={sending}
        className="gap-2"
      >
        <Send className="size-4" />
        {sending
          ? "Sending…"
          : "Send panel"}
      </Button>
    </div>
  );
}
