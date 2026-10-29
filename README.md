# RTA Garage Configurator

A customer-facing wall planner for the Signature Gray garage cabinet line. Give it a wall length, a
ceiling height and a goal; it returns three complete, priced, buildable walls you can edit and add to
the cart.

Start with `CLAUDE.md` for the project context, `docs/SPEC.md` for the product, `docs/SOLVER_RULES.md`
for the design grammar the solver enforces, and `docs/DECISIONS.md` for why things are the way they
are.

## Layout

```
src/GarageConfigurator.Core    solver, validator, pricing — pure, no I/O, no Azure
src/GarageConfigurator.Api     Azure Functions over Core; thin HTTP wrappers
web/                           React + Vite wizard, SVG elevation, editor
infra/                         Bicep for the whole environment
data/                          catalog.json, wall fixtures, nop product-id map
```

## Running it locally

```bash
dotnet test                                  # 464 Core + 108 API tests
cd web && npm install && npm test            # 184 web tests (demo-2.0-1d)
```

The full stack is three processes:

```bash
azurite --location .azurite                           # Table Storage for designs and leads
func start --script-root src/GarageConfigurator.Api   # API on :7071
cd web && npm run dev                                 # web on :5173, proxies /api to :7071
```

Copy `src/GarageConfigurator.Api/local.settings.example.json` to `local.settings.json` first.

**Installing the tools without Homebrew or sudo.** `npm i -g --prefix ~/.local azurite` works as is.
The npm package for Functions Core Tools downloads its binary in a postinstall step, and Node rejects
the TLS certificate on this network even though `curl` accepts it, so fetch the zip directly:

```bash
mkdir -p ~/.local/share/azure-functions-cli && cd ~/.local/share/azure-functions-cli
curl -sSLO https://cdn.functions.azure.com/public/4.0.306962/Azure.Functions.Cli.osx-arm64.4.15.2.zip
unzip -q Azure.Functions.Cli.osx-arm64.4.15.2.zip && chmod +x func
ln -sf "$PWD/func" ~/.local/bin/func
```

If the `azurite` link is not executable, run it as `node ~/.local/lib/node_modules/azurite/dist/src/azurite.js`.

The UI alone works without any of this — `http://localhost:5173/?demo=vignette-72` renders a stored
API payload. See `web/README.md` for the full list of demo fixtures.

`?demo=vignette-72`, then **See it in 3D** on any card, shows the 3D view without the API.

### Running the stakeholder demo

Use a production build, not `npm run dev`, and keep each process in its own Terminal window:

```bash
node ~/.local/lib/node_modules/azurite/dist/src/azurite.js --silent --location .azurite
func start --script-root src/GarageConfigurator.Api          # :7071 — start only one
cd web && npm run build && npx vite preview --port 4173      # planner on :4173
python3 -m http.server 8090 --bind 127.0.0.1                 # from the repo root
```

Open `http://localhost:8090/prototype/garage-page.html`. Every planner CTA opens the slide-out on :4173.
"Refused to connect" in the slide-out means those windows were closed or the Mac slept: restart them.
A 500 from `/api/*` means the API on :7071 is down.

### Versions

Phase 2 ships as optional branches, each built from Phase 1 (decided 2026-10-05, see DECISIONS):

| Branch | What it adds | Web tests |
|---|---|---|
| `v1a` | Phase 1, plus the render-accurate drawing and product photos | 129 |
| `v1b-reorder` | Reordering in the editor: drag, arrow keys, Move left/right | 156 |
| `v1c-3d` | "See it in 3D" — a view-only, lazily loaded Three.js view per layout | 148 |
| `v2.0` | 1A + 1B + 1C together | 175 |
| `v1d-3d-quality` | 1C's 3D in a large pop-up, modeled to the manufacturer's renders (optional; not in 2.0) | 152 |
| `demo-2.0-1d` | 2.0 with 1D's pop-up in place of 1C's 3D, plus the prototype page. **Approved by stakeholders 2026-10-29** | 184 |

1B and 1C do not depend on each other; either can be dropped. `npm run check:bundle` (on `v1c-3d` and
`v2.0`) fails the build if the page everyone loads grows past budget or Three.js leaks into it.

