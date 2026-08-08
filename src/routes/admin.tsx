import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/layout/shell";
import {
  listAllOrders,
  listResearchRequests,
  listInternshipRequests,
  listBlogPosts,
  updateOrderStatus,
  fulfillOrder,
  updateResearchStatus,
  updateInternshipStatus,
  saveBlogPost,
  deleteBlogPost,
  generateBlogWithAi,
  generateSeoForProduct,
  getAdminStats,
  checkIsAdmin,
  listAllChatThreads,
  listChatMessages,
  sendChatMessage,
  closeChatThread,
  getSeoDirectoryForAdmin,
  listSellerApplications,
  updateSellerApplicationStatus,
} from "@/lib/server/examhub";
import { PRODUCTS, ADMIN_EMAIL, SUPPORT_DISCORD } from "@/lib/data/catalog";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { formatUsd } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Package,
  FileText,
  Briefcase,
  Sparkles,
  Trash2,
  Wand2,
  MessageCircle,
  Copy,
  Link2,
  Send,
  Store,
  Lock,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Admin Dashboard | ExamHub" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type Tab =
  | "overview"
  | "orders"
  | "research"
  | "internships"
  | "sellers"
  | "blog"
  | "seo"
  | "chat";

function siteOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "https://examhub.app";
}

function AdminFulfillForm({
  orderId,
  onDone,
}: {
  orderId: string;
  onDone: () => Promise<void> | void;
}) {
  const [links, setLinks] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-1.5 rounded-xl border border-border bg-bg-soft/60 p-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
        Complete offer
      </p>
      <Input
        value={links}
        onChange={(e) => setLinks(e.target.value)}
        placeholder="File links (one per line)"
        className="h-8 text-xs"
      />
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Message / contact note"
        className="h-8 text-xs"
      />
      <div className="flex gap-1">
        <Button
          size="sm"
          className="h-8 flex-1 text-xs"
          disabled={busy || (!links.trim() && !message.trim())}
          onClick={() => {
            setBusy(true);
            void fulfillOrder({
              data: {
                id: orderId,
                deliveryLinks: links,
                adminMessage: message,
                closeOffer: true,
              },
            })
              .then(() => {
                toast.success("Offer closed · files sent · user notified");
                setLinks("");
                setMessage("");
                return onDone();
              })
              .catch((err) =>
                toast.error(err instanceof Error ? err.message : "Failed"),
              )
              .finally(() => setBusy(false));
          }}
        >
          Send & close
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={busy || (!links.trim() && !message.trim())}
          onClick={() => {
            setBusy(true);
            void fulfillOrder({
              data: {
                id: orderId,
                deliveryLinks: links,
                adminMessage: message,
                closeOffer: false,
              },
            })
              .then(() => {
                toast.success("Files sent (still open)");
                return onDone();
              })
              .catch((err) =>
                toast.error(err instanceof Error ? err.message : "Failed"),
              )
              .finally(() => setBusy(false));
          }}
        >
          Send only
        </Button>
      </div>
    </div>
  );
}

