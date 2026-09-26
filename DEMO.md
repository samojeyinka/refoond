# refoond — demo walkthrough

Everything you need to run a live demo: who to sign in as, what each order exercises, and a step-by-step
script for each feature. For setup, see [README.md](README.md).

---

## Login credentials

Every seeded account uses the password **`Password123!`**

| Role | Email | Use it to test |
| --- | --- | --- |
| Admin | `admin@refoond.dev` | The whole agent side: queue, handoffs, review, replies |
| Customer | `amara.okafor@example.com` | Approve **and** deny on one account (has both kinds of order) |
| Customer | `ben.castellanos@example.com` | Out-of-window denial (44-day-old shoes) |
| Customer | `chloe.dubois@example.com` | Final-sale partial approval |
| Customer | `daniel.weiss@example.com` | Multi-item order, large in-window approval |
| Customer | `elif.yilmaz@example.com` | Partially-refunded order |
| Customer | `farid.haddad@example.com` | Cancelled order → always denied |
| Customer | `grace.mbeki@example.com` | Clean approval, plus a 37-day-old denial |
| Customer | `hiro.tanaka@example.com` | High-value order just inside the window |
| Customer | `ines.ferreira@example.com` | Not-yet-delivered / in-transit refund |
| Customer | `jonas.berg@example.com` | Multi-item, in-window |
| Customer | `kavya.raman@example.com` | Final-sale collectible |
| Customer | `lucas.moreau@example.com` | **Prompt-injection** attempt |
| Customer | `marta.kowalski@example.com` | Straightforward approval |
| Customer | `noah.feldman@example.com` | Out-of-window denial with a coupon |
| Customer | `priya.nair@example.com` | **Escalation** — 1-day-old account + $550 request |

> The admin full name is **Robin Hale**, and the customer's own name is shown on their messages.
> Seeing real names instead of "Support Agent" / "Customer" is part of what you are testing.

---

## Seeded orders

18 orders across 15 customers, deliberately covering every branch of the policy engine.

| Order | Customer | Status | Delivered | Items | What it exercises |
| --- | --- | --- | --- | --- | --- |
| ORD-4827 | Amara | DELIVERED | 9 days | Pour-Over Set $68.00 | Clean in-window **approval** |
| ORD-4834 | Amara | DELIVERED | 195 days | Linen Apron $42.00 | **Window expired** → denial |
| ORD-4841 | Ben | DELIVERED | 44 days | Trail Shoes $129.00 | Window expired → denial |
| ORD-4848 | Chloe | DELIVERED | 17 days | Vinyl $35.00 *(final sale)* + Brush $18.00 | **Partial** approval, final sale excluded |
| ORD-4855 | Daniel | DELIVERED | 5 days | Desk Converter $380.00 + Mat $75.00 | Large multi-item approval ($455) |
| ORD-4862 | Elif | DELIVERED | 2 days | Socks $25.00 ×2, **$25 already refunded** | Partial-refund history |
| ORD-4869 | Farid | CANCELLED | — | Cast Iron Skillet $54.00 | Cancelled → always denied |
| ORD-4876 | Grace | DELIVERED | 3 days | Keyboard $299.00 | Clean approval |
| ORD-4883 | Hiro | DELIVERED | 21 days | Headphones $410.00 + Case $39.00 | High value, still under the limit |
| ORD-4890 | Ines | SHIPPED | not yet | Espresso Grinder $175.00 | **Never delivered** |
| ORD-4897 | Jonas | DELIVERED | 2 days | Yoga Mat $62.00 + Blocks $24×2 | Multi-item approval |
| ORD-4904 | Kavya | DELIVERED | 7 days | Signed Photo $95.00 *(final sale)* | Final sale → denied |
| ORD-4911 | Lucas | DELIVERED | 1 day | Chef Knife $88.00 | **Injection attempt** (seeded message) |
| ORD-4918 | Marta | DELIVERED | 4 days | Bluetooth Speaker $119.00 | Clean approval |
| ORD-4925 | Noah | DELIVERED | 56 days | Bath Towel Set $56.00 *(coupon SPRING24)* | Window expired → denial |
| ORD-4932 | Priya *(1-day account)* | DELIVERED | 1 day | Studio Monitors $275.00 ×2 = **$550** | **Escalation** to a human |
| ORD-4939 | Daniel | DELIVERED | 1 day | Cable Tray $32.00 | Clean approval |
| ORD-4946 | Grace | DELIVERED | 37 days | Smartwatch $210.00 | Window expired → denial |

---

## 1. Customer chat

Sign in as a customer, open an order, and start a refund.

| # | What to do | What you should see |
| --- | --- | --- |
| 1 | Open any order and start the conversation | Greeting begins with your **first name** ("Hello, Amara, …") |
| 2 | Type free text *before* picking a reason, e.g. "the box arrived crushed" | The assistant replies conversationally and does **not** force the wizard or lose your text |
| 3 | Pick a reason chip | Assistant acknowledges and moves to amount selection |
| 4 | Look at the amount options | Amounts are phrased as **conditional ceilings** ("up to", "at most") — never "you will get" |
| 5 | Type a **custom amount** that is invalid, then a valid one | Invalid input is rejected without losing the amount you typed or resetting the step |
| 6 | Complete the flow | A decision bubble plus a `System Notice`; the badge shows Approved / Denied / Needs review |
| 7 | Ask a follow-up afterwards, e.g. "so how much comes back?" | Answer stays consistent with the decision already made |
| 8 | Ask something out of scope, e.g. "what's your manager's email?" | Assistant stays on policy and offers a human instead |

