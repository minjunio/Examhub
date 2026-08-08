import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Shell } from "@/components/layout/shell";
import {
  CONTACT_METHODS,
  INTERNSHIP_COUNTRIES,
  INTERNSHIP_EXTRAS,
  INTERNSHIP_FIELDS,
  US_STATES,
  estimateWeeklySalary,
  internshipBaseWithCountry,
} from "@/lib/data/catalog";
import { submitInternshipRequest } from "@/lib/server/examhub";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatUsd } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, Globe2, MapPin, Rocket, Search, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/internships")({
  component: InternshipsPage,
  head: () => ({
    meta: [
      {
        title:
          "Internship Placement by Field, State & Country | Weekly Salary Estimates — ExamHub",
      },
      {
        name: "description",
        content:
          "Request internship placement on ExamHub. Field base fees up to $1200 (no add-ons). Advanced state search, priority fast track, US + international setups. Weekly salary estimates included.",
      },
      {
        name: "keywords",
        content:
          "internship placement, weekly salary, priority fast track, advanced state search, software engineering internship, international internship, ExamHub",
      },
    ],
  }),
});

const GROUPS: {
  id: "speed" | "matching" | "docs" | "coaching";
  label: string;
  icon: typeof Zap;
}[] = [
  { id: "speed", label: "Speed", icon: Zap },
  { id: "matching", label: "Matching", icon: Search },
  { id: "docs", label: "Documents", icon: Sparkles },
  { id: "coaching", label: "Coaching", icon: Rocket },
];