function AdminPage() {
  const { isAdmin: ctxAdmin } = Route.useRouteContext();
  const { user, isPending } = useCurrentUserState();
  const [isAdmin, setIsAdmin] = useState(ctxAdmin);
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<Awaited<
    ReturnType<typeof getAdminStats>
  > | null>(null);
  const [orders, setOrders] = useState<
    Awaited<ReturnType<typeof listAllOrders>>
  >([]);
  const [research, setResearch] = useState<
    Awaited<ReturnType<typeof listResearchRequests>>
  >([]);
  const [interns, setInterns] = useState<
    Awaited<ReturnType<typeof listInternshipRequests>>
  >([]);
  const [posts, setPosts] = useState<
    Awaited<ReturnType<typeof listBlogPosts>>
  >([]);
  const [sellers, setSellers] = useState<
    Awaited<ReturnType<typeof listSellerApplications>>
  >([]);
  const [chats, setChats] = useState<
    Awaited<ReturnType<typeof listAllChatThreads>>
  >([]);
  const [seoDir, setSeoDir] = useState<
    Awaited<ReturnType<typeof getSeoDirectoryForAdmin>>
  >([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [chatMsgs, setChatMsgs] = useState<
    Awaited<ReturnType<typeof listChatMessages>>
  >([]);
  const [adminDraft, setAdminDraft] = useState("");

  const [editId, setEditId] = useState<string | undefined>();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDesc, setSeoDesc] = useState("");
  const [seoKw, setSeoKw] = useState("");
  const [html, setHtml] = useState("");
  const [postStatus, setPostStatus] = useState<"draft" | "published">(
    "published",
  );
  const [aiTopic, setAiTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [seoProductId, setSeoProductId] = useState(PRODUCTS[0]?.id ?? "");
  const [seoResult, setSeoResult] = useState<{
    seoTitle: string;
    seoDescription: string;
    seoKeywords: string;
  } | null>(null);
  const [seoFilter, setSeoFilter] = useState("");

  const [bootstrapping, setBootstrapping] = useState(true);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      const admin = await checkIsAdmin();
      if (!admin.isAdmin) {
        setIsAdmin(false);
        setBootstrapping(false);
        return;
      }
      setIsAdmin(true);
      try {
        sessionStorage.setItem("examhub.is-admin", "1");
      } catch { /* ignore */ }
      const [s, o, r, i, p, c, d, sell] = await Promise.all([
        getAdminStats(),
        listAllOrders(),
        listResearchRequests(),
        listInternshipRequests(),
        listBlogPosts({ data: { all: true } }),
        listAllChatThreads(),
        getSeoDirectoryForAdmin(),
        listSellerApplications(),
      ]);
      setStats(s);
      setOrders(o);
      setResearch(r);
      setInterns(i);
      setPosts(p);
      setChats(c);
      setSeoDir(d);
      setSellers(sell);
    } catch {
      // Network blip — keep current admin/orders UI; do NOT set isAdmin false
      if (!opts?.silent) {
        /* leave state as-is */
      }
    } finally {
      setBootstrapping(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setBootstrapping(false);
      return;
    }
    void refresh();
    // Soft poll orders every 20s without tearing down the page
    const id = window.setInterval(() => void refresh({ silent: true }), 20000);
    return () => window.clearInterval(id);
  }, [user?.id, refresh]);

  useEffect(() => {
    if (!activeChat) return;
    void listChatMessages({ data: { threadId: activeChat } }).then(setChatMsgs);
    const id = window.setInterval(() => {
      void listChatMessages({ data: { threadId: activeChat } }).then(
        setChatMsgs,
      );
    }, 4000);
    return () => window.clearInterval(id);
  }, [activeChat]);

  if (isPending || (user && bootstrapping && !isAdmin)) {
    return (
      <Shell isAdmin>
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="h-48 animate-pulse rounded-2xl bg-bg-soft" />
          <p className="mt-4 text-center text-sm text-fg-muted">Loading admin…</p>
        </div>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <RedirectToSignIn />
      </Shell>
    );
  }

  if (!isAdmin) {
    return (
      <Shell>
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <Lock className="mx-auto mb-3 h-8 w-8 text-muted" />
          <h1 className="font-display text-2xl font-bold text-fg">
            Admin access required
          </h1>
          <p className="mt-2 text-sm text-fg-muted">
            Only the locked owner account{" "}
            <strong>{ADMIN_EMAIL}</strong> can open this dashboard. This cannot
            be changed by users.
          </p>
          <p className="mt-1 text-xs text-muted">
            Current account: {user.primaryEmail ?? user.displayName}
          </p>
          <Link to="/" className="mt-6 inline-block">
            <Button variant="outline">Back home</Button>
          </Link>
        </div>
      </Shell>
    );
  }

  function loadPost(p: (typeof posts)[0]) {
    setEditId(p.id);
    setTitle(p.title);
    setSlug(p.slug);
    setSeoTitle(p.seo_title);
    setSeoDesc(p.seo_description);
    setSeoKw(p.seo_keywords ?? "");
    setHtml(p.html_content);
    setPostStatus(p.status === "published" ? "published" : "draft");
    setTab("blog");
  }

  function resetPost() {
    setEditId(undefined);
    setTitle("");
    setSlug("");
    setSeoTitle("");
    setSeoDesc("");
    setSeoKw("");
    setHtml("");
    setPostStatus("published");
  }

  async function savePost() {
    setBusy(true);
    try {
      await saveBlogPost({
        data: {
          id: editId,
          title,
          slug: slug || undefined,
          seoTitle: seoTitle || title,
          seoDescription: seoDesc,
          seoKeywords: seoKw,
          htmlContent: html,
          status: postStatus,
        },
      });
      toast.success("Post saved");
      resetPost();
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function runAiBlog() {
    if (!aiTopic.trim()) {
      toast.error("Enter a topic");
      return;
    }
    setBusy(true);
    try {
      const res = await generateBlogWithAi({ data: { topic: aiTopic } });
      setTitle(res.title);
      setSeoTitle(res.seoTitle);
      setSeoDesc(res.seoDescription);
      setSeoKw(res.seoKeywords);
      setHtml(res.htmlContent);
      toast.success("AI draft ready — review and save");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI failed");
    } finally {
      setBusy(false);
    }
  }

  async function runProductSeo() {
    setBusy(true);
    try {
      const res = await generateSeoForProduct({
        data: { productId: seoProductId },
      });
      setSeoResult(res);
      toast.success("SEO title generated");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "SEO failed");
    } finally {
      setBusy(false);
    }
  }

  function copyText(text: string) {
    void navigator.clipboard.writeText(text).then(() => {
      toast.success("Copied for Google inspection");
    });
  }

  const origin = siteOrigin();
  const filteredSeo = seoDir.filter((row) => {
    if (!seoFilter.trim()) return true;
    const q = seoFilter.toLowerCase();
    return (
      row.name.toLowerCase().includes(q) ||
      row.path.toLowerCase().includes(q) ||
      row.seoTitle.toLowerCase().includes(q) ||
      row.category.toLowerCase().includes(q)
    );
  });

  const tabs: { id: Tab; label: string; icon: typeof Package }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "orders", label: "Orders", icon: Package },
    { id: "research", label: "Research", icon: FileText },
    { id: "internships", label: "Internships", icon: Briefcase },
    { id: "sellers", label: "Sellers", icon: Store },
    { id: "blog", label: "Blog", icon: FileText },
    { id: "seo", label: "SEO", icon: Sparkles },
    { id: "chat", label: "Chat", icon: MessageCircle },
  ];

  return (
    <Shell isAdmin>
      <div className="mx-auto w-full max-w-6xl min-w-0 px-3 py-6 sm:px-6 sm:py-8">
        <div className="mb-5">
          <h1 className="font-display text-2xl font-bold text-fg sm:text-3xl">
            Admin dashboard
          </h1>
          <p className="text-sm text-fg-muted">
            Locked owner · {ADMIN_EMAIL} · Discord @{SUPPORT_DISCORD}
          </p>
        </div>

        <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-bg-soft p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? "bg-surface text-primary shadow-sm"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {t.id === "chat" && stats?.openChats ? (
                <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-fg">
                  {stats.openChats}
                </span>
              ) : null}
              {t.id === "sellers" && stats?.pendingSellers ? (
                <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-fg">
                  {stats.pendingSellers}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {tab === "overview" ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Orders", value: stats?.orders ?? 0 },
              { label: "Pending orders", value: stats?.pendingOrders ?? 0 },
              { label: "Pending research", value: stats?.pendingResearch ?? 0 },
              {
                label: "Pending internships",
                value: stats?.pendingInternships ?? 0,
              },
              { label: "Seller apps", value: stats?.pendingSellers ?? 0 },
              { label: "Open chats", value: stats?.openChats ?? 0 },
              { label: "Blog posts", value: stats?.posts ?? 0 },
              { label: "Products", value: stats?.productCount ?? 0 },
            ].map((c) => (
              <Card key={c.label}>
                <CardContent className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                    {c.label}
                  </p>
                  <p className="mt-1 font-display text-3xl font-bold text-fg">
                    {c.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        {tab === "orders" ? (
          <div className="space-y-3">
            {orders.map((o) => (
              <Card key={o.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-fg">{o.product_name}</p>
                      <Badge>{o.status}</Badge>
                    </div>
                    <p className="font-mono text-xs text-muted">{o.id}</p>
                    <p className="mt-1 text-sm text-fg-muted">
                      {formatUsd(o.amount_usd)} · {o.payment_method} ·{" "}
                      {o.contact_method}: {o.contact_value}
                    </p>
                    {o.crypto_tx_id ? (
                      <p className="truncate font-mono text-xs text-muted">
                        TX {o.crypto_tx_id}
                      </p>
                    ) : null}
                    {o.gift_card_key ? (
                      <p className="truncate font-mono text-xs text-muted">
                        GC {o.gift_card_key}
                      </p>
                    ) : null}
                    {o.notes ? (
                      <p className="mt-1 text-xs text-fg-muted">{o.notes}</p>
                    ) : null}
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-56">
                    <Select
                      value={o.status}
                      onChange={(e) =>
                        void updateOrderStatus({
                          data: { id: o.id, status: e.target.value },
                        })
                          .then(() => void refresh())
                          .then(() => toast.success("Status updated · user notified"))
                      }
                      className="w-full"
                    >
                      <option value="pending">pending</option>
                      <option value="paid">confirmed / paid</option>
                      <option value="fulfilling">fulfilling</option>
                      <option value="completed">completed</option>
                      <option value="closed">closed</option>
                      <option value="cancelled">cancelled</option>
                    </Select>
                    <AdminFulfillForm orderId={o.id} onDone={() => void refresh()} />
                  </div>
                </CardContent>
              </Card>
            ))}
            {orders.length === 0 ? (
              <p className="text-sm text-muted">No orders yet.</p>
            ) : null}
          </div>
        ) : null}

        {tab === "research" ? (
          <div className="space-y-3">
            {research.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:justify-between">
                  <div>
                    <p className="font-semibold text-fg">{r.subject}</p>
                    <p className="text-sm text-fg-muted">
                      Quote {formatUsd(r.quote_usd)} · {r.contact_method}:{" "}
                      {r.contact_value}
                    </p>
                    <p className="text-xs text-muted">{r.options_json}</p>
                  </div>
                  <Select
                    value={r.status}
                    onChange={(e) =>
                      void updateResearchStatus({
                        data: { id: r.id, status: e.target.value },
                      }).then(() => void refresh())
                    }
                    className="w-36"
                  >
                    <option value="pending">pending</option>
                    <option value="contacted">contacted</option>
                    <option value="completed">completed</option>
                    <option value="cancelled">cancelled</option>
                  </Select>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        {tab === "internships" ? (
          <div className="space-y-3">
            {interns.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:justify-between">
                  <div>
                    <p className="font-semibold text-fg">{r.field}</p>
                    <p className="text-sm text-fg-muted">
                      {r.state} · fee {formatUsd(r.base_price_usd)} · weekly ~
                      {formatUsd(r.weekly_salary_usd)}
                    </p>
                    <p className="text-sm text-fg-muted">
                      {r.contact_method}: {r.contact_value}
                    </p>
                  </div>
                  <Select
                    value={r.status}
                    onChange={(e) =>
                      void updateInternshipStatus({
                        data: { id: r.id, status: e.target.value },
                      }).then(() => void refresh())
                    }
                    className="w-36"
                  >
                    <option value="pending">pending</option>
                    <option value="contacted">contacted</option>
                    <option value="placed">placed</option>
                    <option value="cancelled">cancelled</option>
                  </Select>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        {tab === "sellers" ? (
          <div className="space-y-3">
            <p className="text-sm text-fg-muted">
              Seller applications require ToS acceptance (good software, no
              doxxing, no unsafe methods, source access).
            </p>
            {sellers.map((s) => (
              <Card key={s.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-fg">{s.product_name}</p>
                        <Badge>{s.status}</Badge>
                      </div>
                      <p className="text-sm text-fg-muted">
                        {s.full_name} · {s.contact_method}: {s.contact_value}
                      </p>
                      <p className="mt-1 text-sm text-fg-muted">
                        {s.product_description}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Source access: {s.source_access_note}
                      </p>
                      <p className="mt-1 text-xs text-success">
                        ToS agreed: {s.agreed_tos ? "yes" : "no"}
                      </p>
                    </div>
                    <Select
                      value={s.status}
                      onChange={(e) =>
                        void updateSellerApplicationStatus({
                          data: { id: s.id, status: e.target.value },
                        })
                          .then(() => void refresh())
                          .then(() => toast.success("Seller status updated"))
                      }
                      className="w-36"
                    >
                      <option value="pending">pending</option>
                      <option value="reviewing">reviewing</option>
                      <option value="approved">approved</option>
                      <option value="rejected">rejected</option>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))}
            {sellers.length === 0 ? (
              <p className="text-sm text-muted">No seller applications yet.</p>
            ) : null}
          </div>
        ) : null}

        {tab === "blog" ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{editId ? "Edit post" : "New post"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    placeholder="AI topic e.g. digital SAT tips"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void runAiBlog()}
                  >
                    <Wand2 className="h-4 w-4" />
                    AI
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Slug</Label>
                  <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>SEO title</Label>
                  <Input
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>SEO description</Label>
                  <Textarea
                    value={seoDesc}
                    onChange={(e) => setSeoDesc(e.target.value)}
                    className="min-h-[60px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Keywords</Label>
                  <Input value={seoKw} onChange={(e) => setSeoKw(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>HTML content</Label>
                  <Textarea
                    value={html}
                    onChange={(e) => setHtml(e.target.value)}
                    className="min-h-[180px] font-mono text-xs"
                  />
                </div>
                <Select
                  value={postStatus}
                  onChange={(e) =>
                    setPostStatus(e.target.value as "draft" | "published")
                  }
                >
                  <option value="published">published</option>
                  <option value="draft">draft</option>
                </Select>
                <div className="flex gap-2">
                  <Button disabled={busy} onClick={() => void savePost()}>
                    Save post
                  </Button>
                  <Button type="button" variant="ghost" onClick={resetPost}>
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>
            <div className="space-y-2">
              {posts.map((p) => (
                <Card key={p.id}>
                  <CardContent className="flex items-start justify-between gap-2 p-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-fg">{p.title}</p>
                      <p className="text-xs text-muted">
                        /blog/{p.slug} · {p.status}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => loadPost(p)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          void deleteBlogPost({ data: { id: p.id } }).then(
                            () => void refresh(),
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "seo" ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Generate product SEO</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <div className="min-w-[200px] flex-1 space-y-1.5">
                  <Label>Product</Label>
                  <Select
                    value={seoProductId}
                    onChange={(e) => setSeoProductId(e.target.value)}
                  >
                    {PRODUCTS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button disabled={busy} onClick={() => void runProductSeo()}>
                  <Sparkles className="h-4 w-4" />
                  Generate
                </Button>
              </CardContent>
              {seoResult ? (
                <CardContent className="border-t border-border pt-0">
                  <p className="text-sm font-semibold text-fg">
                    {seoResult.seoTitle}
                  </p>
                  <p className="text-xs text-fg-muted">
                    {seoResult.seoDescription}
                  </p>
                </CardContent>
              ) : null}
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle>SEO directory</CardTitle>
                <Input
                  value={seoFilter}
                  onChange={(e) => setSeoFilter(e.target.value)}
                  placeholder="Filter…"
                  className="max-w-xs"
                />
              </CardHeader>
              <CardContent className="max-h-[480px] space-y-2 overflow-y-auto">
                {filteredSeo.map((row) => (
                  <div
                    key={row.path}
                    className="rounded-xl border border-border p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-fg">{row.name}</p>
                        <p className="text-xs text-primary">{row.seoTitle}</p>
                        <p className="text-xs text-muted">{row.path}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => copyText(row.seoTitle)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <a
                          href={`${origin}${row.path}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Button size="icon" variant="ghost">
                            <Link2 className="h-4 w-4" />
                          </Button>
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {tab === "chat" ? (
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {chats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveChat(c.id)}
                  className={`w-full rounded-xl border p-3 text-left text-sm transition ${
                    activeChat === c.id
                      ? "border-primary bg-primary-soft"
                      : "border-border bg-surface hover:border-primary/40"
                  }`}
                >
                  <p className="font-semibold text-fg">
                    {c.visitor_name ?? "Visitor"}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {c.last_body ?? "—"}
                  </p>
                  <Badge className="mt-1" variant="outline">
                    {c.status}
                  </Badge>
                </button>
              ))}
            </div>
            <Card className="min-h-[360px]">
              <CardContent className="flex h-full flex-col p-4">
                {!activeChat ? (
                  <p className="m-auto text-sm text-muted">
                    Select a thread
                  </p>
                ) : (
                  <>
                    <div className="mb-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void closeChatThread({
                            data: { threadId: activeChat, status: "closed" },
                          }).then(() => void refresh())
                        }
                      >
                        Close thread
                      </Button>
                    </div>
                    <div className="mb-3 max-h-[40vh] flex-1 space-y-2 overflow-y-auto">
                      {chatMsgs.map((m) => (
                        <div
                          key={m.id}
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                            m.sender === "admin"
                              ? "ml-auto bg-primary text-primary-fg"
                              : "bg-bg-soft text-fg"
                          }`}
                        >
                          <p className="text-[10px] uppercase opacity-70">
                            {m.sender}
                          </p>
                          <p className="whitespace-pre-wrap">{m.body}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={adminDraft}
                        onChange={(e) => setAdminDraft(e.target.value)}
                        placeholder="Reply as admin…"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (!adminDraft.trim()) return;
                            void sendChatMessage({
                              data: {
                                threadId: activeChat,
                                body: adminDraft,
                                asAdmin: true,
                              },
                            }).then(() => {
                              setAdminDraft("");
                              return listChatMessages({
                                data: { threadId: activeChat },
                              }).then(setChatMsgs);
                            });
                          }
                        }}
                      />
                      <Button
                        size="icon"
                        onClick={() => {
                          if (!adminDraft.trim() || !activeChat) return;
                          void sendChatMessage({
                            data: {
                              threadId: activeChat,
                              body: adminDraft,
                              asAdmin: true,
                            },
                          }).then(() => {
                            setAdminDraft("");
                            return listChatMessages({
                              data: { threadId: activeChat },
                            }).then(setChatMsgs);
                          });
                        }}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </Shell>
  );
}
