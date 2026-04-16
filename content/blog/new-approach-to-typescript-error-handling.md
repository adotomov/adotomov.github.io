---
title: Making TypeScript error handling a compiler concern, not a team discipline
date: 2026-04-16
summary: TypeScript's exception model makes error handling a matter of team discipline rather than something the compiler enforces, which means failure modes are invisible in function signatures and easy to miss until they surface in production.
tags:
  - typescript
  - errors
  - exceptions
  - good-practices
---

---

There is a particular kind of frustration that builds up slowly in a codebase, one that you don't fully notice until you are sitting in front of a production incident at an inconvenient hour, tracing through a stack of function calls and realising that at no point did the type system give you any indication that any of these functions could fail in the way they just did. You look at a function that returns `Promise<User>`, and you think — well, of course it returns a User, that's what it says. Except it doesn't, not really. It returns a User when everything goes right, and it throws an exception when anything goes wrong, and none of that is reflected in the signature you've been trusting.

This was, more or less, the frustration that eventually pushed me to build explicit-ts.

---

## The thing about exceptions is that they make error handling optional

I want to be precise about what bothers me here, because I'm not making a general argument against exceptions as a language feature. For genuine programming errors — things that represent broken invariants, unexpected null values in places that should be impossible, assertions that should never fire — exceptions are exactly right. They should crash the program loudly and let you know that something in the code itself is wrong. The problem is that most of the errors in a production TypeScript application are not that kind. A user requesting a record that doesn't exist is not a programming error. A payment gateway timing out under load is not a programming error. An email address that fails a validation rule is not a programming error. These are expected failures, and they're a normal part of what the system needs to handle. But because TypeScript has no checked exceptions, they all end up in the same bucket as the genuine crashes, and the type system offers no help distinguishing between them or ensuring they get handled at all.

The practical consequence is that whether you handle a failure is a matter of discipline and memory rather than something the compiler enforces. You have to remember which of your dependencies can throw, what they throw, and where to put the `try/catch`. When a function changes its failure modes over time, nothing breaks at compile time — you just have a new unhandled case somewhere waiting to be discovered. I found this genuinely uncomfortable to work with at scale, especially across a team where the knowledge of which functions could fail in which ways lived in documentation that was perpetually slightly out of date.

---

## What I kept coming back to

The idea I kept returning to was what Rust does with its `Result<T, E>` type — not because I think TypeScript should be Rust, but because the core insight is sound regardless of the language. If a function can fail, that fact should be visible in its return type, and the caller should be structurally required to deal with it. In Rust this is enforced deeply by the language and the `?` operator makes it ergonomic. In TypeScript, you don't get the `?` operator, but you do get discriminated unions and a type system strong enough to make the same pattern work well, just with a little more ceremony at each step.

The other thing that shaped the design was a conviction about simplicity. I didn't want a framework. I didn't want a class hierarchy, or a monad tower, or a library that would require everyone on the team to learn a new mental model before they could contribute. What I wanted was something small enough to explain in a few minutes, close enough to plain TypeScript that it wouldn't feel alien, and opinionated enough to actually improve the code at the point where errors are most commonly mishandled.

---

## What explicit-ts actually is

At its core, the library is four packages that address four specific problems, and you can adopt any of them independently without buying into the rest.

The first is `explicit-ts/result`, which provides the `Result<T, E>` type and a set of utilities for working with it. A `Result` is simply a discriminated union of `{ ok: true, value: T }` and `{ ok: false, error: E }`, and the utilities cover the operations you reach for most often: transforming the value, chaining fallible operations, recovering from errors, and extracting the value with a fallback. The point is not that these utilities are clever — most of them are a few lines each — but that having a shared vocabulary means everyone on a team handles failures the same way.

The second is `explicit-ts/errors`, which gives you structured tagged errors. Plain string error codes work well for simple cases, but when you're operating a system at any serious scale you want errors that carry context: not just that something went wrong, but where, with what data, and why. The `GError` type gives every error a stable machine-readable `tag`, a human-readable `message`, optional typed metadata captured at the point of failure, and a `cause` field that preserves the error chain all the way down to the original exception. This turns out to be enormously useful for observability — instead of reconstructing what happened from fragmented log lines, you get a single structured object with the complete story of the failure.

