import { describe, expect, it } from "vitest";
import { applyEvent, emptyChat, MAX_MESSAGES_KEPT, settle } from "./chat-state";

const id = (n: number) => n.toString(16).padStart(32, "0");
const noor = { userId: "101", at: "2026-11-14T10:00:00.000Z" };
const kenji = { userId: "202", at: "2026-11-14T10:01:00.000Z" };

function chatWithHello() {
  return applyEvent(emptyChat("5001", 0), { type: "text", id: id(1), text: "hello" }, noor);
}

describe("applyEvent", () => {
  it("adds a message once, however many times it arrives", () => {
    const chat = chatWithHello();
    expect(chat.messages).toHaveLength(1);
    expect(chat.messages[0]).toMatchObject({ authorId: "101", text: "hello", reactions: {} });
    const again = applyEvent(chat, { type: "text", id: id(1), text: "a replayed copy" }, kenji);
    expect(again).toBe(chat);
  });

  it("lets only the author edit or delete a message", () => {
    const chat = chatWithHello();
    // Kenji can't change what Noor said, or make it vanish.
    expect(applyEvent(chat, { type: "edit", target: id(1), text: "I owe you money" }, kenji)).toBe(
      chat,
    );
    expect(applyEvent(chat, { type: "delete", target: id(1) }, kenji)).toBe(chat);

    const edited = applyEvent(chat, { type: "edit", target: id(1), text: "hello!" }, noor);
    expect(edited.messages[0]).toMatchObject({ text: "hello!", editedAt: noor.at });
    const deleted = applyEvent(edited, { type: "delete", target: id(1) }, noor);
    expect(deleted.messages[0]).toMatchObject({ text: "", deleted: true });
    // A deleted message stays deleted and can't be edited back or reacted to.
    expect(applyEvent(deleted, { type: "edit", target: id(1), text: "back" }, noor)).toBe(deleted);
    expect(applyEvent(deleted, { type: "reaction", target: id(1), emoji: "👍" }, kenji)).toBe(
      deleted,
    );
  });

  it("refuses an edit made more than 15 minutes after the message was sent", () => {
    const chat = chatWithHello();
    const late = { userId: "101", at: "2026-11-14T10:15:01.000Z" };
    expect(applyEvent(chat, { type: "edit", target: id(1), text: "rewritten later" }, late)).toBe(
      chat,
    );
    const inTime = { userId: "101", at: "2026-11-14T10:14:59.000Z" };
    expect(
      applyEvent(chat, { type: "edit", target: id(1), text: "fixed a typo" }, inTime).messages[0]
        ?.text,
    ).toBe("fixed a typo");
  });

  it("numbers messages in the order they were first seen, and never reuses a number", () => {
    let chat = chatWithHello();
    chat = applyEvent(chat, { type: "text", id: id(2), text: "second" }, kenji);
    chat = applyEvent(chat, { type: "delete", target: id(2) }, kenji);
    chat = applyEvent(chat, { type: "text", id: id(3), text: "third" }, noor);
    expect(chat.messages.map((m) => m.seq)).toEqual([1, 3, 2]);
    expect(chat.nextSeq).toBe(4);
  });

  it("drops the report proof when the text it proved is edited or deleted", () => {
    const proof = {
      serverId: "9",
      payload: "cA",
      frankingKey: "a",
      commitment: "b",
      serverSignature: "c",
    };
    const chat = applyEvent(
      emptyChat("5001", 0),
      { type: "text", id: id(1), text: "x" },
      { ...kenji, proof },
    );
    expect(chat.messages[0]?.proof).toEqual(proof);
    const edited = applyEvent(chat, { type: "edit", target: id(1), text: "y" }, kenji);
    expect(edited.messages[0]?.proof).toBeUndefined();
  });

  it("keeps one reaction per person per emoji, and removes only your own", () => {
    let chat = chatWithHello();
    chat = applyEvent(chat, { type: "reaction", target: id(1), emoji: "❤️" }, kenji);
    expect(applyEvent(chat, { type: "reaction", target: id(1), emoji: "❤️" }, kenji)).toBe(chat);
    chat = applyEvent(chat, { type: "reaction", target: id(1), emoji: "❤️" }, noor);
    expect(chat.messages[0]?.reactions).toEqual({ "❤️": ["202", "101"] });
    chat = applyEvent(chat, { type: "reaction", target: id(1), emoji: "❤️", remove: true }, kenji);
    expect(chat.messages[0]?.reactions).toEqual({ "❤️": ["101"] });
    // Reacting to a message that isn't there does nothing.
    expect(applyEvent(chat, { type: "reaction", target: id(9), emoji: "👍" }, kenji)).toBe(chat);
    // A flood of different emoji stops at a limit.
    for (let i = 0; i < 60; i++) {
      chat = applyEvent(chat, { type: "reaction", target: id(1), emoji: `e${i}` }, kenji);
    }
    expect(Object.keys(chat.messages[0]?.reactions ?? {}).length).toBe(30);
  });

  it("moves Seen forward only, and only to a real message", () => {
    let chat = chatWithHello();
    chat = applyEvent(chat, { type: "text", id: id(2), text: "second" }, noor);
    chat = applyEvent(chat, { type: "seen", upTo: id(2) }, kenji);
    expect(chat.seen).toEqual({ "202": id(2) });
    expect(applyEvent(chat, { type: "seen", upTo: id(1) }, kenji)).toBe(chat);
    expect(applyEvent(chat, { type: "seen", upTo: id(7) }, kenji)).toBe(chat);
  });

  it("keeps the newest messages past the cap", () => {
    let chat = emptyChat("5001", 0);
    for (let i = 1; i <= MAX_MESSAGES_KEPT + 5; i++) {
      chat = applyEvent(chat, { type: "text", id: id(i), text: `m${i}` }, noor);
    }
    expect(chat.messages).toHaveLength(MAX_MESSAGES_KEPT);
    expect(chat.messages.at(-1)?.text).toBe(`m${MAX_MESSAGES_KEPT + 5}`);
    expect(chat.messages[0]?.text).toBe("m6");
  });

  it("orders messages by when the server got them, with unsent ones last", () => {
    let chat = applyEvent(
      emptyChat("5001", 0),
      { type: "text", id: id(1), text: "mine, still sending" },
      { userId: "101", at: "2026-11-14T10:00:05.000Z", status: "sending" },
    );
    // Something that was sent earlier arrives while mine is on its way.
    chat = applyEvent(
      chat,
      { type: "text", id: id(2), text: "theirs" },
      { userId: "202", at: "2026-11-14T10:00:07.000Z" },
    );
    expect(chat.messages.map((m) => m.text)).toEqual(["theirs", "mine, still sending"]);
    // Mine reaches the server after theirs: it stays after. Had it got there first, it moves up.
    const late = settle(chat, id(1), { sentAt: "2026-11-14T10:00:09.000Z" });
    expect(late.messages.map((m) => m.text)).toEqual(["theirs", "mine, still sending"]);
    const early = settle(chat, id(1), { sentAt: "2026-11-14T10:00:06.000Z" });
    expect(early.messages.map((m) => m.text)).toEqual(["mine, still sending", "theirs"]);
  });

  it("settles a sending message as sent or failed", () => {
    const sending = applyEvent(
      emptyChat("5001", 0),
      { type: "text", id: id(1), text: "on its way" },
      { ...noor, status: "sending" },
    );
    expect(sending.messages[0]?.status).toBe("sending");
    const sent = settle(sending, id(1), { sentAt: "2026-11-14T10:05:00.000Z" });
    expect(sent.messages[0]?.status).toBeUndefined();
    expect(sent.messages[0]?.sentAt).toBe("2026-11-14T10:05:00.000Z");
    expect(settle(sending, id(1), "failed").messages[0]?.status).toBe("failed");
  });
});