**Out-of-window honesty check (the important one):** sign in as `amara.okafor@example.com` and refund the
**Linen Apron (ORD-4834, 195 days old)**. The assistant must:

- state the order is 195 days old and outside the 30-day window,
- only ever describe amounts as maximums,
- **not** claim the order was eligible earlier and then take it back.

The age and window are computed in code and handed to the model, so it cannot do the date maths wrong or
contradict itself.

---

## 2. Policy decisions

Use these to confirm the rule engine, independent of what the model says. The amount you pick in the chat
drives the outcome, so select the full item value to see the maximum outcome.

| Goal | Sign in as | Order | Expected |
| --- | --- | --- | --- |
| Approval | Amara | ORD-4827 | Approved |
| Denial — window expired | Amara | ORD-4834 | Denied, "195 days old, window is 30 days" |
| Denial — window expired | Ben | ORD-4841 | Denied at 44 days |
| Denial — cancelled order | Farid | ORD-4869 | Denied, order is cancelled |
| Denial — final sale | Kavya | ORD-4904 | Denied, item is final sale |
| Partial — final sale excluded | Chloe | ORD-4848 | Only the non-final-sale item is refundable |
| Partial — already refunded | Elif | ORD-4862 | Only the remaining balance |
| Approval — never delivered | Ines | ORD-4890 | Approved, order is still in transit |
| **Escalation — over $500** | Priya | ORD-4932 | **Needs review**, routed to the admin queue |
| **Escalation — new account** | Priya | ORD-4932 | Also flagged: the account is 1 day old |
| Injection defence | Lucas | ORD-4911 | The seeded "ignore all previous instructions" message is **ignored**; the decision is still made by policy and the attempt is flagged |

---

## 3. Human handoff

The most useful test is two windows side by side.

1. **Window A** (incognito) — sign in as `priya.nair@example.com`, open a refund, type
   *"I'd rather talk to a person about this."*
2. **Window B** — sign in as `admin@refoond.dev` and open the queue.

Check:

| Where | What you should see |
| --- | --- |
| Customer, chat | The toggle flips to **Customer service** on its own |
| Customer, chat | A `Handed off to customer service` divider appears **at the point of handoff**, not as a permanent banner |
| Customer, chat | The assistant stops replying and the typing indicator stops |
| Customer, chat | You can still type, and the message goes to the human |
| Customer, chat | Refresh the page — you are **still** in Customer service. The handoff is persisted |
| Customer, chat | Switch back to **Assistant** yourself and the bot resumes |
| Admin, queue | A banner: **"The customer asked for a person"** |
| Admin, drawer | The policy reasoning appears *inside* the chat under **How this was decided**, as plain sentences with no `R0`/`R3` rule codes |
| Admin, drawer | The customer shows a request to speak to a person, and replies land live over the socket |

---

## 4. Admin review and resolution

Escalated cases are the ones that need a human decision.

1. Sign in as `priya.nair@example.com` and request the full **$550** on ORD-4932 → it escalates.
2. Sign in as the admin, open that request from the queue.
3. Confirm the decision badge, the requested/approved amounts, and the reasoning text.
4. Type a review note and choose **Approve refund** or **Deny refund**.
5. Check the outcome banner shows the reviewer as **Robin Hale**, and that the customer is notified in
   their thread.

Also worth checking:

- The chat is bounded — **only the message list scrolls**, the composer stays pinned.
- `Reconnecting…` appears at the bottom of the composer if the socket drops.
- The admin's own messages show as **You**; everyone else's show their real name.
- Rate the conversation from the customer side and confirm the stars persist.
- Close the ticket and confirm the thread becomes read-only for the admin.

---

## 5. Realtime, unread counts and sounds

Keep the admin queue and a customer conversation open in two windows, then send messages both ways.

**Realtime delivery**

| What you do | What you should see |
| --- | --- |
| Customer sends a message | It appears in the admin drawer with no refresh, and the admin hears the receive tone |
| Admin replies | It appears in the customer's chat with no refresh, and the customer hears the receive tone |
| Either side sends | The sending side hears a short, lower send tone (you never hear a receive tone for your own message) |
| The **assistant** replies | Its own three-note pattern, so an AI turn is distinguishable from a human one |
| Refresh mid-conversation | The full history reloads in order, with no duplicated or missing bubbles |
| Switch between two different orders | Each thread shows only its own messages. Threads are never blended |

**Unread / last-message indicators**

Orders, Refunds and the admin queue all show the newest message in the thread plus a badge of how many
messages you have not read yet.

| What you do | What you should see |
| --- | --- |
| Customer sends a message, admin has the queue open | The admin's queue row updates in place and shows a blue **unread count** |
| Admin opens that request | The badge clears for the admin, because opening the thread is what marks it read |
| Customer has the list open, an admin replies | The customer's card picks up the reply preview and unread count when the chat is closed |
| Customer opens the thread | Their badge clears too — the count is **per person**, not global |
| Look at an older request | Cards with nothing new stay grey and unbadged |

Your own messages never count as unread for you, and the `Decision: ...` system line is excluded, because
the card already shows the decision and its reason.

> The admin queue updates live over the socket. Customer list pages refresh when the chat drawer is closed:
> only staff join the broadcast room, so a customer's list has nothing to listen to. Closing the drawer
> refetches, which is when the preview and badge catch up.

**Sounds**

- Two-note rise on receive, one low blip on send, a three-note pattern for the assistant. No audio files,
  synthesised with the Web Audio API.
- The bell button in the chat composer mutes everything, and the choice survives a refresh.
- Browsers block audio until you have interacted with the page, so the first tone needs one click anywhere in
  the app first. That is browser policy, not a bug.