function InternshipsPage() {
  const { isAdmin } = Route.useRouteContext();
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [fieldId, setFieldId] = useState(INTERNSHIP_FIELDS[0]!.id);
  const [countryId, setCountryId] = useState("us");
  const [state, setState] = useState<string>("California");
  const [extras, setExtras] = useState<string[]>([
    "ai-matching",
    "advanced-state-search",
  ]);
  const [preferences, setPreferences] = useState("");
  const [contactMethod, setContactMethod] = useState("email");
  const [contactValue, setContactValue] = useState("");
  const [loading, setLoading] = useState(false);

  const field = INTERNSHIP_FIELDS.find((f) => f.id === fieldId)!;
  const country = INTERNSHIP_COUNTRIES.find((c) => c.id === countryId)!;
  const isUs = countryId === "us";

  const salary = useMemo(
    () => estimateWeeklySalary(fieldId, state, countryId),
    [fieldId, state, countryId],
  );

  const baseFee = useMemo(
    () => internshipBaseWithCountry(fieldId, countryId),
    [fieldId, countryId],
  );

  const total = useMemo(() => {
    const add = INTERNSHIP_EXTRAS.filter((e) => extras.includes(e.id)).reduce(
      (s, e) => s + e.priceUsd,
      0,
    );
    return baseFee + add;
  }, [baseFee, extras]);

  const stateInsights = useMemo(() => {
    if (!isUs) return null;
    const hot = field.hotStates?.includes(state);
    const advanced = extras.includes("advanced-state-search");
    return {
      hot,
      advanced,
      employersHint: hot
        ? `${state} is a top hiring market for ${field.label}. Advanced search prioritizes metro hubs and remote-friendly hosts.`
        : `We'll run a broad ${state} employer scan for ${field.label}${advanced ? " with advanced depth" : ""}.`,
    };
  }, [isUs, field, state, extras]);

  function toggle(id: string) {
    setExtras((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      toast.error("Sign in to request an internship");
      navigate({ to: "/login" });
      return;
    }
    setLoading(true);
    try {
      const locationLabel = isUs
        ? state
        : state.trim()
          ? `${country.label} · ${state.trim()}`
          : country.label;
      const res = await submitInternshipRequest({
        data: {
          fieldId,
          state: locationLabel,
          countryId,
          extraIds: extras.filter(
            (id) => !(id === "advanced-state-search" && !isUs),
          ),
          preferences: [
            preferences,
            `Country setup: ${country.label}`,
            country.setupNote,
            isUs && extras.includes("advanced-state-search")
              ? `Advanced state search: ${state}`
              : "",
            extras.includes("priority-fast-track")
              ? "PRIORITY FAST TRACK requested"
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
          contactMethod,
          contactValue,
        },
      });
      toast.success(
        `Request sent — placement ${formatUsd(res.totalUsd)}, est. weekly ${formatUsd(res.weeklySalary.mid)}`,
      );
      navigate({ to: "/orders", search: { placed: undefined } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell isAdmin={isAdmin}>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Badge variant="accent" className="mb-3">
          Base fee ≤ $1,200 · add-ons optional
        </Badge>
        <h1 className="font-display text-3xl font-bold text-fg sm:text-4xl">
          Internship matching
        </h1>
        <p className="mt-2 max-w-2xl text-fg-muted">
          Choose field, country, and (for US) state for advanced market search.
          Base placement is capped at {formatUsd(1200)} without add-ons. Priority
          fast track and neat option groups below. Other countries use a different
          setup path after you submit.
        </p>

        <form onSubmit={onSubmit} className="mt-8 grid gap-6 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe2 className="h-5 w-5 text-primary" />
                  Field, country & location
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Internship field</Label>
                  <Select
                    value={fieldId}
                    onChange={(e) => setFieldId(e.target.value)}
                  >
                    {INTERNSHIP_FIELDS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label} — base {formatUsd(f.basePriceUsd)}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-muted">
                    US base never exceeds $1,200 before add-ons.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Country / region setup</Label>
                  <Select
                    value={countryId}
                    onChange={(e) => {
                      const next = e.target.value;
                      setCountryId(next);
                      if (next !== "us") {
                        setState("");
                        setExtras((prev) =>
                          prev.filter((x) => x !== "advanced-state-search"),
                        );
                      } else if (!state) {
                        setState("California");
                      }
                    }}
                  >
                    {INTERNSHIP_COUNTRIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </div>
                {isUs ? (
                  <div className="space-y-2">
                    <Label>US state (advanced search)</Label>
                    <Select
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                    >
                      {US_STATES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                          {field.hotStates?.includes(s) ? " ★" : ""}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>City / region preference (optional)</Label>
                    <Input
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="e.g. London, Toronto, Berlin…"
                    />
                  </div>
                )}
                <div className="sm:col-span-2 rounded-xl border border-border bg-bg-soft/80 p-3 text-sm text-fg-muted">
                  <p className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      <strong className="text-fg">{country.label} setup:</strong>{" "}
                      {country.setupNote}
                    </span>
                  </p>
                  {stateInsights ? (
                    <p className="mt-2 pl-6 text-xs">
                      {stateInsights.employersHint}
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Options (neatly grouped)</CardTitle>
                <p className="text-sm text-fg-muted">
                  Priority fast track is under Speed. Advanced state search deepens
                  the US employer scan.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                {GROUPS.map((g) => {
                  const items = INTERNSHIP_EXTRAS.filter((e) => e.group === g.id);
                  if (!items.length) return null;
                  return (
                    <div key={g.id}>
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg">
                        <g.icon className="h-4 w-4 text-primary" />
                        {g.label}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {items.map((opt) => {
                          const on = extras.includes(opt.id);
                          const disabled =
                            !isUs && opt.id === "advanced-state-search";
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              disabled={disabled}
                              onClick={() => toggle(opt.id)}
                              className={cn(
                                "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors",
                                on
                                  ? "border-primary/50 bg-primary-soft/40"
                                  : "border-border bg-surface hover:border-primary/40 hover:bg-bg-soft",
                                disabled && "cursor-not-allowed opacity-50",
                              )}
                            >
                              <span
                                className={cn(
                                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                                  on
                                    ? "border-primary bg-primary text-primary-fg"
                                    : "border-border-strong",
                                )}
                              >
                                {on ? (
                                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                ) : null}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium text-fg">
                                    {opt.label}
                                  </span>
                                  <span className="shrink-0 text-xs font-semibold text-primary">
                                    +{formatUsd(opt.priceUsd)}
                                  </span>
                                </span>
                                <span className="mt-0.5 block text-xs text-fg-muted">
                                  {disabled
                                    ? "US-only option"
                                    : opt.description}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preferences & contact</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Preferences / extra notes</Label>
                  <Textarea
                    value={preferences}
                    onChange={(e) => setPreferences(e.target.value)}
                    placeholder="Company size, remote only, start date, visa needs…"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact method</Label>
                  <Select
                    value={contactMethod}
                    onChange={(e) => setContactMethod(e.target.value)}
                  >
                    {CONTACT_METHODS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Handle / address</Label>
                  <Input
                    required
                    value={contactValue}
                    onChange={(e) => setContactValue(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="sticky top-24 shadow-glow">
              <CardHeader>
                <CardTitle>Estimate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-border bg-bg-soft p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Weekly salary estimate
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold text-fg">
                    {formatUsd(salary.min)} – {formatUsd(salary.max)}
                  </p>
                  <p className="text-sm text-fg-muted">
                    Midpoint ~{formatUsd(salary.mid)} / week
                  </p>
                  <p className="mt-1 text-xs text-muted">{salary.marketNote}</p>
                </div>
                <div className="rounded-2xl bg-primary-soft/60 p-5 text-center">
                  <p className="text-sm text-fg-muted">Placement fee</p>
                  <p className="font-display text-4xl font-bold text-primary">
                    {formatUsd(total)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Base {formatUsd(baseFee)}
                    {isUs ? " (max $1,200)" : ` · ${country.label} setup`}
                    {extras.length
                      ? ` + ${extras.length} add-on${extras.length > 1 ? "s" : ""}`
                      : ""}
                  </p>
                </div>
                <ul className="space-y-1.5 text-sm text-fg-muted">
                  <li className="flex justify-between">
                    <span>{field.label} base</span>
                    <span>{formatUsd(baseFee)}</span>
                  </li>
                  {INTERNSHIP_EXTRAS.filter((e) => extras.includes(e.id)).map(
                    (e) => (
                      <li key={e.id} className="flex justify-between gap-2">
                        <span className="truncate">{e.label}</span>
                        <span className="shrink-0">+{formatUsd(e.priceUsd)}</span>
                      </li>
                    ),
                  )}
                </ul>
                {extras.includes("priority-fast-track") ? (
                  <div className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-xs font-medium text-fg">
                    Priority fast track on — first outreach target within 72h after
                    payment.
                  </div>
                ) : null}
                {isPending ? (
                  <div className="h-11 animate-pulse rounded-xl bg-bg-soft" />
                ) : user ? (
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? "Sending…" : "Submit internship request"}
                  </Button>
                ) : (
                  <Link to="/login">
                    <Button type="button" size="lg" className="w-full">
                      Sign in to submit
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>
        </form>
      </div>
    </Shell>
  );
}
