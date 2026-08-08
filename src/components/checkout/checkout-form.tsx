import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Wallet,
  Users,
  MessageCircle,
} from "lucide-react";
import type { Product } from "@/lib/data/catalog";
import {
  CONTACT_METHODS,
  CRYPTO_WALLETS,
  CRYPTO_RAILS,
  CRYPTO_BUY_LINKS,
  MAX_ORDERS_PER_USER,
  SUPPORT_DISCORD,
  groupBuyPrice,
} from "@/lib/data/catalog";
import { createOrder } from "@/lib/server/examhub";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatUsd, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type PayMethod = "gift_card" | "crypto";
type Crypto = "btc" | "sol" | "eth";

function paymentRef(seed: number, productId: string, amount: number) {
  const h = Math.abs(
    Array.from(`${productId}-${seed}-${amount}`).reduce(
      (a, c) => (a * 31 + c.charCodeAt(0)) | 0,
      0,
    ),
  );
  return `EH-${(h % 900000 + 100000).toString()}`;
}

export function CheckoutForm({ product }: { product: Product }) {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [method, setMethod] = useState<PayMethod>("gift_card");
  const [giftKey, setGiftKey] = useState("");
  const [crypto, setCrypto] = useState<Crypto>("btc");
  const [cryptoRail, setCryptoRail] = useState<string>("onchain");
  const [txId, setTxId] = useState("");
  const [contactMethod, setContactMethod] = useState("email");
  const [contactValue, setContactValue] = useState("");
  const [notes, setNotes] = useState("");
  const [groupSize, setGroupSize] = useState(1);
  const [groupContacts, setGroupContacts] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tick, setTick] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(120);

  const pricing = useMemo(
    () => groupBuyPrice(product.priceUsd, groupSize),
    [product.priceUsd, groupSize],
  );

  const railMeta =
    CRYPTO_RAILS.find((r) => r.id === cryptoRail) ?? CRYPTO_RAILS[0]!;
  const isOnchain = cryptoRail === "onchain";

  useEffect(() => {
    const iv = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setTick((t) => t + 1);
          return 120;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const ref = useMemo(
    () => paymentRef(tick, product.id, pricing.total),
    [tick, product.id, pricing.total],
  );

  const wallet = CRYPTO_WALLETS[crypto];

  async function copyWallet() {
    try {
      await navigator.clipboard.writeText(wallet);
      setCopied(true);
      toast.success("Wallet address copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select and copy manually");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      toast.error("Sign in to place an order");
      navigate({ to: "/login" });
      return;
    }
    if (groupSize >= 2 && !groupContacts.trim()) {
      toast.error("Add co-buyer contact info for group buy");
      return;
    }
    setSubmitting(true);
    try {
      const result = await createOrder({
        data: {
          productId: product.id,
          paymentMethod: method,
          giftCardKey: method === "gift_card" ? giftKey : undefined,
          cryptoCurrency:
            method === "crypto" && isOnchain ? crypto : undefined,
          cryptoRail: method === "crypto" ? cryptoRail : undefined,
          cryptoTxId: method === "crypto" ? txId : undefined,
          contactMethod,
          contactValue,
          groupSize,
          groupContacts: groupSize > 1 ? groupContacts : undefined,
          notes: notes
            ? `${notes}\nPayment ref: ${ref}\nRail: ${cryptoRail}`
            : `Payment ref: ${ref}${method === "crypto" ? `\nRail: ${cryptoRail}` : ""}`,
        },
      });
      try {
        sessionStorage.removeItem("examhub.order-popup-dismissed");
      } catch {
        /* ignore */
      }
      toast.success(
        groupSize > 1
          ? `Group order submitted · ${formatUsd(result.amountUsd)} total (${result.discountPct}% off)`
          : "Order submitted — pending admin confirmation",
      );
      navigate({
        to: "/orders",
        search: { placed: result.id, tab: undefined },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Order failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (isPending) {
    return (
      <Card className="min-w-0 overflow-hidden">
        <CardContent className="p-6 sm:p-8">
          <div className="h-40 animate-pulse rounded-xl bg-bg-soft" />
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="min-w-0 overflow-hidden">
        <CardContent className="space-y-4 p-6 text-center sm:p-8">
          <p className="text-fg-muted">
            Sign in to order <strong className="text-fg">{product.name}</strong>{" "}
            and track delivery.
          </p>
          <Link to="/login">
            <Button size="lg">Sign in to continue</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 max-w-full overflow-hidden">
      <CardHeader className="min-w-0 space-y-2 px-4 sm:px-6">
        <CardTitle className="break-words text-xl sm:text-2xl">
          Checkout —{" "}
          {pricing.discountPct > 0 ? (
            <>
              <span className="mr-2 text-base font-normal text-muted line-through sm:text-lg">
                {formatUsd(product.priceUsd)}
              </span>
              {formatUsd(pricing.perPerson)}
              <span className="ml-1 text-sm font-normal text-fg-muted">
                / person
              </span>
            </>
          ) : (
            formatUsd(product.priceUsd)
          )}
        </CardTitle>
        <p className="text-sm text-fg-muted">
          Max {MAX_ORDERS_PER_USER} open orders. Gift card or crypto. Group: 2 =
          30% off · 3+ = 40% off. Admin confirms every order.
        </p>
      </CardHeader>
      <CardContent className="min-w-0 px-4 sm:px-6">
        <form onSubmit={onSubmit} className="min-w-0 space-y-5">
          {/* Group buy */}
          <div className="min-w-0 space-y-3 rounded-xl border border-border bg-bg-soft/60 p-3 sm:p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-fg">
              <Users className="h-4 w-4 shrink-0 text-primary" />
              Group buy
            </div>
            <div className="grid min-w-0 grid-cols-3 gap-1.5 sm:gap-2">
              {[
                { n: 1, label: "Solo", sub: "Full price" },
                { n: 2, label: "2 people", sub: "30% off" },
                { n: 3, label: "3+ people", sub: "40% off" },
              ].map((opt) => (
                <button
                  key={opt.n}
                  type="button"
                  onClick={() => setGroupSize(opt.n)}
                  className={cn(
                    "min-w-0 rounded-xl border px-1.5 py-2.5 text-center transition-colors sm:px-2 sm:py-3",
                    groupSize === opt.n || (opt.n === 3 && groupSize >= 3)
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-surface text-fg-muted hover:border-primary/40",
                  )}
                >
                  <span className="block text-xs font-semibold sm:text-sm">
                    {opt.label}
                  </span>
                  <span className="block text-[10px] opacity-80 sm:text-xs">
                    {opt.sub}
                  </span>
                </button>
              ))}
            </div>
            {groupSize >= 3 ? (
              <div className="space-y-2">
                <Label htmlFor="groupN">Exact group size (3–20)</Label>
                <Input
                  id="groupN"
                  type="number"
                  min={3}
                  max={20}
                  value={groupSize}
                  onChange={(e) =>
                    setGroupSize(
                      Math.max(3, Math.min(20, Number(e.target.value) || 3)),
                    )
                  }
                />
              </div>
            ) : null}
            {groupSize > 1 ? (
              <div className="space-y-2">
                <Label htmlFor="groupContacts">
                  Co-buyer contacts (required)
                </Label>
                <Textarea
                  id="groupContacts"
                  required
                  value={groupContacts}
                  onChange={(e) => setGroupContacts(e.target.value)}
                  placeholder="Name + Discord/email for each co-buyer"
                  className="min-h-[72px]"
                />
              </div>
            ) : null}
            <div className="rounded-lg bg-surface px-3 py-2 text-sm text-fg-muted">
              {groupSize === 1 ? (
                <span>Pay {formatUsd(product.priceUsd)}</span>
              ) : (
                <span>
                  <strong className="text-primary">
                    {pricing.discountPct}% off
                  </strong>{" "}
                  → {formatUsd(pricing.perPerson)} each · total{" "}
                  <strong className="text-fg">{formatUsd(pricing.total)}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Pay method tabs */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-bg-soft p-1">
            {(
              [
                ["gift_card", "Gift card"],
                ["crypto", "Crypto"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMethod(id)}
                className={cn(
                  "rounded-lg px-2 py-2.5 text-sm font-semibold transition-colors sm:px-3",
                  method === id
                    ? "bg-surface text-primary shadow-sm"
                    : "text-fg-muted hover:text-fg",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {method === "gift_card" ? (
            <div className="min-w-0 space-y-4 rounded-xl border border-border bg-bg-soft/50 p-3 sm:p-4">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-fg">
                  1. Purchase gift card(s) covering ~{formatUsd(pricing.total)}
                </p>
                {product.giftCardUrl ? (
                  <a
                    href={product.giftCardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                  >
                    Open gift card store
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="giftKey">2. Paste gift card key / code</Label>
                <Input
                  id="giftKey"
                  required
                  value={giftKey}
                  onChange={(e) => setGiftKey(e.target.value)}
                  placeholder="XXXX-XXXX-XXXX"
                  autoComplete="off"
                  className="min-w-0"
                />
              </div>
            </div>
          ) : (
            <div className="min-w-0 space-y-4 rounded-xl border border-border bg-bg-soft/50 p-3 sm:p-4">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-fg">
                  <Wallet className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0">
                    Pay {formatUsd(pricing.total)} via crypto
                  </span>
                </p>
                <Badge variant="outline" className="w-fit gap-1.5 shrink-0">
                  <RefreshCw className="h-3 w-3" />
                  Refreshes in {secondsLeft}s
                </Badge>
              </div>

              {/* Buy crypto first */}
              <div className="min-w-0 space-y-2 rounded-xl border border-primary/20 bg-surface p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-primary">
                  Need crypto? Buy here first
                </p>
                <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {CRYPTO_BUY_LINKS.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 flex-col rounded-lg border border-border bg-bg-soft/80 px-2 py-2 transition hover:border-primary/50 hover:bg-primary-soft/40"
                    >
                      <span className="flex items-center gap-1 text-xs font-bold text-fg">
                        <span className="truncate">{link.label}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 text-primary" />
                      </span>
                      <span className="truncate text-[10px] text-muted">
                        {link.note}
                      </span>
                    </a>
                  ))}
                </div>
                <p className="text-[11px] leading-relaxed text-fg-muted">
                  After buying, send{" "}
                  <strong className="text-fg">{formatUsd(pricing.total)}</strong>{" "}
                  to the wallet below and paste your TX ID.
                </p>
              </div>

              <div className="min-w-0 space-y-2">
                <Label htmlFor="cryptoRail">How you'll pay</Label>
                <Select
                  id="cryptoRail"
                  value={cryptoRail}
                  onChange={(e) => setCryptoRail(e.target.value)}
                  className="min-w-0 w-full"
                >
                  {CRYPTO_RAILS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label} — {r.description}
                    </option>
                  ))}
                </Select>
              </div>

              {isOnchain ? (
                <>
                  <div className="grid min-w-0 grid-cols-3 gap-1.5 sm:gap-2">
                    {(
                      [
                        ["btc", "BTC"],
                        ["sol", "SOL"],
                        ["eth", "ETH"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setCrypto(id)}
                        className={cn(
                          "rounded-lg border px-2 py-2 text-sm font-semibold transition-colors",
                          crypto === id
                            ? "border-primary bg-primary-soft text-primary"
                            : "border-border bg-surface text-fg-muted hover:border-primary/40",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label>Wallet address</Label>
                    <div className="flex min-w-0 gap-2">
                      <Input
                        readOnly
                        value={wallet}
                        className="min-w-0 flex-1 font-mono text-[10px] sm:text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        onClick={copyWallet}
                        aria-label="Copy wallet"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-success" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="break-all font-mono text-[10px] text-muted sm:hidden">
                      {wallet}
                    </p>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-fg-muted">
                  {railMeta.kind === "hosted" && "hint" in railMeta
                    ? railMeta.hint
                    : "Pay via the selected provider, then paste the reference below."}{" "}
                  Include amount {formatUsd(pricing.total)} and ref{" "}
                  <span className="font-mono font-semibold text-fg">{ref}</span>.
                </div>
              )}

              <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-fg-muted">
                Payment reference:{" "}
                <span className="break-all font-mono font-semibold text-fg">
                  {ref}
                </span>
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="txId">
                  {isOnchain
                    ? "Transaction ID / hash"
                    : `${railMeta.label} payment ID / reference`}
                </Label>
                <Input
                  id="txId"
                  required
                  value={txId}
                  onChange={(e) => setTxId(e.target.value)}
                  placeholder={
                    isOnchain
                      ? "Paste TXID after sending"
                      : "Paste invoice / charge / payment ID"
                  }
                  className="min-w-0 font-mono text-xs"
                />
              </div>

              {/* Stuck help */}
              <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-fg-muted">
                  Stuck buying or sending crypto? Message us on Discord — we
                  help 24/7.
                </p>
                <a
                  href={`https://discord.com/users/${SUPPORT_DISCORD}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#5865F2] px-3 py-2 text-xs font-bold text-white hover:opacity-90"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Discord @{SUPPORT_DISCORD}
                </a>
              </div>
            </div>
          )}

          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="contactMethod">Preferred contact method</Label>
              <Select
                id="contactMethod"
                value={contactMethod}
                onChange={(e) => setContactMethod(e.target.value)}
                required
                className="w-full min-w-0"
              >
                {CONTACT_METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="contactValue">Contact handle / address</Label>
              <Input
                id="contactValue"
                required
                value={contactValue}
                onChange={(e) => setContactValue(e.target.value)}
                placeholder="@you or email"
                className="min-w-0"
              />
            </div>
          </div>

          <div className="min-w-0 space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything admin should know"
              className="min-h-[72px] min-w-0"
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full max-w-full"
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "Submit order for admin confirmation"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
