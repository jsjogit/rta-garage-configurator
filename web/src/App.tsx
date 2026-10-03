import { useState } from 'react'
import { ApiError, solve } from './api/client'
import type { SolveResponse, WallDto } from './api/types'
import { Wizard, type WizardValue } from './components/Wizard'
import { Results } from './components/Results'
import { demoFixture } from './demo'

export function App() {
  const demo = import.meta.env.DEV ? demoFixture() : null
  const [response, setResponse] = useState<SolveResponse | null>(demo?.response ?? null)
  const [wall, setWall] = useState<WallDto | null>(demo?.wall ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (value: WizardValue) => {
    setBusy(true)
    setError(null)

    try {
      setResponse(await solve(value))
      setWall(value.wall)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

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
        <Results
          response={response}
          wall={wall}
          onStartOver={() => {
            setResponse(null)
            setWall(null)
          }}
        />
      ) : (
        <Wizard onSolve={run} busy={busy} />
      )}
    </main>
  )
}
