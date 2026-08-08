import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Shell } from "@/components/layout/shell";
import {
  CONTACT_METHODS,
  RESEARCH_BASE_USD,
  RESEARCH_OPTIONS,
  RESEARCH_SUBJECTS,
} from "@/lib/data/catalog";
import { submitResearchRequest } from "@/lib/server/examhub";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatUsd } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/research")({
  component: ResearchPage,
  head: () => ({
    meta: [
      {
        title:
          "Research Paper Writing Quote | Q1 Q2 Journals — ExamHub",
      },
      {
        name: "description",
        content:
          "Get a custom research paper quote on ExamHub. Choose subject, Q1/Q2 journal targets, methodology, rush delivery, and contact method. Live pricing.",
      },
      {
        name: "keywords",
        content:
          "research paper quote, Q1 journal, Q2 journal, academic writing, Scopus, Web of Science, ExamHub research",
      },
    ],
  }),
});

function ResearchPage() {
  const { isAdmin } = Route.useRouteContext();
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [subject, setSubject] = useState<string>(RESEARCH_SUBJECTS[0]!);
  const [selected, setSelected] = useState<string[]>(["q2-journal"]);
  const [contactMethod, setContactMethod] = useState("email");
  const [contactValue, setContactValue] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const quote = useMemo(() => {
    const extras = RESEARCH_OPTIONS.filter((o) => selected.includes(o.id));
    return RESEARCH_BASE_USD + extras.reduce((s, o) => s + o.priceUsd, 0);
  }, [selected]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      toast.error("Sign in to submit a research request");
      navigate({ to: "/login" });
      return;
    }
    setLoading(true);
    try {
      const res = await submitResearchRequest({
        data: {
          subject,
          optionIds: selected,
          contactMethod,
          contactValue,
          notes,
        },
      });
      toast.success(`Quote submitted — ${formatUsd(res.quoteUsd)}`);
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
        <Badge className="mb-3">Custom quote</Badge>
        <h1 className="font-display text-3xl font-bold text-fg sm:text-4xl">
          Research paper quote builder
        </h1>
        <p className="mt-2 max-w-2xl text-fg-muted">
          Select your subject and stack add-ons (Q1/Q2 journals, analysis,
          rush). We calculate a full quote and reach out on your preferred
          contact method for payment.
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-8 grid gap-6 lg:grid-cols-5"
        >
          <div className="space-y-6 lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Subject</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Label htmlFor="subject">Field of study</Label>
                <Select
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                >
                  {RESEARCH_SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted">
                  Base package: {formatUsd(RESEARCH_BASE_USD)} (outline + draft
                  structure)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Add-ons that change price</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {RESEARCH_OPTIONS.map((opt) => (
                  <Checkbox
                    key={opt.id}
                    id={opt.id}
                    checked={selected.includes(opt.id)}
                    onCheckedChange={() => toggle(opt.id)}
                    label={
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-fg">{opt.label}</span>
                          <span className="shrink-0 text-xs font-semibold text-primary">
                            +{formatUsd(opt.priceUsd)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-fg-muted">
                          {opt.description}
                        </p>
                      </div>
                    }
                  />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact & notes</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Contact method</Label>
                  <Select
                    value={contactMethod}
                    onChange={(e) => setContactMethod(e.target.value)}
                    required
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
                    placeholder="How should we reach you?"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Word count, deadline, citation style, university…"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="sticky top-24 shadow-glow">
              <CardHeader>
                <CardTitle>Your quote</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl bg-primary-soft/60 p-5 text-center">
                  <p className="text-sm text-fg-muted">Estimated total</p>
                  <p className="font-display text-4xl font-bold text-primary">
                    {formatUsd(quote)}
                  </p>
                </div>
                <ul className="space-y-1.5 text-sm text-fg-muted">
                  <li className="flex justify-between">
                    <span>Base package</span>
                    <span>{formatUsd(RESEARCH_BASE_USD)}</span>
                  </li>
                  {RESEARCH_OPTIONS.filter((o) => selected.includes(o.id)).map(
                    (o) => (
                      <li key={o.id} className="flex justify-between">
                        <span>{o.label}</span>
                        <span>+{formatUsd(o.priceUsd)}</span>
                      </li>
                    ),
                  )}
                </ul>
                {isPending ? (
                  <div className="h-11 animate-pulse rounded-xl bg-bg-soft" />
                ) : user ? (
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? "Sending…" : "Submit quote request"}
                  </Button>
                ) : (
                  <Link to="/login">
                    <Button type="button" size="lg" className="w-full">
                      Sign in to submit
                    </Button>
                  </Link>
                )}
                <p className="text-xs text-muted">
                  After submit, your request appears in the admin dashboard.
                  We’ll confirm payment details via your contact method.
                </p>
              </CardContent>
            </Card>
          </div>
        </form>
      </div>
    </Shell>
  );
}
