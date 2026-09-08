# DNS Migration — GitHub Pages → Vercel

**You run every step in this file. I can't click dashboards.**

Ordered so the site is never down. The trick is that both hosts serve a **working
site**, so during the hours DNS is propagating — some visitors hitting GitHub,
some hitting Vercel — nobody lands on a dead domain. That only holds
if you do Part 2 before Part 4. Don't reorder them.

> **Correction: they are not the same site.** GitHub Pages serves the
> `systemsbyvega` repo; Vercel serves `systemsbyvega-catalog`, which is well
> ahead of it. During propagation visitors get one of two *different* working
> sites. Zero downtime holds because both are up, not because they match.
> Content parity does not hold, and rolling back means serving the older site.

Nothing here is reversible-by-accident: the one genuinely one-way step is 6.3,
and by then you'll have verified everything.

---

## Before you start

| | |
|---|---|
| Repo (Vercel builds this) | `github.com/JasonVega1974/systemsbyvega-catalog` |
| Repo (old GitHub Pages source) | `github.com/JasonVega1974/systemsbyvega` |
| Domain | `systemsbyvega.com` (registered at GoDaddy) |
| Currently | GitHub Pages, custom domain set via the `CNAME` file |
| Moving to | Vercel |
| Total hands-on time | ~25 minutes, split by a 24-hour wait in Part 1 |

**You do not need to touch the `CNAME` file.** Vercel ignores it. Note that
GitHub deletes it for you at step 6.3 - see the warning there.

---

## Part 1 — Lower the TTL (do this 24 hours before everything else)

This is the whole zero-downtime trick. TTL is how long the world is allowed to
cache your old DNS answer. GoDaddy's default is 1 hour; some resolvers stretch
it. Drop it now, and when you flip the records tomorrow the change lands in
minutes instead of hours.