**Product images.** The parts list and cabinet panel show the manufacturer's renders. The originals
(~280 MB) live in `assets/reference/sku-renders/` and are not in git; `data/render-manifest.json` maps
each SKU to its file. After renders change, run `cd web && npm run build:renders` to regenerate
`web/public/renders/*.webp` and `web/public/textures/butcher-block.webp`, then commit those.

## Deploying

### One-time setup

1. **Resource group and federated credentials.** Create the group, then an app registration with a
   federated credential for this repo so the workflow needs no stored Azure password.

   ```bash
   az group create -n rg-garage-dev -l eastus2
   az ad app create --display-name garage-deploy
   # Add a federated credential for repo:<org>/<repo>:ref:refs/heads/main, then grant the
   # service principal Contributor on rg-garage-dev.
   ```

2. **Repository secrets** (Settings → Secrets → Actions), and a GitHub environment named
   `garage-dev`:

   | Secret | What it is |
   |---|---|
   | `AZURE_CLIENT_ID` | App registration's client id |
   | `AZURE_TENANT_ID` | Directory id |
   | `AZURE_SUBSCRIPTION_ID` | Subscription the group lives in |
   | `AZURE_RESOURCE_GROUP` | `rg-garage-dev` |
   | `AZURE_STATIC_WEB_APPS_API_TOKEN` | From the Static Web App once provisioned (step 3) |

3. **First provision**, to create the Static Web App whose token step 2 needs:

   ```bash
   az deployment group create \
     --resource-group rg-garage-dev \
     --template-file infra/main.bicep \
     --parameters environmentName=dev
   az staticwebapp secrets list --name garage-dev-web --query properties.apiKey -o tsv
   ```

4. **Product ids.** Export the SKU → nopCommerce product id map into `data/nop-product-ids.json`.
   Until it is there, add-to-cart tells the customer it cannot place the order automatically and
   offers a designer. See `data/nop-product-ids.README.md`.

### Day to day

Pushing to `main` runs `deploy.yml`: provision → API → web → smoke test. The smoke test solves a real
240" wall against the deployed API and fails the run if it does not come back with a priced layout,
so a green deploy means the thing actually works rather than merely that the upload succeeded.

`workflow_dispatch` lets you pick the environment. Every deploy runs `az deployment group what-if`
first and prints the diff into the job log before it changes anything.

### What gets created

| Resource | Why |
|---|---|
| Static Web App (Standard) | The wizard. Standard, not Free, because linked backends need it |
| Function App (Linux, Y1) | The API, linked into the Static Web App so `/api/*` is same-origin |
| Storage account + `designs`, `leads` tables | Share links and lead capture |
| Application Insights + Log Analytics | The funnel in SPEC.md arrives as custom events |

## The one thing that is not wired up

**Add-to-cart cannot complete from a Static Web App.** nopCommerce identifies a cart by its session
cookie, so the add-to-cart posts only land when the page is being served by the store itself. The API
says so explicitly — the hand-off carries a `storeOrigin`, and the browser checks it against its own
origin before posting anything rather than firing requests that would quietly 404.

Three ways to close this, in the order I would try them:

1. **Serve the wizard from the store.** Embed the built `web/dist` in the nopCommerce site so the page
   and the cart share an origin. Everything then works as written, and the Static Web App becomes a
   staging and preview environment rather than the customer-facing one.
2. **Server-side cart.** Have the API talk to nopCommerce on the customer's behalf. Needs a way to act
   on their session, which is a conversation with whoever owns the store.
3. **Hand off at the cart.** Save the design, send the customer to `/cart` with the code, and have the
   store page add the lines. Simplest, but it moves work into nop.

Right now the behaviour is option 3's honest version: off-origin, the button saves the design and
sends the customer to the cart rather than pretending to have added anything.

## Verifying a deploy by hand

```bash
host=https://garage-dev-web.azurestaticapps.net

curl -fsS -X POST $host/api/solve -H 'Content-Type: application/json' \
  -d '{"wall":{"length":240,"ceiling":96},"goal":"Balanced"}' | jq '.options | length'

curl -fsS $host/api/openapi.yaml | head -5
```

Then open `$host`, plan a wall, save it, and reopen the share link to confirm Table Storage is
reachable.
