import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './legacy/styles.css'

const container = document.getElementById('root-react')

if (!container) {
  throw new Error('Container principal do React não foi encontrado.')
}

createRoot(container).render(<App />)