The third is `explicit-ts/context`, which provides utilities for working with `AbortSignal` in a more ergonomic way. Cancellation is something that gets neglected in a lot of TypeScript codebases because it's awkward to wire up, and the result is long-running operations that can't be interrupted and timeout handling that gets bolted on as an afterthought. The helpers in this package — `withCancel`, `withTimeout`, `combineSignals`, `checkCancelled` — don't do anything magical, but they make it natural to thread a cancellation signal through a call chain so that every layer of a computation can check whether the caller has already given up.

The fourth is `explicit-ts/boundary`, which addresses the reality that not all code is yours. HTTP frameworks, ORMs, and third-party SDKs generally expect exceptions, and you need some way to integrate your Result-returning code with that world without losing the type safety you've built up. The `unwrapOrThrow` and `unwrapOrThrowAsync` functions convert a `Result` into either a value or a thrown error at the point where the two worlds meet, and the conversion is explicit and intentional rather than implicit and scattered.

---

## A concrete example that shows why this matters

Let me walk through something realistic rather than contrived, because I think the value of this approach is harder to see in toy examples than in code that resembles actual production systems. Suppose you are building a checkout flow: a user submits an order, you need to verify that the user exists, check that the items are in stock, and charge their payment method. Any of those three steps can fail in meaningful, distinct ways, and the HTTP handler at the end needs to respond with an appropriate status code depending on which failure occurred.

The first thing I tend to do when starting something like this is define the error vocabulary for the domain:

```ts
import { defineError } from "explicit-ts/errors";

export const NotFound = defineError<"NOT_FOUND", { id: string }>("NOT_FOUND");
export const InsufficientStock = defineError<"INSUFFICIENT_STOCK", { sku: string; available: number }>("INSUFFICIENT_STOCK");
export const PaymentDeclined = defineError<"PAYMENT_DECLINED", { reason: string }>("PAYMENT_DECLINED");
export const DbError = defineError<"DB_ERROR">("DB_ERROR");
```

These are just factory functions for structured error objects. Nothing happens at this point — you're just naming the things that can go wrong and deciding what metadata each one carries. I find this a useful exercise in itself, because it forces you to think about the failure vocabulary of a domain before you start implementing it, which often surfaces design questions worth having earlier rather than later.

The service functions then return `Result` types, and they accept an optional `AbortSignal` so that callers can cancel them:

```ts
import { ok, err, type Result } from "explicit-ts/result";
import { wrap } from "explicit-ts/errors";
import { checkCancelled } from "explicit-ts/context";

async function fetchUser(
  id: string,
  opts?: { signal?: AbortSignal },
): Promise<Result<User, ReturnType<typeof NotFound> | ReturnType<typeof DbError>>> {
  const cancelled = checkCancelled(opts?.signal);
  if (!cancelled.ok) return cancelled;

  try {
    const user = await db.users.findById(id, { signal: opts?.signal });
    if (!user) return err(NotFound("user not found", { id }));
    return ok(user);
  } catch (e) {
    return err(wrap(e, "DB_ERROR", "failed to fetch user"));
  }
}

async function checkInventory(
  sku: string,
  qty: number,
  opts?: { signal?: AbortSignal },
): Promise<Result<void, ReturnType<typeof InsufficientStock> | ReturnType<typeof DbError>>> {
  const cancelled = checkCancelled(opts?.signal);
  if (!cancelled.ok) return cancelled;

  try {
    const stock = await db.inventory.findBySku(sku, { signal: opts?.signal });
    if (stock.available < qty) {
      return err(InsufficientStock("not enough stock", { sku, available: stock.available }));
    }
    return ok(undefined);
  } catch (e) {
    return err(wrap(e, "DB_ERROR", "failed to check inventory"));
  }
}

async function chargePayment(
  userId: string,
  amount: number,
  opts?: { signal?: AbortSignal },
): Promise<Result<string, ReturnType<typeof PaymentDeclined>>> {
  const cancelled = checkCancelled(opts?.signal);
  if (!cancelled.ok) return cancelled;

  const response = await paymentGateway.charge(userId, amount, { signal: opts?.signal });
  if (!response.success) {
    return err(PaymentDeclined("payment declined", { reason: response.reason }));
  }
  return ok(response.transactionId);
}
```

