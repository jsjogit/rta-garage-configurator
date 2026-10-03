import { useEffect, useState } from 'react'
import { ApiError, loadDesign, solve, track } from './api/client'
import type { Goal, SolveResponse, WallDto } from './api/types'
import { Wizard, type WizardValue } from './components/Wizard'
import { Results } from './components/Results'
import { ShareBar, DESIGN_PATH } from './components/ShareBar'
import { demoFixture } from './demo'

function configIdFromPath(): string | null {
  const match = window.location.pathname.match(new RegExp(`^${DESIGN_PATH}/([A-Z0-9]{6})$`))
  return match ? match[1] : null
}

export function App() {
  const demo = import.meta.env.DEV ? demoFixture() : null
  const [response, setResponse] = useState<SolveResponse | null>(demo?.response ?? null)
  const [wall, setWall] = useState<WallDto | null>(demo?.wall ?? null)
  const [goal, setGoal] = useState<Goal>('Balanced')
  const [configId, setConfigId] = useState<string | null>(null)
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

        setConfigId(design.configId)
        setWall(design.wall)
        setGoal(design.goal)
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

  const run = async (value: WizardValue) => {
    setBusy(true)
    setError(null)
    track('wall_defined', null, {
      length: String(value.wall.length),
      ceiling: String(value.wall.ceiling),
      goal: value.goal,
    })

    try {
      const solved = await solve(value)
      setResponse(solved)
      setWall(value.wall)
      setGoal(value.goal)
      setConfigId(null)
      track('layouts_returned', null, { count: String(solved.options.length) })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const chosen = response?.options[0]

  return (
    <main className="shell">
      <header className="masthead">
        <p className="eyebrow">RTA Cabinet Store · Signature Gray Garage</p>
        <h1>Plan a garage wall</h1>
        <p>
          Tell us three things about the wall and we will draw you three complete, priced walls built
          from cabinets we stock. Change your mind as often as you like — nothing is ordered until you
          say so.
        </p>
      </header>

      {error && (
        <div className="notice" role="alert">
          <h3>That didn’t work</h3>
          <p>{error}</p>
        </div>
      )}

      {response && wall ? (
        <>
          <Results
            response={response}
            wall={wall}
            configId={configId}
            onStartOver={() => {
              setResponse(null)
              setWall(null)
              setConfigId(null)
              window.history.pushState({}, '', '/')
            }}
          />
          {chosen && (
            <ShareBar
              wall={wall}
              goal={goal}
              layout={chosen.standard.layout}
              configId={configId}
              onSaved={(saved) => {
                setConfigId(saved)
                window.history.replaceState({}, '', `${DESIGN_PATH}/${saved}`)
              }}
            />
          )}
        </>
      ) : (
        <Wizard onSolve={run} busy={busy} />
      )}
    </main>
  )
}
