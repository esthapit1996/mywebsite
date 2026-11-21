import React from 'react'
import ReactDOM from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import './i18n/i18n'
import './index.css'

// A data router with the same hash URLs as before. App keeps its own <Routes> under the catch-all
// route; the data router is what makes useBlocker work (GoCrumbs asks before leaving unsaved changes).
const router = createHashRouter([{ path: '*', element: <App /> }])

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
