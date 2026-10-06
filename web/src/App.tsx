import { useEffect, useState } from 'react'
import { ApiError, loadDesign, solve, track } from './api/client'
import type { Goal, LayoutDto, SolveResponse, WallDto } from './api/types'
import { WallInputs, EMPTY_DRAFT, draftFor, obstructionsFor, wallFor, type WallDraft } from './components/WallInputs'
import { LivePreview } from './components/LivePreview'
import { Results, type ActiveWall } from './components/Results'
import { ShareBar, DESIGN_PATH } from './components/ShareBar'
import { demoFixture } from './demo'
import { PREVIEW } from './preview/mode'
import { snapCeiling, snapLength } from './preview/codec'

function configIdFromPath(): string | null {
  const match = window.location.pathname.match(new RegExp(`^${DESIGN_PATH}/([A-Z0-9]{6})$`))
  return match ? match[1] : null
}

export function App() {
  const demo = import.meta.env.DEV ? demoFixture() : null
  const [draft, setDraft] = useState<WallDraft>(
    demo ? { ...EMPTY_DRAFT, length: demo.wall.length, ceiling: demo.wall.ceiling } : EMPTY_DRAFT,
  )
  const [response, setResponse] = useState<SolveResponse | null>(demo?.response ?? null)
  const [wall, setWall] = useState<WallDto | null>(demo?.wall ?? null)
  const [goal, setGoal] = useState<Goal>('Balanced')
  // A code belongs to the exact layout it saved. Change the wall afterwards and it needs a new one.
  const [saved, setSaved] = useState<{ configId: string; layout: LayoutDto } | null>(null)
  const [active, setActive] = useState<ActiveWall | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A shared link opens the wall it was saved from.
  useEffect(() => {
    const shared = configIdFromPath()
    if (!shared) {
      track('wizard_started')
      return
    }

    setBusy(true)
    loadDesign(shared)
      .then((design) => {
        if (!design) {
          setError('That design code does not match a saved wall. It may have expired.')
          return
        }

        setSaved({ configId: design.configId, layout: design.design.layout })
        setWall(design.wall)
        setGoal(design.goal)
        setDraft(draftFor(design.wall, design.goal))
        setResponse({
          options: [{ label: 'Your saved wall', standard: design.design, premiere: design.design }],
          failure: null,
          notices: [],
        })
        track('layout_viewed', design.configId, { source: 'share' })
      })
      .catch(() => setError('We could not open that design just now.'))
      .finally(() => setBusy(false))
  }, [])

  const run = async (chosenGoal: Goal) => {
    // The prototype only knows the walls it baked: snap to them, and show the customer the wall used.
    const asked = PREVIEW
      ? { ...draft, length: snapLength(draft.length), ceiling: snapCeiling(draft.ceiling), obstructions: [] }
      : draft
    if (PREVIEW) setDraft({ ...asked, goal: chosenGoal, preset: asked.length === draft.length ? draft.preset : null })
    const nextWall = wallFor({ ...asked, goal: chosenGoal })

    setBusy(true)
    setError(null)
    track('wall_defined', null, {
      length: String(nextWall.length),
      ceiling: String(nextWall.ceiling),
      goal: chosenGoal,
    })

    try {
      const solved = await solve({ wall: nextWall, goal: chosenGoal })
      setResponse(solved)
      setWall(nextWall)
      setGoal(chosenGoal)
      setSaved(null)
      track('layouts_returned', null, { count: String(solved.options.length) })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const startOver = () => {
    setResponse(null)
    setWall(null)
    setSaved(null)
    setDraft({ ...draft, goal: null })
    window.history.pushState({}, '', '/')
  }

  const chosen = response?.options[0]
  const shareLayout = active?.layout ?? chosen?.standard.layout
  const configId = saved && saved.layout === shareLayout ? saved.configId : null
  const showResults = response !== null && wall !== null

  // Below 1024 the preview is pinned to the top of the viewport, where it has ~92px to work with.
  const [pinned, setPinned] = useState(() => window.matchMedia('(max-width: 1023px)').matches)

  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)')
    const onChange = (event: MediaQueryListEvent) => setPinned(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return (
    <main className="shell">
      <header className="masthead">
        <h1>Plan your garage wall</h1>
        <p>
          Tell us about the wall and we will draw three complete, priced walls built from cabinets we
          stock — nothing is ordered until you say so.
        </p>
      </header>

      {error && (
        <div className="notice" role="alert">
          <h3>That didn’t work</h3>
          <p>{error}</p>
        </div>
      )}

      <div className="planner">
        <WallInputs draft={draft} onChange={setDraft} onSolve={run} busy={busy} />

        {showResults ? (
          <div>
            <Results
              response={response}
              wall={wall}
              configId={configId}
              onStartOver={startOver}
              onActiveChange={setActive}
            />
            {chosen && (
              <ShareBar
                wall={wall}
                goal={goal}
                layout={shareLayout ?? chosen.standard.layout}
                configId={configId}
                describing={
                  active && response.options.length > 1
                    ? `${active.label} · ${active.tier}${active.edited ? ' · edited' : ''}`
                    : undefined
                }
                onSaved={(id) => {
                  setSaved({ configId: id, layout: shareLayout ?? chosen.standard.layout })
                  window.history.replaceState({}, '', `${DESIGN_PATH}/${id}`)
                }}
              />
            )}
          </div>
        ) : draft.length > 0 ? (
          <LivePreview
            length={draft.length}
            ceiling={draft.ceiling}
            obstructions={obstructionsFor(draft)}
            compact={pinned}
            onMoveObstruction={(index, startX) =>
              setDraft({
                ...draft,
                obstructions: draft.obstructions.map((o, i) => (i === index ? { ...o, startX } : o)),
              })
            }
          />
        ) : (
          <p className="stage-placeholder">Your wall will be drawn here once you add a length.</p>
        )}
      </div>
    </main>
  )
}