Notice that none of this is exotic. Each function does a straightforward thing, returns a Result that says precisely what can go wrong, and respects a cancellation signal if one is provided. The `wrap` call on a caught exception preserves the original error as a cause, so if you later need to debug what the database actually threw, that information is still there attached to the structured `DbError`.

Composing these into the full checkout operation is where the early-return pattern pays off, because each step is explicit about what happens when it fails and the overall flow reads linearly from top to bottom:

```ts
import { withTimeout, combineSignals } from "explicit-ts/context";

async function placeOrder(
  userId: string,
  sku: string,
  qty: number,
  opts?: { signal?: AbortSignal },
) {
  // Apply a ten-second deadline on the whole operation, while still respecting
  // any upstream cancellation signal the caller passed in.
  const { signal: deadline } = withTimeout(10_000);
  const signal = combineSignals(deadline, opts?.signal);

  const userResult = await fetchUser(userId, { signal });
  if (!userResult.ok) return userResult;

  const inventoryResult = await checkInventory(sku, qty, { signal });
  if (!inventoryResult.ok) return inventoryResult;

  const amount = userResult.value.plan === "premium" ? qty * 9 : qty * 12;
  const paymentResult = await chargePayment(userId, amount, { signal });
  if (!paymentResult.ok) return paymentResult;

  return ok({ userId, sku, transactionId: paymentResult.value });
}
```

And finally, at the HTTP boundary where the framework expects exceptions, we convert:

```ts
import { unwrapOrThrowAsync } from "explicit-ts/boundary";
import { toNativeError, isTag } from "explicit-ts/errors";

app.post("/orders", async (req, res) => {
  const { userId, sku, qty } = req.body;

  const order = await unwrapOrThrowAsync(
    placeOrder(userId, sku, qty, { signal: req.signal }),
    (e) => {
      if (isTag(e, "NOT_FOUND"))          return Object.assign(new Error("User not found"), { status: 404 });
      if (isTag(e, "INSUFFICIENT_STOCK")) return Object.assign(new Error("Out of stock"), { status: 409 });
      if (isTag(e, "PAYMENT_DECLINED"))   return Object.assign(new Error("Payment declined"), { status: 402 });
      return toNativeError(e);
    },
  );

  res.status(201).json(order);
});
```

The error-to-status mapping lives in one place, it's exhaustive in the sense that you can look at it and see every failure mode the operation can produce, and when a new failure mode gets added to `placeOrder` it shows up in the union type and you're reminded to handle it here.

---

## What this actually changes day to day

The most immediate thing you notice when you work this way is that testing gets simpler, because you no longer need to arrange exceptions in order to test failure paths. You just call a function, check whether the result has `ok: false`, and inspect the error — the same way you'd check any other return value. There's no special `expect().toThrow()` machinery, no wrapping in `try/catch` in the test body, no mocking exception-throwing dependencies.

The second thing is that you spend less time guessing what a function can do and more time reading a type signature and actually knowing. When someone new joins a team and looks at a function that returns `Promise<Result<Order, ReturnType<typeof NotFound> | ReturnType<typeof InsufficientStock> | ReturnType<typeof PaymentDeclined>>>`, they know the complete story of what this function does, because the type forces it to be there. That's the kind of thing that used to live in a wiki page that nobody remembered to update.

The third thing, which I've come to appreciate more than I expected, is that it encourages you to think about your error vocabulary as a first-class design concern. When errors are invisible in signatures, they tend to be an afterthought — something you figure out while debugging. When they're part of the type, you define them upfront and the domain becomes clearer for it.

---

## Where to go from here

The library is small by design and has no runtime dependencies, so there's no meaningful cost to trying it on a new project or a single module and seeing whether the approach resonates with you. The source is on GitHub at [adotomov/explicit-ts](https://github.com/adotomov/explicit-ts), and the README covers the full API for each package with practical examples.

If you've felt the same friction I was describing — the guessing, the invisible failure modes, the optional error handling — I'd genuinely like to hear whether this approach helps. And if you find something that could be done better, the repository is open.