1. GoDaddy → **My Products** → next to `systemsbyvega.com` click **DNS**
2. You'll see four **A** records for `@`, all pointing at `185.199.10x.153`
   (that's GitHub Pages), and one **CNAME** for `www`
3. Edit **each** of those five records. Change only **TTL** → **Custom → 600 seconds**
4. Save

**Then stop and wait 24 hours.** Skipping this wait doesn't break anything — it
just means the cutover takes hours to fully propagate instead of minutes.

---

## Part 2 — Deploy to Vercel and prove it works (before touching DNS)

2.1 Go to **vercel.com** → log in with GitHub → **Add New… → Project**

2.2 **Import** `JasonVega1974/systemsbyvega-catalog`

> Not `systemsbyvega`. That is the old Pages repo, it has no `vercel.json`, and
> it sits many commits behind. Importing it deploys the wrong site.

2.3 On the configure screen:
- **Framework Preset:** `Other`
- **Root Directory:** leave as `./`
- **Build Command:** leave it — `vercel.json` already sets
  `node tools/build-catalog.js --check`
- **Output Directory:** leave it — `vercel.json` sets `.`

> That build command doesn't build anything. It **verifies** that the committed
> `index.html` still matches `assets/data/niches.seed.json`. If someone edits the
> seed and forgets to re-run the generator, **the deploy fails on purpose**
> rather than shipping a page whose counts disagree with the catalog.

2.4 **Environment Variables** — add these three now, scoped to **all**
environments. Get the values from Supabase → your project → **Settings → API**.

| Name | Value | Used by |
|---|---|---|
| `SUPABASE_URL` | `https://newjbexmvltvtmxollca.supabase.co` | both endpoints |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API → the **publishable** key | `/api/demand` |
| `BREVO_API_KEY` | from `BREVO-SETUP.md` | `/api/demand` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → the **service_role** secret | `/api/owner` |
| `SBV_OWNER_KEY` | a long random string you invent — 32+ characters | `/api/owner` |

> **Why only one of these bypasses RLS.** `/api/demand` writes the registry row
> with the same publishable key the browser has, so Row Level Security stays the
> thing protecting that table. `/api/owner` is the single exception: `sbv_demand`
> has no SELECT policy for anyone, by design, so the console genuinely cannot read
> it any other way. That is why the service-role key appears in exactly one file
> and behind a key check.
>
> The publishable key is in `index.html` on purpose — it is restricted by RLS and
> is safe in public source. The other two are secrets: **Vercel and nowhere else**,
> never in a file, never in a commit, never in chat.
>
> Generate the owner key with something like
> `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`
> and paste the output straight into Vercel. There is no lockout on wrong
> attempts, so length is the whole defence — do not pick a memorable phrase.

2.5 **Deploy.** You'll get a URL like `systemsbyvega-xxxx.vercel.app`.

2.6 **Verify on that URL before going near DNS.** Walk this list:

- [ ] `/` — catalog renders, all 6 plates, 29 entries
- [ ] The masthead reads **29 businesses listed / 2 open today**
- [ ] `/sites/` loads and lists 32 sites
- [ ] Spot-check five demos: `/sites/plumbing/`, `/sites/dj/blue/`,
      `/sites/bbq-food-truck/`, `/sites/pressure-washing/`, `/sites/tattoo-studio/`
- [ ] `/showcase/` — the territory map draws (proves `us-states.json` resolved)
- [ ] `/portfolio/` — project grid renders (proves `projects.json` resolved)
- [ ] `/demo/` loads
- [ ] `/pricing/` **redirects** to `/#websites` - test the trailing-slash form
      specifically. With `"trailingSlash": true`, Vercel rewrites `/pricing` to
      `/pricing/` *before* evaluating redirects, so a rule whose source is
      `/pricing` never matches and the retired page is served with a 200. The
      fix is an explicit `/pricing/` source.
- [ ] `/read-me.md` returns **404** — that file is no longer served
- [ ] `/__owner__/` loads, refuses a wrong key, and opens with the right one
- [ ] On a phone, or a 360px window: no sideways scrolling anywhere

**If any of these fail, stop and tell me.** Fixing them on the `.vercel.app` URL
costs nothing. Fixing them after DNS has moved is done in public.

---

## Part 3 — Add the domain in Vercel

3.1 Vercel project → **Settings → Domains**

3.2 Add `systemsbyvega.com` → **Add**

3.3 Add `www.systemsbyvega.com` → choose **Redirect to systemsbyvega.com**

3.4 Vercel will show **"Invalid Configuration"** and display the exact DNS
records it wants. **That warning is expected** — DNS still points at GitHub.

3.5 **Write down exactly what Vercel shows you.** It'll be an **A** record for
`@` and a **CNAME** for `www`.

> I've deliberately not printed the IP address in this document. Vercel has
> changed its apex IP before, and a stale number in a file I wrote is exactly how
> you'd end up pointing the domain at nothing. **Use the value on your screen,
> not one from any document.**

---

## Part 4 — Flip the DNS at GoDaddy

Now the actual cutover. Should take about three minutes.

4.1 GoDaddy → `systemsbyvega.com` → **DNS**

4.2 **Delete all four `A` records for `@`** (the `185.199.10x.153` ones)

4.3 **Add** a new record:
- Type **A**, Name `@`, Value **the IP Vercel showed you in 3.5**, TTL **600**

4.4 **Edit** the `www` **CNAME**:
- Value → **the hostname Vercel showed you** (typically `cname.vercel-dns.com`)
- TTL **600**

4.5 Leave every other record alone — **do not touch MX or TXT.** Deleting an MX
record is how you stop receiving mail at the domain.

4.6 Save.

---

## Part 5 — Wait for Vercel to verify

5.1 Back in Vercel → **Settings → Domains**. Within a few minutes the warning
becomes a green **Valid Configuration**.

5.2 Vercel then issues the SSL certificate automatically. Usually under a
minute, occasionally up to an hour.

5.3 Don't proceed until **both** `systemsbyvega.com` and `www.systemsbyvega.com`
show valid, with a padlock in the browser.

**If it's still invalid after 30 minutes:** you probably have a leftover fourth
`A` record, or GoDaddy has a "Parked"/"Forwarding" setting overriding you. Check
**Domain Settings → Forwarding** and remove any forward on the root domain.

---

## Part 6 — Verify on the real domain, then close the old door

6.1 Re-run the **entire Part 2.6 checklist**, this time against
`https://systemsbyvega.com`. All of it. It is not the same test — redirects,
certificates and absolute URLs all behave differently on the real domain.

6.2 Extra checks that only work here:

- [ ] `http://systemsbyvega.com` upgrades to `https://`
- [ ] `https://www.systemsbyvega.com` redirects to the apex
- [ ] `https://jasonvega1974.github.io/` still lands on `/portfolio/`
      — **this one matters**: that redirect stub is a separate repo and it
      dead-ends if `/portfolio/` ever stops existing

6.3 **Only once 6.1 and 6.2 are fully green:** GitHub → `systemsbyvega` repo →
**Settings → Pages** → under **Custom domain**, clear the field and save.

> This is the one-way step. Until you do it, GitHub Pages still claims the
> domain, and that claim can cause certificate renewal failures on Vercel weeks
> later. Do it — just do it last.
>
> **GitHub deletes `CNAME` for you.** Clearing the custom domain auto-commits
> a deletion of that file to `systemsbyvega`. Expect the commit. It will *not*
> trigger a Vercel deploy, because Vercel builds `systemsbyvega-catalog`.
>
> **Check both repos.** Both contain a `CNAME` naming the domain. If Pages is
> enabled on the catalog repo too, that is a second claim on the domain and the
> same certificate hazard applies.

6.4 GoDaddy → put the **TTL back to 1 hour**. Low TTL means more lookups
forever, and you don't need it any more.

> That is **two** records now, not the five you lowered in Part 1: Part 4
> replaced the four GitHub `A` records with a single Vercel one. Leave the MX
> records untouched.

---

## Rolling back

If something is badly wrong in the first hours, roll back at DNS — it's faster
than fixing forward:

1. GoDaddy → delete the Vercel `A` record
2. Re-add the four GitHub Pages `A` records for `@`:
   `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
3. Point the `www` CNAME back to `systemsbyvega.com` (the apex - that is what
   it held before the migration, not `jasonvega1974.github.io`)
4. GitHub → Settings → Pages → set the custom domain back to `systemsbyvega.com`

With TTL at 600 this takes effect in about ten minutes. The `CNAME` file is still
in the repo only until step 6.3, which deletes it. After that, step 4 above is
what recreates it: setting the custom domain in the Pages UI writes the file
back. Rollback still works, just not for the reason stated.

---

## What changes for you afterwards

- **Deploys:** `git push` to `main` still ships the site. Vercel builds it
  instead of GitHub.
- **Preview URLs:** every branch and PR now gets its own URL automatically.
  This is how you look at a change before it's live.
- **The seed check:** if you edit `assets/data/niches.seed.json`, run
  `node tools/build-catalog.js` and commit the regenerated `index.html`.
  Forget, and the deploy fails with a message telling you exactly that.
